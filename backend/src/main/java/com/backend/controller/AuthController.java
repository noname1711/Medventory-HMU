package com.backend.controller;

import com.backend.dto.AuthResponse;
import com.backend.dto.LoginRequest;
import com.backend.dto.RegisterRequest;
import com.backend.dto.UserDTO;
import com.backend.entity.User;
import com.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        try {
            // Kiểm tra email đã tồn tại
            if (userService.emailExists(request.getEmail())) {
                return ResponseEntity.badRequest()
                        .body(new AuthResponse(false, "Email đã tồn tại trong hệ thống!"));
            }

            // Kiểm tra mật khẩu xác nhận
            if (!request.getPassword().equals(request.getConfirmPassword())) {
                return ResponseEntity.badRequest()
                        .body(new AuthResponse(false, "Mật khẩu xác nhận không khớp!"));
            }

            // Kiểm tra email hợp lệ (trừ admin)
            if (!request.getEmail().endsWith("@gmail.com") && !"admin".equals(request.getEmail())) {
                return ResponseEntity.badRequest()
                        .body(new AuthResponse(false, "Vui lòng dùng email @gmail.com để đăng ký!"));
            }

            User user = userService.registerUser(request);
            return ResponseEntity.ok()
                    .body(new AuthResponse(true, "Đăng ký thành công! Vui lòng chờ admin phê duyệt."));

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new AuthResponse(false, "Lỗi hệ thống: " + e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        try {
            // Xử lý đăng nhập admin đặc biệt
            if ("admin".equals(request.getEmail()) && "12345".equals(request.getPassword())) {
                // Tạo UserDTO cho admin
                UserDTO adminUser = new UserDTO();
                adminUser.setFullName("Admin");
                adminUser.setRole("admin");
                adminUser.setDepartment("Quản trị hệ thống");

                AuthResponse response = new AuthResponse(true, "Xin chào Admin 👑", "admin-token", adminUser);
                return ResponseEntity.ok(response);
            }

            User user = userService.authenticateUser(request.getEmail(), request.getPassword());

            if (user != null) {
                // Convert User entity to UserDTO
                UserDTO userDTO = convertToDTO(user);
                AuthResponse response = new AuthResponse(true, "Đăng nhập thành công!", "user-token-" + user.getId(), userDTO);
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest()
                        .body(new AuthResponse(false, "Email, mật khẩu không đúng hoặc tài khoản chưa được phê duyệt!"));
            }

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new AuthResponse(false, "Lỗi hệ thống: " + e.getMessage()));
        }
    }

    private UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setFullName(user.getFullName());
        dto.setEmail(user.getEmail());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setDepartment(user.getDepartment());
        dto.setRole(user.getRole());
        dto.setStatus(user.getStatus());
        dto.setPriority(user.getPriority());
        return dto;
    }
}