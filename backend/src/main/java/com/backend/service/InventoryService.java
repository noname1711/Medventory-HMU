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
@Transactional(readOnly = true)
public class InventoryService {

    private final InventoryCardRepository inventoryCardRepo;
    private final MaterialRepository materialRepo;

    // Lấy tồn kho theo vật tư
    public InventoryStockDTO getStockByMaterial(Long materialId) {
        Material material = materialRepo.findById(materialId)
                .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại"));

        List<InventoryCard> cards = inventoryCardRepo.findByMaterialId(materialId);

        InventoryStockDTO dto = new InventoryStockDTO();
        dto.setMaterialId(materialId);
        dto.setMaterialName(material.getName());
        dto.setMaterialCode(material.getCode());
        dto.setUnitName(material.getUnit() != null ? material.getUnit().getName() : "");

        BigDecimal totalStock = cards.stream()
                .map(InventoryCard::getClosingStock)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setTotalStock(totalStock);

        List<LotStockDTO> lotStocks = cards.stream()
                .filter(card -> card.getClosingStock() != null && card.getClosingStock().compareTo(BigDecimal.ZERO) > 0)
                .map(this::convertToLotStockDTO)
                .collect(Collectors.toList());
        dto.setLotStocks(lotStocks);

        return dto;
    }

    // Lấy tất cả tồn kho
    public List<InventoryStockDTO> getAllStock() {
        List<Material> materials = materialRepo.findAll();

        return materials.stream()
                .map(material -> {
                    InventoryStockDTO dto = new InventoryStockDTO();
                    dto.setMaterialId(material.getId());
                    dto.setMaterialName(material.getName());
                    dto.setMaterialCode(material.getCode());
                    dto.setUnitName(material.getUnit() != null ? material.getUnit().getName() : "");

                    BigDecimal totalStock = inventoryCardRepo.getTotalStockByMaterialId(material.getId());
                    dto.setTotalStock(totalStock != null ? totalStock : BigDecimal.ZERO);

                    return dto;
                })
                .filter(dto -> dto.getTotalStock().compareTo(BigDecimal.ZERO) > 0)
                .collect(Collectors.toList());
    }

    // Kiểm tra vật tư sắp hết hạn
    public List<Map<String, Object>> getExpiringSoon(int days) {
        LocalDate checkDate = LocalDate.now().plusDays(days);

        return inventoryCardRepo.findExpiringSoon(LocalDate.now(), checkDate).stream()
                .filter(card -> card.getClosingStock() != null && card.getClosingStock().compareTo(BigDecimal.ZERO) > 0)
                .map(card -> {
                    Map<String, Object> data = new HashMap<>();
                    data.put("materialId", card.getMaterial().getId());
                    data.put("materialName", card.getMaterial().getName());
                    data.put("lotNumber", card.getLotNumber());
                    data.put("expDate", card.getExpDate());
                    data.put("daysLeft", card.getExpDate().toEpochDay() - LocalDate.now().toEpochDay());
                    data.put("stock", card.getClosingStock());
                    data.put("unit", card.getUnit().getName());
                    return data;
                })
                .sorted(Comparator.comparing(m -> (Long) m.get("daysLeft")))
                .collect(Collectors.toList());
    }

    // Kiểm tra tồn kho cho phiếu xin lĩnh
    public Map<String, Object> checkStockForRequest(Long issueReqId) {
        IssueReqHeader request = new IssueReqHeader(); // TODO: Inject repository
        // Logic kiểm tra tồn kho
        Map<String, Object> result = new HashMap<>();
        result.put("canIssue", true);
        result.put("message", "Đủ tồn kho");
        return result;
    }

    private LotStockDTO convertToLotStockDTO(InventoryCard card) {
        LotStockDTO dto = new LotStockDTO();
        dto.setInventoryCardId(card.getId());
        dto.setLotNumber(card.getLotNumber());
        dto.setExpDate(card.getExpDate());
        dto.setAvailableStock(card.getClosingStock());
        dto.setWarehouseName(card.getWarehouseName());
        return dto;
    }
}