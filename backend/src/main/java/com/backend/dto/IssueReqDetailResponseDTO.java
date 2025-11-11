package com.backend.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class IssueReqDetailResponseDTO {
    private boolean success;
    private String message;
    private IssueReqHeaderDTO header;
    private List<IssueReqDetailDTO> details;
    private Map<String, Object> summary;

    public IssueReqDetailResponseDTO(boolean success, String message, IssueReqHeaderDTO header,
                                     List<IssueReqDetailDTO> details, Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.header = header;
        this.details = details;
        this.summary = summary;
    }

    public static IssueReqDetailResponseDTO success(String message, IssueReqHeaderDTO header,
                                                    List<IssueReqDetailDTO> details, Map<String, Object> summary) {
        return new IssueReqDetailResponseDTO(true, message, header, details, summary);
    }

    public static IssueReqDetailResponseDTO error(String message) {
        return new IssueReqDetailResponseDTO(false, message, null, null, null);
    }
}