import React, { useEffect, useRef, useState } from "react";
import DashboardHeader from "./DashboardHeader";
import DashboardTabs from "./DashboardTabs";
import EquipmentList from "./EquipmentList";
import AddEquipment from "./AddEquipment";
import ExportEquipment from "./ExportEquipment";
import Chart from "chart.js/auto";
import "./Dashboard.css";

export default function Dashboard() {
  // initial sample data (same as HTML)
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

  // chart refs for overview
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // update chart whenever data changes and when on dashboard tab
    if (activeTab === "dashboard") {
      updateStatusChart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentData, activeTab]);

  function updateStatusChart() {
    const ctx = chartRef.current && chartRef.current.getContext("2d");
    if (!ctx) return;
    const working = equipmentData.filter((e) => e.status === "Hoạt động tốt").length;
    const maintenance = equipmentData.filter((e) => e.status === "Cần bảo trì").length;
    const broken = equipmentData.filter((e) => e.status === "Hỏng hóc").length;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Hoạt động tốt", "Cần bảo trì", "Hỏng hóc"],
        datasets: [{
          data: [working, maintenance, broken],
          backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
          borderColor: "#ffffff",
          borderWidth: 3
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
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

  // actions
  function addEquipment(newEq) {
    setEquipmentData(prev => [...prev, { ...newEq, id: nextId }]);
    setNextId(id => id + 1);
    setActiveTab("equipment");
    alert("Thêm vật tư thành công!");
  }

  function deleteEquipment(id) {
    if (confirm("Bạn có chắc chắn muốn xóa vật tư này?")) {
      setEquipmentData(prev => prev.filter(e => e.id !== id));
      alert("Xóa vật tư thành công!");
    }
  }

  function editEquipment(id) {
    alert(`Chỉnh sửa vật tư ID: ${id}`);
    // placeholder — có thể mở modal để chỉnh sửa
  }

  // Export callback: download file
  function handleExport(content, filename, contentType = "text/csv") {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // dashboard stats
  const total = equipmentData.length;
  const working = equipmentData.filter(e => e.status === "Hoạt động tốt").length;
  const maintenance = equipmentData.filter(e => e.status === "Cần bảo trì").length;
  const broken = equipmentData.filter(e => e.status === "Hỏng hóc").length;

  return (
    <div className="dashboard-page">
      <DashboardHeader />
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardTabs active={activeTab} setActive={setActiveTab} />

        {/* Dashboard content area */}
        <div className="mt-4">
          {activeTab === "dashboard" && (
            <div className="overview-grid">
              <div className="stats-grid">
                <div className="stat card">
                  <div className="stat-left">
                    <div className="stat-icon blue">
                      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                    </div>
                    <div>
                      <div className="muted">Tổng vật tư</div>
                      <div className="big">{total}</div>
                    </div>
                  </div>
                </div>

                <div className="stat card">
                  <div className="stat-left">
                    <div className="stat-icon greenish">
                      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                    </div>
                    <div>
                      <div className="muted">Hoạt động tốt</div>
                      <div className="big green-text">{working}</div>
                    </div>
                  </div>
                </div>

                <div className="stat card">
                  <div className="stat-left">
                    <div className="stat-icon yellow">
                      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/></svg>
                    </div>
                    <div>
                      <div className="muted">Cần bảo trì</div>
                      <div className="big yellow-text">{maintenance}</div>
                    </div>
                  </div>
                </div>

                <div className="stat card">
                  <div className="stat-left">
                    <div className="stat-icon red">
                      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/></svg>
                    </div>
                    <div>
                      <div className="muted">Hỏng hóc</div>
                      <div className="big red-text">{broken}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="main-grid">
                <div className="chart card">
                  <h3>Phân bố theo trạng thái</h3>
                  <div className="chart-wrap">
                    <canvas ref={chartRef} width="300" height="300" />
                  </div>
                </div>

                <div className="activity card">
                  <h3>Hoạt động gần đây</h3>
                  <div className="activity-list">
                    <div className="act blue">
                      <div className="dot" />
                      <div className="text">Thêm mới vật tư TB005 - Máy xét nghiệm máu</div>
                      <div className="time">2 giờ trước</div>
                    </div>
                    <div className="act yellow">
                      <div className="dot" />
                      <div className="text">Cập nhật trạng thái TB003 - Cần bảo trì</div>
                      <div className="time">1 ngày trước</div>
                    </div>
                    <div className="act green">
                      <div className="dot" />
                      <div className="text">Hoàn thành bảo trì TB002 - Máy siêu âm</div>
                      <div className="time">3 ngày trước</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "equipment" && (
            <div>
              <EquipmentList equipmentData={equipmentData} onDelete={deleteEquipment} onEdit={editEquipment} />
            </div>
          )}

          {activeTab === "add" && (
            <div>
              <AddEquipment onAdd={addEquipment} />
            </div>
          )}

          {activeTab === "export" && (
            <div>
              <ExportEquipment equipmentData={equipmentData} onExport={handleExport} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
