package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(
        name = "materials",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"code"}),
                @UniqueConstraint(columnNames = {"name", "spec", "manufacturer"})
        }
)
@Data
public class Material {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 255)
    private String spec;

    @ManyToOne(optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private Unit unit;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    @Column(nullable = false, length = 255)
    private String manufacturer;

    // DB: CHAR(1) CHECK IN ('A','B','C','D')
    @Column(nullable = false, length = 1)
    private String category; // "A","B","C","D"

    public Long getUnitId() {
        return (unit != null) ? unit.getId() : null;
    }

    public String getCategorySafe() {
        return (category == null || category.isBlank()) ? "D" : category;
    }
}
