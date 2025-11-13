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

    @Column(name = "material_name")
    private String name;

    private String spec;

    @Column(name = "unit_id")
    private Integer unitId;

    private String code;

    private String manufacturer;

    private String category;
}
