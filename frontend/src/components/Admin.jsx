import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import "./Admin.css";

const API_URL = 'http://localhost:8080/api';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [adminInfo, setAdminInfo] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [activeForecastTab, setActiveForecastTab] = useState("pending");
  const [selectedForecast, setSelectedForecast] = useState(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const navigate = useNavigate();

  const availableRoles = [
    { value: "Lãnh đạo", label: "Lãnh đạo" },
    { value: "Thủ kho", label: "Thủ kho" },
    { value: "Cán bộ", label: "Cán bộ khác" }
  ];

  const API_ENDPOINTS = {
    USERS_ALL: `${API_URL}/admin/users/all`,
    USER_APPROVE: (id) => `${API_URL}/admin/users/${id}/approve`,
    USER_DELETE: (id) => `${API_URL}/admin/users/${id}`,
    USER_ROLE: (id) => `${API_URL}/admin/users/${id}/role`,
    FORECASTS_PENDING: (bghId) => `${API_URL}/supp-forecast/bgh/pending?bghId=${bghId}`,
    FORECASTS_PROCESSED: (bghId) => `${API_URL}/supp-forecast/bgh/processed?bghId=${bghId}`,
    FORECAST_APPROVE: `${API_URL}/supp-forecast/approve`,
    FORECAST_STATS: (bghId) => `${API_URL}/supp-forecast/bgh/stats?bghId=${bghId}`
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
          // Đã bỏ console.error
        }
      }

      if (adminJustLoggedIn || (userData && userData.isBanGiamHieu)) {
        if (adminJustLoggedIn) {
          sessionStorage.removeItem('adminJustLoggedIn');
        }
        setIsAuthenticated(true);
        setAdminInfo(userData);
        fetchUsers();
        fetchForecasts();
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
      
      const filteredData = data.filter(user => !user.isBanGiamHieu);
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

  const fetchForecasts = async () => {
    if (!adminInfo?.id) return;
    
    try {
      const endpoint = activeForecastTab === "pending" 
        ? API_ENDPOINTS.FORECASTS_PENDING(adminInfo.id)
        : API_ENDPOINTS.FORECASTS_PROCESSED(adminInfo.id);
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setForecasts(data);
    } catch (error) {
      Swal.fire({
        title: "Lỗi!",
        text: "Không thể tải danh sách dự trù",
        icon: "error",
        timer: 3000,
      });
    }
  };

  const filterUsersByStatus = (userList, status) => {
    if (status === "pending") {
      setFilteredUsers(userList.filter(user => user.statusValue === 0));
    } else {
      setFilteredUsers(userList.filter(user => user.statusValue === 1));
    }
  };

  useEffect(() => {
    filterUsersByStatus(users, activeTab);
  }, [users, activeTab]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchForecasts();
    }
  }, [activeForecastTab, isAuthenticated]);

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
        const cookiesToDelete = ["rememberedEmail", "rememberedPassword", "rememberMe"];
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
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, statusValue: 1, status: "Đã duyệt" } : u)));
        filterUsersByStatus(users.map(u => u.id === id ? { ...u, statusValue: 1, status: "Đã duyệt" } : u), activeTab);
        Swal.fire({ title: "✅ Đã duyệt!", text: `${user.fullName} đã được cấp quyền truy cập.`, icon: "success", timer: 2000, showConfirmButton: false });
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
            filterUsersByStatus(users.filter(u => u.id !== id), activeTab);
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
        filterUsersByStatus(users.map(u => u.id === id ? { ...u, role: newRole } : u), activeTab);
        setEditingUser(null);
        setNewRole("");
        Swal.fire({
          title: "✅ Đã cập nhật!",
          html: `<div style="text-align: left;"><p><strong>Quyền mới:</strong> ${newRole}</p></div>`,
          icon: "success", 
          timer: 2000, 
          showConfirmButton: false
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

  // ==================== DỰ TRÙ BỔ SUNG ====================

  const approveForecast = async (forecastId) => {
    const { value: note } = await Swal.fire({
      title: "Phê duyệt dự trù?",
      input: "textarea",
      inputLabel: "Lý do phê duyệt (không bắt buộc):",
      inputPlaceholder: "Nhập lý do phê duyệt (nếu có)...",
      inputAttributes: { maxLength: "500" },
      showCancelButton: true,
      confirmButtonText: "Phê duyệt",
      confirmButtonColor: "#10B981",
      cancelButtonText: "Hủy",
    });

    if (note !== undefined) {
      try {
        const requestBody = {
          forecastId: forecastId,
          action: 1,
          note: note || "Đã phê duyệt",
          approverId: adminInfo.id
        };

        const response = await fetch(API_ENDPOINTS.FORECAST_APPROVE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          Swal.fire({
            title: "✅ Đã phê duyệt!",
            text: "Dự trù đã được phê duyệt thành công.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
          });
          fetchForecasts();
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        Swal.fire({
          title: "❌ Lỗi!",
          text: "Không thể phê duyệt dự trù",
          icon: "error",
          timer: 2000
        });
      }
    }
  };

  const rejectForecast = async (forecastId) => {
    const { value: note } = await Swal.fire({
      title: "Từ chối dự trù?",
      input: "textarea",
      inputLabel: "Lý do từ chối:",
      inputPlaceholder: "Nhập lý do từ chối dự trù...",
      inputAttributes: { maxLength: "500" },
      showCancelButton: true,
      confirmButtonText: "Từ chối",
      confirmButtonColor: "#EF4444",
      cancelButtonText: "Hủy",
      preConfirm: (note) => {
        if (!note || note.trim().length === 0) {
          Swal.showValidationMessage("Vui lòng nhập lý do từ chối!");
          return false;
        }
        return note;
      }
    });

    if (note) {
      try {
        const requestBody = {
          forecastId: forecastId,
          action: 2,
          note: note,
          approverId: adminInfo.id
        };

        const response = await fetch(API_ENDPOINTS.FORECAST_APPROVE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          Swal.fire({
            title: "✅ Đã từ chối!",
            text: "Dự trù đã được từ chối thành công.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
          });
          fetchForecasts();
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        Swal.fire({
          title: "❌ Lỗi!",
          text: "Không thể từ chối dự trù",
          icon: "error",
          timer: 2000
        });
      }
    }
  };

  const viewForecastDetails = (forecast) => {
    setSelectedForecast(forecast);
  };

  const closeForecastDetails = () => {
    setSelectedForecast(null);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 0: return { text: "Chờ duyệt", class: "pending" };
      case 1: return { text: "Đã duyệt", class: "approved" };
      case 2: return { text: "Đã từ chối", class: "rejected" };
      default: return { text: "Không xác định", class: "unknown" };
    }
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
          <h1>Bảng điều khiển cho Ban giám hiệu</h1>
          <p>
            {adminInfo ? (
              <>
                Xin chào <strong>{adminInfo.fullName}</strong> - {adminInfo.role}
              </>
            ) : (
              "Duyệt & quản lý tài khoản và dự trù bổ sung"
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
              <canvas ref={chartRef} width="400" height="400" style={{ maxWidth: '100%', height: 'auto' }}></canvas>
            </div>
          </div>

          <div className="admin-user-list admin-card">
            <div className="admin-card-header">
              <h3>Danh sách tài khoản hệ thống</h3>
              <div className="admin-user-count-badge">
                <span className="admin-count-number">{filteredUsers.length}</span>
                <span className="admin-count-text">tài khoản</span>
              </div>
            </div>

            <div className="admin-tabs">
              <button 
                className={`admin-tab ${activeTab === "pending" ? "admin-tab-active" : ""}`}
                onClick={() => setActiveTab("pending")}
              >
                Tài khoản chờ duyệt ({users.filter(u => u.statusValue === 0).length})
              </button>
              <button 
                className={`admin-tab ${activeTab === "approved" ? "admin-tab-active" : ""}`}
                onClick={() => setActiveTab("approved")}
              >
                Tài khoản đã duyệt ({users.filter(u => u.statusValue === 1).length})
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
                    <tr key={u.id} className={`${u.statusValue === 1 ? "admin-approved" : ""} ${index === filteredUsers.length - 1 ? "admin-last-row" : ""}`}>
                      <td>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td>{u.department}</td>
                      <td>
                        <div className="admin-role-cell">
                          <span>{u.role}</span>
                          <button 
                            className="admin-edit-role-btn" 
                            onClick={() => openRoleChangeModal(u)} 
                            title="Thay đổi quyền"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-status-badge admin-${u.statusValue === 1 ? 'approved' : 'pending'}`}>
                          {u.statusValue === 1 ? 'Đã duyệt' : 'Chờ duyệt'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions">
                          {u.statusValue === 0 && (
                            <button className="admin-approve-btn" onClick={() => approveUser(u.id)}>Duyệt</button>
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
                        {activeTab === "pending" 
                          ? "Không có tài khoản nào đang chờ duyệt" 
                          : "Không có tài khoản nào đã được duyệt"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-forecast-list admin-card">
            <div className="admin-card-header">
              <h3>Duyệt dự trù bổ sung</h3>
              <div className="admin-user-count-badge">
                <span className="admin-count-number">{forecasts.length}</span>
                <span className="admin-count-text">dự trù</span>
              </div>
            </div>

            <div className="admin-tabs">
              <button 
                className={`admin-tab ${activeForecastTab === "pending" ? "admin-tab-active" : ""}`}
                onClick={() => setActiveForecastTab("pending")}
              >
                Chờ duyệt
              </button>
              <button 
                className={`admin-tab ${activeForecastTab === "processed" ? "admin-tab-active" : ""}`}
                onClick={() => setActiveForecastTab("processed")}
              >
                Đã xử lý
              </button>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Khoa/Phòng</th>
                    <th>Năm học</th>
                    <th>Người tạo</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((forecast, index) => {
                    const status = getStatusBadge(forecast.status);
                    return (
                      <tr key={forecast.id} className={index === forecasts.length - 1 ? "admin-last-row" : ""}>
                        <td>{forecast.department?.name || "Không xác định"}</td>
                        <td>{forecast.academicYear}</td>
                        <td>{forecast.createdBy?.fullName || "Không xác định"}</td>
                        <td>{new Date(forecast.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td>
                          <span className={`admin-status-badge admin-${status.class}`}>
                            {status.text}
                          </span>
                        </td>
                        <td>
                          <div className="admin-actions">
                            <button 
                              className="admin-view-btn" 
                              onClick={() => viewForecastDetails(forecast)}
                              title="Xem chi tiết"
                            >
                              👁️
                            </button>
                            {forecast.status === 0 && (
                              <>
                                <button 
                                  className="admin-approve-btn" 
                                  onClick={() => approveForecast(forecast.id)} 
                                  title="Phê duyệt"
                                >
                                  ✓
                                </button>
                                <button 
                                  className="admin-reject-btn" 
                                  onClick={() => rejectForecast(forecast.id)} 
                                  title="Từ chối"
                                >
                                  ✗
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {forecasts.length === 0 && (
                    <tr className="admin-last-row">
                      <td colSpan="6" className="admin-no-data">
                        {activeForecastTab === "pending" 
                          ? "Không có dự trù nào chờ duyệt" 
                          : "Không có dự trù nào đã xử lý"}
                      </td>
                    </tr>
                  )}
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
                <span className={`admin-status-badge admin-${editingUser.statusValue === 1 ? 'approved' : 'pending'}`}>
                  {editingUser.statusValue === 1 ? 'Đã duyệt' : 'Chờ duyệt'}
                </span>
              </div>
            </div>
            <div className="admin-modal-content">
              <div className="admin-user-info">
                <p><strong>Họ tên:</strong> {editingUser.fullName}</p>
                <p><strong>Email:</strong> {editingUser.email}</p>
                <p><strong>Phòng ban:</strong> {editingUser.department}</p>
                <p><strong>Quyền hiện tại:</strong> {editingUser.role}</p>
                <p><strong>Trạng thái:</strong> 
                  <span className={`admin-status-badge admin-${editingUser.statusValue === 1 ? 'approved' : 'pending'}`}>
                    {editingUser.statusValue === 1 ? 'Đã duyệt' : 'Chờ duyệt'}
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

      {selectedForecast && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-forecast-modal">
            <div className="admin-modal-header">
              <h3>Chi tiết dự trù #{selectedForecast.id}</h3>
              <div className="admin-user-status-info">
                <span className={`admin-status-badge admin-${getStatusBadge(selectedForecast.status).class}`}>
                  {getStatusBadge(selectedForecast.status).text}
                </span>
              </div>
            </div>
            <div className="admin-modal-content">
              <div className="admin-forecast-info">
                <div className="admin-info-row">
                  <div className="admin-info-item">
                    <strong>Khoa/Phòng:</strong> {selectedForecast.department?.name || "Không xác định"}
                  </div>
                  <div className="admin-info-item">
                    <strong>Năm học:</strong> {selectedForecast.academicYear}
                  </div>
                </div>
                <div className="admin-info-row">
                  <div className="admin-info-item">
                    <strong>Người tạo:</strong> {selectedForecast.createdBy?.fullName || "Không xác định"}
                  </div>
                  <div className="admin-info-item">
                    <strong>Ngày tạo:</strong> {new Date(selectedForecast.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                {selectedForecast.approvalBy && (
                  <div className="admin-info-row">
                    <div className="admin-info-item">
                      <strong>Người duyệt:</strong> {selectedForecast.approvalBy?.fullName}
                    </div>
                    <div className="admin-info-item">
                      <strong>Ngày duyệt:</strong> {new Date(selectedForecast.approvalAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                )}
                {selectedForecast.approvalNote && (
                  <div className="admin-info-row">
                    <div className="admin-info-item full-width">
                      <strong>Ghi chú:</strong> {selectedForecast.approvalNote}
                    </div>
                  </div>
                )}
              </div>

              {selectedForecast.details && selectedForecast.details.length > 0 && (
                <div className="admin-forecast-details">
                  <h4>Danh sách vật tư</h4>
                  <div className="admin-details-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Tên vật tư</th>
                          <th>Tồn hiện tại</th>
                          <th>Năm trước</th>
                          <th>Dự trù năm nay</th>
                          <th>Lý do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedForecast.details.map((detail, index) => (
                          <tr key={index}>
                            <td>{detail.material?.name || "Vật tư mới"}</td>
                            <td>{detail.currentStock}</td>
                            <td>{detail.prevYearQty}</td>
                            <td><strong>{detail.thisYearQty}</strong></td>
                            <td>{detail.justification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              {selectedForecast.status === 0 && (
                <>
                  <button 
                    className="admin-reject-btn" 
                    onClick={() => rejectForecast(selectedForecast.id)} 
                  >
                    Từ chối
                  </button>
                  <button 
                    className="admin-approve-btn" 
                    onClick={() => approveForecast(selectedForecast.id)} 
                  >
                    Phê duyệt
                  </button>
                </>
              )}
              <button className="admin-btn-secondary" onClick={closeForecastDetails}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}