package com.backend.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class UserDTO {
    private Long id;
    private String fullName;
    private String email;
    private LocalDate dateOfBirth;
    private String department;
    private String role;
    private String status;
}