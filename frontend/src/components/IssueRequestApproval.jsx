import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import './IssueRequestApproval.css';

const API_URL = 'http://localhost:8080/api';

export default function IssueRequestApproval() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [processedRequests, setProcessedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [currentAction, setCurrentAction] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [categories, setCategories] = useState([]); 

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  // Fetch categories từ backend
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/materials/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      setCategories([]);
    }
  };

  // Fetch all data on component mount
  const fetchAllData = async () => {
    if (!currentUser.id || currentUser.roleCheck !== 1) return;
    
    setIsLoading(true);
    try {
      await fetchCategories(); // Fetch categories trước
      
      const [pendingResponse, processedResponse] = await Promise.all([
        fetch(`${API_URL}/issue-requests/leader/pending`, {
          headers: { 'X-User-Id': currentUser.id.toString() }
        }),
        fetch(`${API_URL}/issue-requests/leader/processed`, {
          headers: { 'X-User-Id': currentUser.id.toString() }
        })
      ]);

      const pendingData = await pendingResponse.json();
      const processedData = await processedResponse.json();

      if (pendingData.success) {
        setPendingRequests(pendingData.requests || []);
      }

      if (processedData.success) {
        setProcessedRequests(processedData.requests || []);
      }

      setInitialLoad(false);

    } catch (error) {
      toast.error('Lỗi kết nối server');
      setPendingRequests([]);
      setProcessedRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!currentUser.id || currentUser.roleCheck !== 1) return;
    
    try {
      const response = await fetch(`${API_URL}/issue-requests/leader/pending`, {
        headers: { 'X-User-Id': currentUser.id.toString() }
      });

      const data = await response.json();
      if (data.success) {
        setPendingRequests(data.requests || []);
      }
    } catch (error) {
      toast.error('Lỗi tải phiếu chờ duyệt');
      setPendingRequests([]);
    }
  };

  const fetchProcessedRequests = async () => {
    if (!currentUser.id || currentUser.roleCheck !== 1) return;
    
    try {
      const response = await fetch(`${API_URL}/issue-requests/leader/processed`, {
        headers: { 'X-User-Id': currentUser.id.toString() }
      });

      const data = await response.json();
      if (data.success) {
        setProcessedRequests(data.requests || []);
      }
    } catch (error) {
      toast.error('Lỗi tải lịch sử phê duyệt');
      setProcessedRequests([]);
    }
  };

  const fetchRequestDetail = async (requestId) => {
    if (!currentUser.id) return;
    
    setIsDetailLoading(true);
    try {
      const response = await fetch(`${API_URL}/issue-requests/${requestId}/detail`, {
        headers: { 'X-User-Id': currentUser.id.toString() }
      });

      const data = await response.json();
      if (data.success) {
        // Xử lý dữ liệu category cho từng detail - chỉ dùng dữ liệu từ backend
        const processedData = {
          ...data,
          details: data.details?.map(detail => ({
            ...detail,
          })) || []
        };
        setSelectedRequest(processedData);
      } else {
        toast.error(data.message || 'Không thể tải chi tiết');
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Helper functions để xử lý category - chỉ dùng khi backend có trả về
  const getCategoryInfo = (categoryValue) => {
    // Nếu có categories từ backend, sử dụng
    if (categories.length > 0) {
      const category = categories.find(cat => cat.value === categoryValue);
      return category || { label: `Loại ${categoryValue}`, description: 'Không xác định' };
    }
    
    // Nếu không có categories từ backend, trả về thông tin cơ bản
    return { 
      label: `Loại ${categoryValue}`, 
      description: 'Thông tin từ server' 
    };
  };

  // Mở modal nhập lý do cho duyệt/từ chối/điều chỉnh
  const openApprovalModal = (action, request) => {
    setCurrentAction(action);
    setSelectedRequest({ header: request });
    setShowApprovalModal(true);
    setApprovalNote('');
  };

  // Xác nhận hành động với lý do
  const handleConfirmAction = () => {
    if (!selectedRequest?.header?.id) {
      toast.error('Không tìm thấy ID phiếu');
      return;
    }
    
    // Kiểm tra lý do cho hành động từ chối (có thể bắt buộc hoặc không)
    if (currentAction === 'reject' && !approvalNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    
    handleApprovalAction(currentAction, selectedRequest.header.id);
  };

  // Thực hiện hành động phê duyệt với lý do
  const handleApprovalAction = async (action, requestId) => {
    try {
      const endpoint = {
        approve: 'approve',
        reject: 'reject',
        adjust: 'request-adjustment'
      }[action];

      const response = await fetch(`${API_URL}/issue-requests/${requestId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify({
          note: approvalNote || '',
          approverId: currentUser.id
        })
      });

      const data = await response.json();
      if (data.success) {
        const message = {
          approve: 'Đã phê duyệt phiếu thành công',
          reject: 'Đã từ chối phiếu thành công',
          adjust: 'Đã gửi yêu cầu điều chỉnh thành công'
        }[action];
        
        toast.success(message);
        setShowApprovalModal(false);
        setApprovalNote('');
        
        // Refresh both data sets after action
        await fetchPendingRequests();
        await fetchProcessedRequests();
        setSelectedRequest(null);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    }
  };

  // Helper functions
  const getActionName = (action) => {
    const actions = {
      approve: 'phê duyệt',
      reject: 'từ chối', 
      adjust: 'yêu cầu điều chỉnh'
    };
    return actions[action] || 'xử lý';
  };

  const getActionButtonClass = (action) => {
    const classes = {
      approve: 'btn-approve',
      reject: 'btn-reject',
      adjust: 'btn-adjust'
    };
    return classes[action] || '';
  };

  const getModalTitle = (action) => {
    const titles = {
      approve: 'Phê duyệt phiếu',
      reject: 'Từ chối phiếu',
      adjust: 'Yêu cầu điều chỉnh'
    };
    return titles[action] || 'Xác nhận';
  };

  const getPlaceholderText = (action) => {
    const placeholders = {
      approve: 'Nhập ghi chú phê duyệt (không bắt buộc)...',
      reject: 'Nhập lý do từ chối...',
      adjust: 'Nhập yêu cầu điều chỉnh...'
    };
    return placeholders[action] || 'Nhập ghi chú...';
  };

  // Effects
  useEffect(() => {
    if (currentUser.roleCheck === 1) {
      fetchAllData();
    }
  }, []);

  // Refresh individual tab when switching
  useEffect(() => {
    if (!initialLoad) {
      if (activeTab === 'pending') {
        fetchPendingRequests();
      } else {
        fetchProcessedRequests();
      }
    }
  }, [activeTab]);

  // Render conditions
  if (currentUser.roleCheck !== 1) {
    return (
      <div className="approval-container">
        <div className="access-denied">
          <h2>Truy cập bị từ chối</h2>
          <p>Bạn không có quyền truy cập tính năng phê duyệt phiếu xin lĩnh.</p>
          <p>Role của bạn: {currentUser.roleName} (ID: {currentUser.id})</p>
        </div>
      </div>
    );
  }

  const currentRequests = activeTab === 'pending' ? pendingRequests : processedRequests;
  const currentTabLoading = isLoading && initialLoad;

  return (
    <div className="approval-container">
      {/* Header */}
      <div className="approval-header">
        <h1>Phê duyệt Phiếu xin lĩnh</h1>
        <div className="approval-tabs">
          <button 
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Chờ phê duyệt ({pendingRequests.length})
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Lịch sử ({processedRequests.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="requests-content">
        {currentTabLoading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : currentRequests.length === 0 ? (
          <div className="empty-state">
            <h3>{activeTab === 'pending' ? 'Không có phiếu nào chờ phê duyệt' : 'Chưa có lịch sử phê duyệt'}</h3>
            <p>Khi có phiếu xin lĩnh mới, chúng sẽ xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="requests-list">
            {currentRequests.map(request => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <div className="request-info">
                    <h3>Phiếu #{request.id}</h3>
                    <p><strong>Người gửi:</strong> {request.createdByName}</p>
                    <p><strong>Đơn vị:</strong> {request.departmentName}</p>
                    <p><strong>Thời gian:</strong> {new Date(request.requestedAt).toLocaleString()}</p>
                    {/* Hiển thị lý do từ chối nếu có */}
                    {request.status === 2 && request.approvalNote && (
                      <p className="rejection-reason">
                        <strong>Lý do từ chối:</strong> {request.approvalNote}
                      </p>
                    )}
                  </div>
                  <div className="request-status">
                    <span className={`status-badge ${request.statusBadge}`}>
                      {request.statusName}
                    </span>
                  </div>
                </div>
                
                <div className="request-actions">
                  <button 
                    className="btn-view"
                    onClick={() => fetchRequestDetail(request.id)}
                  >
                    Xem chi tiết
                  </button>
                  
                  {activeTab === 'pending' && (
                    <div className="action-buttons">
                      <button 
                        className="btn-approve"
                        onClick={() => openApprovalModal('approve', request)}
                      >
                        Duyệt
                      </button>
                      <button 
                        className="btn-reject"
                        onClick={() => openApprovalModal('reject', request)}
                      >
                        Từ chối
                      </button>
                      <button 
                        className="btn-adjust"
                        onClick={() => openApprovalModal('adjust', request)}
                      >
                        Điều chỉnh
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && selectedRequest.header && (
        <div className="detail-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Chi tiết Phiếu #{selectedRequest.header.id}</h2>
            </div>
            
            {isDetailLoading ? (
              <div className="loading">Đang tải chi tiết...</div>
            ) : (
              <div className="modal-body">
                {/* Header Info */}
                <div className="detail-section">
                  <h3>Thông tin chung</h3>
                  <div className="info-grid">
                    <div><strong>Người gửi:</strong> {selectedRequest.header.createdByName}</div>
                    <div><strong>Email:</strong> {selectedRequest.header.createdByEmail}</div>
                    <div><strong>Đơn vị:</strong> {selectedRequest.header.departmentName}</div>
                    <div><strong>Bộ môn:</strong> {selectedRequest.header.departmentName}</div>
                    <div><strong>Thời gian:</strong> {new Date(selectedRequest.header.requestedAt).toLocaleString()}</div>
                    <div><strong>Trạng thái:</strong> 
                      <span className={`status-badge ${selectedRequest.header.statusBadge}`}>
                        {selectedRequest.header.statusName}
                      </span>
                    </div>
                    {selectedRequest.header.approvalByName && (
                      <div><strong>Người phê duyệt:</strong> {selectedRequest.header.approvalByName}</div>
                    )}
                    {selectedRequest.header.approvalAt && (
                      <div><strong>Thời gian phê duyệt:</strong> {new Date(selectedRequest.header.approvalAt).toLocaleString()}</div>
                    )}
                    {selectedRequest.header.approvalNote && (
                      <div><strong>Ghi chú phê duyệt:</strong> {selectedRequest.header.approvalNote}</div>
                    )}
                    {selectedRequest.header.note && (
                      <div><strong>Ghi chú của người gửi:</strong> {selectedRequest.header.note}</div>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {selectedRequest.summary && (
                  <div className="detail-section">
                    <h3>Tổng hợp vật tư</h3>
                    <div className="summary-cards">
                      <div className="summary-card">
                        <div className="summary-value">{selectedRequest.summary.totalMaterials}</div>
                        <div className="summary-label">Tổng loại</div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-value">{selectedRequest.summary.totalQuantity}</div>
                        <div className="summary-label">Tổng số lượng</div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-value">{selectedRequest.summary.newMaterials || 0}</div>
                        <div className="summary-label">Vật tư mới</div>
                      </div>
                    </div>
                    
                    {/* Hiển thị breakdown theo category - chỉ khi có dữ liệu từ backend */}
                    {selectedRequest.summary.categoryBreakdown && (
                      <div className="category-breakdown">
                        <h4>Phân loại:</h4>
                        <div className="category-breakdown-cards">
                          {Object.entries(selectedRequest.summary.categoryBreakdown).map(([category, count]) => {
                            const categoryInfo = getCategoryInfo(category);
                            return (
                              <div key={category} className="category-breakdown-card">
                                <span className={`category-badge category-${category.toLowerCase()}`}>
                                  {categoryInfo.label}
                                </span>
                                <span className="category-count">{count} loại</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Materials Table */}
                <div className="detail-section">
                  <h3>Danh sách vật tư</h3>
                  <div className="materials-table">
                    <table>
                      <thead>
                        <tr>
                          <th>TT</th>
                          <th>Tên vật tư</th>
                          <th>Quy cách</th>
                          <th>Đơn vị</th>
                          <th>Số lượng</th>
                          <th>Loại</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.details?.map((detail, index) => {
                          const categoryInfo = getCategoryInfo(detail.category);
                          return (
                            <tr key={index}>
                              <td className="text-center">{index + 1}</td>
                              <td>
                                {detail.materialName}
                                {detail.isNewMaterial && <span className="new-badge">Mới</span>}
                              </td>
                              <td>{detail.spec || '-'}</td>
                              <td>{detail.unitName}</td>
                              <td className="text-center">{detail.qtyRequested}</td>
                              <td className="text-center">
                                <span 
                                  className={`category-badge category-${detail.category?.toLowerCase() || 'd'}`}
                                  title={categoryInfo.description}
                                >
                                  {categoryInfo.label}
                                </span>
                              </td>
                              <td className="text-center">
                                {detail.isNewMaterial ? (
                                  <span className="status-badge warning">Vật tư mới</span>
                                ) : (
                                  <span className="status-badge success">Có sẵn</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="modal-footer">
                  <button 
                    className="btn-close"
                    onClick={() => setSelectedRequest(null)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="approval-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{getModalTitle(currentAction)}</h2>
            </div>
            <div className="modal-body">
              <p>Vui lòng nhập {currentAction === 'reject' ? 'lý do từ chối' : 'ghi chú'} {getActionName(currentAction)}:</p>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder={getPlaceholderText(currentAction)}
                rows="4"
              />
              {currentAction === 'reject' && (
                <p className="required-note">Lý do từ chối là bắt buộc</p>
              )}
              <div className="modal-actions">
                <button 
                  className="btn-cancel"
                  onClick={() => setShowApprovalModal(false)}
                >
                  Hủy
                </button>
                <button 
                  className={getActionButtonClass(currentAction)}
                  onClick={handleConfirmAction}
                  disabled={currentAction === 'reject' && !approvalNote.trim()}
                >
                  Xác nhận {getActionName(currentAction)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}