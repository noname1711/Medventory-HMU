package com.backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ReceiptFeedItemDTO {
    private Long id;
    private LocalDate receiptDate;
    private String receivedFrom;
    private BigDecimal totalAmount;
}
