import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { createPortal } from "react-dom";
import "./ReceiptPage.css";

const API_URL = "http://localhost:8080/api";
const API_ENDPOINTS = {
  AUTH: `${API_URL}/auth`,
  MATERIALS: `${API_URL}/materials`,
  RECEIPTS: `${API_URL}/receipts`,
};

const moneyFmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const s = String(value).replace(/,/g, ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeRow() {
  return {
    key: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    materialId: null,
    name: "",
    code: "",
    spec: "",
    unitId: "",
    unitName: "",
    qtyDoc: "",
    qtyActual: "",
    price: "",
    lotNumber: "",
    mfgDate: "",
    expDate: "",
  };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const MaterialSearch = ({
  value,
  onChange,
  onPick,
  fetchMaterials,
  placeholder = "Gõ để tìm...",
  mode = "name", // "name" | "code"
  isDuplicate = false,
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const debounceRef = useRef(null);

  const updatePosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "absolute",
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      maxHeight: 260,
      overflowY: "auto",
      background: "#fff",
      border: "1px solid #dbeafe",
      zIndex: 9999,
      borderRadius: 8,
      boxShadow: "0 10px 20px rgba(2, 132, 199, 0.12)",
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const fn = () => updatePosition();
    window.addEventListener("resize", fn);
    window.addEventListener("scroll", fn);
    return () => {
      window.removeEventListener("resize", fn);
      window.removeEventListener("scroll", fn);
    };
  }, [open]);

  useEffect(() => {
    const onDown = (e) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target) &&
        !document.getElementById("material-dropdown")?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const doSearch = async (q) => {
    const keyword = q.trim();
    if (!keyword) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchMaterials(keyword);
      let list = Array.isArray(data) ? data : [];
      const kw = keyword.toLowerCase();

      if (mode === "name") {
        list = list.filter((m) => m?.name && m.name.toLowerCase().includes(kw));
      }
      if (mode === "code") {
        list = list.filter((m) => m?.code && m.code.toLowerCase().includes(kw));
      }

      setItems(list.slice(0, 12));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [value, open]);

  const pick = (m) => {
    onPick(m);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className={`table-input ${isDuplicate ? "duplicate-highlight" : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        style={{
          backgroundColor: isDuplicate ? "#fee2e2" : "white",
          borderColor: isDuplicate ? "#f87171" : "#e2e8f0",
        }}
      />

      {open &&
        createPortal(
          <div id="material-dropdown" style={dropdownStyle}>
            {loading ? (
              <div className="material-dropdown__empty">Đang tìm...</div>
            ) : items.length ? (
              items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="material-dropdown__item"
                  onClick={() => pick(m)}
                >
                  <div className="material-dropdown__name">
                    {m.name} <span className="material-pill">({m.code})</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="material-dropdown__empty">Không có kết quả</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default function ReceiptPage() {
  const [activeTab, setActiveTab] = useState("create"); // create | history

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [header, setHeader] = useState({
    receivedFrom: "",
    reason: "",
    receiptDate: todayISO(),
  });

  const [rows, setRows] = useState([makeRow()]);

  // History
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");
  const [historyItems, setHistoryItems] = useState([]);
  const [historyAfterId, setHistoryAfterId] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const HISTORY_LIMIT = 20;

  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const userFromStorage = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const email = userFromStorage.email;
        if (!email) {
          setMessage({ type: "error", text: "Không tìm thấy email người dùng trong localStorage" });
          return;
        }
        const res = await fetch(`${API_ENDPOINTS.AUTH}/user-info?email=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCurrentUser(data);
      } catch {
        setMessage({ type: "error", text: "Không thể tải thông tin người dùng" });
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab !== "history") return;
    if (!currentUser?.id) return;
    loadHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id]);

  const fetchMaterials = async (keyword) => {
    const q = (keyword || "").trim();
    const url = `${API_ENDPOINTS.MATERIALS}/search?keyword=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  const setRow = (rowKey, patch) => {
    setRows((prev) => prev.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, makeRow()]);
  const removeRow = (rowKey) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== rowKey)));

  const pickMaterial = (rowKey, material) => {
    if (!material) return;
    setRow(rowKey, {
      materialId: material.id,
      name: material.name || "",
      code: material.code || "",
      spec: material.spec || "",
      unitId: material.unit?.id || material.unitId || "",
      unitName: material.unit?.name || material.unitName || "",
    });
  };

  // Duplicate checks within table
  const duplicateNames = useMemo(() => {
    const counts = {};
    const dup = new Set();
    rows.forEach((r) => {
      const name = (r.name || "").trim();
      if (!name) return;
      const k = name.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    Object.keys(counts).forEach((k) => {
      if (counts[k] > 1) dup.add(k);
    });
    return dup;
  }, [rows]);

  const duplicateCodes = useMemo(() => {
    const counts = {};
    const dup = new Set();
    rows.forEach((r) => {
      const code = (r.code || "").trim();
      if (!code) return;
      const k = code.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    Object.keys(counts).forEach((k) => {
      if (counts[k] > 1) dup.add(k);
    });
    return dup;
  }, [rows]);

  const totals = useMemo(() => {
    const rowTotals = rows.map((r) => toNumber(r.qtyActual) * toNumber(r.price));
    const grand = rowTotals.reduce((a, b) => a + b, 0);
    return { rowTotals, grand };
  }, [rows]);

  const getDuplicateStatusForRow = (row) => {
    const nameKey = (row.name || "").trim().toLowerCase();
    const codeKey = (row.code || "").trim().toLowerCase();
    return {
      isNameDuplicate: !!nameKey && duplicateNames.has(nameKey),
      isCodeDuplicate: !!codeKey && duplicateCodes.has(codeKey),
    };
  };

  // Resolve materialId if user typed code/name without selecting dropdown
  const resolveMaterialIdIfNeeded = async (row) => {
    if (row.materialId) return row;

    const code = (row.code || "").trim();
    const name = (row.name || "").trim();
    const keyword = code || name;
    if (!keyword) return row;

    const data = await fetchMaterials(keyword);
    const list = Array.isArray(data) ? data : [];

    if (code) {
      const hit = list.filter((m) => (m?.code || "").trim().toLowerCase() === code.toLowerCase());
      if (hit.length === 1) {
        const m = hit[0];
        return {
          ...row,
          materialId: m.id,
          name: m.name || row.name,
          code: m.code || row.code,
          spec: m.spec || "",
          unitId: m.unit?.id || m.unitId || "",
          unitName: m.unit?.name || m.unitName || "",
        };
      }
      return row;
    }

    if (name) {
      const hit = list.filter((m) => (m?.name || "").trim().toLowerCase() === name.toLowerCase());
      if (hit.length === 1) {
        const m = hit[0];
        return {
          ...row,
          materialId: m.id,
          name: m.name || row.name,
          code: m.code || row.code,
          spec: m.spec || "",
          unitId: m.unit?.id || m.unitId || "",
          unitName: m.unit?.name || m.unitName || "",
        };
      }
      return row;
    }

    return row;
  };

  const validateBeforeSubmit = (effectiveRows) => {
    if (!currentUser?.id) return "Chưa xác định được người dùng (X-User-Id)";
    if (!header.receivedFrom.trim()) return "Vui lòng nhập nhà cung cấp / người giao";
    if (!header.receiptDate) return "Vui lòng chọn ngày nhập";

    if (duplicateNames.size > 0) {
      return `Có vật tư trùng tên trong bảng: ${Array.from(duplicateNames).join(", ")}.`;
    }
    if (duplicateCodes.size > 0) {
      return `Có vật tư trùng mã trong bảng: ${Array.from(duplicateCodes).join(", ")}.`;
    }

    const usableRows = effectiveRows.filter((r) => r.materialId || r.name.trim() || r.code.trim());
    if (!usableRows.length) return "Phiếu nhập phải có ít nhất 1 dòng vật tư";

    for (let i = 0; i < effectiveRows.length; i++) {
      const r = effectiveRows[i];
      const isBlank = !r.materialId && !r.name.trim() && !r.code.trim();
      if (isBlank) continue;

      if (!r.materialId) return `Dòng ${i + 1}: Vui lòng chọn vật tư hoặc nhập mã/tên đúng để hệ thống nhận diện`;
      const qty = toNumber(r.qtyActual);
      if (qty <= 0) return `Dòng ${i + 1}: Số lượng thực nhập phải > 0`;
      const price = toNumber(r.price);
      if (price < 0) return `Dòng ${i + 1}: Đơn giá không hợp lệ`;
      if (!String(r.lotNumber || "").trim()) return `Dòng ${i + 1}: Vui lòng nhập số lô`;
      if (r.mfgDate && r.expDate && r.mfgDate > r.expDate) return `Dòng ${i + 1}: Ngày SX không được sau HSD`;
    }
    return "";
  };

  const buildPayload = (effectiveRows) => {
    const details = effectiveRows
      .filter((r) => r.materialId)
      .map((r) => ({
        materialId: r.materialId,
        name: r.name,
        spec: r.spec,
        code: r.code,
        unitId: r.unitId || null,
        price: toNumber(r.price),
        qtyDoc: r.qtyDoc === "" ? null : toNumber(r.qtyDoc),
        qtyActual: toNumber(r.qtyActual),
        lotNumber: (r.lotNumber || "").trim(),
        mfgDate: r.mfgDate || null,
        expDate: r.expDate || null,
      }));

    return {
      receivedFrom: header.receivedFrom.trim(),
      reason: header.reason?.trim() ? header.reason.trim() : null,
      receiptDate: header.receiptDate,
      details,
    };
  };

  const submit = async () => {
    setMessage({ type: "", text: "" });

    // 1) resolve materialId if user typed code/name but did not click dropdown
    setLoading(true);
    try {
      const resolved = [];
      for (const r of rows) {
        const isBlank = !r.materialId && !r.name.trim() && !r.code.trim();
        if (isBlank) {
          resolved.push(r);
          continue;
        }
        resolved.push(await resolveMaterialIdIfNeeded(r));
      }

      // reflect resolved rows back to UI (so user sees materialId resolved -> spec/unit filled)
      setRows(resolved);

      // 2) validate on resolved rows
      const err = validateBeforeSubmit(resolved);
      if (err) {
        setMessage({ type: "error", text: err });
        return;
      }

      // 3) submit
      const payload = buildPayload(resolved);
      const res = await fetch(`${API_ENDPOINTS.RECEIPTS}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(currentUser.id),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || `HTTP ${res.status}`);

      await Swal.fire({
        icon: "success",
        title: "Tạo phiếu nhập thành công",
        text: data?.message || "Phiếu nhập đã được lưu và cập nhật thẻ kho.",
        confirmButtonText: "OK",
      });

      setHeader({ receivedFrom: "", reason: "", receiptDate: todayISO() });
      setRows([makeRow()]);

      // If user is in history tab, refresh
      if (activeTab === "history") {
        await loadHistory(true);
      }
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Có lỗi xảy ra" });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- HISTORY ----------------
  const normalizeFeed = (data) => {
    const list =
      (Array.isArray(data?.items) && data.items) ||
      (Array.isArray(data?.content) && data.content) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data) && data) ||
      [];

    // nếu backend có createdById thì lọc thêm cho chắc chắn "đúng tài khoản"
    let filtered = list;
    if (filtered.some((x) => x?.createdById !== undefined)) {
      filtered = filtered.filter((x) => Number(x.createdById) === Number(currentUser?.id));
    }
    if (filtered.some((x) => x?.createdBy?.id !== undefined)) {
      filtered = filtered.filter((x) => Number(x.createdBy.id) === Number(currentUser?.id));
    }

    const hasMore =
      typeof data?.hasMore === "boolean" ? data.hasMore : filtered.length >= HISTORY_LIMIT;

    const nextAfterId =
      data?.nextAfterId ??
      data?.lastId ??
      (filtered.length ? filtered[filtered.length - 1]?.id : null);

    return { list: filtered, hasMore, nextAfterId };
  };

  const loadHistory = async (reset = false) => {
    if (!currentUser?.id) return;
    setHistoryErr("");
    setHistoryLoading(true);
    try {
      const afterId = reset ? null : historyAfterId;
      const qs = new URLSearchParams();
      qs.set("limit", String(HISTORY_LIMIT));
      if (afterId !== null && afterId !== undefined && afterId !== "") qs.set("afterId", String(afterId));

      const res = await fetch(`${API_ENDPOINTS.RECEIPTS}/feed?${qs.toString()}`, {
        headers: { "X-User-Id": String(currentUser.id) },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const { list, hasMore, nextAfterId } = normalizeFeed(data);

      setHistoryItems((prev) => (reset ? list : [...prev, ...list]));
      setHistoryHasMore(!!hasMore);
      setHistoryAfterId(nextAfterId ?? null);
    } catch (e) {
      setHistoryErr(e?.message || "Không thể tải lịch sử phiếu nhập");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openReceiptDetail = async (receiptId) => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_ENDPOINTS.RECEIPTS}/${receiptId}/detail`, {
        headers: { "X-User-Id": String(currentUser.id) },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const headerObj = data?.receipt || data?.header || data?.data?.receipt || data?.data?.header || data?.data || {};
      const details = data?.details || data?.items || data?.lines || data?.data?.details || [];

      const hId = headerObj?.id ?? receiptId;
      const hDate = headerObj?.receiptDate ?? headerObj?.receipt_date ?? "";
      const hFrom = headerObj?.receivedFrom ?? headerObj?.received_from ?? "";
      const hReason = headerObj?.reason ?? "";
      const hTotal = headerObj?.totalAmount ?? headerObj?.total_amount ?? 0;

      const rowsHtml = Array.isArray(details)
        ? details
            .map((d, idx) => {
              const name = d?.name || d?.materialName || "";
              const code = d?.code || "";
              const lot = d?.lotNumber || d?.lot_number || "";
              const exp = d?.expDate || d?.exp_date || "";
              const qty = d?.qtyActual ?? d?.qty_actual ?? 0;
              const price = d?.price ?? 0;
              const total = d?.total ?? (Number(qty) * Number(price));
              return `
                <tr>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${idx + 1}</td>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(name)}</td>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(code)}</td>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(lot)}</td>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(exp)}</td>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right;">${escapeHtml(moneyFmt.format(qty))}</td>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right;">${escapeHtml(moneyFmt.format(price))}</td>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right;">${escapeHtml(moneyFmt.format(total))}</td>
                </tr>
              `;
            })
            .join("")
        : "";

      const html = `
        <div style="text-align:left;font-size:14px;">
          <div><b>Mã phiếu:</b> #${escapeHtml(hId)}</div>
          <div><b>Ngày nhập:</b> ${escapeHtml(hDate)}</div>
          <div><b>Nhà cung cấp / người giao:</b> ${escapeHtml(hFrom)}</div>
          <div><b>Lý do:</b> ${escapeHtml(hReason)}</div>
          <div style="margin-top:8px;"><b>Tổng tiền:</b> ${escapeHtml(moneyFmt.format(hTotal))}</div>

          <div style="margin-top:12px;">
            <b>Chi tiết vật tư:</b>
            <div style="overflow:auto;max-height:320px;border:1px solid #e5e7eb;border-radius:8px;margin-top:8px;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:8px;text-align:left;">#</th>
                    <th style="padding:8px;text-align:left;">Tên</th>
                    <th style="padding:8px;text-align:left;">Mã</th>
                    <th style="padding:8px;text-align:left;">Số lô</th>
                    <th style="padding:8px;text-align:left;">Hạn dùng</th>
                    <th style="padding:8px;text-align:right;">SL</th>
                    <th style="padding:8px;text-align:right;">Đơn giá</th>
                    <th style="padding:8px;text-align:right;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      await Swal.fire({
        title: `Chi tiết phiếu nhập #${hId}`,
        html,
        width: 900,
        confirmButtonText: "Đóng",
      });
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Không thể tải chi tiết",
        text: e?.message || "Có lỗi xảy ra",
        confirmButtonText: "OK",
      });
    }
  };

  const filteredHistory = useMemo(() => {
    const q = (historySearch || "").trim().toLowerCase();
    if (!q) return historyItems;
    return historyItems.filter((x) => {
      const id = String(x?.id ?? "").toLowerCase();
      const from = String(x?.receivedFrom ?? x?.received_from ?? "").toLowerCase();
      const reason = String(x?.reason ?? "").toLowerCase();
      const date = String(x?.receiptDate ?? x?.receipt_date ?? "").toLowerCase();
      return id.includes(q) || from.includes(q) || reason.includes(q) || date.includes(q);
    });
  }, [historyItems, historySearch]);

  // ---------------- UI ----------------
  return (
    <div className="receipt-page">
      <div className="page-head">
        <h1 className="page-title">Nhập kho</h1>

        <div className="page-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Tạo phiếu nhập
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Lịch sử phiếu nhập
          </button>
        </div>
      </div>

      {message.text ? (
        <div className={`message ${message.type === "error" ? "error" : "success"}`}>
          {message.text}
        </div>
      ) : null}

      {activeTab === "create" ? (
        <div className="receipt-form">
          {(duplicateNames.size > 0 || duplicateCodes.size > 0) && (
            <div className="message warning">
              <b>Cảnh báo trùng lặp:</b>
              {duplicateNames.size > 0 && <div>Trùng tên: {Array.from(duplicateNames).join(", ")}</div>}
              {duplicateCodes.size > 0 && <div>Trùng mã: {Array.from(duplicateCodes).join(", ")}</div>}
              <div className="hint">Các ô bị trùng được tô màu đỏ nhạt.</div>
            </div>
          )}

          <div className="section-header">
            <h2 className="section-title">Thông tin phiếu nhập</h2>
          </div>

          <div className="header-grid">
            <div className="form-group">
              <label className="form-label">Nhà cung cấp / người giao</label>
              <input
                className="form-input"
                value={header.receivedFrom}
                onChange={(e) => setHeader((p) => ({ ...p, receivedFrom: e.target.value }))}
                placeholder="Ví dụ: Công ty ABC - Nguyễn Văn A"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ngày nhập</label>
              <input
                className="form-input"
                type="date"
                value={header.receiptDate}
                onChange={(e) => setHeader((p) => ({ ...p, receiptDate: e.target.value }))}
              />
            </div>

            <div className="form-group header-reason">
              <label className="form-label">Lý do nhập</label>
              <input
                className="form-input"
                value={header.reason}
                onChange={(e) => setHeader((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Ví dụ: Nhu cầu từ đơn vị / Nhập theo hợp đồng..."
              />
            </div>
          </div>

          <div className="section-header">
            <h2 className="section-title">Danh sách vật tư nhập</h2>
          </div>

          <div className="table-container">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>Tên vật tư</th>
                  <th style={{ minWidth: 150 }}>Mã</th>
                  <th style={{ minWidth: 180 }}>Quy cách</th>
                  <th style={{ minWidth: 90 }}>ĐVT</th>
                  <th style={{ minWidth: 120 }} className="text-right">
                    SL chứng từ
                  </th>
                  <th style={{ minWidth: 120 }} className="text-right">
                    SL thực nhập
                  </th>
                  <th style={{ minWidth: 130 }} className="text-right">
                    Đơn giá
                  </th>
                  <th style={{ minWidth: 140 }}>Số lô</th>
                  <th style={{ minWidth: 130 }}>Ngày SX</th>
                  <th style={{ minWidth: 130 }}>Hạn dùng</th>
                  <th style={{ minWidth: 130 }} className="text-right">
                    Thành tiền
                  </th>
                  <th style={{ width: 90 }} className="text-center">
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const { isNameDuplicate, isCodeDuplicate } = getDuplicateStatusForRow(r);
                  const rowWarn = isNameDuplicate || isCodeDuplicate;

                  return (
                    <tr key={r.key} style={{ backgroundColor: rowWarn ? "#fef2f2" : "transparent" }}>
                      <td>
                        <MaterialSearch
                          mode="name"
                          value={r.name}
                          onChange={(v) =>
                            setRow(r.key, {
                              name: v,
                              materialId: null,
                              code: "",
                              spec: "",
                              unitId: "",
                              unitName: "",
                            })
                          }
                          onPick={(m) => pickMaterial(r.key, m)}
                          fetchMaterials={fetchMaterials}
                          placeholder="Gõ tên vật tư..."
                          isDuplicate={isNameDuplicate}
                        />
                      </td>

                      <td>
                        <MaterialSearch
                          mode="code"
                          value={r.code}
                          onChange={(v) =>
                            setRow(r.key, {
                              code: v,
                              materialId: null,
                              name: "",
                              spec: "",
                              unitId: "",
                              unitName: "",
                            })
                          }
                          onPick={(m) => pickMaterial(r.key, m)}
                          fetchMaterials={fetchMaterials}
                          placeholder="Gõ mã vật tư..."
                          isDuplicate={isCodeDuplicate}
                        />
                      </td>

                      <td>
                        <input className="table-input" value={r.spec} disabled />
                      </td>

                      <td>
                        <input className="table-input" value={r.unitName || ""} disabled />
                      </td>

                      <td>
                        <input
                          className="table-input number-input"
                          value={r.qtyDoc}
                          onChange={(e) => setRow(r.key, { qtyDoc: e.target.value })}
                          placeholder="0"
                        />
                      </td>

                      <td>
                        <input
                          className="table-input number-input"
                          value={r.qtyActual}
                          onChange={(e) => setRow(r.key, { qtyActual: e.target.value })}
                          placeholder="0"
                        />
                      </td>

                      <td>
                        <input
                          className="table-input number-input"
                          value={r.price}
                          onChange={(e) => setRow(r.key, { price: e.target.value })}
                          placeholder="0"
                        />
                      </td>

                      <td>
                        <input
                          className="table-input"
                          value={r.lotNumber}
                          onChange={(e) => setRow(r.key, { lotNumber: e.target.value })}
                          placeholder="Ví dụ: LOT-0125-A"
                        />
                      </td>

                      <td>
                        <input
                          className="table-input"
                          type="date"
                          value={r.mfgDate}
                          onChange={(e) => setRow(r.key, { mfgDate: e.target.value })}
                        />
                      </td>

                      <td>
                        <input
                          className="table-input"
                          type="date"
                          value={r.expDate}
                          onChange={(e) => setRow(r.key, { expDate: e.target.value })}
                        />
                      </td>

                      <td className="text-right">
                        <div className="money" style={{ color: rowWarn ? "#dc2626" : "#1e293b" }}>
                          {moneyFmt.format(totals.rowTotals[idx] || 0)}
                        </div>
                      </td>

                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-remove-row"
                          onClick={() => removeRow(r.key)}
                          disabled={rows.length <= 1}
                          title="Xóa dòng"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row-container">
            <div className="totals">
              <div className="totals__row">
                <div className="totals__value">Tổng chi phí: {moneyFmt.format(totals.grand)}</div>
              </div>
            </div>
            <div className="section-actions">
              <button type="button" className="btn-add-row" onClick={addRow}>
                + Thêm dòng
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => {
                setHeader({ receivedFrom: "", reason: "", receiptDate: todayISO() });
                setRows([makeRow()]);
                setMessage({ type: "", text: "" });
              }}
              disabled={loading}
            >
              Làm mới
            </button>

            <button type="button" className="btn-submit" onClick={submit} disabled={loading}>
              {loading ? "Đang lưu..." : "Lưu phiếu nhập"}
            </button>
          </div>
        </div>
      ) : (
        <div className="history-wrap">
          <div className="history-toolbar">
            <div className="history-left">
              <input
                className="form-input"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Tìm theo mã phiếu / ngày / nhà cung cấp / lý do..."
              />
            </div>
            <div className="history-right">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => loadHistory(true)}
                disabled={historyLoading}
              >
                Tải lại
              </button>
            </div>
          </div>

          {historyErr ? <div className="message error">{historyErr}</div> : null}

          <div className="table-container">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 110 }}>Mã phiếu</th>
                  <th style={{ minWidth: 140 }}>Ngày nhập</th>
                  <th style={{ minWidth: 260 }}>Nhà cung cấp / người giao</th>
                  <th style={{ minWidth: 260 }}>Lý do</th>
                  <th style={{ minWidth: 140 }} className="text-right">
                    Tổng tiền
                  </th>
                  <th style={{ width: 120 }} className="text-center">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length ? (
                  filteredHistory.map((x) => {
                    const id = x?.id;
                    const date = x?.receiptDate ?? x?.receipt_date ?? "";
                    const from = x?.receivedFrom ?? x?.received_from ?? "";
                    const reason = x?.reason ?? "";
                    const total = x?.totalAmount ?? x?.total_amount ?? 0;

                    return (
                      <tr key={id ?? Math.random()}>
                        <td>#{id}</td>
                        <td>{date}</td>
                        <td>{from}</td>
                        <td>{reason}</td>
                        <td className="text-right">{moneyFmt.format(total)}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openReceiptDetail(id)}
                            disabled={!id}
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center" style={{ padding: 14 }}>
                      {historyLoading ? "Đang tải..." : "Chưa có phiếu nhập"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="history-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => loadHistory(false)}
              disabled={historyLoading || !historyHasMore}
              title={!historyHasMore ? "Không còn dữ liệu" : ""}
            >
              {historyLoading ? "Đang tải..." : "Tải thêm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
