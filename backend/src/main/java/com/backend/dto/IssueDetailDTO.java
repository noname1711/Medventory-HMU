package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class IssueDetailDTO {
    private Long id;
    private Long materialId;

    private String name;
    private String spec;
    private String code;

    private Long unitId;
    private String unitName;

    private BigDecimal unitPrice;
    private BigDecimal qtyRequested;
    private BigDecimal qtyIssued;
    private BigDecimal total;
}
