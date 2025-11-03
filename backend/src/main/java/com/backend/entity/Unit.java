package com.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "units")
public class Unit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="name", unique=true, nullable=false)
    private String name;

    // getters / setters / constructors
}
