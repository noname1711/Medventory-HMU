import React from "react";
import "./DashboardTabs.css";

export default function DashboardTabs({ active, setActive }) {
  // Lấy thông tin user từ localStorage
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // Kiểm tra role
  const isLeader = currentUser.roleCheck === 1;     // Lãnh đạo
  const isStorekeeper = currentUser.roleCheck === 2; // Thủ kho
  const isCanBo = currentUser.roleCheck === 3;       // Cán bộ
  
  const btnClass = (name) => `dt-tab ${active === name ? "active" : ""}`;

  return (
    <nav className="dt-nav max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <button className={btnClass("dashboard")} onClick={() => setActive("dashboard")}>
        Tổng quan
      </button>
      
      <button className={btnClass("equipment")} onClick={() => setActive("equipment")}>
        Danh sách vật tư
      </button>
      
      {/* CHỈ HIỂN THỊ TAB NHẬP/XUẤT KHO NẾU LÀ THỦ KHO */}
      {isStorekeeper && (
        <>
          <button className={btnClass("add")} onClick={() => setActive("add")}>
            Nhập kho
          </button>
          
          <button className={btnClass("export")} onClick={() => setActive("export")}>
            Xuất kho
          </button>
        </>
      )}
      
      {/* CHỈ HIỂN THỊ TAB TẠO PHIẾU XIN LĨNH NẾU LÀ CÁN BỘ */}
      {isCanBo && (
        <button className={btnClass("create-issue")} onClick={() => setActive("create-issue")}>
          Tạo phiếu xin lĩnh
        </button>
      )}
      
      {/* CHỈ HIỂN THỊ TAB PHÊ DUYỆT NẾU LÀ LÃNH ĐẠO */}
      {isLeader && (
        <button className={btnClass("approval")} onClick={() => setActive("approval")}>
          Phê duyệt phiếu xin lĩnh
        </button>
      )}
    </nav>
  );
}