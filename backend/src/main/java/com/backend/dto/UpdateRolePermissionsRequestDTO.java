package com.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class UpdateRolePermissionsRequestDTO {
    private List<String> permissionCodes;
}
