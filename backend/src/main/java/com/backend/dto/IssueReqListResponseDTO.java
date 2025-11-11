package com.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class IssueReqListResponseDTO {
    private boolean success;
    private String message;
    private List<IssueReqHeaderDTO> requests;
    private Long totalCount;
    private Integer pendingCount;
    private Integer approvedCount;
    private Integer rejectedCount;

    public IssueReqListResponseDTO(boolean success, String message, List<IssueReqHeaderDTO> requests,
                                   Long totalCount, Integer pendingCount, Integer approvedCount, Integer rejectedCount) {
        this.success = success;
        this.message = message;
        this.requests = requests;
        this.totalCount = totalCount;
        this.pendingCount = pendingCount;
        this.approvedCount = approvedCount;
        this.rejectedCount = rejectedCount;
    }

    public static IssueReqListResponseDTO success(String message, List<IssueReqHeaderDTO> requests,
                                                  Long totalCount, Integer pendingCount, Integer approvedCount, Integer rejectedCount) {
        return new IssueReqListResponseDTO(true, message, requests, totalCount, pendingCount, approvedCount, rejectedCount);
    }

    public static IssueReqListResponseDTO error(String message) {
        return new IssueReqListResponseDTO(false, message, null, 0L, 0, 0, 0);
    }
}