import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import "./dashboard-ui.css";
import "./Admin.css";

const API_URL = "http://localhost:8080/api";

function visiblePageNumbers(totalPages, currentPage) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(0, Number(currentPage) || 0), total - 1);
  const start = Math.max(0, current - 2);
  const end = Math.min(total - 1, start + 4);
  const adjustedStart = Math.max(0, end - 4);
  const pages = [];
  for (let i = adjustedStart; i <= end; i += 1) pages.push(i);
  return pages;
}

export default function Admin() {
  const PAGE_SIZE = 10;
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [activeTab, setActiveTab] = useState("pending");
  const [adminInfo, setAdminInfo] = useState(null);

  const navigate = useNavigate();

  const availableRoles = [
    { value: "Lãnh đạo", label: "Lãnh đạo" },
    { value: "Thủ kho", label: "Thủ kho" },
    { value: "Cán bộ", label: "Cán bộ khác" },
  ];

  const API_ENDPOINTS = {
    RBAC_PERMISSIONS: `${API_URL}/admin/rbac/permissions`,
    USERS_ALL: `${API_URL}/admin/users/all`,
    USER_APPROVE: (id) => `${API_URL}/admin/users/${id}/approve`,
    USER_DELETE: (id) => `${API_URL}/admin/users/${id}`,
    USER_ROLE: (id) => `${API_URL}/admin/users/${id}/role`,
  };

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
        return null;
      }
    }
    return null;
  };

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const getCurrentUserFromStorage = () => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) return null;
    try {
      return JSON.parse(currentUser);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const checkAdminAccess = async () => {
      const userData = getCurrentUserFromStorage();
      const token = getAuthToken();

      if (!token) {
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
        navigate("/");
        return;
      }

      try {
        const res = await fetch(API_ENDPOINTS.RBAC_PERMISSIONS, {
          headers: { ...authHeaders() },
        });

        if (res.status === 403) throw new Error("FORBIDDEN");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        setIsAuthenticated(true);
        setAdminInfo(userData);
        await fetchUsers();
      } catch {
        if (userData?.isAdmin) {
          setIsAuthenticated(true);
          setAdminInfo(userData);
          await fetchUsers();
        } else {
          setIsAuthenticated(false);
          navigate("/");
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.USERS_ALL, {
        headers: { ...authHeaders() },
      });

      if (response.status === 403) throw new Error("FORBIDDEN");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const filteredData = (Array.isArray(data) ? data : []).filter((user) => !user.isAdmin && !user.isBanGiamHieu);
      setUsers(filteredData);
      filterUsersByStatus(filteredData, activeTab);
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({
          title: "Không có quyền",
          text: "Tài khoản hiện tại không có quyền truy cập chức năng quản trị.",
          icon: "error",
          timer: 3000,
        });
        setIsAuthenticated(false);
        navigate("/");
        return;
      }

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
      setFilteredUsers((userList || []).filter((user) => user.statusValue === 0));
    } else {
      setFilteredUsers((userList || []).filter((user) => user.statusValue === 1));
    }
    setCurrentPage(0);
  };

  useEffect(() => {
    filterUsersByStatus(users, activeTab);
  }, [users, activeTab]);

  const approvedCount = useMemo(() => users.filter((u) => u.statusValue === 1).length, [users]);
  const pendingCount = useMemo(() => users.filter((u) => u.statusValue === 0).length, [users]);
  const totalCount = users.length;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const pagedUsers = filteredUsers.slice(
    safeCurrentPage * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE + PAGE_SIZE
  );


  const approveUser = async (id, roleBeforeApprove = null) => {
    try {
      if (roleBeforeApprove) {
        const roleResponse = await fetch(API_ENDPOINTS.USER_ROLE(id), {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ role: roleBeforeApprove }),
        });

        if (roleResponse.status === 403) throw new Error("FORBIDDEN");
        if (!roleResponse.ok) {
          const errorText = await roleResponse.text();
          throw new Error(errorText || "KhÃ´ng thá»ƒ cáº­p nháº­t quyá»n trÆ°á»›c khi duyá»‡t");
        }
      }

      const response = await fetch(API_ENDPOINTS.USER_APPROVE(id), {
        method: "POST",
        headers: { ...authHeaders() },
      });

      if (response.status === 403) throw new Error("FORBIDDEN");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const user = users.find((u) => u.id === id);
      const nextUsers = users.map((u) => (
        u.id === id
          ? { ...u, role: roleBeforeApprove || u.role, statusValue: 1, status: "Đã duyệt" }
          : u
      ));
      setUsers(nextUsers);
      filterUsersByStatus(nextUsers, activeTab);
      if (editingUser?.id === id) {
        setEditingUser(null);
        setNewRole("");
      }

      Swal.fire({
        title: "✅ Đã duyệt!",
        text: `${user?.fullName || "Người dùng"} đã được cấp quyền truy cập.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có quyền thực hiện thao tác này.", icon: "error", timer: 2500 });
        return;
      }
      Swal.fire({ title: "❌ Lỗi!", text: error?.message || "Không thể duyệt người dùng", icon: "error", timer: 2500 });
    }
  };

  const deleteUser = async (id) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;

    const isPending = user.statusValue === 0;

    const result = await Swal.fire({
      title: isPending ? "⚠️ Xác nhận từ chối & xóa?" : "Xác nhận xóa tài khoản?",
      html: `<div style="text-align:left;line-height:1.7;">
        <p><strong>Họ tên:</strong> ${user.fullName}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Phòng ban:</strong> ${user.department}</p>
        <p><strong>Vai trò:</strong> ${user.role}</p>
      </div>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: isPending ? "Từ chối & Xóa" : "Xóa vĩnh viễn",
      cancelButtonText: "Hủy",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch(API_ENDPOINTS.USER_DELETE(id), {
        method: "DELETE",
        headers: { ...authHeaders() },
      });

      if (response.status === 403) throw new Error("FORBIDDEN");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const nextUsers = users.filter((u) => u.id !== id);
      setUsers(nextUsers);
      filterUsersByStatus(nextUsers, activeTab);
      if (editingUser?.id === id) {
        setEditingUser(null);
        setNewRole("");
      }

      Swal.fire({
        title: isPending ? "❌ Đã từ chối & xóa!" : "✅ Đã xóa!",
        text: isPending
          ? `${user.fullName} đã bị từ chối và xóa khỏi hệ thống.`
          : `Tài khoản "${user.fullName}" đã bị xóa khỏi hệ thống.`,
        icon: isPending ? "error" : "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có quyền thực hiện thao tác này.", icon: "error", timer: 2500 });
        return;
      }
      Swal.fire({ title: "❌ Lỗi!", text: "Không thể xóa người dùng", icon: "error", timer: 2000 });
    }
  };

  const changeUserRole = async (id, roleLabel) => {
    try {
      const response = await fetch(API_ENDPOINTS.USER_ROLE(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role: roleLabel }),
      });

      if (response.status === 403) throw new Error("FORBIDDEN");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Không thể thay đổi quyền");
      }

      const nextUsers = users.map((u) => (u.id === id ? { ...u, role: roleLabel } : u));
      setUsers(nextUsers);
      filterUsersByStatus(nextUsers, activeTab);

      setEditingUser(null);
      setNewRole("");

      Swal.fire({
        title: "✅ Đã cập nhật!",
        html: `<div style="text-align:left;"><p><strong>Quyền mới:</strong> ${roleLabel}</p></div>`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      if (String(error?.message) === "FORBIDDEN") {
        Swal.fire({ title: "Không có quyền", text: "Bạn không có quyền thực hiện thao tác này.", icon: "error", timer: 2500 });
        return;
      }
      Swal.fire({
        title: "❌ Lỗi!",
        text: error?.message || "Không thể thay đổi quyền",
        icon: "error",
        timer: 2500,
      });
    }
  };

  const openRoleChangeModal = (user) => {
    setEditingUser(user);
    setNewRole(user?.role || "");
  };

  const closeRoleChangeModal = () => {
    setEditingUser(null);
    setNewRole("");
  };

  const handleRoleChange = () => {
    if (editingUser && newRole) changeUserRole(editingUser.id, newRole);
  };

  const handleApproveEditingUser = () => {
    if (!editingUser) return;
    const roleBeforeApprove = newRole && newRole !== editingUser.role ? newRole : null;
    approveUser(editingUser.id, roleBeforeApprove);
  };

  if (isCheckingAuth) {
    return (
      <div className="ui-page">
        <div className="ui-page-frame">
          <div className="admin-loading-box">
            <div className="admin-loading-spinner"></div>
            <p>Đang kiểm tra quyền truy cập...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="ui-page admin-page-shell">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Quản lý người dùng</h1>
          </div>
          <div className="admin-page-meta">
            <div className="admin-page-user">{adminInfo?.fullName || "Quản trị viên"}</div>
          </div>
        </div>

        <div className="ui-stat-grid">
          <div className="ui-stat-card is-primary">
            <p className="ui-stat-label">Tổng tài khoản</p>
            <p className="ui-stat-value">{totalCount}</p>
            <p className="ui-stat-note">Toàn bộ người dùng đang quản lý</p>
          </div>
          <div className="ui-stat-card is-warning">
            <p className="ui-stat-label">Chờ duyệt</p>
            <p className="ui-stat-value">{pendingCount}</p>
            <p className="ui-stat-note">Cần kiểm tra và phê duyệt</p>
          </div>
          <div className="ui-stat-card">
            <p className="ui-stat-label">Đã duyệt</p>
            <p className="ui-stat-value">{approvedCount}</p>
            <p className="ui-stat-note">Đã có quyền truy cập hệ thống</p>
          </div>
        </div>

        <section className="ui-section admin-table-section">
            <div className="ui-section-head">
              <div>
                <h2 className="ui-section-title">Danh sách tài khoản</h2>
              </div>
              <div className="admin-count-chip">{filteredUsers.length} tài khoản</div>
            </div>

            <div className="ui-tabs">
              <button
                className={`ui-tab ${activeTab === "pending" ? "is-active" : ""}`}
                onClick={() => {
                  setActiveTab("pending");
                  setCurrentPage(0);
                }}
                type="button"
              >
                Chờ duyệt ({pendingCount})
              </button>
              <button
                className={`ui-tab ${activeTab === "approved" ? "is-active" : ""}`}
                onClick={() => {
                  setActiveTab("approved");
                  setCurrentPage(0);
                }}
                type="button"
              >
                Đã duyệt ({approvedCount})
              </button>
            </div>

            <div className="ui-table-wrap admin-table-wrap">
              <table className="ui-table admin-user-table">
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
                  {pagedUsers.length > 0 ? (
                    pagedUsers.map((u) => (
                      <tr key={u.id}>
                        <td data-label="Họ tên">
                          <div className="admin-cell-main">{u.fullName}</div>
                        </td>
                        <td data-label="Email">{u.email}</td>
                        <td data-label="Phòng ban">{u.department}</td>
                        <td data-label="Vai trò">{u.role}</td>
                        <td data-label="Trạng thái">
                          <span className={`ui-status-badge ${u.statusValue === 1 ? "is-approved" : "is-pending"}`}>
                            {u.statusValue === 1 ? "Đã duyệt" : "Chờ duyệt"}
                          </span>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              className="ui-btn ui-btn-secondary ui-btn-sm"
                              onClick={() => openRoleChangeModal(u)}
                              title="Thay đổi quyền"
                              type="button"
                            >
                              Xem
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="ui-empty">
                        {activeTab === "pending"
                          ? "Không có tài khoản nào đang chờ duyệt"
                          : "Không có tài khoản nào đã được duyệt"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredUsers.length > 0 ? (
              <div className="ui-pagination" aria-label="Phân trang danh sách tài khoản">
                <button
                  type="button"
                  className="ui-pagination-btn"
                  onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                  disabled={safeCurrentPage <= 0}
                >
                  Trang trước
                </button>

                {visiblePageNumbers(totalPages, safeCurrentPage).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`ui-pagination-btn ${page === safeCurrentPage ? "is-active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                    disabled={page === safeCurrentPage}
                  >
                    {page + 1}
                  </button>
                ))}

                <button
                  type="button"
                  className="ui-pagination-btn"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
                  disabled={safeCurrentPage >= totalPages - 1}
                >
                  Trang sau
                </button>
              </div>
            ) : null}
        </section>
      </div>

      {editingUser && (
        <div className="ui-modal-overlay admin-modal-overlay" onMouseDown={closeRoleChangeModal}>
          <div className="ui-modal admin-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="ui-modal-header admin-modal-header">
              <div>
                <h3>Chi tiết tài khoản</h3>
                <p>Xem thông tin, điều chỉnh vai trò và xử lý trạng thái tài khoản.</p>
              </div>
              <span className={`ui-status-badge ${editingUser.statusValue === 1 ? "is-approved" : "is-pending"}`}>
                {editingUser.statusValue === 1 ? "Đã duyệt" : "Chờ duyệt"}
              </span>
            </div>

            <div className="ui-modal-body admin-modal-content">
              <div className="admin-modal-grid">
                <div className="admin-info-box">
                  <div className="admin-info-label">Họ tên</div>
                  <div className="admin-info-value">{editingUser.fullName}</div>
                </div>
                <div className="admin-info-box">
                  <div className="admin-info-label">Email</div>
                  <div className="admin-info-value">{editingUser.email}</div>
                </div>
                <div className="admin-info-box">
                  <div className="admin-info-label">Phòng ban</div>
                  <div className="admin-info-value">{editingUser.department}</div>
                </div>
                <div className="admin-info-box">
                  <div className="admin-info-label">Vai trò hiện tại</div>
                  <div className="admin-info-value">{editingUser.role}</div>
                </div>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="role-select">
                  Chọn quyền mới
                </label>
                <select
                  id="role-select"
                  className="ui-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {availableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ui-modal-footer admin-modal-footer">
              <div className="admin-modal-danger-actions">
                {editingUser.statusValue === 0 ? (
                  <>
                    <button className="ui-btn ui-btn-danger" onClick={() => deleteUser(editingUser.id)} type="button">
                      Từ chối
                    </button>
                    <button className="ui-btn ui-btn-primary" onClick={handleApproveEditingUser} type="button">
                      Duyệt
                    </button>
                  </>
                ) : (
                  <button className="ui-btn ui-btn-danger" onClick={() => deleteUser(editingUser.id)} type="button">
                    Xóa
                  </button>
                )}
              </div>
              {editingUser.statusValue === 1 && (
                <button
                  className="ui-btn ui-btn-primary"
                  onClick={handleRoleChange}
                  type="button"
                  disabled={!newRole || newRole === editingUser.role}
                >
                  Cập nhật quyền
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
