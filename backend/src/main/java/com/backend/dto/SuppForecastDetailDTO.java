package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class SuppForecastDetailDTO {
    private Long materialId;            // optional: nếu user chọn material từ danh mục
    private BigDecimal currentStock;
    private BigDecimal prevYearQty;
    private BigDecimal thisYearQty;
    private String proposedCode;
    private String proposedManufacturer;
    private String justification;
}
