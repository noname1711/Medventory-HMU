package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class LotStockDTO {
    private Long inventoryCardId;
    private String lotNumber;
    private LocalDate expDate;
    private BigDecimal availableStock;
    private String warehouseName;
}