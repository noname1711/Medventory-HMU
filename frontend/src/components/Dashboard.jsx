import React, { useEffect, useRef, useState } from "react";
import DashboardHeader from "./DashboardHeader";
import DashboardTabs from "./DashboardTabs";
import EquipmentList from "./EquipmentList";
import AddEquipment from "./AddEquipment";
import ExportEquipment from "./ExportEquipment";
import Admin from "./Admin";
import RBACSection from "./RBACSection";
import IssueRequestApproval from './IssueRequestApproval';
import CreateIssueRequest from "./CreateIssueRequest";
import ReplenishmentRequest from "./ReplenishmentRequest";
import ForecastApproval from "./ForecastApproval";
import ReceiptPage from "./ReceiptPage"; 
import IssuePage from "./IssuePage"; 
import Swal from "sweetalert2";
import "./Dashboard.css";

export default function Dashboard() {
  const [userInfo, setUserInfo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const initialData = [
    { id: 1, code: "TB001", name: "Máy X-quang", department: "Khoa Nội", status: "Hoạt động tốt", date: "2023-01-15", value: 500000000 },
    { id: 2, code: "TB002", name: "Máy siêu âm", department: "Khoa Sản", status: "Hoạt động tốt", date: "2023-02-20", value: 300000000 },
    { id: 3, code: "TB003", name: "Máy thở", department: "Khoa Cấp cứu", status: "Cần bảo trì", date: "2022-12-10", value: 800000000 },
    { id: 4, code: "TB004", name: "Máy ECG", department: "Khoa Nội", status: "Hỏng hóc", date: "2023-03-05", value: 150000000 },
    { id: 5, code: "TB005", name: "Máy xét nghiệm máu", department: "Khoa Xét nghiệm", status: "Hoạt động tốt", date: "2023-01-30", value: 400000000 }
  ];

  const [equipmentData, setEquipmentData] = useState(initialData);
  const [nextId, setNextId] = useState(6);
  const [activeTab, setActiveTab] = useState("equipment");

  // Role mapping để hiển thị tiếng Việt
  const roleDisplayMapping = {
    "lanhdao": "Lãnh đạo",
    "thukho": "Thủ kho", 
    "canbo": "Cán bộ"
  };

  // LẤY THÔNG TIN USER KHI COMPONENT MOUNT
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        console.log("User data from localStorage:", userData); // DEBUG
        
        // Chuyển đổi role từ backend enum sang tiếng Việt để hiển thị
        const formattedUserData = {
          ...userData,
          role: roleDisplayMapping[userData.role] || userData.role
        };
        
        setUserInfo(formattedUserData);
        
        // Kiểm tra nếu user là Ban giám hiệu
        const isBanGiamHieu = userData.isBanGiamHieu === true;
        setIsAdmin(isBanGiamHieu);
        
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    } else {
      console.log("No user data in localStorage");
    }
  }, []);

  // === HÀNH ĐỘNG ===

  function addEquipment(newEq) {
    setEquipmentData((prev) => [...prev, { ...newEq, id: nextId }]);
    setNextId((id) => id + 1);
    setActiveTab("equipment");

    Swal.fire({
      title: "🎉 Thêm vật tư thành công!",
      text: `Đã thêm "$${newEq.name}" vào danh sách.`,
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
      text: `Bạn có chắc chắn muốn xóa vật tư "$${eq.name}"?`,
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
          text: `Vật tư "$${eq.name}" đã bị xóa.`,
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
      text: `Tính năng chỉnh sửa vật tư "$${eq.name}" đang được phát triển.`,
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

  // === GIAO DIỆN ===
  return (
    <div className="dashboard-page">
      <DashboardHeader userInfo={userInfo} />
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardTabs 
          active={activeTab} 
          setActive={setActiveTab} 
          isAdmin={isAdmin} 
        />

        <div className="mt-4">
          {activeTab === "equipment" && (
            <EquipmentList equipmentData={equipmentData} onDelete={deleteEquipment} onEdit={editEquipment} />
          )}
          {activeTab === "approval" && <IssueRequestApproval />}
          {activeTab === "create-issue" && <CreateIssueRequest />}
          {activeTab === "add" && <AddEquipment onAdd={addEquipment} />}
          {activeTab === "export" && <ExportEquipment equipmentData={equipmentData} onExport={handleExport} />}
          {activeTab === "replenish" && <ReplenishmentRequest />}
          {activeTab === "receipt" && <ReceiptPage />}
          {activeTab === "issue" && <IssuePage />}
          {activeTab === "forecast" && userInfo && <ForecastApproval adminInfo={userInfo} />}
          {activeTab === "admin" && <Admin />}
          {activeTab === "rbac" && <RBACSection />}
        </div>
      </div>
    </div>
  );
}