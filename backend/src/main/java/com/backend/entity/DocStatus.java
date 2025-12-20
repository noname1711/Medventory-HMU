package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "doc_status")
@Data
public class DocStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 30)
    private String code; // 'PENDING','APPROVED','REJECTED'

    @Column(name = "name", nullable = false, length = 80)
    private String name;
}
