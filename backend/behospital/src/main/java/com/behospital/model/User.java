package com.behospital.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullName;

    @Column(unique = true, nullable = false)
    private String email;

    private String password;

    private String department;

    private String role; // "Admin", "Bác sĩ", "Điều dưỡng", v.v.

    private boolean enabled = true; // có thể dùng cho xác thực email sau
}
