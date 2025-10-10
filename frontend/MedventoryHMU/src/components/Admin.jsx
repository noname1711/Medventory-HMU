import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import "./Admin.css";

export default function Admin() {
  // Fake data người dùng đăng ký
  const initialUsers = [
    { id: 1, name: "Nguyễn Văn A", email: "a@hmu.edu.vn", department: "Khoa Nội", role: "Bác sĩ", status: "Chờ duyệt" },
    { id: 2, name: "Trần Thị B", email: "b@hmu.edu.vn", department: "Khoa Sản", role: "Điều dưỡng", status: "Chờ duyệt" },
    { id: 3, name: "Lê Văn C", email: "c@hmu.edu.vn", department: "Khoa Xét nghiệm", role: "Kỹ thuật viên", status: "Đã duyệt" },
    { id: 4, name: "Phạm Thị D", email: "d@hmu.edu.vn", department: "Kho Vật tư", role: "Quản lý kho", status: "Từ chối" },
  ];

  const [users, setUsers] = useState(initialUsers);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // === Cập nhật biểu đồ khi thay đổi trạng thái ===
  useEffect(() => {
    updateChart();
  }, [users]);

  const updateChart = () => {
    const ctx = chartRef.current?.getContext("2d");
    if (!ctx) return;

    const approved = users.filter((u) => u.status === "Đã duyệt").length;
    const pending = users.filter((u) => u.status === "Chờ duyệt").length;
    const rejected = users.filter((u) => u.status === "Từ chối").length;

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

  // === HÀNH ĐỘNG DUYỆT / TỪ CHỐI ===
  const approveUser = (id) => {
    const user = users.find((u) => u.id === id);
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: "Đã duyệt" } : u))
    );
    Swal.fire({
      title: "✅ Đã duyệt!",
      text: `${user.name} đã được cấp quyền truy cập.`,
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
      position: "center",
      backdrop: true,
    });
  };

  const rejectUser = (id) => {
    const user = users.find((u) => u.id === id);
    Swal.fire({
      title: "⚠️ Xác nhận từ chối?",
      text: `Bạn có chắc chắn muốn từ chối “${user.name}”?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Từ chối",
      cancelButtonText: "Hủy",
      reverseButtons: true,
      backdrop: true,
    }).then((result) => {
      if (result.isConfirmed) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: "Từ chối" } : u))
        );
        Swal.fire({
          title: "❌ Đã từ chối!",
          text: `${user.name} đã bị từ chối đăng ký.`,
          icon: "error",
          timer: 2000,
          showConfirmButton: false,
          position: "center",
          backdrop: true,
        });
      }
    });
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="title">
          <h1>👑 Bảng điều khiển Admin</h1>
          <p>Duyệt & quản lý tài khoản đăng ký hệ thống</p>
        </div>
        <div className="badge">Quản trị viên</div>
      </header>

      <div className="admin-container">
        <div className="grid-layout">
          <div className="chart-card card">
            <h3>Thống kê trạng thái tài khoản</h3>
            <div className="chart-wrap">
              <canvas ref={chartRef} width="280" height="280"></canvas>
            </div>
          </div>

          <div className="user-list card">
            <h3>Danh sách tài khoản chờ duyệt</h3>
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
                  <tr key={u.id} className={u.status === "Đã duyệt" ? "approved" : u.status === "Từ chối" ? "rejected" : ""}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.department}</td>
                    <td>{u.role}</td>
                    <td>
                      <span className={`status-badge ${u.status.toLowerCase().replace(" ", "-")}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      {u.status === "Chờ duyệt" ? (
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
  );
}
