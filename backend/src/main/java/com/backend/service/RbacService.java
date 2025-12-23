package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RbacService {

    // ===== Permission codes  =====
    public static final String PERM_ISSUE_REQ_CREATE       = "ISSUE_REQ.CREATE";
    public static final String PERM_ISSUE_REQ_APPROVE      = "ISSUE_REQ.APPROVE";
    public static final String PERM_RECEIPT_CREATE         = "RECEIPT.CREATE";
    public static final String PERM_ISSUE_CREATE           = "ISSUE.CREATE";
    public static final String PERM_SUPP_FORECAST_CREATE   = "SUPP_FORECAST.CREATE";
    public static final String PERM_SUPP_FORECAST_APPROVE  = "SUPP_FORECAST.APPROVE";
    public static final String PERM_MATERIAL_MANAGE        = "MATERIAL.MANAGE";
    public static final String PERM_NOTIF_MANAGE           = "NOTIF.MANAGE";
    public static final String PERM_USERS_MANAGE           = "USERS.MANAGE";
    public static final String PERM_PERMISSIONS_MANAGE     = "PERMISSIONS.MANAGE";

    // giữ tên cũ để không phải sửa nhiều chỗ
    private static final String PERM_MANAGE = PERM_PERMISSIONS_MANAGE;

    private static final String TOKEN_PREFIX = "user-token-";

    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private RolePermissionRepository rolePermissionRepository;
    @Autowired private UserPermissionRepository userPermissionRepository;

    // ===== Default mapping đúng theo SQL seed bạn gửi =====
    private static final Map<String, List<String>> DEFAULT_ROLE_PERMS = Map.of(
            "BGH",      List.of("SUPP_FORECAST.APPROVE", "NOTIF.MANAGE", "USERS.MANAGE", "PERMISSIONS.MANAGE"),
            "LANH_DAO", List.of("ISSUE_REQ.APPROVE", "NOTIF.MANAGE"),
            "THU_KHO",  List.of("SUPP_FORECAST.CREATE", "RECEIPT.CREATE", "ISSUE.CREATE", "MATERIAL.MANAGE", "NOTIF.MANAGE"),
            "CAN_BO",   List.of("ISSUE_REQ.CREATE")
    );

    // ================= Public helpers for other services =================

    public User requireApprovedUser(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new SecurityException("User không tồn tại"));

        // giữ tương thích login hiện tại của bạn: BGH vào luôn; user khác phải approved
        if (!u.isBanGiamHieu() && !u.isApproved()) {
            throw new SecurityException("Tài khoản chưa được kích hoạt");
        }
        return u;
    }

    public Set<String> getEffectivePermissionCodes(Long userId) {
        User u = requireApprovedUser(userId);
        return getEffectivePermissionCodes(u);
    }

    // đổi từ private -> public để các service gọi
    public Set<String> getEffectivePermissionCodes(User user) {
        Set<String> perms = new HashSet<>();

        if (user.getRole() != null) {
            perms.addAll(rolePermissionRepository.findPermissionCodesByRoleId(user.getRole().getId()));
        }

        // override theo user_permissions
        perms.addAll(userPermissionRepository.findGrantedPermissionCodes(user.getId()));
        perms.removeAll(userPermissionRepository.findRevokedPermissionCodes(user.getId()));
        return perms;
    }

    public boolean hasPermission(User user, String permCode) {
        if (user == null) return false;
        return getEffectivePermissionCodes(user).contains(permCode);
    }

    public boolean hasAnyPermission(User user, String... permCodes) {
        if (user == null || permCodes == null || permCodes.length == 0) return false;
        Set<String> eff = getEffectivePermissionCodes(user);
        for (String p : permCodes) {
            if (p != null && eff.contains(p)) return true;
        }
        return false;
    }

    public void requirePermission(User user, String permCode, String errorMessage) {
        if (!hasPermission(user, permCode)) {
            throw new SecurityException(errorMessage != null ? errorMessage : ("Bạn không có quyền " + permCode));
        }
    }

    public void requirePermission(Long userId, String permCode, String errorMessage) {
        User u = requireApprovedUser(userId);
        requirePermission(u, permCode, errorMessage);
    }

    public void requireAnyPermission(Long userId, String errorMessage, String... permCodes) {
        User u = requireApprovedUser(userId);
        if (!hasAnyPermission(u, permCodes)) {
            throw new SecurityException(errorMessage != null ? errorMessage : "Bạn không có quyền truy cập chức năng này");
        }
    }

    // ================== Public APIs used by AdminController ==================

    public List<RbacRoleDTO> listRoles(String authorizationHeader) {
        requirePermissionManage(authorizationHeader);

        return roleRepository.findAll().stream()
                .map(r -> {
                    RbacRoleDTO dto = new RbacRoleDTO();
                    dto.setId(r.getId());
                    dto.setCode(r.getCode());
                    dto.setName(r.getName());
                    return dto;
                })
                .collect(Collectors.toList());
    }

    public List<RbacPermissionDTO> listPermissions(String authorizationHeader) {
        requirePermissionManage(authorizationHeader);

        return permissionRepository.findAll().stream()
                .map(p -> {
                    RbacPermissionDTO dto = new RbacPermissionDTO();
                    dto.setId(p.getId());
                    dto.setCode(p.getCode());
                    dto.setName(p.getName());
                    dto.setDescription(p.getDescription());
                    return dto;
                })
                .collect(Collectors.toList());
    }

    public RolePermissionsResponseDTO getRolePermissions(String authorizationHeader, String roleCode) {
        requirePermissionManage(authorizationHeader);

        Role role = roleRepository.findByCode(normRole(roleCode))
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy roleCode=" + roleCode));

        List<String> assigned = rolePermissionRepository.findPermissionCodesByRoleId(role.getId());
        List<String> defaults = DEFAULT_ROLE_PERMS.getOrDefault(role.getCode(), List.of());

        RolePermissionsResponseDTO resp = new RolePermissionsResponseDTO();
        resp.setRoleCode(role.getCode());
        resp.setRoleName(role.getName());
        resp.setAssignedPermissionCodes(sortUnique(assigned));
        resp.setDefaultPermissionCodes(sortUnique(defaults));
        return resp;
    }

    @Transactional
    public RolePermissionsResponseDTO replaceRolePermissions(String authorizationHeader, String roleCode, List<String> permissionCodes) {
        requirePermissionManage(authorizationHeader);

        String rc = normRole(roleCode);
        if ("BGH".equalsIgnoreCase(rc)) {
            throw new IllegalArgumentException("Không cho phép cập nhật permission của role BGH qua API này.");
        }

        Role role = roleRepository.findByCode(rc)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy roleCode=" + roleCode));

        List<String> normalizedCodes = normalizePermissionCodes(permissionCodes);

        List<Permission> perms = normalizedCodes.isEmpty()
                ? List.of()
                : permissionRepository.findByCodeIn(normalizedCodes);

        Set<String> found = perms.stream().map(Permission::getCode).collect(Collectors.toSet());
        List<String> missing = normalizedCodes.stream().filter(c -> !found.contains(c)).toList();
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Permission code không tồn tại: " + missing);
        }

        rolePermissionRepository.deleteByRoleId(role.getId());

        if (!perms.isEmpty()) {
            List<RolePermission> toSave = new ArrayList<>();
            for (Permission p : perms) {
                RolePermission rp = new RolePermission();
                rp.setRole(role);
                rp.setPermission(p);
                rp.getId().setRoleId(role.getId());
                rp.getId().setPermissionId(p.getId());
                toSave.add(rp);
            }
            rolePermissionRepository.saveAll(toSave);
        }

        return getRolePermissions(authorizationHeader, rc);
    }

    @Transactional
    public RolePermissionsResponseDTO resetRolePermissionsToDefault(String authorizationHeader, String roleCode) {
        String rc = normRole(roleCode);
        if ("BGH".equalsIgnoreCase(rc)) {
            throw new IllegalArgumentException("Không cho phép reset permission của role BGH qua API này.");
        }
        List<String> defaults = DEFAULT_ROLE_PERMS.getOrDefault(rc, List.of());
        return replaceRolePermissions(authorizationHeader, rc, defaults);
    }

    // ================== Authorization core ==================

    private void requirePermissionManage(String authorizationHeader) {
        Long actorId = parseUserIdFromAuth(authorizationHeader);
        User actor = requireApprovedUser(actorId);

        Set<String> effective = getEffectivePermissionCodes(actor);
        if (!effective.contains(PERM_MANAGE)) {
            throw new SecurityException("Bạn không có quyền " + PERM_MANAGE);
        }
    }

    private Long parseUserIdFromAuth(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.trim().isEmpty()) {
            throw new SecurityException("Thiếu header Authorization");
        }
        String token = authorizationHeader.trim();
        if (token.toLowerCase().startsWith("bearer ")) {
            token = token.substring(7).trim();
        }
        if (!token.startsWith(TOKEN_PREFIX)) {
            throw new SecurityException("Token không hợp lệ (cần dạng Bearer user-token-{id})");
        }
        String idStr = token.substring(TOKEN_PREFIX.length()).trim();
        try {
            return Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            throw new SecurityException("Token không hợp lệ: không parse được userId");
        }
    }

    private String normRole(String roleCode) {
        return roleCode == null ? "" : roleCode.trim().toUpperCase();
    }

    private List<String> normalizePermissionCodes(List<String> codes) {
        if (codes == null) return List.of();
        LinkedHashSet<String> set = new LinkedHashSet<>();
        for (String c : codes) {
            if (c == null) continue;
            String x = c.trim();
            if (!x.isEmpty()) set.add(x);
        }
        return new ArrayList<>(set);
    }

    private List<String> sortUnique(List<String> input) {
        if (input == null) return List.of();
        return input.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }
}
