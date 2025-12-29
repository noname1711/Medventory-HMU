import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import "./Admin.css";

const API_URL = 'http://localhost:8080/api';

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
  }, [activeForecastTab, adminInfo]);

  const fetchForecasts = async () => {
    if (!adminInfo?.id) return;

    setIsLoading(true);
    try {
      const endpoint = activeForecastTab === "pending" 
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
          forecastId: forecastId,
          action: 1,
          note: note || "Đã phê duyệt",
          approverId: adminInfo.id
        };

        const response = await fetch(API_ENDPOINTS.FORECAST_APPROVE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          Swal.fire({
            title: "✅ Đã phê duyệt!",
            text: "Dự trù đã được phê duyệt thành công.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
          });
          fetchForecasts();
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        Swal.fire({
          title: "❌ Lỗi!",
          text: "Không thể phê duyệt dự trù",
          icon: "error",
          timer: 2000
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
      preConfirm: (note) => {
        if (!note || note.trim().length === 0) {
          Swal.showValidationMessage("Vui lòng nhập lý do từ chối!");
          return false;
        }
        return note;
      }
    });

    if (note) {
      try {
        const requestBody = {
          forecastId: forecastId,
          action: 2,
          note: note,
          approverId: adminInfo.id
        };

        const response = await fetch(API_ENDPOINTS.FORECAST_APPROVE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          Swal.fire({
            title: "✅ Đã từ chối!",
            text: "Dự trù đã được từ chối thành công.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
          });
          fetchForecasts();
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        Swal.fire({
          title: "❌ Lỗi!",
          text: "Không thể từ chối dự trù",
          icon: "error",
          timer: 2000
        });
      }
    }
  };

  const viewForecastDetails = (forecast) => {
    setSelectedForecast(forecast);
  };

  const closeForecastDetails = () => {
    setSelectedForecast(null);
  };

  // HÀM PHÁT HIỆN ĐÚNG TRẠNG THÁI 
  const getStatusBadge = (status) => {
    // Trường hợp 1: Status là object có thuộc tính value (giống user status trong Admin.jsx)
    if (status && typeof status === 'object') {
      if (status.value !== undefined) {
        const statusValue = status.value;
        switch (statusValue) {
          case 0: return { text: "Chờ duyệt", class: "pending" };
          case 1: return { text: "Đã duyệt", class: "approved" };
          case 2: return { text: "Đã từ chối", class: "rejected" };
        }
      }
      if (status.name) {
        const statusName = status.name.toLowerCase();
        if (statusName.includes('pending') || statusName.includes('chờ')) {
          return { text: "Chờ duyệt", class: "pending" };
        } else if (statusName.includes('approved') || statusName.includes('đã duyệt')) {
          return { text: "Đã duyệt", class: "approved" };
        } else if (statusName.includes('rejected') || statusName.includes('từ chối')) {
          return { text: "Đã từ chối", class: "rejected" };
        }
      }
    }
    
    // Trường hợp 2: Status là số hoặc chuỗi số
    let statusNum;
    if (typeof status === 'string') {
      statusNum = parseInt(status, 10);
    } else if (typeof status === 'number') {
      statusNum = status;
    }
    
    if (!isNaN(statusNum)) {
      switch (statusNum) {
        case 0: return { text: "Chờ duyệt", class: "pending" };
        case 1: return { text: "Đã duyệt", class: "approved" };
        case 2: return { text: "Đã từ chối", class: "rejected" };
      }
    }
    
    // Trường hợp 3: Status là chuỗi
    if (typeof status === 'string') {
      const statusLower = status.toLowerCase();
      if (statusLower.includes('pending') || statusLower.includes('chờ')) {
        return { text: "Chờ duyệt", class: "pending" };
      } else if (statusLower.includes('approved') || statusLower.includes('đã duyệt')) {
        return { text: "Đã duyệt", class: "approved" };
      } else if (statusLower.includes('rejected') || statusLower.includes('từ chối')) {
        return { text: "Đã từ chối", class: "rejected" };
      }
    }
    
    // Trường hợp 4: Mặc định
    return { text: "Không xác định", class: "unknown" };
  };

  // HÀM KIỂM TRA "CHỜ DUYỆT" - HOẠT ĐỘNG VỚI MỌI ĐỊNH DẠNG
  const isPendingStatus = (status) => {
    // Lấy thông tin từ getStatusBadge
    const badgeInfo = getStatusBadge(status);
    return badgeInfo.class === "pending";
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Đang tải dữ liệu dự trù...</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-forecast-list admin-card">
        <div className="admin-card-header">
          <h3>Duyệt dự trù bổ sung</h3>
          <div className="admin-user-count-badge">
            <span className="admin-count-number">
              {isLoading ? "..." : forecasts.length}
            </span>
            <span className="admin-count-text">dự trù</span>
          </div>
        </div>

        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeForecastTab === "pending" ? "admin-tab-active" : ""}`}
            onClick={() => setActiveForecastTab("pending")}
          >
            Chờ duyệt
          </button>
          <button 
            className={`admin-tab ${activeForecastTab === "processed" ? "admin-tab-active" : ""}`}
            onClick={() => setActiveForecastTab("processed")}
          >
            Đã xử lý
          </button>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Khoa/Phòng</th>
                <th>Năm học</th>
                <th>Người tạo</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((forecast, index) => {
                const status = getStatusBadge(forecast.status);
                const isPending = isPendingStatus(forecast.status);
                
                return (
                  <tr key={forecast.id} className={index === forecasts.length - 1 ? "admin-last-row" : ""}>
                    <td>{forecast.department?.name || "Không xác định"}</td>
                    <td>{forecast.academicYear}</td>
                    <td>{forecast.createdBy?.fullName || "Không xác định"}</td>
                    <td>{new Date(forecast.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <span className={`admin-status-badge admin-${status.class}`}>
                        {status.text}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button 
                          className="admin-view-btn" 
                          onClick={() => viewForecastDetails(forecast)}
                          title="Xem chi tiết"
                        >
                          👁️
                        </button>
                        {isPending && (
                          <>
                            <button 
                              className="admin-approve-btn" 
                              onClick={() => approveForecast(forecast.id)} 
                              title="Phê duyệt"
                            >
                              ✓
                            </button>
                            <button 
                              className="admin-reject-btn" 
                              onClick={() => rejectForecast(forecast.id)} 
                              title="Từ chối"
                            >
                              ✗
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {forecasts.length === 0 && (
                <tr className="admin-last-row">
                  <td colSpan="6" className="admin-no-data">
                    {activeForecastTab === "pending" 
                      ? "Không có dự trù nào chờ duyệt" 
                      : "Không có dự trù nào đã xử lý"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedForecast && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-forecast-modal">
            <div className="admin-modal-header">
              <h3>Chi tiết dự trù #{selectedForecast.id}</h3>
              <div className="admin-user-status-info">
                {(() => {
                  const status = getStatusBadge(selectedForecast.status);
                  return (
                    <span className={`admin-status-badge admin-${status.class}`}>
                      {status.text}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="admin-modal-content">
              <div className="admin-forecast-info">
                <div className="admin-info-row">
                  <div className="admin-info-item">
                    <strong>Khoa/Phòng:</strong> {selectedForecast.department?.name || "Không xác định"}
                  </div>
                  <div className="admin-info-item">
                    <strong>Năm học:</strong> {selectedForecast.academicYear}
                  </div>
                </div>
                <div className="admin-info-row">
                  <div className="admin-info-item">
                    <strong>Người tạo:</strong> {selectedForecast.createdBy?.fullName || "Không xác định"}
                  </div>
                  <div className="admin-info-item">
                    <strong>Ngày tạo:</strong> {new Date(selectedForecast.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                {selectedForecast.approvalBy && (
                  <div className="admin-info-row">
                    <div className="admin-info-item">
                      <strong>Người duyệt:</strong> {selectedForecast.approvalBy?.fullName}
                    </div>
                    <div className="admin-info-item">
                      <strong>Ngày duyệt:</strong> {new Date(selectedForecast.approvalAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                )}
                {selectedForecast.approvalNote && (
                  <div className="admin-info-row">
                    <div className="admin-info-item full-width">
                      <strong>Ghi chú:</strong> {selectedForecast.approvalNote}
                    </div>
                  </div>
                )}
              </div>

              {selectedForecast.details && selectedForecast.details.length > 0 && (
                <div className="admin-forecast-details">
                  <h4>Danh sách vật tư</h4>
                  <div className="admin-details-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Tên vật tư</th>
                          <th>Tồn hiện tại</th>
                          <th>Năm trước</th>
                          <th>Dự trù năm nay</th>
                          <th>Lý do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedForecast.details.map((detail, index) => (
                          <tr key={index}>
                            <td>{detail.material?.name || "Vật tư mới"}</td>
                            <td>{detail.currentStock}</td>
                            <td>{detail.prevYearQty}</td>
                            <td><strong>{detail.thisYearQty}</strong></td>
                            <td>{detail.justification}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              {isPendingStatus(selectedForecast.status) && (
                <>
                  <button 
                    className="admin-reject-btn" 
                    onClick={() => rejectForecast(selectedForecast.id)} 
                  >
                    Từ chối
                  </button>
                  <button 
                    className="admin-approve-btn" 
                    onClick={() => approveForecast(selectedForecast.id)} 
                  >
                    Phê duyệt
                  </button>
                </>
              )}
              <button className="admin-btn-secondary" onClick={closeForecastDetails}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}