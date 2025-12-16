package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class LotStockDTO {
    private String lotNumber;
    private LocalDate mfgDate;
    private LocalDate expDate;
    private BigDecimal availableStock;

    // khi preview/auto allocate sẽ điền qtyOutSuggested
    private BigDecimal qtyOut;
}
