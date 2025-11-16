package com.backend.dto;

import lombok.Data;

@Data
public class SuppForecastPreviousDTO {
    private Long materialId;
    private String materialName;

    private String specification;
    private Long unitId;

    private String materialCode;
    private String manufacturer;

    private String justification;

    private String proposedCode;
    private String proposedManufacturer;

    private String academicYear;

    private java.math.BigDecimal currentStock;
    private java.math.BigDecimal prevYearQty;
    private java.math.BigDecimal thisYearQty;
}