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

function statusLabel(code) {
  if (!code) return "—";
  switch (code.toUpperCase()) {
    case "PENDING": return "Đang chờ duyệt";
    case "APPROVED": return "Đã phê duyệt";
    case "REJECTED": return "Từ chối";
    default: return code;
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
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");
  const [historySearch, setHistorySearch] = useState("");

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
            <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${i + 1}</td>
            <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(name)}</td>
            <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(code)}</td>
            <td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(d.currentStock ?? "—"))}</td>
            <td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(d.prevYearQty ?? "—"))}</td>
            <td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(d.thisYearQty ?? "—"))}</td>
            <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(d.justification || "—")}</td>
          </tr>
        `;
      }).join("");

      const html = `
        <div style="text-align:left;font-size:14px;">
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">
            <div><b>Mã phiếu:</b> #${escapeHtml(String(data.id))}</div>
            <div><b>Năm học:</b> ${escapeHtml(data.academicYear || "—")}</div>
            <div><b>Ngày tạo:</b> ${escapeHtml(String(data.createdAt || "—"))}</div>
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">
            <div><b>Bộ môn:</b> ${escapeHtml(data.department?.name || "Không có")}</div>
            <div><b>Người tạo:</b> ${escapeHtml(data.createdBy?.fullName || "—")}</div>
            <div><b>Trạng thái:</b> <span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8em;">${escapeHtml(statusText)}</span></div>
          </div>
          ${data.approvalNote ? `<div style="margin-bottom:8px;"><b>Ghi chú duyệt:</b> ${escapeHtml(data.approvalNote)}</div>` : ""}
          <div style="margin-top:12px;">
            <b>Chi tiết vật tư (${details.length} dòng):</b>
            <div style="overflow:auto;max-height:320px;border:1px solid #e5e7eb;border-radius:8px;margin-top:8px;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:8px;text-align:left;">#</th>
                    <th style="padding:8px;text-align:left;">Tên vật tư</th>
                    <th style="padding:8px;text-align:left;">Mã code</th>
                    <th style="padding:8px;text-align:right;">SL hiện có</th>
                    <th style="padding:8px;text-align:right;">Năm trước</th>
                    <th style="padding:8px;text-align:right;">Dự trù</th>
                    <th style="padding:8px;text-align:left;">Lý do</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml || '<tr><td colspan="7" style="padding:12px;text-align:center;color:#6b7280;">Không có vật tư</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      await Swal.fire({
        title: `Chi tiết phiếu dự trù #${data.id}`,
        html,
        width: 860,
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

  useEffect(() => {
    fetchMaterials();
    fetchDepartments();
  }, []);

  const materialSearchItems = useMemo(
    () => materials.map((m) => ({
      id: m.materialId,
      materialName: m.materialName,
      materialCode: m.materialCode || '',
      unitName: UNIT_MAP[m.unitId] || '',
    })),
    [materials, UNIT_MAP]
  );

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
                  <select
                    className="ui-select"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                  >
                    <option value="">-- Chọn bộ môn --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
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
                  onChange={(e) => setHistorySearch(e.target.value)}
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
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Mã phiếu">#{item.id}</td>
                        <td data-label="Ngày tạo">{fmtDate(item.createdAt)}</td>
                        <td data-label="Năm học">{item.academicYear}</td>
                        <td data-label="Bộ môn">{item.departmentName || "—"}</td>
                        <td data-label="Trạng thái">
                          <span className={`req-status-badge req-status-${(item.status || "").toLowerCase()}`}>
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
          </div>
        )}
      </div>
    </div>
  );
}
