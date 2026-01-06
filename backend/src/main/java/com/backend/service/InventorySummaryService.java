package com.backend.service;

import com.backend.dto.MaterialStockDTO;
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

    /**
     * Lấy danh sách tồn kho tổng hợp theo material
     *
     * Tồn kho hiển thị =
     *   SUM(inventory_card.closing_stock)
     * - SUM(issue_reservations.qty_reserved WHERE status = ACTIVE)
     */
    public List<MaterialStockDTO> getMaterialStockSummary() {

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

        // 4. Build DTO trả về FE
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
                    available
            ));
        }

        return result;
    }
}
