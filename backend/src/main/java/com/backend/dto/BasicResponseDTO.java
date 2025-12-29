package com.backend.dto;

import lombok.Data;

import java.util.Map;

@Data
public class BasicResponseDTO {
    private boolean success;
    private String message;
    private Map<String, Object> data;

    public BasicResponseDTO(boolean success, String message, Map<String, Object> data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    public static BasicResponseDTO ok(String message, Map<String, Object> data) {
        return new BasicResponseDTO(true, message, data);
    }

    public static BasicResponseDTO error(String message) {
        return new BasicResponseDTO(false, message, null);
    }
}
