import React, { useCallback, useEffect, useState } from "react";
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
  const [visibleTabs, setVisibleTabs] = useState([]);
  const [tabsLoading, setTabsLoading] = useState(true);

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
      setIsAdmin(userData.isAdmin === true);
    } catch {
      setUserInfo(null);
      setIsAdmin(false);
    }
  }, []);

  const handleVisibleTabsChange = useCallback(({ visibleTabs: nextVisibleTabs, loading }) => {
    setVisibleTabs(nextVisibleTabs || []);
    setTabsLoading(!!loading);
  }, []);

  const canRenderActiveTab = !tabsLoading && visibleTabs.includes(activeTab);

  return (
    <div className="dashboard-page">
      <DashboardHeader userInfo={userInfo} />

      <DashboardTabs
        active={activeTab}
        setActive={setActiveTab}
        isAdmin={isAdmin}
        onVisibleTabsChange={handleVisibleTabsChange}
      />

      <main className="dashboard-main">
        <div className="dashboard-content">
          {tabsLoading && <div className="ui-empty">Đang đồng bộ quyền...</div>}
          {canRenderActiveTab && activeTab === "equipment" && <EquipmentList />}
          {canRenderActiveTab && activeTab === "approval" && <IssueRequestApproval />}
          {canRenderActiveTab && activeTab === "create-issue" && <CreateIssueRequest />}
          {canRenderActiveTab && activeTab === "replenish" && <ReplenishmentRequest />}
          {canRenderActiveTab && activeTab === "receipt" && <ReceiptPage />}
          {canRenderActiveTab && activeTab === "issue" && <IssuePage />}
          {canRenderActiveTab && activeTab === "forecast" && userInfo && <ForecastApproval adminInfo={userInfo} />}
          {canRenderActiveTab && activeTab === "admin" && <Admin />}
          {canRenderActiveTab && activeTab === "rbac" && <RBACSection />}
        </div>
      </main>
    </div>
  );
}
