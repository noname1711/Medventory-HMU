package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class ReceiptHeaderDTO {
    private Long id;
    private Long createdById;
    private String createdByName;

    private String receivedFrom;
    private String reason;
    private LocalDate receiptDate;
    private BigDecimal totalAmount;

    private List<ReceiptDetailDTO> details;
}
