package com.backend.controller;

import com.backend.dto.AuthResponse;
import com.backend.dto.LoginRequest;
import com.backend.dto.RegisterRequest;
import com.backend.dto.UserDTO;
import com.backend.dto.ForgotPasswordRequest;
import com.backend.dto.ResetPasswordRequest;
import com.backend.entity.Department;
import com.backend.entity.User;
import com.backend.service.DepartmentService;
import com.backend.service.UserService;
import com.backend.service.RbacService;
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

    @Autowired
    private RbacService rbacService;

    // Map để lưu trữ token tạm thời với expiry time
    private Map<String, ResetTokenInfo> resetTokens = new HashMap<>();

    // Inner class để lưu thông tin token
    private static class ResetTokenInfo {
        private String email;
        private long createdAt;

        public ResetTokenInfo(String email, long createdAt) {
            this.email = email;
            this.createdAt = createdAt;
        }

        public String getEmail() { return email; }
        public long getCreatedAt() { return createdAt; }
    }

    @Autowired
    private DepartmentService departmentService;

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

            // Kiểm tra role hợp lệ (không cho phép đăng ký Ban Giám Hiệu)
            if (request.getRole() != null) {
                String role = request.getRole();
                if (role.equals("Ban Giám Hiệu") || role.equals("0")) {
                    return ResponseEntity.badRequest()
                            .body(new AuthResponse(false, "Không thể đăng ký tài khoản Ban Giám Hiệu!"));
                }
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
            User user = userService.authenticateUser(request.getEmail(), request.getPassword());

            if (user != null) {
                UserDTO userDTO = userService.convertToDTO(user);
                String message = user.isBanGiamHieu() ?
                        "Xin chào Ban Giám Hiệu!" : "Đăng nhập thành công!";

                AuthResponse response = new AuthResponse(true, message, "user-token-" + user.getId(), userDTO);
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

            // Check user tồn tại và trạng thái
            User user = userService.findByEmail(email);
            if (user == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Email không tồn tại trong hệ thống!");
                return ResponseEntity.status(404).body(response);
            }

            // Check tài khoản đã được phê duyệt chưa
            if (!user.isApproved()) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Tài khoản chưa được phê duyệt. Vui lòng liên hệ quản trị viên!");
                return ResponseEntity.status(403).body(response);
            }

            // Tạo token reset với expiry time (1 giờ)
            String resetToken = UUID.randomUUID().toString();
            ResetTokenInfo tokenInfo = new ResetTokenInfo(email, System.currentTimeMillis());
            resetTokens.put(resetToken, tokenInfo);

            // Clear token cũ (quá 2 giờ)
            cleanExpiredTokens();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("resetToken", resetToken);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Có lỗi xảy ra: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request) {
        try {
            String token = request.getToken();
            String newPassword = request.getNewPassword();

            // Check token có hợp lệ và chưa hết hạn không
            if (!resetTokens.containsKey(token)) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Token không hợp lệ hoặc đã hết hạn!");
                return ResponseEntity.badRequest().body(response);
            }

            ResetTokenInfo tokenInfo = resetTokens.get(token);

            // Check TOKEN HẾT HẠN (1 giờ)
            long tokenAge = System.currentTimeMillis() - tokenInfo.getCreatedAt();
            if (tokenAge > 3600000) { // 1 giờ = 3600000 milliseconds
                resetTokens.remove(token);
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Token đã hết hạn. Vui lòng yêu cầu mã mới!");
                return ResponseEntity.badRequest().body(response);
            }

            // Lấy email từ token
            String email = tokenInfo.getEmail();

            // Check trạng thái tài khoản trước khi reset
            User user = userService.findByEmail(email);
            if (user != null && !user.isApproved()) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Không thể đặt lại mật khẩu cho tài khoản chưa được phê duyệt!");
                return ResponseEntity.badRequest().body(response);
            }

            // Cập nhật mật khẩu mới
            boolean isUpdated = userService.updatePassword(email, newPassword);

            if (isUpdated) {
                // Xóa token đã sử dụng
                resetTokens.remove(token);

                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "Đặt lại mật khẩu thành công!");
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Không thể cập nhật mật khẩu!");
                return ResponseEntity.badRequest().body(response);
            }

        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Có lỗi xảy ra: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @GetMapping("/departments")
    public ResponseEntity<List<Department>> getAvailableDepartments() {
        try {
            List<Department> departments = userService.getAllDepartments();
            return ResponseEntity.ok(departments);
        } catch (Exception e) {
            return ResponseEntity.ok(Collections.emptyList());
        }
    }

    @GetMapping("/departments/search")
    public ResponseEntity<List<Department>> searchDepartmentsForRegistration(
            @RequestParam(value = "keyword", required = false) String keyword) {
        try {
            List<Department> departments = departmentService.searchDepartments(keyword);
            return ResponseEntity.ok(departments);
        } catch (Exception e) {
            return ResponseEntity.ok(Collections.emptyList());
        }
    }

    @GetMapping("/user-info")
    public ResponseEntity<UserDTO> getUserInfo(@RequestParam String email) {
        try {
            UserDTO userDTO = userService.getUserInfoByEmail(email);
            return ResponseEntity.ok(userDTO);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // Dọn dẹp token hết hạn
    private void cleanExpiredTokens() {
        long currentTime = System.currentTimeMillis();
        resetTokens.entrySet().removeIf(entry -> {
            long tokenAge = currentTime - entry.getValue().getCreatedAt();
            return tokenAge > 7200000; // Dọn token quá 2 giờ
        });
    }

    @GetMapping("/my-permissions")
    public ResponseEntity<?> myPermissions(@RequestHeader("X-User-Id") Long userId) {
        try {
            var perms = rbacService.getEffectivePermissionCodes(userId); // Set<String>
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "userId", userId,
                    "permissionCodes", perms
            ));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("success", false, "error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}