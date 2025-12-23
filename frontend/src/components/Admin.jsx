import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import "./Admin.css";

const API_URL = "http://localhost:8080/api";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ====== NEW: main section tabs ======
  const [activeSection, setActiveSection] = useState("users"); // "users" | "rbac"
  const [activeTab, setActiveTab] = useState("pending"); // giữ nguyên: "pending" | "approved"

  const [adminInfo, setAdminInfo] = useState(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const navigate = useNavigate();

  const availableRoles = [
    { value: "Lãnh đạo", label: "Lãnh đạo" },
    { value: "Thủ kho", label: "Thủ kho" },
    { value: "Cán bộ", label: "Cán bộ khác" },
  ];

  const API_ENDPOINTS = {
    USERS_ALL: `${API_URL}/admin/users/all`,
    USER_APPROVE: (id) => `${API_URL}/admin/users/${id}/approve`,
    USER_DELETE: (id) => `${API_URL}/admin/users/${id}`,
    USER_ROLE: (id) => `${API_URL}/admin/users/${id}/role`,

    // ====== NEW: RBAC endpoints ======
    RBAC_ROLES: `${API_URL}/admin/rbac/roles`,
    RBAC_PERMISSIONS: `${API_URL}/admin/rbac/permissions`,
    RBAC_ROLE_PERMS: (roleCode) => `${API_URL}/admin/rbac/roles/${roleCode}/permissions`,
    RBAC_ROLE_PERMS_REPLACE: (roleCode) => `${API_URL}/admin/rbac/roles/${roleCode}/permissions`,
    RBAC_ROLE_PERMS_RESET: (roleCode) => `${API_URL}/admin/rbac/roles/${roleCode}/permissions/reset`,
  };

  // ====== NEW: RBAC state ======
  const [rbacRoles, setRbacRoles] = useState([]);
  const [rbacPermissions, setRbacPermissions] = useState([]);
  const [rbacLoading, setRbacLoading] = useState(false);

  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [selectedRoleName, setSelectedRoleName] = useState("");

  const [assignedPermCodes, setAssignedPermCodes] = useState([]); // từ server
  const [defaultPermCodes, setDefaultPermCodes] = useState([]); // từ server
  const [editingPermSet, setEditingPermSet] = useState(new Set()); // user đang tick

  const [permSearch, setPermSearch] = useState("");
  const [rbacSaving, setRbacSaving] = useState(false);

  // ===== Auth token helper (robust) =====
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

    // fallback: nếu adminInfo đã có id
    if (adminInfo?.id != null) return `user-token-${adminInfo.id}`;

    return null;
  };

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const checkAdminAccess = () => {
      const adminJustLoggedIn = sessionStorage.getItem("adminJustLoggedIn") === "true";
      const currentUser = localStorage.getItem("currentUser");
      let userData = null;

      if (currentUser) {
        try {
          userData = JSON.parse(currentUser);
        } catch (error) {
          // ignore
        }
      }

      if (adminJustLoggedIn || (userData && userData.isBanGiamHieu)) {
        if (adminJustLoggedIn) {
          sessionStorage.removeItem("adminJustLoggedIn");
        }
        setIsAuthenticated(true);
        setAdminInfo(userData);
        fetchUsers();
      } else {
        navigate("/");
      }
      setIsCheckingAuth(false);
    };

    const timer = setTimeout(checkAdminAccess, 50);
    return () => clearTimeout(timer);
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.USERS_ALL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      const filteredData = data.filter((user) => !user.isBanGiamHieu);
      setUsers(filteredData);
      filterUsersByStatus(filteredData, activeTab);
    } catch (error) {
      Swal.fire({
        title: "Lỗi!",
        text: "Không thể tải danh sách người dùng",
        icon: "error",
        timer: 3000,
      });
    }
  };

  const filterUsersByStatus = (userList, status) => {
    if (status === "pending") {
      setFilteredUsers(userList.filter((user) => user.statusValue === 0));
    } else {
      setFilteredUsers(userList.filter((user) => user.statusValue === 1));
    }
  };

  useEffect(() => {
    filterUsersByStatus(users, activeTab);
  }, [users, activeTab]);

  useEffect(() => {
    if (isAuthenticated && users.length > 0) updateChart();
  }, [users, isAuthenticated]);

  const updateChart = () => {
    const ctx = chartRef.current?.getContext("2d");
    if (!ctx) return;

    const approved = users.filter((u) => u.statusValue === 1).length;
    const pending = users.filter((u) => u.statusValue === 0).length;

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Đã duyệt", "Chờ duyệt"],
        datasets: [
          {
            data: [approved, pending],
            backgroundColor: ["#10B981", "#FACC15"],
            borderColor: "#fff",
            borderWidth: 3,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 20, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const label = ctx.label || "";
                const value = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const perc = total ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value} tài khoản (${perc}%)`;
              },
            },
          },
        },
        cutout: "60%",
      },
    });
  };

  const handleLogout = () => {
    Swal.fire({
      title: "Đăng xuất?",
      text: "Bạn có chắc muốn đăng xuất khỏi trang quản trị?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Đăng xuất",
      cancelButtonText: "Ở lại",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem("currentUser");
        sessionStorage.removeItem("adminJustLoggedIn");
        const cookiesToDelete = ["rememberedEmail", "rememberedPassword", "rememberMe"];
        cookiesToDelete.forEach((cookieName) => {
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
        navigate("/");
      }
    });
  };

  const approveUser = async (id) => {
    try {
      const response = await fetch(API_ENDPOINTS.USER_APPROVE(id), { method: "POST" });
      if (response.ok) {
        const user = users.find((u) => u.id === id);
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, statusValue: 1, status: "Đã duyệt" } : u))
        );
        filterUsersByStatus(
          users.map((u) => (u.id === id ? { ...u, statusValue: 1, status: "Đã duyệt" } : u)),
          activeTab
        );
        Swal.fire({
          title: "✅ Đã duyệt!",
          text: `${user.fullName} đã được cấp quyền truy cập.`,
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      Swal.fire({ title: "❌ Lỗi!", text: "Không thể duyệt người dùng", icon: "error", timer: 2000 });
    }
  };

  const deleteUser = async (id) => {
    const user = users.find((u) => u.id === id);
    const isPending = user.statusValue === 0;

    Swal.fire({
      title: isPending ? "⚠️ Xác nhận từ chối & xóa?" : "Xác nhận xóa tài khoản?",
      html: `<div style="text-align: left;">
        <p><strong>Họ tên:</strong> ${user.fullName}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Phòng ban:</strong> ${user.department}</p>
        <p><strong>Vai trò:</strong> ${user.role}</p>
        <p><strong>Trạng thái:</strong> ${isPending ? "Chờ duyệt" : "Đã duyệt"}</p>
      </div><p style="color: #ef4444; margin-top: 15px;">
        ${
          isPending
            ? "⚠️ Tài khoản sẽ bị từ chối và xóa khỏi hệ thống. Hành động này không thể hoàn tác!"
            : '⚠️ Tài khoản sẽ bị xóa vĩnh viễn khỏi hệ thống. Hành động này không thể hoàn tác!'
        }
      </p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: isPending ? "Từ chối & Xóa" : "Xóa vĩnh viễn",
      cancelButtonText: "Hủy",
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(API_ENDPOINTS.USER_DELETE(id), { method: "DELETE" });
          if (response.ok) {
            setUsers((prev) => prev.filter((u) => u.id !== id));
            filterUsersByStatus(users.filter((u) => u.id !== id), activeTab);
            Swal.fire({
              title: isPending ? "❌ Đã từ chối & xóa!" : "✅ Đã xóa!",
              text: isPending
                ? `${user.fullName} đã bị từ chối và xóa khỏi hệ thống.`
                : `Tài khoản "${user.fullName}" đã bị xóa khỏi hệ thống.`,
              icon: isPending ? "error" : "success",
              timer: 2000,
              showConfirmButton: false,
            });
          }
        } catch (error) {
          Swal.fire({ title: "❌ Lỗi!", text: "Không thể xóa người dùng", icon: "error", timer: 2000 });
        }
      }
    });
  };

  const changeUserRole = async (id, newRole) => {
    try {
      const response = await fetch(API_ENDPOINTS.USER_ROLE(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
        filterUsersByStatus(users.map((u) => (u.id === id ? { ...u, role: newRole } : u)), activeTab);
        setEditingUser(null);
        setNewRole("");
        Swal.fire({
          title: "✅ Đã cập nhật!",
          html: `<div style="text-align: left;"><p><strong>Quyền mới:</strong> ${newRole}</p></div>`,
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        const errorText = await response.text();
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể thay đổi quyền: ${errorText}`, icon: "error", timer: 3000 });
      }
    } catch (error) {
      Swal.fire({ title: "❌ Lỗi kết nối!", text: "Không thể kết nối đến server", icon: "error", timer: 3000 });
    }
  };

  const openRoleChangeModal = (user) => {
    setEditingUser(user);
    setNewRole(user.role);
  };

  const closeRoleChangeModal = () => {
    setEditingUser(null);
    setNewRole("");
  };

  const handleRoleChange = () => {
    if (editingUser && newRole) changeUserRole(editingUser.id, newRole);
  };

  // =========================
  // NEW: RBAC tab functions
  // =========================
  const setFromRolePermissionsResponse = (resp) => {
    const roleCode = resp?.roleCode || "";
    const roleName = resp?.roleName || "";

    const assigned = Array.isArray(resp?.assignedPermissionCodes) ? resp.assignedPermissionCodes : [];
    const defaults = Array.isArray(resp?.defaultPermissionCodes) ? resp.defaultPermissionCodes : [];

    setSelectedRoleCode(roleCode);
    setSelectedRoleName(roleName);
    setAssignedPermCodes(assigned);
    setDefaultPermCodes(defaults);
    setEditingPermSet(new Set(assigned));
  };

  const fetchRbacCatalog = async () => {
    setRbacLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch(API_ENDPOINTS.RBAC_ROLES, { headers: { ...authHeaders() } }),
        fetch(API_ENDPOINTS.RBAC_PERMISSIONS, { headers: { ...authHeaders() } }),
      ]);

      if (rolesRes.status === 403 || permsRes.status === 403) {
        throw new Error("FORBIDDEN");
      }
      if (!rolesRes.ok) throw new Error(`roles: HTTP ${rolesRes.status}`);
      if (!permsRes.ok) throw new Error(`permissions: HTTP ${permsRes.status}`);

      const roles = await rolesRes.json();
      const perms = await permsRes.json();

      setRbacRoles(Array.isArray(roles) ? roles : []);
      setRbacPermissions(Array.isArray(perms) ? perms : []);

      // auto chọn role đầu tiên (ưu tiên role không phải BGH để tiện thao tác)
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

  const saveRolePermissions = async () => {
    if (!selectedRoleCode) return;

    const roleCodeUpper = String(selectedRoleCode).toUpperCase();
    if (roleCodeUpper === "BGH") {
      Swal.fire({ title: "Không hợp lệ", text: "Backend đã khóa chỉnh role BGH.", icon: "warning", timer: 2500 });
      return;
    }

    setRbacSaving(true);
    try {
      const body = { permissionCodes: Array.from(editingPermSet || new Set()) };

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

  const discardRolePermissionChanges = () => {
    setEditingPermSet(new Set(assignedPermCodes || []));
  };

  const togglePermission = (code) => {
    if (!code) return;
    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAllFilteredPermissions = (filteredList) => {
    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((p) => {
        if (p?.code) next.add(p.code);
      });
      return next;
    });
  };

  const clearAllFilteredPermissions = (filteredList) => {
    setEditingPermSet((prev) => {
      const next = new Set(prev || []);
      (filteredList || []).forEach((p) => {
        if (p?.code) next.delete(p.code);
      });
      return next;
    });
  };

  const isSetEqual = (a, b) => {
    const A = a || new Set();
    const B = b || new Set();
    if (A.size !== B.size) return false;
    for (const x of A) if (!B.has(x)) return false;
    return true;
  };

  const assignedSet = new Set(assignedPermCodes || []);
  const defaultSet = new Set(defaultPermCodes || []);
  const dirty = !isSetEqual(editingPermSet, assignedSet);

  const addedVsDefault = Array.from(editingPermSet || new Set()).filter((x) => !defaultSet.has(x)).sort();
  const removedVsDefault = Array.from(defaultSet).filter((x) => !(editingPermSet || new Set()).has(x)).sort();

  const filteredPermissions = (rbacPermissions || []).filter((p) => {
    if (!permSearch || !permSearch.trim()) return true;
    const q = permSearch.trim().toLowerCase();
    const hay = `${p?.code || ""} ${p?.name || ""} ${p?.description || ""}`.toLowerCase();
    return hay.includes(q);
  });

  // auto load RBAC catalog when switch to RBAC tab
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeSection === "rbac") {
      fetchRbacCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, isAuthenticated]);

  if (isCheckingAuth) {
    return (
      <div className="admin-page">
        <div className="admin-auth-wrapper">
          <div className="admin-auto-login-loading">
            <div className="admin-loading-spinner"></div>
            <p>Đang kiểm tra quyền truy cập...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-title">
          <h1>Bảng điều khiển cho Ban giám hiệu</h1>
          <p>
            {adminInfo ? (
              <>
                Xin chào <strong>{adminInfo.fullName}</strong> - {adminInfo.role}
              </>
            ) : (
              "Duyệt & quản lý tài khoản"
            )}
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-logout-btn" onClick={handleLogout} title="Đăng xuất khỏi trang admin">
            <span className="admin-logout-text">Đăng xuất</span>
          </button>
        </div>
      </header>

      <div className="admin-container">
        <div className="admin-grid-layout">
          <div className="admin-chart-card admin-card">
            <h3>Thống kê trạng thái tài khoản</h3>
            <div className="admin-chart-wrap">
              <canvas ref={chartRef} width="400" height="400" style={{ maxWidth: "100%", height: "auto" }}></canvas>
            </div>
          </div>

          <div className="admin-user-list admin-card">
            <div className="admin-card-header">
              <h3>Quản trị hệ thống</h3>
              <div className="admin-user-count-badge">
                {activeSection === "users" ? (
                  <>
                    <span className="admin-count-number">{filteredUsers.length}</span>
                    <span className="admin-count-text">tài khoản</span>
                  </>
                ) : (
                  <>
                    <span className="admin-count-number">{rbacRoles.length}</span>
                    <span className="admin-count-text">roles</span>
                  </>
                )}
              </div>
            </div>

            {/* ===== NEW: Main section tabs ===== */}
            <div className="admin-tabs">
              <button
                className={`admin-tab ${activeSection === "users" ? "admin-tab-active" : ""}`}
                onClick={() => setActiveSection("users")}
              >
                Quản lý tài khoản
              </button>
              <button
                className={`admin-tab ${activeSection === "rbac" ? "admin-tab-active" : ""}`}
                onClick={() => setActiveSection("rbac")}
              >
                Phân quyền vai trò
              </button>
            </div>

            {/* ===== USERS section (giữ nguyên) ===== */}
            {activeSection === "users" && (
              <>
                <div className="admin-tabs" style={{ marginTop: 10 }}>
                  <button
                    className={`admin-tab ${activeTab === "pending" ? "admin-tab-active" : ""}`}
                    onClick={() => setActiveTab("pending")}
                  >
                    Tài khoản chờ duyệt ({users.filter((u) => u.statusValue === 0).length})
                  </button>
                  <button
                    className={`admin-tab ${activeTab === "approved" ? "admin-tab-active" : ""}`}
                    onClick={() => setActiveTab("approved")}
                  >
                    Tài khoản đã duyệt ({users.filter((u) => u.statusValue === 1).length})
                  </button>
                </div>

                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Họ tên</th>
                        <th>Email</th>
                        <th>Phòng ban</th>
                        <th>Vai trò</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u, index) => (
                        <tr
                          key={u.id}
                          className={`${u.statusValue === 1 ? "admin-approved" : ""} ${
                            index === filteredUsers.length - 1 ? "admin-last-row" : ""
                          }`}
                        >
                          <td>{u.fullName}</td>
                          <td>{u.email}</td>
                          <td>{u.department}</td>
                          <td>
                            <div className="admin-role-cell">
                              <span>{u.role}</span>
                              <button className="admin-edit-role-btn" onClick={() => openRoleChangeModal(u)} title="Thay đổi quyền">
                                ✏️
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className={`admin-status-badge admin-${u.statusValue === 1 ? "approved" : "pending"}`}>
                              {u.statusValue === 1 ? "Đã duyệt" : "Chờ duyệt"}
                            </span>
                          </td>
                          <td>
                            <div className="admin-actions">
                              {u.statusValue === 0 && (
                                <button className="admin-approve-btn" onClick={() => approveUser(u.id)}>
                                  Duyệt
                                </button>
                              )}
                              <button className="admin-delete-btn" onClick={() => deleteUser(u.id)} title="Xóa tài khoản khỏi hệ thống">
                                {u.statusValue === 0 ? "Từ chối" : "Xóa"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr className="admin-last-row">
                          <td colSpan="6" className="admin-no-data">
                            {activeTab === "pending" ? "Không có tài khoản nào đang chờ duyệt" : "Không có tài khoản nào đã được duyệt"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ===== NEW: RBAC section ===== */}
            {activeSection === "rbac" && (
              <div className="admin-rbac">
                <div className="admin-rbac-top">
                  <div className="admin-rbac-field">
                    <label>Chọn vai trò:</label>
                    <select
                      value={selectedRoleCode}
                      onChange={(e) => fetchRolePermissions(e.target.value)}
                      disabled={rbacLoading}
                    >
                      {(rbacRoles || []).map((r) => {
                        const code = String(r?.code || "");
                        const locked = code.toUpperCase() === "BGH";
                        return (
                          <option key={r.id || code} value={code}>
                            {code} - {r?.name || ""}{locked ? " (khóa)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="admin-rbac-actions">
                    <button
                      className="admin-btn-secondary"
                      onClick={discardRolePermissionChanges}
                      disabled={rbacLoading || rbacSaving || !dirty}
                      title="Hoàn tác về trạng thái đang gán"
                    >
                      Hoàn tác
                    </button>
                    <button
                      className="admin-btn-secondary"
                      onClick={resetRolePermissionsToDefault}
                      disabled={
                        rbacLoading ||
                        rbacSaving ||
                        !selectedRoleCode ||
                        String(selectedRoleCode).toUpperCase() === "BGH"
                      }
                      title="Đặt quyền của role về mặc định"
                    >
                      Đặt về mặc định
                    </button>
                    <button
                      className="admin-btn-primary"
                      onClick={saveRolePermissions}
                      disabled={
                        rbacLoading ||
                        rbacSaving ||
                        !selectedRoleCode ||
                        !dirty ||
                        String(selectedRoleCode).toUpperCase() === "BGH"
                      }
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
                    <strong>Đang chọn:</strong> {Array.from(editingPermSet || new Set()).length} / {rbacPermissions.length} quyền
                  </div>
                  <div>
                    <strong>Trạng thái:</strong>{" "}
                    {String(selectedRoleCode).toUpperCase() === "BGH"
                      ? "Role BGH bị khóa chỉnh sửa (backend)."
                      : dirty
                      ? "Có thay đổi chưa lưu."
                      : "Không có thay đổi."}
                  </div>
                </div>

                <div className="admin-rbac-diff">
                  <div>
                    <strong>So với mặc định:</strong>{" "}
                    {addedVsDefault.length === 0 && removedVsDefault.length === 0
                      ? "Đang đúng mặc định."
                      : `+${addedVsDefault.length} / -${removedVsDefault.length}`}
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
                      onClick={() => selectAllFilteredPermissions(filteredPermissions)}
                      disabled={
                        rbacLoading ||
                        rbacSaving ||
                        !selectedRoleCode ||
                        String(selectedRoleCode).toUpperCase() === "BGH" ||
                        filteredPermissions.length === 0
                      }
                      title="Chọn tất cả quyền trong danh sách đang lọc"
                    >
                      Chọn tất cả (lọc)
                    </button>
                    <button
                      className="admin-btn-secondary"
                      onClick={() => clearAllFilteredPermissions(filteredPermissions)}
                      disabled={
                        rbacLoading ||
                        rbacSaving ||
                        !selectedRoleCode ||
                        String(selectedRoleCode).toUpperCase() === "BGH" ||
                        filteredPermissions.length === 0
                      }
                      title="Bỏ chọn tất cả quyền trong danh sách đang lọc"
                    >
                      Bỏ chọn (lọc)
                    </button>
                  </div>
                </div>

                <div className="admin-rbac-perm-list">
                  {rbacLoading && <div className="admin-no-data">Đang tải dữ liệu phân quyền...</div>}

                  {!rbacLoading && filteredPermissions.length === 0 && (
                    <div className="admin-no-data">Không có quyền nào khớp từ khóa tìm kiếm.</div>
                  )}

                  {!rbacLoading &&
                    filteredPermissions.map((p) => {
                      const code = p?.code || "";
                      const checked = (editingPermSet || new Set()).has(code);
                      const disabled = String(selectedRoleCode).toUpperCase() === "BGH" || rbacSaving;

                      return (
                        <label key={code} className={`admin-perm-item ${checked ? "admin-perm-checked" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => togglePermission(code)}
                          />
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
                  Ghi chú: Nếu bạn không muốn phân quyền tùy chỉnh cho role, hãy bấm <strong>Đặt về mặc định</strong>.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Thay đổi quyền người dùng</h3>
              <div className="admin-user-status-info">
                <span className={`admin-status-badge admin-${editingUser.statusValue === 1 ? "approved" : "pending"}`}>
                  {editingUser.statusValue === 1 ? "Đã duyệt" : "Chờ duyệt"}
                </span>
              </div>
            </div>
            <div className="admin-modal-content">
              <div className="admin-user-info">
                <p>
                  <strong>Họ tên:</strong> {editingUser.fullName}
                </p>
                <p>
                  <strong>Email:</strong> {editingUser.email}
                </p>
                <p>
                  <strong>Phòng ban:</strong> {editingUser.department}
                </p>
                <p>
                  <strong>Quyền hiện tại:</strong> {editingUser.role}
                </p>
                <p>
                  <strong>Trạng thái:</strong>{" "}
                  <span className={`admin-status-badge admin-${editingUser.statusValue === 1 ? "approved" : "pending"}`}>
                    {editingUser.statusValue === 1 ? "Đã duyệt" : "Chờ duyệt"}
                  </span>
                </p>
              </div>

              <div className="admin-role-selection">
                <label htmlFor="role-select">Chọn quyền mới:</label>
                <select id="role-select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {availableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn-secondary" onClick={closeRoleChangeModal}>
                Hủy
              </button>
              <button className="admin-btn-primary" onClick={handleRoleChange} disabled={!newRole || newRole === editingUser.role}>
                Cập nhật quyền
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
