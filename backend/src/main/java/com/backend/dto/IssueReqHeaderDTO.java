package com.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class IssueReqHeaderDTO {
    private Long id;
    private Long createdById;
    private String createdByName;
    private String createdByEmail;
    private Long subDepartmentId;
    private String subDepartmentName;
    private Long departmentId;
    private String departmentName;
    private LocalDateTime requestedAt;
    private Integer status;
    private String statusName;
    private String statusBadge;
    private Long approvalById;
    private String approvalByName;
    private LocalDateTime approvalAt;
    private String approvalNote;
    private String note;
    private List<IssueReqDetailDTO> details;

    // Formatting helpers
    public String getFormattedRequestedAt() {
        return requestedAt != null ? requestedAt.toString() : "";
    }

    public String getFormattedApprovalAt() {
        return approvalAt != null ? approvalAt.toString() : "";
    }
}