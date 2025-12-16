import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { createPortal } from "react-dom";
import "./IssuePage.css";

const API_URL = "http://localhost:8080/api";
const API_ENDPOINTS = {
  AUTH: `${API_URL}/auth`,
  ISSUES: `${API_URL}/issues`,
};

const moneyFmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/,/g, ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(v) {
  if (!v) return "";
  return String(v).replace("T", " ");
}

function safeStr(s) {
  return s == null ? "" : String(s);
}

function sumLotDraft(draft) {
  return Object.values(draft || {}).reduce((a, b) => a + toNumber(b), 0);
}

function groupLinesByMaterial(lines) {
  const map = new Map();
  (lines || []).forEach((ln) => {
    const materialId = ln?.materialId;
    if (!materialId) return;

    const existed = map.get(materialId);
    const need = toNumber(ln?.qtyRequested);
    const toIssue = toNumber(ln?.qtyToIssue);

    if (!existed) {
      map.set(materialId, {
        ...ln,
        qtyRequested: need,
        qtyToIssue: toIssue,
        lots: Array.isArray(ln?.lots) ? ln.lots : [],
      });
    } else {
      existed.qtyRequested += need;
      existed.qtyToIssue += toIssue;
    }
  });
  return Array.from(map.values());
}

function vnReason(reasonCode) {
  const code = safeStr(reasonCode).toUpperCase();
  switch (code) {
    case "ALREADY_ISSUED":
      return "Phiếu này đã được xuất kho trước đó";
    case "HAS_UNMAPPED_MATERIAL":
      return "Có vật tư chưa map mã vật tư (thiếu material_id / code)";
    case "NOT_ENOUGH_STOCK":
      return "Không đủ tồn kho theo thẻ kho";
    default:
      return "Không đủ điều kiện";
  }
}

export default function IssuePage() {
  // -------- Current user (thủ kho) ----------
  const [currentUser, setCurrentUser] = useState(null);
  const [bootError, setBootError] = useState("");

  // -------- Filters  ----------
  const [departmentId, setDepartmentId] = useState("");
  const [subDepartmentId, setSubDepartmentId] = useState("");
  const [limit, setLimit] = useState("80");

  // -------- List eligible/ineligible ----------
  const [loadingList, setLoadingList] = useState(false);
  const [listMsg, setListMsg] = useState({ type: "", text: "" });
  const [eligible, setEligible] = useState([]);
  const [ineligible, setIneligible] = useState([]);
  const [summary, setSummary] = useState(null);

  // Ẩn mặc định để UI không “quá nhiều”
  const [showIneligible, setShowIneligible] = useState(false);

  // -------- Selected request & preview ----------
  const [selected, setSelected] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewMsg, setPreviewMsg] = useState({ type: "", text: "" });
  const [previewData, setPreviewData] = useState(null);

  // -------- Issue config ----------
  const [issueDate, setIssueDate] = useState(todayISO());
  const [warehouseName, setWarehouseName] = useState("Kho chính");
  const [receiverName, setReceiverName] = useState("");
  const [autoAllocate, setAutoAllocate] = useState(true);

  // -------- Manual allocations ----------
  const [manualAlloc, setManualAlloc] = useState({});

  // -------- Create issue ----------
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState({ type: "", text: "" });
  const [createdIssueId, setCreatedIssueId] = useState(null);

  // -------- Issue detail ----------
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [issueDetail, setIssueDetail] = useState(null);

  // -------- Manual lot modal ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLine, setModalLine] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalLots, setModalLots] = useState([]);
  const [modalDraft, setModalDraft] = useState({});

  // ------------------ boot user ------------------
  useEffect(() => {
    const init = async () => {
      try {
        const userFromStorage = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const email = userFromStorage.email;
        if (!email) {
          setBootError("Không lấy được thông tin đăng nhập. Vui lòng đăng nhập lại.");
          return;
        }
        const res = await fetch(`${API_ENDPOINTS.AUTH}/user-info?email=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCurrentUser(data);
      } catch {
        setBootError("Không thể tải thông tin người dùng. Vui lòng đăng nhập lại.");
      }
    };
    init();
  }, []);

  // ------------------ API helpers ------------------
  const authHeaders = useMemo(() => {
    return {
      "Content-Type": "application/json",
      "X-User-Id": currentUser?.id ? String(currentUser.id) : "",
    };
  }, [currentUser]);

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);
    return data;
  };

  // ------------------ load list ------------------
  const loadEligibleList = async () => {
    if (!currentUser?.id) {
      setListMsg({ type: "error", text: "Chưa xác định được tài khoản đang dùng." });
      return;
    }

    setLoadingList(true);
    setListMsg({ type: "", text: "" });

    try {
      const params = new URLSearchParams();
      if (departmentId.trim()) params.set("departmentId", departmentId.trim());
      if (subDepartmentId.trim()) params.set("subDepartmentId", subDepartmentId.trim());

      // GIỮ LIMIT
      const lim = Number(limit);
      if (Number.isFinite(lim) && lim > 0) params.set("limit", String(lim));
      else params.set("limit", "80");

      const data = await fetchJson(
        `${API_ENDPOINTS.ISSUES}/eligible-requests-with-reasons?${params.toString()}`,
        { headers: authHeaders }
      );

      if (!data?.success) {
        setListMsg({ type: "error", text: data?.message || "Không thể tải danh sách." });
        setEligible([]);
        setIneligible([]);
        setSummary(null);
        return;
      }

      setEligible(Array.isArray(data?.eligible) ? data.eligible : []);
      setIneligible(Array.isArray(data?.ineligible) ? data.ineligible : []);
      setSummary(data?.summary || null);

      setListMsg({ type: "success", text: data?.message || "Đã tải danh sách." });

      // Nếu selected không còn trong eligible thì reset preview
      if (selected?.id) {
        const still = (data.eligible || []).some((x) => x?.id === selected.id);
        if (!still) {
          setSelected(null);
          setPreviewData(null);
          setManualAlloc({});
          setCreateMsg({ type: "", text: "" });
          setIssueDetail(null);
          setCreatedIssueId(null);
        }
      }
    } catch {
      setListMsg({ type: "error", text: "Lỗi khi tải danh sách." });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) loadEligibleList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ------------------ select & preview ------------------
  const loadPreview = async (req) => {
    if (!req?.id) return;
    if (!currentUser?.id) return;

    setSelected(req);
    setPreviewData(null);
    setIssueDetail(null);
    setCreatedIssueId(null);

    setAutoAllocate(true);
    setManualAlloc({});
    setReceiverName("");
    setIssueDate(todayISO());
    setWarehouseName("Kho chính");

    setLoadingPreview(true);
    setPreviewMsg({ type: "", text: "" });

    try {
      const data = await fetchJson(
        `${API_ENDPOINTS.ISSUES}/preview?issueReqId=${encodeURIComponent(req.id)}`,
        { headers: authHeaders }
      );

      if (!data?.success) {
        setPreviewMsg({ type: "error", text: data?.message || "Không thể xem trước phiếu xuất." });
        return;
      }

      setPreviewData(data);
      setPreviewMsg({ type: "success", text: data?.message || "Đã xem trước phiếu xuất." });
    } catch {
      setPreviewMsg({ type: "error", text: "Lỗi khi xem trước phiếu." });
    } finally {
      setLoadingPreview(false);
    }
  };

  const previewLines = useMemo(() => {
    const lines = previewData?.lines || [];
    return groupLinesByMaterial(lines);
  }, [previewData]);

  const previewMissingMessages = useMemo(() => {
    const s = previewData?.summary || {};
    return Array.isArray(s?.missingMessages) ? s.missingMessages : [];
  }, [previewData]);

  const canCreateIssue = useMemo(() => {
    if (!selected?.id) return false;
    if (!previewData?.success) return false;
    if (previewMissingMessages.length > 0) return false;
    return true;
  }, [selected, previewData, previewMissingMessages]);

  // ------------------ manual modal ------------------
  const openModalForLine = async (line) => {
    if (!line?.materialId) return;

    setModalOpen(true);
    setModalLine(line);
    setModalError("");
    setModalLots([]);
    setModalDraft({});
    setModalLoading(true);

    try {
      const lots = await fetchJson(`${API_ENDPOINTS.ISSUES}/materials/${line.materialId}/lots`, {
        headers: authHeaders,
      });

      const arr = Array.isArray(lots) ? lots : [];
      setModalLots(arr);

      const saved = manualAlloc?.[line.materialId]?.lots || {};
      const draft = {};
      arr.forEach((l) => {
        const lot = safeStr(l?.lotNumber).trim();
        if (!lot) return;
        draft[lot] = saved[lot] ?? 0;
      });
      setModalDraft(draft);
    } catch {
      setModalError("Không thể tải danh sách lô.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalLine(null);
    setModalError("");
    setModalLots([]);
    setModalDraft({});
    setModalLoading(false);
  };

  const fillFEFOSuggestion = () => {
    if (!modalLine?.materialId) return;
    const sug = (previewLines || []).find((x) => x.materialId === modalLine.materialId);
    if (!sug?.lots?.length) return;

    const next = { ...(modalDraft || {}) };
    Object.keys(next).forEach((k) => (next[k] = 0));

    sug.lots.forEach((l) => {
      const lot = safeStr(l?.lotNumber).trim();
      const q = toNumber(l?.qtyOut);
      if (!lot) return;
      next[lot] = q;
    });

    setModalDraft(next);
  };

  const saveModalAllocation = () => {
    if (!modalLine?.materialId) return;

    const need = toNumber(modalLine.qtyToIssue ?? modalLine.qtyRequested);
    const total = sumLotDraft(modalDraft);

    if (need <= 0) {
      setModalError("Số lượng cần xuất không hợp lệ.");
      return;
    }

    const availMap = new Map();
    modalLots.forEach((l) => availMap.set(safeStr(l?.lotNumber).trim(), toNumber(l?.availableStock)));

    for (const [lot, q] of Object.entries(modalDraft || {})) {
      const qty = toNumber(q);
      if (qty < 0) {
        setModalError("Số lượng xuất không được âm.");
        return;
      }
      const avail = availMap.get(lot) ?? 0;
      if (qty > avail + 1e-9) {
        setModalError(`Lô ${lot} vượt tồn còn lại (còn ${qtyFmt.format(avail)}).`);
        return;
      }
    }

    if (Math.abs(total - need) > 1e-9) {
      setModalError(`Tổng theo lô phải đúng bằng ${qtyFmt.format(need)} (hiện: ${qtyFmt.format(total)}).`);
      return;
    }

    setManualAlloc((prev) => ({
      ...prev,
      [modalLine.materialId]: {
        qtyIssued: need,
        lots: { ...(modalDraft || {}) },
      },
    }));

    closeModal();
  };

  const validateManualBeforeCreate = () => {
    for (const ln of previewLines) {
      const materialId = ln.materialId;
      const need = toNumber(ln.qtyToIssue ?? ln.qtyRequested);
      const saved = manualAlloc?.[materialId];

      if (!saved) return `Chưa chọn lô cho: ${ln.code} - ${ln.name}`;
      const total = sumLotDraft(saved.lots);
      if (Math.abs(total - need) > 1e-9) return `Tổng theo lô không khớp cho: ${ln.code} - ${ln.name}`;
    }
    return "";
  };

  const buildCreatePayload = () => {
    const payload = {
      issueReqId: selected.id,
      issueDate: issueDate || todayISO(),
      warehouseName: warehouseName?.trim() ? warehouseName.trim() : "Kho chính",
      receiverName: receiverName?.trim() ? receiverName.trim() : null,
      autoAllocate: !!autoAllocate,
      manualLines: null,
    };

    if (!autoAllocate) {
      payload.manualLines = previewLines.map((ln) => {
        const need = toNumber(ln.qtyToIssue ?? ln.qtyRequested);
        const saved = manualAlloc?.[ln.materialId] || { lots: {} };

        const lots = Object.entries(saved.lots || {})
          .map(([lotNumber, qtyOut]) => ({ lotNumber, qtyOut: toNumber(qtyOut) }))
          .filter((x) => x.lotNumber && x.qtyOut > 0);

        return { materialId: ln.materialId, qtyIssued: need, lots };
      });
    }

    return payload;
  };

  const loadIssueDetail = async (issueId) => {
    if (!issueId) return;
    setLoadingDetail(true);
    setIssueDetail(null);
    try {
      const data = await fetchJson(`${API_ENDPOINTS.ISSUES}/${issueId}/detail`, { headers: authHeaders });
      if (!data?.success) {
        setIssueDetail(null);
        return;
      }
      setIssueDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  const createIssue = async () => {
    if (!currentUser?.id) return;

    if (!canCreateIssue) {
      setCreateMsg({ type: "error", text: "Phiếu chưa đủ điều kiện để xuất kho." });
      return;
    }

    if (!autoAllocate) {
      const err = validateManualBeforeCreate();
      if (err) {
        setCreateMsg({ type: "error", text: err });
        return;
      }
    }

    setCreating(true);
    setCreateMsg({ type: "", text: "" });

    try {
      const payload = buildCreatePayload();

      const data = await fetchJson(`${API_ENDPOINTS.ISSUES}/create-from-issue-req`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!data?.success) {
        setCreateMsg({ type: "error", text: data?.message || "Xuất kho thất bại." });
        return;
      }

      const issueId = data?.header?.id || data?.data?.header?.id || null;
      setCreatedIssueId(issueId);

      await Swal.fire({
        icon: "success",
        title: "Xuất kho thành công",
        text: data?.message || "Phiếu xuất đã được lưu và cập nhật thẻ kho.",
        confirmButtonText: "OK",
      });

      setCreateMsg({ type: "success", text: data?.message || "Xuất kho thành công." });

      await loadEligibleList();
      if (issueId) await loadIssueDetail(issueId);
    } catch {
      setCreateMsg({ type: "error", text: "Lỗi khi tạo phiếu xuất." });
    } finally {
      setCreating(false);
    }
  };

  const manualStatusForLine = (materialId) => {
    const saved = manualAlloc?.[materialId];
    if (!saved) return { ok: false, total: 0 };
    const total = sumLotDraft(saved.lots);
    return { ok: total > 0, total };
  };

  if (bootError) {
    return (
      <div className="issue-page">
        <h1 className="page-title">Xuất kho</h1>
        <div className="message error">{bootError}</div>
      </div>
    );
  }

  return (
    <div className="issue-page">
      <div className="page-head">
        <h1 className="page-title">Xuất kho</h1>
      </div>

      {/* DANH SÁCH PHIẾU ĐỦ ĐIỀU KIỆN */}
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Phiếu xin lĩnh đủ điều kiện xuất</h2>
          <div className="card-actions">
            <button className="btn btn-outline" onClick={loadEligibleList} disabled={loadingList}>
              {loadingList ? "Đang tải..." : "Tải lại"}
            </button>
          </div>
        </div>

        {listMsg.text ? (
          <div className={`message ${listMsg.type === "error" ? "error" : "success"}`}>{listMsg.text}</div>
        ) : null}

        {/* Bộ lọc: GIỮ limit, BỎ tìm nhanh */}
        <div className="filters">
          <div className="form-group">
            <label className="form-label">Lọc theo Khoa (ID)</label>
            <input
              className="form-input"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Ví dụ: 1"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Lọc theo Bộ môn (ID)</label>
            <input
              className="form-input"
              value={subDepartmentId}
              onChange={(e) => setSubDepartmentId(e.target.value)}
              placeholder="Ví dụ: 3"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Số phiếu hiển thị</label>
            <input
              className="form-input"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="80"
            />
          </div>
        </div>

        {/* Summary gọn */}
        {summary ? (
          <div className="summary-strip">
            <div className="summary-item">
              <div className="summary-label">Đã kiểm tra</div>
              <div className="summary-value">{summary.checked ?? "-"}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Đủ điều kiện</div>
              <div className="summary-value ok">{summary.eligible ?? eligible.length}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Không đủ điều kiện</div>
              <div className="summary-value warn">{summary.ineligible ?? ineligible.length}</div>
            </div>
          </div>
        ) : null}

        <div className="table-container">
          <table className="issue-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Mã phiếu</th>
                <th style={{ minWidth: 220 }}>Bộ môn / Đơn vị</th>
                <th style={{ minWidth: 220 }}>Khoa / Phòng</th>
                <th style={{ minWidth: 190 }}>Người tạo</th>
                <th style={{ minWidth: 190 }}>Ngày gửi</th>
                <th style={{ minWidth: 320 }}>Ghi chú</th>
                <th style={{ width: 150 }} className="text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {eligible?.length ? (
                eligible.map((r) => (
                  <tr key={r.id} className={selected?.id === r.id ? "row-active" : ""}>
                    <td className="mono">{r.id}</td>
                    <td>{r.subDepartmentName || "-"}</td>
                    <td>{r.departmentName || "-"}</td>
                    <td>{r.createdByName || "-"}</td>
                    <td className="mono">{fmtDateTime(r.requestedAt)}</td>
                    <td className="muted">{r.note || ""}</td>
                    <td className="text-right">
                      <button
                        className="btn btn-primary"
                        onClick={() => loadPreview(r)}
                        disabled={loadingPreview && selected?.id === r.id}
                      >
                        {loadingPreview && selected?.id === r.id ? "Đang tải..." : "Xem trước"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Không có phiếu đủ điều kiện theo bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Không đủ điều kiện - ẩn mặc định, hiển thị gọn */}
        <div className="ineligible-toggle">
          <button className="btn btn-outline" onClick={() => setShowIneligible((p) => !p)}>
            {showIneligible ? "Ẩn phiếu không đủ điều kiện" : "Xem phiếu không đủ điều kiện"}
          </button>
        </div>

        {showIneligible ? (
          <div className="ineligible-box">
            <div className="ineligible-title">Phiếu không đủ điều kiện (tóm tắt lý do)</div>
            <div className="table-container">
              <table className="issue-table small">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Mã phiếu</th>
                    <th style={{ minWidth: 220 }}>Bộ môn</th>
                    <th style={{ minWidth: 190 }}>Ngày gửi</th>
                    <th style={{ minWidth: 420 }}>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {ineligible?.length ? (
                    ineligible.map((x, idx) => {
                      const reqId = x?.req?.id || x?.header?.id || "-";
                      const subName = x?.req?.subDepartmentName || x?.header?.subDepartmentName || "-";
                      const requestedAt = x?.req?.requestedAt || x?.header?.requestedAt;
                      const reasonText = vnReason(x?.reasonCode);

                      return (
                        <tr key={`${reqId}-${idx}`}>
                          <td className="mono">{reqId}</td>
                          <td>{subName}</td>
                          <td className="mono">{fmtDateTime(requestedAt)}</td>
                          <td className="muted">
                            {reasonText}
                            {x?.reasonMessage ? <div style={{ marginTop: 6 }}>{x.reasonMessage}</div> : null}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="table-empty">
                        Không có dữ liệu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* XEM TRƯỚC + TẠO PHIẾU XUẤT */}
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Xem trước và xuất kho</h2>
        </div>

        {!selected ? (
          <div className="hint">Chọn một phiếu ở danh sách phía trên để xem trước và xuất kho.</div>
        ) : (
          <>
            {previewMsg.text ? (
              <div className={`message ${previewMsg.type === "error" ? "error" : "success"}`}>
                {previewMsg.text}
              </div>
            ) : null}

            <div className="req-info">
              <div className="req-grid">
                <div className="req-item">
                  <div className="req-label">Phiếu xin lĩnh</div>
                  <div className="req-value mono">#{selected.id}</div>
                </div>
                <div className="req-item">
                  <div className="req-label">Bộ môn</div>
                  <div className="req-value">{selected.subDepartmentName || "-"}</div>
                </div>
                <div className="req-item">
                  <div className="req-label">Khoa / Phòng</div>
                  <div className="req-value">{selected.departmentName || "-"}</div>
                </div>
                <div className="req-item">
                  <div className="req-label">Ngày gửi</div>
                  <div className="req-value mono">{fmtDateTime(selected.requestedAt)}</div>
                </div>
              </div>
              {selected.note ? <div className="req-note">{selected.note}</div> : null}
            </div>

            {previewMissingMessages.length ? (
              <div className="message error">
                <div className="muted-strong">Không thể xuất kho vì:</div>
                <ul className="mini-list">
                  {previewMissingMessages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Thông tin phiếu xuất */}
            <div className="config">
              <div className="config-head">
                <h3 className="config-title">Thông tin phiếu xuất</h3>
              </div>

              <div className="config-grid">
                <div className="form-group">
                  <label className="form-label">Ngày xuất</label>
                  <input
                    type="date"
                    className="form-input"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Kho</label>
                  <input
                    className="form-input"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="Kho chính"
                  />
                </div>

                <div className="form-group grow">
                  <label className="form-label">Người nhận (nếu cần)</label>
                  <input
                    className="form-input"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Có thể để trống"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cách chọn lô</label>
                  <div className="segmented">
                    <button
                      className={`seg-btn ${autoAllocate ? "active" : ""}`}
                      type="button"
                      onClick={() => setAutoAllocate(true)}
                    >
                      Tự động (FEFO)
                    </button>
                    <button
                      className={`seg-btn ${!autoAllocate ? "active" : ""}`}
                      type="button"
                      onClick={() => setAutoAllocate(false)}
                    >
                      Thủ công
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Danh sách vật tư và gợi ý lô */}
            <div className="table-container">
              <table className="issue-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>Tên vật tư</th>
                    <th style={{ minWidth: 140 }}>Mã</th>
                    <th style={{ minWidth: 200 }}>Quy cách</th>
                    <th style={{ minWidth: 90 }}>ĐVT</th>
                    <th style={{ minWidth: 120 }} className="text-right">
                      SL yêu cầu
                    </th>
                    <th style={{ minWidth: 120 }} className="text-right">
                      SL xuất
                    </th>
                    <th style={{ minWidth: 320 }}>Gợi ý lô theo hạn dùng</th>
                    <th style={{ width: 160 }} className="text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPreview ? (
                    <tr>
                      <td colSpan={8} className="table-empty">
                        Đang tải...
                      </td>
                    </tr>
                  ) : previewLines.length ? (
                    previewLines.map((ln) => {
                      const need = toNumber(ln.qtyToIssue ?? ln.qtyRequested);
                      const status = manualStatusForLine(ln.materialId);

                      return (
                        <tr key={ln.materialId}>
                          <td>
                            <div className="cell-main">{ln.name}</div>
                          </td>
                          <td className="mono">{ln.code}</td>
                          <td className="muted">{ln.spec}</td>
                          <td>{ln.unitName || "-"}</td>
                          <td className="text-right mono">{qtyFmt.format(toNumber(ln.qtyRequested))}</td>
                          <td className="text-right mono">{qtyFmt.format(need)}</td>
                          <td className="muted">
                            {Array.isArray(ln.lots) && ln.lots.length ? (
                              <div className="lot-list">
                                {ln.lots.slice(0, 3).map((l, i) => (
                                  <div className="lot-item" key={i}>
                                    <span className="lot-pill">{l.lotNumber}</span>
                                    <span className="lot-meta">
                                      HSD: {l.expDate || "-"} | Tồn: {qtyFmt.format(toNumber(l.availableStock))} → Xuất:{" "}
                                      <b>{qtyFmt.format(toNumber(l.qtyOut))}</b>
                                    </span>
                                  </div>
                                ))}
                                {ln.lots.length > 3 ? (
                                  <div className="muted mini">+{ln.lots.length - 3} lô khác</div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="mini">Không có gợi ý</span>
                            )}
                          </td>
                          <td className="text-right">
                            {!autoAllocate ? (
                              <button
                                className={`btn ${status.ok ? "btn-outline" : "btn-primary"}`}
                                type="button"
                                onClick={() => openModalForLine(ln)}
                              >
                                {status.ok ? "Sửa lô" : "Chọn lô"}
                              </button>
                            ) : (
                              <span className="badge badge-ok">Tự động</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="table-empty">
                        Chưa có dữ liệu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {createMsg.text ? (
              <div className={`message ${createMsg.type === "error" ? "error" : "success"}`}>
                {createMsg.text}
              </div>
            ) : null}

            <div className="actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  setSelected(null);
                  setPreviewData(null);
                  setManualAlloc({});
                  setCreateMsg({ type: "", text: "" });
                  setIssueDetail(null);
                  setCreatedIssueId(null);
                }}
                disabled={creating}
              >
                Bỏ chọn
              </button>

              <button
                className="btn btn-primary"
                type="button"
                onClick={createIssue}
                disabled={creating || !canCreateIssue}
                title={!canCreateIssue ? "Phiếu chưa đủ điều kiện" : ""}
              >
                {creating ? "Đang tạo phiếu..." : "Tạo phiếu xuất kho"}
              </button>
            </div>

            {/* Chi tiết phiếu xuất */}
            {createdIssueId ? (
              <div className="detail-card">
                <div className="detail-head">
                  <h3 className="detail-title">Chi tiết phiếu xuất</h3>
                  <div className="detail-actions">
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => loadIssueDetail(createdIssueId)}
                      disabled={loadingDetail}
                    >
                      {loadingDetail ? "Đang tải..." : "Tải lại"}
                    </button>
                  </div>
                </div>

                {issueDetail?.success ? (
                  <>
                    <div className="detail-grid">
                      <div className="req-item">
                        <div className="req-label">Mã phiếu xuất</div>
                        <div className="req-value mono">#{issueDetail?.header?.id}</div>
                      </div>
                      <div className="req-item">
                        <div className="req-label">Ngày xuất</div>
                        <div className="req-value mono">{issueDetail?.header?.issueDate}</div>
                      </div>
                      <div className="req-item">
                        <div className="req-label">Người nhận</div>
                        <div className="req-value">{issueDetail?.header?.receiverName || "-"}</div>
                      </div>
                      <div className="req-item">
                        <div className="req-label">Tổng tiền</div>
                        <div className="req-value mono">{moneyFmt.format(toNumber(issueDetail?.header?.totalAmount))}</div>
                      </div>
                    </div>

                    <div className="table-container">
                      <table className="issue-table small">
                        <thead>
                          <tr>
                            <th>Tên vật tư</th>
                            <th style={{ minWidth: 120 }}>Mã</th>
                            <th style={{ minWidth: 90 }}>ĐVT</th>
                            <th className="text-right" style={{ minWidth: 120 }}>
                              SL xuất
                            </th>
                            <th className="text-right" style={{ minWidth: 140 }}>
                              Đơn giá
                            </th>
                            <th className="text-right" style={{ minWidth: 140 }}>
                              Thành tiền
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(issueDetail?.details || []).map((d) => (
                            <tr key={d.id}>
                              <td>{d.name}</td>
                              <td className="mono">{d.code}</td>
                              <td>{d.unitName || "-"}</td>
                              <td className="text-right mono">{qtyFmt.format(toNumber(d.qtyIssued))}</td>
                              <td className="text-right mono">{moneyFmt.format(toNumber(d.unitPrice))}</td>
                              <td className="text-right mono">{moneyFmt.format(toNumber(d.total))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="hint">Chưa có dữ liệu chi tiết.</div>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* MODAL CHỌN LÔ */}
      {modalOpen && modalLine
        ? createPortal(
            <div className="modal-backdrop" onMouseDown={closeModal}>
              <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <div>
                    <div className="modal-title">Chọn lô (thủ công)</div>
                    <div className="modal-subtitle">
                      {modalLine.code} - {modalLine.name}
                    </div>
                  </div>
                  <button className="modal-x" onClick={closeModal} aria-label="close">
                    ×
                  </button>
                </div>

                {modalError ? <div className="message error">{modalError}</div> : null}

                <div className="modal-tools">
                  <div className="mini muted">
                    SL cần xuất:{" "}
                    <b className="mono">{qtyFmt.format(toNumber(modalLine.qtyToIssue ?? modalLine.qtyRequested))}</b>
                    {"  "} | Đã chọn: <b className="mono">{qtyFmt.format(sumLotDraft(modalDraft))}</b>
                  </div>
                  <div className="modal-btns">
                    <button className="btn btn-outline" type="button" onClick={fillFEFOSuggestion}>
                      Tự điền theo gợi ý
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => {
                        const next = { ...(modalDraft || {}) };
                        Object.keys(next).forEach((k) => (next[k] = 0));
                        setModalDraft(next);
                      }}
                    >
                      Xoá chọn
                    </button>
                  </div>
                </div>

                <div className="table-container modal-table">
                  <table className="issue-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 160 }}>Số lô</th>
                        <th style={{ minWidth: 140 }}>Hạn dùng</th>
                        <th style={{ minWidth: 140 }} className="text-right">
                          Tồn còn lại
                        </th>
                        <th style={{ minWidth: 160 }} className="text-right">
                          Số lượng xuất
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalLoading ? (
                        <tr>
                          <td colSpan={4} className="table-empty">
                            Đang tải...
                          </td>
                        </tr>
                      ) : modalLots.length ? (
                        modalLots.map((l) => {
                          const lot = safeStr(l?.lotNumber).trim();
                          const avail = toNumber(l?.availableStock);
                          const val = modalDraft?.[lot] ?? 0;

                          return (
                            <tr key={lot}>
                              <td className="mono">{lot}</td>
                              <td className="mono">{l?.expDate || "-"}</td>
                              <td className="text-right mono">{qtyFmt.format(avail)}</td>
                              <td className="text-right">
                                <input
                                  className="table-input number-input"
                                  value={val}
                                  onChange={(e) => {
                                    const next = { ...(modalDraft || {}) };
                                    next[lot] = e.target.value;
                                    setModalDraft(next);
                                  }}
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="table-empty">
                            Không có lô còn tồn.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="modal-actions">
                  <button className="btn btn-outline" type="button" onClick={closeModal}>
                    Đóng
                  </button>
                  <button className="btn btn-primary" type="button" onClick={saveModalAllocation}>
                    Lưu
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
