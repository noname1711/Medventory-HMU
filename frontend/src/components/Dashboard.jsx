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

  const initialReplenishmentItems = [
  {
    id: crypto.randomUUID(),
    materialName: "Khẩu trang y tế 3 lớp",
    specification: "Hộp 50 cái",
    unitId: 1,             // ví dụ: 1 = Hộp
    qtyAvailable: 120,
    qtyLastYear: 350,
    qtyRequested: 500,
    materialCode: "VT001",
    manufacturer: "VietMedical",
    reason: "Dự phòng chống dịch"
  },
  {
    id: crypto.randomUUID(),
    materialName: "Găng tay y tế không bột",
    specification: "Size M - Hộp 100 cái",
    unitId: 1,
    qtyAvailable: 80,
    qtyLastYear: 200,
    qtyRequested: 300,
    materialCode: "VT002",
    manufacturer: "GlovesCare",
    reason: "Dùng cho phòng phẫu thuật"
  },
  {
    id: crypto.randomUUID(),
    materialName: "Dung dịch sát khuẩn",
    specification: "Chai 500ml",
    unitId: 2,             // ví dụ: 2 = Chai
    qtyAvailable: 25,
    qtyLastYear: 40,
    qtyRequested: 60,
    materialCode: "VT003",
    manufacturer: "SterilMax",
    reason: "Bổ sung kho vật tư"
  },
  {
    id: crypto.randomUUID(),
    materialName: "Băng gạc y tế vô trùng",
    specification: "20cm x 20cm",
    unitId: 3,             // ví dụ: 3 = Cái
    qtyAvailable: 500,
    qtyLastYear: 850,
    qtyRequested: 1000,
    materialCode: "VT004",
    manufacturer: "MediCare",
    reason: "Nhu cầu sử dụng tăng"
  },
  {
    id: crypto.randomUUID(),
    materialName: "Ống tiêm 5ml",
    specification: "Hộp 100 cái",
    unitId: 1,
    qtyAvailable: 60,
    qtyLastYear: 150,
    qtyRequested: 300,
    materialCode: "VT005",
    manufacturer: "SafeInject",
    reason: "Chuẩn bị tiêm chủng"
  },
];



  const emptyRow = {
  id: crypto.randomUUID(),       // tạo id unique
  materialName: "",
  specification: "",
  unitId: "",
  qtyAvailable: "",
  qtyLastYear: "",
  qtyRequested: "",
  materialCode: "",
  manufacturer: "",
  reason: "",
};

const [items, setItems] = useState(initialReplenishmentItems);
const [units, setUnits] = useState([]);
const [materials, setMaterials] = useState([]);
const fetchMaterials = async () => {
  try {
    const response = await fetch("http://localhost:8080/api/materials");
    const data = await response.json();
    console.log("Materials từ BE:", data);
    setMaterials(data);
  } catch (error) {
    console.error("Lỗi khi lấy materials:", error);
  }
};


const [note, setNote] = useState("");

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

  useEffect(() => {
  fetch("http://localhost:8080/api/units")
    .then((res) => res.json())
    .then((data) => setUnits(data));
}, []);

useEffect(() => {
  fetchMaterials();
}, []);


function addRow() {
  setItems((prev) => [...prev, { ...emptyRow, id: crypto.randomUUID() }]);
}

function deleteRow(id) {
  setItems((prev) => prev.filter((i) => i.id !== id));
}

function changeItem(index, e) {
  const { name, value } = e.target;
  setItems((prev) => {
    const updated = [...prev];
    updated[index][name] = value;
    return updated;
  });
}

async function submit(e) {
  e.preventDefault();

  // Nếu chưa có userInfo, lấy từ localStorage
  const currentUser = userInfo || JSON.parse(localStorage.getItem("currentUser") || "null");

  const payload = {
    academicYear: "2025-2026", // hoặc bạn có thể tạo input cho người dùng chọn
    departmentId: null,         // optional, set nếu bạn có id phòng ban
    createdByEmail: currentUser?.email || null,
    items: items.map(it => ({
      materialId: it.materialId ? Number(it.materialId) : null,  // nếu UI có materialId
      currentStock: it.qtyAvailable ? Number(it.qtyAvailable) : 0,
      prevYearQty: it.qtyLastYear ? Number(it.qtyLastYear) : 0,
      thisYearQty: it.qtyRequested ? Number(it.qtyRequested) : 0,
      proposedCode: it.materialCode || null,
      proposedManufacturer: it.manufacturer || null,
      justification: it.reason || null
    }))
  };

  try {
    const res = await fetch("http://localhost:8080/api/supp-forecasts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // nếu bạn dùng token: Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Đã gửi phiếu",
        text: data.message || "Tạo phiếu thành công",
        timer: 1800,
        showConfirmButton: false
      });

      // reset lại form
      setItems([ { ...emptyRow, id: crypto.randomUUID() } ]);
      setNote("");
      // có thể chuyển tab hay reload danh sách
    } else {
      Swal.fire({
        icon: "error",
        title: "Gửi thất bại",
        text: (data && data.message) ? data.message : "Lỗi server"
      });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: "Lỗi kết nối",
      text: err.message || "Không thể kết nối tới server"
    });
  }
}


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

  function deleteItem(id) {
  const item = items.find((i) => i.id === id);

  Swal.fire({
    title: "🗑️ Xác nhận xóa?",
    text: `Bạn có chắc chắn muốn xóa vật tư “${item.materialName}”?`,
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
      setItems((prev) => prev.filter((i) => i.id !== id));

      Swal.fire({
        title: "✅ Đã xóa!",
        text: `Vật tư “${item.materialName}” đã bị xóa khỏi danh sách.`,
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        backdrop: true,
      });
    }
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
          {activeTab === "replenish" && (
  <ReplenishmentRequest
    items={items}
    units={units}
    materials={materials}   // ✅ Thêm dòng này
    note={note}
    onChangeNote={setNote}
    onChangeItem={changeItem}
    onAddRow={addRow}
    onDeleteRow={deleteRow}
    onSubmit={submit}
  />
)}


        </div>
      </div>
    </div>
  );
}