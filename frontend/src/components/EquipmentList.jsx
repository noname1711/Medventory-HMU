import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Pagination from "./Pagination";
import "./dashboard-ui.css";
import "./EquipmentList.css";

export default function InventoryPage() {
  const PAGE_SIZE = 10;

  /* ================= STATE ================= */
  const [units, setUnits] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [matFilter, setMatFilter] = useState("all");
  const [stockItems, setStockItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalItems: 0, lowStock: 0, outOfStock: 0 });
  // "Thêm vật tư mới" chỉ hiển thị cho người có quyền quản lý vật tư (Thủ kho)
  const [canManage, setCanManage] = useState(false);

  const [form, setForm] = useState({
    materialCode: "",
    materialName: "",
    specification: "",
    unitId: "",
    manufacturer: "",
    category: "C",
  });

  /* "Cập nhật" timestamp — set when inventory data loads */
  const updatedAt = useMemo(() => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `hôm nay, ${hh}:${mm}`;
    // recompute only when the stock list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockItems.length]);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    fetchUnits();
    checkManagePermission();
  }, []);

  // Lọc + phân trang ở backend. Debounce keyword để tránh gọi API mỗi phím gõ.
  useEffect(() => {
    const t = setTimeout(() => {
      fetchStockItems(keyword, matFilter, currentPage);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, matFilter, currentPage]);

  async function checkManagePermission() {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (!currentUser?.id) return;
      const res = await fetch("http://localhost:8080/api/auth/my-permissions", {
        headers: { "X-User-Id": String(currentUser.id) },
      });
      if (!res.ok) return;
      const data = await res.json();
      const codes = Array.isArray(data?.permissionCodes) ? data.permissionCodes : [];
      setCanManage(codes.includes("MATERIAL.MANAGE"));
    } catch {
      setCanManage(false);
    }
  }

  async function fetchUnits() {
    try {
      const res = await fetch("http://localhost:8080/api/units");
      const data = await res.json();
      setUnits(Array.isArray(data) ? data : []);
    } catch {
      setUnits([]);
    }
  }

  async function fetchStockItems(kw = keyword, status = matFilter, page = currentPage) {
    try {
      const qs = new URLSearchParams({
        keyword: kw || "",
        status: status || "all",
        page: String(page),
        size: String(PAGE_SIZE),
      });
      const res = await fetch(`http://localhost:8080/api/inventory/materials?${qs.toString()}`);
      const data = await res.json();
      setStockItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setSummary({
        totalItems: data?.totalItems || 0,
        lowStock: data?.lowStock || 0,
        outOfStock: data?.outOfStock || 0,
      });
    } catch {
      setStockItems([]);
      setTotalPages(1);
      setSummary({ totalItems: 0, lowStock: 0, outOfStock: 0 });
    }
  }

  /* ================= COMPUTED DATA ================= */
  // Dữ liệu đã được lọc + phân trang ở backend.
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const pagedStockItems = stockItems;

  const totalItems = summary.totalItems;
  const lowStockItems = summary.lowStock;
  const outOfStockItems = summary.outOfStock;

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
      <div className="ui-page-stack">
        <div className="ui-screen-bar">
          <div className="ui-screen-head">
            <div className="ui-eyebrow">Kho vật tư</div>
            <h1 className="ui-screen-title">Danh sách vật tư tồn kho</h1>
          </div>
          <div className="ui-head-pill">Cập nhật: <b>{updatedAt}</b></div>
        </div>

        {/* Dải KPI nằm ngang */}
        <div className="ui-stat-grid eq-stat-grid">
            <div className="ui-stat-card is-primary">
              <p className="ui-stat-value">{totalItems}</p>
              <p className="ui-stat-label">Tổng mặt hàng</p>
            </div>

            <div className="ui-stat-card is-warning">
              <p className="ui-stat-value">{lowStockItems}</p>
              <p className="ui-stat-label">Sắp hết hàng</p>
            </div>

            <div className="ui-stat-card is-danger">
              <p className="ui-stat-value">{outOfStockItems}</p>
              <p className="ui-stat-label">Hết hàng</p>
            </div>
          </div>

          {/* Form thêm vật tư — chỉ hiển thị cho Thủ kho (quyền MATERIAL.MANAGE) */}
          {canManage && (
          <section className="ui-section">
            <h3 className="eq-add-title">Thêm vật tư mới</h3>

            <div className="eq-add-grid">
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
                <label className="ui-label">Quy cách</label>
                <input
                  className="ui-input"
                  placeholder="VD: Hộp 50 chiếc"
                  value={form.specification}
                  onChange={(e) => setForm({ ...form, specification: e.target.value })}
                />
              </div>

              <div className="ui-field">
                <label className="ui-label">Đơn vị</label>
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
                  <option value="A">A · Thiết yếu</option>
                  <option value="B">B · Quan trọng</option>
                  <option value="C">C · Thông dụng</option>
                  <option value="D">D · Ít quan trọng</option>
                </select>
              </div>

              <button type="button" className="ui-btn ui-btn-primary eq-add-btn" onClick={handleSubmit}>
                ＋ Thêm
              </button>
            </div>
          </section>
          )}

          {/* Bảng danh sách */}
          <section className="ui-section">
            <div className="ui-toolbar eq-toolbar">
              <div className="ui-filter-pills">
                {[
                  { key: "all", label: "Tất cả" },
                  { key: "low", label: "Sắp hết" },
                  { key: "out", label: "Hết hàng" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`ui-filter-pill ${matFilter === f.key ? "is-active" : ""}`}
                    onClick={() => {
                      setMatFilter(f.key);
                      setCurrentPage(0);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="ui-search-box">
                <svg className="ui-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 19a8 8 0 100-16 8 8 0 000 16z" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
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
                    <th>Đơn vị</th>
                    <th>Phân loại</th>
                    <th className="text-right">Tồn kho</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedStockItems.length > 0 ? (
                    pagedStockItems.map((item) => (
                      <tr key={item.materialId}>
                        <td data-label="Mã vật tư">
                          <span className="ui-mono">{item.materialCode}</span>
                        </td>
                        <td data-label="Tên vật tư">{item.materialName}</td>
                        <td data-label="Đơn vị">{item.unitName}</td>
                        <td data-label="Phân loại">
                          {item.category ? (
                            <span className={`ui-cat-badge is-${String(item.category).toLowerCase()}`}>
                              Loại {item.category}
                            </span>
                          ) : '—'}
                        </td>
                        <td data-label="Tồn kho" className="text-right">
                          <span className={getStockClass(item.closingStock)}>
                            {item.closingStock}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="ui-empty">
                        {keyword
                          ? `Không tìm thấy vật tư phù hợp với "${keyword}"`
                          : "Chưa có vật tư nào trong kho."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safeCurrentPage}
              totalPages={totalPages}
              onChange={setCurrentPage}
              ariaLabel="Phân trang danh sách vật tư"
            />
          </section>
      </div>
    </div>
  );
}
