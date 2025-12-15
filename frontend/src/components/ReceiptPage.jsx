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

const MaterialSearch = ({
  value,
  onChange,
  onPick,
  fetchMaterials,
  placeholder = "Gõ để tìm...",
  mode = "name", // "name" | "code"
  isDuplicate = false, // Thêm prop để nhận trạng thái trùng
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const debounceRef = useRef(null);
  const [duplicateItems, setDuplicateItems] = useState([]); // State để lưu các item trùng

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
        list = list.filter(
          (m) => m.name && m.name.toLowerCase().includes(kw)
        );
      }

      if (mode === "code") {
        list = list.filter(
          (m) => m.code && m.code.toLowerCase().includes(kw)
        );
      }

      setItems(list.slice(0, 12));
      
      // Kiểm tra và đánh dấu các item trùng
      const duplicates = list.filter(item => {
        if (mode === "name") {
          return item.name && item.name.toLowerCase().includes(kw) && 
                 list.filter(i => i.name && i.name.toLowerCase() === item.name.toLowerCase()).length > 1;
        } else {
          return item.code && item.code.toLowerCase().includes(kw) && 
                 list.filter(i => i.code && i.code.toLowerCase() === item.code.toLowerCase()).length > 1;
        }
      });
      setDuplicateItems(duplicates);
    } catch {
      setItems([]);
      setDuplicateItems([]);
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

  // Kiểm tra xem item có bị trùng không
  const isItemDuplicate = (item) => {
    if (mode === "name") {
      return duplicateItems.some(dup => 
        dup.name && item.name && dup.name.toLowerCase() === item.name.toLowerCase()
      );
    } else {
      return duplicateItems.some(dup => 
        dup.code && item.code && dup.code.toLowerCase() === item.code.toLowerCase()
      );
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        className={`table-input ${isDuplicate ? 'duplicate-highlight' : ''}`} // Thêm class khi trùng
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        style={{
          backgroundColor: isDuplicate ? '#fee2e2' : 'white',
          borderColor: isDuplicate ? '#f87171' : '#e2e8f0'
        }}
      />

      {open &&
        createPortal(
          <div id="material-dropdown" style={dropdownStyle}>
            {loading ? (
              <div className="material-dropdown__empty">Đang tìm...</div>
            ) : items.length ? (
              items.map((m) => {
                const itemIsDuplicate = isItemDuplicate(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="material-dropdown__item"
                    onClick={() => pick(m)}
                    style={{
                      backgroundColor: itemIsDuplicate ? '#fee2e2' : 'white',
                      borderLeft: itemIsDuplicate ? '4px solid #ef4444' : 'none'
                    }}
                  >
                    <div className="material-dropdown__name">
                      {m.name} <span className="material-pill">({m.code})</span>
                      {itemIsDuplicate && (
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '12px',
                          color: '#ef4444',
                          fontWeight: 'bold'
                        }}>
                          ⚠️ Trùng
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
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
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Không auto-fill: reason để rỗng, receivedFrom rỗng
  const [header, setHeader] = useState({
    receivedFrom: "",
    reason: "",
    receiptDate: todayISO(),
  });

  const [rows, setRows] = useState([makeRow()]);

  useEffect(() => {
    const init = async () => {
      try {
        const userFromStorage = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const email = userFromStorage.email;
        if (!email) {
          setMessage({ type: "error", text: "Không tìm thấy email người dùng trong localStorage" });
          return;
        }
        const res = await fetch(
          `${API_ENDPOINTS.AUTH}/user-info?email=${encodeURIComponent(email)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCurrentUser(data);
      } catch {
        setMessage({ type: "error", text: "Không thể tải thông tin người dùng" });
      }
    };
    init();
  }, []);

  const fetchMaterials = async (keyword) => {
    const q = (keyword || "").trim();
    const url = `${API_ENDPOINTS.MATERIALS}/search?keyword=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  // Hàm kiểm tra trùng tên vật tư TRONG CÙNG BẢNG
  const checkDuplicateNamesInTable = useMemo(() => {
    const nameCounts = {};
    const duplicates = new Set();
    
    rows.forEach(row => {
      if (row.name.trim()) {
        const normalizedName = row.name.toLowerCase().trim();
        nameCounts[normalizedName] = (nameCounts[normalizedName] || 0) + 1;
      }
    });
    
    Object.keys(nameCounts).forEach(name => {
      if (nameCounts[name] > 1) {
        duplicates.add(name);
      }
    });
    
    return duplicates;
  }, [rows]);

  // Hàm kiểm tra trùng mã vật tư TRONG CÙNG BẢNG
  const checkDuplicateCodesInTable = useMemo(() => {
    const codeCounts = {};
    const duplicates = new Set();
    
    rows.forEach(row => {
      if (row.code.trim()) {
        const normalizedCode = row.code.toLowerCase().trim();
        codeCounts[normalizedCode] = (codeCounts[normalizedCode] || 0) + 1;
      }
    });
    
    Object.keys(codeCounts).forEach(code => {
      if (codeCounts[code] > 1) {
        duplicates.add(code);
      }
    });
    
    return duplicates;
  }, [rows]);

  const totals = useMemo(() => {
    const rowTotals = rows.map((r) => {
      const qty = toNumber(r.qtyActual);
      const price = toNumber(r.price);
      return qty * price;
    });
    const grand = rowTotals.reduce((a, b) => a + b, 0);
    return { rowTotals, grand };
  }, [rows]);

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

  const validateBeforeSubmit = () => {
    if (!currentUser?.id) return "Chưa xác định được người dùng (X-User-Id)";
    if (!header.receivedFrom.trim()) return "Vui lòng nhập người giao hàng";
    if (!header.receiptDate) return "Vui lòng chọn ngày nhập";

    // Kiểm tra trùng tên/mã trong bảng
    if (checkDuplicateNamesInTable.size > 0) {
      return `Có vật tư trùng tên trong bảng: ${Array.from(checkDuplicateNamesInTable).join(', ')}. Vui lòng kiểm tra lại.`;
    }
    
    if (checkDuplicateCodesInTable.size > 0) {
      return `Có vật tư trùng mã trong bảng: ${Array.from(checkDuplicateCodesInTable).join(', ')}. Vui lòng kiểm tra lại.`;
    }

    const usableRows = rows.filter((r) => r.materialId || r.name.trim() || r.code.trim());
    if (!usableRows.length) return "Phiếu nhập phải có ít nhất 1 dòng vật tư";

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const isBlank = !r.materialId && !r.name.trim() && !r.code.trim();
      if (isBlank) continue;

      if (!r.materialId) return `Dòng ${i + 1}: Vui lòng chọn vật tư (tìm theo tên hoặc mã)`;
      const qty = toNumber(r.qtyActual);
      if (qty <= 0) return `Dòng ${i + 1}: Số lượng thực nhập phải > 0`;
      const price = toNumber(r.price);
      if (price < 0) return `Dòng ${i + 1}: Đơn giá không hợp lệ`;
      if (!String(r.lotNumber || "").trim()) return `Dòng ${i + 1}: Vui lòng nhập số lô`;
      if (r.mfgDate && r.expDate && r.mfgDate > r.expDate)
        return `Dòng ${i + 1}: Ngày SX không được sau HSD`;
    }
    return "";
  };

  const buildPayload = () => {
    const details = rows
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
    const err = validateBeforeSubmit();
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const payload = buildPayload();
      const res = await fetch(`${API_ENDPOINTS.RECEIPTS}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(currentUser.id),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error(data?.message || "Tạo phiếu nhập thất bại");

      await Swal.fire({
        icon: "success",
        title: "Tạo phiếu nhập thành công",
        text: data?.message || "Phiếu nhập đã được lưu và cập nhật thẻ kho.",
        confirmButtonText: "OK",
      });

      setHeader({
        receivedFrom: "",
        reason: "",
        receiptDate: todayISO(),
      });
      setRows([makeRow()]);
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Có lỗi xảy ra" });
    } finally {
      setLoading(false);
    }
  };

  // Kiểm tra trùng cho mỗi dòng trong bảng
  const getDuplicateStatusForRow = (row) => {
    const isNameDuplicate = row.name.trim() && 
      checkDuplicateNamesInTable.has(row.name.toLowerCase().trim());
    const isCodeDuplicate = row.code.trim() && 
      checkDuplicateCodesInTable.has(row.code.toLowerCase().trim());
    
    return {
      isNameDuplicate,
      isCodeDuplicate
    };
  };

  return (
    <div className="receipt-page">
      <h1 className="page-title">Nhập kho</h1>

      {message.text ? (
        <div className={`message ${message.type === "error" ? "error" : "success"}`}>
          {message.text}
        </div>
      ) : null}

      {/* Thông báo trùng tên/mã nếu có */}
      {(() => {
        const hasNameDuplicates = checkDuplicateNamesInTable.size > 0;
        const hasCodeDuplicates = checkDuplicateCodesInTable.size > 0;
        
        if (hasNameDuplicates || hasCodeDuplicates) {
          return (
            <div className="message warning" style={{
              backgroundColor: '#fef3c7',
              color: '#d97706',
              borderLeft: '4px solid #f59e0b',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <div>
                <strong>Cảnh báo trùng lặp:</strong>
                {hasNameDuplicates && (
                  <div>Trùng tên: {Array.from(checkDuplicateNamesInTable).join(', ')}</div>
                )}
                {hasCodeDuplicates && (
                  <div>Trùng mã: {Array.from(checkDuplicateCodesInTable).join(', ')}</div>
                )}
                <div style={{ fontSize: '14px', marginTop: '4px' }}>
                  Các ô bị trùng được tô màu đỏ nhạt.
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="receipt-form">
        <div className="section-header">
          <h2 className="section-title">Thông tin phiếu nhập</h2>
        </div>

        <div className="header-grid">
          <div className="form-group">
            <label className="form-label">Người giao hàng</label>
            <input
              className="form-input"
              value={header.receivedFrom}
              onChange={(e) => setHeader((p) => ({ ...p, receivedFrom: e.target.value }))}
              placeholder="Ví dụ: Nguyễn Văn A / Công ty ABC"
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
          <div className="section-actions">
            <button type="button" className="btn-add-row" onClick={addRow}>
              + Thêm dòng
            </button>
          </div>
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
                
                return (
                  <tr key={r.key} style={{
                    backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fef2f2' : 'transparent'
                  }}>
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
                        isDuplicate={isNameDuplicate} // Truyền trạng thái trùng
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
                        isDuplicate={isCodeDuplicate} // Truyền trạng thái trùng
                      />
                    </td>

                    <td>
                      <input 
                        className="table-input" 
                        value={r.spec} 
                        disabled 
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : '#f8fafc'
                        }}
                      />
                    </td>

                    <td>
                      <input 
                        className="table-input" 
                        value={r.unitName || ""} 
                        disabled 
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : '#f8fafc'
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="table-input number-input"
                        value={r.qtyDoc}
                        onChange={(e) => setRow(r.key, { qtyDoc: e.target.value })}
                        placeholder="0"
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : 'white'
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="table-input number-input"
                        value={r.qtyActual}
                        onChange={(e) => setRow(r.key, { qtyActual: e.target.value })}
                        placeholder="0"
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : 'white'
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="table-input number-input"
                        value={r.price}
                        onChange={(e) => setRow(r.key, { price: e.target.value })}
                        placeholder="0"
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : 'white'
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="table-input"
                        value={r.lotNumber}
                        onChange={(e) => setRow(r.key, { lotNumber: e.target.value })}
                        placeholder="Ví dụ: LOT-0125-A"
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : 'white'
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="table-input"
                        type="date"
                        value={r.mfgDate}
                        onChange={(e) => setRow(r.key, { mfgDate: e.target.value })}
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : 'white'
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="table-input"
                        type="date"
                        value={r.expDate}
                        onChange={(e) => setRow(r.key, { expDate: e.target.value })}
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fee2e2' : 'white'
                        }}
                      />
                    </td>

                    <td className="text-right">
                      <div className="money" style={{
                        color: (isNameDuplicate || isCodeDuplicate) ? '#dc2626' : '#1e293b'
                      }}>
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
                        style={{
                          backgroundColor: (isNameDuplicate || isCodeDuplicate) ? '#fca5a5' : '#fee2e2'
                        }}
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

        <div className="totals">
          <div className="totals__row">
            <div className="totals__value">Tổng chi phí: {moneyFmt.format(totals.grand)}</div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => {
              setHeader({
                receivedFrom: "",
                reason: "",
                receiptDate: todayISO(),
              });
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
    </div>
  );
}