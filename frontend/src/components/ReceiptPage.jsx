import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { createPortal } from "react-dom";
import "./dashboard-ui.css";
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

function MaterialSearch({
  value,
  onChange,
  onPick,
  fetchMaterials,
  placeholder = "Gõ để tìm...",
  mode = "name",
  isDuplicate = false,
}) {
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
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
      maxHeight: 280,
      overflowY: "auto",
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return undefined;

    updatePosition();
    const handleMove = () => updatePosition();
    window.addEventListener("resize", handleMove);
    window.addEventListener("scroll", handleMove, true);

    return () => {
      window.removeEventListener("resize", handleMove);
      window.removeEventListener("scroll", handleMove, true);
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = document.getElementById("receipt-material-dropdown");
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target) &&
        !(dropdown && dropdown.contains(event.target))
      ) {
        setOpen(false);
      }
    };

    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function doSearch(query) {
    const keyword = query.trim();
    if (!keyword) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchMaterials(keyword);
      let list = Array.isArray(data) ? data : [];
      const search = keyword.toLowerCase();

      if (mode === "name") {
        list = list.filter((item) => item?.name && item.name.toLowerCase().includes(search));
      }

      if (mode === "code") {
        list = list.filter((item) => item?.code && item.code.toLowerCase().includes(search));
      }

      setItems(list.slice(0, 12));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
    return () => clearTimeout(debounceRef.current);
  }, [value, open]);

  function handlePick(material) {
    onPick(material);
    setOpen(false);
  }

  return (
    <div className="receipt-material-search">
      <input
        ref={inputRef}
        className={`ui-input receipt-table-input ${isDuplicate ? "is-duplicate" : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />

      {open &&
        createPortal(
          <div id="receipt-material-dropdown" className="receipt-dropdown" style={dropdownStyle}>
            {loading ? (
              <div className="receipt-dropdown-empty">Đang tìm...</div>
            ) : items.length > 0 ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="receipt-dropdown-item"
                  onClick={() => handlePick(item)}
                >
                  <div className="receipt-dropdown-name">
                    {item.name}
                    <span className="receipt-dropdown-pill">{item.code}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="receipt-dropdown-empty">Không có kết quả</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

export default function ReceiptPage() {
  const [activeTab, setActiveTab] = useState("create");
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [header, setHeader] = useState({
    receivedFrom: "",
    reason: "",
    receiptDate: todayISO(),
  });

  const [rows, setRows] = useState([makeRow()]);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");
  const [historyItems, setHistoryItems] = useState([]);
  const [historyAfterId, setHistoryAfterId] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const HISTORY_LIMIT = 20;

  useEffect(() => {
    async function init() {
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
    }

    init();
  }, []);

  useEffect(() => {
    if (activeTab !== "history") return;
    if (!currentUser?.id) return;
    loadHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id]);

  async function fetchMaterials(keyword) {
    const q = (keyword || "").trim();
    const url = `${API_ENDPOINTS.MATERIALS}/search?keyword=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function setRow(rowKey, patch) {
    setRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(rowKey) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== rowKey)));
  }

  function pickMaterial(rowKey, material) {
    if (!material) return;

    setRow(rowKey, {
      materialId: material.id,
      name: material.name || "",
      code: material.code || "",
      spec: material.spec || "",
      unitId: material.unit?.id || material.unitId || "",
      unitName: material.unit?.name || material.unitName || "",
    });
  }

  const duplicateNames = useMemo(() => {
    const counts = {};
    const duplicates = new Set();

    rows.forEach((row) => {
      const name = String(row.name || "").trim();
      if (!name) return;

      const key = name.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });

    Object.keys(counts).forEach((key) => {
      if (counts[key] > 1) duplicates.add(key);
    });

    return duplicates;
  }, [rows]);

  const duplicateCodes = useMemo(() => {
    const counts = {};
    const duplicates = new Set();

    rows.forEach((row) => {
      const code = String(row.code || "").trim();
      if (!code) return;

      const key = code.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });

    Object.keys(counts).forEach((key) => {
      if (counts[key] > 1) duplicates.add(key);
    });

    return duplicates;
  }, [rows]);

  const totals = useMemo(() => {
    const rowTotals = rows.map((row) => toNumber(row.qtyActual) * toNumber(row.price));
    const grand = rowTotals.reduce((sum, value) => sum + value, 0);
    return { rowTotals, grand };
  }, [rows]);

  function getDuplicateStatusForRow(row) {
    const nameKey = String(row.name || "").trim().toLowerCase();
    const codeKey = String(row.code || "").trim().toLowerCase();

    return {
      isNameDuplicate: !!nameKey && duplicateNames.has(nameKey),
      isCodeDuplicate: !!codeKey && duplicateCodes.has(codeKey),
    };
  }

  async function resolveMaterialIdIfNeeded(row) {
    if (row.materialId) return row;

    const code = String(row.code || "").trim();
    const name = String(row.name || "").trim();
    const keyword = code || name;
    if (!keyword) return row;

    const data = await fetchMaterials(keyword);
    const list = Array.isArray(data) ? data : [];

    if (code) {
      const matched = list.filter(
        (item) => String(item?.code || "").trim().toLowerCase() === code.toLowerCase()
      );

      if (matched.length === 1) {
        const material = matched[0];
        return {
          ...row,
          materialId: material.id,
          name: material.name || row.name,
          code: material.code || row.code,
          spec: material.spec || "",
          unitId: material.unit?.id || material.unitId || "",
          unitName: material.unit?.name || material.unitName || "",
        };
      }
    }

    if (name) {
      const matched = list.filter(
        (item) => String(item?.name || "").trim().toLowerCase() === name.toLowerCase()
      );

      if (matched.length === 1) {
        const material = matched[0];
        return {
          ...row,
          materialId: material.id,
          name: material.name || row.name,
          code: material.code || row.code,
          spec: material.spec || "",
          unitId: material.unit?.id || material.unitId || "",
          unitName: material.unit?.name || material.unitName || "",
        };
      }
    }

    return row;
  }

  function validateBeforeSubmit(effectiveRows) {
    if (!currentUser?.id) return "Chưa xác định được người dùng (X-User-Id)";
    if (!header.receivedFrom.trim()) return "Vui lòng nhập nhà cung cấp / người giao";
    if (!header.receiptDate) return "Vui lòng chọn ngày nhập";

    if (duplicateNames.size > 0) {
      return `Có vật tư trùng tên trong bảng: ${Array.from(duplicateNames).join(", ")}.`;
    }

    if (duplicateCodes.size > 0) {
      return `Có vật tư trùng mã trong bảng: ${Array.from(duplicateCodes).join(", ")}.`;
    }

    const usableRows = effectiveRows.filter(
      (row) => row.materialId || row.name.trim() || row.code.trim()
    );

    if (!usableRows.length) return "Phiếu nhập phải có ít nhất 1 dòng vật tư";

    for (let i = 0; i < effectiveRows.length; i += 1) {
      const row = effectiveRows[i];
      const isBlank = !row.materialId && !row.name.trim() && !row.code.trim();
      if (isBlank) continue;

      if (!row.materialId) {
        return `Dòng ${i + 1}: Vui lòng chọn vật tư hoặc nhập mã/tên đúng để hệ thống nhận diện`;
      }

      const qty = toNumber(row.qtyActual);
      if (qty <= 0) return `Dòng ${i + 1}: Số lượng thực nhập phải > 0`;

      const price = toNumber(row.price);
      if (price < 0) return `Dòng ${i + 1}: Đơn giá không hợp lệ`;

      if (!String(row.lotNumber || "").trim()) {
        return `Dòng ${i + 1}: Vui lòng nhập số lô`;
      }

      if (row.mfgDate && row.expDate && row.mfgDate > row.expDate) {
        return `Dòng ${i + 1}: Ngày sản xuất không được sau hạn dùng`;
      }
    }

    return "";
  }

  function buildPayload(effectiveRows) {
    const details = effectiveRows
      .filter((row) => row.materialId)
      .map((row) => ({
        materialId: row.materialId,
        name: row.name,
        spec: row.spec,
        code: row.code,
        unitId: row.unitId || null,
        price: toNumber(row.price),
        qtyDoc: row.qtyDoc === "" ? null : toNumber(row.qtyDoc),
        qtyActual: toNumber(row.qtyActual),
        lotNumber: String(row.lotNumber || "").trim(),
        mfgDate: row.mfgDate || null,
        expDate: row.expDate || null,
      }));

    return {
      receivedFrom: header.receivedFrom.trim(),
      reason: header.reason?.trim() ? header.reason.trim() : null,
      receiptDate: header.receiptDate,
      details,
    };
  }

  async function submit() {
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const resolvedRows = [];

      for (const row of rows) {
        const isBlank = !row.materialId && !row.name.trim() && !row.code.trim();
        if (isBlank) {
          resolvedRows.push(row);
          continue;
        }

        resolvedRows.push(await resolveMaterialIdIfNeeded(row));
      }

      setRows(resolvedRows);

      const error = validateBeforeSubmit(resolvedRows);
      if (error) {
        setMessage({ type: "error", text: error });
        return;
      }

      const payload = buildPayload(resolvedRows);
      const res = await fetch(`${API_ENDPOINTS.RECEIPTS}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(currentUser.id),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      await Swal.fire({
        icon: "success",
        title: "Tạo phiếu nhập thành công",
        text: data?.message || "Phiếu nhập đã được lưu và cập nhật thẻ kho.",
        confirmButtonText: "OK",
      });

      setHeader({ receivedFrom: "", reason: "", receiptDate: todayISO() });
      setRows([makeRow()]);
      setMessage({ type: "success", text: "Đã lưu phiếu nhập thành công." });

      if (activeTab === "history") {
        await loadHistory(true);
      }
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Có lỗi xảy ra" });
    } finally {
      setLoading(false);
    }
  }

  function normalizeFeed(data) {
    const list =
      (Array.isArray(data?.items) && data.items) ||
      (Array.isArray(data?.content) && data.content) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data) && data) ||
      [];

    let filtered = list;
    if (filtered.some((item) => item?.createdById !== undefined)) {
      filtered = filtered.filter((item) => Number(item.createdById) === Number(currentUser?.id));
    }
    if (filtered.some((item) => item?.createdBy?.id !== undefined)) {
      filtered = filtered.filter((item) => Number(item.createdBy.id) === Number(currentUser?.id));
    }

    const hasMore =
      typeof data?.hasMore === "boolean" ? data.hasMore : filtered.length >= HISTORY_LIMIT;

    const nextAfterId =
      data?.nextAfterId ??
      data?.lastId ??
      (filtered.length ? filtered[filtered.length - 1]?.id : null);

    return { list: filtered, hasMore, nextAfterId };
  }

  async function loadHistory(reset = false) {
    if (!currentUser?.id) return;

    setHistoryErr("");
    setHistoryLoading(true);

    try {
      const afterId = reset ? null : historyAfterId;
      const qs = new URLSearchParams();
      qs.set("limit", String(HISTORY_LIMIT));
      if (afterId !== null && afterId !== undefined && afterId !== "") {
        qs.set("afterId", String(afterId));
      }

      const res = await fetch(`${API_ENDPOINTS.RECEIPTS}/feed?${qs.toString()}`, {
        headers: { "X-User-Id": String(currentUser.id) },
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const { list, hasMore, nextAfterId } = normalizeFeed(data);
      setHistoryItems((prev) => (reset ? list : [...prev, ...list]));
      setHistoryHasMore(Boolean(hasMore));
      setHistoryAfterId(nextAfterId ?? null);
    } catch (error) {
      setHistoryErr(error?.message || "Không thể tải lịch sử phiếu nhập");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openReceiptDetail(receiptId) {
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
            .map((detail, index) => {
              const name = detail?.name || detail?.materialName || "";
              const code = detail?.code || "";
              const lot = detail?.lotNumber || detail?.lot_number || "";
              const exp = detail?.expDate || detail?.exp_date || "";
              const qty = detail?.qtyActual ?? detail?.qty_actual ?? 0;
              const price = detail?.price ?? 0;
              const total = detail?.total ?? Number(qty) * Number(price);

              return `
                <tr>
                  <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${index + 1}</td>
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
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Không thể tải chi tiết",
        text: error?.message || "Có lỗi xảy ra",
        confirmButtonText: "OK",
      });
    }
  }

  const filteredHistory = useMemo(() => {
    const search = String(historySearch || "").trim().toLowerCase();
    if (!search) return historyItems;

    return historyItems.filter((item) => {
      const id = String(item?.id ?? "").toLowerCase();
      const from = String(item?.receivedFrom ?? item?.received_from ?? "").toLowerCase();
      const reason = String(item?.reason ?? "").toLowerCase();
      const date = String(item?.receiptDate ?? item?.receipt_date ?? "").toLowerCase();
      return id.includes(search) || from.includes(search) || reason.includes(search) || date.includes(search);
    });
  }, [historyItems, historySearch]);

  return (
    <div className="ui-page receipt-page">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Nhập kho</h1>
            <p className="ui-page-subtitle">
              Trang nhập kho đã được đưa về cùng khung trắng, cùng giới hạn chiều ngang,
              cùng hệ button, form và bảng với các trang trước.
            </p>
          </div>

          <div className="receipt-tabs">
            <button
              type="button"
              className={`receipt-tab-btn ${activeTab === "create" ? "active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              Tạo phiếu nhập
            </button>
            <button
              type="button"
              className={`receipt-tab-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Lịch sử phiếu nhập
            </button>
          </div>
        </div>

        {message.text ? (
          <div className={`ui-alert ${message.type === "error" ? "is-error" : "is-success"}`}>
            {message.text}
          </div>
        ) : null}

        {activeTab === "create" ? (
          <div className="receipt-stack">
            <div className="ui-section">
              <div className="ui-section-head">
                <div>
                  <h2 className="ui-section-title">Thông tin phiếu nhập</h2>
                  <p className="ui-section-subtitle">
                    Nhập thông tin chung của phiếu trước khi thêm danh sách vật tư.
                  </p>
                </div>
              </div>

              <div className="receipt-header-grid">
                <div className="ui-field">
                  <label className="ui-label">Nhà cung cấp / người giao</label>
                  <input
                    className="ui-input"
                    value={header.receivedFrom}
                    onChange={(e) => setHeader((prev) => ({ ...prev, receivedFrom: e.target.value }))}
                    placeholder="Ví dụ: Công ty ABC - Nguyễn Văn A"
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label">Ngày nhập</label>
                  <input
                    className="ui-input"
                    type="date"
                    value={header.receiptDate}
                    onChange={(e) => setHeader((prev) => ({ ...prev, receiptDate: e.target.value }))}
                  />
                </div>

                <div className="ui-field">
                  <label className="ui-label">Lý do nhập</label>
                  <input
                    className="ui-input"
                    value={header.reason}
                    onChange={(e) => setHeader((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Ví dụ: Nhập theo hợp đồng / bổ sung tồn kho / tiếp nhận bàn giao..."
                  />
                </div>
              </div>
            </div>

            <div className="ui-section">
              <div className="ui-section-head">
                <div>
                  <h2 className="ui-section-title">Danh sách vật tư nhập</h2>
                  <p className="ui-section-subtitle">
                    Có thể gõ tên hoặc mã vật tư để tìm nhanh. Các dòng trùng sẽ được tô nhạt để tránh nhập lặp.
                  </p>
                </div>
              </div>

              {(duplicateNames.size > 0 || duplicateCodes.size > 0) && (
                <div className="ui-alert is-warning receipt-duplicate-alert">
                  {duplicateNames.size > 0 && (
                    <div>Trùng tên: {Array.from(duplicateNames).join(", ")}</div>
                  )}
                  {duplicateCodes.size > 0 && (
                    <div>Trùng mã: {Array.from(duplicateCodes).join(", ")}</div>
                  )}
                </div>
              )}

              <div className="ui-table-wrap">
                <table className="ui-table receipt-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 250 }}>Tên vật tư</th>
                      <th style={{ minWidth: 150 }}>Mã vật tư</th>
                      <th style={{ minWidth: 180 }}>Quy cách</th>
                      <th style={{ minWidth: 90 }}>ĐVT</th>
                      <th style={{ minWidth: 120 }} className="text-right">SL chứng từ</th>
                      <th style={{ minWidth: 120 }} className="text-right">SL thực nhập</th>
                      <th style={{ minWidth: 130 }} className="text-right">Đơn giá</th>
                      <th style={{ minWidth: 150 }}>Số lô</th>
                      <th style={{ minWidth: 130 }}>Ngày SX</th>
                      <th style={{ minWidth: 130 }}>Hạn dùng</th>
                      <th style={{ minWidth: 130 }} className="text-right">Thành tiền</th>
                      <th style={{ width: 100 }} className="text-center">Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => {
                      const { isNameDuplicate, isCodeDuplicate } = getDuplicateStatusForRow(row);
                      const isDuplicate = isNameDuplicate || isCodeDuplicate;

                      return (
                        <tr key={row.key} className={`receipt-row ${isDuplicate ? "duplicate-row" : ""}`}>
                          <td>
                            <MaterialSearch
                              mode="name"
                              value={row.name}
                              onChange={(value) =>
                                setRow(row.key, {
                                  name: value,
                                  materialId: null,
                                  code: "",
                                  spec: "",
                                  unitId: "",
                                  unitName: "",
                                })
                              }
                              onPick={(material) => pickMaterial(row.key, material)}
                              fetchMaterials={fetchMaterials}
                              placeholder="Gõ tên vật tư..."
                              isDuplicate={isNameDuplicate}
                            />
                          </td>

                          <td>
                            <MaterialSearch
                              mode="code"
                              value={row.code}
                              onChange={(value) =>
                                setRow(row.key, {
                                  code: value,
                                  materialId: null,
                                  name: "",
                                  spec: "",
                                  unitId: "",
                                  unitName: "",
                                })
                              }
                              onPick={(material) => pickMaterial(row.key, material)}
                              fetchMaterials={fetchMaterials}
                              placeholder="Gõ mã vật tư..."
                              isDuplicate={isCodeDuplicate}
                            />
                          </td>

                          <td>
                            <input className="ui-input receipt-table-input" value={row.spec} disabled />
                          </td>

                          <td>
                            <input className="ui-input receipt-table-input" value={row.unitName || ""} disabled />
                          </td>

                          <td>
                            <input
                              className="ui-input receipt-table-input text-right"
                              value={row.qtyDoc}
                              onChange={(e) => setRow(row.key, { qtyDoc: e.target.value })}
                              placeholder="0"
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input receipt-table-input text-right"
                              value={row.qtyActual}
                              onChange={(e) => setRow(row.key, { qtyActual: e.target.value })}
                              placeholder="0"
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input receipt-table-input text-right"
                              value={row.price}
                              onChange={(e) => setRow(row.key, { price: e.target.value })}
                              placeholder="0"
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input receipt-table-input"
                              value={row.lotNumber}
                              onChange={(e) => setRow(row.key, { lotNumber: e.target.value })}
                              placeholder="Ví dụ: LOT-0125-A"
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input receipt-table-input"
                              type="date"
                              value={row.mfgDate}
                              onChange={(e) => setRow(row.key, { mfgDate: e.target.value })}
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input receipt-table-input"
                              type="date"
                              value={row.expDate}
                              onChange={(e) => setRow(row.key, { expDate: e.target.value })}
                            />
                          </td>

                          <td className="text-right">
                            <span className={`receipt-money ${isDuplicate ? "is-duplicate" : ""}`}>
                              {moneyFmt.format(totals.rowTotals[index] || 0)}
                            </span>
                          </td>

                          <td className="text-center">
                            <button
                              type="button"
                              className="ui-btn ui-btn-danger ui-btn-sm"
                              onClick={() => removeRow(row.key)}
                              disabled={rows.length <= 1}
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

              <div className="receipt-controls-row">
                <div className="receipt-total-box">
                  <p className="receipt-total-label">Tổng chi phí phiếu nhập</p>
                  <p className="receipt-total-value">{moneyFmt.format(totals.grand)}</p>
                  <p className="receipt-total-hint">
                    Giá trị này được cộng tự động từ số lượng thực nhập và đơn giá của từng dòng.
                  </p>
                </div>

                <div className="receipt-actions">
                  <button type="button" className="ui-btn ui-btn-secondary" onClick={addRow}>
                    + Thêm dòng
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn-secondary"
                    onClick={() => {
                      setHeader({ receivedFrom: "", reason: "", receiptDate: todayISO() });
                      setRows([makeRow()]);
                      setMessage({ type: "", text: "" });
                    }}
                    disabled={loading}
                  >
                    Làm mới
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary"
                    onClick={submit}
                    disabled={loading}
                  >
                    {loading ? "Đang lưu..." : "Lưu phiếu nhập"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="ui-section">
            <div className="ui-section-head">
              <div>
                <h2 className="ui-section-title">Lịch sử phiếu nhập</h2>
                <p className="ui-section-subtitle">
                  Tra cứu các phiếu nhập bạn đã tạo trước đó và xem lại chi tiết từng phiếu.
                </p>
              </div>
            </div>

            <div className="receipt-history-toolbar">
              <div className="receipt-history-search">
                <input
                  className="ui-input"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Tìm theo mã phiếu / ngày / nhà cung cấp / lý do..."
                />
              </div>

              <div className="receipt-actions">
                <button
                  type="button"
                  className="ui-btn ui-btn-secondary"
                  onClick={() => loadHistory(true)}
                  disabled={historyLoading}
                >
                  Tải lại
                </button>
              </div>
            </div>

            {historyErr ? <div className="ui-alert is-error">{historyErr}</div> : null}

            <div className="ui-table-wrap">
              <table className="ui-table receipt-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 120 }}>Mã phiếu</th>
                    <th style={{ minWidth: 140 }}>Ngày nhập</th>
                    <th style={{ minWidth: 260 }}>Nhà cung cấp / người giao</th>
                    <th style={{ minWidth: 260 }}>Lý do</th>
                    <th style={{ minWidth: 140 }} className="text-right">Tổng tiền</th>
                    <th style={{ width: 120 }} className="text-center">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => {
                      const id = item?.id;
                      const date = item?.receiptDate ?? item?.receipt_date ?? "";
                      const from = item?.receivedFrom ?? item?.received_from ?? "";
                      const reason = item?.reason ?? "";
                      const total = item?.totalAmount ?? item?.total_amount ?? 0;

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
                              className="ui-btn ui-btn-secondary ui-btn-sm"
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
                      <td colSpan={6} className="ui-empty">
                        {historyLoading ? "Đang tải..." : "Chưa có phiếu nhập"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="receipt-history-footer">
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
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
    </div>
  );
}
