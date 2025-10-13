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
}