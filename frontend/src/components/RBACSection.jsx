﻿import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./RBACSection.css";

const API_URL = "http://localhost:8080/api";
const SPECIAL_PERMISSIONS = ["USERS.MANAGE", "PERMISSIONS.MANAGE"];
const LOCKED_ROLE_CODE = "ADMIN";

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
  const [rbacSaving, setRbacSaving] = useState(false);

  // =========================================================
  // USER TAB STATE
  // =========================================================
  const [allUsers, setAllUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [userInputVal, setUserInputVal] = useState("");
  const [userSpecial, setUserSpecial] = useState(false);
  const [userAssignedEffectiveCodes, setUserAssignedEffectiveCodes] = useState([]);
  const [userRoleDefaultCodes, setUserRoleDefaultCodes] = useState([]);
  const [editingUserPermSet, setEditingUserPermSet] = useState(new Set());

  // =========================================================
  // BUSINESS SETTINGS
  // =========================================================
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveLoading, setAutoApproveLoading] = useState(false);
  const [autoApproveSaving, setAutoApproveSaving] = useState(false);

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

    ISSUE_REQ_AUTO_APPROVE_SETTING: `${API_URL}/admin/settings/issue-req-auto-approve`,
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

  // Combobox label for a user: "Tên — Vai trò (email)" — email keeps it unique.
  const userLabel = (user) => {
    if (!user) return "";
    const name = user.fullName || user.name || user.email || `#${user.id}`;
    const role = user.roleName || user.role || "";
    const email = user.email ? ` (${user.email})` : "";
    return `${name}${role ? ` — ${role}` : ""}${email}`;
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
    if (roleCodeUpper === LOCKED_ROLE_CODE) {
      Swal.fire({
        title: "Không hợp lệ",
        text: "Backend đã khóa chỉnh role Admin.",
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
        text: "Không thể thêm quyền USERS.MANAGE hoặc PERMISSIONS.MANAGE vào role. Hai quyền này chỉ dành cho Admin.",
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
    if (roleCodeUpper === LOCKED_ROLE_CODE) {
      Swal.fire({
        title: "Không hợp lệ",
        text: "Backend đã khóa chỉnh role Admin.",
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

    const effective = Array.isArray(info?.effectivePermissionCodes) ? info.effectivePermissionCodes : [];
    const roleDefaults = Array.isArray(info?.rolePermissionCodes) ? info.rolePermissionCodes : [];

    setUserSpecial(!!info?.specialUser);
    setUserAssignedEffectiveCodes(effective);
    setUserRoleDefaultCodes(roleDefaults);
    // Role-default permissions are always considered granted; user can add extras on top.
    setEditingUserPermSet(new Set([...effective, ...roleDefaults]));
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

  const toggleUserPermission = (code) => {
    if (!code) return;
    setEditingUserPermSet((prev) => {
      const next = new Set(prev || []);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const fetchIssueReqAutoApproveSetting = async () => {
    setAutoApproveLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.ISSUE_REQ_AUTO_APPROVE_SETTING, {
        headers: { ...authHeaders() },
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setAutoApproveEnabled(!!data?.enabled);
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({
          title: "Không có quyền",
          text: "Bạn không có PERMISSIONS.MANAGE để xem thiết lập nghiệp vụ.",
          icon: "error",
          timer: 3000,
        });
      } else {
        Swal.fire({
          title: "Lỗi!",
          text: "Không thể tải thiết lập tự động phê duyệt.",
          icon: "error",
          timer: 3000,
        });
      }
    } finally {
      setAutoApproveLoading(false);
    }
  };

  const updateIssueReqAutoApproveSetting = async (nextEnabled) => {
    setAutoApproveSaving(true);

    try {
      const res = await fetch(API_ENDPOINTS.ISSUE_REQ_AUTO_APPROVE_SETTING, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ enabled: nextEnabled }),
      });

      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const enabled = !!data?.enabled;
      setAutoApproveEnabled(enabled);

      Swal.fire({
        title: "Đã lưu",
        text: enabled
          ? "Đã bật tự động phê duyệt phiếu xin lĩnh khi đủ tồn kho."
          : "Đã tắt tự động phê duyệt. Phiếu xin lĩnh sẽ chờ lãnh đạo duyệt.",
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      setAutoApproveEnabled(!nextEnabled);

      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({
          title: "Lỗi!",
          text: `Không thể lưu thiết lập tự động phê duyệt: ${error?.message || ""}`,
          icon: "error",
          timer: 3500,
        });
      }
    } finally {
      setAutoApproveSaving(false);
    }
  };

  // =========================================================
  // COMPUTED DATA
  // =========================================================
  const assignedSet = useMemo(
    () => new Set((assignedPermCodes || []).filter((code) => !SPECIAL_PERMISSIONS.includes(code))),
    [assignedPermCodes]
  );

  const dirtyRole = useMemo(() => !isSetEqual(editingPermSet, assignedSet), [editingPermSet, assignedSet]);

  // Role defaults the selected user inherits (gray "Mặc định theo vai trò" badge)
  const userRoleDefaultSet = useMemo(
    () => new Set(userRoleDefaultCodes || []),
    [userRoleDefaultCodes]
  );
  const userAssignedSet = useMemo(
    () => new Set([...(userAssignedEffectiveCodes || []), ...(userRoleDefaultCodes || [])]),
    [userAssignedEffectiveCodes, userRoleDefaultCodes]
  );
  const dirtyUser = useMemo(() => !isSetEqual(editingUserPermSet, userAssignedSet), [editingUserPermSet, userAssignedSet]);

  // Extra permissions granted on top of the role defaults (blue "Cấp riêng" badge)
  const userExtraCount = useMemo(
    () => Array.from(editingUserPermSet || new Set()).filter((code) => !userRoleDefaultSet.has(code)).length,
    [editingUserPermSet, userRoleDefaultSet]
  );

  const roleSelectablePermissionCount = useMemo(() => {
    return (rbacPermissions || []).filter((perm) => !SPECIAL_PERMISSIONS.includes(perm?.code)).length;
  }, [rbacPermissions]);


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
        const firstEditableRole = roleList.find((role) => String(role.code).toUpperCase() !== LOCKED_ROLE_CODE);
        const first = firstEditableRole || roleList[0];
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
    fetchIssueReqAutoApproveSetting();
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

  // Keep the combobox text in sync with the selected user.
  useEffect(() => {
    if (selectedUserId && allUsers.length > 0) {
      const u = allUsers.find((x) => String(x.id) === String(selectedUserId));
      setUserInputVal(u ? userLabel(u) : "");
    } else {
      setUserInputVal("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, allUsers]);

  // =========================================================
  // RENDER HELPERS
  // =========================================================
  const renderBusinessSettings = () => {
    const disabled = autoApproveLoading || autoApproveSaving;

    return (
      <div className="ui-section rbac-settings-section">
        <div className="rbac-setting-row">
          <div className="rbac-setting-copy">
            <h2 className="ui-section-title">Tự động phê duyệt phiếu xin lĩnh</h2>
            <p className="rbac-setting-desc">
              Tự duyệt khi đủ tồn kho và hệ thống giữ chỗ vật tư thành công.
            </p>
          </div>

          <label className={`rbac-switch ${disabled ? "is-disabled" : ""}`}>
            <input
              type="checkbox"
              checked={autoApproveEnabled}
              disabled={disabled}
              onChange={(e) => {
                const nextEnabled = e.target.checked;
                setAutoApproveEnabled(nextEnabled);
                updateIssueReqAutoApproveSetting(nextEnabled);
              }}
            />
            <span className="rbac-switch-slider" />
            <span className="rbac-switch-label">
              {autoApproveLoading
                ? "Đang tải..."
                : autoApproveSaving
                  ? "Đang lưu..."
                  : autoApproveEnabled
                    ? "Đang bật"
                    : "Đang tắt"}
            </span>
          </label>
        </div>
      </div>
    );
  };

  // Permission card (role tab): square checkbox + name + description
  const renderRolePermItem = (perm) => {
    const code = perm?.code || "";
    const checked = (editingPermSet || new Set()).has(code);
    const isSpecial = SPECIAL_PERMISSIONS.includes(code);
    const disabled = String(selectedRoleCode).toUpperCase() === LOCKED_ROLE_CODE || rbacSaving || isSpecial;

    return (
      <label
        key={code}
        className={`rbac-perm-card ${checked ? "is-checked" : ""} ${isSpecial ? "is-special" : ""} ${disabled ? "is-disabled" : ""}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => toggleRolePermission(code)}
        />
        <div className="rbac-perm-card-body">
          <div className="rbac-perm-card-name">
            {perm?.name || code}
            {isSpecial && <span className="rbac-tag is-special-tag">Chỉ dành cho Admin</span>}
          </div>
          {perm?.description && <div className="rbac-perm-card-desc">{perm.description}</div>}
        </div>
      </label>
    );
  };

  // Permission card (user tab): toggle switch + name + default/extra tag
  const renderUserPermItem = (perm) => {
    const code = perm?.code || "";
    const isDefault = userRoleDefaultSet.has(code);
    const checked = (editingUserPermSet || new Set()).has(code) || isDefault;
    const isExtra = checked && !isDefault;
    const locked = isDefault || userSaving;

    return (
      <div key={code} className={`rbac-user-card ${checked ? "is-on" : ""}`}>
        <button
          type="button"
          className={`rbac-toggle ${checked ? "is-on" : ""} ${locked ? "is-locked" : ""}`}
          onClick={() => { if (!locked) toggleUserPermission(code); }}
          disabled={locked}
          aria-pressed={checked}
          title={isDefault ? "Quyền mặc định theo vai trò" : "Bật/tắt quyền cấp riêng"}
        >
          <span className="rbac-toggle-knob" />
        </button>
        <div className="rbac-user-card-body">
          <div className="rbac-user-card-title">
            <span className="rbac-user-card-name">{perm?.name || code}</span>
            {isDefault && <span className="rbac-tag is-default">Mặc định theo vai trò</span>}
            {isExtra && <span className="rbac-tag is-extra">Cấp riêng</span>}
          </div>
          {perm?.description && <div className="rbac-user-card-desc">{perm.description}</div>}
        </div>
      </div>
    );
  };

  const renderRoleTab = () => {
    const locked = String(selectedRoleCode).toUpperCase() === LOCKED_ROLE_CODE;
    const selectedCount = Array.from(editingPermSet || new Set()).filter(
      (c) => !SPECIAL_PERMISSIONS.includes(c)
    ).length;

    return (
      <>
        <div className="rbac-select-row">
          <label className="rbac-select-field">
            <span className="ui-label">Chọn vai trò</span>
            <select
              className="ui-input"
              value={selectedRoleCode}
              onChange={(e) => fetchRolePermissions(e.target.value)}
              disabled={rbacLoading}
            >
              {rbacRoles.map((role) => {
                const code = String(role?.code || "");
                const rlocked = code.toUpperCase() === LOCKED_ROLE_CODE;
                return (
                  <option key={role.id || code} value={code}>
                    {code} — {role?.name || ""}{rlocked ? " (khóa)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="rbac-select-actions">
            <button
              className="ui-btn ui-btn-light"
              onClick={resetRolePermissionsToDefault}
              disabled={rbacLoading || rbacSaving || !selectedRoleCode || locked}
            >
              Đặt về mặc định
            </button>
            <button
              className="ui-btn ui-btn-primary"
              onClick={saveRolePermissions}
              disabled={rbacLoading || rbacSaving || !selectedRoleCode || !dirtyRole || locked}
            >
              {rbacSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        <div className="rbac-meta-bar">
          <span>
            Role:{" "}
            <b>{selectedRoleCode ? `${selectedRoleCode}${selectedRoleName ? ` — ${selectedRoleName}` : ""}` : "Chưa chọn"}</b>
          </span>
          <span className="rbac-meta-dot">·</span>
          <span>
            Quyền đã chọn: <b className="is-count">{selectedCount} / {roleSelectablePermissionCount}</b>
          </span>
          {dirtyRole && (
            <>
              <span className="rbac-meta-dot">·</span>
              <span className="rbac-meta-dirty">Có thay đổi chưa lưu</span>
            </>
          )}
        </div>

        <div className="rbac-perm-grid">
          {rbacLoading && <div className="ui-empty">Đang tải dữ liệu phân quyền...</div>}
          {!rbacLoading && rbacPermissions.length === 0 && (
            <div className="ui-empty">Không có quyền nào khả dụng.</div>
          )}
          {!rbacLoading && rbacPermissions.map((perm) => renderRolePermItem(perm))}
        </div>
      </>
    );
  };

  const renderUserTab = () => {
    const selRow = allUsers.find((u) => String(u.id) === String(selectedUserId));
    const selDept =
      selRow?.departmentName || selRow?.department?.name || selRow?.department || "—";

    return (
      <>
        <div className="rbac-select-row">
          <label className="rbac-select-field">
            <span className="ui-label">Chọn người dùng</span>
            <input
              className="ui-input"
              list="rbac-users-datalist"
              placeholder="Gõ tên, vai trò hoặc email để tìm..."
              value={userInputVal}
              onChange={(e) => {
                const val = e.target.value;
                setUserInputVal(val);
                const matched = allUsers.find((u) => userLabel(u) === val);
                if (matched) {
                  const userId = String(matched.id);
                  setSelectedUserId(userId);
                  fetchUserPermissions(userId);
                }
              }}
              disabled={userLoading || userSaving}
            />
            <datalist id="rbac-users-datalist">
              {allUsers.map((user) => (
                <option key={user?.id} value={userLabel(user)} />
              ))}
            </datalist>
          </label>
          <div className="rbac-select-actions">
            <button
              className="ui-btn ui-btn-light"
              onClick={clearUserOverrides}
              disabled={userLoading || userSaving || !selectedUserId}
            >
              Quay về theo role
            </button>
            <button
              className="ui-btn ui-btn-primary"
              onClick={saveUserPermissions}
              disabled={userLoading || userSaving || !selectedUserId || !dirtyUser}
            >
              {userSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        <div className="rbac-meta-bar">
          <span>Người dùng: <b>{selectedUserInfo?.fullName || "—"}</b></span>
          <span>Vai trò: <b>{selectedUserInfo?.roleName || selectedUserInfo?.roleCode || "—"}</b></span>
          <span>Phòng ban: <b>{selDept}</b></span>
        </div>

        <div className="rbac-legend">
          <span className="rbac-legend-item">
            <span className="rbac-legend-dot is-default" />
            {userRoleDefaultSet.size} quyền mặc định theo vai trò
          </span>
          <span className="rbac-meta-dot">·</span>
          <span className="rbac-legend-item">
            <span className="rbac-legend-dot is-extra" />
            {userExtraCount} quyền cấp riêng
          </span>
        </div>

        <div className="rbac-perm-grid">
          {userLoading && <div className="ui-empty">Đang tải dữ liệu phân quyền theo user...</div>}
          {!userLoading && rbacPermissions.length === 0 && (
            <div className="ui-empty">Không có quyền nào khả dụng.</div>
          )}
          {!userLoading && rbacPermissions.map((perm) => renderUserPermItem(perm))}
        </div>
      </>
    );
  };

  // =========================================================
  // MAIN RENDER
  // =========================================================
  return (
    <div className="ui-page">
      <div className="ui-page-stack">
        <div className="ui-screen-head">
          <div className="ui-eyebrow">Quản trị</div>
          <h1 className="ui-screen-title">Phân quyền vai trò</h1>
        </div>

        {renderBusinessSettings()}

        <div className="ui-section rbac-main-card">
          <div className="ui-segment rbac-segment">
            <button
              className={`ui-segment-btn ${activeTab === TAB_ROLE ? "is-active" : ""}`}
              onClick={() => setActiveTab(TAB_ROLE)}
              disabled={rbacLoading || rbacSaving || userSaving}
            >
              Phân quyền theo role
            </button>
            <button
              className={`ui-segment-btn ${activeTab === TAB_USER ? "is-active" : ""}`}
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
