import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import './IssuePage.css';

const API_URL = 'http://localhost:8080/api';

export default function IssuePage() {
  const [activeTab, setActiveTab] = useState('create');
  const [isLoading, setIsLoading] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [issues, setIssues] = useState([]);
  const [inventoryData, setInventoryData] = useState({});
  
  // Form data
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({
    receiverName: '',
    departmentId: null,
    issueDate: new Date().toISOString().split('T')[0]
  });
  
  const [issueDetails, setIssueDetails] = useState([]);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  // Fetch dữ liệu ban đầu
  useEffect(() => {
    if (currentUser.roleCheck === 2) {
      fetchInitialData();
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [requestsRes, issuesRes] = await Promise.all([
        fetch(`${API_URL}/issues/approved-requests`, {
          headers: { 'X-User-Id': currentUser.id.toString() }
        }),
        fetch(`${API_URL}/issues/my-issues`, {
          headers: { 'X-User-Id': currentUser.id.toString() }
        })
      ]);

      const requestsData = await requestsRes.json();
      const issuesData = await issuesRes.json();

      if (requestsData.success) {
        setApprovedRequests(requestsData.data || []);
      }

      if (issuesData.success) {
        setIssues(issuesData.data || []);
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  // Chọn phiếu xin lĩnh đã duyệt
  const selectRequest = async (request) => {
    setSelectedRequest(request);
    setFormData({
      receiverName: request.createdByName || '',
      departmentId: request.departmentId,
      issueDate: new Date().toISOString().split('T')[0]
    });

    // Load tồn kho cho từng vật tư
    const detailsWithStock = await Promise.all(
      request.details.map(async (detail) => {
        try {
          const stockRes = await fetch(`${API_URL}/inventory/stock/${detail.materialId}`);
          const stockData = await stockRes.json();
          
          return {
            ...detail,
            qtyIssued: detail.qtyRequested,
            availableStock: stockData.totalStock || 0,
            lotStocks: stockData.lotStocks || []
          };
        } catch (error) {
          return {
            ...detail,
            qtyIssued: detail.qtyRequested,
            availableStock: 0,
            lotStocks: []
          };
        }
      })
    );

    setIssueDetails(detailsWithStock);
  };

  // Cập nhật số lượng xuất
  const updateQtyIssued = (materialId, qtyIssued) => {
    setIssueDetails(details => 
      details.map(detail => 
        detail.materialId === materialId 
          ? { ...detail, qtyIssued: Math.min(qtyIssued, detail.qtyRequested) }
          : detail
      )
    );
  };

  // Chọn lô xuất
  const selectLot = (materialId, lotStock) => {
    setIssueDetails(details =>
      details.map(detail =>
        detail.materialId === materialId
          ? { 
              ...detail, 
              selectedLot: lotStock,
              qtyIssued: Math.min(detail.qtyIssued, lotStock.availableStock)
            }
          : detail
      )
    );
  };

  // Tính tổng tiền
  const calculateTotal = () => {
    return issueDetails.reduce((sum, detail) => {
      // Giá tạm thời, backend sẽ tính chính xác
      const price = 100000; // Giả định
      return sum + (price * (detail.qtyIssued || 0));
    }, 0);
  };

  // Validate form
  const validateForm = () => {
    if (!selectedRequest) {
      toast.error('Vui lòng chọn phiếu xin lĩnh đã duyệt');
      return false;
    }

    if (!formData.receiverName.trim()) {
      toast.error('Vui lòng nhập tên người nhận');
      return false;
    }

    for (const detail of issueDetails) {
      if (!detail.qtyIssued || detail.qtyIssued <= 0) {
        toast.error(`Số lượng xuất phải lớn hơn 0 cho ${detail.materialName}`);
        return false;
      }

      if (detail.qtyIssued > detail.qtyRequested) {
        toast.error(`Số lượng xuất không được vượt quá số lượng yêu cầu (${detail.qtyRequested})`);
        return false;
      }

      if (detail.selectedLot && detail.qtyIssued > detail.selectedLot.availableStock) {
        toast.error(`Số lượng xuất vượt quá tồn kho của lô (còn ${detail.selectedLot.availableStock})`);
        return false;
      }

      if (!detail.selectedLot && detail.availableStock < detail.qtyIssued) {
        toast.error(`Không đủ tồn kho cho ${detail.materialName} (còn ${detail.availableStock})`);
        return false;
      }
    }

    return true;
  };

  // Submit phiếu xuất
  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!currentUser.id || currentUser.roleCheck !== 2) {
      toast.error('Chỉ thủ kho được xuất kho');
      return;
    }

    setIsLoading(true);
    try {
      const requestData = {
        issueReqId: selectedRequest.id,
        receiverName: formData.receiverName,
        departmentId: formData.departmentId,
        issueDate: formData.issueDate,
        details: issueDetails.map(detail => ({
          materialId: detail.materialId,
          inventoryCardId: detail.selectedLot?.inventoryCardId || null,
          qtyIssued: detail.qtyIssued
        }))
      };

      const response = await fetch(`${API_URL}/issues/create-from-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Xuất kho thành công');
        // Reset form
        setSelectedRequest(null);
        setFormData({
          receiverName: '',
          departmentId: null,
          issueDate: new Date().toISOString().split('T')[0]
        });
        setIssueDetails([]);
        
        // Refresh danh sách
        fetchInitialData();
        setActiveTab('history');
      } else {
        toast.error(data.message || 'Lỗi khi xuất kho');
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  // Kiểm tra quyền truy cập
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
      {/* Header */}
      <div className="issue-header">
        <h1>Quản lý xuất kho</h1>
        <div className="issue-tabs">
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Xuất kho
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Lịch sử xuất ({issues.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="issue-content">
        {activeTab === 'create' ? (
          <div className="create-issue">
            {/* Chọn phiếu xin lĩnh đã duyệt */}
            <div className="form-section">
              <h3>Chọn phiếu xin lĩnh đã duyệt</h3>
              {selectedRequest ? (
                <div className="selected-request">
                  <div className="request-info">
                    <h4>Phiếu #{selectedRequest.id} - {selectedRequest.createdByName}</h4>
                    <p><strong>Đơn vị:</strong> {selectedRequest.departmentName}</p>
                    <p><strong>Ngày yêu cầu:</strong> {new Date(selectedRequest.requestedAt).toLocaleDateString('vi-VN')}</p>
                    <button 
                      className="btn-change"
                      onClick={() => {
                        setSelectedRequest(null);
                        setIssueDetails([]);
                      }}
                    >
                      Chọn lại
                    </button>
                  </div>
                </div>
              ) : (
                <div className="requests-list">
                  {isLoading ? (
                    <div className="loading">Đang tải danh sách...</div>
                  ) : approvedRequests.length === 0 ? (
                    <div className="empty-state">
                      <h4>Không có phiếu nào đã duyệt chờ xuất</h4>
                      <p>Vui lòng đợi lãnh đạo phê duyệt phiếu xin lĩnh</p>
                    </div>
                  ) : (
                    approvedRequests.map(request => (
                      <div key={request.id} className="request-card" onClick={() => selectRequest(request)}>
                        <div className="request-info">
                          <h4>Phiếu #{request.id}</h4>
                          <p><strong>Người gửi:</strong> {request.createdByName}</p>
                          <p><strong>Đơn vị:</strong> {request.departmentName}</p>
                          <p><strong>Số vật tư:</strong> {request.details?.length || 0} loại</p>
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

            {/* Thông tin xuất kho */}
            {selectedRequest && (
              <>
                <div className="form-section">
                  <h3>Thông tin xuất kho</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Người nhận *</label>
                      <input
                        type="text"
                        value={formData.receiverName}
                        onChange={(e) => setFormData({...formData, receiverName: e.target.value})}
                        placeholder="Nhập tên người nhận"
                      />
                    </div>
                    <div className="form-group">
                      <label>Ngày xuất</label>
                      <input
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Chi tiết xuất kho */}
                <div className="form-section">
                  <h3>Chi tiết xuất kho</h3>
                  <div className="issue-details">
                    <table>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Tên vật tư</th>
                          <th>Đơn vị</th>
                          <th>SL yêu cầu</th>
                          <th>Tồn kho</th>
                          <th>Chọn lô xuất</th>
                          <th>SL xuất</th>
                          <th>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issueDetails.map((detail, index) => (
                          <tr key={detail.materialId}>
                            <td className="text-center">{index + 1}</td>
                            <td>{detail.materialName}</td>
                            <td>{detail.unitName}</td>
                            <td className="text-center">{detail.qtyRequested}</td>
                            <td className="text-center">
                              <span className={`stock-badge ${detail.availableStock >= detail.qtyRequested ? 'sufficient' : 'insufficient'}`}>
                                {detail.availableStock}
                              </span>
                            </td>
                            <td>
                              <select
                                value={detail.selectedLot?.inventoryCardId || ''}
                                onChange={(e) => {
                                  const lotId = e.target.value;
                                  const selected = detail.lotStocks.find(lot => lot.inventoryCardId == lotId);
                                  if (selected) selectLot(detail.materialId, selected);
                                }}
                              >
                                <option value="">Chọn lô</option>
                                {detail.lotStocks.map(lot => (
                                  <option key={lot.inventoryCardId} value={lot.inventoryCardId}>
                                    Lô {lot.lotNumber} (còn {lot.availableStock}) - HSD: {lot.expDate}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                value={detail.qtyIssued}
                                onChange={(e) => updateQtyIssued(detail.materialId, parseFloat(e.target.value))}
                                min="0"
                                max={Math.min(detail.qtyRequested, detail.selectedLot?.availableStock || detail.availableStock)}
                                step="0.001"
                              />
                            </td>
                            <td>
                              {detail.selectedLot ? (
                                <span className="text-success">Đủ tồn</span>
                              ) : detail.availableStock >= detail.qtyRequested ? (
                                <span className="text-warning">Chọn lô xuất</span>
                              ) : (
                                <span className="text-danger">Không đủ tồn</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tổng kết */}
                <div className="summary-section">
                  <div className="total-amount">
                    <span>Tổng tiền (ước tính):</span>
                    <strong>{calculateTotal().toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <button 
                    className="btn-submit"
                    onClick={handleSubmit}
                    disabled={isLoading}
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
                      </div>
                      <div className="issue-actions">
                        <button className="btn-view">Xem chi tiết</button>
                      </div>
                    </div>
                    {issue.issueReq && (
                      <div className="issue-ref">
                        <strong>Từ phiếu xin lĩnh:</strong> #{issue.issueReq.id}
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