package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class IssuePreviewResponseDTO {
    private boolean success;
    private String message;

    private IssueReqHeaderDTO sourceRequest;
    private List<IssuePreviewLineDTO> lines;
    private Map<String, Object> summary;

    public IssuePreviewResponseDTO(boolean success, String message,
                                   IssueReqHeaderDTO sourceRequest,
                                   List<IssuePreviewLineDTO> lines,
                                   Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.sourceRequest = sourceRequest;
        this.lines = lines;
        this.summary = summary;
    }

    public static IssuePreviewResponseDTO success(String message, IssueReqHeaderDTO sourceRequest,
                                                  List<IssuePreviewLineDTO> lines, Map<String, Object> summary) {
        return new IssuePreviewResponseDTO(true, message, sourceRequest, lines, summary);
    }

    public static IssuePreviewResponseDTO error(String message) {
        return new IssuePreviewResponseDTO(false, message, null, null, null);
    }
}
