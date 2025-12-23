package com.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class RolePermissionsResponseDTO {
    private String roleCode;
    private String roleName;

    private List<String> assignedPermissionCodes;
    private List<String> defaultPermissionCodes;
}
