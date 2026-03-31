import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "./Admin.css";
import "./RBACSection.css";

const API_URL = "http://localhost:8080/api";

export default function RBACSection({ adminInfo }) {
  // ===== Tabs =====
  const TAB_ROLE = "ROLE";
  const TAB_USER = "USER";
  const [activeTab, setActiveTab] = useState(TAB_ROLE);

  // ===== Catalog =====
  const [rbacRoles, setRbacRoles] = useState([]);
  const [rbacPermissions, setRbacPermissions] = useState([]);
  const [rbacLoading, setRbacLoading] = useState(false);

  // ===== Role tab states =====
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [selectedRoleName, setSelectedRoleName] = useState("");

  const [assignedPermCodes, setAssignedPermCodes] = useState([]);
  const [defaultPermCodes, setDefaultPermCodes] = useState([]);
  const [editingPermSet, setEditingPermSet] = useState(new Set());

  const [permSearch, setPermSearch] = useState("");
  const [rbacSaving, setRbacSaving] = useState(false);

  // ===== User tab states =====
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

  // Danh sách quyền đặc biệt KHÔNG được phép thêm vào role
  const SPECIAL_PERMISSIONS = ["USERS.MANAGE", "PERMISSIONS.MANAGE"];

  // API endpoints cho RBAC
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

  // Helper function để lấy auth token
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
      } catch (e) {
        // ignore
      }
    }

    if (adminInfo?.id != null) return `user-token-${adminInfo.id}`;

    return null;
  };

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // =========================
  // ROLE TAB
  // =========================

  // Cập nhật state từ response server
  const setFromRolePermissionsResponse = (resp) => {
    const roleCode = resp?.roleCode || "";
    const roleName = resp?.roleName || "";

    const assigned = Array.isArray(resp?.assignedPermissionCodes) ? resp.assignedPermissionCodes : [];
    const defaults = Array.isArray(resp?.defaultPermissionCodes) ? resp.defaultPermissionCodes : [];

    setSelectedRoleCode(roleCode);
    setSelectedRoleName(roleName);
    setAssignedPermCodes(assigned);
    setDefaultPermCodes(defaults);

    // Loại bỏ các quyền đặc biệt khỏi editingPermSet
    const filteredAssigned = assigned.filter((code) => !SPECIAL_PERMISSIONS.includes(code));
    setEditingPermSet(new Set(filteredAssigned));
  };

  // Tải permissions của một role cụ thể
  const fetchRolePermissions = async (roleCode) => {
    if (!roleCode) return;
    setRbacLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.RBAC_ROLE_PERMS(roleCode), { headers: { ...authHeaders() } });
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const resp = await res.json();
      setFromRolePermissionsResponse(resp);
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
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

  // Lưu thay đổi permissions (ROLE)
  const saveRolePermissions = async () => {
    if (!selectedRoleCode) return;

    const roleCodeUpper = String(selectedRoleCode).toUpperCase();
    if (roleCodeUpper === "BGH") {
      Swal.fire({ title: "Không hợp lệ", text: "Backend đã khóa chỉnh role BGH.", icon: "warning", timer: 2500 });
      return;
    }

    // Kiểm tra xem có đang cố thêm quyền đặc biệt không
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
      const body = { permissionCodes: editingArray };

      const res = await fetch(API_ENDPOINTS.RBAC_ROLE_PERMS_REPLACE(selectedRoleCode), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
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
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể lưu phân quyền: ${e?.message || ""}`, icon: "error", timer: 3500 });
      }
    } finally {
      setRbacSaving(false);
    }
  };

  // Reset về mặc định (ROLE)
  const resetRolePermissionsToDefault = async () => {
    if (!selectedRoleCode) return;

    const roleCodeUpper = String(selectedRoleCode).toUpperCase();
    if (roleCodeUpper === "BGH") {
      Swal.fire({ title: "Không hợp lệ", text: "Backend đã khóa chỉnh role BGH.", icon: "warning", timer: 2500 });
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
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể reset: ${e?.message || ""}`, icon: "error", timer: 3500 });
      }
    } finally {
      setRbacSaving(false);
    }
  };

  // Hủy thay đổi (ROLE)
  const discardRolePermissionChanges = () => {
    const filteredAssigned = assignedPermCodes.filter((code) => !SPECIAL_PERMISSIONS.includes(code));
    setEditingPermSet(new Set(filteredAssigned));
  };

  // Toggle permission checkbox (ROLE)
  const toggleRolePermission = (code) => {
    if (!code) return;

    // Không cho phép toggle các quyền đặc biệt trong ROLE TAB
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

  // Chọn tất cả permissions đang được filter (ROLE)
  const selectAllFilteredRolePermissions = (filteredList) => {
    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((p) => {
        if (p?.code && !SPECIAL_PERMISSIONS.includes(p.code)) {
          next.add(p.code);
        }
      });
      return next;
    });
  };

  // Bỏ chọn tất cả permissions đang được filter (ROLE)
  const clearAllFilteredRolePermissions = (filteredList) => {
    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((p) => {
        if (p?.code) next.delete(p.code);
      });
      return next;
    });
  };

  // =========================
  // USER TAB
  // =========================

  const setFromUserPermissionsResponse = (resp) => {
    const info = resp || {};
    setSelectedUserInfo({
      id: info?.userId,
      fullName: info?.fullName,
      email: info?.email,
      roleCode: info?.roleCode,
      roleName: info?.roleName,
    });

    const isSpecial = !!info?.specialUser;
    setUserSpecial(isSpecial);

    const rolePerms = Array.isArray(info?.rolePermissionCodes) ? info.rolePermissionCodes : [];
    const grants = Array.isArray(info?.userGrantedPermissionCodes) ? info.userGrantedPermissionCodes : [];
    const revokes = Array.isArray(info?.userRevokedPermissionCodes) ? info.userRevokedPermissionCodes : [];
    const effective = Array.isArray(info?.effectivePermissionCodes) ? info.effectivePermissionCodes : [];

    setUserRolePermCodes(rolePerms);
    setUserGrantedCodes(grants);
    setUserRevokedCodes(revokes);
    setUserAssignedEffectiveCodes(effective);

    // Quan trọng: set editing theo effective hiện tại để admin dễ “giữ baseline + thêm/bớt”
    setEditingUserPermSet(new Set(effective));
  };

  const fetchAllUsers = async () => {
    setUserLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.USERS_ALL, { headers: { ...authHeaders() } });
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const users = await res.json();
      setAllUsers(Array.isArray(users) ? users : []);
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
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
      const res = await fetch(API_ENDPOINTS.RBAC_USER_PERMS(userId), { headers: { ...authHeaders() } });
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const resp = await res.json();
      setFromUserPermissionsResponse(resp);
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
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
      const body = { permissionCodes: editingArray };

      const res = await fetch(API_ENDPOINTS.RBAC_USER_PERMS_REPLACE(selectedUserId), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
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
        text: "Đã cập nhật phân quyền theo user. User này sẽ không bị ảnh hưởng bởi role cho đến khi bạn 'Quay về theo role'.",
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể lưu: ${e?.message || ""}`, icon: "error", timer: 3500 });
      }
    } finally {
      setUserSaving(false);
    }
  };

  const clearUserOverrides = async () => {
    if (!selectedUserId) return;

    const confirm = await Swal.fire({
      title: "Quay về theo role?",
      text: "Thao tác này sẽ xóa toàn bộ quyền riêng của user (override) và user sẽ lại phụ thuộc role.",
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
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có PERMISSIONS.MANAGE.", icon: "error", timer: 3000 });
      } else {
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể thực hiện: ${e?.message || ""}`, icon: "error", timer: 3500 });
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
      (filteredList || []).forEach((p) => {
        if (p?.code) next.add(p.code);
      });
      return next;
    });
  };

  const clearAllFilteredUserPermissions = (filteredList) => {
    setEditingUserPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((p) => {
        if (p?.code) next.delete(p.code);
      });
      return next;
    });
  };

  // =========================
  // Shared helpers
  // =========================

  // So sánh hai Set
  const isSetEqual = (a, b) => {
    const A = a || new Set();
    const B = b || new Set();
    if (A.size !== B.size) return false;
    for (const x of A) if (!B.has(x)) return false;
    return true;
  };

  // Filter permissions theo search (ROLE)
  const filteredPermissionsForRole = useMemo(() => {
    return (rbacPermissions || []).filter((p) => {
      if (!permSearch || !permSearch.trim()) return true;
      const q = permSearch.trim().toLowerCase();
      const hay = `${p?.code || ""} ${p?.name || ""} ${p?.description || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rbacPermissions, permSearch]);

  // Filter permissions theo search (USER)
  const filteredPermissionsForUser = useMemo(() => {
    return (rbacPermissions || []).filter((p) => {
      if (!userPermSearch || !userPermSearch.trim()) return true;
      const q = userPermSearch.trim().toLowerCase();
      const hay = `${p?.code || ""} ${p?.name || ""} ${p?.description || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rbacPermissions, userPermSearch]);

  // ===== Role tab computed =====
  const assignedSet = new Set((assignedPermCodes || []).filter((code) => !SPECIAL_PERMISSIONS.includes(code)));
  const defaultSet = new Set((defaultPermCodes || []).filter((code) => !SPECIAL_PERMISSIONS.includes(code)));
  const dirtyRole = !isSetEqual(editingPermSet, assignedSet);

  const addedVsDefault = Array.from(editingPermSet || new Set())
    .filter((x) => !SPECIAL_PERMISSIONS.includes(x) && !defaultSet.has(x))
    .sort();

  const removedVsDefault = Array.from(defaultSet)
    .filter((x) => !SPECIAL_PERMISSIONS.includes(x) && !(editingPermSet || new Set()).has(x))
    .sort();

  // ===== User tab computed =====
  const userAssignedSet = new Set(userAssignedEffectiveCodes || []);
  const dirtyUser = !isSetEqual(editingUserPermSet, userAssignedSet);

  // =========================
  // Initial load
  // =========================
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

      setRbacRoles(Array.isArray(roles) ? roles : []);
      setRbacPermissions(Array.isArray(perms) ? perms : []);

      // Tự động chọn role đầu tiên
      if (!selectedRoleCode) {
        const firstNonBgh = (Array.isArray(roles) ? roles : []).find((r) => String(r.code).toUpperCase() !== "BGH");
        const first = firstNonBgh || (Array.isArray(roles) ? roles : [])[0];
        if (first?.code) {
          await fetchRolePermissions(String(first.code));
        }
      }
    } catch (e) {
      if (String(e?.message) === "FORBIDDEN") {
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

  // Khi chuyển sang USER tab: nếu chưa chọn user thì auto chọn user đầu tiên
  useEffect(() => {
    if (activeTab !== TAB_USER) return;
    if (!selectedUserId && (allUsers || []).length > 0) {
      const first = allUsers[0];
      if (first?.id != null) {
        const uid = String(first.id);
        setSelectedUserId(uid);
        fetchUserPermissions(uid);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, allUsers]);

  // =========================
  // Render helpers
  // =========================

  const renderRoleTab = () => {
    return (
      <div className="admin-rbac-role-tab">
        <div className="admin-rbac-top">
          <div className="admin-rbac-field">
            <label>Chọn vai trò:</label>
            <select value={selectedRoleCode} onChange={(e) => fetchRolePermissions(e.target.value)} disabled={rbacLoading}>
              {(rbacRoles || []).map((r) => {
                const code = String(r?.code || "");
                const locked = code.toUpperCase() === "BGH";
                return (
                  <option key={r.id || code} value={code}>
                    {code} - {r?.name || ""}
                    {locked ? " (khóa)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="admin-rbac-actions">
            <button
              className="admin-btn-secondary"
              onClick={discardRolePermissionChanges}
              disabled={rbacLoading || rbacSaving || !dirtyRole}
              title="Hoàn tác về trạng thái đang gán"
            >
              Hoàn tác
            </button>
            <button
              className="admin-btn-secondary"
              onClick={resetRolePermissionsToDefault}
              disabled={rbacLoading || rbacSaving || !selectedRoleCode || String(selectedRoleCode).toUpperCase() === "BGH"}
              title="Đặt quyền của role về mặc định"
            >
              Đặt về mặc định
            </button>
            <button
              className="admin-btn-primary"
              onClick={saveRolePermissions}
              disabled={rbacLoading || rbacSaving || !selectedRoleCode || !dirtyRole || String(selectedRoleCode).toUpperCase() === "BGH"}
              title="Lưu thay đổi"
            >
              {rbacSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        <div className="admin-rbac-meta">
          <div>
            <strong>Role:</strong> {selectedRoleCode || "-"} {selectedRoleName ? `(${selectedRoleName})` : ""}
          </div>
          <div>
            <strong>Đang chọn:</strong> {Array.from(editingPermSet || new Set()).length} /{" "}
            {(rbacPermissions || []).filter((p) => !SPECIAL_PERMISSIONS.includes(p?.code)).length} quyền
          </div>
          <div>
            <strong>Trạng thái:</strong>{" "}
            {String(selectedRoleCode).toUpperCase() === "BGH"
              ? "Role BGH bị khóa chỉnh sửa (backend)."
              : dirtyRole
              ? "Có thay đổi chưa lưu."
              : "Không có thay đổi."}
          </div>
        </div>

        <div className="admin-rbac-diff">
          <div>
            <strong>So với mặc định:</strong>{" "}
            {addedVsDefault.length === 0 && removedVsDefault.length === 0 ? "Đang đúng mặc định." : `+${addedVsDefault.length} / -${removedVsDefault.length}`}
          </div>
          {(addedVsDefault.length > 0 || removedVsDefault.length > 0) && (
            <div className="admin-rbac-diff-detail">
              {addedVsDefault.length > 0 && (
                <div>
                  <span className="admin-rbac-diff-title">Được thêm so với mặc định:</span>{" "}
                  <span className="admin-rbac-diff-codes">{addedVsDefault.join(", ")}</span>
                </div>
              )}
              {removedVsDefault.length > 0 && (
                <div>
                  <span className="admin-rbac-diff-title">Bị bỏ so với mặc định:</span>{" "}
                  <span className="admin-rbac-diff-codes">{removedVsDefault.join(", ")}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="admin-rbac-tools">
          <div className="admin-rbac-search">
            <input
              type="text"
              placeholder="Tìm theo code / tên / mô tả quyền..."
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              disabled={rbacLoading}
            />
          </div>

          <div className="admin-rbac-bulk">
            <button
              className="admin-btn-secondary"
              onClick={() => selectAllFilteredRolePermissions(filteredPermissionsForRole)}
              disabled={
                rbacLoading ||
                rbacSaving ||
                !selectedRoleCode ||
                String(selectedRoleCode).toUpperCase() === "BGH" ||
                filteredPermissionsForRole.filter((p) => !SPECIAL_PERMISSIONS.includes(p?.code)).length === 0
              }
              title="Chọn tất cả quyền trong danh sách đang lọc (trừ quyền đặc biệt)"
            >
              Chọn tất cả (lọc)
            </button>
            <button
              className="admin-btn-secondary"
              onClick={() => clearAllFilteredRolePermissions(filteredPermissionsForRole)}
              disabled={
                rbacLoading ||
                rbacSaving ||
                !selectedRoleCode ||
                String(selectedRoleCode).toUpperCase() === "BGH" ||
                filteredPermissionsForRole.filter((p) => !SPECIAL_PERMISSIONS.includes(p?.code)).length === 0
              }
              title="Bỏ chọn tất cả quyền trong danh sách đang lọc"
            >
              Bỏ chọn (lọc)
            </button>
          </div>
        </div>

        <div className="admin-rbac-perm-list">
          {rbacLoading && <div className="admin-no-data">Đang tải dữ liệu phân quyền...</div>}

          {!rbacLoading && filteredPermissionsForRole.length === 0 && <div className="admin-no-data">Không có quyền nào khớp từ khóa tìm kiếm.</div>}

          {!rbacLoading &&
            filteredPermissionsForRole.map((p) => {
              const code = p?.code || "";
              const checked = (editingPermSet || new Set()).has(code);

              const isSpecial = SPECIAL_PERMISSIONS.includes(code);
              const disabled = String(selectedRoleCode).toUpperCase() === "BGH" || rbacSaving || isSpecial;

              return (
                <label key={code} className={`admin-perm-item ${checked ? "admin-perm-checked" : ""} ${isSpecial ? "admin-perm-special" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleRolePermission(code)} />
                  <div className="admin-perm-text">
                    <div className="admin-perm-title">
                      <span className="admin-perm-name">
                        {p?.name || code}
                        {isSpecial && <span className="admin-perm-special-badge"> (Chỉ dành cho BGH)</span>}
                      </span>
                      <span className="admin-perm-code">{code}</span>
                    </div>
                    {p?.description && <div className="admin-perm-desc">{p.description}</div>}
                  </div>
                </label>
              );
            })}
        </div>

        <div className="admin-rbac-footnote">
          <p>
            <strong>Ghi chú:</strong>
          </p>
          <p>
            1. Nếu bạn không muốn phân quyền tùy chỉnh cho role, hãy bấm <strong>Đặt về mặc định</strong>.
          </p>
          <p>
            2. Hai quyền <strong>USERS.MANAGE</strong> và <strong>PERMISSIONS.MANAGE</strong> chỉ dành cho role BGH, không được phép thêm vào các role khác.
          </p>
        </div>
      </div>
    );
  };

  const renderUserTab = () => {
    return (
      <div className="admin-rbac-user-tab">
        <div className="admin-rbac-top">
          <div className="admin-rbac-field">
            <label>Chọn user:</label>
            <select
              value={selectedUserId}
              onChange={async (e) => {
                const uid = e.target.value;
                setSelectedUserId(uid);
                await fetchUserPermissions(uid);
              }}
              disabled={userLoading || userSaving}
            >
              {(allUsers || []).map((u) => (
                <option key={u?.id} value={String(u?.id || "")}>
                  #{u?.id} - {u?.fullName || u?.name || u?.email || "Unknown"} {u?.email ? `(${u.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-rbac-actions">
            <button className="admin-btn-secondary" onClick={discardUserPermissionChanges} disabled={userLoading || userSaving || !dirtyUser} title="Hoàn tác theo quyền đang hiệu lực">
              Hoàn tác
            </button>
            <button className="admin-btn-secondary" onClick={clearUserOverrides} disabled={userLoading || userSaving || !selectedUserId} title="Xóa quyền riêng, quay về theo role">
              Quay về theo role
            </button>
            <button className="admin-btn-primary" onClick={saveUserPermissions} disabled={userLoading || userSaving || !selectedUserId || !dirtyUser} title="Lưu quyền riêng (user đặc biệt)">
              {userSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        <div className="admin-rbac-meta">
          <div>
            <strong>User:</strong>{" "}
            {selectedUserInfo?.fullName || "-"} {selectedUserInfo?.email ? `(${selectedUserInfo.email})` : ""}
          </div>
          <div>
            <strong>Role hiện tại:</strong>{" "}
            {selectedUserInfo?.roleCode ? `${selectedUserInfo.roleCode}${selectedUserInfo.roleName ? ` (${selectedUserInfo.roleName})` : ""}` : "-"}
          </div>
          <div>
            <strong>Chế độ:</strong>{" "}
            {userSpecial ? (
              <span className="rbac-badge-special">User đặc biệt (ignore role)</span>
            ) : (
              <span className="rbac-badge-normal">Theo role</span>
            )}
          </div>
          <div>
            <strong>Đang chọn:</strong> {Array.from(editingUserPermSet || new Set()).length} / {(rbacPermissions || []).length} quyền
          </div>
          <div>
            <strong>Trạng thái:</strong> {dirtyUser ? "Có thay đổi chưa lưu." : "Không có thay đổi."}
          </div>
        </div>

        <div className="admin-rbac-diff">
          <div>
            <strong>Nguyên tắc:</strong> Khi bạn bấm <strong>Lưu thay đổi</strong>, user sẽ được set quyền riêng và có thể thực hiện mọi permission bạn tick, không bị role ảnh hưởng.
          </div>
          {!userSpecial && (
            <div className="admin-rbac-diff-detail">
              <div>
                <span className="admin-rbac-diff-title">Gợi ý:</span>{" "}
                Nếu bạn chỉ muốn “thêm vài quyền”, hãy tick thêm rồi lưu (mặc định danh sách đã nạp theo quyền hiệu lực hiện tại).
              </div>
            </div>
          )}
        </div>

        <div className="admin-rbac-tools">
          <div className="admin-rbac-search">
            <input
              type="text"
              placeholder="Tìm theo code / tên / mô tả quyền..."
              value={userPermSearch}
              onChange={(e) => setUserPermSearch(e.target.value)}
              disabled={userLoading}
            />
          </div>

          <div className="admin-rbac-bulk">
            <button
              className="admin-btn-secondary"
              onClick={() => selectAllFilteredUserPermissions(filteredPermissionsForUser)}
              disabled={userLoading || userSaving || !selectedUserId || filteredPermissionsForUser.length === 0}
              title="Chọn tất cả quyền trong danh sách đang lọc"
            >
              Chọn tất cả (lọc)
            </button>
            <button
              className="admin-btn-secondary"
              onClick={() => clearAllFilteredUserPermissions(filteredPermissionsForUser)}
              disabled={userLoading || userSaving || !selectedUserId || filteredPermissionsForUser.length === 0}
              title="Bỏ chọn tất cả quyền trong danh sách đang lọc"
            >
              Bỏ chọn (lọc)
            </button>
          </div>
        </div>

        <div className="admin-rbac-perm-list">
          {userLoading && <div className="admin-no-data">Đang tải dữ liệu phân quyền theo user...</div>}

          {!userLoading && filteredPermissionsForUser.length === 0 && <div className="admin-no-data">Không có quyền nào khớp từ khóa tìm kiếm.</div>}

          {!userLoading &&
            filteredPermissionsForUser.map((p) => {
              const code = p?.code || "";
              const checked = (editingUserPermSet || new Set()).has(code);

              // USER TAB: không cấm gì hết
              const disabled = userSaving;

              return (
                <label key={code} className={`admin-perm-item ${checked ? "admin-perm-checked" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleUserPermission(code)} />
                  <div className="admin-perm-text">
                    <div className="admin-perm-title">
                      <span className="admin-perm-name">{p?.name || code}</span>
                      <span className="admin-perm-code">{code}</span>
                    </div>
                    {p?.description && <div className="admin-perm-desc">{p.description}</div>}
                  </div>
                </label>
              );
            })}
        </div>

        <div className="admin-rbac-footnote">
          <p>
            <strong>Ghi chú:</strong>
          </p>
          <p>1. Tab này phân quyền trực tiếp theo user. Bạn có thể cấp bất kỳ permission nào.</p>
          <p>2. Sau khi lưu, user sẽ trở thành “user đặc biệt” và không bị ảnh hưởng khi thay đổi quyền của role.</p>
          <p>3. Muốn user quay lại theo role, bấm <strong>Quay về theo role</strong>.</p>

          {/* Debug/hiển thị tham khảo (tuỳ bạn giữ hoặc bỏ) */}
          {(userRolePermCodes?.length > 0 || userGrantedCodes?.length > 0 || userRevokedCodes?.length > 0) && (
            <div className="rbac-user-debug">
              {userRolePermCodes?.length > 0 && (
                <div>
                  <span className="admin-rbac-diff-title">Role perms (tham khảo):</span>{" "}
                  <span className="admin-rbac-diff-codes">{userRolePermCodes.join(", ")}</span>
                </div>
              )}
              {userGrantedCodes?.length > 0 && (
                <div>
                  <span className="admin-rbac-diff-title">User GRANT:</span>{" "}
                  <span className="admin-rbac-diff-codes">{userGrantedCodes.join(", ")}</span>
                </div>
              )}
              {userRevokedCodes?.length > 0 && (
                <div>
                  <span className="admin-rbac-diff-title">User REVOKE:</span>{" "}
                  <span className="admin-rbac-diff-codes">{userRevokedCodes.join(", ")}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================
  // Main render
  // =========================
  return (
    <div className="admin-rbac">
      <div className="rbac-tabs">
        <button className={`rbac-tab ${activeTab === TAB_ROLE ? "active" : ""}`} onClick={() => setActiveTab(TAB_ROLE)} disabled={rbacLoading || rbacSaving || userSaving}>
          Phân quyền theo role
        </button>
        <button className={`rbac-tab ${activeTab === TAB_USER ? "active" : ""}`} onClick={() => setActiveTab(TAB_USER)} disabled={rbacLoading || rbacSaving || userSaving}>
          Phân quyền theo user
        </button>
      </div>

      {activeTab === TAB_ROLE ? renderRoleTab() : renderUserTab()}
    </div>
  );
}
