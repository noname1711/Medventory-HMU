package com.backend.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateIssueFromReqDTO {
    private Long issueReqId;
    private LocalDate issueDate;      // optional
    private String receiverName;      // optional override
    private String warehouseName;     // optional, default "Kho chính"

    // true = auto FEFO/FIFO, false = manual by lots
    private Boolean autoAllocate;

    // chỉ cần khi autoAllocate = false
    private List<ManualIssueLineDTO> manualLines;
}
