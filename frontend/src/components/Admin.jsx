import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import "./Admin.css";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState("");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Danh sách các quyền có thể chọn và priority tương ứng
  const availableRoles = [
    { value: "Lãnh đạo", label: "Lãnh đạo", priority: 1 },
    { value: "Thủ kho", label: "Thủ kho", priority: 2 },
    { value: "Cán bộ", label: "Cán bộ khác", priority: 3 }
  ];

  // Lấy priority theo role
  const getPriorityByRole = (role) => {
    const roleConfig = availableRoles.find(r => r.value === role);
    return roleConfig ? roleConfig.priority : 3; // Mặc định là 3 nếu không tìm thấy
  };

  // Lấy danh sách người dùng từ API
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/admin/users/all');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách người dùng:", error);
    }
  };

  // Cập nhật biểu đồ
  useEffect(() => {
    updateChart();
  }, [users]);

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
          legend: { position: "bottom" },
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

  // Duyệt người dùng
  const approveUser = async (id) => {
    try {
      const response = await fetch(`http://localhost:8080/api/admin/users/${id}/approve`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const user = users.find((u) => u.id === id);
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: "approved" } : u))
        );
        Swal.fire({
          title: "✅ Đã duyệt!",
          text: `${user.fullName} đã được cấp quyền truy cập.`,
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
          position: "center",
          backdrop: true,
        });
      }
    } catch (error) {
      console.error("Lỗi khi duyệt người dùng:", error);
    }
  };

  // Từ chối người dùng - TỰ ĐỘNG XÓA SAU KHI TỪ CHỐI
  const rejectUser = async (id) => {
    const user = users.find((u) => u.id === id);
    Swal.fire({
      title: "⚠️ Xác nhận từ chối?",
      text: `"${user.fullName}" sẽ bị từ chối và xóa khỏi hệ thống. Hành động này không thể hoàn tác!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Từ chối & Xóa",
      cancelButtonText: "Hủy",
      reverseButtons: true,
      backdrop: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`http://localhost:8080/api/admin/users/${id}`, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            // Xóa người dùng khỏi danh sách
            setUsers((prev) => prev.filter((u) => u.id !== id));
            Swal.fire({
              title: "❌ Đã từ chối & xóa!",
              text: `${user.fullName} đã bị từ chối và xóa khỏi hệ thống.`,
              icon: "error",
              timer: 2000,
              showConfirmButton: false,
              position: "center",
              backdrop: true,
            });
          }
        } catch (error) {
          console.error("Lỗi khi từ chối người dùng:", error);
        }
      }
    });
  };

  // Xóa tài khoản đã được phê duyệt
  const deleteUser = async (id) => {
    const user = users.find((u) => u.id === id);
    
    Swal.fire({
      title: "Xác nhận xóa tài khoản?",
      html: `
        <div style="text-align: left;">
          <p><strong>Họ tên:</strong> ${user.fullName}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Phòng ban:</strong> ${user.department}</p>
          <p><strong>Vai trò:</strong> ${user.role}</p>
        </div>
        <p style="color: #ef4444; margin-top: 15px;">
          ⚠️ Tài khoản sẽ bị xóa vĩnh viễn khỏi hệ thống. Hành động này không thể hoàn tác!
        </p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Xóa vĩnh viễn",
      cancelButtonText: "Hủy",
      reverseButtons: true,
      backdrop: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`http://localhost:8080/api/admin/users/${id}`, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            // Xóa người dùng khỏi danh sách
            setUsers((prev) => prev.filter((u) => u.id !== id));
            Swal.fire({
              title: "✅ Đã xóa!",
              text: `Tài khoản "${user.fullName}" đã bị xóa khỏi hệ thống.`,
              icon: "success",
              timer: 2000,
              showConfirmButton: false,
              position: "center",
              backdrop: true,
            });
          }
        } catch (error) {
          console.error("Lỗi khi xóa người dùng:", error);
        }
      }
    });
  };

  // Thay đổi quyền của user (CẬP NHẬT CẢ ROLE VÀ PRIORITY)
  const changeUserRole = async (id, newRole) => {
    try {
      const newPriority = getPriorityByRole(newRole);
      
      const response = await fetch(`http://localhost:8080/api/admin/users/${id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          role: newRole,
          priority: newPriority 
        }),
      });
      
      if (response.ok) {
        setUsers((prev) =>
          prev.map((u) => 
            u.id === id ? { ...u, role: newRole, priority: newPriority } : u
          )
        );
        setEditingUser(null);
        setNewRole("");
        
        Swal.fire({
          title: "✅ Đã cập nhật!",
          html: `
            <div style="text-align: left;">
              <p><strong>Quyền mới:</strong> ${newRole}</p>
              <p><strong>Độ ưu tiên mới:</strong> ${newPriority}</p>
            </div>
          `,
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
          position: "center",
          backdrop: true,
        });
      } else {
        const errorText = await response.text();
        Swal.fire({
          title: "❌ Lỗi!",
          text: `Không thể thay đổi quyền: ${errorText}`,
          icon: "error",
          timer: 3000,
        });
      }
    } catch (error) {
      console.error("Lỗi khi thay đổi quyền:", error);
      Swal.fire({
        title: "❌ Lỗi kết nối!",
        text: "Không thể kết nối đến server",
        icon: "error",
        timer: 3000,
      });
    }
  };

  // Mở modal thay đổi quyền
  const openRoleChangeModal = (user) => {
    setEditingUser(user);
    setNewRole(user.role);
  };

  // Đóng modal
  const closeRoleChangeModal = () => {
    setEditingUser(null);
    setNewRole("");
  };

  // Xử lý thay đổi quyền
  const handleRoleChange = () => {
    if (editingUser && newRole) {
      changeUserRole(editingUser.id, newRole);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="title">
          <h1>Bảng điều khiển Admin</h1>
          <p>Duyệt & quản lý tài khoản đăng ký hệ thống</p>
        </div>
        <div className="badge">Quản trị viên</div>
      </header>

      <div className="admin-container">
        <div className="grid-layout">
          <div className="chart-card card">
            <h3>Thống kê trạng thái tài khoản</h3>
            <div className="chart-wrap">
              <canvas 
                ref={chartRef} 
                width="400" 
                height="400"
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto' 
                }}
              ></canvas>
            </div>
          </div>

          <div className="user-list card">
            <h3>Danh sách tài khoản hệ thống</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Phòng ban</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thứ tự ưu tiên</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={u.status === "approved" ? "approved" : ""}>
                      <td>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td>{u.department}</td>
                      <td>
                        {u.role}
                        {u.status === "approved" && (
                          <button 
                            className="edit-role-btn"
                            onClick={() => openRoleChangeModal(u)}
                            title="Thay đổi quyền"
                          >
                            ✏️
                          </button>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${u.status.toLowerCase()}`}>
                          {u.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-number priority-${u.priority}`}>
                          {u.priority}
                        </span>
                      </td>
                      <td>
                        {u.status === "pending" ? (
                          <div className="actions">
                            <button className="approve-btn" onClick={() => approveUser(u.id)}>Duyệt</button>
                            <button className="reject-btn" onClick={() => rejectUser(u.id)}>Từ chối</button>
                          </div>
                        ) : (
                          <div className="actions">
                            <button 
                              className="delete-btn" 
                              onClick={() => deleteUser(u.id)}
                              title="Xóa tài khoản khỏi hệ thống"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal thay đổi quyền */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Thay đổi quyền người dùng</h3>
              <button className="modal-close" onClick={closeRoleChangeModal}>
                ✕
              </button>
            </div>
            <div className="modal-content">
              <div className="user-info">
                <p><strong>Họ tên:</strong> {editingUser.fullName}</p>
                <p><strong>Email:</strong> {editingUser.email}</p>
                <p><strong>Phòng ban:</strong> {editingUser.department}</p>
                <p><strong>Quyền hiện tại:</strong> {editingUser.role}</p>
                <p><strong>Độ ưu tiên hiện tại:</strong> 
                  <span className={`priority-number priority-${editingUser.priority}`}>
                    {editingUser.priority}
                  </span>
                </p>
              </div>
              
              <div className="role-selection">
                <label htmlFor="role-select">Chọn quyền mới:</label>
                <select 
                  id="role-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {availableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label} (Ưu tiên: {role.priority})
                    </option>
                  ))}
                </select>
                
                {/* Hiển thị thông tin priority sẽ thay đổi */}
                {newRole && (
                  <div className="priority-preview">
                    <p><strong>Độ ưu tiên sẽ thay đổi thành:</strong></p>
                    <span className={`priority-number priority-${getPriorityByRole(newRole)}`}>
                      {getPriorityByRole(newRole)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeRoleChangeModal}>
                Hủy
              </button>
              <button 
                className="btn-primary" 
                onClick={handleRoleChange}
                disabled={!newRole || newRole === editingUser.role}
              >
                Cập nhật quyền & Ưu tiên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}