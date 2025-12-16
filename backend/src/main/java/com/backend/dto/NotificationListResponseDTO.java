package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class NotificationListResponseDTO {
    private boolean success;
    private String message;

    private List<NotificationDTO> notifications;
    private Map<String, Object> summary;

    public NotificationListResponseDTO(boolean success, String message,
                                       List<NotificationDTO> notifications,
                                       Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.notifications = notifications;
        this.summary = summary;
    }

    public static NotificationListResponseDTO success(String message,
                                                      List<NotificationDTO> notifications,
                                                      Map<String, Object> summary) {
        return new NotificationListResponseDTO(true, message, notifications, summary);
    }

    public static NotificationListResponseDTO error(String message) {
        return new NotificationListResponseDTO(false, message, null, null);
    }
}
