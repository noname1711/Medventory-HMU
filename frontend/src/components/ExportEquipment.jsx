import React, { useEffect, useState } from "react";
import "./dashboard-ui.css";

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

export default function ExportEquipment({ equipmentData, onExport }) {
  const PAGE_SIZE = 10;
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    setPreviewData(getFiltered());
    setCurrentPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, status, dateFrom, dateTo, equipmentData]);

  function getFiltered() {
    let filtered = [...(equipmentData || [])];
    if (department) filtered = filtered.filter((e) => e.department === department);
    if (status) filtered = filtered.filter((e) => e.status === status);
    if (dateFrom) filtered = filtered.filter((e) => e.date >= dateFrom);
    if (dateTo) filtered = filtered.filter((e) => e.date <= dateTo);
    return filtered;
  }

  function exportFilteredData() {
    const data = getFiltered();
    if (data.length === 0) {
      onExport(null, null, "empty");
      return;
    }
    const headers = ["Mã vật tư", "Tên vật tư", "Khoa phòng", "Trạng thái", "Ngày mua", "Giá trị (VNĐ)"];
    const csv = [
      headers.join(","),
      ...data.map((eq) =>
        [eq.code, `"${eq.name}"`, `"${eq.department}"`, `"${eq.status}"`, eq.date, eq.value].join(",")
      ),
    ].join("\n");
    onExport(csv, "danh-sach-vat-tu.csv", "text/csv");
  }

  function quickExport(type) {
    setDepartment("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    if (type === "maintenance") setStatus("Cần bảo trì");
    if (type === "broken") setStatus("Hỏng hóc");
    if (type === "monthly") {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateFrom(firstDay.toISOString().split("T")[0]);
      setDateTo(lastDay.toISOString().split("T")[0]);
    }
    setShowPreview(true);
  }

  const stats = {
    total: previewData.length,
    working: previewData.filter((eq) => eq.status === "Hoạt động tốt").length,
    maintenance: previewData.filter((eq) => eq.status === "Cần bảo trì").length,
    broken: previewData.filter((eq) => eq.status === "Hỏng hóc").length,
  };
  const totalPages = Math.max(1, Math.ceil(previewData.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const pagedPreviewData = previewData.slice(
    safeCurrentPage * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE + PAGE_SIZE
  );

  const statusBadgeClass = (s) => {
    if (s === "Hoạt động tốt") return "is-ok";
    if (s === "Cần bảo trì") return "is-pending";
    return "is-danger";
  };

  return (
    <div className="ui-page">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Xuất dữ liệu vật tư</h1>
          </div>
        </div>

        <div className="ui-stat-grid">
          <div className="ui-stat-card">
            <p className="ui-stat-label">Tổng vật tư lọc được</p>
            <p className="ui-stat-value">{stats.total}</p>
          </div>
          <div className="ui-stat-card is-success">
            <p className="ui-stat-label">Hoạt động tốt</p>
            <p className="ui-stat-value">{stats.working}</p>
          </div>
          <div className="ui-stat-card is-warning">
            <p className="ui-stat-label">Cần bảo trì</p>
            <p className="ui-stat-value">{stats.maintenance}</p>
          </div>
        </div>

        <div className="ui-section">
          <div className="ui-section-head">
            <h2 className="ui-section-title">Tùy chọn lọc</h2>
            <div className="ui-toolbar-actions">
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? "Ẩn xem trước" : "Xem trước"}
              </button>
              <button type="button" className="ui-btn ui-btn-primary" onClick={exportFilteredData}>
                Xuất CSV
              </button>
            </div>
          </div>

          <div className="ui-form-grid cols-3" style={{ marginBottom: 18 }}>
            <div className="ui-field">
              <label className="ui-label">Khoa phòng</label>
              <select className="ui-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">Tất cả khoa phòng</option>
                <option value="Khoa Nội">Khoa Nội</option>
                <option value="Khoa Ngoại">Khoa Ngoại</option>
                <option value="Khoa Sản">Khoa Sản</option>
                <option value="Khoa Nhi">Khoa Nhi</option>
                <option value="Khoa Cấp cứu">Khoa Cấp cứu</option>
                <option value="Khoa Xét nghiệm">Khoa Xét nghiệm</option>
              </select>
            </div>

            <div className="ui-field">
              <label className="ui-label">Trạng thái</label>
              <select className="ui-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="Hoạt động tốt">Hoạt động tốt</option>
                <option value="Cần bảo trì">Cần bảo trì</option>
                <option value="Hỏng hóc">Hỏng hóc</option>
              </select>
            </div>

            <div className="ui-field">
              <label className="ui-label">Từ ngày</label>
              <input className="ui-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="ui-field">
              <label className="ui-label">Đến ngày</label>
              <input className="ui-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="ui-label" style={{ alignSelf: "center", marginRight: 4 }}>Xuất nhanh:</span>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => quickExport("all")}>
              Tất cả vật tư
            </button>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => quickExport("maintenance")}>
              Cần bảo trì
            </button>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => quickExport("broken")}>
              Hỏng hóc
            </button>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => quickExport("monthly")}>
              Tháng này
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="ui-section">
            <div className="ui-section-head">
              <h2 className="ui-section-title">Xem trước dữ liệu xuất</h2>
              <span className="ui-label" style={{ fontWeight: 400, color: "#64748b" }}>{stats.total} vật tư</span>
            </div>
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Mã vật tư</th>
                    <th>Tên vật tư</th>
                    <th>Khoa phòng</th>
                    <th>Trạng thái</th>
                    <th>Ngày mua</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPreviewData.length ? (
                    pagedPreviewData.map((eq) => (
                      <tr key={eq.id}>
                        <td>{eq.code}</td>
                        <td>{eq.name}</td>
                        <td>{eq.department}</td>
                        <td>
                          <span className={`ui-stock-badge ${statusBadgeClass(eq.status)}`}>{eq.status}</span>
                        </td>
                        <td>{eq.date}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="ui-empty">Không có vật tư nào phù hợp với bộ lọc hiện tại.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {previewData.length > 0 ? (
              <div className="ui-pagination" aria-label="Phân trang xem trước dữ liệu xuất">
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
        )}
      </div>
    </div>
  );
}
