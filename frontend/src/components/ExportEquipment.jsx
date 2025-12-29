import React, { useEffect, useState } from "react";
import "./ExportEquipment.css";

export default function ExportEquipment({ equipmentData, onExport }) {
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [previewData, setPreviewData] = useState([]);

  useEffect(() => {
    updatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, status, dateFrom, dateTo, equipmentData]);

  function getFiltered() {
    let filtered = [...equipmentData];
    if (department) filtered = filtered.filter((e) => e.department === department);
    if (status) filtered = filtered.filter((e) => e.status === status);
    if (dateFrom) filtered = filtered.filter((e) => e.date >= dateFrom);
    if (dateTo) filtered = filtered.filter((e) => e.date <= dateTo);
    return filtered;
  }

  function updatePreview() {
    setPreviewData(getFiltered());
  }

  function previewExport() {
    setPreviewData(getFiltered());
    const previewDiv = document.getElementById("export-preview");
    if (previewDiv) previewDiv.classList.remove("hidden");
  }

  // ⚡ Không thông báo ở đây — chỉ gọi onExport
  function exportFilteredData() {
    const data = getFiltered();
    if (data.length === 0) {
      onExport(null, null, "empty"); // Gửi tín hiệu rỗng
      return;
    }
    const headers = [
      "Mã vật tư",
      "Tên vật tư",
      "Khoa phòng",
      "Trạng thái",
      "Ngày mua",
      "Giá trị (VNĐ)",
    ];
    const csv = [
      headers.join(","),
      ...data.map((eq) =>
        [eq.code, `"${eq.name}"`, `"${eq.department}"`, `"${eq.status}"`, eq.date, eq.value].join(",")
      ),
    ].join("\n");

    // Gửi dữ liệu sang Dashboard để xử lý Swal + tải file
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
    setTimeout(() => {
      updatePreview();
      previewExport();
    }, 0);
  }

  const stats = {
    total: previewData.length,
    working: previewData.filter((eq) => eq.status === "Hoạt động tốt").length,
    maintenance: previewData.filter((eq) => eq.status === "Cần bảo trì").length,
    broken: previewData.filter((eq) => eq.status === "Hỏng hóc").length,
  };

  return (
    <div className="ee-root card">
      <h3>Xuất dữ liệu Vật tư Y tế</h3>
      <div className="ee-grid">
        <div className="ee-filters">
          <h4>Tùy chọn xuất dữ liệu</h4>

          <div className="ee-field">
            <label>Lọc theo khoa phòng</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Tất cả khoa phòng</option>
              <option value="Khoa Nội">Khoa Nội</option>
              <option value="Khoa Ngoại">Khoa Ngoại</option>
              <option value="Khoa Sản">Khoa Sản</option>
              <option value="Khoa Nhi">Khoa Nhi</option>
              <option value="Khoa Cấp cứu">Khoa Cấp cứu</option>
              <option value="Khoa Xét nghiệm">Khoa Xét nghiệm</option>
            </select>
          </div>

          <div className="ee-field">
            <label>Lọc theo trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="Hoạt động tốt">Hoạt động tốt</option>
              <option value="Cần bảo trì">Cần bảo trì</option>
              <option value="Hỏng hóc">Hỏng hóc</option>
            </select>
          </div>

          <div className="ee-dates">
            <div>
              <label>Từ ngày</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label>Đến ngày</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="ee-field">
            <label>Định dạng xuất</label>
            <div className="ee-radios">
              <label>
                <input type="radio" name="fmt" defaultChecked /> <span>📊 Excel (.xlsx)</span>
              </label>
              <label>
                <input type="radio" name="fmt" /> <span>📄 CSV (.csv)</span>
              </label>
              <label>
                <input type="radio" name="fmt" /> <span>📋 PDF (.pdf)</span>
              </label>
            </div>
          </div>

          <div className="ee-actions">
            <button className="btn primary" onClick={exportFilteredData}>
              📤 Xuất dữ liệu
            </button>
          </div>
        </div>

        <div className="ee-stats">
          <h4>Thống kê dữ liệu xuất</h4>
          <div className="ee-statsbox">
            <div className="row">
              <span>Tổng số vật tư:</span>
              <span>{stats.total}</span>
            </div>
            <div className="row">
              <span>Hoạt động tốt:</span>
              <span className="green">{stats.working}</span>
            </div>
            <div className="row">
              <span>Cần bảo trì:</span>
              <span className="yellow">{stats.maintenance}</span>
            </div>
            <div className="row">
              <span>Hỏng hóc:</span>
              <span className="red">{stats.broken}</span>
            </div>
          </div>

          <h5>Mẫu xuất nhanh</h5>
          <div className="ee-quick">
            <button onClick={() => quickExport("all")}>📊 Tất cả vật tư</button>
            <button onClick={() => quickExport("maintenance")}>⚠️ Vật tư cần bảo trì</button>
            <button onClick={() => quickExport("broken")}>🔧 Vật tư hỏng hóc</button>
            <button onClick={() => quickExport("monthly")}>📅 Báo cáo tháng này</button>
          </div>
        </div>
      </div>

      <div id="export-preview" className={`ee-preview ${previewData.length ? "visible" : "hidden"}`}>
        <h4>Xem trước dữ liệu xuất</h4>
        <div className="ee-preview-table">
          <table>
            <thead>
              <tr>
                <th>Mã TB</th>
                <th>Tên vật tư</th>
                <th>Khoa phòng</th>
                <th>Trạng thái</th>
                <th>Ngày mua</th>
              </tr>
            </thead>
            <tbody>
              {previewData.length ? (
                previewData.map((eq) => (
                  <tr key={eq.id}>
                    <td>{eq.code}</td>
                    <td>{eq.name}</td>
                    <td>{eq.department}</td>
                    <td>
                      <span
                        className={`pill ${
                          eq.status === "Hoạt động tốt"
                            ? "g"
                            : eq.status === "Cần bảo trì"
                            ? "y"
                            : "r"
                        }`}
                      >
                        {eq.status}
                      </span>
                    </td>
                    <td>{eq.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: 16 }}>
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
