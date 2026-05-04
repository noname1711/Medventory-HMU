package com.backend.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class IssueFeedItemDTO {
    private Long id;
    private Long issueReqId;
    private LocalDate issueDate;
    private Long createdById;
    private String createdByName;
    private String receiverName;
    private Long departmentId;
    private String departmentName;
    private Long subDepartmentId;
    private String subDepartmentName;
    private BigDecimal totalAmount;
}
