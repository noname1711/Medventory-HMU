package com.backend.dto;

import lombok.Data;

@Data
public class AuthResponse {
    private boolean success;
    private String message;
    private String token;
    private UserDTO user;

    public AuthResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }

    public AuthResponse(boolean success, String message, String token, UserDTO user) {
        this.success = success;
        this.message = message;
        this.token = token;
        this.user = user;
    }
}