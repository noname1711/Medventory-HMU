package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class EligibleIssueReqResponseDTO {
    private boolean success;
    private String message;

    // Phiếu đủ hàng để xuất (đã xét theo ưu tiên requestedAt tăng dần)
    private List<IssueReqHeaderDTO> eligibleRequests;

    // Phiếu bị loại + lý do
    private List<IneligibleIssueReqDTO> ineligibleRequests;

    private Map<String, Object> summary;

    public EligibleIssueReqResponseDTO(boolean success, String message,
                                       List<IssueReqHeaderDTO> eligibleRequests,
                                       List<IneligibleIssueReqDTO> ineligibleRequests,
                                       Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.eligibleRequests = eligibleRequests;
        this.ineligibleRequests = ineligibleRequests;
        this.summary = summary;
    }

    public static EligibleIssueReqResponseDTO success(String message,
                                                      List<IssueReqHeaderDTO> eligibleRequests,
                                                      List<IneligibleIssueReqDTO> ineligibleRequests,
                                                      Map<String, Object> summary) {
        return new EligibleIssueReqResponseDTO(true, message, eligibleRequests, ineligibleRequests, summary);
    }

    public static EligibleIssueReqResponseDTO error(String message) {
        return new EligibleIssueReqResponseDTO(false, message, null, null, null);
    }
}
