import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { createPortal } from "react-dom";
import "./dashboard-ui.css";
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

function fmtDateTime(s) {
  if (!s) return "—";
  const str = String(s).replace("T", " ");
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}`;
  return fmtDate(s);
}

function safeStr(s) {
  return s == null ? "" : String(s);
}

function escapeHtml(value) {
  return safeStr(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanReceiverName(value) {
  return safeStr(value).replace(/\s*\(IssueReq#\d+\)\s*$/i, "").trim();
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

/**
 * Chuẩn hoá dữ liệu "ineligible" để luôn có:
 * - reqId
 * - subDepartmentName
 * - requestedAt
 * - reasonCode, reasonMessage
 */
function normalizeIneligibleRow(x) {
  const base = x?.req || x?.header || x?.request || x?.data || x || {};

  const reqId =
    base?.id ??
    x?.reqId ??
    x?.issueReqId ??
    x?.id ??
    "-";

  const subDepartmentName =
    base?.subDepartmentName ??
    base?.subDepartment ??
    base?.subDeptName ??
    "-";

  const requestedAt =
    base?.requestedAt ??
    base?.createdAt ??
    base?.requestTime ??
    x?.requestedAt ??
    null;

  const reasonCode = x?.reasonCode ?? x?.code ?? x?.reason ?? "";
  const reasonMessage = x?.reasonMessage ?? x?.message ?? x?.reasonDetail ?? "";

  return {
    reqId,
    subDepartmentName,
    requestedAt,
    reasonCode,
    reasonMessage,
  };
}

export default function IssuePage() {
  const HISTORY_LIMIT = 20;
  const ELIGIBLE_PAGE_SIZE = 10;
  const ELIGIBLE_FETCH_LIMIT = 200;

  // -------- Current user (thủ kho) ----------
  const [currentUser, setCurrentUser] = useState(null);
  const [bootError, setBootError] = useState("");

  // -------- Tabs ----------
  const [activeTab, setActiveTab] = useState("create");

  // -------- Filters ----------
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [subDepartmentSearch, setSubDepartmentSearch] = useState("");
  const [eligiblePage, setEligiblePage] = useState(0);

  // -------- List eligible/ineligible ----------
  const [loadingList, setLoadingList] = useState(false);
  const [listMsg, setListMsg] = useState({ type: "", text: "" });
  const [eligible, setEligible] = useState([]);
  const [ineligible, setIneligible] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showIneligible, setShowIneligible] = useState(false);
  const [ineligiblePage, setIneligiblePage] = useState(0);

  // -------- Selected request & preview ----------
  const [selected, setSelected] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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

  // -------- Issue history ----------
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState("");
  const [historyItems, setHistoryItems] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historySearch, setHistorySearch] = useState("");

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
        const email = userFromStorage?.email;
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
    return { ok: res.ok, status: res.status, data };
  };

  // ------------------ normalize response ------------------
  const normalizeEligibleResponse = (payload) => {
    // Case A1: /eligible-requests-with-reasons -> { eligible, ineligible, summary }
    if (payload && Array.isArray(payload.eligible)) {
      return {
        eligible: payload.eligible,
        ineligible: Array.isArray(payload.ineligible) ? payload.ineligible : [],
        summary: payload.summary || null,
      };
    }

    // Case A2 (phòng hờ): backend trả { eligibleRequests, ineligibleRequests, summary }
    if (payload && (Array.isArray(payload.eligibleRequests) || Array.isArray(payload.ineligibleRequests))) {
      return {
        eligible: Array.isArray(payload.eligibleRequests) ? payload.eligibleRequests : [],
        ineligible: Array.isArray(payload.ineligibleRequests) ? payload.ineligibleRequests : [],
        summary: payload.summary || null,
      };
    }

    // Case B: /eligible-requests -> { requests, summary }
    if (payload && Array.isArray(payload.requests)) {
      return {
        eligible: payload.requests,
        ineligible: [],
        summary: payload.summary || null,
      };
    }

    // Case C: unknown shape
    return { eligible: [], ineligible: [], summary: payload?.summary || null };
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
      params.set("limit", String(ELIGIBLE_FETCH_LIMIT));

      // ưu tiên endpoint có reasons
      const url = `${API_ENDPOINTS.ISSUES}/eligible-requests-with-reasons?${params.toString()}`;
      const { data } = await fetchJson(url, { headers: authHeaders });

      if (!data || data.success !== true) {
        setListMsg({ type: "error", text: data?.message || "Không thể tải danh sách." });
        setEligible([]);
        setIneligible([]);
        setSummary(null);
        return;
      }

      const norm = normalizeEligibleResponse(data);

      setEligible(norm.eligible);
      setIneligible(norm.ineligible);
      if (!norm.ineligible.length) setShowIneligible(false);
      setEligiblePage(0);
      setIneligiblePage(0);
      setSummary(norm.summary);

      setListMsg({
        type: "success",
        text:
          norm.eligible.length === 0
            ? (data.message || "Không có phiếu nào đủ điều kiện để xuất")
            : (data.message || "Đã tải danh sách."),
      });

      // Nếu selected không còn trong eligible thì reset preview
      if (selected?.id) {
        const still = (norm.eligible || []).some((x) => x?.id === selected.id);
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
      setEligible([]);
      setIneligible([]);
      setSummary(null);
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
    setPreviewOpen(true);
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
      const { data } = await fetchJson(
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

  const closeDrawer = () => {
    setPreviewOpen(false);
    setSelected(null);
    setPreviewData(null);
    setManualAlloc({});
    setCreateMsg({ type: "", text: "" });
    setIssueDetail(null);
    setCreatedIssueId(null);
  };

  const filteredEligible = useMemo(() => {
    const dept = departmentSearch.trim().toLowerCase();
    const sub = subDepartmentSearch.trim().toLowerCase();
    return eligible.filter((r) => {
      if (dept && !safeStr(r.departmentName).toLowerCase().includes(dept)) return false;
      if (sub && !safeStr(r.subDepartmentName).toLowerCase().includes(sub)) return false;
      return true;
    });
  }, [eligible, departmentSearch, subDepartmentSearch]);

  const eligibleTotalPages = Math.max(1, Math.ceil(filteredEligible.length / ELIGIBLE_PAGE_SIZE));
  const safeEligiblePage = Math.min(eligiblePage, eligibleTotalPages - 1);
  const pagedEligible = filteredEligible.slice(
    safeEligiblePage * ELIGIBLE_PAGE_SIZE,
    safeEligiblePage * ELIGIBLE_PAGE_SIZE + ELIGIBLE_PAGE_SIZE
  );

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
      const { data } = await fetchJson(`${API_ENDPOINTS.ISSUES}/materials/${line.materialId}/lots`, {
        headers: authHeaders,
      });

      const arr = Array.isArray(data) ? data : [];
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
      const { data } = await fetchJson(`${API_ENDPOINTS.ISSUES}/${issueId}/detail`, { headers: authHeaders });
      if (!data?.success) {
        setIssueDetail(null);
        return;
      }
      setIssueDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  function normalizeHistoryFeed(data) {
    const list =
      (Array.isArray(data?.items) && data.items) ||
      (Array.isArray(data?.content) && data.content) ||
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data) && data) ||
      [];

    const summary = data?.summary || {};
    const currentPage = Number(summary?.currentPage ?? data?.currentPage ?? 0);
    const totalPages = Math.max(1, Number(summary?.totalPages ?? data?.totalPages ?? 1));

    return { list, currentPage, totalPages };
  }

  async function loadHistory(page = 0) {
    if (!currentUser?.id) return;

    setHistoryErr("");
    setHistoryLoading(true);

    try {
      const nextPage = Math.max(0, Number(page) || 0);
      const qs = new URLSearchParams();
      qs.set("limit", String(HISTORY_LIMIT));
      qs.set("page", String(nextPage));

      const { ok, status, data } = await fetchJson(`${API_ENDPOINTS.ISSUES}/feed?${qs.toString()}`, {
        headers: authHeaders,
      });

      if (!ok || data?.success !== true) {
        throw new Error(data?.message || `HTTP ${status}`);
      }

      const { list, currentPage, totalPages } = normalizeHistoryFeed(data);
      setHistoryItems(list);
      setHistoryPage(currentPage);
      setHistoryTotalPages(totalPages);
    } catch (error) {
      setHistoryErr(error?.message || "Không thể tải lịch sử phiếu xuất");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openIssueDetail(issueId) {
    if (!issueId) return;

    try {
      const { ok, status, data } = await fetchJson(`${API_ENDPOINTS.ISSUES}/${issueId}/detail`, {
        headers: authHeaders,
      });

      if (!ok || !data?.success) {
        throw new Error(data?.message || `HTTP ${status}`);
      }

      const headerObj = data?.header || {};
      const details = Array.isArray(data?.details) ? data.details : [];
      const headerId = headerObj?.id ?? issueId;
      const receiver = cleanReceiverName(headerObj?.receiverName);

      const rowsHtml = details
        .map((detail, index) => {
          const qty = detail?.qtyIssued ?? 0;
          const price = detail?.unitPrice ?? 0;
          const total = detail?.total ?? Number(qty) * Number(price);

          return `
            <tr>
              <td class="text-center">${index + 1}</td>
              <td>${escapeHtml(detail?.name || "")}</td>
              <td>${escapeHtml(detail?.code || "")}</td>
              <td>${escapeHtml(detail?.unitName || "")}</td>
              <td class="text-right">${escapeHtml(qtyFmt.format(toNumber(qty)))}</td>
              <td class="text-right">${escapeHtml(moneyFmt.format(toNumber(price)))}</td>
              <td class="text-right">${escapeHtml(moneyFmt.format(toNumber(total)))}</td>
            </tr>
          `;
        })
        .join("");

      const html = `
        <div class="ui-history-detail">
          <div class="ui-history-detail-head">Chi tiết Phiếu Xuất #${escapeHtml(headerId)}</div>
          <div class="ui-history-detail-body">
            <div class="ui-history-info">
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Mã phiếu xuất:</div>
                <div class="ui-history-info-value">#${escapeHtml(headerId)}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Ngày xuất:</div>
                <div class="ui-history-info-value">${escapeHtml(fmtDate(headerObj?.issueDate))}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Khoa / Phòng:</div>
                <div class="ui-history-info-value">${escapeHtml(headerObj?.departmentName || "—")}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Người nhận:</div>
                <div class="ui-history-info-value">${escapeHtml(receiver || "—")}</div>
              </div>
              <div class="ui-history-info-row">
                <div class="ui-history-info-label">Tổng tiền:</div>
                <div class="ui-history-info-value">${escapeHtml(moneyFmt.format(toNumber(headerObj?.totalAmount)))}</div>
              </div>
            </div>

            <h4 class="ui-history-detail-section-title">Danh sách vật tư (${details.length} vật tư)</h4>
            <div class="ui-history-table-wrap">
              <table class="ui-history-table">
                <thead>
                  <tr>
                    <th>TT</th>
                    <th>Tên vật tư</th>
                    <th>Mã code</th>
                    <th>Đơn vị tính</th>
                    <th class="text-right">SL xuất</th>
                    <th class="text-right">Đơn giá</th>
                    <th class="text-right">Thành tiền</th>
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
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Không thể tải chi tiết",
        text: error?.message || "Có lỗi xảy ra",
        confirmButtonText: "OK",
      });
    }
  }

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

      const { data } = await fetchJson(`${API_ENDPOINTS.ISSUES}/create-from-issue-req`, {
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
      if (historyItems.length > 0) await loadHistory(historyPage);
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

  useEffect(() => {
    if (activeTab === "history" && currentUser?.id && historyItems.length === 0 && !historyLoading) {
      loadHistory(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id]);

  const filteredHistory = useMemo(() => {
    const search = String(historySearch || "").trim().toLowerCase();
    if (!search) return historyItems;

    return historyItems.filter((item) => {
      const id = String(item?.id ?? "").toLowerCase();
      const issueReqId = String(item?.issueReqId ?? "").toLowerCase();
      const receiver = cleanReceiverName(item?.receiverName).toLowerCase();
      const dept = String(item?.departmentName ?? "").toLowerCase();
      const subDept = String(item?.subDepartmentName ?? "").toLowerCase();
      const creator = String(item?.createdByName ?? "").toLowerCase();
      const date = String(item?.issueDate ?? "").toLowerCase();
      return (
        id.includes(search) ||
        issueReqId.includes(search) ||
        receiver.includes(search) ||
        dept.includes(search) ||
        subDept.includes(search) ||
        creator.includes(search) ||
        date.includes(search)
      );
    });
  }, [historyItems, historySearch]);

  const ineligibleCount = Number(summary?.ineligible ?? ineligible.length);
  const hasIneligible = ineligibleCount > 0;
  const ineligibleTotalPages = Math.max(1, Math.ceil(ineligible.length / ELIGIBLE_PAGE_SIZE));
  const safeIneligiblePage = Math.min(ineligiblePage, ineligibleTotalPages - 1);
  const pagedIneligible = ineligible.slice(
    safeIneligiblePage * ELIGIBLE_PAGE_SIZE,
    safeIneligiblePage * ELIGIBLE_PAGE_SIZE + ELIGIBLE_PAGE_SIZE
  );

  if (bootError) {
    return (
      <div className="ui-page issue-page">
        <div className="ui-page-frame">
          <div className="ui-page-head">
            <div>
              <h1 className="ui-page-title">Xuất kho</h1>
            </div>
          </div>
          <div className="ui-alert is-error">{bootError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page issue-page">
      <div className="ui-page-frame">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Xuất kho</h1>
          </div>

          <div className="ui-tabs" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`ui-tab ${activeTab === "create" ? "is-active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              Tạo phiếu xuất
            </button>
            <button
              type="button"
              className={`ui-tab ${activeTab === "history" ? "is-active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Lịch sử phiếu xuất
            </button>
          </div>
        </div>

        <div className="issue-stack">
          {activeTab === "create" ? (
            <div className="ui-section">
      {/* DANH SÁCH PHIẾU ĐỦ ĐIỀU KIỆN */}
        <div className="ui-section-head">
          <h2 className="ui-section-title">Phiếu xin lĩnh đủ điều kiện xuất</h2>
          <div className="issue-inline-actions">
            <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={loadEligibleList} disabled={loadingList}>
              {loadingList ? "Đang tải..." : "Tải lại"}
            </button>
          </div>
        </div>

        {listMsg.text ? (
          <div className={`ui-alert ${listMsg.type === "error" ? "is-error" : "is-success"}`}>{listMsg.text}</div>
        ) : null}

        <div className="issue-filter-grid">
          <div className="ui-field">
            <label className="ui-label">Khoa / Phòng</label>
            <input
              className="ui-input"
              value={departmentSearch}
              onChange={(e) => {
                setDepartmentSearch(e.target.value);
                setEligiblePage(0);
              }}
              placeholder="Tìm theo tên khoa..."
            />
          </div>

          <div className="ui-field">
            <label className="ui-label">Bộ môn</label>
            <input
              className="ui-input"
              value={subDepartmentSearch}
              onChange={(e) => {
                setSubDepartmentSearch(e.target.value);
                setEligiblePage(0);
              }}
              placeholder="Tìm theo tên bộ môn..."
            />
          </div>
        </div>

        {pagedEligible.length ? (
          <div className="ui-table-wrap">
            <table className="ui-table issue-table">
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
                {pagedEligible.map((r) => (
                  <tr key={r.id} className={selected?.id === r.id ? "row-active" : ""}>
                    <td data-label="Mã phiếu" className="issue-mono">{r.id}</td>
                    <td data-label="Bộ môn / Đơn vị">{r.subDepartmentName || "-"}</td>
                    <td data-label="Khoa / Phòng">{r.departmentName || "-"}</td>
                    <td data-label="Người tạo">{r.createdByName || "-"}</td>
                    <td data-label="Ngày gửi" className="issue-mono">{fmtDateTime(r.requestedAt)}</td>
                    <td data-label="Ghi chú" className="issue-muted">{r.note || ""}</td>
                    <td className="text-right">
                      <button
                        className="ui-btn ui-btn-primary ui-btn-sm"
                        onClick={() => loadPreview(r)}
                        disabled={loadingPreview && selected?.id === r.id}
                      >
                        {loadingPreview && selected?.id === r.id ? "Đang tải..." : "Xem trước"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="issue-empty-panel">
            <h3>{eligible.length === 0 ? "Không có phiếu sẵn sàng xuất kho" : "Không có phiếu khớp bộ lọc"}</h3>
            <p>
              {eligible.length === 0
                ? "Các phiếu đã xét hiện đều đã xuất kho hoặc chưa đủ điều kiện nghiệp vụ để đưa vào danh sách xuất."
                : "Thử đổi bộ lọc khoa/phòng hoặc bộ môn để xem phiếu khác."}
            </p>
          </div>
        )}

        <div className="ui-pagination" aria-label="Phân trang phiếu đủ điều kiện xuất">
          <button
            type="button"
            className="ui-pagination-btn"
            onClick={() => setEligiblePage((page) => Math.max(0, page - 1))}
            disabled={loadingList || safeEligiblePage <= 0}
          >
            Trang trước
          </button>

          {visiblePageNumbers(eligibleTotalPages, safeEligiblePage).map((page) => (
            <button
              key={page}
              type="button"
              className={`ui-pagination-btn ${page === safeEligiblePage ? "is-active" : ""}`}
              onClick={() => setEligiblePage(page)}
              disabled={loadingList || page === safeEligiblePage}
            >
              {page + 1}
            </button>
          ))}

          <button
            type="button"
            className="ui-pagination-btn"
            onClick={() => setEligiblePage((page) => Math.min(eligibleTotalPages - 1, page + 1))}
            disabled={loadingList || safeEligiblePage >= eligibleTotalPages - 1}
          >
            Trang sau
          </button>
        </div>

        {hasIneligible ? (
          <div className="issue-toggle-row">
            <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setShowIneligible((p) => !p)}>
              {showIneligible ? "Ẩn phiếu không đủ điều kiện" : "Xem phiếu không đủ điều kiện"}
            </button>
          </div>
        ) : null}

        {hasIneligible && showIneligible ? (
          <div className="issue-collapse-box">
            <div className="issue-collapse-title">Phiếu không đủ điều kiện (tóm tắt lý do)</div>
            <div className="ui-table-wrap">
              <table className="ui-table issue-table issue-table-sm">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Mã phiếu</th>
                    <th style={{ minWidth: 190 }}>Ngày gửi</th>
                    <th style={{ minWidth: 420 }}>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedIneligible.map((raw, idx) => {
                    const x = normalizeIneligibleRow(raw);
                    const reasonText = vnReason(x.reasonCode);
                    const rowIndex = safeIneligiblePage * ELIGIBLE_PAGE_SIZE + idx;
                    return (
                      <tr key={`${x.reqId}-${rowIndex}`}>
                        <td data-label="Mã phiếu" className="issue-mono">{x.reqId}</td>
                        <td data-label="Ngày gửi" className="issue-mono">{fmtDateTime(x.requestedAt)}</td>
                        <td data-label="Lý do" className="issue-muted">
                          {reasonText}
                          {x.reasonMessage ? <div style={{ marginTop: 6 }}>{x.reasonMessage}</div> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="ui-pagination" aria-label="Phân trang phiếu không đủ điều kiện">
              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setIneligiblePage((page) => Math.max(0, page - 1))}
                disabled={loadingList || safeIneligiblePage <= 0}
              >
                Trang trước
              </button>

              {visiblePageNumbers(ineligibleTotalPages, safeIneligiblePage).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`ui-pagination-btn ${page === safeIneligiblePage ? "is-active" : ""}`}
                  onClick={() => setIneligiblePage(page)}
                  disabled={loadingList || page === safeIneligiblePage}
                >
                  {page + 1}
                </button>
              ))}

              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setIneligiblePage((page) => Math.min(ineligibleTotalPages - 1, page + 1))}
                disabled={loadingList || safeIneligiblePage >= ineligibleTotalPages - 1}
              >
                Trang sau
              </button>
            </div>
          </div>
        ) : null}
            </div>
          ) : (
            <div className="ui-section">
              <div className="ui-section-head">
                <div>
                  <h2 className="ui-section-title">Lịch sử phiếu xuất kho</h2>
                </div>
              </div>

              <div className="issue-history-toolbar">
                <div className="issue-history-search">
                  <input
                    className="ui-input"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Tìm theo mã phiếu / phiếu xin lĩnh / khoa / bộ môn / người nhận..."
                  />
                </div>

                <div className="issue-actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn-secondary"
                    onClick={() => loadHistory(historyPage)}
                    disabled={historyLoading}
                  >
                    Tải lại
                  </button>
                </div>
              </div>

              {historyErr ? <div className="ui-alert is-error">{historyErr}</div> : null}

              <div className="ui-table-wrap">
                <table className="ui-table issue-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 110 }}>Mã phiếu</th>
                      <th style={{ minWidth: 130 }}>Phiếu xin lĩnh</th>
                      <th style={{ minWidth: 140 }}>Ngày xuất</th>
                      <th style={{ minWidth: 220 }}>Khoa / Phòng</th>
                      <th style={{ minWidth: 220 }}>Bộ môn</th>
                      <th style={{ minWidth: 220 }}>Người nhận</th>
                      <th style={{ minWidth: 140 }} className="text-right">Tổng tiền</th>
                      <th style={{ width: 120 }} className="text-center">Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredHistory.length > 0 ? (
                      filteredHistory.map((item) => {
                        const id = item?.id;
                        const issueReqId = item?.issueReqId;
                        const receiver = cleanReceiverName(item?.receiverName);

                        return (
                          <tr key={id ?? `${item?.issueDate}-${item?.receiverName}`}>
                            <td data-label="Mã phiếu" className="issue-mono">#{id}</td>
                            <td data-label="Phiếu xin lĩnh" className="issue-mono">
                              {issueReqId ? `#${issueReqId}` : "-"}
                            </td>
                            <td data-label="Ngày xuất" className="issue-mono">{fmtDate(item?.issueDate)}</td>
                            <td data-label="Khoa / Phòng">{item?.departmentName || "-"}</td>
                            <td data-label="Bộ môn">{item?.subDepartmentName || "-"}</td>
                            <td data-label="Người nhận">{receiver || "-"}</td>
                            <td className="text-right issue-mono" data-label="Tổng tiền">
                              {moneyFmt.format(toNumber(item?.totalAmount))}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="ui-btn ui-btn-secondary ui-btn-sm"
                                onClick={() => openIssueDetail(id)}
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
                        <td colSpan={8} className="ui-empty">
                          {historyLoading ? "Đang tải..." : "Chưa có phiếu xuất"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ui-pagination" aria-label="Phân trang lịch sử phiếu xuất">
                <button
                  type="button"
                  className="ui-pagination-btn"
                  onClick={() => loadHistory(historyPage - 1)}
                  disabled={historyLoading || historyPage <= 0}
                >
                  Trang trước
                </button>

                {visiblePageNumbers(historyTotalPages, historyPage).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`ui-pagination-btn ${page === historyPage ? "is-active" : ""}`}
                    onClick={() => loadHistory(page)}
                    disabled={historyLoading || page === historyPage}
                  >
                    {page + 1}
                  </button>
                ))}

                <button
                  type="button"
                  className="ui-pagination-btn"
                  onClick={() => loadHistory(historyPage + 1)}
                  disabled={historyLoading || historyPage >= historyTotalPages - 1}
                >
                  Trang sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PREVIEW MODAL XEM TRƯỚC + TẠO PHIẾU XUẤT */}
      {previewOpen && selected
        ? createPortal(
            <div
              className="ui-modal-overlay"
              style={{ zIndex: 8000 }}
              onMouseDown={closeDrawer}
            >
              <div
                className="ui-modal"
                style={{ width: "min(980px, 100%)" }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="ui-modal-header">
                  <div>
                    <h3>Xem trước và xuất kho</h3>
                    <p>Phiếu #{selected.id} — {selected.subDepartmentName || "—"}</p>
                  </div>
                </div>

                {/* Body (scrollable) */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  {previewMsg.text ? (
                    <div className={`ui-alert ${previewMsg.type === "error" ? "is-error" : "is-success"}`}>
                      {previewMsg.text}
                    </div>
                  ) : null}

                  {/* Thông tin phiếu xin lĩnh */}
                  <div className="issue-request-info">
                    <div className="issue-request-grid">
                      <div className="issue-request-item">
                        <div className="issue-request-label">Phiếu xin lĩnh</div>
                        <div className="issue-request-value issue-mono">#{selected.id}</div>
                      </div>
                      <div className="issue-request-item">
                        <div className="issue-request-label">Bộ môn</div>
                        <div className="issue-request-value">{selected.subDepartmentName || "-"}</div>
                      </div>
                      <div className="issue-request-item">
                        <div className="issue-request-label">Khoa / Phòng</div>
                        <div className="issue-request-value">{selected.departmentName || "-"}</div>
                      </div>
                      <div className="issue-request-item">
                        <div className="issue-request-label">Ngày gửi</div>
                        <div className="issue-request-value issue-mono">{fmtDateTime(selected.requestedAt)}</div>
                      </div>
                    </div>
                    {selected.note ? <div className="issue-request-note">{selected.note}</div> : null}
                  </div>

                  {previewMissingMessages.length ? (
                    <div className="ui-alert is-error" style={{ marginTop: 12 }}>
                      <div className="issue-muted-strong">Không thể xuất kho vì:</div>
                      <ul className="mini-list">
                        {previewMissingMessages.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Config box */}
                  <div className="issue-config-box" style={{ marginTop: 14 }}>
                    <div className="issue-config-head">
                      <h3 className="issue-config-title">Thông tin phiếu xuất</h3>
                    </div>
                    <div className="issue-config-grid">
                      <div className="ui-field">
                        <label className="ui-label">Ngày xuất</label>
                        <input
                          type="date"
                          className="ui-input"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                        />
                      </div>
                      <div className="ui-field">
                        <label className="ui-label">Kho</label>
                        <input
                          className="ui-input"
                          value={warehouseName}
                          onChange={(e) => setWarehouseName(e.target.value)}
                          placeholder="Kho chính"
                        />
                      </div>
                      <div className="ui-field">
                        <label className="ui-label">Người nhận (nếu cần)</label>
                        <input
                          className="ui-input"
                          value={receiverName}
                          onChange={(e) => setReceiverName(e.target.value)}
                          placeholder="Có thể để trống"
                        />
                      </div>
                      <div className="ui-field">
                        <label className="ui-label">Cách chọn lô</label>
                        <div className="issue-segmented">
                          <button
                            className={`issue-seg-btn ${autoAllocate ? "active" : ""}`}
                            type="button"
                            onClick={() => setAutoAllocate(true)}
                          >
                            Tự động (FEFO)
                          </button>
                          <button
                            className={`issue-seg-btn ${!autoAllocate ? "active" : ""}`}
                            type="button"
                            onClick={() => setAutoAllocate(false)}
                          >
                            Thủ công
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bảng vật tư */}
                  <div className="ui-table-wrap" style={{ marginTop: 14 }}>
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: 160 }}>Tên vật tư</th>
                          <th style={{ minWidth: 90 }}>Mã</th>
                          <th style={{ minWidth: 60 }}>ĐVT</th>
                          <th style={{ minWidth: 70 }} className="text-right">SL yêu cầu</th>
                          <th style={{ minWidth: 70 }} className="text-right">SL xuất</th>
                          <th style={{ minWidth: 200 }}>Gợi ý lô</th>
                          <th style={{ width: 100 }} className="text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingPreview ? (
                          <tr>
                            <td colSpan={7} className="ui-empty">Đang tải...</td>
                          </tr>
                        ) : previewLines.length ? (
                          previewLines.map((ln) => {
                            const need = toNumber(ln.qtyToIssue ?? ln.qtyRequested);
                            const status = manualStatusForLine(ln.materialId);
                            return (
                              <tr key={ln.materialId}>
                                <td data-label="Tên vật tư">
                                  <div className="issue-cell-main">{ln.name}</div>
                                  <div className="issue-cell-sub">{ln.spec}</div>
                                </td>
                                <td data-label="Mã" className="issue-mono">{ln.code}</td>
                                <td data-label="ĐVT">{ln.unitName || "-"}</td>
                                <td data-label="SL yêu cầu" className="text-right issue-mono">{qtyFmt.format(toNumber(ln.qtyRequested))}</td>
                                <td data-label="SL xuất" className="text-right issue-mono">{qtyFmt.format(need)}</td>
                                <td data-label="Gợi ý lô" className="issue-muted">
                                  {Array.isArray(ln.lots) && ln.lots.length ? (
                                    <div className="issue-lot-list">
                                      {ln.lots.slice(0, 3).map((l, i) => (
                                        <div className="issue-lot-item" key={i}>
                                          <span className="ui-status-badge is-info" style={{ borderRadius: '999px' }}>{l.lotNumber}</span>
                                          <span className="issue-lot-meta">
                                            HSD: {fmtDate(l.expDate)} | {qtyFmt.format(toNumber(l.availableStock))} → <b>{qtyFmt.format(toNumber(l.qtyOut))}</b>
                                          </span>
                                        </div>
                                      ))}
                                      {ln.lots.length > 3 ? (
                                        <div className="issue-muted issue-mini">+{ln.lots.length - 3} lô khác</div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="issue-mini">Không có gợi ý</span>
                                  )}
                                </td>
                                <td className="text-right">
                                  {!autoAllocate ? (
                                    <button
                                      className={`ui-btn ui-btn-sm ${status.ok ? "ui-btn-secondary" : "ui-btn-primary"}`}
                                      type="button"
                                      onClick={() => openModalForLine(ln)}
                                    >
                                      {status.ok ? "Sửa lô" : "Chọn lô"}
                                    </button>
                                  ) : (
                                    <span className="ui-stock-badge is-ok">Tự động</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="ui-empty">Chưa có dữ liệu.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {createMsg.text ? (
                    <div className={`ui-alert ${createMsg.type === "error" ? "is-error" : "is-success"}`} style={{ marginTop: 12 }}>
                      {createMsg.text}
                    </div>
                  ) : null}

                  {/* Chi tiết phiếu sau khi tạo */}
                  {createdIssueId ? (
                    <div className="ui-card" style={{ marginTop: 14 }}>
                      <div className="issue-detail-head">
                        <h3 className="issue-detail-title">Chi tiết phiếu xuất</h3>
                        <div className="issue-inline-actions">
                          <button
                            className="ui-btn ui-btn-secondary ui-btn-sm"
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
                          <div className="issue-detail-grid">
                            <div className="issue-request-item">
                              <div className="issue-request-label">Mã phiếu xuất</div>
                              <div className="issue-request-value issue-mono">#{issueDetail?.header?.id}</div>
                            </div>
                            <div className="issue-request-item">
                              <div className="issue-request-label">Ngày xuất</div>
                              <div className="issue-request-value issue-mono">{fmtDate(issueDetail?.header?.issueDate)}</div>
                            </div>
                            <div className="issue-request-item">
                              <div className="issue-request-label">Người nhận</div>
                              <div className="issue-request-value">{cleanReceiverName(issueDetail?.header?.receiverName) || "-"}</div>
                            </div>
                            <div className="issue-request-item">
                              <div className="issue-request-label">Tổng tiền</div>
                              <div className="issue-request-value issue-mono">{moneyFmt.format(toNumber(issueDetail?.header?.totalAmount))}</div>
                            </div>
                          </div>
                          <div className="ui-table-wrap">
                            <table className="ui-table issue-table-sm">
                              <thead>
                                <tr>
                                  <th>Tên vật tư</th>
                                  <th style={{ minWidth: 90 }}>Mã</th>
                                  <th style={{ minWidth: 60 }}>ĐVT</th>
                                  <th className="text-right" style={{ minWidth: 80 }}>SL xuất</th>
                                  <th className="text-right" style={{ minWidth: 100 }}>Đơn giá</th>
                                  <th className="text-right" style={{ minWidth: 100 }}>Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(issueDetail?.details || []).map((d) => (
                                  <tr key={d.id}>
                                    <td data-label="Tên vật tư">{d.name}</td>
                                    <td data-label="Mã" className="issue-mono">{d.code}</td>
                                    <td data-label="ĐVT">{d.unitName || "-"}</td>
                                    <td data-label="SL xuất" className="text-right issue-mono">{qtyFmt.format(toNumber(d.qtyIssued))}</td>
                                    <td data-label="Đơn giá" className="text-right issue-mono">{moneyFmt.format(toNumber(d.unitPrice))}</td>
                                    <td data-label="Thành tiền" className="text-right issue-mono">{moneyFmt.format(toNumber(d.total))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div className="ui-alert is-warning">Chưa có dữ liệu chi tiết.</div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Footer actions */}
                <div className="ui-modal-footer">
                  <button
                    className="ui-btn ui-btn-secondary ui-btn-sm"
                    type="button"
                    onClick={closeDrawer}
                    disabled={creating}
                  >
                    Bỏ chọn
                  </button>
                  <button
                    className="ui-btn ui-btn-primary ui-btn-sm"
                    type="button"
                    onClick={createIssue}
                    disabled={creating || !canCreateIssue}
                    title={!canCreateIssue ? "Phiếu chưa đủ điều kiện" : ""}
                  >
                    {creating ? "Đang tạo phiếu..." : "Tạo phiếu xuất kho"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* MODAL CHỌN LÔ */}
      {modalOpen && modalLine
        ? createPortal(
            <div className="ui-modal-overlay" onMouseDown={closeModal}>
              <div
                className="ui-modal"
                style={{ width: "min(920px, 100%)" }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="ui-modal-header">
                  <div>
                    <h3>Chọn lô (thủ công)</h3>
                    <p>{modalLine.code} - {modalLine.name}</p>
                  </div>
                </div>

                {modalError ? <div className="ui-alert is-error">{modalError}</div> : null}

                <div className="issue-modal-tools">
                  <div className="issue-mini issue-muted">
                    SL cần xuất:{" "}
                    <b className="issue-mono">{qtyFmt.format(toNumber(modalLine.qtyToIssue ?? modalLine.qtyRequested))}</b>
                    {"  "} | Đã chọn: <b className="issue-mono">{qtyFmt.format(sumLotDraft(modalDraft))}</b>
                  </div>
                  <div className="issue-modal-buttons">
                    <button className="ui-btn ui-btn-secondary ui-btn-sm" type="button" onClick={fillFEFOSuggestion}>
                      Tự điền theo gợi ý
                    </button>
                    <button
                      className="ui-btn ui-btn-secondary ui-btn-sm"
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

                <div className="ui-table-wrap issue-modal-table">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 110 }}>Số lô</th>
                        <th style={{ minWidth: 110 }}>Hạn dùng</th>
                        <th style={{ minWidth: 100 }} className="text-right">Tồn còn lại</th>
                        <th style={{ minWidth: 120 }} className="text-right">Số lượng xuất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalLoading ? (
                        <tr>
                          <td colSpan={4} className="ui-empty">
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
                              <td data-label="Số lô" className="issue-mono">{lot}</td>
                              <td data-label="Hạn dùng" className="issue-mono">{fmtDate(l?.expDate)}</td>
                              <td data-label="Tồn còn lại" className="text-right issue-mono">{qtyFmt.format(avail)}</td>
                              <td data-label="SL xuất" className="text-right">
                                <input
                                  className="ui-input issue-number-input"
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
                          <td colSpan={4} className="ui-empty">
                            Không có lô còn tồn.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="ui-modal-footer">
                  <button className="ui-btn ui-btn-primary ui-btn-sm" type="button" onClick={saveModalAllocation}>
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
