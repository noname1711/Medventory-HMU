package com.backend.controller;

import com.backend.dto.UserDTO;
import com.backend.service.UserService;
import com.backend.dto.*;
import com.backend.service.RbacService;
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
    @Autowired
    private RbacService rbacService;

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
        try {
            boolean success = userService.updateUserStatus(userId, "approved");
            if (success) {
                return ResponseEntity.ok(Map.of("message", "Đã duyệt tài khoản thành công"));
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy người dùng"));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi khi duyệt tài khoản: " + e.getMessage()));
        }
    }

    @PostMapping("/users/{userId}/reject")
    public ResponseEntity<Map<String, String>> rejectUser(@PathVariable Long userId) {
        try {
            boolean success = userService.deleteUser(userId);
            if (success) {
                return ResponseEntity.ok(Map.of("message", "Đã từ chối và xóa tài khoản"));
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy người dùng"));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi khi từ chối tài khoản: " + e.getMessage()));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Long userId) {
        try {
            boolean success = userService.deleteUser(userId);
            if (success) {
                return ResponseEntity.ok().body("Xóa người dùng thành công");
            } else {
                return ResponseEntity.badRequest().body("Không tìm thấy người dùng");
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Lỗi khi xóa người dùng: " + e.getMessage());
        }
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<?> updateUserRole(@PathVariable Long userId, @RequestBody Map<String, Object> request) {
        try {
            String newRole = (String) request.get("role");

            if (newRole == null || newRole.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Role không được để trống");
            }

            // Không cho phép chuyển thành Ban Giám Hiệu qua API
            if (newRole.equals("Ban Giám Hiệu") || newRole.equals("0")) {
                return ResponseEntity.badRequest().body("Không thể cập nhật thành Ban Giám Hiệu!");
            }

            boolean success = userService.updateUserRole(userId, newRole);
            if (success) {
                return ResponseEntity.ok().body("Cập nhật quyền thành công");
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Lỗi khi cập nhật quyền: " + e.getMessage());
        }
    }

    @GetMapping("/departments")
    public ResponseEntity<?> getAllDepartments() {
        try {
            return ResponseEntity.ok(userService.getAllDepartments());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Lỗi khi lấy danh sách khoa: " + e.getMessage());
        }
    }

    @GetMapping("/rbac/roles")
    public ResponseEntity<?> listRoles(@RequestHeader(value = "Authorization", required = false) String auth) {
        try {
            return ResponseEntity.ok(rbacService.listRoles(auth));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rbac/permissions")
    public ResponseEntity<?> listPermissions(@RequestHeader(value = "Authorization", required = false) String auth) {
        try {
            return ResponseEntity.ok(rbacService.listPermissions(auth));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rbac/roles/{roleCode}/permissions")
    public ResponseEntity<?> getRolePermissions(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String roleCode
    ) {
        try {
            return ResponseEntity.ok(rbacService.getRolePermissions(auth, roleCode));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/rbac/roles/{roleCode}/permissions")
    public ResponseEntity<?> replaceRolePermissions(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String roleCode,
            @RequestBody UpdateRolePermissionsRequestDTO req
    ) {
        try {
            List<String> codes = (req == null) ? null : req.getPermissionCodes();
            return ResponseEntity.ok(rbacService.replaceRolePermissions(auth, roleCode, codes));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rbac/roles/{roleCode}/permissions/reset")
    public ResponseEntity<?> resetRolePermissions(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String roleCode
    ) {
        try {
            return ResponseEntity.ok(rbacService.resetRolePermissionsToDefault(auth, roleCode));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

}