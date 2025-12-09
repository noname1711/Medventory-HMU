package com.backend.dto;

import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class IssueRequestDTO {
    private Long issueReqId;
    private String receiverName;
    private Long departmentId;
    private LocalDate issueDate;
    private List<IssueDetailRequestDTO> details;
}