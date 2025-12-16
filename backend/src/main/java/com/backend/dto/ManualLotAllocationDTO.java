package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ManualLotAllocationDTO {
    private String lotNumber;
    private BigDecimal qtyOut;
}
