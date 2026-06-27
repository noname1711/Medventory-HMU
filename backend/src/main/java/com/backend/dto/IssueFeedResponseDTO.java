package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class IssueFeedResponseDTO {
    private boolean success;
    private String message;
    private List<IssueFeedItemDTO> items;
    private Map<String, Object> summary;

    public IssueFeedResponseDTO(boolean success, String message,
                                List<IssueFeedItemDTO> items,
                                Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.items = items;
        this.summary = summary;
    }

    public static IssueFeedResponseDTO success(String message,
                                               List<IssueFeedItemDTO> items,
                                               Map<String, Object> summary) {
        return new IssueFeedResponseDTO(true, message, items, summary);
    }

    public static IssueFeedResponseDTO error(String message) {
        return new IssueFeedResponseDTO(false, message, null, null);
    }
}
