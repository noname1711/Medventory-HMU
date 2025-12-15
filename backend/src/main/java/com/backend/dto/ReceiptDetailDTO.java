package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ReceiptDetailDTO {
    private Long id;
    private Long materialId;
    private String name;
    private String spec;
    private String code;
    private Long unitId;
    private String unitName;

    private BigDecimal price;
    private BigDecimal qtyDoc;
    private BigDecimal qtyActual;
    private BigDecimal total;

    private String lotNumber;
    private LocalDate mfgDate;
    private LocalDate expDate;
}
