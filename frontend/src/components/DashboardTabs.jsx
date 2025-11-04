import React from "react";
import "./DashboardTabs.css";

export default function DashboardTabs({ active, setActive }) {
  const btnClass = (name) => `dt-tab ${active === name ? "active" : ""}`;

  return (
    <nav className="dt-nav max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <button className={btnClass("dashboard")} onClick={() => setActive("dashboard")}>📊 Tổng quan</button>
      <button className={btnClass("equipment")} onClick={() => setActive("equipment")}>🏥 Danh sách vật tư</button>
      <button className={btnClass("add")} onClick={() => setActive("add")}>➕ Nhập kho</button>
      <button className={btnClass("export")} onClick={() => setActive("export")}>📤 Xuất kho</button>
    </nav>
  );
}
