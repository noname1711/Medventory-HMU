package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Table(name = "users")
@Data
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 100)
    private String password;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "role_check", nullable = false)
    private Integer roleCheck = 3; // 0 = Ban Giám Hiệu, 1 = Lãnh đạo, 2 = Thủ kho, 3 = Cán bộ

    @Column(name = "role", length = 100)
    private String role; // Tên chức vụ thực tế

    @Column(name = "status", nullable = false)
    private Integer status = 0; // 0 = pending, 1 = approved

    // Helper methods
    public boolean isBanGiamHieu() {
        return roleCheck != null && roleCheck == 0;
    }

    public boolean isLanhDao() {
        return roleCheck != null && roleCheck == 1;
    }

    public boolean isThuKho() {
        return roleCheck != null && roleCheck == 2;
    }

    public boolean isCanBo() {
        return roleCheck != null && roleCheck == 3;
    }

    public boolean isApproved() {
        return status != null && status == 1;
    }

    public boolean isPending() {
        return status != null && status == 0;
    }

    public String getRoleName() {
        if (roleCheck == null) return "Không xác định";
        switch (roleCheck) {
            case 0: return "Ban Giám Hiệu";
            case 1: return "Lãnh đạo";
            case 2: return "Thủ kho";
            case 3: return "Cán bộ";
            default: return "Không xác định";
        }
    }

    public String getStatusName() {
        if (status == null) return "Không xác định";
        switch (status) {
            case 0: return "Chờ duyệt";
            case 1: return "Đã duyệt";
            default: return "Không xác định";
        }
    }
}