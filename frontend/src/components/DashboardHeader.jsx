import React from "react";
import "./DashboardHeader.css";

export default function DashboardHeader() {
  return (
    <header className="dh-header">
      <div className="dh-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="dh-left">
          <div className="dh-logo">
             <img
              src="/logo.jpg"
              alt="Logo"
              className="dh-logo"
            />
          </div>
          <div className="dh-brand">
            <h1>Quản lý Vật tư Y tế</h1>
            <p className="dh-sub">Bệnh viện Đại học Y Hà Nội</p>
          </div>
        </div>

        <div className="dh-right">
          <div className="dh-usertext">
            <div className="dh-username">BS. Nguyễn Văn An</div>
            <div className="dh-userrole">Trưởng khoa Thiết bị Y tế</div>
          </div>
          <div className="dh-avatar">NA</div>
        </div>
      </div>
    </header>
  );
}
