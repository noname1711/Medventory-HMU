package com.backend.repository;

import com.backend.entity.RolePermission;
import com.backend.entity.RolePermission.RolePermissionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermissionId> {

    @Query("""
        SELECT rp.permission.code
        FROM RolePermission rp
        WHERE rp.role.id = :roleId
    """)
    List<String> findPermissionCodesByRoleId(Long roleId);

    @Query("""
        SELECT rp.permission.code
        FROM RolePermission rp
        WHERE rp.role.code = :roleCode
    """)
    List<String> findPermissionCodesByRoleCode(String roleCode);
}
