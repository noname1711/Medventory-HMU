package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ManualIssueLineDTO {
    private Long materialId;
    private BigDecimal qtyIssued; // tổng xuất cho vật tư này
    private List<ManualLotAllocationDTO> lots;
}
