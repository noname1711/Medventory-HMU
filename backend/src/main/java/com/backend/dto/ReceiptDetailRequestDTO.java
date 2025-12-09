package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ReceiptDetailRequestDTO {
    private Long materialId;
    private String materialName;
    private String spec;
    private String code;
    private Long unitId;
    private BigDecimal price;
    private BigDecimal qtyDoc;
    private BigDecimal qtyActual;
    private String lotNumber;
    private LocalDate mfgDate;
    private LocalDate expDate;
    private Character category;
}