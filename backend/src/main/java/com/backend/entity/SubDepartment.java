package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "sub_departments",
        uniqueConstraints = @UniqueConstraint(columnNames = {"name", "department_id"}))
@Data
public class SubDepartment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;
}