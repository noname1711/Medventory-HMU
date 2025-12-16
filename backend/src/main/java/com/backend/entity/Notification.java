package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Người nhận
    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    // 0 = issue_req, 1 = supp_forecast
    @Column(name = "entity_type", nullable = false)
    private Integer entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    // 0 pending, 1 approved, 2 rejected, 3 scheduled
    @Column(name = "event_type", nullable = false)
    private Integer eventType;

    @Column(name = "title")
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "is_read", nullable = false)
    private Boolean isRead = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "read_at")
    private LocalDateTime readAt;
}
