package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class MaterialFeedResponseDTO {
    private boolean success;
    private String message;

    private List<MaterialFeedItemDTO> items;
    private Long lastId;                 // cursor mới nhất
    private Map<String, Object> summary; // thống kê nhanh

    public MaterialFeedResponseDTO(boolean success, String message,
                                   List<MaterialFeedItemDTO> items,
                                   Long lastId,
                                   Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.items = items;
        this.lastId = lastId;
        this.summary = summary;
    }

    public static MaterialFeedResponseDTO success(String message,
                                                  List<MaterialFeedItemDTO> items,
                                                  Long lastId,
                                                  Map<String, Object> summary) {
        return new MaterialFeedResponseDTO(true, message, items, lastId, summary);
    }

    public static MaterialFeedResponseDTO error(String message) {
        return new MaterialFeedResponseDTO(false, message, null, null, null);
    }
}
