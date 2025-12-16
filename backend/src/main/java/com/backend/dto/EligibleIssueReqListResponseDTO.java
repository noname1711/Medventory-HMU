package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class EligibleIssueReqListResponseDTO {
    private boolean success;
    private String message;

    private List<IssueReqHeaderDTO> requests;

    // summary thống kê nhanh cho UI
    private Map<String, Object> summary;

    public EligibleIssueReqListResponseDTO(boolean success, String message,
                                           List<IssueReqHeaderDTO> requests,
                                           Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.requests = requests;
        this.summary = summary;
    }

    public static EligibleIssueReqListResponseDTO success(String message,
                                                          List<IssueReqHeaderDTO> requests,
                                                          Map<String, Object> summary) {
        return new EligibleIssueReqListResponseDTO(true, message, requests, summary);
    }

    public static EligibleIssueReqListResponseDTO error(String message) {
        return new EligibleIssueReqListResponseDTO(false, message, null, null);
    }
}
