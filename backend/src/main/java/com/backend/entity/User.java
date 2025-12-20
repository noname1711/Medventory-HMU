package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // DB: VARCHAR(150)
    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    // DB: VARCHAR(120)
    @Column(nullable = false, unique = true, length = 120)
    private String email;

    // DB: VARCHAR(200)
    @Column(nullable = false, length = 200)
    private String password;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    // NEW: role_id -> roles
    @ManyToOne(optional = false)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    // DB: job_title
    @Column(name = "job_title", length = 150)
    private String jobTitle;

    // NEW: status_id -> user_status
    @ManyToOne(optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    private UserStatus status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ===== Backward-compatible helpers (không còn roleCheck/status int trong DB) =====

    public boolean isBanGiamHieu() {
        return role != null && "BGH".equalsIgnoreCase(role.getCode());
    }

    public boolean isLanhDao() {
        return role != null && "LANH_DAO".equalsIgnoreCase(role.getCode());
    }

    public boolean isThuKho() {
        return role != null && "THU_KHO".equalsIgnoreCase(role.getCode());
    }

    public boolean isCanBo() {
        return role != null && "CAN_BO".equalsIgnoreCase(role.getCode());
    }

    public boolean isApproved() {
        return status != null && "APPROVED".equalsIgnoreCase(status.getCode());
    }

    public boolean isPending() {
        return status != null && "PENDING".equalsIgnoreCase(status.getCode());
    }

    public String getRoleName() {
        return role != null ? role.getName() : "Không xác định";
    }

    public String getStatusName() {
        return status != null ? status.getName() : "Không xác định";
    }
}
