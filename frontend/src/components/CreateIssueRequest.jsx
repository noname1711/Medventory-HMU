import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import "./CreateIssueRequest.css";

// API Configuration
const API_URL = 'http://localhost:8080/api';
const API_ENDPOINTS = {
  AUTH: `${API_URL}/auth`,
  UNITS: `${API_URL}/units`,
  MATERIALS: `${API_URL}/materials`,
  SUB_DEPARTMENTS: `${API_URL}/departments/sub-departments`,
  ISSUE_REQUESTS: `${API_URL}/issue-requests`
};

// Material Search Component với Modal
const MaterialSearch = ({ 
  value, 
  onChange, 
  onSelect, 
  materials, 
  placeholder = "Tên vật tư hóa chất" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [searchValue, setSearchValue] = useState(value);
  const inputRef = React.useRef(null);

  // Filter materials 
  useEffect(() => {
    if (searchValue.trim() === '') {
      setFilteredMaterials(materials.slice(0, 10));
    } else {
      const searchTerms = searchValue.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
      
      const filtered = materials.filter(material => {
        const materialName = material.name.toLowerCase();
        const matches = searchTerms.every(term => 
          materialName.includes(term)
        );
        return matches;
      });
      
      setFilteredMaterials(filtered);
    }
  }, [searchValue, materials]);

  const handleInputFocus = () => {
    setSearchValue(value);
    setIsOpen(true);
  };

  const handleModalInputChange = (e) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    onChange(newValue);
  };

  const handleSelectMaterial = (material) => {
    onSelect(material);
    setIsOpen(false);
  };

  const handleCloseModal = () => {
    setIsOpen(false);
  };

  // Hàm highlight từ khóa tìm kiếm trong kết quả
  const highlightText = (text, searchValue) => {
    if (!searchValue.trim() || !text) return text;
    
    const searchTerms = searchValue.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
    let highlightedText = text;
    
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
  };

  // Hàm format thông tin material để hiển thị
  const getMaterialDisplayInfo = (material) => {
    const parts = [];
    if (material.code) parts.push(`Mã: ${material.code}`);
    if (material.spec) parts.push(`QC: ${material.spec}`);
    if (material.manufacturer) parts.push(`HSX: ${material.manufacturer}`);
    if (material.category) parts.push(`Loại: ${material.category}`);
    
    return parts.join(' - ');
  };

  return (
    <div className="material-search-container">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleInputFocus}
        className="material-search-input"
        required
      />

      {/* MODAL SEARCH */}
      {isOpen && (
        <div className="material-search-modal">
          <div className="modal-backdrop" onClick={handleCloseModal}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h4>Tìm kiếm vật tư</h4>
            </div>
            
            <div className="search-box">
              <input
                type="text"
                placeholder="Nhập tên vật tư để tìm kiếm..."
                value={searchValue}
                onChange={handleModalInputChange}
                autoFocus
                className="search-input"
              />
            </div>

            <div className="search-results">
              {filteredMaterials.length > 0 ? (
                <>
                  <div className="results-count">
                    Tìm thấy {filteredMaterials.length} kết quả
                  </div>
                  {filteredMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="result-item"
                      onClick={() => handleSelectMaterial(material)}
                    >
                      <div className="material-main-info">
                        <span 
                          dangerouslySetInnerHTML={{ 
                            __html: highlightText(material.name, searchValue) 
                          }} 
                        />
                      </div>
                      <div className="material-details">
                        {getMaterialDisplayInfo(material)}
                      </div>
                    </div>
                  ))}
                </>
              ) : searchValue.trim() !== '' ? (
                <div className="no-results">
                  <p>Không tìm thấy vật tư phù hợp với "{searchValue}"</p>
                  <p className="hint-text">Thử tìm với từ khóa khác hoặc nhập thành vật tư mới</p>
                </div>
              ) : (
                <div className="initial-state">
                  <p>Nhập tên vật tư để tìm kiếm</p>
                  <p className="hint-text">Danh sách {materials.length} vật tư có sẵn trong hệ thống</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={handleCloseModal} className="btn-cancel">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function CreateIssueRequest() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("create");
  const [formData, setFormData] = useState({
    subDepartmentId: "",
    note: "",
    details: [
      {
        materialId: null,
        materialName: "",
        spec: "",
        unitId: "",
        qtyRequested: "",
        proposedCode: "",
        proposedManufacturer: "",
        category: ""
      }
    ]
  });
  
  const [units, setUnits] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const [requestHistory, setRequestHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Lấy thông tin user và dữ liệu
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        await fetchUserInfo();
        await Promise.all([
          fetchUnits(),
          fetchMaterials() 
        ]);
      } catch (error) {
        setMessage("Lỗi khi tải dữ liệu từ server");
      }
    };

    fetchInitialData();
  }, []);

  // Fetch lịch sử khi user đã được thiết lập
  useEffect(() => {
    if (currentUser?.id) {
      fetchRequestHistory();
    }
  }, [currentUser]);

  const fetchUserInfo = async () => {
    try {
      const userFromStorage = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userEmail = userFromStorage.email;
      
      if (!userEmail) {
        return;
      }

      const response = await fetch(`${API_ENDPOINTS.AUTH}/user-info?email=${encodeURIComponent(userEmail)}`);
      
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        
        if (userData.departmentId) {
          fetchSubDepartments(userData.departmentId);
        }
      }
    } catch (error) {
      console.error("Lỗi khi fetch user info:", error);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.UNITS);
      if (response.ok) {
        const data = await response.json();
        setUnits(data);
      }
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đơn vị tính:", error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.MATERIALS);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
        
        const uniqueCategories = extractCategoriesFromMaterials(data);
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error("Lỗi khi lấy danh sách vật tư:", error);
    }
  };

  // Hàm lấy lịch sử phiếu xin lĩnh
  const fetchRequestHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.ISSUE_REQUESTS}/canbo/my-requests`, {
        method: "GET",
        headers: {
          "X-User-Id": currentUser.id.toString()
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          const historyData = result.requests || [];
          setRequestHistory(historyData);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Lỗi khi lấy lịch sử phiếu xin lĩnh:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Hàm extract categories từ danh sách materials
  const extractCategoriesFromMaterials = (materialsList) => {
    const categorySet = new Set();
    
    materialsList.forEach(material => {
      if (material.category) {
        categorySet.add(material.category);
      }
    });
    
    const categoriesArray = Array.from(categorySet).map(category => ({
      value: category,
      label: getCategoryLabel(category)
    }));
    
    const defaultCategories = ['A', 'B', 'C', 'D'];
    defaultCategories.forEach(cat => {
      if (!categorySet.has(cat)) {
        categoriesArray.push({
          value: cat,
          label: getCategoryLabel(cat)
        });
      }
    });
    
    return categoriesArray.sort((a, b) => a.value.localeCompare(b.value));
  };

  // Hàm lấy label cho category
  const getCategoryLabel = (category) => {
    const labels = {
      'A': 'Loại A',
      'B': 'Loại B', 
      'C': 'Loại C',
      'D': 'Loại D'
    };
    return labels[category] || `Loại ${category}`;
  };

  const fetchSubDepartments = async (departmentId) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.SUB_DEPARTMENTS}?departmentId=${departmentId}`);
      if (response.ok) {
        const data = await response.json();
        setSubDepartments(data);
      }
    } catch (error) {
      console.error("Lỗi khi lấy danh sách bộ môn:", error);
    }
  };

  // Hàm xử lý chọn vật tư từ search
  const handleMaterialSelect = (material, index) => {
    setFormData(prev => ({
      ...prev,
      details: prev.details.map((detail, i) => 
        i === index ? {
          ...detail,
          materialId: material.id,
          materialName: material.name,
          spec: material.spec,
          unitId: material.unit?.id || "",
          proposedCode: material.code,
          proposedManufacturer: material.manufacturer,
          category: material.category
        } : detail
      )
    }));
  };

  // Hàm kiểm tra và xử lý số lượng hợp lệ
  const handleQtyChange = (index, value) => {
    const sanitizedValue = value.replace(/[^\d.,]/g, '');
    const normalizedValue = sanitizedValue.replace(/,/g, '.');
    
    const dotCount = (normalizedValue.match(/\./g) || []).length;
    if (dotCount > 1) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      details: prev.details.map((detail, i) => 
        i === index ? { ...detail, qtyRequested: normalizedValue } : detail
      )
    }));
  };

  const handleDetailChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      details: prev.details.map((detail, i) => 
        i === index ? { ...detail, [field]: value } : detail
      )
    }));

    // Auto-fill khi nhập mã code trùng
    if (field === 'proposedCode' && value.trim()) {
      const existingMaterial = materials.find(m => m.code === value.trim());
      if (existingMaterial) {
        const currentQty = formData.details[index].qtyRequested;
        setFormData(prev => ({
          ...prev,
          details: prev.details.map((detail, i) => 
            i === index ? {
              ...detail,
              materialId: existingMaterial.id,
              materialName: existingMaterial.name,
              spec: existingMaterial.spec,
              unitId: existingMaterial.unit?.id || "",
              proposedManufacturer: existingMaterial.manufacturer,
              category: existingMaterial.category,
              qtyRequested: currentQty
            } : detail
          )
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          details: prev.details.map((detail, i) => 
            i === index ? { 
              ...detail, 
              materialId: null 
            } : detail
          )
        }));
      }
    }
  };

  // Hàm thêm hàng mới
  const addNewRow = () => {
    setFormData(prev => ({
      ...prev,
      details: [
        ...prev.details,
        {
          materialId: null,
          materialName: "",
          spec: "",
          unitId: "",
          qtyRequested: "",
          proposedCode: "",
          proposedManufacturer: "",
          category: ""
        }
      ]
    }));
  };

  // Hàm xóa hàng
  const removeRow = (index) => {
    if (formData.details.length <= 1) {
      setMessage("Phải có ít nhất một hàng vật tư");
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index)
    }));
  };

  // Kiểm tra xem dòng có phải là vật tư mới không (dựa vào materialId)
  const isNewMaterial = (detail) => {
    return !detail.materialId;
  };

  // Kiểm tra mã code có tồn tại trong danh mục không
  const isCodeExists = (code) => {
    return materials.some(material => material.code === code);
  };

  const validateForm = () => {
    if (!currentUser?.departmentId) {
      setMessage("Không tìm thấy thông tin khoa phòng của bạn. Vui lòng liên hệ quản trị viên.");
      return false;
    }

    if (!formData.note || !formData.note.trim()) {
      setMessage("Vui lòng nhập ghi chú");
      return false;
    }

    const validDetails = formData.details.filter(detail => {
      const hasMaterialName = detail.materialName.trim() !== "";
      const hasSpec = detail.spec.trim() !== "";
      const hasUnit = detail.unitId !== "";
      const hasQty = detail.qtyRequested !== "" && parseFloat(detail.qtyRequested) > 0;
      const hasCode = detail.proposedCode.trim() !== "";
      const hasManufacturer = detail.proposedManufacturer.trim() !== "";
      const hasCategory = detail.category !== "";
      
      return hasMaterialName && hasSpec && hasUnit && hasQty && hasCode && hasManufacturer && hasCategory;
    });

    if (validDetails.length === 0) {
      setMessage("Vui lòng nhập ít nhất một vật tư với đầy đủ thông tin");
      return false;
    }

    for (const detail of validDetails) {
      const qtyValue = parseFloat(detail.qtyRequested);
      if (isNaN(qtyValue) || qtyValue <= 0) {
        setMessage("Số lượng phải là số lớn hơn 0");
        return false;
      }

      if (isNewMaterial(detail) && isCodeExists(detail.proposedCode)) {
        setMessage(`Mã code "${detail.proposedCode}" đã tồn tại trong danh mục. Vui lòng chọn mã khác.`);
        return false;
      }

      if (categories.length > 0 && !categories.some(cat => cat.value === detail.category)) {
        setMessage("Loại vật tư không hợp lệ");
        return false;
      }
    }

    return true;
  };

  // Hàm hiển thị confirm dialog trước khi gửi
  const showConfirmDialog = async () => {
    const result = await Swal.fire({
      title: 'Xác nhận gửi phiếu xin lĩnh',
      html: `
        <div style="text-align: left;">
          <p><strong>Thông tin người gửi:</strong></p>
          <p>Họ tên: ${currentUser?.fullName || "Chưa có thông tin"}</p>
          <p>Khoa phòng: ${currentUser?.departmentName || "Chưa có thông tin"}</p>
          <p>Mục đích sử dụng: ${formData.note}</p>
          <br>
          <p><strong>Danh sách vật tư (${formData.details.filter(d => d.materialName.trim() !== "").length} vật tư):</strong></p>
          ${formData.details
            .filter(detail => detail.materialName.trim() !== "")
            .map((detail, index) => `
              <p>${index + 1}. ${detail.materialName} - Số lượng: ${detail.qtyRequested} - Mã: ${detail.proposedCode}</p>
            `).join('')}
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận gửi',
      cancelButtonText: 'Hủy bỏ',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      reverseButtons: true,
      width: '600px'
    });

    return result.isConfirmed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (!validateForm()) {
        setLoading(false);
        return;
      }

      const isConfirmed = await showConfirmDialog();
      if (!isConfirmed) {
        setLoading(false);
        return;
      }

      const submitData = {
        subDepartmentId: formData.subDepartmentId || null,
        note: formData.note,
        details: formData.details
          .filter(detail => 
            detail.materialName.trim() !== "" && 
            detail.spec.trim() !== "" &&
            detail.unitId !== "" &&
            detail.qtyRequested !== "" &&
            detail.proposedCode.trim() !== "" &&
            detail.proposedManufacturer.trim() !== "" &&
            detail.category !== ""
          )
          .map(detail => ({
            materialId: detail.materialId || null,
            materialName: detail.materialName,
            spec: detail.spec,
            unitId: parseInt(detail.unitId),
            qtyRequested: parseFloat(detail.qtyRequested),
            proposedCode: detail.proposedCode,
            proposedManufacturer: detail.proposedManufacturer,
            category: detail.category
          }))
      };

      const response = await fetch(`${API_ENDPOINTS.ISSUE_REQUESTS}/canbo/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser?.id?.toString() || "1"
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        await Swal.fire({
          title: 'Thành công!',
          text: result.message || 'Tạo phiếu xin lĩnh thành công! Phiếu đã được gửi cho lãnh đạo phê duyệt.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#3085d6'
        });
        resetForm();
        setActiveTab("history");
        fetchRequestHistory();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      await Swal.fire({
        title: 'Lỗi!',
        text: 'Lỗi: ' + error.message,
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      subDepartmentId: subDepartments.length > 0 ? subDepartments[0].id.toString() : "",
      note: "",
      details: [
        {
          materialId: null,
          materialName: "",
          spec: "",
          unitId: "",
          qtyRequested: "",
          proposedCode: "",
          proposedManufacturer: "",
          category: ""
        }
      ]
    });
  };

  // Hàm hiển thị chi tiết phiếu xin lĩnh
  const showRequestDetails = (request) => {
    setSelectedRequest(request);
  };

  // Hàm đóng modal chi tiết
  const closeRequestDetails = () => {
    setSelectedRequest(null);
  };

  // Hàm format ngày tháng
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Hàm lấy màu cho trạng thái
  const getStatusColor = (status) => {
    switch (status) {
      case 1: return 'status-approved';
      case 2: return 'status-rejected';
      case 0:
      default: return 'status-pending';
    }
  };

  // Hàm lấy label cho trạng thái
  const getStatusLabel = (status) => {
    switch (status) {
      case 1: return 'Đã duyệt';
      case 2: return 'Từ chối';
      case 0:
      default: return 'Chờ duyệt';
    }
  };

  // Hàm lấy tên hiển thị cho vật tư
  const getMaterialDisplayName = (detail) => {
    return detail.materialName || detail.material?.name || 'N/A';
  };

  // Hàm lấy spec hiển thị cho vật tư
  const getMaterialDisplaySpec = (detail) => {
    return detail.spec || detail.material?.spec || 'N/A';
  };

  // Hàm lấy tên đơn vị tính
  const getUnitName = (detail) => {
    return detail.unitName || detail.unit?.name || units.find(u => u.id === detail.unitId)?.name || 'N/A';
  };

  return (
    <div className="create-issue-request">
      <h1 className="page-title">Quản lý Phiếu Xin Lĩnh</h1>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === "create" ? "active" : ""}`}
          onClick={() => setActiveTab("create")}
        >
          Tạo Phiếu Xin Lĩnh
        </button>
        <button 
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Lịch Sử Phiếu Đã Gửi ({requestHistory.length})
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes("thành công") ? "success" : "error"}`}>
          {message}
        </div>
      )}

      {/* Tab Tạo Phiếu Xin Lĩnh */}
      {activeTab === "create" && (
        <form onSubmit={handleSubmit} className="issue-form">
          {/* Thông tin chung */}
          <div className="form-section">
            <h3 className="section-title">Thông tin chung</h3>
            
            {/* Thông tin người xin lĩnh */}
            <div className="user-info-card">
              <h4>Thông tin người xin lĩnh</h4>
              <div className="user-info-grid">
                <div className="user-info-item">
                  <label>Họ và tên:</label>
                  <span className="user-info-value">{currentUser?.fullName || "Chưa có thông tin"}</span>
                </div>
                <div className="user-info-item">
                  <label>Khoa Phòng:</label>
                  <span className="user-info-value">{currentUser?.departmentName || "Chưa có thông tin"}</span>
                </div>
                <div className="user-info-item">
                  <label>Bộ môn trực thuộc:</label>
                  <span className="user-info-value">
                    {subDepartments.find(sd => sd.id.toString() === formData.subDepartmentId)?.name || currentUser?.departmentName || "Chưa có thông tin"}
                  </span>
                </div>
                <div className="user-info-item">
                  <label>Email:</label>
                  <span className="user-info-value">{currentUser?.email || "Chưa có thông tin"}</span>
                </div>
                <div className="user-info-item">
                  <label>Chức vụ:</label>
                  <span className="user-info-value">{currentUser?.role || "Cán bộ"}</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Ghi chú
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="form-textarea"
                placeholder="Nhập ghi chú cho phiếu xin lĩnh"
                rows={3}
                required
              />
            </div>
          </div>

          {/* Bảng vật tư */}
          <div className="form-section">
            <div className="section-header">
              <h3 className="section-title">Danh sách vật tư xin lĩnh</h3>
              <div className="section-actions">
                <button
                  type="button"
                  onClick={addNewRow}
                  className="btn-add-row"
                >
                  Thêm hàng
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="issue-table">
                <thead>
                  <tr>
                    <th width="50">TT</th>
                    <th>Mã code</th>
                    <th>Tên vật tư hóa chất</th>
                    <th>Quy cách đóng gói</th>
                    <th width="120">Đơn vị tính</th>
                    <th width="120">Số lượng xin cấp</th>
                    <th>Hãng sản xuất</th>
                    <th width="100">Loại</th>
                    <th width="100">Phân loại</th>
                    <th width="80">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.details.map((detail, index) => (
                    <tr key={index} className={isNewMaterial(detail) ? 'new-material' : 'existing-material'}>
                      <td className="text-center">{index + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={detail.proposedCode}
                          onChange={(e) => handleDetailChange(index, "proposedCode", e.target.value)}
                          className="table-input"
                          placeholder="Nhập mã code"
                          required
                        />
                      </td>
                      <td className="material-search-cell">
                        <MaterialSearch
                          value={detail.materialName}
                          onChange={(value) => handleDetailChange(index, "materialName", value)}
                          onSelect={(material) => handleMaterialSelect(material, index)}
                          materials={materials}
                          placeholder="Nhập tên vật tư hoặc mã code..."
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={detail.spec}
                          onChange={(e) => handleDetailChange(index, "spec", e.target.value)}
                          className="table-input"
                          placeholder="Quy cách"
                          required
                          disabled={!isNewMaterial(detail)}
                        />
                      </td>
                      <td>
                        <select
                          value={detail.unitId}
                          onChange={(e) => handleDetailChange(index, "unitId", e.target.value)}
                          className="table-select"
                          required
                          disabled={!isNewMaterial(detail)}
                        >
                          <option value="">Chọn đơn vị</option>
                          {units.map(unit => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={detail.qtyRequested}
                          onChange={(e) => handleQtyChange(index, e.target.value)}
                          className="table-input number-input"
                          placeholder="0.000"
                          required
                          inputMode="decimal"
                          pattern="[0-9.,]*"
                          title="Chỉ được nhập số và dấu thập phân"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={detail.proposedManufacturer}
                          onChange={(e) => handleDetailChange(index, "proposedManufacturer", e.target.value)}
                          className="table-input"
                          placeholder="Hãng sản xuất"
                          required
                          disabled={!isNewMaterial(detail)}
                        />
                      </td>
                      <td>
                        <select
                          value={detail.category}
                          onChange={(e) => handleDetailChange(index, "category", e.target.value)}
                          className="table-select category-select"
                          required
                          disabled={!isNewMaterial(detail)}
                        >
                          <option value="">Chọn loại</option>
                          {categories.map(cat => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-center">
                        <span className={`material-type-badge ${isNewMaterial(detail) ? 'new' : 'existing'}`}>
                          {isNewMaterial(detail) ? 'Vật tư mới' : 'Vật tư có sẵn'}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="btn-remove-row"
                          disabled={formData.details.length <= 1}
                          title="Xóa hàng này"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-note">
              <p><strong>Hướng dẫn sử dụng:</strong></p>
              <p>• <strong>Nhập mã code</strong>: Hệ thống tự động điền thông tin nếu mã tồn tại</p>
              <p>• <strong>Nhập tên vật tư</strong>: Click vào ô để mở cửa sổ tìm kiếm thông minh</p>
              <p>• <strong>Vật tư có sẵn</strong>: Thông tin được khóa, chỉ nhập số lượng</p>
              <p>• <strong>Vật tư mới</strong>: Cần nhập đầy đủ tất cả thông tin</p>
              <p>• <strong>Số lượng</strong>: Chỉ nhập số và dấu thập phân (ví dụ: 10.5)</p>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={resetForm}
              className="btn-cancel"
              disabled={loading}
            >
              Làm mới
            </button>
            <button
              type="submit"
              disabled={loading || !currentUser?.departmentId}
              className="btn-submit"
            >
              {loading ? "Đang tạo..." : "Gửi Phiếu Xin Lĩnh"}
            </button>
          </div>
        </form>
      )}

      {/* Tab Lịch Sử Phiếu Đã Gửi */}
      {activeTab === "history" && (
        <div className="history-section">
          <div className="section-header">
            <h3 className="section-title">Lịch Sử Phiếu Xin Lĩnh Đã Gửi</h3>
            <div className="section-actions">
              <button
                type="button"
                onClick={fetchRequestHistory}
                className="btn-refresh"
                disabled={historyLoading}
              >
                {historyLoading ? "Đang tải..." : "Làm mới"}
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="loading-message">Đang tải lịch sử phiếu xin lĩnh...</div>
          ) : requestHistory.length === 0 ? (
            <div className="empty-message">
              <p>Chưa có phiếu xin lĩnh nào được gửi</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th width="80">Mã phiếu</th>
                    <th width="120">Ngày gửi</th>
                    <th>Mục đích sử dụng</th>
                    <th width="100">Số lượng vật tư</th>
                    <th width="120">Trạng thái</th>
                    <th width="100">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requestHistory.map((request) => (
                    <tr key={request.id}>
                      <td className="text-center">{request.id}</td>
                      <td className="text-center">{formatDate(request.requestedAt)}</td>
                      <td>{request.note}</td>
                      <td className="text-center">{request.details?.length || 0}</td>
                      <td className="text-center">
                        <span className={`status-badge ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => showRequestDetails(request)}
                          className="btn-view-details"
                          title="Xem chi tiết"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal chi tiết phiếu xin lĩnh */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={closeRequestDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết Phiếu Xin Lĩnh #{selectedRequest.id}</h3>
            </div>
            <div className="modal-body">
              <div className="request-info">
                <div className="info-row">
                  <label>Mã phiếu:</label>
                  <span>{selectedRequest.id}</span>
                </div>
                <div className="info-row">
                  <label>Ngày gửi:</label>
                  <span>{formatDate(selectedRequest.requestedAt)}</span>
                </div>
                <div className="info-row">
                  <label>Mục đích sử dụng:</label>
                  <span>{selectedRequest.note}</span>
                </div>
                <div className="info-row">
                  <label>Trạng thái:</label>
                  <span className={`status-badge ${getStatusColor(selectedRequest.status)}`}>
                    {getStatusLabel(selectedRequest.status)}
                  </span>
                </div>
                {selectedRequest.approvalNote && (
                  <div className="info-row">
                    <label>Ghi chú phê duyệt:</label>
                    <span>{selectedRequest.approvalNote}</span>
                  </div>
                )}
              </div>

              <div className="details-section">
                <h4>Danh sách vật tư ({selectedRequest.details?.length || 0} vật tư)</h4>
                <div className="table-container">
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th width="50">TT</th>
                        <th>Mã code</th>
                        <th>Tên vật tư</th>
                        <th>Quy cách</th>
                        <th width="100">Đơn vị tính</th>
                        <th width="100">Số lượng</th>
                        <th>Hãng SX</th>
                        <th width="80">Loại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.details?.map((detail, index) => (
                        <tr key={index}>
                          <td className="text-center">{index + 1}</td>
                          <td>{detail.proposedCode}</td>
                          <td>{getMaterialDisplayName(detail)}</td>
                          <td>{getMaterialDisplaySpec(detail)}</td>
                          <td className="text-center">
                            {getUnitName(detail)}
                          </td>
                          <td className="text-center">{detail.qtyRequested}</td>
                          <td>{detail.proposedManufacturer}</td>
                          <td className="text-center">{detail.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={closeRequestDetails} className="btn-close-modal">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
