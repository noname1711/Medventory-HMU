package com.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateIssueReqDTO {
    private Long subDepartmentId;
    private String note;
    private List<CreateIssueReqDetailDTO> details;
}