import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./CreateIssueRequest.css";
import MaterialSearchInput from "./MaterialSearchInput";

// API Configuration
const API_URL = 'http://localhost:8080/api';
const API_ENDPOINTS = {
  AUTH: `${API_URL}/auth`,
  UNITS: `${API_URL}/units`,
  MATERIALS: `${API_URL}/materials`,
  SUB_DEPARTMENTS: `${API_URL}/departments/sub-departments`,
  ISSUE_REQUESTS: `${API_URL}/issue-requests`
};

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

export default function CreateIssueRequest() {
  const HISTORY_PAGE_SIZE = 10;
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [requestHistory, setRequestHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);

  // Lấy thông tin user và dữ liệu
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        await fetchUserInfo();
        await Promise.all([
          fetchUnits(),
          fetchMaterials()
        ]);
      } catch {
        setMessage("Lỗi khi tải dữ liệu từ server");
      }
    };

    fetchInitialData();
    // Initial boot should only run once; the called helpers use current module constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch lịch sử khi user đã được thiết lập
  useEffect(() => {
    if (currentUser?.id) {
      fetchRequestHistory();
    }
    // Refresh history when the loaded user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchUserInfo = async () => {
    try {
      const userFromStorage = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userEmail = userFromStorage.email;

      if (!userEmail) {
        setMessage("Không tìm thấy thông tin người dùng");
        return;
      }

      const response = await fetch(`${API_ENDPOINTS.AUTH}/user-info?email=${encodeURIComponent(userEmail)}`);

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);

        if (userData.departmentId) {
          fetchSubDepartments(userData.departmentId);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      setMessage("Lỗi khi tải thông tin người dùng");
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.UNITS);
      if (response.ok) {
        const data = await response.json();
        setUnits(Array.isArray(data) ? data : []);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      setUnits([]);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.MATERIALS);
      if (response.ok) {
        const data = await response.json();
        const validMaterials = Array.isArray(data) ? data.map(m => ({
          id: m.materialId,
          name: m.materialName,
          code: m.materialCode,
          spec: m.specification,
          unitId: m.unitId,
          manufacturer: m.manufacturer,
          category: m.category || "",
          unit: { id: m.unitId }
        }))
          : [];

        setMaterials(validMaterials);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      setMaterials([]);
    }
  };

  // Hàm lấy lịch sử phiếu xin lĩnh
  const fetchRequestHistory = async () => {
    if (!currentUser?.id) return;

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
          setHistoryPage(0);
        } else {
          throw new Error(result.message || "Lỗi không xác định");
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      setMessage("Lỗi khi tải lịch sử phiếu xin lĩnh");
    } finally {
      setHistoryLoading(false);
    }
  };

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
        setSubDepartments(Array.isArray(data) ? data : []);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      setSubDepartments([]);
    }
  };

  // Hàm xử lý chọn vật tư từ search 
  const handleMaterialSelect = (material, index) => {
    if (!material || !material.id) return;
    setFormData(prev => ({
      ...prev,
      details: prev.details.map((detail, i) =>
        i === index ? {
          materialId: material.id,
          materialName: material.name || "",
          spec: material.spec || "",
          unitId: material.unit?.id || material.unitId || "",
          proposedCode: material.code || "",
          proposedManufacturer: material.manufacturer || "",
          category: material.category || "", // TỰ ĐỘNG ĐIỀN CATEGORY TỪ VẬT TƯ
          qtyRequested: detail.qtyRequested || "" // Giữ nguyên số lượng
        } : detail
      )
    }));
  };

  // Hàm kiểm tra và xử lý số lượng hợp lệ
  const handleQtyChange = (index, value) => {
    // Chỉ cho phép nhập số (0-9), không cho phép dấu thập phân (.,)
    const sanitizedValue = value.replace(/[^\d]/g, '');
    
    // Nếu giá trị rỗng sau khi sanitize, set thành chuỗi rỗng
    if (sanitizedValue === '') {
      setFormData(prev => ({
        ...prev,
        details: prev.details.map((detail, i) =>
          i === index ? { ...detail, qtyRequested: '' } : detail
        )
      }));
      return;
    }

    // Chuyển thành số nguyên và kiểm tra > 0
    const intValue = parseInt(sanitizedValue, 10);
    if (intValue > 0) {
      setFormData(prev => ({
        ...prev,
        details: prev.details.map((detail, i) =>
          i === index ? { ...detail, qtyRequested: intValue.toString() } : detail
        )
      }));
    }
  };

  // Hàm xử lý thay đổi chi tiết 
  const handleDetailChange = (index, field, value) => {

    // First update the field
    setFormData(prev => ({
      ...prev,
      details: prev.details.map((detail, i) =>
        i === index ? { ...detail, [field]: value } : detail
      )
    }));

    // Auto-fill khi nhập mã code trùng
    if (field === 'proposedCode' && value && value.trim()) {
      const existingMaterial = materials.find(m =>
        m.code && m.code.toString().trim().toLowerCase() === value.trim().toLowerCase()
      );

      if (existingMaterial) {
        // Use setTimeout to ensure state is updated properly
        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            details: prev.details.map((detail, i) =>
              i === index ? {
                materialId: existingMaterial.id,
                materialName: existingMaterial.name || "",
                spec: existingMaterial.spec || "",
                unitId: existingMaterial.unit?.id || existingMaterial.unitId || "",
                proposedCode: existingMaterial.code || "",
                proposedManufacturer: existingMaterial.manufacturer || "",
                category: existingMaterial.category || "", // TỰ ĐỘNG ĐIỀN CATEGORY
                qtyRequested: prev.details[index].qtyRequested || "" // Keep existing quantity
              } : detail
            )
          }));
        }, 0);
      } else {
        // Nếu không tìm thấy mã, reset materialId để đánh dấu là vật tư mới
        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            details: prev.details.map((detail, i) =>
              i === index ? {
                ...detail,
                materialId: null,
                // Keep other values except reset materialId
              } : detail
            )
          }));
        }, 0);
      }
    }

    // BỔ SUNG: Tự động điền tên vật tư và CATEGORY khi mã code trùng (trường hợp người dùng nhập mã code trước)
    if (field === 'proposedCode' && value && value.trim() && !formData.details[index].materialName) {
      const existingMaterial = materials.find(m =>
        m.code && m.code.toString().trim().toLowerCase() === value.trim().toLowerCase()
      );

      if (existingMaterial && existingMaterial.name) {
        // Tự động điền tên vật tư và CATEGORY nếu tìm thấy mã code trùng
        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            details: prev.details.map((detail, i) =>
              i === index ? {
                ...detail,
                materialName: existingMaterial.name,
                materialId: existingMaterial.id,
                spec: existingMaterial.spec || detail.spec,
                unitId: existingMaterial.unit?.id || existingMaterial.unitId || detail.unitId,
                proposedManufacturer: existingMaterial.manufacturer || detail.proposedManufacturer,
                category: existingMaterial.category || detail.category // TỰ ĐỘNG ĐIỀN CATEGORY
              } : detail
            )
          }));
        }, 0);
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

  // Hàm xử lý khi blur khỏi ô mã code 
  const handleCodeBlur = (index, value) => {
    if (!value || !value.trim()) return;

    const existingMaterial = materials.find(m =>
      m.code && m.code.toString().trim().toLowerCase() === value.trim().toLowerCase()
    );

    if (existingMaterial) {
      setFormData(prev => ({
        ...prev,
        details: prev.details.map((detail, i) =>
          i === index ? {
            materialId: existingMaterial.id,
            materialName: existingMaterial.name || detail.materialName,
            spec: existingMaterial.spec || detail.spec,
            unitId: existingMaterial.unit?.id || existingMaterial.unitId || detail.unitId,
            proposedCode: existingMaterial.code || value,
            proposedManufacturer: existingMaterial.manufacturer || detail.proposedManufacturer,
            category: existingMaterial.category || detail.category, // TỰ ĐỘNG ĐIỀN CATEGORY
            qtyRequested: detail.qtyRequested || ""
          } : detail
        )
      }));
    }
  };

  const validateForm = () => {
    if (!currentUser?.departmentId) {
      setMessage("Không tìm thấy thông tin khoa phòng của bạn. Vui lòng liên hệ ban giám hiệu.");
      return false;
    }

    if (!formData.note || !formData.note.trim()) {
      setMessage("Vui lòng nhập ghi chú");
      return false;
    }

    const validDetails = formData.details.filter(detail => {
      const hasMaterialName = detail.materialName && detail.materialName.trim() !== "";
      const hasMaterialId = !!detail.materialId;
      const hasQty = detail.qtyRequested !== "" && parseFloat(detail.qtyRequested) > 0;
      return hasMaterialName && hasMaterialId && hasQty;
    });

    if (validDetails.length === 0) {
      setMessage("Vui lòng chọn ít nhất một vật tư từ danh mục và nhập số lượng");
      return false;
    }

    for (const detail of validDetails) {
      const qtyValue = parseFloat(detail.qtyRequested);
      if (isNaN(qtyValue) || qtyValue <= 0) {
        setMessage("Số lượng phải là số lớn hơn 0");
        return false;
      }
    }

    return true;
  };

  // Hàm hiển thị confirm dialog trước khi gửi
  const showConfirmDialog = async () => {
    const validDetails = formData.details.filter(detail =>
      detail.materialName && detail.materialName.trim() !== ""
    );

    const result = await Swal.fire({
      title: 'Xác nhận gửi phiếu xin lĩnh',
      html: `
        <div style="text-align: left;">
          <p><strong>Thông tin người gửi:</strong></p>
          <p>Họ tên: ${currentUser?.fullName || "Chưa có thông tin"}</p>
          <p>Khoa phòng: ${currentUser?.departmentName || "Chưa có thông tin"}</p>
          <p>Mục đích sử dụng: ${formData.note}</p>
          <br>
          <p><strong>Danh sách vật tư (${validDetails.length} vật tư):</strong></p>
          ${validDetails
          .map((detail, index) => `
              <p>${index + 1}. ${detail.materialName} - Số lượng: ${detail.qtyRequested} - Mã: ${detail.proposedCode} - Loại: ${detail.category}</p>
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
            detail.materialName && detail.materialName.trim() !== "" &&
            detail.materialId &&
            detail.qtyRequested !== "" && parseFloat(detail.qtyRequested) > 0
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
    setMessage("");
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
    try {
      const str = String(dateString).replace("T", " ");
      const m = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
      if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}`;
      const d = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (d) return `${d[3]}/${d[2]}/${d[1]}`;
      return dateString;
    } catch {
      return 'Invalid Date';
    }
  };

  // Hàm lấy màu cho trạng thái
  const getStatusColor = (status) => {
    switch (status) {
      case 1: return 'is-approved';
      case 2: return 'is-rejected';
      case 0:
      default: return 'is-pending';
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

  // Adapter array for MaterialSearchInput — maps raw materials to expected shape
  const materialSearchItems = useMemo(
    () => materials.map((m) => ({
      id: m.id,
      materialName: m.name,
      materialCode: m.code || '',
      unitName: units.find((u) => u.id === m.unitId)?.name || '',
    })),
    [materials, units]
  );

  const historyTotalPages = Math.max(1, Math.ceil(requestHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages - 1);
  const pagedRequestHistory = requestHistory.slice(
    safeHistoryPage * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE
  );

  return (
    <div className="ui-page">
      <div className="ui-page-frame create-issue-request">
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Tạo phiếu xin lĩnh</h1>
          </div>
          <div className="ui-tabs" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`ui-tab ${activeTab === "create" ? "is-active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              Tạo phiếu xin lĩnh
            </button>
            <button
              type="button"
              className={`ui-tab ${activeTab === "history" ? "is-active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Lịch sử đã gửi ({requestHistory.length})
            </button>
          </div>
        </div>

      {message && (
        <div className={`ui-alert ${message.includes("thành công") ? "is-success" : "is-error"}`}>
          {message}
        </div>
      )}

      {/* Tab Tạo Phiếu Xin Lĩnh */}
      {activeTab === "create" && (
        <form onSubmit={handleSubmit} className="issue-form">
          {/* Form gộp: thông tin + bảng vật tư */}
          <div className="ui-section">
            {/* Thông tin người xin lĩnh — hàng ngang */}
            <div className="cir-sender-row">
              <span><span className="cir-sender-label">Họ và tên:</span> {currentUser?.fullName || "—"}</span>
              <span className="cir-sender-sep">|</span>
              <span><span className="cir-sender-label">Khoa / Phòng:</span> {currentUser?.departmentName || "—"}</span>
              <span className="cir-sender-sep">|</span>
              <span><span className="cir-sender-label">Bộ môn:</span> {subDepartments.find(sd => sd.id.toString() === formData.subDepartmentId)?.name || "—"}</span>
              <span className="cir-sender-sep">|</span>
              <span><span className="cir-sender-label">Email:</span> {currentUser?.email || "—"}</span>
              <span className="cir-sender-sep">|</span>
              <span><span className="cir-sender-label">Chức vụ:</span> {currentUser?.role || "Cán bộ"}</span>
            </div>

            <div className="ui-field">
              <label className="ui-label">Ghi chú</label>
              <textarea
                value={formData.note || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="ui-textarea form-textarea"
                placeholder="Nhập ghi chú cho phiếu xin lĩnh"
                rows={3}
                required
              />
            </div>

            <hr className="cir-divider" />
            <p className="cir-sub-label">Danh sách vật tư xin lĩnh</p>

            <div className="ui-table-wrap table-container">
              <table className="ui-table issue-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>TT</th>
                    <th style={{ width: 110 }}>Mã code</th>
                    <th>Tên vật tư hóa chất</th>
                    <th>Quy cách đóng gói</th>
                    <th style={{ width: 110 }}>Đơn vị tính</th>
                    <th style={{ width: 120 }}>Số lượng xin cấp</th>
                    <th>Hãng sản xuất</th>
                    <th style={{ width: 80 }}>Loại</th>
                    <th style={{ width: 80 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.details.map((detail, index) => (
                    <tr key={index}>
                      <td className="text-center" data-label="TT">{index + 1}</td>
                      <td data-label="Mã code">
                        <input
                          type="text"
                          value={detail.proposedCode || ""}
                          onChange={(e) => handleDetailChange(index, "proposedCode", e.target.value)}
                          onBlur={(e) => handleCodeBlur(index, e.target.value)}
                          className="ui-input table-input"
                          placeholder="Nhập mã"
                        />
                      </td>
                      <td className="material-search-cell" data-label="Tên vật tư">
                        <MaterialSearchInput
                          value={detail.materialName || ""}
                          onChange={(text) => handleDetailChange(index, "materialName", text)}
                          onSelect={(item) => {
                            const original = materials.find((m) => m.id === item.id);
                            if (original) handleMaterialSelect(original, index);
                          }}
                          items={materialSearchItems}
                          placeholder="Nhập tên vật tư để tìm kiếm..."
                        />
                      </td>
                      <td data-label="Quy cách">
                        <input className="ui-input table-input" type="text" value={detail.spec || ""} readOnly />
                      </td>
                      <td data-label="Đơn vị">
                        <input className="ui-input table-input" type="text" value={units.find(u => u.id == detail.unitId)?.name || ""} readOnly />
                      </td>
                      <td data-label="Số lượng">
                        <input
                          type="text"
                          value={detail.qtyRequested || ""}
                          onChange={(e) => handleQtyChange(index, e.target.value)}
                          className="ui-input table-input number-input"
                          placeholder="0"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          title="Chỉ được nhập số nguyên"
                        />
                      </td>
                      <td data-label="Hãng SX">
                        <input className="ui-input table-input" type="text" value={detail.proposedManufacturer || ""} readOnly />
                      </td>
                      <td data-label="Loại">
                        <input className="ui-input table-input" type="text" value={detail.category ? getCategoryLabel(detail.category) : ""} readOnly />
                      </td>
                      <td className="text-center" data-label="Thao tác">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="ui-btn ui-btn-danger ui-btn-sm btn-remove-row"
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

            <div className="cir-table-footer">
              <button
                type="button"
                onClick={addNewRow}
                className="ui-btn ui-btn-secondary ui-btn-sm btn-add-row"
                disabled={loading}
              >
                + Thêm hàng
              </button>
            </div>

            <div className="cir-help">
              <button
                type="button"
                className="cir-help-toggle"
                onClick={() => setShowHelp((v) => !v)}
              >
                <span>? Hướng dẫn nhập bảng</span>
                <span className="cir-help-chevron">{showHelp ? "▲" : "▼"}</span>
              </button>
              {showHelp && (
                <ul className="cir-help-list">
                  <li><strong>Nhập mã code</strong>: Hệ thống tự động điền thông tin nếu mã tồn tại trong danh mục</li>
                  <li><strong>Nhập tên vật tư</strong>: Click vào ô để mở cửa sổ tìm kiếm thông minh</li>
                  <li><strong>Vật tư có sẵn</strong>: Thông tin được khóa, chỉ nhập số lượng</li>
                  <li><strong>Vật tư mới</strong>: Cần nhập đầy đủ tất cả thông tin</li>
                  <li><strong>Loại vật tư</strong>: Tự động điền khi chọn vật tư có sẵn, không thể thay đổi</li>
                  <li><strong>Số lượng</strong>: Chỉ nhập số nguyên dương</li>
                </ul>
              )}
            </div>
          </div>

          <div className="ui-modal-footer">
            <button
              type="button"
              onClick={resetForm}
              className="ui-btn ui-btn-secondary btn-cancel"
              disabled={loading}
            >
              Làm mới
            </button>
            <button
              type="submit"
              disabled={loading || !currentUser?.departmentId}
              className="ui-btn ui-btn-primary btn-submit"
            >
              {loading ? "Đang tạo..." : "Gửi Phiếu Xin Lĩnh"}
            </button>
          </div>
        </form>
      )}

      {/* Tab Lịch Sử Phiếu Đã Gửi */}
      {activeTab === "history" && (
        <div className="ui-section history-section">
          <div className="ui-section-head">
            <div><h2 className="ui-section-title">Lịch sử phiếu xin lĩnh đã gửi</h2></div>
            <div className="ui-toolbar-actions">
              <button
                type="button"
                onClick={fetchRequestHistory}
                className="ui-btn ui-btn-secondary ui-btn-sm btn-refresh"
                disabled={historyLoading}
              >
                {historyLoading ? "Đang tải..." : "Làm mới"}
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="ui-empty">Đang tải lịch sử phiếu xin lĩnh...</div>
          ) : requestHistory.length === 0 ? (
            <div className="ui-empty">Chưa có phiếu xin lĩnh nào được gửi</div>
          ) : (
            <div className="ui-table-wrap table-container">
              <table className="ui-table history-table">
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
                  {pagedRequestHistory.map((request) => (
                    <tr key={request.id}>
                      <td className="text-center" data-label="Mã phiếu">{request.id}</td>
                      <td className="text-center" data-label="Ngày gửi">{formatDate(request.requestedAt)}</td>
                      <td data-label="Mục đích">{request.note}</td>
                      <td className="text-center" data-label="Số vật tư">{request.details?.length || 0}</td>
                      <td className="text-center" data-label="Trạng thái">
                        <span className={`ui-status-badge ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                      </td>
                      <td className="text-center" data-label="Thao tác">
                        <button
                          type="button"
                          onClick={() => showRequestDetails(request)}
                          className="ui-btn ui-btn-secondary ui-btn-sm"
                          title="Xem"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!historyLoading && requestHistory.length > 0 ? (
            <div className="ui-pagination" aria-label="Phân trang lịch sử phiếu xin lĩnh">
              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                disabled={safeHistoryPage <= 0}
              >
                Trang trước
              </button>

              {visiblePageNumbers(historyTotalPages, safeHistoryPage).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`ui-pagination-btn ${page === safeHistoryPage ? "is-active" : ""}`}
                  onClick={() => setHistoryPage(page)}
                  disabled={page === safeHistoryPage}
                >
                  {page + 1}
                </button>
              ))}

              <button
                type="button"
                className="ui-pagination-btn"
                onClick={() => setHistoryPage((page) => Math.min(historyTotalPages - 1, page + 1))}
                disabled={safeHistoryPage >= historyTotalPages - 1}
              >
                Trang sau
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Modal chi tiết phiếu xin lĩnh */}
      {selectedRequest && (
        <div className="ui-modal-overlay" onClick={closeRequestDetails}>
          <div className="ui-modal" style={{ width: "min(920px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="ui-history-detail">
              <div className="ui-history-detail-head">
                Chi tiết Phiếu Xin Lĩnh #{selectedRequest.id}
              </div>

              <div className="ui-history-detail-body">
                <div className="ui-history-info">
                  <div className="ui-history-info-row">
                    <span className="ui-history-info-label">Mã phiếu:</span>
                    <span className="ui-history-info-value">{selectedRequest.id}</span>
                  </div>
                  <div className="ui-history-info-row">
                    <span className="ui-history-info-label">Ngày gửi:</span>
                    <span className="ui-history-info-value">{formatDate(selectedRequest.requestedAt)}</span>
                  </div>
                  <div className="ui-history-info-row">
                    <span className="ui-history-info-label">Mục đích sử dụng:</span>
                    <span className="ui-history-info-value">{selectedRequest.note}</span>
                  </div>
                  <div className="ui-history-info-row">
                    <span className="ui-history-info-label">Trạng thái:</span>
                    <span className="ui-history-info-value">
                      <span className={`ui-status-badge ${getStatusColor(selectedRequest.status)}`}>
                        {getStatusLabel(selectedRequest.status)}
                      </span>
                    </span>
                  </div>
                  {selectedRequest.approvalNote && (
                    <div className="ui-history-info-row">
                      <span className="ui-history-info-label">Ghi chú phê duyệt:</span>
                      <span className="ui-history-info-value">{selectedRequest.approvalNote}</span>
                    </div>
                  )}
                </div>

                <div className="ui-section">
                  <div className="ui-section-head">
                    <div>
                      <h3 className="ui-section-title">Danh sách vật tư</h3>
                      <p className="ui-section-subtitle">{selectedRequest.details?.length || 0} vật tư</p>
                    </div>
                  </div>

                  <div className="ui-table-wrap">
                    <table className="ui-table details-table">
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
                            <td className="text-center" data-label="TT">{index + 1}</td>
                            <td data-label="Mã code">{detail.proposedCode || 'N/A'}</td>
                            <td data-label="Tên vật tư">{getMaterialDisplayName(detail)}</td>
                            <td data-label="Quy cách">{getMaterialDisplaySpec(detail)}</td>
                            <td className="text-center" data-label="Đơn vị">
                              {getUnitName(detail)}
                            </td>
                            <td className="text-center" data-label="Số lượng">{detail.qtyRequested || 'N/A'}</td>
                            <td data-label="Hãng SX">{detail.proposedManufacturer || 'N/A'}</td>
                            <td className="text-center" data-label="Loại">{detail.category || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="ui-modal-footer">
              <button type="button" className="ui-btn ui-btn-secondary" onClick={closeRequestDetails}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
