package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "notification_events")
@Data
public class NotificationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 40)
    private String code; // 'PENDING','APPROVED','REJECTED','SCHEDULED'

    @Column(name = "name", nullable = false, length = 120)
    private String name;
}
