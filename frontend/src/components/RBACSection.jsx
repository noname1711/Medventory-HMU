import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./RBACSection.css";

const API_URL = "http://localhost:8080/api";

export default function RBACSection({ adminInfo }) {
  // =========================================================
  // TAB KEYS
  // =========================================================
  const TAB_ROLE = "ROLE";
  const TAB_USER = "USER";
  const [activeTab, setActiveTab] = useState(TAB_ROLE);

  // =========================================================
  // CATALOG DATA
  // =========================================================
  const [rbacRoles, setRbacRoles] = useState([]);
  const [rbacPermissions, setRbacPermissions] = useState([]);
  const [rbacLoading, setRbacLoading] = useState(false);

  // =========================================================
  // ROLE TAB STATE
  // =========================================================
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [selectedRoleName, setSelectedRoleName] = useState("");
  const [assignedPermCodes, setAssignedPermCodes] = useState([]);
  const [defaultPermCodes, setDefaultPermCodes] = useState([]);
  const [editingPermSet, setEditingPermSet] = useState(new Set());
  const [permSearch, setPermSearch] = useState("");
  const [rbacSaving, setRbacSaving] = useState(false);

  // =========================================================
  // USER TAB STATE
  // =========================================================
  const [allUsers, setAllUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [userSpecial, setUserSpecial] = useState(false);
  const [userRolePermCodes, setUserRolePermCodes] = useState([]);
  const [userAssignedEffectiveCodes, setUserAssignedEffectiveCodes] = useState([]);
  const [userGrantedCodes, setUserGrantedCodes] = useState([]);
  const [userRevokedCodes, setUserRevokedCodes] = useState([]);
  const [editingUserPermSet, setEditingUserPermSet] = useState(new Set());
  const [userPermSearch, setUserPermSearch] = useState("");

  // Hai quyền này chỉ dành cho BGH, không cho thêm vào role thường.
  const SPECIAL_PERMISSIONS = ["USERS.MANAGE", "PERMISSIONS.MANAGE"];

  const API_ENDPOINTS = {
    USERS_ALL: `${API_URL}/admin/users/all`,

    RBAC_ROLES: `${API_URL}/admin/rbac/roles`,
    RBAC_PERMISSIONS: `${API_URL}/admin/rbac/permissions`,
    RBAC_ROLE_PERMS: (roleCode) => `${API_URL}/admin/rbac/roles/${roleCode}/permissions`,
    RBAC_ROLE_PERMS_REPLACE: (roleCode) => `${API_URL}/admin/rbac/roles/${roleCode}/permissions`,
    RBAC_ROLE_PERMS_RESET: (roleCode) => `${API_URL}/admin/rbac/roles/${roleCode}/permissions/reset`,

    RBAC_USER_PERMS: (userId) => `${API_URL}/admin/rbac/users/${userId}/permissions`,
    RBAC_USER_PERMS_REPLACE: (userId) => `${API_URL}/admin/rbac/users/${userId}/permissions`,
    RBAC_USER_PERMS_CLEAR: (userId) => `${API_URL}/admin/rbac/users/${userId}/permissions`,
  };

  // =========================================================
  // AUTH HELPERS
  // =========================================================
  const getAuthToken = () => {
    const tokenDirect =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken");

    if (tokenDirect && tokenDirect.trim()) return tokenDirect.trim();

    const currentUserRaw = localStorage.getItem("currentUser");
    if (currentUserRaw) {
      try {
        const u = JSON.parse(currentUserRaw);
        const tokenFromUser = u?.token || u?.accessToken || u?.jwt || u?.authToken;
        if (tokenFromUser && String(tokenFromUser).trim()) return String(tokenFromUser).trim();
        if (u?.id != null) return `user-token-${u.id}`;
      } catch {
        // Bỏ qua nếu currentUser bị lỗi parse.
      }
    }

    if (adminInfo?.id != null) return `user-token-${adminInfo.id}`;
    return null;
  };

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // =========================================================
  // SHARED HELPERS
  // =========================================================
  const isSetEqual = (a, b) => {
    const A = a || new Set();
    const B = b || new Set();
    if (A.size !== B.size) return false;
    for (const value of A) {
      if (!B.has(value)) return false;
    }
    return true;
  };

  const getUserOptionLabel = (user) => {
    if (!user) return "";
    return `#${user.id} - ${user.fullName || user.name || user.email || "Unknown"}${
      user.email ? ` (${user.email})` : ""
    }`;
  };

  // =========================================================
  // ROLE TAB HELPERS
  // =========================================================
  const setFromRolePermissionsResponse = (resp) => {
    const roleCode = resp?.roleCode || "";
    const roleName = resp?.roleName || "";
    const assigned = Array.isArray(resp?.assignedPermissionCodes) ? resp.assignedPermissionCodes : [];
    const defaults = Array.isArray(resp?.defaultPermissionCodes) ? resp.defaultPermissionCodes : [];

    setSelectedRoleCode(roleCode);
    setSelectedRoleName(roleName);
    setAssignedPermCodes(assigned);
    setDefaultPermCodes(defaults);

    // Trong tab role, bỏ quyền đặc biệt khỏi danh sách chỉnh sửa.
    setEditingPermSet(new Set(assigned.filter((code) => !SPECIAL_PERMISSIONS.includes(code))));
  };

  const fetchRolePermissions = async (roleCode) => {
    if (!roleCode) return;
    setRbacLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.RBAC_ROLE_PERMS(roleCode), {
        headers: { ...authHeaders() },
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const resp = await res.json();
      setFromRolePermissionsResponse(resp);
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({
          title: "Không có quyền",
          text: "Bạn không có quyền truy cập chức năng này.",
          icon: "error",
          timer: 3000,
        });
      } else {
        Swal.fire({
          title: "Lỗi!",
          text: "Không thể tải quyền của role.",
          icon: "error",
          timer: 3000,
        });
      }
    } finally {
      setRbacLoading(false);
    }
  };

  const saveRolePermissions = async () => {
    if (!selectedRoleCode) return;

    const roleCodeUpper = String(selectedRoleCode).toUpperCase();
    if (roleCodeUpper === "BGH") {
      Swal.fire({
        title: "Không hợp lệ",
        text: "Backend đã khóa chỉnh role BGH.",
        icon: "warning",
        timer: 2500,
      });
      return;
    }

    const editingArray = Array.from(editingPermSet || new Set());
    const hasSpecialPermission = SPECIAL_PERMISSIONS.some((perm) => editingArray.includes(perm));

    if (hasSpecialPermission) {
      Swal.fire({
        title: "Không được phép",
        text: "Không thể thêm quyền USERS.MANAGE hoặc PERMISSIONS.MANAGE vào role. Hai quyền này chỉ dành cho BGH.",
        icon: "error",
        timer: 3000,
      });
      return;
    }

    setRbacSaving(true);

    try {
      const res = await fetch(API_ENDPOINTS.RBAC_ROLE_PERMS_REPLACE(selectedRoleCode), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ permissionCodes: editingArray }),
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const resp = await res.json();
      setFromRolePermissionsResponse(resp);

      Swal.fire({
        title: "✅ Đã lưu",
        text: `Đã cập nhật quyền cho role ${resp?.roleCode || selectedRoleCode}.`,
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể lưu phân quyền: ${error?.message || ""}`, icon: "error", timer: 3500 });
      }
    } finally {
      setRbacSaving(false);
    }
  };

  const resetRolePermissionsToDefault = async () => {
    if (!selectedRoleCode) return;

    const roleCodeUpper = String(selectedRoleCode).toUpperCase();
    if (roleCodeUpper === "BGH") {
      Swal.fire({
        title: "Không hợp lệ",
        text: "Backend đã khóa chỉnh role BGH.",
        icon: "warning",
        timer: 2500,
      });
      return;
    }

    const confirm = await Swal.fire({
      title: "Đặt về mặc định?",
      text: `Quyền của role ${selectedRoleCode} sẽ quay về mặc định hệ thống.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Đặt về mặc định",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#10B981",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    setRbacSaving(true);

    try {
      const res = await fetch(API_ENDPOINTS.RBAC_ROLE_PERMS_RESET(selectedRoleCode), {
        method: "POST",
        headers: { ...authHeaders() },
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const resp = await res.json();
      setFromRolePermissionsResponse(resp);

      Swal.fire({
        title: "✅ Đã reset",
        text: `Role ${resp?.roleCode || selectedRoleCode} đã quay về mặc định.`,
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể reset: ${error?.message || ""}`, icon: "error", timer: 3500 });
      }
    } finally {
      setRbacSaving(false);
    }
  };

  const discardRolePermissionChanges = () => {
    setEditingPermSet(new Set(assignedPermCodes.filter((code) => !SPECIAL_PERMISSIONS.includes(code))));
  };

  const toggleRolePermission = (code) => {
    if (!code) return;

    if (SPECIAL_PERMISSIONS.includes(code)) {
      Swal.fire({
        title: "Không thể thay đổi",
        text: `Quyền ${code} không được phép thêm vào role.`,
        icon: "warning",
        timer: 2000,
      });
      return;
    }

    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAllFilteredRolePermissions = (filteredList) => {
    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((perm) => {
        if (perm?.code && !SPECIAL_PERMISSIONS.includes(perm.code)) {
          next.add(perm.code);
        }
      });
      return next;
    });
  };

  const clearAllFilteredRolePermissions = (filteredList) => {
    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((perm) => {
        if (perm?.code) next.delete(perm.code);
      });
      return next;
    });
  };

  // =========================================================
  // USER TAB HELPERS
  // =========================================================
  const setFromUserPermissionsResponse = (resp) => {
    const info = resp || {};

    setSelectedUserInfo({
      id: info?.userId,
      fullName: info?.fullName,
      email: info?.email,
      roleCode: info?.roleCode,
      roleName: info?.roleName,
    });

    const rolePerms = Array.isArray(info?.rolePermissionCodes) ? info.rolePermissionCodes : [];
    const grants = Array.isArray(info?.userGrantedPermissionCodes) ? info.userGrantedPermissionCodes : [];
    const revokes = Array.isArray(info?.userRevokedPermissionCodes) ? info.userRevokedPermissionCodes : [];
    const effective = Array.isArray(info?.effectivePermissionCodes) ? info.effectivePermissionCodes : [];

    setUserSpecial(!!info?.specialUser);
    setUserRolePermCodes(rolePerms);
    setUserGrantedCodes(grants);
    setUserRevokedCodes(revokes);
    setUserAssignedEffectiveCodes(effective);
    setEditingUserPermSet(new Set(effective));
  };

  const fetchAllUsers = async () => {
    setUserLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.USERS_ALL, {
        headers: { ...authHeaders() },
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const users = await res.json();
      setAllUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({
          title: "Không có quyền",
          text: "Bạn không có quyền truy cập danh sách người dùng.",
          icon: "error",
          timer: 3000,
        });
      } else {
        Swal.fire({
          title: "Lỗi!",
          text: "Không thể tải danh sách người dùng.",
          icon: "error",
          timer: 3000,
        });
      }
    } finally {
      setUserLoading(false);
    }
  };

  const fetchUserPermissions = async (userId) => {
    if (!userId) return;
    setUserLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.RBAC_USER_PERMS(userId), {
        headers: { ...authHeaders() },
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const resp = await res.json();
      setFromUserPermissionsResponse(resp);
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({
          title: "Không có quyền",
          text: "Bạn không có quyền PERMISSIONS.MANAGE để truy cập chức năng phân quyền theo user.",
          icon: "error",
          timer: 3500,
        });
      } else {
        Swal.fire({
          title: "Lỗi!",
          text: "Không thể tải quyền của user.",
          icon: "error",
          timer: 3000,
        });
      }
    } finally {
      setUserLoading(false);
    }
  };

  const saveUserPermissions = async () => {
    if (!selectedUserId) return;
    setUserSaving(true);

    try {
      const editingArray = Array.from(editingUserPermSet || new Set()).sort();
      const res = await fetch(API_ENDPOINTS.RBAC_USER_PERMS_REPLACE(selectedUserId), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ permissionCodes: editingArray }),
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const resp = await res.json();
      setFromUserPermissionsResponse(resp);

      Swal.fire({
        title: "✅ Đã lưu",
        text: "Đã cập nhật phân quyền theo user. User này sẽ không bị ảnh hưởng bởi role cho đến khi bạn chọn 'Quay về theo role'.",
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể lưu: ${error?.message || ""}`, icon: "error", timer: 3500 });
      }
    } finally {
      setUserSaving(false);
    }
  };

  const clearUserOverrides = async () => {
    if (!selectedUserId) return;

    const confirm = await Swal.fire({
      title: "Quay về theo role?",
      text: "Thao tác này sẽ xóa toàn bộ quyền riêng của user và user sẽ lại phụ thuộc role.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Quay về theo role",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    setUserSaving(true);

    try {
      const res = await fetch(API_ENDPOINTS.RBAC_USER_PERMS_CLEAR(selectedUserId), {
        method: "DELETE",
        headers: { ...authHeaders() },
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const resp = await res.json();
      setFromUserPermissionsResponse(resp);

      Swal.fire({
        title: "✅ Đã hoàn tất",
        text: "User đã quay về cơ chế phân quyền theo role.",
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể thực hiện: ${error?.message || ""}`, icon: "error", timer: 3500 });
      }
    } finally {
      setUserSaving(false);
    }
  };

  const discardUserPermissionChanges = () => {
    setEditingUserPermSet(new Set(userAssignedEffectiveCodes || []));
  };

  const toggleUserPermission = (code) => {
    if (!code) return;
    setEditingUserPermSet((prev) => {
      const next = new Set(prev || []);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAllFilteredUserPermissions = (filteredList) => {
    setEditingUserPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((perm) => {
        if (perm?.code) next.add(perm.code);
      });
      return next;
    });
  };

  const clearAllFilteredUserPermissions = (filteredList) => {
    setEditingUserPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((perm) => {
        if (perm?.code) next.delete(perm.code);
      });
      return next;
    });
  };

  // =========================================================
  // COMPUTED DATA
  // =========================================================
  const filteredPermissionsForRole = useMemo(() => {
    return (rbacPermissions || []).filter((perm) => {
      if (!permSearch.trim()) return true;
      const q = permSearch.trim().toLowerCase();
      const haystack = `${perm?.code || ""} ${perm?.name || ""} ${perm?.description || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rbacPermissions, permSearch]);

  const filteredPermissionsForUser = useMemo(() => {
    return (rbacPermissions || []).filter((perm) => {
      if (!userPermSearch.trim()) return true;
      const q = userPermSearch.trim().toLowerCase();
      const haystack = `${perm?.code || ""} ${perm?.name || ""} ${perm?.description || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rbacPermissions, userPermSearch]);

  const assignedSet = useMemo(
    () => new Set((assignedPermCodes || []).filter((code) => !SPECIAL_PERMISSIONS.includes(code))),
    [assignedPermCodes]
  );

  const defaultSet = useMemo(
    () => new Set((defaultPermCodes || []).filter((code) => !SPECIAL_PERMISSIONS.includes(code))),
    [defaultPermCodes]
  );

  const dirtyRole = useMemo(() => !isSetEqual(editingPermSet, assignedSet), [editingPermSet, assignedSet]);
  const userAssignedSet = useMemo(() => new Set(userAssignedEffectiveCodes || []), [userAssignedEffectiveCodes]);
  const dirtyUser = useMemo(() => !isSetEqual(editingUserPermSet, userAssignedSet), [editingUserPermSet, userAssignedSet]);

  const addedVsDefault = useMemo(() => {
    return Array.from(editingPermSet || new Set())
      .filter((code) => !SPECIAL_PERMISSIONS.includes(code) && !defaultSet.has(code))
      .sort();
  }, [editingPermSet, defaultSet]);

  const removedVsDefault = useMemo(() => {
    return Array.from(defaultSet)
      .filter((code) => !SPECIAL_PERMISSIONS.includes(code) && !(editingPermSet || new Set()).has(code))
      .sort();
  }, [defaultSet, editingPermSet]);

  const roleSelectablePermissionCount = useMemo(() => {
    return (rbacPermissions || []).filter((perm) => !SPECIAL_PERMISSIONS.includes(perm?.code)).length;
  }, [rbacPermissions]);

  const userTotalCount = allUsers.length;
  const roleCount = rbacRoles.length;
  const permissionCount = rbacPermissions.length;

  // =========================================================
  // INITIAL LOAD
  // =========================================================
  const fetchRbacCatalog = async () => {
    setRbacLoading(true);

    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch(API_ENDPOINTS.RBAC_ROLES, { headers: { ...authHeaders() } }),
        fetch(API_ENDPOINTS.RBAC_PERMISSIONS, { headers: { ...authHeaders() } }),
      ]);

      if (rolesRes.status === 403 || permsRes.status === 403) throw new Error("FORBIDDEN");
      if (!rolesRes.ok) throw new Error(`roles: HTTP ${rolesRes.status}`);
      if (!permsRes.ok) throw new Error(`permissions: HTTP ${permsRes.status}`);

      const roles = await rolesRes.json();
      const perms = await permsRes.json();

      const roleList = Array.isArray(roles) ? roles : [];
      const permList = Array.isArray(perms) ? perms : [];

      setRbacRoles(roleList);
      setRbacPermissions(permList);

      if (!selectedRoleCode) {
        const firstNonBgh = roleList.find((role) => String(role.code).toUpperCase() !== "BGH");
        const first = firstNonBgh || roleList[0];
        if (first?.code) {
          await fetchRolePermissions(String(first.code));
        }
      }
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({
          title: "Không có quyền",
          text: "Tài khoản hiện tại không có quyền PERMISSIONS.MANAGE để truy cập chức năng phân quyền.",
          icon: "error",
          timer: 3500,
        });
      } else {
        Swal.fire({
          title: "Lỗi!",
          text: "Không thể tải dữ liệu phân quyền (roles/permissions).",
          icon: "error",
          timer: 3500,
        });
      }
    } finally {
      setRbacLoading(false);
    }
  };

  useEffect(() => {
    fetchRbacCatalog();
    fetchAllUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== TAB_USER) return;
    if (selectedUserId || allUsers.length === 0) return;

    const first = allUsers[0];
    if (first?.id != null) {
      const userId = String(first.id);
      setSelectedUserId(userId);
      fetchUserPermissions(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, allUsers, selectedUserId]);

  // =========================================================
  // RENDER HELPERS
  // =========================================================
  const renderPermissionItem = ({ perm, checked, disabled, onToggle, isSpecial = false }) => {
    const code = perm?.code || "";

    return (
      <label
        key={code}
        className={`rbac-perm-card ${checked ? "is-checked" : ""} ${isSpecial ? "is-special" : ""}`}
      >
        <div className="rbac-perm-card-top">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={() => onToggle(code)}
          />
          <div className="rbac-perm-card-title-wrap">
            <div className="rbac-perm-card-name">
              {perm?.name || code}
              {isSpecial && <span className="rbac-inline-badge">Chỉ dành cho BGH</span>}
            </div>
          </div>
        </div>

        {perm?.description && <div className="rbac-perm-card-desc">{perm.description}</div>}
      </label>
    );
  };

  const renderRoleTab = () => {
    return (
      <div className="rbac-panel-body">
        <div className="rbac-info-row">
          <span>
            <span className="rbac-info-label">Role:</span>{" "}
            {selectedRoleCode
              ? `${selectedRoleCode}${selectedRoleName ? ` — ${selectedRoleName}` : ""}`
              : "Chưa chọn"}
          </span>
          <span className="rbac-info-sep">|</span>
          <span>
            <span className="rbac-info-label">Quyền đã chọn:</span>{" "}
            {Array.from(editingPermSet || new Set()).length} / {roleSelectablePermissionCount}
          </span>
          <span className="rbac-info-sep">|</span>
          <span className={dirtyRole ? "rbac-info-dirty" : ""}>
            {dirtyRole ? "Có thay đổi chưa lưu" : "Chưa thay đổi"}
          </span>
        </div>

        <div className="ui-section rbac-inner-section">
          <div className="ui-section-head">
            <div>
              <h3 className="ui-section-title">Phân quyền theo role</h3>
            </div>
            <div className="ui-toolbar-actions">
              <button
                className="ui-btn ui-btn-secondary"
                onClick={discardRolePermissionChanges}
                disabled={rbacLoading || rbacSaving || !dirtyRole}
              >
                Hoàn tác
              </button>
              <button
                className="ui-btn ui-btn-secondary"
                onClick={resetRolePermissionsToDefault}
                disabled={rbacLoading || rbacSaving || !selectedRoleCode || String(selectedRoleCode).toUpperCase() === "BGH"}
              >
                Đặt về mặc định
              </button>
              <button
                className="ui-btn ui-btn-primary"
                onClick={saveRolePermissions}
                disabled={rbacLoading || rbacSaving || !selectedRoleCode || !dirtyRole || String(selectedRoleCode).toUpperCase() === "BGH"}
              >
                {rbacSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>

          <div className="ui-form-grid cols-2 rbac-top-grid">
            <div className="ui-field">
              <label className="ui-label">Chọn vai trò</label>
              <select
                className="ui-select"
                value={selectedRoleCode}
                onChange={(e) => fetchRolePermissions(e.target.value)}
                disabled={rbacLoading}
              >
                {rbacRoles.map((role) => {
                  const code = String(role?.code || "");
                  const locked = code.toUpperCase() === "BGH";
                  return (
                    <option key={role.id || code} value={code}>
                      {code} - {role?.name || ""}
                      {locked ? " (khóa)" : ""}
                    </option>
                  );
                })}
              </select>
              <span className="ui-help">Vai trò Ban Giám Hiệu (BGH) được bảo vệ, không cho phép chỉnh sửa.</span>
            </div>

            <div className="rbac-summary-box">
              <div>
                <strong>So với mặc định:</strong>{" "}
                {addedVsDefault.length === 0 && removedVsDefault.length === 0
                  ? "Đúng mặc định"
                  : `+${addedVsDefault.length} thêm / −${removedVsDefault.length} bỏ`}
              </div>
            </div>
          </div>

          <div className="ui-toolbar rbac-tools-row">
            <input
              className="ui-input ui-search"
              type="text"
              placeholder="Tìm theo code / tên / mô tả quyền..."
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              disabled={rbacLoading}
            />

            <div className="ui-toolbar-actions">
              <button
                className="ui-btn ui-btn-secondary ui-btn-sm"
                onClick={() => selectAllFilteredRolePermissions(filteredPermissionsForRole)}
                disabled={
                  rbacLoading ||
                  rbacSaving ||
                  !selectedRoleCode ||
                  String(selectedRoleCode).toUpperCase() === "BGH" ||
                  filteredPermissionsForRole.filter((perm) => !SPECIAL_PERMISSIONS.includes(perm?.code)).length === 0
                }
              >
                Chọn tất cả (lọc)
              </button>
              <button
                className="ui-btn ui-btn-secondary ui-btn-sm"
                onClick={() => clearAllFilteredRolePermissions(filteredPermissionsForRole)}
                disabled={
                  rbacLoading ||
                  rbacSaving ||
                  !selectedRoleCode ||
                  String(selectedRoleCode).toUpperCase() === "BGH" ||
                  filteredPermissionsForRole.filter((perm) => !SPECIAL_PERMISSIONS.includes(perm?.code)).length === 0
                }
              >
                Bỏ chọn (lọc)
              </button>
            </div>
          </div>

          <div className="rbac-perm-grid">
            {rbacLoading && <div className="ui-empty">Đang tải dữ liệu phân quyền...</div>}

            {!rbacLoading && filteredPermissionsForRole.length === 0 && (
              <div className="ui-empty">Không có quyền nào khớp từ khóa tìm kiếm.</div>
            )}

            {!rbacLoading &&
              filteredPermissionsForRole.map((perm) => {
                const code = perm?.code || "";
                const checked = (editingPermSet || new Set()).has(code);
                const isSpecial = SPECIAL_PERMISSIONS.includes(code);
                const disabled = String(selectedRoleCode).toUpperCase() === "BGH" || rbacSaving || isSpecial;

                return renderPermissionItem({
                  perm,
                  checked,
                  disabled,
                  onToggle: toggleRolePermission,
                  isSpecial,
                });
              })}
          </div>
        </div>

        <div className="ui-alert is-warning rbac-footnote">
          <div><strong>Ghi chú:</strong></div>
          <div>1. Nếu không muốn phân quyền tùy chỉnh cho role, dùng nút <strong>Đặt về mặc định</strong>.</div>
          <div>2. Quyền <strong>Quản lý người dùng</strong> và <strong>Phân quyền vai trò</strong> chỉ dành cho BGH, không thể thêm vào role khác.</div>
        </div>
      </div>
    );
  };

  const renderUserTab = () => {
    return (
      <div className="rbac-panel-body">
        <div className="rbac-info-row">
          <span>
            <span className="rbac-info-label">User:</span>{" "}
            {selectedUserInfo?.fullName
              ? `${selectedUserInfo.fullName}${selectedUserInfo?.email ? ` (${selectedUserInfo.email})` : ""}`
              : "Chưa chọn"}
          </span>
          <span className="rbac-info-sep">|</span>
          <span>
            <span className="rbac-info-label">Chế độ:</span>{" "}
            {userSpecial ? "Quyền riêng" : "Theo role"}
          </span>
          <span className="rbac-info-sep">|</span>
          <span className={dirtyUser ? "rbac-info-dirty" : ""}>
            {dirtyUser ? "Có thay đổi chưa lưu" : "Chưa thay đổi"}
          </span>
        </div>

        <div className="ui-section rbac-inner-section">
          <div className="ui-section-head">
            <div>
              <h3 className="ui-section-title">Phân quyền theo user</h3>
            </div>
            <div className="ui-toolbar-actions">
              <button className="ui-btn ui-btn-secondary" onClick={discardUserPermissionChanges} disabled={userLoading || userSaving || !dirtyUser}>
                Hoàn tác
              </button>
              <button className="ui-btn ui-btn-secondary" onClick={clearUserOverrides} disabled={userLoading || userSaving || !selectedUserId}>
                Quay về theo role
              </button>
              <button className="ui-btn ui-btn-primary" onClick={saveUserPermissions} disabled={userLoading || userSaving || !selectedUserId || !dirtyUser}>
                {userSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>

          <div className="ui-form-grid cols-2 rbac-top-grid">
            <div className="ui-field">
              <label className="ui-label">Chọn user</label>
              <select
                className="ui-select"
                value={selectedUserId}
                onChange={async (e) => {
                  const userId = e.target.value;
                  setSelectedUserId(userId);
                  await fetchUserPermissions(userId);
                }}
                disabled={userLoading || userSaving}
              >
                {allUsers.map((user) => (
                  <option key={user?.id} value={String(user?.id || "")}>{getUserOptionLabel(user)}</option>
                ))}
              </select>
            </div>

            <div className="rbac-summary-box">
              <div><strong>Role hiện tại:</strong> {selectedUserInfo?.roleCode ? `${selectedUserInfo.roleCode}${selectedUserInfo?.roleName ? ` (${selectedUserInfo.roleName})` : ""}` : "-"}</div>
              <div className="rbac-summary-line">
                <span className="rbac-summary-label">Chế độ:</span>
                <span>{userSpecial ? <span className="rbac-mode-badge is-special">User đặc biệt</span> : <span className="rbac-mode-badge">Theo role</span>}</span>
              </div>
            </div>
          </div>

          <div className="ui-toolbar rbac-tools-row">
            <input
              className="ui-input ui-search"
              type="text"
              placeholder="Tìm theo code / tên / mô tả quyền..."
              value={userPermSearch}
              onChange={(e) => setUserPermSearch(e.target.value)}
              disabled={userLoading}
            />

            <div className="ui-toolbar-actions">
              <button
                className="ui-btn ui-btn-secondary ui-btn-sm"
                onClick={() => selectAllFilteredUserPermissions(filteredPermissionsForUser)}
                disabled={userLoading || userSaving || !selectedUserId || filteredPermissionsForUser.length === 0}
              >
                Chọn tất cả (lọc)
              </button>
              <button
                className="ui-btn ui-btn-secondary ui-btn-sm"
                onClick={() => clearAllFilteredUserPermissions(filteredPermissionsForUser)}
                disabled={userLoading || userSaving || !selectedUserId || filteredPermissionsForUser.length === 0}
              >
                Bỏ chọn (lọc)
              </button>
            </div>
          </div>

          <div className="rbac-perm-grid">
            {userLoading && <div className="ui-empty">Đang tải dữ liệu phân quyền theo user...</div>}

            {!userLoading && filteredPermissionsForUser.length === 0 && (
              <div className="ui-empty">Không có quyền nào khớp từ khóa tìm kiếm.</div>
            )}

            {!userLoading &&
              filteredPermissionsForUser.map((perm) => {
                const code = perm?.code || "";
                const checked = (editingUserPermSet || new Set()).has(code);

                return renderPermissionItem({
                  perm,
                  checked,
                  disabled: userSaving,
                  onToggle: toggleUserPermission,
                });
              })}
          </div>
        </div>

        <div className="ui-alert is-warning rbac-footnote">
          <div><strong>Ghi chú:</strong></div>
          <div>1. Tab này phân quyền trực tiếp theo user. Bạn có thể cấp bất kỳ permission nào.</div>
          <div>2. Sau khi lưu, user sẽ thành “user đặc biệt” và không bị ảnh hưởng khi role thay đổi.</div>
          <div>3. Muốn quay về cơ chế theo role, dùng nút <strong>Quay về theo role</strong>.</div>

        </div>
      </div>
    );
  };

  // =========================================================
  // MAIN RENDER
  // =========================================================
  return (
    <div className="ui-page">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Phân quyền vai trò</h1>
          </div>
        </div>

        <div className="ui-section">
          <div className="ui-tabs">
            <button
              className={`ui-tab ${activeTab === TAB_ROLE ? "is-active" : ""}`}
              onClick={() => setActiveTab(TAB_ROLE)}
              disabled={rbacLoading || rbacSaving || userSaving}
            >
              Phân quyền theo role
            </button>
            <button
              className={`ui-tab ${activeTab === TAB_USER ? "is-active" : ""}`}
              onClick={() => setActiveTab(TAB_USER)}
              disabled={rbacLoading || rbacSaving || userSaving}
            >
              Phân quyền theo user
            </button>
          </div>

          {activeTab === TAB_ROLE ? renderRoleTab() : renderUserTab()}
        </div>
      </div>
    </div>
  );
}
