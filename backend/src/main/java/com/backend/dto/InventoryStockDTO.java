package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class InventoryStockDTO {
    private Long materialId;
    private String materialName;
    private String materialCode;
    private String unitName;
    private BigDecimal totalStock;
    private List<LotStockDTO> lotStocks;
}