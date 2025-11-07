import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import "./Admin.css";

const API_URL = 'http://localhost:8080/api';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const navigate = useNavigate();

  const availableRoles = [
    { value: "lanhdao", label: "Lãnh đạo" },
    { value: "thukho", label: "Thủ kho" },
    { value: "canbo", label: "Cán bộ khác" }
  ];

  // Role mapping để hiển thị tiếng Việt
  const roleDisplayMapping = {
    "lanhdao": "Lãnh đạo",
    "thukho": "Thủ kho", 
    "canbo": "Cán bộ"
  };

  // API endpoints - sử dụng biến API_URL
  const API_ENDPOINTS = {
    USERS_ALL: `${API_URL}/admin/users/all`,
    USER_APPROVE: (id) => `${API_URL}/admin/users/${id}/approve`,
    USER_DELETE: (id) => `${API_URL}/admin/users/${id}`,
    USER_ROLE: (id) => `${API_URL}/admin/users/${id}/role`
  };

  useEffect(() => {
    const checkAdminAccess = () => {
      const adminJustLoggedIn = sessionStorage.getItem('adminJustLoggedIn') === 'true';
      const currentUser = localStorage.getItem('currentUser');
      let userData = null;
      
      if (currentUser) {
        try {
          userData = JSON.parse(currentUser);
        } catch (error) {
          console.error("Error parsing user data:", error);
        }
      }

      if (adminJustLoggedIn || (userData && userData.email === "admin")) {
        if (adminJustLoggedIn) {
          sessionStorage.removeItem('adminJustLoggedIn');
        }
        setIsAuthenticated(true);
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
      setUsers(data);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách người dùng:", error);
      Swal.fire({
        title: "Lỗi!",
        text: "Không thể tải danh sách người dùng",
        icon: "error",
        timer: 3000,
      });
    }
  };

  useEffect(() => {
    if (isAuthenticated && users.length > 0) updateChart();
  }, [users, isAuthenticated]);

  const updateChart = () => {
    const ctx = chartRef.current?.getContext("2d");
    if (!ctx) return;

    const approved = users.filter((u) => u.status === "approved").length;
    const pending = users.filter((u) => u.status === "pending").length;

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Đã duyệt", "Chờ duyệt"],
        datasets: [{
          data: [approved, pending],
          backgroundColor: ["#10B981", "#FACC15"],
          borderColor: "#fff",
          borderWidth: 3,
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: "bottom",
            labels: { padding: 20, usePointStyle: true }
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
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('adminJustLoggedIn');
        const cookiesToDelete = ["rememberedEmail", "rememberedPassword", "rememberMe", "rememberedAdmin", "rememberedAdminPassword", "rememberAdmin"];
        cookiesToDelete.forEach(cookieName => {
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
        navigate("/");
      }
    });
  };

  const approveUser = async (id) => {
    try {
      const response = await fetch(API_ENDPOINTS.USER_APPROVE(id), { method: 'POST' });
      if (response.ok) {
        const user = users.find((u) => u.id === id);
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "approved" } : u)));
        Swal.fire({ title: "✅ Đã duyệt!", text: `${user.fullName} đã được cấp quyền truy cập.`, icon: "success", timer: 2000, showConfirmButton: false });
      }
    } catch (error) {
      console.error("Lỗi khi duyệt người dùng:", error);
      Swal.fire({ title: "❌ Lỗi!", text: "Không thể duyệt người dùng", icon: "error", timer: 2000 });
    }
  };

  const deleteUser = async (id) => {
    const user = users.find((u) => u.id === id);
    const isPending = user.status === "pending";
    
    Swal.fire({
      title: isPending ? "⚠️ Xác nhận từ chối & xóa?" : "Xác nhận xóa tài khoản?",
      html: `<div style="text-align: left;">
        <p><strong>Họ tên:</strong> ${user.fullName}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Phòng ban:</strong> ${user.department}</p>
        <p><strong>Vai trò:</strong> ${roleDisplayMapping[user.role] || user.role}</p>
        <p><strong>Trạng thái:</strong> ${isPending ? 'Chờ duyệt' : 'Đã duyệt'}</p>
      </div><p style="color: #ef4444; margin-top: 15px;">
        ${isPending 
          ? '⚠️ Tài khoản sẽ bị từ chối và xóa khỏi hệ thống. Hành động này không thể hoàn tác!' 
          : '⚠️ Tài khoản sẽ bị xóa vĩnh viễn khỏi hệ thống. Hành động này không thể hoàn tác!'}
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
          const response = await fetch(API_ENDPOINTS.USER_DELETE(id), { method: 'DELETE' });
          if (response.ok) {
            setUsers((prev) => prev.filter((u) => u.id !== id));
            Swal.fire({ 
              title: isPending ? "❌ Đã từ chối & xóa!" : "✅ Đã xóa!", 
              text: isPending 
                ? `${user.fullName} đã bị từ chối và xóa khỏi hệ thống.` 
                : `Tài khoản "${user.fullName}" đã bị xóa khỏi hệ thống.`, 
              icon: isPending ? "error" : "success", 
              timer: 2000, 
              showConfirmButton: false 
            });
          }
        } catch (error) {
          console.error("Lỗi khi xóa người dùng:", error);
          Swal.fire({ title: "❌ Lỗi!", text: "Không thể xóa người dùng", icon: "error", timer: 2000 });
        }
      }
    });
  };

  const changeUserRole = async (id, newRole) => {
    try {
      const response = await fetch(API_ENDPOINTS.USER_ROLE(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (response.ok) {
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u));
        setEditingUser(null);
        setNewRole("");
        Swal.fire({
          title: "✅ Đã cập nhật!",
          html: `<div style="text-align: left;"><p><strong>Quyền mới:</strong> ${roleDisplayMapping[newRole] || newRole}</p></div>`,
          icon: "success", 
          timer: 2000, 
          showConfirmButton: false
        });
      } else {
        const errorText = await response.text();
        Swal.fire({ title: "❌ Lỗi!", text: `Không thể thay đổi quyền: ${errorText}`, icon: "error", timer: 3000 });
      }
    } catch (error) {
      console.error("Lỗi khi thay đổi quyền:", error);
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
          <h1>Bảng điều khiển Admin</h1>
          <p>Duyệt & quản lý tài khoản đăng ký hệ thống</p>
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
              <canvas ref={chartRef} width="400" height="400" style={{ maxWidth: '100%', height: 'auto' }}></canvas>
            </div>
          </div>

          <div className="admin-user-list admin-card">
            <div className="admin-card-header">
              <h3>Danh sách tài khoản hệ thống</h3>
              <div className="admin-user-count-badge">
                <span className="admin-count-number">{users.length}</span>
                <span className="admin-count-text">tài khoản</span>
              </div>
            </div>
            <div className="admin-table-container">
              <table>
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
                  {users.map((u) => (
                    <tr key={u.id} className={u.status === "approved" ? "admin-approved" : ""}>
                      <td>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td>{u.department}</td>
                      <td>
                        {roleDisplayMapping[u.role] || u.role}
                        <button 
                          className="admin-edit-role-btn" 
                          onClick={() => openRoleChangeModal(u)} 
                          title="Thay đổi quyền"
                        >
                          ✏️
                        </button>
                      </td>
                      <td>
                        <span className={`admin-status-badge admin-${u.status.toLowerCase()}`}>
                          {u.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions">
                          {u.status === "pending" && (
                            <button className="admin-approve-btn" onClick={() => approveUser(u.id)}>Duyệt</button>
                          )}
                          <button className="admin-delete-btn" onClick={() => deleteUser(u.id)} title="Xóa tài khoản khỏi hệ thống">
                            {u.status === "pending" ? "Từ chối" : "Xóa"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Thay đổi quyền người dùng</h3>
              <div className="admin-user-status-info">
                <span className={`admin-status-badge admin-${editingUser.status.toLowerCase()}`}>
                  {editingUser.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                </span>
              </div>
            </div>
            <div className="admin-modal-content">
              <div className="admin-user-info">
                <p><strong>Họ tên:</strong> {editingUser.fullName}</p>
                <p><strong>Email:</strong> {editingUser.email}</p>
                <p><strong>Phòng ban:</strong> {editingUser.department}</p>
                <p><strong>Quyền hiện tại:</strong> {roleDisplayMapping[editingUser.role] || editingUser.role}</p>
                <p><strong>Trạng thái:</strong> 
                  <span className={`admin-status-badge admin-${editingUser.status.toLowerCase()}`}>
                    {editingUser.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
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
              <button className="admin-btn-secondary" onClick={closeRoleChangeModal}>Hủy</button>
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