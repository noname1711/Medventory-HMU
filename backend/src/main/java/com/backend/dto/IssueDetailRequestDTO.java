package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class IssueDetailRequestDTO {
    private Long materialId;
    private Long inventoryCardId;
    private BigDecimal qtyIssued;
}