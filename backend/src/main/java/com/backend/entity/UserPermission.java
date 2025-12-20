package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

@Entity
@Table(name = "user_permissions")
@Data
public class UserPermission {

    @EmbeddedId
    private UserPermissionId id = new UserPermissionId();

    @ManyToOne(optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(optional = false)
    @MapsId("permissionId")
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    // DB: effect VARCHAR(10) CHECK IN ('GRANT','REVOKE')
    @Column(name = "effect", nullable = false, length = 10)
    private String effect; // "GRANT" or "REVOKE"

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    @Embeddable
    @Data
    public static class UserPermissionId implements Serializable {
        private Long userId;
        private Long permissionId;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            UserPermissionId that = (UserPermissionId) o;
            return Objects.equals(userId, that.userId) &&
                    Objects.equals(permissionId, that.permissionId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, permissionId);
        }
    }
}
