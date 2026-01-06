package com.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class MaterialStockDTO {

    private Long materialId;
    private String materialCode;
    private String materialName;
    private String unitName;
    private BigDecimal closingStock;
}
