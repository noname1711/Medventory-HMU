package com.backend.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ReceiptFeedResponseDTO {
    private boolean success;
    private String message;
    private List<ReceiptFeedItemDTO> items;
    private Map<String, Object> summary;

    public ReceiptFeedResponseDTO(boolean success, String message,
                                  List<ReceiptFeedItemDTO> items,
                                  Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.items = items;
        this.summary = summary;
    }

    public static ReceiptFeedResponseDTO success(String message,
                                                 List<ReceiptFeedItemDTO> items,
                                                 Map<String, Object> summary) {
        return new ReceiptFeedResponseDTO(true, message, items, summary);
    }

    public static ReceiptFeedResponseDTO error(String message) {
        return new ReceiptFeedResponseDTO(false, message, null, null);
    }
}
