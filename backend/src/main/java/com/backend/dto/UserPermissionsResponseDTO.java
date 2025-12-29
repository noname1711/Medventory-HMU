package com.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class UserPermissionsResponseDTO {
    private Long userId;
    private String fullName;
    private String email;

    private String roleCode;
    private String roleName;

    // true = user dùng quyền riêng, không phụ thuộc role_permissions
    private boolean specialUser;

    private List<String> rolePermissionCodes;         // quyền theo role (tham khảo)
    private List<String> userGrantedPermissionCodes;  // quyền GRANT theo user (không gồm marker)
    private List<String> userRevokedPermissionCodes;  // quyền REVOKE theo user (không gồm marker)
    private List<String> effectivePermissionCodes;    // quyền hiệu lực cuối cùng (không gồm marker)
}
