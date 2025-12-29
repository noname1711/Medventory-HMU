package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateIssueReqDetailDTO {
    private Long materialId;
    private String materialName;
    private String spec;
    private Long unitId;
    private BigDecimal qtyRequested;
    private String proposedCode;
    private String proposedManufacturer;
    private String category;
}