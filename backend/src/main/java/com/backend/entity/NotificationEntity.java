package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "notification_entities")
@Data
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 40)
    private String code; // 'ISSUE_REQ','SUPP_FORECAST'

    @Column(name = "name", nullable = false, length = 120)
    private String name;
}
