import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./ForecastApproval.css";

const API_URL = "http://localhost:8080/api";

export default function ForecastApproval({ adminInfo }) {
  const [forecasts, setForecasts] = useState([]);
  const [activeForecastTab, setActiveForecastTab] = useState("pending");
  const [selectedForecast, setSelectedForecast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const API_ENDPOINTS = {
    FORECASTS_PENDING: (bghId) => `${API_URL}/supp-forecast/bgh/pending?bghId=${bghId}`,
    FORECASTS_PROCESSED: (bghId) => `${API_URL}/supp-forecast/bgh/processed?bghId=${bghId}`,
    FORECAST_APPROVE: `${API_URL}/supp-forecast/approve`,
  };

  useEffect(() => {
    if (adminInfo?.id) {
      fetchForecasts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForecastTab, adminInfo]);

  const fetchForecasts = async () => {
    if (!adminInfo?.id) return;

    setIsLoading(true);
    try {
      const endpoint =
        activeForecastTab === "pending"
          ? API_ENDPOINTS.FORECASTS_PENDING(adminInfo.id)
          : API_ENDPOINTS.FORECASTS_PROCESSED(adminInfo.id);

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      setForecasts(data || []);
    } catch (error) {
      Swal.fire({
        title: "Lỗi!",
        text: "Không thể tải danh sách dự trù",
        icon: "error",
        timer: 3000,
      });
      setForecasts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const approveForecast = async (forecastId) => {
    const { value: note } = await Swal.fire({
      title: "Phê duyệt dự trù?",
      input: "textarea",
      inputLabel: "Lý do phê duyệt (không bắt buộc):",
      inputPlaceholder: "Nhập lý do phê duyệt (nếu có)...",
      inputAttributes: { maxLength: "500" },
      showCancelButton: true,
      confirmButtonText: "Phê duyệt",
      confirmButtonColor: "#10B981",
      cancelButtonText: "Hủy",
    });

    if (note !== undefined) {
      try {
        const requestBody = {
          forecastId,
          action: 1,
          note: note || "Đã phê duyệt",
          approverId: adminInfo.id,
        };

        const response = await fetch(API_ENDPOINTS.FORECAST_APPROVE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        Swal.fire({
          title: "Đã phê duyệt!",
          text: "Dự trù đã được phê duyệt thành công.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });

        if (selectedForecast?.id === forecastId) {
          setSelectedForecast(null);
        }
        fetchForecasts();
      } catch (error) {
        Swal.fire({
          title: "Lỗi!",
          text: "Không thể phê duyệt dự trù",
          icon: "error",
          timer: 2000,
        });
      }
    }
  };

  const rejectForecast = async (forecastId) => {
    const { value: note } = await Swal.fire({
      title: "Từ chối dự trù?",
      input: "textarea",
      inputLabel: "Lý do từ chối:",
      inputPlaceholder: "Nhập lý do từ chối dự trù...",
      inputAttributes: { maxLength: "500" },
      showCancelButton: true,
      confirmButtonText: "Từ chối",
      confirmButtonColor: "#EF4444",
      cancelButtonText: "Hủy",
      preConfirm: (value) => {
        if (!value || value.trim().length === 0) {
          Swal.showValidationMessage("Vui lòng nhập lý do từ chối!");
          return false;
        }
        return value;
      },
    });

    if (note) {
      try {
        const requestBody = {
          forecastId,
          action: 2,
          note,
          approverId: adminInfo.id,
        };

        const response = await fetch(API_ENDPOINTS.FORECAST_APPROVE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        Swal.fire({
          title: "Đã từ chối!",
          text: "Dự trù đã được từ chối thành công.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });

        if (selectedForecast?.id === forecastId) {
          setSelectedForecast(null);
        }
        fetchForecasts();
      } catch (error) {
        Swal.fire({
          title: "Lỗi!",
          text: "Không thể từ chối dự trù",
          icon: "error",
          timer: 2000,
        });
      }
    }
  };

  const closeForecastDetails = () => {
    setSelectedForecast(null);
  };

  // Hàm đọc trạng thái theo nhiều định dạng backend khác nhau.
  const getStatusBadge = (status) => {
    if (status && typeof status === "object") {
      if (status.value !== undefined) {
        switch (status.value) {
          case 0:
            return { text: "Chờ duyệt", className: "is-pending" };
          case 1:
            return { text: "Đã duyệt", className: "is-approved" };
          case 2:
            return { text: "Đã từ chối", className: "is-rejected" };
          default:
            break;
        }
      }

      if (status.name) {
        const statusName = status.name.toLowerCase();
        if (statusName.includes("pending") || statusName.includes("chờ")) {
          return { text: "Chờ duyệt", className: "is-pending" };
        }
        if (statusName.includes("approved") || statusName.includes("đã duyệt")) {
          return { text: "Đã duyệt", className: "is-approved" };
        }
        if (statusName.includes("rejected") || statusName.includes("từ chối")) {
          return { text: "Đã từ chối", className: "is-rejected" };
        }
      }
    }

    let statusNum;
    if (typeof status === "string") {
      statusNum = parseInt(status, 10);
    } else if (typeof status === "number") {
      statusNum = status;
    }

    if (!Number.isNaN(statusNum)) {
      switch (statusNum) {
        case 0:
          return { text: "Chờ duyệt", className: "is-pending" };
        case 1:
          return { text: "Đã duyệt", className: "is-approved" };
        case 2:
          return { text: "Đã từ chối", className: "is-rejected" };
        default:
          break;
      }
    }

    if (typeof status === "string") {
      const statusLower = status.toLowerCase();
      if (statusLower.includes("pending") || statusLower.includes("chờ")) {
        return { text: "Chờ duyệt", className: "is-pending" };
      }
      if (statusLower.includes("approved") || statusLower.includes("đã duyệt")) {
        return { text: "Đã duyệt", className: "is-approved" };
      }
      if (statusLower.includes("rejected") || statusLower.includes("từ chối")) {
        return { text: "Đã từ chối", className: "is-rejected" };
      }
    }

    return { text: "Không xác định", className: "is-info" };
  };

  const isPendingStatus = (status) => getStatusBadge(status).className === "pending";

  const stats = useMemo(() => {
    const total = forecasts.length;
    const pending = forecasts.filter((item) => isPendingStatus(item.status)).length;
    const processed = total - pending;
    return { total, pending, processed };
  }, [forecasts]);

  const pageTitle = "Phê duyệt dự trù";
  const pageSubtitle =
    "Theo dõi danh sách phiếu dự trù, xem chi tiết từng đề xuất và thực hiện phê duyệt hoặc từ chối ngay trên cùng một giao diện.";

  return (
    <div className="ui-page">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">{pageTitle}</h1>
          </div>
        </div>

        <div className="ui-stat-grid fa-stat-grid">
          <div className="ui-stat-card is-primary">
            <p className="ui-stat-label">Tổng dự trù đang hiển thị</p>
            <p className="ui-stat-value">{stats.total}</p>
            <p className="ui-stat-note">Theo tab hiện tại</p>
          </div>
          <div className="ui-stat-card is-warning">
            <p className="ui-stat-label">Dự trù chờ duyệt</p>
            <p className="ui-stat-value">{stats.pending}</p>
            <p className="ui-stat-note">Cần xử lý</p>
          </div>
          <div className="ui-stat-card">
            <p className="ui-stat-label">Dự trù đã xử lý</p>
            <p className="ui-stat-value">{stats.processed}</p>
            <p className="ui-stat-note">Đã duyệt hoặc từ chối</p>
          </div>
        </div>

        <div className="ui-section">
          <div className="ui-section-head">
            <div>
              <h2 className="ui-section-title">Danh sách dự trù</h2>
            </div>

            <div className="ui-toolbar-actions">
              <button className="ui-btn ui-btn-secondary" type="button" onClick={fetchForecasts} disabled={isLoading}>
                {isLoading ? "Đang tải..." : "Tải lại"}
              </button>
            </div>
          </div>

          <div className="ui-tabs">
            <button
              type="button"
              className={`ui-tab ${activeForecastTab === "pending" ? "is-active" : ""}`}
              onClick={() => setActiveForecastTab("pending")}
            >
              Chờ duyệt
            </button>
            <button
              type="button"
              className={`ui-tab ${activeForecastTab === "processed" ? "is-active" : ""}`}
              onClick={() => setActiveForecastTab("processed")}
            >
              Đã xử lý
            </button>
          </div>

          {isLoading ? (
            <div className="fa-loading-box">
              <div className="fa-loading-spinner" />
              <p>Đang tải dữ liệu dự trù...</p>
            </div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table fa-table">
                <thead>
                  <tr>
                    <th>Khoa/Phòng</th>
                    <th>Năm học</th>
                    <th>Người tạo</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th className="text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.length > 0 ? (
                    forecasts.map((forecast) => {
                      const status = getStatusBadge(forecast.status);
                      const isPending = isPendingStatus(forecast.status);

                      return (
                        <tr key={forecast.id}>
                          <td>{forecast.department?.name || "Không xác định"}</td>
                          <td>{forecast.academicYear || "-"}</td>
                          <td>{forecast.createdBy?.fullName || "Không xác định"}</td>
                          <td>
                            {forecast.createdAt
                              ? new Date(forecast.createdAt).toLocaleDateString("vi-VN")
                              : "-"}
                          </td>
                          <td>
                            <span className={`ui-status-badge ${status.className}`}>{status.text}</span>
                          </td>
                          <td className="text-center">
                            <div className="fa-action-group">
                              <button
                                type="button"
                                className="ui-btn ui-btn-secondary ui-btn-sm"
                                onClick={() => setSelectedForecast(forecast)}
                              >
                                Xem
                              </button>
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    className="ui-btn ui-btn-primary ui-btn-sm"
                                    onClick={() => approveForecast(forecast.id)}
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    type="button"
                                    className="ui-btn ui-btn-danger ui-btn-sm"
                                    onClick={() => rejectForecast(forecast.id)}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="ui-empty">
                        {activeForecastTab === "pending"
                          ? "Không có dự trù nào chờ duyệt"
                          : "Không có dự trù nào đã xử lý"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedForecast && (
        <div className="fa-modal-overlay" onMouseDown={closeForecastDetails}>
          <div className="fa-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fa-modal-header">
              <div>
                <h3 className="fa-modal-title">Chi tiết dự trù #{selectedForecast.id}</h3>
                <p className="fa-modal-subtitle">Xem thông tin chung và danh sách vật tư của phiếu dự trù.</p>
              </div>
              <div className="fa-modal-header-right">
                <span className={`ui-status-badge ${getStatusBadge(selectedForecast.status).className}`}>
                  {getStatusBadge(selectedForecast.status).text}
                </span>
                <button type="button" className="fa-modal-close" onClick={closeForecastDetails}>
                  ×
                </button>
              </div>
            </div>

            <div className="fa-modal-content">
              <div className="fa-info-grid">
                <div className="fa-info-card">
                  <span className="fa-info-label">Khoa/Phòng</span>
                  <strong className="fa-info-value">{selectedForecast.department?.name || "Không xác định"}</strong>
                </div>
                <div className="fa-info-card">
                  <span className="fa-info-label">Năm học</span>
                  <strong className="fa-info-value">{selectedForecast.academicYear || "-"}</strong>
                </div>
                <div className="fa-info-card">
                  <span className="fa-info-label">Người tạo</span>
                  <strong className="fa-info-value">{selectedForecast.createdBy?.fullName || "Không xác định"}</strong>
                </div>
                <div className="fa-info-card">
                  <span className="fa-info-label">Ngày tạo</span>
                  <strong className="fa-info-value">
                    {selectedForecast.createdAt
                      ? new Date(selectedForecast.createdAt).toLocaleDateString("vi-VN")
                      : "-"}
                  </strong>
                </div>
                {selectedForecast.approvalBy && (
                  <div className="fa-info-card">
                    <span className="fa-info-label">Người duyệt</span>
                    <strong className="fa-info-value">{selectedForecast.approvalBy?.fullName || "-"}</strong>
                  </div>
                )}
                {selectedForecast.approvalAt && (
                  <div className="fa-info-card">
                    <span className="fa-info-label">Ngày duyệt</span>
                    <strong className="fa-info-value">
                      {new Date(selectedForecast.approvalAt).toLocaleDateString("vi-VN")}
                    </strong>
                  </div>
                )}
              </div>

              {selectedForecast.approvalNote && (
                <div className="ui-alert is-warning fa-note-box">
                  <strong>Ghi chú xử lý:</strong> {selectedForecast.approvalNote}
                </div>
              )}

              <div className="fa-detail-block">
                <div className="ui-section-head fa-detail-head">
                  <div>
                    <h4 className="ui-section-title">Danh sách vật tư</h4>
                    <p className="ui-section-subtitle">
                      Tổng số dòng: {selectedForecast.details?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="ui-table-wrap">
                  <table className="ui-table fa-detail-table">
                    <thead>
                      <tr>
                        <th>Tên vật tư</th>
                        <th className="text-right">Tồn hiện tại</th>
                        <th className="text-right">Năm trước</th>
                        <th className="text-right">Dự trù năm nay</th>
                        <th>Lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedForecast.details && selectedForecast.details.length > 0 ? (
                        selectedForecast.details.map((detail, index) => (
                          <tr key={index}>
                            <td>{detail.material?.name || "Vật tư mới"}</td>
                            <td className="text-right">{detail.currentStock ?? 0}</td>
                            <td className="text-right">{detail.prevYearQty ?? 0}</td>
                            <td className="text-right fa-strong-cell">{detail.thisYearQty ?? 0}</td>
                            <td>{detail.justification || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="ui-empty">
                            Không có dữ liệu chi tiết.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="fa-modal-footer">
              {isPendingStatus(selectedForecast.status) && (
                <>
                  <button type="button" className="ui-btn ui-btn-danger" onClick={() => rejectForecast(selectedForecast.id)}>
                    Từ chối
                  </button>
                  <button type="button" className="ui-btn ui-btn-primary" onClick={() => approveForecast(selectedForecast.id)}>
                    Phê duyệt
                  </button>
                </>
              )}
              <button type="button" className="ui-btn ui-btn-secondary" onClick={closeForecastDetails}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
