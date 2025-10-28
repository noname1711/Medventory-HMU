package com.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "materials")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Material {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String materialName;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit; // Liên kết với bảng Unit
}
