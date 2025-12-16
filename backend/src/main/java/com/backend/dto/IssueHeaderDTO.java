package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class IssueHeaderDTO {
    private Long id;

    private Long createdById;
    private String createdByName;

    private String receiverName;

    private Long departmentId;
    private String departmentName;

    private LocalDate issueDate;
    private BigDecimal totalAmount;

    private List<IssueDetailDTO> details;
}
