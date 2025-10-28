import React, { useEffect, useRef, useState } from "react";
import DashboardHeader from "./DashboardHeader";
import DashboardTabs from "./DashboardTabs";
import EquipmentList from "./EquipmentList";
import AddEquipment from "./AddEquipment";
import ExportEquipment from "./ExportEquipment";
import ReplenishmentRequest from "./ReplenishmentRequest";
import Chart from "chart.js/auto";
import Swal from "sweetalert2";
import "./Dashboard.css";

export default function Dashboard() {
  const [userInfo, setUserInfo] = useState(null); // THÊM DÒNG NÀY

  const initialData = [
    { id: 1, code: "TB001", name: "Máy X-quang", department: "Khoa Nội", status: "Hoạt động tốt", date: "2023-01-15", value: 500000000 },
    { id: 2, code: "TB002", name: "Máy siêu âm", department: "Khoa Sản", status: "Hoạt động tốt", date: "2023-02-20", value: 300000000 },
    { id: 3, code: "TB003", name: "Máy thở", department: "Khoa Cấp cứu", status: "Cần bảo trì", date: "2022-12-10", value: 800000000 },
    { id: 4, code: "TB004", name: "Máy ECG", department: "Khoa Nội", status: "Hỏng hóc", date: "2023-03-05", value: 150000000 },
    { id: 5, code: "TB005", name: "Máy xét nghiệm máu", department: "Khoa Xét nghiệm", status: "Hoạt động tốt", date: "2023-01-30", value: 400000000 }
  ];

  const [equipmentData, setEquipmentData] = useState(initialData);
  const [nextId, setNextId] = useState(6);
  const [activeTab, setActiveTab] = useState("dashboard");

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // LẤY THÔNG TIN USER KHI COMPONENT MOUNT
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUserInfo(JSON.parse(savedUser));
    }
  }, []);

  // Cập nhật chart khi data thay đổi
  useEffect(() => {
    if (activeTab === "dashboard") updateStatusChart();
  }, [equipmentData, activeTab]);

  function updateStatusChart() {
    const ctx = chartRef.current?.getContext("2d");
    if (!ctx) return;

    const working = equipmentData.filter((e) => e.status === "Hoạt động tốt").length;
    const maintenance = equipmentData.filter((e) => e.status === "Cần bảo trì").length;
    const broken = equipmentData.filter((e) => e.status === "Hỏng hóc").length;

    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Hoạt động tốt", "Cần bảo trì", "Hỏng hóc"],
        datasets: [{
          data: [working, maintenance, broken],
          backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
          borderColor: "#fff",
          borderWidth: 3
        }]
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
                return `${label}: ${value} vật tư (${perc}%)`;
              }
            }
          }
        },
        cutout: "60%"
      }
    });
  }

  // === HÀNH ĐỘNG ===

  function addEquipment(newEq) {
    setEquipmentData((prev) => [...prev, { ...newEq, id: nextId }]);
    setNextId((id) => id + 1);
    setActiveTab("equipment");

    Swal.fire({
      title: "🎉 Thêm vật tư thành công!",
      text: `Đã thêm “${newEq.name}” vào danh sách.`,
      icon: "success",
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
      position: "center",
      backdrop: true,
    });
  }

  function deleteEquipment(id) {
    const eq = equipmentData.find((e) => e.id === id);
    Swal.fire({
      title: "🗑️ Xác nhận xóa?",
      text: `Bạn có chắc chắn muốn xóa vật tư “${eq.name}”?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
      reverseButtons: true,
      backdrop: true,
    }).then((result) => {
      if (result.isConfirmed) {
        setEquipmentData((prev) => prev.filter((e) => e.id !== id));
        Swal.fire({
          title: "✅ Đã xóa!",
          text: `Vật tư “${eq.name}” đã bị xóa.`,
          icon: "success",
          position: "center",
          timer: 2000,
          showConfirmButton: false,
          backdrop: true,
        });
      }
    });
  }

  function editEquipment(id) {
    const eq = equipmentData.find((e) => e.id === id);
    Swal.fire({
      title: "🛠️ Sắp có!",
      text: `Tính năng chỉnh sửa vật tư “${eq.name}” đang được phát triển.`,
      icon: "info",
      confirmButtonText: "OK",
      backdrop: true,
      position: "center",
    });
  }

  function handleExport(content, filename, contentType) {
    if (contentType === "empty") {
      Swal.fire({
        title: "⚠️ Không có dữ liệu để xuất!",
        text: "Vui lòng chọn bộ lọc khác hoặc kiểm tra lại.",
        icon: "warning",
        position: "center",
        showConfirmButton: false,
        timer: 2000,
        backdrop: true,
      });
      return;
    }

    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    Swal.fire({
      title: "📦 Xuất dữ liệu thành công!",
      text: `File ${filename} đã được tải xuống.`,
      icon: "success",
      showConfirmButton: false,
      timer: 2000,
      position: "center",
      backdrop: true,
    });
  }

  // === THỐNG KÊ ===
  const total = equipmentData.length;
  const working = equipmentData.filter(e => e.status === "Hoạt động tốt").length;
  const maintenance = equipmentData.filter(e => e.status === "Cần bảo trì").length;
  const broken = equipmentData.filter(e => e.status === "Hỏng hóc").length;

  // === GIAO DIỆN ===
  return (
    <div className="dashboard-page">
      <DashboardHeader userInfo={userInfo} />
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardTabs active={activeTab} setActive={setActiveTab} />

        <div className="mt-4">
          {activeTab === "dashboard" && (
            <div className="overview-grid">
              <div className="stats-grid">
                <div className="stat card"><div className="muted">Tổng vật tư</div><div className="big">{total}</div></div>
                <div className="stat card"><div className="muted">Hoạt động tốt</div><div className="big green-text">{working}</div></div>
                <div className="stat card"><div className="muted">Cần bảo trì</div><div className="big yellow-text">{maintenance}</div></div>
                <div className="stat card"><div className="muted">Hỏng hóc</div><div className="big red-text">{broken}</div></div>
              </div>
              <div className="main-grid">
                <div className="chart card">
                  <h3>Phân bố theo trạng thái</h3>
                  <div className="chart-wrap"><canvas ref={chartRef} width="300" height="300" /></div>
                </div>
                <div className="activity card">
                  <h3>Hoạt động gần đây</h3>
                  <div className="activity-list">
                    <div className="act blue"><div className="dot" /><div className="text">Thêm mới vật tư TB005 - Máy xét nghiệm máu</div></div>
                    <div className="act yellow"><div className="dot" /><div className="text">Cập nhật TB003 - Cần bảo trì</div></div>
                    <div className="act green"><div className="dot" /><div className="text">Hoàn thành bảo trì TB002 - Máy siêu âm</div></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "equipment" && (
            <EquipmentList equipmentData={equipmentData} onDelete={deleteEquipment} onEdit={editEquipment} />
          )}

          {activeTab === "add" && <AddEquipment onAdd={addEquipment} />}
          {activeTab === "export" && <ExportEquipment equipmentData={equipmentData} onExport={handleExport} />}
          {activeTab === "replenish" && <ReplenishmentRequest />}

        </div>
      </div>
    </div>
  );
}