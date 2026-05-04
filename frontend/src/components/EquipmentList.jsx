import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import "./dashboard-ui.css";
import "./EquipmentList.css";

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

export default function InventoryPage() {
  const PAGE_SIZE = 10;

  /* ================= STATE ================= */
  const [units, setUnits] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [stockItems, setStockItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);

  const [form, setForm] = useState({
    materialCode: "",
    materialName: "",
    specification: "",
    unitId: "",
    manufacturer: "",
    category: "C",
  });

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    fetchUnits();
    fetchStockItems();
  }, []);

  async function fetchUnits() {
    try {
      const res = await fetch("http://localhost:8080/api/units");
      const data = await res.json();
      setUnits(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Load units error", error);
      setUnits([]);
    }
  }

  async function fetchStockItems() {
    try {
      const res = await fetch("http://localhost:8080/api/inventory/materials");
      const data = await res.json();
      setStockItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Load stock error", error);
      setStockItems([]);
    }
  }

  /* ================= COMPUTED DATA ================= */
  const filteredStockItems = stockItems.filter((item) => {
    const code = String(item.materialCode || "").toLowerCase();
    const name = String(item.materialName || "").toLowerCase();
    const search = keyword.toLowerCase();
    return code.includes(search) || name.includes(search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredStockItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const pagedStockItems = filteredStockItems.slice(
    safeCurrentPage * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE + PAGE_SIZE
  );

  const totalItems = stockItems.length;
  const lowStockItems = stockItems.filter(
    (item) => Number(item.closingStock) > 0 && Number(item.closingStock) < 10
  ).length;
  const outOfStockItems = stockItems.filter(
    (item) => Number(item.closingStock) <= 0
  ).length;

  /* ================= ACTIONS ================= */
  async function handleSubmit() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    try {
      const res = await fetch("http://localhost:8080/api/materials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(currentUser.id),
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể thêm vật tư");

      toast.success("Thêm vật tư thành công");

      setForm({
        materialCode: "",
        materialName: "",
        specification: "",
        unitId: "",
        manufacturer: "",
        category: "C",
      });

      fetchStockItems();
    } catch (error) {
      toast.error(error.message);
    }
  }

  function getStockClass(stock) {
    const value = Number(stock || 0);
    if (value <= 0) return "ui-stock-badge is-zero";
    if (value < 10) return "ui-stock-badge is-low";
    return "ui-stock-badge is-ok";
  }

  return (
    <div className="ui-page eq-page">
      <div className="ui-page-frame">
        <div className="ui-page-stack">
          <div className="ui-card-header eq-page-header">
            <div>
              <h3 className="ui-card-title">Quản lý vật tư kho</h3>
            </div>
          </div>

          {/* Dải KPI nằm ngang theo kiểu dashboard nhưng vẫn nằm trong cùng một khung trắng */}
          <div className="ui-stat-grid eq-stat-grid">
            <div className="ui-stat-card is-primary">
              <p className="ui-stat-label">Tổng mặt hàng</p>
              <p className="ui-stat-value">{totalItems}</p>
              <p className="ui-stat-note">Số lượng mã vật tư đang có trong kho</p>
            </div>

            <div className="ui-stat-card is-warning">
              <p className="ui-stat-label">Sắp hết hàng</p>
              <p className="ui-stat-value">{lowStockItems}</p>
              <p className="ui-stat-note">Các mã có tồn kho lớn hơn 0 và nhỏ hơn 10</p>
            </div>

            <div className="ui-stat-card is-danger">
              <p className="ui-stat-label">Hết hàng</p>
              <p className="ui-stat-value">{outOfStockItems}</p>
              <p className="ui-stat-note">Các mã vật tư hiện không còn tồn kho</p>
            </div>
          </div>

          {/* Form thêm vật tư */}
          <section className="ui-section">
            <div className="ui-card-header">
              <div>
                <h3 className="ui-card-title">Thêm vật tư mới</h3>
              </div>
            </div>

            <div className="ui-form-grid cols-7">
              <div className="ui-field">
                <label className="ui-label">Mã vật tư</label>
                <input
                  className="ui-input"
                  placeholder="VD: VT001"
                  value={form.materialCode}
                  onChange={(e) => setForm({ ...form, materialCode: e.target.value })}
                />
              </div>

              <div className="ui-field">
                <label className="ui-label">Tên vật tư</label>
                <input
                  className="ui-input"
                  placeholder="Nhập tên vật tư"
                  value={form.materialName}
                  onChange={(e) => setForm({ ...form, materialName: e.target.value })}
                />
              </div>

              <div className="ui-field">
                <label className="ui-label">Quy cách đóng gói</label>
                <input
                  className="ui-input"
                  placeholder="VD: Hộp 50 chiếc"
                  value={form.specification}
                  onChange={(e) => setForm({ ...form, specification: e.target.value })}
                />
              </div>

              <div className="ui-field">
                <label className="ui-label">Đơn vị tính</label>
                <select
                  className="ui-select"
                  value={form.unitId}
                  onChange={(e) => setForm({ ...form, unitId: Number(e.target.value) })}
                >
                  <option value="">Chọn đơn vị</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ui-field">
                <label className="ui-label">Hãng sản xuất</label>
                <input
                  className="ui-input"
                  placeholder="Nhập hãng sản xuất"
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                />
              </div>

              <div className="ui-field">
                <label className="ui-label">Phân loại</label>
                <select
                  className="ui-select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="A">A – Quan trọng</option>
                  <option value="B">B – Thiết yếu</option>
                  <option value="C">C – Thông dụng</option>
                  <option value="D">D – Ít quan trọng</option>
                </select>
              </div>

              <div className="ui-field eq-submit-field">
                <label className="ui-label">Thao tác</label>
                <button type="button" className="ui-btn ui-btn-primary" onClick={handleSubmit}>
                  Thêm vật tư
                </button>
              </div>
            </div>
          </section>

          {/* Bảng danh sách */}
          <section className="ui-section">
            <div className="ui-toolbar eq-toolbar">
              <div>
                <h3 className="ui-card-title">Danh sách vật tư tồn kho</h3>
              </div>

              <div className="ui-toolbar-actions">
                <input
                  className="ui-input ui-search"
                  placeholder="Tìm theo mã hoặc tên vật tư..."
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setCurrentPage(0);
                  }}
                />
              </div>
            </div>

            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Mã vật tư</th>
                    <th>Tên vật tư</th>
                    <th>Đơn vị tính</th>
                    <th className="text-right">Tồn kho</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedStockItems.length > 0 ? (
                    pagedStockItems.map((item) => (
                      <tr key={item.materialId}>
                        <td data-label="Mã vật tư">{item.materialCode}</td>
                        <td data-label="Tên vật tư">{item.materialName}</td>
                        <td data-label="Đơn vị tính">{item.unitName}</td>
                        <td data-label="Tồn kho" className="text-right">
                          <span className={getStockClass(item.closingStock)}>
                            {item.closingStock}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="ui-empty">
                        {keyword
                          ? `Không tìm thấy vật tư phù hợp với "${keyword}"`
                          : "Chưa có vật tư nào trong kho. Sử dụng form phía trên để thêm vật tư đầu tiên."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-pagination" aria-label="Phân trang danh sách vật tư">
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
          </section>
        </div>
      </div>
    </div>
  );
}
