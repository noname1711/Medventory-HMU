package com.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class NotificationDTO {
    private Long id;

    private Integer entityType;
    private Long entityId;
    private Integer eventType;

    private String title;
    private String content;

    private Boolean isRead;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}
