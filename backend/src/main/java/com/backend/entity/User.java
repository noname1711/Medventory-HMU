package com.backend.entity;

import lombok.Data;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    private String department;

    @Column(nullable = false)
    private String role = "canbo"; // admin, lanhdao, thukho, canbo

    @Column(nullable = false)
    private String status = "pending"; // pending, approved, rejected

    @Column(nullable = false)
    private Integer priority = 3; // 0: admin, 1: lanhdao, 2: thukho, 3: canbo

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        setPriorityBasedOnRole();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        setPriorityBasedOnRole();
    }

    private void setPriorityBasedOnRole() {
        switch (this.role) {
            case "admin" -> this.priority = 0;
            case "lanhdao" -> this.priority = 1;
            case "thukho" -> this.priority = 2;
            case "canbo" -> this.priority = 3;
            default -> this.priority = 3;
        }
    }
}