import React, { useEffect, useMemo, useState } from "react";
import "./DashboardTabs.css";

const API_URL = "http://localhost:8080/api";

export default function DashboardTabs({ active, setActive }) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const userId = currentUser?.id;

  const [permCodes, setPermCodes] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPerms() {
      try {
        setLoadingPerms(true);

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
        if (!cancelled) setLoadingPerms(false);
      }
    }

    fetchPerms();

    // Nếu muốn tab tự cập nhật khi BGH đổi quyền trong lúc user đang mở:
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
  const showReplenish = hasPerm("SUPP_FORECAST.CREATE");
  const showReceipt   = hasPerm("RECEIPT.CREATE");
  const showIssue     = hasPerm("ISSUE.CREATE");

  const showCreateIssueReq  = hasPerm("ISSUE_REQ.CREATE");
  const showApproveIssueReq = hasPerm("ISSUE_REQ.APPROVE");

  const showForecastApprove = hasPerm("SUPP_FORECAST.APPROVE");
  
  // Quản lý RBAC - phân quyền
  const showRBACManage      = hasPerm("PERMISSIONS.MANAGE");
  
  // QUẢN LÝ USERS
  const showAdminManage     = hasPerm("USERS.MANAGE") || currentUser?.isBanGiamHieu;

  const btnClass = (name) => `dt-tab ${active === name ? "active" : ""}`;

  return (
    <nav className="dt-nav max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <button className={btnClass("equipment")} onClick={() => setActive("equipment")}>
        Danh sách vật tư
      </button>

      {showReplenish && (
        <button className={btnClass("replenish")} onClick={() => setActive("replenish")}>
          Tạo phiếu dự trù
        </button>
      )}

      {showReceipt && (
        <button className={btnClass("receipt")} onClick={() => setActive("receipt")}>
          Nhập kho
        </button>
      )}

      {showIssue && (
        <button className={btnClass("issue")} onClick={() => setActive("issue")}>
          Xuất kho
        </button>
      )}

      {showCreateIssueReq && (
        <button className={btnClass("create-issue")} onClick={() => setActive("create-issue")}>
          Tạo phiếu xin lĩnh
        </button>
      )}

      {showApproveIssueReq && (
        <button className={btnClass("approval")} onClick={() => setActive("approval")}>
          Phê duyệt phiếu xin lĩnh
        </button>
      )}

      {showForecastApprove && (
        <button className={btnClass("forecast")} onClick={() => setActive("forecast")}>
          Phê duyệt dự trù
        </button>
      )}

      {showAdminManage && (
        <button className={btnClass("admin")} onClick={() => setActive("admin")}>
          Quản lý người dùng
        </button>
      )}

      {showRBACManage && (
        <button className={btnClass("rbac")} onClick={() => setActive("rbac")}>
          Phân quyền vai trò
        </button>
      )}

      {/* Optional: nếu muốn hiển thị trạng thái */}
      {loadingPerms && <span className="dt-perm-loading">Đang đồng bộ quyền...</span>}
    </nav>
  );
}