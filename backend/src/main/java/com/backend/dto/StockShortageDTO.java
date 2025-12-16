package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class StockShortageDTO {
    private Long materialId;
    private String code;
    private String name;
    private String unitName;

    private BigDecimal qtyRequested;
    private BigDecimal qtyAvailable;
    private BigDecimal qtyMissing;

    public static StockShortageDTO of(Long materialId, String code, String name, String unitName,
                                      BigDecimal qtyRequested, BigDecimal qtyAvailable, BigDecimal qtyMissing) {
        StockShortageDTO dto = new StockShortageDTO();
        dto.setMaterialId(materialId);
        dto.setCode(code);
        dto.setName(name);
        dto.setUnitName(unitName);
        dto.setQtyRequested(qtyRequested);
        dto.setQtyAvailable(qtyAvailable);
        dto.setQtyMissing(qtyMissing);
        return dto;
    }
}
