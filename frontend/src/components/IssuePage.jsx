import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import './IssuePage.css';

const API_URL = 'http://localhost:8080/api';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const msg = data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function toLocalDateTimeString(datetimeLocal) {
  // input: "YYYY-MM-DDTHH:mm"
  if (!datetimeLocal) return null;
  return datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal;
}

function sumObjectValues(obj) {
  return Object.values(obj || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
}

// ---------- Notifications ----------
function useNotifications(currentUser) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const seenRef = useRef(new Set());

  const load = async () => {
    if (!currentUser?.id) return;
    try {
      const page = await fetchJson(
        `${API_URL}/notifications/my?unreadOnly=false&page=0&size=20`,
        { headers: { 'X-User-Id': currentUser.id.toString() } }
      );

      const list = Array.isArray(page?.content) ? page.content : [];
      let newCount = 0;
      for (const n of list) {
        if (n?.id != null && !seenRef.current.has(n.id)) {
          seenRef.current.add(n.id);
          newCount++;
        }
      }
      if (newCount > 0) toast.success(`Bạn có ${newCount} thông báo mới`);

      setRows(list);
      setUnread(list.filter(x => x && x.isRead === false).length);
    } catch (_) {}
  };

  const markRead = async (id) => {
    if (!currentUser?.id) return;
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'X-User-Id': currentUser.id.toString() }
      });
      await load();
    } catch (_) {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  return { open, setOpen, rows, unread, reload: load, markRead };
}

export default function IssuePage() {
  const [activeTab, setActiveTab] = useState('create');
  const [isLoading, setIsLoading] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [issues, setIssues] = useState([]);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({
    receiverName: '',
    departmentId: null,
    issueDate: new Date().toISOString().split('T')[0],
    issueReqHeaderId: null
  });

  const [issueDetails, setIssueDetails] = useState([]);

  // schedule pickup
  const [schedule, setSchedule] = useState({
    scheduledAt: '',
    location: 'Kho chính',
    note: ''
  });

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const notif = useNotifications(currentUser);

  useEffect(() => {
    if (currentUser.roleCheck === 2) fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [requestsData, issuesData] = await Promise.all([
        fetchJson(`${API_URL}/issues/approved-requests`, { headers: { 'X-User-Id': currentUser.id.toString() } }),
        fetchJson(`${API_URL}/issues/today`, { headers: { 'X-User-Id': currentUser.id.toString() } })
      ]);

      setApprovedRequests(requestsData || []);
      setIssues(issuesData || []);
    } catch (error) {
      toast.error('Lỗi kết nối server: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const computeAutoAlloc = (lotStocks, qty) => {
    let remaining = parseFloat(qty) || 0;
    const selected = [];

    for (const lot of (lotStocks || [])) {
      if (remaining <= 0) break;
      const avail = parseFloat(lot.availableQty) || 0;
      if (avail <= 0) continue;

      const take = Math.min(remaining, avail);
      selected.push({
        lotNumber: lot.lotNumber,
        allocatedQty: take,
        expDate: lot.expDate
      });
      remaining -= take;
    }

    return selected;
  };

  const selectRequest = async (request) => {
    setSelectedRequest(request);
    setFormData({
      receiverName: request.createdByName || '',
      departmentId: null,
      issueDate: new Date().toISOString().split('T')[0],
      issueReqHeaderId: request.id
    });

    setSchedule({ scheduledAt: '', location: 'Kho chính', note: '' });

    const detailsWithStock = [];

    for (const detail of request.details) {
      try {
        const checkData = await fetchJson(
          `${API_URL}/issues/check-stock?materialId=${detail.materialId}&quantity=${detail.qtyRequested}`
        );

        const lotStocks = checkData?.lotStocks || [];
        const qtyIssued = detail.qtyRequested;
        const selectedLots = computeAutoAlloc(lotStocks, qtyIssued);

        detailsWithStock.push({
          ...detail,
          qtyIssued,
          availableStock: checkData.availableStock || 0,
          sufficient: !!checkData.sufficient,
          lotStocks,
          lotMode: 'AUTO',           // AUTO | MANUAL
          selectedLots,
          manualAllocMap: {}         // { lotNumber: qty }
        });
      } catch (_) {
        detailsWithStock.push({
          ...detail,
          qtyIssued: detail.qtyRequested,
          availableStock: 0,
          sufficient: false,
          lotStocks: [],
          lotMode: 'AUTO',
          selectedLots: [],
          manualAllocMap: {}
        });
      }
    }

    setIssueDetails(detailsWithStock);
  };

  const updateQtyIssued = (materialId, qty) => {
    setIssueDetails(list =>
      list.map(d => {
        if (d.materialId !== materialId) return d;

        const maxAllowed = Math.min(
          parseFloat(d.qtyRequested) || 0,
          parseFloat(d.availableStock) || 0
        );
        const newQty = Math.max(0, Math.min(parseFloat(qty) || 0, maxAllowed));

        if (d.lotMode === 'AUTO') {
          const selectedLots = computeAutoAlloc(d.lotStocks, newQty);
          return { ...d, qtyIssued: newQty, selectedLots };
        }

        // MANUAL: chỉ cập nhật qtyIssued, allocations giữ nguyên (validate khi submit)
        return { ...d, qtyIssued: newQty };
      })
    );
  };

  const setLotMode = (materialId, mode) => {
    setIssueDetails(list =>
      list.map(d => {
        if (d.materialId !== materialId) return d;

        if (mode === 'MANUAL') {
          // init manualAllocMap từ auto allocation hiện tại để user sửa nhanh
          const map = {};
          for (const a of (d.selectedLots || [])) {
            map[a.lotNumber] = a.allocatedQty;
          }
          return { ...d, lotMode: 'MANUAL', manualAllocMap: map };
        }

        // back to AUTO
        const selectedLots = computeAutoAlloc(d.lotStocks, d.qtyIssued);
        return { ...d, lotMode: 'AUTO', selectedLots, manualAllocMap: {} };
      })
    );
  };

  const updateManualAlloc = (materialId, lotNumber, value) => {
    setIssueDetails(list =>
      list.map(d => {
        if (d.materialId !== materialId) return d;
        const next = { ...(d.manualAllocMap || {}) };
        const v = parseFloat(value);
        next[lotNumber] = isNaN(v) ? 0 : Math.max(0, v);
        return { ...d, manualAllocMap: next };
      })
    );
  };

  const fillManualByFEFO = (materialId) => {
    setIssueDetails(list =>
      list.map(d => {
        if (d.materialId !== materialId) return d;
        const selectedLots = computeAutoAlloc(d.lotStocks, d.qtyIssued);
        const map = {};
        for (const a of selectedLots) map[a.lotNumber] = a.allocatedQty;
        return { ...d, manualAllocMap: map };
      })
    );
  };

  const validateForm = () => {
    if (!selectedRequest) {
      toast.error('Vui lòng chọn phiếu xin lĩnh đã duyệt');
      return false;
    }
    if (!formData.receiverName.trim()) {
      toast.error('Vui lòng nhập tên người nhận');
      return false;
    }

    for (const d of issueDetails) {
      if (!d.sufficient) {
        toast.error(`Không đủ tồn kho cho ${d.materialName}`);
        return false;
      }

      const qtyIssued = parseFloat(d.qtyIssued) || 0;
      if (qtyIssued <= 0) {
        toast.error(`Số lượng xuất phải lớn hơn 0 cho ${d.materialName}`);
        return false;
      }

      if (qtyIssued > (parseFloat(d.qtyRequested) || 0)) {
        toast.error(`SL xuất không được vượt SL yêu cầu (${d.qtyRequested}) cho ${d.materialName}`);
        return false;
      }

      if (qtyIssued > (parseFloat(d.availableStock) || 0)) {
        toast.error(`SL xuất vượt tồn kho cho ${d.materialName}`);
        return false;
      }

      if (d.lotMode === 'MANUAL') {
        const sum = sumObjectValues(d.manualAllocMap);
        if (Math.abs(sum - qtyIssued) > 1e-6) {
          toast.error(`Manual lot: Tổng phân bổ (${sum}) phải bằng SL xuất (${qtyIssued}) cho ${d.materialName}`);
          return false;
        }

        // per-lot validation
        for (const [lotNumber, q] of Object.entries(d.manualAllocMap || {})) {
          const qty = parseFloat(q) || 0;
          if (qty <= 0) continue;
          const lot = (d.lotStocks || []).find(x => x.lotNumber === lotNumber);
          const avail = parseFloat(lot?.availableQty) || 0;
          if (qty > avail + 1e-6) {
            toast.error(`Lô ${lotNumber} của ${d.materialName} chỉ còn ${avail}`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!currentUser.id || currentUser.roleCheck !== 2) {
      toast.error('Chỉ thủ kho được xuất kho');
      return;
    }

    setIsLoading(true);
    try {
      // IMPORTANT: flatten details when MANUAL (multi-lot)
      const detailsPayload = [];
      for (const d of issueDetails) {
        if (d.lotMode === 'MANUAL') {
          for (const [lotNumber, q] of Object.entries(d.manualAllocMap || {})) {
            const qty = parseFloat(q) || 0;
            if (qty <= 0) continue;
            detailsPayload.push({
              materialId: d.materialId,
              qtyRequested: qty,
              unitPrice: 0,
              lotNumber
            });
          }
        } else {
          detailsPayload.push({
            materialId: d.materialId,
            qtyRequested: parseFloat(d.qtyIssued) || 0,
            unitPrice: 0
            // no lotNumber => backend auto FEFO
          });
        }
      }

      const requestData = {
        receiverName: formData.receiverName,
        departmentId: formData.departmentId,
        issueDate: formData.issueDate,
        issueReqHeaderId: formData.issueReqHeaderId,
        details: detailsPayload
      };

      const data = await fetchJson(`${API_URL}/issues/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify(requestData)
      });

      if (data?.success === false) {
        toast.error(data?.message || 'Lỗi khi xuất kho');
        return;
      }

      toast.success('Xuất kho thành công!');

      if (data.allocations && data.allocations.length > 0) {
        const allocationMsg = data.allocations
          .map(a => `${a.materialName}: ${a.allocatedQty} từ lô ${a.lotNumber}`)
          .join('\n');
        toast.success(`Phân bổ:\n${allocationMsg}`, { duration: 5000 });
      }

      setSelectedRequest(null);
      setFormData({
        receiverName: '',
        departmentId: null,
        issueDate: new Date().toISOString().split('T')[0],
        issueReqHeaderId: null
      });
      setIssueDetails([]);
      setSchedule({ scheduledAt: '', location: 'Kho chính', note: '' });

      await fetchInitialData();
      await notif.reload();
      setActiveTab('history');

    } catch (error) {
      toast.error('Lỗi kết nối server: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitSchedulePickup = async () => {
    if (!selectedRequest?.id) {
      toast.error('Chưa chọn phiếu xin lĩnh');
      return;
    }
    if (!schedule.scheduledAt) {
      toast.error('Vui lòng chọn thời gian hẹn');
      return;
    }

    try {
      const payload = {
        scheduledAt: toLocalDateTimeString(schedule.scheduledAt),
        location: schedule.location || 'Kho chính',
        note: schedule.note || '',
        schedulerUserId: currentUser.id
      };

      await fetchJson(`${API_URL}/notifications/schedule-pickup?issueReqId=${selectedRequest.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify(payload)
      });

      toast.success('Đã tạo lịch hẹn nhận hàng');
      await notif.reload();
    } catch (e) {
      toast.error('Không tạo được lịch hẹn: ' + e.message);
    }
  };

  // close notif when click outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest('.notif-wrap')) notif.setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (currentUser.roleCheck !== 2) {
    return (
      <div className="issue-container">
        <div className="access-denied">
          <h2>Truy cập bị từ chối</h2>
          <p>Chỉ thủ kho được sử dụng tính năng xuất kho.</p>
          <p>Role của bạn: {currentUser.roleName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="issue-container">
      <div className="issue-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Quản lý xuất kho</h1>

          {/* Notifications */}
          <div className="notif-wrap" style={{ position: 'relative' }}>
            <button
              className="notif-bell"
              onClick={(e) => { e.stopPropagation(); notif.setOpen(!notif.open); }}
              title="Thông báo"
            >
              🔔
              {notif.unread > 0 && <span className="notif-badge">{notif.unread}</span>}
            </button>

            {notif.open && (
              <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
                <div className="notif-title">
                  <strong>Thông báo</strong>
                  <button className="notif-refresh" onClick={notif.reload}>Tải lại</button>
                </div>
                <div className="notif-list">
                  {notif.rows.length === 0 ? (
                    <div className="notif-empty">Chưa có thông báo</div>
                  ) : notif.rows.slice(0, 10).map(n => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.isRead ? '' : 'unread'}`}
                      onClick={() => notif.markRead(n.id)}
                      title="Bấm để đánh dấu đã đọc"
                    >
                      <div className="notif-item-title">{n.title || 'Thông báo'}</div>
                      <div className="notif-item-content">{n.content || ''}</div>
                      <div className="notif-item-time">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN') : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="issue-tabs">
          <button className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
            Xuất kho
          </button>
          <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            Lịch sử xuất ({issues.length})
          </button>
        </div>
      </div>

      <div className="issue-content">
        {activeTab === 'create' ? (
          <div className="create-issue">
            <div className="form-section">
              <h3>Chọn phiếu xin lĩnh đã duyệt (Đủ hàng)</h3>
              {selectedRequest ? (
                <div className="selected-request">
                  <div className="request-info">
                    <h4>Phiếu #{selectedRequest.id} - {selectedRequest.createdByName}</h4>
                    <p><strong>Đơn vị:</strong> {selectedRequest.departmentName}</p>
                    <p><strong>Ngày yêu cầu:</strong> {new Date(selectedRequest.requestedAt).toLocaleDateString('vi-VN')}</p>
                    <p><strong>Số loại vật tư:</strong> {selectedRequest.details?.length || 0}</p>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn-change" onClick={() => { setSelectedRequest(null); setIssueDetails([]); }}>
                        Chọn lại
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="requests-list">
                  {isLoading ? (
                    <div className="loading">Đang tải danh sách...</div>
                  ) : approvedRequests.length === 0 ? (
                    <div className="empty-state">
                      <h4>Không có phiếu nào đã duyệt và đủ hàng chờ xuất</h4>
                      <p>Vui lòng đợi lãnh đạo phê duyệt phiếu xin lĩnh và đảm bảo có đủ tồn kho</p>
                    </div>
                  ) : (
                    approvedRequests.map(request => (
                      <div key={request.id} className="request-card" onClick={() => selectRequest(request)}>
                        <div className="request-info">
                          <h4>Phiếu #{request.id}</h4>
                          <p><strong>Người gửi:</strong> {request.createdByName}</p>
                          <p><strong>Đơn vị:</strong> {request.departmentName}</p>
                          <p><strong>Số vật tư:</strong> {request.details?.length || 0} loại</p>
                          <p><strong>Trạng thái:</strong><span className="text-success"> Đủ hàng</span></p>
                        </div>
                        <div className="request-action">
                          <button className="btn-select">Chọn xuất</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedRequest && (
              <>
                <div className="form-section">
                  <h3>Thông tin xuất kho</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Người nhận *</label>
                      <input
                        type="text"
                        value={formData.receiverName ?? ''}
                        onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                        placeholder="Nhập tên người nhận"
                      />
                    </div>
                    <div className="form-group">
                      <label>Ngày xuất</label>
                      <input
                        type="date"
                        value={formData.issueDate ?? ''}
                        onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Schedule pickup */}
                <div className="form-section">
                  <h3>Lịch hẹn nhận hàng (tùy chọn)</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Thời gian hẹn *</label>
                      <input
                        type="datetime-local"
                        value={schedule.scheduledAt ?? ''}
                        onChange={(e) => setSchedule({ ...schedule, scheduledAt: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Địa điểm</label>
                      <input
                        type="text"
                        value={schedule.location ?? ''}
                        onChange={(e) => setSchedule({ ...schedule, location: e.target.value })}
                        placeholder="Kho chính"
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Ghi chú</label>
                      <input
                        type="text"
                        value={schedule.note ?? ''}
                        onChange={(e) => setSchedule({ ...schedule, note: e.target.value })}
                        placeholder="VD: mang theo giấy tờ..."
                      />
                    </div>
                  </div>

                  <button className="btn-submit" onClick={submitSchedulePickup} disabled={isLoading}>
                    Tạo lịch hẹn cho cán bộ
                  </button>
                </div>

                {/* Details */}
                <div className="form-section">
                  <div className="section-header">
                    <h3>Chi tiết xuất kho (AUTO FEFO / MANUAL theo lô)</h3>
                    <div className="fefo-note">
                      <span className="badge-info">Mặc định: AUTO FEFO. Nếu chọn MANUAL, bạn nhập SL theo từng lô.</span>
                    </div>
                  </div>

                  <div className="issue-details">
                    <table>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Tên vật tư</th>
                          <th>Đơn vị</th>
                          <th>SL yêu cầu</th>
                          <th>Tồn kho</th>
                          <th>SL xuất</th>
                          <th>Lô phân bổ / Chọn lô</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>

                      <tbody>
                        {issueDetails.map((d, index) => {
                          const manualSum = sumObjectValues(d.manualAllocMap);
                          const qtyIssued = parseFloat(d.qtyIssued) || 0;

                          return (
                            <tr key={d.materialId}>
                              <td className="text-center">{index + 1}</td>

                              <td>
                                <div>
                                  <div><strong>{d.materialName}</strong></div>
                                  <div className="text-muted">{d.materialCode}</div>
                                </div>
                              </td>

                              <td>{d.unitName}</td>

                              <td className="text-center">
                                <span className="qty-requested">{d.qtyRequested}</span>
                              </td>

                              <td className="text-center">
                                <span className={`stock-badge ${d.sufficient ? 'sufficient' : 'insufficient'}`}>
                                  {d.availableStock}
                                </span>
                              </td>

                              <td>
                                <input
                                  type="number"
                                  value={d.qtyIssued ?? ''}
                                  onChange={(e) => updateQtyIssued(d.materialId, e.target.value)}
                                  min="0"
                                  max={Math.min(parseFloat(d.qtyRequested) || 0, parseFloat(d.availableStock) || 0)}
                                  step="0.001"
                                  disabled={!d.sufficient}
                                />
                              </td>

                              <td>
                                <div className="lot-mode-toggle">
                                  <button
                                    className={`lot-mode-btn ${d.lotMode === 'AUTO' ? 'active' : ''}`}
                                    onClick={() => setLotMode(d.materialId, 'AUTO')}
                                    type="button"
                                  >
                                    AUTO FEFO
                                  </button>
                                  <button
                                    className={`lot-mode-btn ${d.lotMode === 'MANUAL' ? 'active' : ''}`}
                                    onClick={() => setLotMode(d.materialId, 'MANUAL')}
                                    type="button"
                                  >
                                    MANUAL
                                  </button>
                                </div>

                                {d.lotMode === 'AUTO' ? (
                                  d.selectedLots && d.selectedLots.length > 0 ? (
                                    <div className="lot-allocation">
                                      {d.selectedLots.map((lot, idx2) => (
                                      <div key={`${d.materialId}-${lot.lotNumber ?? 'LOT'}-${idx2}`} className="lot-item">
                                          <span className="lot-number">Lô {lot.lotNumber}</span>
                                          <span className="lot-qty">{lot.allocatedQty}</span>
                                          <span className="lot-exp">
                                            {lot.expDate ? new Date(lot.expDate).toLocaleDateString('vi-VN') : 'Không HSD'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted">Chưa phân bổ</span>
                                  )
                                ) : (
                                  <div className="manual-lot-box">
                                    <div className="manual-lot-head">
                                      <span>Chọn lô + nhập SL</span>
                                      <button
                                        type="button"
                                        className="manual-fill"
                                        onClick={() => fillManualByFEFO(d.materialId)}
                                        title="Gợi ý phân bổ theo FEFO cho nhanh"
                                      >
                                        Gợi ý FEFO
                                      </button>
                                    </div>

                                    {(d.lotStocks || []).length === 0 ? (
                                      <div className="text-muted">Không có dữ liệu lô</div>
                                    ) : (
                                      <div className="manual-lot-list">
                                        {d.lotStocks.map((lot, i3) => (
                                          <div key={`${d.materialId}-${lot.lotNumber ?? i3}`} className="manual-lot-row">
                                            <div className="manual-lot-left">
                                              <div><strong>Lô {lot.lotNumber}</strong></div>
                                              <div className="text-muted">
                                                HSD: {lot.expDate ? new Date(lot.expDate).toLocaleDateString('vi-VN') : 'Không'}
                                                {' '}| Tồn: {lot.availableQty}
                                              </div>
                                            </div>

                                            <div className="manual-lot-right">
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.001"
                                                max={parseFloat(lot.availableQty) || 0}
                                                value={d.manualAllocMap?.[lot.lotNumber] ?? 0}
                                                onChange={(e) => updateManualAlloc(d.materialId, lot.lotNumber, e.target.value)}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="manual-lot-foot">
                                      <span>Tổng phân bổ:</span>
                                      <strong className={Math.abs(manualSum - qtyIssued) <= 1e-6 ? 'ok' : 'bad'}>
                                        {manualSum}
                                      </strong>
                                      <span style={{ marginLeft: 8 }}>(phải bằng SL xuất: {qtyIssued})</span>
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td>
                                {d.sufficient ? (
                                  <span className="text-success">
                                    <span className="status-dot green"></span>
                                    Đủ hàng
                                  </span>
                                ) : (
                                  <span className="text-danger">
                                    <span className="status-dot red"></span>
                                    Thiếu hàng
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="summary-section">
                  <button
                    className="btn-submit"
                    onClick={handleSubmit}
                    disabled={isLoading || issueDetails.some(d => !d.sufficient)}
                  >
                    {isLoading ? 'Đang xử lý...' : 'Xác nhận xuất kho'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="issue-history">
            {isLoading ? (
              <div className="loading">Đang tải dữ liệu...</div>
            ) : issues.length === 0 ? (
              <div className="empty-state">
                <h3>Chưa có phiếu xuất nào</h3>
                <p>Hãy tạo phiếu xuất đầu tiên bằng cách chuyển sang tab "Xuất kho"</p>
              </div>
            ) : (
              <div className="issues-list">
                {issues.map(issue => (
                  <div key={issue.id} className="issue-card">
                    <div className="issue-header">
                      <div className="issue-info">
                        <h3>Phiếu xuất #{issue.id}</h3>
                        <p><strong>Người nhận:</strong> {issue.receiverName}</p>
                        <p><strong>Ngày xuất:</strong> {new Date(issue.issueDate).toLocaleDateString('vi-VN')}</p>
                        <p><strong>Tổng tiền:</strong> {issue.totalAmount?.toLocaleString('vi-VN')} đ</p>
                        <p><strong>Người xuất:</strong> {issue.createdByName}</p>
                      </div>
                      <div className="issue-actions">
                        <button className="btn-view" onClick={() => toast.success('Chi tiết phiếu xuất #' + issue.id)}>
                          Xem chi tiết
                        </button>
                      </div>
                    </div>
                    {issue.issueReqHeaderId && (
                      <div className="issue-ref">
                        <strong>Từ phiếu xin lĩnh:</strong> #{issue.issueReqHeaderId}
                      </div>
                    )}
                    {issue.details && (
                      <div className="issue-items-summary">
                        <strong>Số loại vật tư:</strong> {issue.details.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
