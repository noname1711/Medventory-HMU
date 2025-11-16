package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class SuppForecastDetailDTO {
    private Long materialId;
    private BigDecimal currentStock;
    private BigDecimal prevYearQty;
    private BigDecimal thisYearQty;
    private String proposedCode;
    private String proposedManufacturer;
    private String justification;
}