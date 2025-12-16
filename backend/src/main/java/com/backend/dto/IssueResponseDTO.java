package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class IssueResponseDTO {
    private boolean success;
    private String message;
    private IssueHeaderDTO header;
    private List<IssueDetailDTO> details;
    private Map<String, Object> summary;

    public IssueResponseDTO(boolean success, String message, IssueHeaderDTO header,
                            List<IssueDetailDTO> details, Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.header = header;
        this.details = details;
        this.summary = summary;
    }

    public static IssueResponseDTO success(String message, IssueHeaderDTO header,
                                           List<IssueDetailDTO> details, Map<String, Object> summary) {
        return new IssueResponseDTO(true, message, header, details, summary);
    }

    public static IssueResponseDTO error(String message) {
        return new IssueResponseDTO(false, message, null, null, null);
    }
}
