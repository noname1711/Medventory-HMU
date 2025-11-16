package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "materials")
@Data
public class Material {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String spec;

    @ManyToOne
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(unique = true, nullable = false, length = 100)
    private String code;

    @Column(nullable = false)
    private String manufacturer;

    @Column(nullable = false)
    private Character category; // A, B, C, D

    public Long getUnitId() {
        return (unit != null) ? unit.getId() : null;
    }
}