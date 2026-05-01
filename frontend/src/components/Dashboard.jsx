import React, { useEffect, useState } from "react";
import DashboardHeader from "./DashboardHeader";
import DashboardTabs from "./DashboardTabs";
import EquipmentList from "./EquipmentList";
import Admin from "./Admin";
import RBACSection from "./RBACSection";
import IssueRequestApproval from "./IssueRequestApproval";
import CreateIssueRequest from "./CreateIssueRequest";
import ReplenishmentRequest from "./ReplenishmentRequest";
import ForecastApproval from "./ForecastApproval";
import ReceiptPage from "./ReceiptPage";
import IssuePage from "./IssuePage";
import { ROLE_DISPLAY_MAPPING } from "./dashboardConstants";
import "./Dashboard.css";

export default function Dashboard() {
  const [userInfo, setUserInfo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("equipment");

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (!savedUser) {
      setUserInfo(null);
      setIsAdmin(false);
      return;
    }

    try {
      const userData = JSON.parse(savedUser);
      setUserInfo({
        ...userData,
        role: ROLE_DISPLAY_MAPPING[userData.role] || userData.role,
      });
      setIsAdmin(userData.isBanGiamHieu === true);
    } catch {
      setUserInfo(null);
      setIsAdmin(false);
    }
  }, []);

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
          {activeTab === "equipment" && <EquipmentList />}
          {activeTab === "approval" && <IssueRequestApproval />}
          {activeTab === "create-issue" && <CreateIssueRequest />}
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
