package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ReceiptService {

    private final ReceiptHeaderRepository receiptHeaderRepo;
    private final ReceiptDetailRepository receiptDetailRepo;
    private final MaterialRepository materialRepo;
    private final UnitRepository unitRepo;
    private final UserRepository userRepo;
    private final InventoryCardRepository inventoryCardRepo;

    // ==================== TẠO PHIẾU NHẬP KHO ====================
    public Map<String, Object> createReceipt(ReceiptRequestDTO request, Long thuKhoId) {
        try {
            User thuKho = validateThuKho(thuKhoId);

            // Tạo header
            ReceiptHeader header = new ReceiptHeader();
            header.setCreatedBy(thuKho);
            header.setReceivedFrom(request.getReceivedFrom());
            header.setReason(request.getReason());
            header.setReceiptDate(request.getReceiptDate() != null ? request.getReceiptDate() : LocalDate.now());
            header.setTotalAmount(BigDecimal.ZERO);

            header = receiptHeaderRepo.save(header);

            // Tạo details và cập nhật tồn kho
            BigDecimal totalAmount = BigDecimal.ZERO;
            List<ReceiptDetail> details = new ArrayList<>();

            for (ReceiptDetailRequestDTO detailDTO : request.getDetails()) {
                ReceiptDetail detail = createReceiptDetail(header, detailDTO);
                details.add(detail);
                totalAmount = totalAmount.add(detail.getTotal());

                // Cập nhật hoặc tạo thẻ kho - TRUYỀN supplier từ header
                updateInventoryCard(detail, detailDTO, request.getReceivedFrom());
            }

            header.setDetails(details);
            header.setTotalAmount(totalAmount);
            receiptHeaderRepo.save(header);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Tạo phiếu nhập kho thành công");
            result.put("receiptId", header.getId());
            result.put("totalAmount", totalAmount);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi tạo phiếu nhập: " + e.getMessage());
            return result;
        }
    }

    // ==================== LẤY DANH SÁCH PHIẾU NHẬP ====================
    @Transactional(readOnly = true)
    public Map<String, Object> getMyReceipts(Long thuKhoId) {
        try {
            User thuKho = userRepo.findById(thuKhoId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!thuKho.isThuKho()) {
                throw new RuntimeException("Chỉ thủ kho được xem phiếu nhập");
            }

            List<ReceiptHeader> receipts = receiptHeaderRepo.findByCreatedByIdOrderByReceiptDateDesc(thuKhoId);

            List<Map<String, Object>> receiptDTOs = receipts.stream()
                    .map(receipt -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("id", receipt.getId());
                        map.put("receivedFrom", receipt.getReceivedFrom());
                        map.put("reason", receipt.getReason());
                        map.put("receiptDate", receipt.getReceiptDate());
                        map.put("totalAmount", receipt.getTotalAmount());
                        map.put("createdByName", receipt.getCreatedBy().getFullName());
                        map.put("itemCount", receipt.getDetails() != null ? receipt.getDetails().size() : 0);
                        return map;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Lấy danh sách phiếu nhập thành công");
            result.put("data", receiptDTOs);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi lấy danh sách phiếu nhập: " + e.getMessage());
            result.put("data", Collections.emptyList());
            return result;
        }
    }

    // ==================== LẤY CHI TIẾT PHIẾU NHẬP ====================
    @Transactional(readOnly = true)
    public Map<String, Object> getReceiptDetail(Long id) {
        try {
            ReceiptHeader receipt = receiptHeaderRepo.findById(id)
                    .orElseThrow(() -> new RuntimeException("Phiếu nhập không tồn tại"));

            // Header info
            Map<String, Object> headerInfo = new HashMap<>();
            headerInfo.put("id", receipt.getId());
            headerInfo.put("receivedFrom", receipt.getReceivedFrom());
            headerInfo.put("reason", receipt.getReason());
            headerInfo.put("receiptDate", receipt.getReceiptDate());
            headerInfo.put("totalAmount", receipt.getTotalAmount());
            headerInfo.put("createdById", receipt.getCreatedBy().getId());
            headerInfo.put("createdByName", receipt.getCreatedBy().getFullName());
            headerInfo.put("createdByEmail", receipt.getCreatedBy().getEmail());

            // Details
            List<Map<String, Object>> detailDTOs = new ArrayList<>();
            if (receipt.getDetails() != null) {
                for (ReceiptDetail detail : receipt.getDetails()) {
                    Map<String, Object> detailMap = new HashMap<>();
                    detailMap.put("id", detail.getId());
                    detailMap.put("materialId", detail.getMaterial() != null ? detail.getMaterial().getId() : null);
                    detailMap.put("materialName", detail.getDisplayName());
                    detailMap.put("spec", detail.getDisplaySpec());
                    detailMap.put("code", detail.getDisplayCode());

                    String unitName = "";
                    if (detail.getUnit() != null) {
                        unitName = detail.getUnit().getName();
                    } else if (detail.getMaterial() != null && detail.getMaterial().getUnit() != null) {
                        unitName = detail.getMaterial().getUnit().getName();
                    }
                    detailMap.put("unitName", unitName);

                    detailMap.put("price", detail.getPrice());
                    detailMap.put("qtyDoc", detail.getQtyDoc());
                    detailMap.put("qtyActual", detail.getQtyActual());
                    detailMap.put("total", detail.getTotal());
                    detailMap.put("lotNumber", detail.getLotNumber());
                    detailMap.put("mfgDate", detail.getMfgDate());
                    detailMap.put("expDate", detail.getExpDate());
                    detailMap.put("isNewMaterial", detail.getMaterial() == null);

                    detailDTOs.add(detailMap);
                }
            }

            // Summary
            Map<String, Object> summary = new HashMap<>();
            summary.put("totalItems", receipt.getDetails() != null ? receipt.getDetails().size() : 0);
            summary.put("totalAmount", receipt.getTotalAmount());
            summary.put("newMaterials", receipt.getDetails() != null ?
                    receipt.getDetails().stream().filter(d -> d.getMaterial() == null).count() : 0);

            Map<String, Object> data = new HashMap<>();
            data.put("header", headerInfo);
            data.put("details", detailDTOs);
            data.put("summary", summary);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Lấy chi tiết phiếu nhập thành công");
            result.put("data", data);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi lấy chi tiết phiếu nhập: " + e.getMessage());
            result.put("data", Collections.emptyMap());
            return result;
        }
    }

    // ==================== PRIVATE HELPER METHODS ====================

    private ReceiptDetail createReceiptDetail(ReceiptHeader header, ReceiptDetailRequestDTO dto) {
        ReceiptDetail detail = new ReceiptDetail();
        detail.setHeader(header);

        if (dto.getMaterialId() != null) {
            Material material = materialRepo.findById(dto.getMaterialId())
                    .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại"));
            detail.setMaterial(material);
        } else {
            // Vật tư mới - tạo material trước
            Material newMaterial = createNewMaterial(dto, header.getReceivedFrom());
            detail.setMaterial(newMaterial);
            detail.setName(dto.getMaterialName());
            detail.setSpec(dto.getSpec());
            detail.setCode(dto.getCode());
        }

        if (dto.getUnitId() != null) {
            Unit unit = unitRepo.findById(dto.getUnitId())
                    .orElseThrow(() -> new RuntimeException("Đơn vị tính không tồn tại"));
            detail.setUnit(unit);
        } else if (detail.getMaterial() != null) {
            detail.setUnit(detail.getMaterial().getUnit());
        }

        detail.setPrice(dto.getPrice());
        detail.setQtyDoc(dto.getQtyDoc());
        detail.setQtyActual(dto.getQtyActual() != null ? dto.getQtyActual() : dto.getQtyDoc());
        detail.setLotNumber(dto.getLotNumber());
        detail.setMfgDate(dto.getMfgDate());
        detail.setExpDate(dto.getExpDate());

        return receiptDetailRepo.save(detail);
    }

    private Material createNewMaterial(ReceiptDetailRequestDTO dto, String supplier) {
        // Kiểm tra code đã tồn tại chưa
        if (dto.getCode() != null) {
            Material existing = materialRepo.findByCode(dto.getCode());
            if (existing != null) {
                return existing; // Đã tồn tại, không tạo mới
            }
        }

        Material material = new Material();
        material.setName(dto.getMaterialName());
        material.setSpec(dto.getSpec());
        material.setCode(dto.getCode() != null ? dto.getCode() : generateTempCode());
        material.setManufacturer(supplier); // Dùng parameter supplier từ header
        material.setCategory(dto.getCategory() != null ? dto.getCategory() : 'D');

        if (dto.getUnitId() != null) {
            Unit unit = unitRepo.findById(dto.getUnitId())
                    .orElseThrow(() -> new RuntimeException("Đơn vị tính không tồn tại"));
            material.setUnit(unit);
        }

        return materialRepo.save(material);
    }

    private void updateInventoryCard(ReceiptDetail detail, ReceiptDetailRequestDTO dto, String supplier) {
        Material material = detail.getMaterial();
        String lotNumber = dto.getLotNumber();

        // Tìm thẻ kho hiện tại
        InventoryCard card = inventoryCardRepo
                .findByMaterialIdAndLotNumber(material.getId(), lotNumber)
                .orElse(null);

        if (card == null) {
            // Tạo thẻ kho mới
            card = new InventoryCard();
            card.setMaterial(material);
            card.setUnit(material.getUnit());
            card.setWarehouseName("Kho chính");
            card.setSupplier(supplier); // Dùng parameter supplier từ header
            card.setLotNumber(lotNumber);
            card.setMfgDate(dto.getMfgDate());
            card.setExpDate(dto.getExpDate());
            card.setOpeningStock(BigDecimal.ZERO);
        }

        // Cập nhật số lượng nhập
        card.addStock(dto.getQtyActual() != null ? dto.getQtyActual() : dto.getQtyDoc());

        inventoryCardRepo.save(card);
    }

    private User validateThuKho(Long userId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (!user.isThuKho()) {
            throw new RuntimeException("Chỉ thủ kho được tạo phiếu nhập");
        }

        if (!user.isApproved()) {
            throw new RuntimeException("Tài khoản chưa được kích hoạt");
        }

        return user;
    }

    private String generateTempCode() {
        return "TEMP-" + UUID.randomUUID().toString().substring(0, 8);
    }

    // ==================== TÌM KIẾM VẬT TƯ KHI THÊM VÀO PHIẾU NHẬP ====================
    public Map<String, Object> searchMaterialsForReceipt(String keyword) {
        try {
            List<Material> materials;

            if (keyword == null || keyword.trim().isEmpty()) {
                // Nếu không có keyword, trả về danh sách rỗng hoặc top 10 vật tư thường dùng
                materials = materialRepo.findAll().stream()
                        .limit(10)
                        .collect(Collectors.toList());
            } else {
                // Tìm kiếm theo tên hoặc mã
                materials = materialRepo.findByNameOrCodeContainingIgnoreCase(keyword.trim());
            }

            // Chuyển đổi sang DTO với thông tin cần thiết cho form nhập
            List<Map<String, Object>> materialDTOs = materials.stream()
                    .limit(15) // Giới hạn 15 kết quả cho autocomplete
                    .map(material -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("id", material.getId());
                        map.put("name", material.getName());
                        map.put("spec", material.getSpec());
                        map.put("code", material.getCode());
                        map.put("manufacturer", material.getManufacturer());
                        map.put("category", material.getCategory() != null ? material.getCategory().toString() : "");

                        // Thông tin đơn vị tính
                        if (material.getUnit() != null) {
                            map.put("unitId", material.getUnit().getId());
                            map.put("unitName", material.getUnit().getName());
                        }

                        // Thông tin tồn kho (tùy chọn)
                        BigDecimal totalStock = getMaterialTotalStock(material.getId());
                        map.put("currentStock", totalStock);

                        // Gợi ý từ lần nhập gần nhất (nếu có)
                        InventoryCard recentCard = getRecentInventoryCard(material.getId());
                        if (recentCard != null) {
                            map.put("suggestedSupplier", recentCard.getSupplier());
                            map.put("suggestedLotNumber", recentCard.getLotNumber());
                        }

                        return map;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Tìm kiếm vật tư thành công");
            result.put("data", materialDTOs);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi tìm kiếm vật tư: " + e.getMessage());
            result.put("data", Collections.emptyList());
            return result;
        }
    }

    // ==================== LẤY THÔNG TIN CHI TIẾT VẬT TƯ ====================
    public Map<String, Object> getMaterialDetailsForReceipt(Long materialId) {
        try {
            Material material = materialRepo.findById(materialId)
                    .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại"));

            Map<String, Object> materialData = new HashMap<>();
            materialData.put("id", material.getId());
            materialData.put("name", material.getName());
            materialData.put("spec", material.getSpec());
            materialData.put("code", material.getCode());
            materialData.put("manufacturer", material.getManufacturer());
            materialData.put("category", material.getCategory() != null ? material.getCategory().toString() : "");

            // Thông tin đơn vị tính
            if (material.getUnit() != null) {
                materialData.put("unitId", material.getUnit().getId());
                materialData.put("unitName", material.getUnit().getName());
            }

            // Tổng tồn kho
            BigDecimal totalStock = getMaterialTotalStock(materialId);
            materialData.put("totalStock", totalStock);

            // Các lô hiện có trong kho
            List<Map<String, Object>> lots = inventoryCardRepo.findByMaterialId(materialId)
                    .stream()
                    .map(card -> {
                        Map<String, Object> lotMap = new HashMap<>();
                        lotMap.put("id", card.getId());
                        lotMap.put("lotNumber", card.getLotNumber());
                        lotMap.put("supplier", card.getSupplier());
                        lotMap.put("expDate", card.getExpDate());
                        lotMap.put("mfgDate", card.getMfgDate());
                        lotMap.put("currentStock", card.getClosingStock());
                        return lotMap;
                    })
                    .collect(Collectors.toList());

            materialData.put("existingLots", lots);

            // Lấy lần nhập gần nhất để gợi ý
            InventoryCard recentCard = getRecentInventoryCard(materialId);
            if (recentCard != null) {
                Map<String, Object> recentInfo = new HashMap<>();
                recentInfo.put("supplier", recentCard.getSupplier());
                recentInfo.put("lotNumber", recentCard.getLotNumber());
                recentInfo.put("price", getRecentPrice(materialId)); // TODO: Cần method lấy giá gần nhất
                materialData.put("recentReceipt", recentInfo);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Lấy thông tin vật tư thành công");
            result.put("data", materialData);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi lấy thông tin vật tư: " + e.getMessage());
            result.put("data", Collections.emptyMap());
            return result;
        }
    }

// ==================== HELPER METHODS ====================

    private BigDecimal getMaterialTotalStock(Long materialId) {
        try {
            // Dùng method có sẵn
            return inventoryCardRepo.getTotalStockByMaterialId(materialId);
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    private InventoryCard getRecentInventoryCard(Long materialId) {
        try {
            // Dùng method có sẵn (chỉ lấy lô có tồn kho > 0)
            List<InventoryCard> cards = inventoryCardRepo.findAvailableStockByMaterialId(materialId);
            if (cards.isEmpty()) {
                return null;
            }
            // Sắp xếp theo record_date giảm dần, lấy cái mới nhất
            return cards.stream()
                    .sorted((c1, c2) -> c2.getRecordDate().compareTo(c1.getRecordDate()))
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private BigDecimal getRecentPrice(Long materialId) {
        // TODO: Implement logic lấy giá từ receipt_detail gần nhất
        // Tạm thời trả về null
        return null;
    }
}