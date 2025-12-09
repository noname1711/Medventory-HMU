package com.backend.dto;

import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class ReceiptRequestDTO {
    private String receivedFrom;
    private String reason;
    private LocalDate receiptDate;
    private List<ReceiptDetailRequestDTO> details;
}