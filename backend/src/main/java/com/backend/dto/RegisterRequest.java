package com.backend.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class RegisterRequest {
    private String fullName;
    private String email;
    private String password;
    private String confirmPassword;
    private LocalDate dateOfBirth;
    private String department;
    private String role; // "Lãnh đạo", "Thủ kho", "Cán bộ"
}