package com.backend.repository;

import com.backend.entity.UserPermission;
import com.backend.entity.UserPermission.UserPermissionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface UserPermissionRepository extends JpaRepository<UserPermission, UserPermissionId> {

    @Query("""
        SELECT up
        FROM UserPermission up
        WHERE up.user.id = :userId
        ORDER BY up.createdAt DESC
    """)
    List<UserPermission> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("""
        SELECT up.permission.code
        FROM UserPermission up
        WHERE up.user.id = :userId AND up.effect = 'GRANT'
    """)
    List<String> findGrantedPermissionCodes(Long userId);

    @Query("""
        SELECT up.permission.code
        FROM UserPermission up
        WHERE up.user.id = :userId AND up.effect = 'REVOKE'
    """)
    List<String> findRevokedPermissionCodes(Long userId);
}
