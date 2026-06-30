import React, { useEffect, useMemo, useRef, useState } from "react";
import "./DashboardTabs.css";

const API_URL = "http://localhost:8080/api";

// Prototype monochrome line-icon set (stroke paths from the redesign mockup).
const TAB_ICON_PATHS = {
  equipment: ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M4 7.5l8 4.5 8-4.5", "M12 12v9"],
  "create-issue": ["M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
  approval: ["M12 21a9 9 0 100-18 9 9 0 000 18z", "M8.5 12l2.4 2.4 4.6-5"],
  replenish: ["M4 20h16", "M6 20v-5", "M12 20V8", "M18 20v-9"],
  forecast: ["M12 21a9 9 0 100-18 9 9 0 000 18z", "M8.5 12l2.4 2.4 4.6-5"],
  receipt: ["M12 3v9", "M8.5 9.5L12 13l3.5-3.5", "M4 14h4l1.2 2h5.6l1.2-2h4", "M4 14v3a2 2 0 002 2h12a2 2 0 002-2v-3"],
  issue: ["M12 13V4", "M8.5 7.5L12 4l3.5 3.5", "M4 14v3a2 2 0 002 2h12a2 2 0 002-2v-3"],
  admin: ["M9 11a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z", "M3 20v-1a6 6 0 0112 0v1", "M16.5 4.6a3 3 0 010 5.8", "M18 20v-1a5 5 0 00-3.5-4.8"],
  rbac: ["M12 3l7.5 2.8v5.7c0 4.6-3.2 7.4-7.5 8.5-4.3-1.1-7.5-3.9-7.5-8.5V5.8z", "M9 12l2 2 4-4"],
};

function TabIcon({ name }) {
  const paths = TAB_ICON_PATHS[name] || [];
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flex: "none" }}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export default function DashboardTabs({ active, setActive, onVisibleTabsChange }) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const userId = currentUser?.id;

  const [permCodes, setPermCodes] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const hasLoadedPerms = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchPerms() {
      try {
        if (!hasLoadedPerms.current) {
          setLoadingPerms(true);
        }

        if (!userId) {
          if (!cancelled) setPermCodes([]);
          return;
        }

        const res = await fetch(`${API_URL}/auth/my-permissions`, {
          method: "GET",
          headers: {
            "X-User-Id": String(userId),
          },
        });

        if (!res.ok) {
          if (!cancelled) setPermCodes([]);
          return;
        }

        const data = await res.json();
        const codes = Array.isArray(data?.permissionCodes) ? data.permissionCodes : [];
        if (!cancelled) setPermCodes(codes);
      } catch {
        if (!cancelled) setPermCodes([]);
      } finally {
        if (!cancelled) {
          hasLoadedPerms.current = true;
          setLoadingPerms(false);
        }
      }
    }

    fetchPerms();

    // Nếu muốn tab tự cập nhật khi Admin đổi quyền trong lúc user đang mở:
    const t = setInterval(fetchPerms, 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [userId]);

  const permSet = useMemo(() => {
    return new Set((permCodes || []).map((x) => String(x || "").trim()).filter(Boolean));
  }, [permCodes]);

  const hasPerm = (code) => permSet.has(code);

  // Mapping tab -> permission
  const showEquipment = hasPerm("MATERIAL.VIEW");
  const showReplenish = hasPerm("SUPP_FORECAST.CREATE");
  const showReceipt   = hasPerm("RECEIPT.CREATE");
  const showIssue     = hasPerm("ISSUE.CREATE");

  const showCreateIssueReq  = hasPerm("ISSUE_REQ.CREATE");
  const showApproveIssueReq = hasPerm("ISSUE_REQ.APPROVE");

  const showForecastApprove = hasPerm("SUPP_FORECAST.APPROVE");
  
  // Quản lý RBAC - phân quyền
  const showRBACManage      = hasPerm("PERMISSIONS.MANAGE");
  
  // QUẢN LÝ USERS
  const showAdminManage     = hasPerm("USERS.MANAGE");

  const visibleTabs = useMemo(() => {
    const tabs = [];
    if (showEquipment) tabs.push("equipment");
    if (showReplenish) tabs.push("replenish");
    if (showReceipt) tabs.push("receipt");
    if (showIssue) tabs.push("issue");
    if (showCreateIssueReq) tabs.push("create-issue");
    if (showApproveIssueReq) tabs.push("approval");
    if (showForecastApprove) tabs.push("forecast");
    if (showAdminManage) tabs.push("admin");
    if (showRBACManage) tabs.push("rbac");
    return tabs;
  }, [
    showEquipment,
    showReplenish,
    showReceipt,
    showIssue,
    showCreateIssueReq,
    showApproveIssueReq,
    showForecastApprove,
    showAdminManage,
    showRBACManage,
  ]);

  useEffect(() => {
    if (loadingPerms || visibleTabs.length === 0 || visibleTabs.includes(active)) return;
    setActive(visibleTabs[0]);
  }, [active, loadingPerms, setActive, visibleTabs]);

  useEffect(() => {
    if (typeof onVisibleTabsChange !== "function") return;
    onVisibleTabsChange({ visibleTabs, loading: loadingPerms });
  }, [loadingPerms, onVisibleTabsChange, visibleTabs]);

  const btnClass = (name) => `dt-tab ${active === name ? "active" : ""}`;

  return (
    <nav className="dt-nav">
      <div className="dt-nav-inner">

      {showEquipment && (
        <button className={btnClass("equipment")} onClick={() => setActive("equipment")}>
          <TabIcon name="equipment" /> Danh sách vật tư
        </button>
      )}

      {showReplenish && (
        <button className={btnClass("replenish")} onClick={() => setActive("replenish")}>
          <TabIcon name="replenish" /> Tạo phiếu dự trù
        </button>
      )}

      {showReceipt && (
        <button className={btnClass("receipt")} onClick={() => setActive("receipt")}>
          <TabIcon name="receipt" /> Nhập kho
        </button>
      )}

      {showIssue && (
        <button className={btnClass("issue")} onClick={() => setActive("issue")}>
          <TabIcon name="issue" /> Xuất kho
        </button>
      )}

      {showCreateIssueReq && (
        <button className={btnClass("create-issue")} onClick={() => setActive("create-issue")}>
          <TabIcon name="create-issue" /> Tạo phiếu xin lĩnh
        </button>
      )}

      {showApproveIssueReq && (
        <button className={btnClass("approval")} onClick={() => setActive("approval")}>
          <TabIcon name="approval" /> Phê duyệt phiếu xin lĩnh
        </button>
      )}

      {showForecastApprove && (
        <button className={btnClass("forecast")} onClick={() => setActive("forecast")}>
          <TabIcon name="forecast" /> Phê duyệt dự trù
        </button>
      )}

      {showAdminManage && (
        <button className={btnClass("admin")} onClick={() => setActive("admin")}>
          <TabIcon name="admin" /> Quản lý người dùng
        </button>
      )}

      {showRBACManage && (
        <button className={btnClass("rbac")} onClick={() => setActive("rbac")}>
          <TabIcon name="rbac" /> Phân quyền vai trò
        </button>
      )}

        {/* Optional: nếu muốn hiển thị trạng thái */}
        {loadingPerms && <span className="dt-perm-loading">Đang đồng bộ quyền...</span>}
      </div>
    </nav>
  );
}
