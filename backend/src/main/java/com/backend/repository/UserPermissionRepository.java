package com.backend.repository;

import com.backend.entity.UserPermission;
import com.backend.entity.UserPermission.UserPermissionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

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

    @Query("""
        SELECT COUNT(up)
        FROM UserPermission up
        WHERE up.user.id = :userId
    """)
    long countByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("""
        DELETE FROM UserPermission up
        WHERE up.user.id = :userId
    """)
    void deleteByUserId(@Param("userId") Long userId);

    @Query("""
        SELECT CASE WHEN COUNT(up) > 0 THEN true ELSE false END
        FROM UserPermission up
        WHERE up.user.id = :userId
          AND up.permission.code = :permCode
          AND up.effect = 'GRANT'
    """)
    boolean existsGrantedByUserIdAndPermissionCode(
            @Param("userId") Long userId,
            @Param("permCode") String permCode
    );
}
