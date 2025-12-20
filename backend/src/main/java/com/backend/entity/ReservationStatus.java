package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "reservation_status")
@Data
public class ReservationStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 30)
    private String code; // 'ACTIVE','CANCELLED','CONSUMED'

    @Column(name = "name", nullable = false, length = 120)
    private String name;
}
