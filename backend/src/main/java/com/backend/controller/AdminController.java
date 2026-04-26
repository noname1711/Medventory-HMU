package com.backend.controller;

import com.backend.dto.UpdateRolePermissionsRequestDTO;
import com.backend.dto.UserDTO;
import com.backend.service.RbacService;
import com.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    public ResponseEntity<?> getPendingUsers(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestHeader(value = "X-User-Id", required = false) Long actorId
    ) {
        try {
            requireUsersManage(auth, actorId);
            List<UserDTO> pendingUsers = userService.getPendingUsers();
            return ResponseEntity.ok(pendingUsers);
        } catch (SecurityException se) {
            return forbidden(se);
        }
    }

    @GetMapping("/users/all")
    public ResponseEntity<?> getAllUsers(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestHeader(value = "X-User-Id", required = false) Long actorId
    ) {
        try {
            requireUsersManage(auth, actorId);
            List<UserDTO> allUsers = userService.getAllUsers();
            return ResponseEntity.ok(allUsers);
        } catch (SecurityException se) {
            return forbidden(se);
        }
    }

    @PostMapping("/users/{userId}/approve")
    public ResponseEntity<Map<String, String>> approveUser(
            @PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestHeader(value = "X-User-Id", required = false) Long actorId
    ) {
        try {
            requireUsersManage(auth, actorId);
            boolean success = userService.updateUserStatus(userId, "approved");
            if (success) {
                return ResponseEntity.ok(Map.of("message", "Da duyet tai khoan thanh cong"));
            }
            return ResponseEntity.badRequest().body(Map.of("error", "Khong tim thay nguoi dung"));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Loi khi duyet tai khoan: " + e.getMessage()));
        }
    }

    @PostMapping("/users/{userId}/reject")
    public ResponseEntity<Map<String, String>> rejectUser(
            @PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestHeader(value = "X-User-Id", required = false) Long actorId
    ) {
        try {
            requireUsersManage(auth, actorId);
            boolean success = userService.deleteUser(userId);
            if (success) {
                return ResponseEntity.ok(Map.of("message", "Da tu choi va xoa tai khoan"));
            }
            return ResponseEntity.badRequest().body(Map.of("error", "Khong tim thay nguoi dung"));
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Loi khi tu choi tai khoan: " + e.getMessage()));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(
            @PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestHeader(value = "X-User-Id", required = false) Long actorId
    ) {
        try {
            requireUsersManage(auth, actorId);
            boolean success = userService.deleteUser(userId);
            if (success) {
                return ResponseEntity.ok().body("Xoa nguoi dung thanh cong");
            }
            return ResponseEntity.badRequest().body("Khong tim thay nguoi dung");
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Loi khi xoa nguoi dung: " + e.getMessage());
        }
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<?> updateUserRole(
            @PathVariable Long userId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestHeader(value = "X-User-Id", required = false) Long actorId
    ) {
        try {
            requireUsersManage(auth, actorId);
            String newRole = request == null ? null : (String) request.get("role");

            if (newRole == null || newRole.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Role khong duoc de trong");
            }

            if (newRole.equalsIgnoreCase("BGH")
                    || newRole.equals("Ban Giam Hieu")
                    || newRole.equals("Ban Giám Hiệu")
                    || newRole.equals("0")) {
                return ResponseEntity.badRequest().body("Khong the cap nhat thanh Ban Giam Hieu");
            }

            boolean success = userService.updateUserRole(userId, newRole);
            if (success) {
                return ResponseEntity.ok().body("Cap nhat quyen thanh cong");
            }
            return ResponseEntity.notFound().build();
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Loi khi cap nhat quyen: " + e.getMessage());
        }
    }

    @GetMapping("/departments")
    public ResponseEntity<?> getAllDepartments() {
        try {
            return ResponseEntity.ok(userService.getAllDepartments());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Loi khi lay danh sach khoa: " + e.getMessage());
        }
    }

    @GetMapping("/rbac/roles")
    public ResponseEntity<?> listRoles(@RequestHeader(value = "Authorization", required = false) String auth) {
        try {
            return ResponseEntity.ok(rbacService.listRoles(auth));
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rbac/permissions")
    public ResponseEntity<?> listPermissions(@RequestHeader(value = "Authorization", required = false) String auth) {
        try {
            return ResponseEntity.ok(rbacService.listPermissions(auth));
        } catch (SecurityException se) {
            return forbidden(se);
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
            return forbidden(se);
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
            List<String> codes = req == null ? null : req.getPermissionCodes();
            return ResponseEntity.ok(rbacService.replaceRolePermissions(auth, roleCode, codes));
        } catch (SecurityException se) {
            return forbidden(se);
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
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rbac/users/{userId}/permissions")
    public ResponseEntity<?> getUserPermissions(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long userId
    ) {
        try {
            return ResponseEntity.ok(rbacService.getUserPermissions(auth, userId));
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/rbac/users/{userId}/permissions")
    public ResponseEntity<?> replaceUserPermissions(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long userId,
            @RequestBody UpdateRolePermissionsRequestDTO req
    ) {
        try {
            List<String> codes = req == null ? null : req.getPermissionCodes();
            return ResponseEntity.ok(rbacService.replaceUserPermissions(auth, userId, codes));
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rbac/users/{userId}/permissions/grant")
    public ResponseEntity<?> grantUserPermission(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long userId,
            @RequestBody Map<String, Object> req
    ) {
        try {
            String code = req == null ? null : (String) req.get("permissionCode");
            return ResponseEntity.ok(rbacService.grantUserPermission(auth, userId, code));
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rbac/users/{userId}/permissions/remove")
    public ResponseEntity<?> removeUserPermission(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long userId,
            @RequestBody Map<String, Object> req
    ) {
        try {
            String code = req == null ? null : (String) req.get("permissionCode");
            return ResponseEntity.ok(rbacService.removeUserPermission(auth, userId, code));
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/rbac/users/{userId}/permissions")
    public ResponseEntity<?> clearUserPermissions(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long userId
    ) {
        try {
            return ResponseEntity.ok(rbacService.clearUserPermissions(auth, userId));
        } catch (SecurityException se) {
            return forbidden(se);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private void requireUsersManage(String auth, Long actorId) {
        String message = "Ban khong co quyen " + RbacService.PERM_USERS_MANAGE;
        if (actorId != null) {
            rbacService.requirePermission(actorId, RbacService.PERM_USERS_MANAGE, message);
            return;
        }
        rbacService.requirePermissionFromAuth(auth, RbacService.PERM_USERS_MANAGE, message);
    }

    private ResponseEntity<Map<String, String>> forbidden(SecurityException se) {
        return ResponseEntity.status(403).body(Map.of("error", se.getMessage()));
    }
}
