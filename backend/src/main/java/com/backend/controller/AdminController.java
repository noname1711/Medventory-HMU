package com.backend.controller;

import com.backend.dto.UserDTO;
import com.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:5173")
public class AdminController {

    @Autowired
    private UserService userService;

    @GetMapping("/users/pending")
    public ResponseEntity<List<UserDTO>> getPendingUsers() {
        List<UserDTO> pendingUsers = userService.getPendingUsers();
        return ResponseEntity.ok(pendingUsers);
    }

    @GetMapping("/users/all")
    public ResponseEntity<List<UserDTO>> getAllUsers() {
        List<UserDTO> allUsers = userService.getAllUsers();
        return ResponseEntity.ok(allUsers);
    }

    @PostMapping("/users/{userId}/approve")
    public ResponseEntity<Map<String, String>> approveUser(@PathVariable Long userId) {
        boolean success = userService.updateUserStatus(userId, "approved");
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Đã duyệt tài khoản thành công"));
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy người dùng"));
        }
    }

    @PostMapping("/users/{userId}/reject")
    public ResponseEntity<Map<String, String>> rejectUser(@PathVariable Long userId) {
        boolean success = userService.updateUserStatus(userId, "rejected");
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Đã từ chối tài khoản"));
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy người dùng"));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Long userId) {
        try {
            userService.deleteUser(userId);
            return ResponseEntity.ok().body("Xóa người dùng thành công");
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Lỗi khi xóa người dùng: " + e.getMessage());
        }
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<?> updateUserRole(@PathVariable Long userId, @RequestBody Map<String, Object> request) {
        try {
            String newRole = (String) request.get("role");
            Integer newPriority = (Integer) request.get("priority");

            if (newRole == null || newRole.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Role không được để trống");
            }

            boolean success = userService.updateUserRoleAndPriority(userId, newRole, newPriority);
            if (success) {
                return ResponseEntity.ok().body("Cập nhật quyền và độ ưu tiên thành công");
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Lỗi khi cập nhật quyền: " + e.getMessage());
        }
    }
}