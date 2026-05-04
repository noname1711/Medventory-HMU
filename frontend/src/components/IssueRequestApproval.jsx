import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./IssueRequestApproval.css";

const API_URL = "http://localhost:8080/api";

function fmtDate(s) {
  if (!s) return "—";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
}

function fmtDateTime(s) {
  if (!s) return "—";
  const str = String(s).replace("T", " ");
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}`;
  return fmtDate(s);
}

function visiblePageNumbers(totalPages, currentPage) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(0, Number(currentPage) || 0), total - 1);
  const start = Math.max(0, current - 2);
  const end = Math.min(total - 1, start + 4);
  const adjustedStart = Math.max(0, end - 4);
  const pages = [];
  for (let i = adjustedStart; i <= end; i += 1) pages.push(i);
  return pages;
}

export default function IssueRequestApproval() {
  const PAGE_SIZE = 10;
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [processedRequests, setProcessedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");
  const [currentAction, setCurrentAction] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  const [categories, setCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [, setAccessDeniedMsg] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

  const getAuthToken = () => {
    const tokenDirect =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken");

    if (tokenDirect && tokenDirect.trim()) return tokenDirect.trim();

    const currentUserRaw = localStorage.getItem("currentUser");
    if (currentUserRaw) {
      try {
        const u = JSON.parse(currentUserRaw);
        const tokenFromUser = u?.token || u?.accessToken || u?.jwt || u?.authToken;
        if (tokenFromUser && String(tokenFromUser).trim()) return String(tokenFromUser).trim();
        if (u?.id != null) return `user-token-${u.id}`;
      } catch {
        return null;
      }
    }
    return null;
  };

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const buildHeaders = (extra = {}) => {
    const headers = { ...authHeaders(), ...extra };
    if (currentUser?.id != null) {
      headers["X-User-Id"] = String(currentUser.id);
    }
    return headers;
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/materials/categories`, {
        headers: { ...buildHeaders() },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      } else {
        setCategories([]);
      }
    } catch {
      setCategories([]);
    }
  };

  const checkAccessAndLoad = async () => {
    if (!currentUser?.id) {
      setAccessDenied(true);
      setAccessDeniedMsg("Bạn chưa đăng nhập hoặc thiếu thông tin user.");
      setCheckingAccess(false);
      return;
    }

    setCheckingAccess(true);
    setAccessDenied(false);
    setAccessDeniedMsg("");
    setIsLoading(true);

    try {
      await fetchCategories();

      const pendingRes = await fetch(`${API_URL}/issue-requests/leader/pending`, {
        headers: { ...buildHeaders() },
      });

      if (pendingRes.status === 403) {
        setAccessDenied(true);
        setAccessDeniedMsg("Tài khoản không có quyền phê duyệt phiếu xin lĩnh.");
        setPendingRequests([]);
        setProcessedRequests([]);
        return;
      }

      if (!pendingRes.ok) {
        const t = await pendingRes.text();
        throw new Error(t || `HTTP ${pendingRes.status}`);
      }

      const pendingData = await pendingRes.json();

      const processedRes = await fetch(`${API_URL}/issue-requests/leader/processed`, {
        headers: { ...buildHeaders() },
      });

      if (processedRes.status === 403) {
        setAccessDenied(true);
        setAccessDeniedMsg("Không thể tải lịch sử phê duyệt. Tài khoản chưa được cấp quyền.");
        setPendingRequests(pendingData?.requests || []);
        setProcessedRequests([]);
        return;
      }

      if (!processedRes.ok) {
        const t = await processedRes.text();
        throw new Error(t || `HTTP ${processedRes.status}`);
      }

      const processedData = await processedRes.json();

      setPendingRequests(pendingData?.success ? pendingData.requests || [] : []);
      setProcessedRequests(processedData?.success ? processedData.requests || [] : []);
      setInitialLoad(false);
    } catch {
      toast.error("Lỗi kết nối server");
      setPendingRequests([]);
      setProcessedRequests([]);
    } finally {
      setIsLoading(false);
      setCheckingAccess(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await fetch(`${API_URL}/issue-requests/leader/pending`, {
        headers: { ...buildHeaders() },
      });

      if (response.status === 403) {
        setAccessDenied(true);
        setAccessDeniedMsg("Không có quyền truy cập khi tải danh sách chờ duyệt.");
        setPendingRequests([]);
        return;
      }

      const data = await response.json();
      if (data.success) setPendingRequests(data.requests || []);
    } catch {
      toast.error("Lỗi tải phiếu chờ duyệt");
      setPendingRequests([]);
    }
  };

  const fetchProcessedRequests = async () => {
    if (!currentUser?.id) return;
    try {
      const response = await fetch(`${API_URL}/issue-requests/leader/processed`, {
        headers: { ...buildHeaders() },
      });

      if (response.status === 403) {
        setAccessDenied(true);
        setAccessDeniedMsg("Không có quyền truy cập khi tải lịch sử phê duyệt.");
        setProcessedRequests([]);
        return;
      }

      const data = await response.json();
      if (data.success) setProcessedRequests(data.requests || []);
    } catch {
      toast.error("Lỗi tải lịch sử phê duyệt");
      setProcessedRequests([]);
    }
  };

  const fetchRequestDetail = async (requestId) => {
    if (!currentUser?.id) return;

    setIsDetailLoading(true);
    try {
      const response = await fetch(`${API_URL}/issue-requests/${requestId}/detail`, {
        headers: { ...buildHeaders() },
      });

      if (response.status === 403) {
        toast.error("Bạn không có quyền xem chi tiết phiếu này (403).");
        return;
      }

      const data = await response.json();
      if (data.success) {
        setSelectedRequest({
          ...data,
          details: data.details?.map((detail) => ({ ...detail })) || [],
        });
      } else {
        toast.error(data.message || "Không thể tải chi tiết");
      }
    } catch {
      toast.error("Lỗi kết nối server");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const getCategoryInfo = (categoryValue) => {
    if (categories.length > 0) {
      const category = categories.find((cat) => cat.value === categoryValue);
      return category || { label: `Loại ${categoryValue}`, description: "Không xác định" };
    }
    return { label: `Loại ${categoryValue}`, description: "Thông tin từ server" };
  };

  const openApprovalModal = (action, request) => {
    setCurrentAction(action);
    setSelectedRequest((current) => {
      if (current?.header?.id === request?.id && Array.isArray(current?.details)) {
        return current;
      }
      return { header: request };
    });
    setShowApprovalModal(true);
    setApprovalNote("");
  };

  const handleConfirmAction = () => {
    if (!selectedRequest?.header?.id) {
      toast.error("Không tìm thấy ID phiếu");
      return;
    }
    if (currentAction === "reject" && !approvalNote.trim()) {
      toast.error("Vui lòng nhập lý do từ chối");
      return;
    }
    handleApprovalAction(currentAction, selectedRequest.header.id);
  };

  const handleApprovalAction = async (action, requestId) => {
    try {
      const endpoint = { approve: "approve", reject: "reject", adjust: "request-adjustment" }[action];

      const response = await fetch(`${API_URL}/issue-requests/${requestId}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders({ "Content-Type": "application/json" }),
        },
        body: JSON.stringify({
          note: approvalNote || "",
          approverId: currentUser.id,
        }),
      });

      if (response.status === 403) {
        toast.error("Không có quyền truy cập. Bạn không có quyền thực hiện thao tác này.");
        return;
      }

      const data = await response.json();
      if (data.success) {
        const message = {
          approve: "Đã phê duyệt phiếu thành công",
          reject: "Đã từ chối phiếu thành công",
          adjust: "Đã gửi yêu cầu điều chỉnh thành công",
        }[action];

        toast.success(message);
        setShowApprovalModal(false);
        setApprovalNote("");
        await fetchPendingRequests();
        await fetchProcessedRequests();
        setSelectedRequest(null);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Lỗi kết nối server");
    }
  };

  const getActionName = (action) => ({ approve: "phê duyệt", reject: "từ chối", adjust: "yêu cầu điều chỉnh" }[action] || "xử lý");
  const getModalTitle = (action) => ({ approve: "Phê duyệt phiếu", reject: "Từ chối phiếu", adjust: "Yêu cầu điều chỉnh" }[action] || "Xác nhận");
  const getPlaceholderText = (action) =>
    ({
      approve: "Nhập ghi chú phê duyệt (không bắt buộc)...",
      reject: "Nhập lý do từ chối...",
      adjust: "Nhập yêu cầu điều chỉnh...",
    }[action] || "Nhập ghi chú...");

  const getActionButtonClass = (action) =>
    ({
      approve: "ui-btn ui-btn-primary",
      reject: "ui-btn ui-btn-danger",
      adjust: "ui-btn ui-btn-warning",
    }[action] || "ui-btn ui-btn-primary");

  const getStatusUiClass = (request) => {
    const badge = String(request?.statusBadge || "").toLowerCase();
    const name = String(request?.statusName || "").toLowerCase();
    const status = Number(request?.status);

    if (badge.includes("approved") || name.includes("duyệt") || status === 1) return "is-approved";
    if (badge.includes("rejected") || name.includes("từ chối") || status === 2) return "is-rejected";
    if (badge.includes("pending") || name.includes("chờ") || status === 0) return "is-pending";
    return "is-info";
  };

  const canActOnRequest = (request) => {
    const badge = String(request?.statusBadge || "").toLowerCase();
    const name = String(request?.statusName || "").toLowerCase();
    const status = Number(request?.status);

    return activeTab === "pending" && (badge.includes("pending") || name.includes("chờ") || status === 0);
  };

  useEffect(() => {
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialLoad && !accessDenied) {
      if (activeTab === "pending") fetchPendingRequests();
      else fetchProcessedRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const currentRequests = activeTab === "pending" ? pendingRequests : processedRequests;
  const currentTabLoading = isLoading && initialLoad;
  const totalPages = Math.max(1, Math.ceil(currentRequests.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const pagedRequests = currentRequests.slice(
    safeCurrentPage * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE + PAGE_SIZE
  );

  const summary = useMemo(
    () => ({
      total: pendingRequests.length + processedRequests.length,
      pending: pendingRequests.length,
      processed: processedRequests.length,
    }),
    [pendingRequests.length, processedRequests.length]
  );

  if (checkingAccess) {
    return (
      <div className="ui-page issue-request-approval-page">
        <div className="ui-page-frame">
          <div className="ira-loading-state">
            <div className="ira-loading-spinner"></div>
            <p>Đang kiểm tra quyền truy cập...</p>
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="ui-page issue-request-approval-page">
        <div className="ui-page-frame">
          <div className="ui-alert is-error">
            <strong>Không có quyền truy cập.</strong> Tài khoản của bạn chưa được cấp quyền phê duyệt phiếu xin lĩnh. Liên hệ quản trị viên nếu cần hỗ trợ.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page issue-request-approval-page">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Phê duyệt Phiếu xin lĩnh</h1>
          </div>
        </div>

        <div className="ui-stat-grid">
          <div className="ui-stat-card is-primary">
            <p className="ui-stat-label">Tổng phiếu</p>
            <p className="ui-stat-value">{summary.total}</p>
            <p className="ui-stat-note">Cả đang chờ và đã xử lý</p>
          </div>
          <div className="ui-stat-card is-warning">
            <p className="ui-stat-label">Chờ phê duyệt</p>
            <p className="ui-stat-value">{summary.pending}</p>
            <p className="ui-stat-note">Cần xử lý ngay</p>
          </div>
          <div className="ui-stat-card">
            <p className="ui-stat-label">Đã xử lý</p>
            <p className="ui-stat-value">{summary.processed}</p>
            <p className="ui-stat-note">Đã duyệt hoặc từ chối</p>
          </div>
        </div>

        <div className="ui-section">
          <div className="ui-tabs">
            <button
              className={`ui-tab ${activeTab === "pending" ? "is-active" : ""}`}
              onClick={() => {
                setActiveTab("pending");
                setCurrentPage(0);
              }}
            >
              Chờ phê duyệt ({pendingRequests.length})
            </button>
            <button
              className={`ui-tab ${activeTab === "history" ? "is-active" : ""}`}
              onClick={() => {
                setActiveTab("history");
                setCurrentPage(0);
              }}
            >
              Lịch sử ({processedRequests.length})
            </button>
          </div>

          {currentTabLoading ? (
            <div className="ira-loading-state">
              <div className="ira-loading-spinner"></div>
              <p>Đang tải dữ liệu...</p>
            </div>
          ) : currentRequests.length === 0 ? (
            <div className="ira-empty-state">
              <h3>{activeTab === "pending" ? "Không có phiếu nào chờ phê duyệt" : "Chưa có lịch sử phê duyệt"}</h3>
              <p>Khi có phiếu xin lĩnh mới, chúng sẽ xuất hiện ở đây.</p>
            </div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table ira-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Người gửi</th>
                    <th>Đơn vị</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="ira-cell-id" data-label="Mã phiếu">#{request.id}</td>
                      <td data-label="Người gửi">{request.createdByName}</td>
                      <td data-label="Đơn vị">{request.departmentName}</td>
                      <td data-label="Thời gian">{fmtDateTime(request.requestedAt)}</td>
                      <td data-label="Trạng thái">
                        <span className={`ui-status-badge ${getStatusUiClass(request)}`}>{request.statusName}</span>
                        {request.status === 2 && request.approvalNote && (
                          <div className="ira-rejection-note">{request.approvalNote}</div>
                        )}
                      </td>
                      <td>
                        <div className="ira-action-group">
                          <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => fetchRequestDetail(request.id)}>
                            Xem
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!currentTabLoading && currentRequests.length > 0 ? (
            <div className="ui-pagination" aria-label="Phân trang phê duyệt phiếu xin lĩnh">
              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                disabled={safeCurrentPage <= 0}
              >
                Trang trước
              </button>

              {visiblePageNumbers(totalPages, safeCurrentPage).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`ui-pagination-btn ${page === safeCurrentPage ? "is-active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                  disabled={page === safeCurrentPage}
                >
                  {page + 1}
                </button>
              ))}

              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
                disabled={safeCurrentPage >= totalPages - 1}
              >
                Trang sau
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {selectedRequest && selectedRequest.header && (
        <div className="ui-modal-overlay ira-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="ui-modal ira-modal ira-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header ira-modal-header">
              <h2>Chi tiết Phiếu #{selectedRequest.header.id}</h2>
            </div>

            {isDetailLoading ? (
              <div className="ira-loading-state ira-modal-loading">Đang tải chi tiết...</div>
            ) : (
              <div className="ui-modal-body ira-modal-body">
                <div className="ui-section">
                  <div className="ui-section-head">
                    <div>
                      <h3 className="ui-section-title">Thông tin chung</h3>
                    </div>
                  </div>
                  <div className="ira-info-grid">
                    <div className="ira-info-item"><strong>Người gửi:</strong> {selectedRequest.header.createdByName}</div>
                    <div className="ira-info-item"><strong>Email:</strong> {selectedRequest.header.createdByEmail}</div>
                    <div className="ira-info-item"><strong>Đơn vị:</strong> {selectedRequest.header.departmentName}</div>
                    <div className="ira-info-item"><strong>Bộ môn:</strong> {selectedRequest.header.departmentName}</div>
                    <div className="ira-info-item"><strong>Thời gian:</strong> {fmtDateTime(selectedRequest.header.requestedAt)}</div>
                    <div className="ira-info-item">
                      <strong>Trạng thái:</strong> <span className={`ui-status-badge ${getStatusUiClass(selectedRequest.header)}`}>{selectedRequest.header.statusName}</span>
                    </div>
                    {selectedRequest.header.approvalByName && <div className="ira-info-item"><strong>Người phê duyệt:</strong> {selectedRequest.header.approvalByName}</div>}
                    {selectedRequest.header.approvalAt && (
                      <div className="ira-info-item"><strong>Thời gian phê duyệt:</strong> {fmtDateTime(selectedRequest.header.approvalAt)}</div>
                    )}
                    {selectedRequest.header.approvalNote && <div className="ira-info-item ira-info-item-full"><strong>Ghi chú phê duyệt:</strong> {selectedRequest.header.approvalNote}</div>}
                    {selectedRequest.header.note && <div className="ira-info-item ira-info-item-full"><strong>Ghi chú của người gửi:</strong> {selectedRequest.header.note}</div>}
                  </div>
                </div>

                {selectedRequest.summary && (
                  <div className="ui-section">
                    <h3 className="ui-section-title">Tổng hợp vật tư</h3>
                    <div className="ira-summary-grid">
                      <div className="ira-summary-card">
                        <div className="ira-summary-value">{selectedRequest.summary.totalMaterials}</div>
                        <div className="ira-summary-label">Tổng loại</div>
                      </div>
                      <div className="ira-summary-card">
                        <div className="ira-summary-value">{selectedRequest.summary.totalQuantity}</div>
                        <div className="ira-summary-label">Tổng số lượng</div>
                      </div>
                      <div className="ira-summary-card">
                        <div className="ira-summary-value">{selectedRequest.summary.newMaterials || 0}</div>
                        <div className="ira-summary-label">Vật tư mới</div>
                      </div>
                    </div>

                    {selectedRequest.summary.categoryBreakdown && (
                      <div className="ira-category-breakdown">
                        <h4>Phân loại</h4>
                        <div className="ira-category-grid">
                          {Object.entries(selectedRequest.summary.categoryBreakdown).map(([category, count]) => {
                            const categoryInfo = getCategoryInfo(category);
                            return (
                              <div key={category} className="ira-category-card">
                                <span className="ira-category-tag">{categoryInfo.label}</span>
                                <span className="ira-category-count">{count} loại</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="ui-section">
                  <h3 className="ui-section-title">Danh sách vật tư</h3>
                  <div className="ui-table-wrap">
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>TT</th>
                          <th>Tên vật tư</th>
                          <th>Quy cách</th>
                          <th>Đơn vị</th>
                          <th>Số lượng</th>
                          <th>Loại</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.details?.map((detail, index) => {
                          const categoryInfo = getCategoryInfo(detail.category);
                          return (
                            <tr key={index}>
                              <td className="text-center">{index + 1}</td>
                              <td>
                                {detail.materialName}
                                {detail.isNewMaterial && <span className="ira-new-badge">Mới</span>}
                              </td>
                              <td>{detail.spec || "-"}</td>
                              <td>{detail.unitName}</td>
                              <td className="text-center">{detail.qtyRequested}</td>
                              <td className="text-center">
                                <span className="ira-category-tag" title={categoryInfo.description}>{categoryInfo.label}</span>
                              </td>
                              <td className="text-center">
                                {detail.isNewMaterial ? (
                                  <span className="ui-status-badge is-pending">Vật tư mới</span>
                                ) : (
                                  <span className="ui-status-badge is-approved">Có sẵn</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {canActOnRequest(selectedRequest.header) && (
                  <div className="ui-modal-footer ira-modal-footer">
                    <div className="ira-detail-actions">
                      <button
                        className="ui-btn ui-btn-primary"
                        onClick={() => openApprovalModal("approve", selectedRequest.header)}
                      >
                        Duyệt
                      </button>
                      <button
                        className="ui-btn ui-btn-danger"
                        onClick={() => openApprovalModal("reject", selectedRequest.header)}
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showApprovalModal && (
        <div className="ui-modal-overlay ira-modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="ui-modal ira-modal ira-approval-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ui-modal-header ira-modal-header">
              <h2>{getModalTitle(currentAction)}</h2>
            </div>
            <div className="ui-modal-body ira-modal-body">
              <p className="ira-modal-text">
                Vui lòng nhập {currentAction === "reject" ? "lý do từ chối" : "ghi chú"} {getActionName(currentAction)}:
              </p>
              <textarea
                className="ui-textarea ira-approval-textarea"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder={getPlaceholderText(currentAction)}
                rows="4"
              />
              {currentAction === "reject" && <p className="ira-required-note">Lý do từ chối là bắt buộc</p>}
              <div className="ui-modal-footer ira-modal-footer">
                <button className="ui-btn ui-btn-secondary" onClick={() => setShowApprovalModal(false)}>
                  Hủy
                </button>
                <button className={getActionButtonClass(currentAction)} onClick={handleConfirmAction} disabled={currentAction === "reject" && !approvalNote.trim()}>
                  Xác nhận {getActionName(currentAction)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
