import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./ReplenishmentRequest.css";
import MaterialSearchInput from "./MaterialSearchInput";

const API_URL = "http://localhost:8080/api";

function fmtDate(s) {
  if (!s) return "—";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
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

function statusLabel(code) {
  if (!code) return "—";
  switch (code.toUpperCase()) {
    case "PENDING": return "Đang chờ duyệt";
    case "APPROVED": return "Đã phê duyệt";
    case "REJECTED": return "Từ chối";
    default: return code;
  }
}

function statusUiClass(code) {
  switch (String(code || "").toUpperCase()) {
    case "APPROVED": return "is-approved";
    case "REJECTED": return "is-rejected";
    case "PENDING":
    default: return "is-pending";
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberOrEmpty(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function buildPreviousByMaterialId(rows) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?.materialId || map[row.materialId]) return;
    map[row.materialId] = row;
  });
  return map;
}

export default function ReplenishmentRequest() {
  const UNIT_MAP = useMemo(() => ({
    1: "Chai", 2: "Lọ", 3: "Hộp", 4: "Cái", 5: "ml", 6: "g", 7: "Viên", 8: "kg", 9: "Bộ",
  }), []);

  const createEmptyRow = () => ({
    rowId: crypto.randomUUID(),
    materialId: "",
    materialName: "",
    specification: "",
    unitId: "",
    qtyAvailable: "",
    qtyLastYear: "",
    qtyRequested: "",
    materialCode: "",
    manufacturer: "",
    reason: "",
  });

  const [activeTab, setActiveTab] = useState("create");
  const [currentUser, setCurrentUser] = useState(null);

  const [items, setItems] = useState([createEmptyRow()]);
  const [materials, setMaterials] = useState([]);
  const [stockByMaterialId, setStockByMaterialId] = useState({});
  const [previousByMaterialId, setPreviousByMaterialId] = useState({});
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [departmentInput, setDepartmentInput] = useState("");

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (activeTab !== "history") return;
    if (!currentUser?.id) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id]);

  function changeItem(index, e) {
    const { name, value } = e.target;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  }

  function handleSelectMaterial(index, material) {
    const stockInfo = stockByMaterialId[material.materialId] || {};
    const previousInfo = previousByMaterialId[material.materialId] || {};
    const currentStock = numberOrEmpty(stockInfo.closingStock ?? previousInfo.currentStock);
    const previousQty = numberOrEmpty(previousInfo.prevYearQty);

    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        materialId: material.materialId,
        materialName: material.materialName,
        specification: material.specification || "",
        unitId: material.unitId || "",
        materialCode: material.materialCode || "",
        manufacturer: material.manufacturer || "",
        qtyAvailable: currentStock,
        qtyLastYear: previousQty,
      };
      return updated;
    });
  }

  function addRow() {
    setItems((prev) => [...prev, createEmptyRow()]);
  }

  function deleteRow(rowId) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
  }

  async function submit(e) {
    e.preventDefault();

    const payload = {
      academicYear: "2025-2026",
      departmentId: selectedDept ? Number(selectedDept) : null,
      createdByEmail: currentUser?.email || null,
      items: items.map((item) => ({
        materialId: item.materialId ? Number(item.materialId) : null,
        currentStock: Number(item.qtyAvailable || 0),
        prevYearQty: Number(item.qtyLastYear || 0),
        thisYearQty: Number(item.qtyRequested || 0),
        proposedCode: item.materialCode || null,
        proposedManufacturer: item.manufacturer || null,
        justification: item.reason || null,
      })),
    };

    try {
      const res = await fetch(`${API_URL}/supp-forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi server");

      Swal.fire({
        icon: "success",
        title: "Đã gửi phiếu",
        text: data.message || "Tạo phiếu thành công",
        timer: 1800,
        showConfirmButton: false,
      });

      setItems([createEmptyRow()]);
      if (historyItems.length > 0) loadHistory();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Gửi thất bại", text: error.message });
    }
  }

  async function loadHistory() {
    if (!currentUser?.id) return;
    setHistoryLoading(true);
    setHistoryErr("");
    try {
      const res = await fetch(`${API_URL}/supp-forecast/my?userId=${currentUser.id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || `HTTP ${res.status}`);
      setHistoryItems(Array.isArray(data.items) ? data.items : []);
      setHistoryPage(0);
    } catch (err) {
      setHistoryErr(err.message || "Không thể tải lịch sử phiếu dự trù");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openForecastDetail(forecastId) {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_URL}/supp-forecast/${forecastId}?userId=${currentUser.id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const sCode = (data.status || "").toUpperCase();
      const statusText = statusLabel(sCode);
      const statusColor = sCode === "APPROVED" ? "#166534" : sCode === "REJECTED" ? "#991b1b" : "#92400e";
      const statusBg = sCode === "APPROVED" ? "#dcfce7" : sCode === "REJECTED" ? "#fee2e2" : "#fef3c7";

      const details = Array.isArray(data.details) ? data.details : [];
      const rowsHtml = details.map((d, i) => {
        const name = d.material?.name || "—";
        const code = d.material?.code || "—";
        return `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td>${escapeHtml(code)}</td>
            <td>${escapeHtml(name)}</td>
            <td class="text-right">${escapeHtml(String(d.currentStock ?? "—"))}</td>
            <td class="text-right">${escapeHtml(String(d.prevYearQty ?? "—"))}</td>
            <td class="text-right">${escapeHtml(String(d.thisYearQty ?? "—"))}</td>
            <td>${escapeHtml(d.justification || "—")}</td>
          </tr>
        `;
      }).join("");

      const html = `
        <div class="ui-history-detail">
          <div class="ui-history-detail-head">Chi tiết Phiếu Dự Trù #${escapeHtml(String(data.id))}</div>
          <div class="ui-history-detail-body">
            <div class="ui-history-info">
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Mã phiếu:</div>
                <div class="ui-history-info-value">#${escapeHtml(String(data.id))}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Năm học:</div>
                <div class="ui-history-info-value">${escapeHtml(data.academicYear || "—")}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Ngày tạo:</div>
                <div class="ui-history-info-value">${escapeHtml(fmtDate(data.createdAt || ""))}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Bộ môn:</div>
                <div class="ui-history-info-value">${escapeHtml(data.department?.name || "Không có")}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Người tạo:</div>
                <div class="ui-history-info-value">${escapeHtml(data.createdBy?.fullName || "—")}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Trạng thái:</div>
                <div class="ui-history-info-value"><span style="background:${statusBg};color:${statusColor};padding:4px 10px;border-radius:4px;font-weight:800;font-size:0.8rem;">${escapeHtml(statusText)}</span></div>
              </div>
              ${data.approvalNote ? `
                <div class="ui-history-info-row">
                  <div class="ui-history-info-label">Ghi chú duyệt:</div>
                  <div class="ui-history-info-value">${escapeHtml(data.approvalNote)}</div>
                </div>
              ` : ""}
            </div>

            <h4 class="ui-history-detail-section-title">Danh sách vật tư (${details.length} vật tư)</h4>
            <div class="ui-history-table-wrap">
              <table class="ui-history-table">
                <thead>
                  <tr>
                    <th>TT</th>
                    <th>Mã code</th>
                    <th>Tên vật tư</th>
                    <th class="text-right">SL hiện có</th>
                    <th class="text-right">Năm trước</th>
                    <th class="text-right">Dự trù</th>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml || '<tr><td colspan="7" class="text-center">Không có vật tư</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      await Swal.fire({
        html,
        width: 960,
        customClass: {
          popup: "ui-history-detail-popup",
        },
        showConfirmButton: false,
        confirmButtonText: "Đóng",
      });
    } catch (err) {
      await Swal.fire({ icon: "error", title: "Không thể tải chi tiết", text: err.message, confirmButtonText: "OK" });
    }
  }

  async function loadPreviousForecast() {
    try {
      const url = selectedDept
        ? `${API_URL}/supp-forecast/previous?departmentId=${selectedDept}`
        : `${API_URL}/supp-forecast/previous`;

      const res = await fetch(url);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        Swal.fire({ icon: "info", title: "Không có dữ liệu dự trù năm trước", timer: 1500, showConfirmButton: false });
        return;
      }

      setPreviousByMaterialId(buildPreviousByMaterialId(data));

      const mapped = data.map((item) => ({
        rowId: crypto.randomUUID(),
        materialId: item.materialId,
        materialName: item.materialName,
        specification: item.specification,
        unitId: item.unitId,
        qtyAvailable: Number(item.currentStock || 0),
        qtyLastYear: Number(item.prevYearQty || 0),
        qtyRequested: Number(item.thisYearQty || 0),
        materialCode: item.materialCode,
        manufacturer: item.manufacturer,
        reason: "Tải từ dự trù năm trước",
      }));

      setItems(mapped);
      Swal.fire({ icon: "success", title: "Đã tải dự trù năm trước", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Lỗi", error.message, "error");
    }
  }

  async function fetchDepartments() {
    try {
      const res = await fetch(`${API_URL}/departments`);
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    }
  }

  async function fetchMaterials() {
    try {
      const res = await fetch(`${API_URL}/materials`);
      const data = await res.json();
      setMaterials(Array.isArray(data) ? data : []);
    } catch {
      setMaterials([]);
    }
  }

  async function fetchMaterialStock() {
    try {
      const res = await fetch(`${API_URL}/inventory/materials`);
      const data = await res.json();
      const map = {};
      (Array.isArray(data) ? data : []).forEach((item) => {
        if (!item?.materialId) return;
        map[item.materialId] = item;
      });
      setStockByMaterialId(map);
    } catch {
      setStockByMaterialId({});
    }
  }

  async function fetchPreviousLookup(departmentId = selectedDept) {
    try {
      const url = departmentId
        ? `${API_URL}/supp-forecast/previous?departmentId=${departmentId}`
        : `${API_URL}/supp-forecast/previous`;
      const res = await fetch(url);
      const data = await res.json();
      setPreviousByMaterialId(buildPreviousByMaterialId(Array.isArray(data) ? data : []));
    } catch {
      setPreviousByMaterialId({});
    }
  }

  useEffect(() => {
    fetchMaterials();
    fetchMaterialStock();
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchPreviousLookup(selectedDept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept]);

  const materialSearchItems = useMemo(
    () => materials.map((m) => ({
      id: m.materialId,
      materialName: m.materialName,
      materialCode: m.materialCode || '',
      unitName: UNIT_MAP[m.unitId] || '',
    })),
    [materials, UNIT_MAP]
  );

  const departmentSearchItems = useMemo(
    () => departments.map((dept) => ({
      id: dept.id,
      materialName: dept.name,
      materialCode: "",
    })),
    [departments]
  );

  const handleDepartmentInputChange = (text) => {
    setDepartmentInput(text);

    const normalized = text.trim().toLowerCase();
    const matched = departments.find((dept) => String(dept?.name || "").trim().toLowerCase() === normalized);
    setSelectedDept(matched?.id ? String(matched.id) : "");
  };

  const handleSelectDepartment = (deptItem) => {
    setSelectedDept(String(deptItem.id));
    setDepartmentInput(deptItem.materialName || "");
  };

  const filteredHistory = useMemo(() => {
    const search = (historySearch || "").trim().toLowerCase();
    if (!search) return historyItems;
    return historyItems.filter((item) =>
      String(item.id ?? "").includes(search) ||
      String(item.academicYear ?? "").toLowerCase().includes(search) ||
      String(item.departmentName ?? "").toLowerCase().includes(search) ||
      String(item.status ?? "").toLowerCase().includes(search) ||
      String(item.createdAt ?? "").includes(search)
    );
  }, [historyItems, historySearch]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages - 1);
  const pagedHistory = filteredHistory.slice(
    safeHistoryPage * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE
  );

  return (
    <div className="ui-page req-page">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Tạo phiếu dự trù bổ sung vật tư</h1>
          </div>
          <div className="ui-tabs" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`ui-tab ${activeTab === "create" ? "is-active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              Tạo phiếu
            </button>
            <button
              type="button"
              className={`ui-tab ${activeTab === "history" ? "is-active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Lịch sử phiếu dự trù
            </button>
          </div>
        </div>

        {activeTab === "create" ? (
          <section className="ui-section">
            <form className="req-form" onSubmit={submit}>
              <div className="req-topbar">
                <div className="ui-field req-department-field">
                  <label className="ui-label">Chọn bộ môn lập dự trù</label>
                  <MaterialSearchInput
                    value={departmentInput}
                    onChange={handleDepartmentInputChange}
                    onSelect={handleSelectDepartment}
                    items={departmentSearchItems}
                    placeholder="Gõ để tìm bộ môn..."
                    emptyText="Không tìm thấy bộ môn"
                  />
                </div>

                <div className="req-top-actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn-secondary"
                    onClick={loadPreviousForecast}
                  >
                    Tải dự trù năm trước
                  </button>
                </div>
              </div>

              <div className="ui-table-wrap">
                <table className="ui-table req-table">
                  <thead>
                    <tr>
                      <th className="text-center">STT</th>
                      <th>Tên vật tư</th>
                      <th>Quy cách</th>
                      <th>ĐVT</th>
                      <th>SL hiện có</th>
                      <th>Năm trước</th>
                      <th>Dự trù</th>
                      <th>Mã code</th>
                      <th>Hãng SX</th>
                      <th>Lý do</th>
                      <th className="text-center">Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length > 0 ? (
                      items.map((item, index) => (
                        <tr key={item.rowId}>
                          <td className="text-center" data-label="STT">{index + 1}</td>

                          <td data-label="Tên vật tư">
                            <MaterialSearchInput
                              value={item.materialName || ""}
                              onChange={(text) =>
                                setItems((prev) => {
                                  const u = [...prev];
                                  u[index] = { ...u[index], materialName: text };
                                  return u;
                                })
                              }
                              onSelect={(selectedItem) => {
                                const original = materials.find(
                                  (m) => m.materialId === selectedItem.id
                                );
                                if (original) handleSelectMaterial(index, original);
                              }}
                              items={materialSearchItems}
                              placeholder="Chọn vật tư"
                            />
                          </td>

                          <td data-label="Quy cách">
                            <input className="ui-input" name="specification" value={item.specification || ""} readOnly />
                          </td>

                          <td data-label="ĐVT">
                            <input className="ui-input" name="unitId" value={UNIT_MAP[item.unitId] || ""} readOnly />
                          </td>

                          <td data-label="SL hiện có">
                            <input className="ui-input" type="number" name="qtyAvailable" value={item.qtyAvailable || ""} readOnly />
                          </td>

                          <td data-label="Năm trước">
                            <input className="ui-input" type="number" name="qtyLastYear" value={item.qtyLastYear || ""} readOnly />
                          </td>

                          <td data-label="Dự trù">
                            <input
                              className="ui-input"
                              type="number"
                              name="qtyRequested"
                              value={item.qtyRequested || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td data-label="Mã code">
                            <input className="ui-input" name="materialCode" value={item.materialCode || ""} readOnly />
                          </td>

                          <td data-label="Hãng SX">
                            <input className="ui-input" name="manufacturer" value={item.manufacturer || ""} readOnly />
                          </td>

                          <td data-label="Lý do">
                            <input
                              className="ui-input"
                              name="reason"
                              value={item.reason || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td className="text-center">
                            <button
                              type="button"
                              className="ui-btn ui-btn-danger ui-btn-sm"
                              onClick={() => deleteRow(item.rowId)}
                              disabled={items.length === 1}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" className="ui-empty">Không có dữ liệu</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="req-actions">
                <button type="button" className="ui-btn ui-btn-secondary" onClick={addRow}>
                  + Thêm dòng
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Gửi phiếu
                </button>
              </div>
            </form>
          </section>
        ) : (
          <div className="ui-section">
            <div className="ui-section-head">
              <div>
                <h2 className="ui-section-title">Lịch sử phiếu dự trù</h2>
              </div>
            </div>

            <div className="req-history-toolbar">
              <div className="req-history-search">
                <input
                  className="ui-input"
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(0);
                  }}
                  placeholder="Tìm theo mã phiếu / ngày / bộ môn / trạng thái..."
                />
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
                onClick={loadHistory}
                disabled={historyLoading}
              >
                Tải lại
              </button>
            </div>

            {historyErr ? <div className="ui-alert is-error">{historyErr}</div> : null}

            <div className="ui-table-wrap">
              <table className="ui-table req-history-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 100 }}>Mã phiếu</th>
                    <th style={{ minWidth: 120 }}>Ngày tạo</th>
                    <th style={{ minWidth: 100 }}>Năm học</th>
                    <th style={{ minWidth: 200 }}>Bộ môn</th>
                    <th style={{ minWidth: 150 }}>Trạng thái</th>
                    <th style={{ width: 100 }} className="text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.length > 0 ? (
                    pagedHistory.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Mã phiếu">#{item.id}</td>
                        <td data-label="Ngày tạo">{fmtDate(item.createdAt)}</td>
                        <td data-label="Năm học">{item.academicYear}</td>
                        <td data-label="Bộ môn">{item.departmentName || "—"}</td>
                        <td data-label="Trạng thái">
                          <span className={`ui-status-badge ${statusUiClass(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="ui-btn ui-btn-secondary ui-btn-sm"
                            onClick={() => openForecastDetail(item.id)}
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="ui-empty">
                        {historyLoading ? "Đang tải..." : "Chưa có phiếu dự trù"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-pagination" aria-label="Phân trang lịch sử phiếu dự trù">
              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                disabled={historyLoading || safeHistoryPage <= 0}
              >
                Trang trước
              </button>

              {visiblePageNumbers(historyTotalPages, safeHistoryPage).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`ui-pagination-btn ${page === safeHistoryPage ? "is-active" : ""}`}
                  onClick={() => setHistoryPage(page)}
                  disabled={historyLoading || page === safeHistoryPage}
                >
                  {page + 1}
                </button>
              ))}

              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setHistoryPage((page) => Math.min(historyTotalPages - 1, page + 1))}
                disabled={historyLoading || safeHistoryPage >= historyTotalPages - 1}
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
