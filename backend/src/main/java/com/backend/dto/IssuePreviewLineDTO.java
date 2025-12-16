package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class IssuePreviewLineDTO {
    private Long materialId;
    private String name;
    private String code;
    private String spec;
    private Long unitId;
    private String unitName;

    private BigDecimal qtyRequested;
    private BigDecimal qtyToIssue;

    // FEFO lots
    private List<LotStockDTO> lots;
}
