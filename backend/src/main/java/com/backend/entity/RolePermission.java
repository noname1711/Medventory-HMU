package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.io.Serializable;
import java.util.Objects;

@Entity
@Table(name = "role_permissions")
@Data
public class RolePermission {

    @EmbeddedId
    private RolePermissionId id = new RolePermissionId();

    @ManyToOne(optional = false)
    @MapsId("roleId")
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @ManyToOne(optional = false)
    @MapsId("permissionId")
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @Embeddable
    @Data
    public static class RolePermissionId implements Serializable {
        private Long roleId;
        private Long permissionId;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            RolePermissionId that = (RolePermissionId) o;
            return Objects.equals(roleId, that.roleId) &&
                    Objects.equals(permissionId, that.permissionId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(roleId, permissionId);
        }
    }
}
