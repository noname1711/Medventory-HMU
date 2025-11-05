package com.backend.controller;

import com.backend.dto.AuthResponse;
import com.backend.dto.LoginRequest;
import com.backend.dto.RegisterRequest;
import com.backend.dto.UserDTO;
import com.backend.dto.ForgotPasswordRequest;
import com.backend.dto.ResetPasswordRequest;
import com.backend.entity.Department;
import com.backend.entity.User;
import com.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    @Autowired
    private UserService userService;

    // Map để lưu trữ token tạm thời
    private Map<String, String> resetTokens = new HashMap<>();

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
                    .body(new AuthResponse(false, "Lỗi đăng ký: " + e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        try {
            // Xử lý đăng nhập admin đặc biệt
            if ("admin".equals(request.getEmail()) && "12345".equals(request.getPassword())) {
                UserDTO adminUser = new UserDTO();
                adminUser.setFullName("Admin");
                adminUser.setRole("admin");
                adminUser.setDepartment("Quản trị hệ thống");

                AuthResponse response = new AuthResponse(true, "Xin chào Admin", "admin-token", adminUser);
                return ResponseEntity.ok(response);
            }

            User user = userService.authenticateUser(request.getEmail(), request.getPassword());

            if (user != null) {
                UserDTO userDTO = userService.convertToDTO(user);
                AuthResponse response = new AuthResponse(true, "Đăng nhập thành công!", "user-token-" + user.getId(), userDTO);
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest()
                        .body(new AuthResponse(false, "Email, mật khẩu không đúng hoặc tài khoản chưa được phê duyệt!"));
            }

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new AuthResponse(false, "Lỗi đăng nhập: " + e.getMessage()));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        try {
            String email = request.getEmail();

            // Kiểm tra email có tồn tại không
            if (!userService.emailExists(email)) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                return ResponseEntity.status(404).body(response); // 404 Not Found - Không tìm thấy email
            }

            // Tạo token reset
            String resetToken = UUID.randomUUID().toString();
            resetTokens.put(resetToken, email);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("resetToken", resetToken);

            return ResponseEntity.ok(response);  // 200 OK - Yêu cầu thành công

        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Có lỗi xảy ra: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response); // 500 Internal Server Error - Lỗi server
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request) {
        try {
            String token = request.getToken();
            String newPassword = request.getNewPassword();

            // Kiểm tra token có hợp lệ không
            if (!resetTokens.containsKey(token)) {
                Map<String, String> response = new HashMap<>();
                response.put("success", "false");
                return ResponseEntity.badRequest().body(response); // 400 Bad Request - Client gửi token sai
            }

            // Lấy email từ token
            String email = resetTokens.get(token);

            // Cập nhật mật khẩu mới
            boolean isUpdated = userService.updatePassword(email, newPassword);

            if (isUpdated) {
                // Xóa token đã sử dụng
                resetTokens.remove(token);

                Map<String, String> response = new HashMap<>();
                response.put("success", "true");
                return ResponseEntity.ok(response);  // 200 OK - Reset mật khẩu thành công
            } else {
                Map<String, String> response = new HashMap<>();
                response.put("success", "false");
                return ResponseEntity.badRequest().body(response); // 400 Bad Request - Lỗi cập nhật
            }

        } catch (Exception e) {
            Map<String, String> response = new HashMap<>();
            response.put("success", "false");
            response.put("message", "Có lỗi xảy ra: " + e.getMessage());
            return ResponseEntity.badRequest().body(response); // 400 Bad Request - Lỗi xử lý
        }
    }

    @GetMapping("/departments")
    public ResponseEntity<List<Department>> getAvailableDepartments() {
        try {
            List<Department> departments = userService.getAllDepartments();
            return ResponseEntity.ok(departments);
        } catch (Exception e) {
            // Trả về list rỗng thay vì lỗi
            return ResponseEntity.ok(Collections.emptyList());
        }
    }
}