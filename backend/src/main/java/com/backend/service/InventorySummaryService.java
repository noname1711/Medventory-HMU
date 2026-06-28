package com.backend.service;

import com.backend.dto.MaterialStockDTO;
import com.backend.dto.MaterialStockPageDTO;
import com.backend.entity.Material;
import com.backend.repository.InventoryCardRepository;
import com.backend.repository.IssueReservationRepository;
import com.backend.repository.MaterialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventorySummaryService {

    private final InventoryCardRepository inventoryCardRepository;
    private final IssueReservationRepository issueReservationRepository;
    private final MaterialRepository materialRepository;

    /** Ngưỡng "sắp hết hàng": tồn kho > 0 và < 10. */
    private static final BigDecimal LOW_STOCK_THRESHOLD = BigDecimal.TEN;

    /**
     * Lấy danh sách tồn kho tổng hợp theo material — đã lọc (keyword + trạng thái)
     * và phân trang ở backend, kèm summary cho thẻ thống kê.
     *
     * Tồn kho hiển thị =
     *   SUM(inventory_card.closing_stock)
     * - SUM(issue_reservations.qty_reserved WHERE status = ACTIVE)
     *
     * @param keyword lọc theo mã hoặc tên vật tư (không phân biệt hoa thường)
     * @param status  "all" | "low" (sắp hết) | "out" (hết hàng)
     */
    public MaterialStockPageDTO getMaterialStockSummary(String keyword, String status, int page, int size) {

        List<MaterialStockDTO> all = buildAllStock();

        // Summary tính trên toàn bộ danh mục (không phụ thuộc bộ lọc / trang)
        long totalItems = all.size();
        long lowStock = all.stream().filter(this::isLowStock).count();
        long outOfStock = all.stream().filter(this::isOutOfStock).count();

        // Lọc theo trạng thái + keyword
        String kw = keyword == null ? "" : keyword.trim().toLowerCase();
        String st = status == null ? "all" : status.trim().toLowerCase();

        List<MaterialStockDTO> filtered = all.stream()
                .filter(dto -> {
                    if ("low".equals(st) && !isLowStock(dto)) return false;
                    if ("out".equals(st) && !isOutOfStock(dto)) return false;
                    return true;
                })
                .filter(dto -> {
                    if (kw.isEmpty()) return true;
                    String code = dto.getMaterialCode() == null ? "" : dto.getMaterialCode().toLowerCase();
                    String name = dto.getMaterialName() == null ? "" : dto.getMaterialName().toLowerCase();
                    return code.contains(kw) || name.contains(kw);
                })
                .collect(Collectors.toList());

        // Phân trang
        int safeSize = size <= 0 ? 10 : size;
        int safePage = Math.max(0, page);
        long totalElements = filtered.size();
        int totalPages = (int) Math.max(1, Math.ceil((double) totalElements / safeSize));
        if (safePage > totalPages - 1) safePage = totalPages - 1;

        int from = Math.min(safePage * safeSize, filtered.size());
        int to = Math.min(from + safeSize, filtered.size());
        List<MaterialStockDTO> pageItems = filtered.subList(from, to);

        return new MaterialStockPageDTO(
                pageItems,
                safePage,
                safeSize,
                totalElements,
                totalPages,
                totalItems,
                lowStock,
                outOfStock
        );
    }

    private boolean isOutOfStock(MaterialStockDTO dto) {
        return dto.getClosingStock() == null || dto.getClosingStock().compareTo(BigDecimal.ZERO) <= 0;
    }

    private boolean isLowStock(MaterialStockDTO dto) {
        BigDecimal qty = dto.getClosingStock();
        return qty != null
                && qty.compareTo(BigDecimal.ZERO) > 0
                && qty.compareTo(LOW_STOCK_THRESHOLD) < 0;
    }

    /** Build danh sách tồn kho đầy đủ (chưa lọc) cho toàn bộ material. */
    private List<MaterialStockDTO> buildAllStock() {

        // 1. Tổng closing_stock theo material
        Map<Long, BigDecimal> stockMap =
                inventoryCardRepository.sumClosingStockGroupByMaterial()
                        .stream()
                        .collect(Collectors.toMap(
                                r -> (Long) r[0],
                                r -> (BigDecimal) r[1]
                        ));

        // 2. Tổng qty_reserved (ACTIVE) theo material
        Map<Long, BigDecimal> reservedMap =
                issueReservationRepository.sumActiveReservedGroupByMaterial()
                        .stream()
                        .collect(Collectors.toMap(
                                r -> (Long) r[0],
                                r -> (BigDecimal) r[1]
                        ));

        // 3. Lấy danh sách material (để map code, name, unit)
        List<Material> materials = materialRepository.findAll();

        // 4. Build DTO
        List<MaterialStockDTO> result = new ArrayList<>();

        for (Material m : materials) {
            BigDecimal stock = stockMap.getOrDefault(m.getId(), BigDecimal.ZERO);
            BigDecimal reserved = reservedMap.getOrDefault(m.getId(), BigDecimal.ZERO);

            BigDecimal available = stock.subtract(reserved);
            if (available.compareTo(BigDecimal.ZERO) < 0) {
                available = BigDecimal.ZERO; // an toàn dữ liệu
            }

            result.add(new MaterialStockDTO(
                    m.getId(),
                    m.getCode(),
                    m.getName(),
                    m.getUnit() != null ? m.getUnit().getName() : null,
                    available,
                    m.getCategory()
            ));
        }

        return result;
    }
}
