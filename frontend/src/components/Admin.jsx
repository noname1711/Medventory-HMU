import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import "./Admin.css";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

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
    const rejected = users.filter((u) => u.status === "rejected").length;

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Đã duyệt", "Chờ duyệt", "Từ chối"],
        datasets: [{
          data: [approved, pending, rejected],
          backgroundColor: ["#10B981", "#FACC15", "#EF4444"],
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
      toast.error("Lỗi khi duyệt người dùng!");
    }
  };

  // Từ chối người dùng
  const rejectUser = async (id) => {
    const user = users.find((u) => u.id === id);
    Swal.fire({
      title: "⚠️ Xác nhận từ chối?",
      text: `Bạn có chắc chắn muốn từ chối "${user.fullName}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Từ chối",
      cancelButtonText: "Hủy",
      reverseButtons: true,
      backdrop: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`http://localhost:8080/api/admin/users/${id}/reject`, {
            method: 'POST',
          });
          
          if (response.ok) {
            setUsers((prev) =>
              prev.map((u) => (u.id === id ? { ...u, status: "rejected" } : u))
            );
            Swal.fire({
              title: "❌ Đã từ chối!",
              text: `${user.fullName} đã bị từ chối đăng ký.`,
              icon: "error",
              timer: 2000,
              showConfirmButton: false,
              position: "center",
              backdrop: true,
            });
          }
        } catch (error) {
          toast.error("Lỗi khi từ chối người dùng!");
        }
      }
    });
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
            <h3>Danh sách tài khoản chờ duyệt</h3>
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
                  <tr key={u.id} className={u.status === "approved" ? "approved" : u.status === "rejected" ? "rejected" : ""}>
                    <td>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td>{u.department}</td>
                    <td>{u.role}</td>
                    <td>
                      <span className={`status-badge ${u.status.toLowerCase()}`}>
                        {u.status === 'approved' ? 'Đã duyệt' : 
                         u.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}
                      </span>
                    </td>
                    <td>{u.priority}</td>
                    <td>
                      {u.status === "pending" ? (
                        <div className="actions">
                          <button className="approve-btn" onClick={() => approveUser(u.id)}>Duyệt</button>
                          <button className="reject-btn" onClick={() => rejectUser(u.id)}>Từ chối</button>
                        </div>
                      ) : (
                        <small className="muted">Đã xử lý</small>
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
  </div>
  );
}