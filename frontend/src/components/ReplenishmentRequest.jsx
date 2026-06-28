import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Pagination from "./Pagination";
import "./dashboard-ui.css";
import "./ReplenishmentRequest.css";
import MaterialSearchInput from "./MaterialSearchInput";

const API_URL = "http://localhost:8080/api";

function fmtDate(s) {
  if (!s) return "—";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
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
  const [previousByMaterialId, setPreviousByMaterialId] = useState({});
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [departmentInput, setDepartmentInput] = useState("");

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    setCurrentUser(user);
  }, []);

  // Lọc (keyword) + phân trang ở backend; debounce theo từ khóa.
  useEffect(() => {
    if (activeTab !== "history") return undefined;
    if (!currentUser?.id) return undefined;
    const t = setTimeout(() => loadHistory(historySearch, historyPage), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id, historySearch, historyPage]);

  function changeItem(index, e) {
    const { name, value } = e.target;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  }

  // Tra cứu tồn kho hiện có của 1 vật tư ở backend (không tải toàn bộ kho về FE).
  async function fetchCurrentStock(material) {
    const kw = material.materialCode || material.materialName || "";
    if (!kw) return null;
    try {
      const res = await fetch(`${API_URL}/inventory/materials?keyword=${encodeURIComponent(kw)}&size=50`);
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : [];
      const row = list.find((x) => x.materialId === material.materialId);
      return row ? numberOrEmpty(row.closingStock) : null;
    } catch {
      return null;
    }
  }

  async function handleSelectMaterial(index, material) {
    const previousInfo = previousByMaterialId[material.materialId] || {};
    const liveStock = await fetchCurrentStock(material);
    const currentStock = liveStock != null ? liveStock : numberOrEmpty(previousInfo.currentStock);
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

  async function loadHistory(kw = historySearch, page = historyPage) {
    if (!currentUser?.id) return;
    setHistoryLoading(true);
    setHistoryErr("");
    try {
      const qs = new URLSearchParams({
        userId: String(currentUser.id),
        keyword: kw || "",
        page: String(page),
        size: String(HISTORY_PAGE_SIZE),
      });
      const res = await fetch(`${API_URL}/supp-forecast/my?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || `HTTP ${res.status}`);
      setHistoryItems(Array.isArray(data.items) ? data.items : []);
      setHistoryTotalPages(Math.max(1, data.totalPages || 1));
      setHistoryTotalCount(data.totalCount || 0);
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

      const mapped = data.map((item) => {
        const currentStock = Number(item.currentStock || 0);
        const prevYearQty = Number(item.prevYearQty || 0);
        // Dự trù = Năm trước − Hiện có (không âm)
        const proposed = Math.max(0, prevYearQty - currentStock);
        return {
          rowId: crypto.randomUUID(),
          materialId: item.materialId,
          materialName: item.materialName,
          specification: item.specification,
          unitId: item.unitId,
          qtyAvailable: currentStock,
          qtyLastYear: prevYearQty,
          qtyRequested: proposed,
          materialCode: item.materialCode,
          manufacturer: item.manufacturer,
          reason: "Tải từ dự trù năm trước",
        };
      });

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

  // Tìm vật tư ở backend (server-side) cho ô gợi ý — không tải toàn bộ danh mục.
  async function searchMaterials(kw) {
    try {
      const res = await fetch(
        `${API_URL}/materials/search?keyword=${encodeURIComponent(kw || "")}&limit=20`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data) ? data : []).map((m) => ({
        id: m.id,
        materialId: m.id,
        materialName: m.name,
        materialCode: m.code || "",
        specification: m.spec || "",
        unitId: m.unit?.id ?? m.unitId ?? "",
        manufacturer: m.manufacturer || "",
        category: m.category || "",
      }));
    } catch {
      return [];
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
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchPreviousLookup(selectedDept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept]);

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

  // Dữ liệu đã được lọc + phân trang ở backend.
  const safeHistoryPage = Math.min(historyPage, historyTotalPages - 1);
  const pagedHistory = historyItems;

  return (
    <div className="ui-page req-page">
      <div className="ui-page-stack">
        <div className="ui-screen-bar">
          <div className="ui-screen-head">
            <div className="ui-eyebrow">Dự trù</div>
            <h1 className="ui-screen-title">Tạo phiếu dự trù bổ sung</h1>
          </div>
          <div className="ui-segment">
            <button
              type="button"
              className={`ui-segment-btn ${activeTab === "create" ? "is-active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              Tạo phiếu
            </button>
            <button
              type="button"
              className={`ui-segment-btn ${activeTab === "history" ? "is-active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Lịch sử
            </button>
          </div>
        </div>

        {activeTab === "create" ? (
          <section className="ui-section">
            <form className="req-form" onSubmit={submit}>
              <div className="req-topbar">
                <div className="ui-field req-department-field">
                  <label className="ui-label">Bộ môn lập dự trù</label>
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
                    className="ui-btn-ghost"
                    onClick={loadPreviousForecast}
                  >
                    ↻ Tải dự trù năm trước
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
                      <th>Hiện có</th>
                      <th>Năm trước</th>
                      <th>Dự trù</th>
                      <th>Lý do</th>
                      <th></th>
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
                              onSelect={(selectedItem) => handleSelectMaterial(index, selectedItem)}
                              onSearch={searchMaterials}
                              placeholder="Chọn vật tư"
                            />
                          </td>

                          <td data-label="Quy cách">
                            <input className="ui-input" name="specification" value={item.specification || ""} readOnly />
                          </td>

                          <td data-label="ĐVT">
                            <input className="ui-input" name="unitId" value={UNIT_MAP[item.unitId] || ""} readOnly />
                          </td>

                          <td data-label="Hiện có">
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
                              className="ui-remove-btn"
                              onClick={() => deleteRow(item.rowId)}
                              disabled={items.length === 1}
                              title="Xóa dòng"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="ui-empty">Không có dữ liệu</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="req-actions">
                <button type="button" className="ui-add-dashed" onClick={addRow}>
                  ＋ Thêm dòng
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Gửi phiếu dự trù
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
                className="ui-btn ui-btn-light"
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
                        <td data-label="Mã phiếu"><span className="ui-mono">#{item.id}</span></td>
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
                            className="ui-btn-ghost"
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

            <Pagination
              page={safeHistoryPage}
              totalPages={historyTotalPages}
              onChange={setHistoryPage}
              disabled={historyLoading}
              ariaLabel="Phân trang lịch sử phiếu dự trù"
            />
          </div>
        )}
      </div>
    </div>
  );
}
