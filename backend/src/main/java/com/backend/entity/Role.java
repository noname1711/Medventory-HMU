package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "roles")
@Data
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 30)
    private String code; // 'BGH','LANH_DAO','THU_KHO','CAN_BO'

    @Column(name = "name", nullable = false, length = 80)
    private String name;
}
