package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "units")
@Data
public class Unit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // DB: VARCHAR(50)
    @Column(unique = true, nullable = false, length = 50)
    private String name;
}
