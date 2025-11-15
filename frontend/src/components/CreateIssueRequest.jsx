import React, { useState, useEffect } from "react";
import "./CreateIssueRequest.css";

// API Configuration
const API_URL = 'http://localhost:8080/api';
const API_ENDPOINTS = {
  AUTH: `${API_URL}/auth`,
  UNITS: `${API_URL}/units`,
  MATERIALS: `${API_URL}/materials`,
  SUB_DEPARTMENTS: `${API_URL}/departments/sub-departments`,
  ISSUE_REQUESTS: `${API_URL}/issue-requests/canbo`
};

export default function CreateIssueRequest() {
  const [currentUser, setCurrentUser] = useState(null);
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
  const [categories, setCategories] = useState([]); // Categories sẽ được extract từ materials
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [materialSuggestions, setMaterialSuggestions] = useState([]);
  const [showMaterialSuggestions, setShowMaterialSuggestions] = useState({});

  // Lấy thông tin user đầy đủ từ backend
  useEffect(() => {
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
        } else {
          const errorText = await response.text();
        }
      } catch (error) {
        console.error("Lỗi khi fetch user info:", error);
      }
    };

    fetchUserInfo();
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      await Promise.all([
        fetchUnits(),
        fetchMaterials() 
      ]);
    } catch (error) {
      setMessage("Lỗi khi tải dữ liệu từ server");
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.UNITS);
      if (response.ok) {
        const data = await response.json();
        setUnits(data);
      } else {
        throw new Error(`HTTP ${response.status}`);
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
        
        // Extract unique categories từ danh sách materials
        const uniqueCategories = extractCategoriesFromMaterials(data);
        setCategories(uniqueCategories);
        
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Lỗi khi lấy danh sách vật tư:", error);
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
    
    // Chuyển Set thành Array và map thành object có label
    const categoriesArray = Array.from(categorySet).map(category => ({
      value: category,
      label: getCategoryLabel(category)
    }));
    
    // Thêm các category mặc định nếu chưa có
    const defaultCategories = ['A', 'B', 'C', 'D'];
    defaultCategories.forEach(cat => {
      if (!categorySet.has(cat)) {
        categoriesArray.push({
          value: cat,
          label: getCategoryLabel(cat)
        });
      }
    });
    
    // Sắp xếp theo thứ tự A, B, C, D
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

  // Hàm lấy description cho category
  const getCategoryDescription = (category) => {
    const descriptions = {
      'A': 'Vật tư quan trọng',
      'B': 'Vật tư thiết yếu',
      'C': 'Vật tư thông dụng',
      'D': 'Vật tư ít quan trọng'
    };
    return descriptions[category] || 'Không xác định';
  };

  const fetchSubDepartments = async (departmentId) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.SUB_DEPARTMENTS}?departmentId=${departmentId}`);
      if (response.ok) {
        const data = await response.json();
        setSubDepartments(data);
      } else {
        console.warn("Không thể lấy danh sách bộ môn");
      }
    } catch (error) {
      console.error("Lỗi khi lấy danh sách bộ môn:", error);
    }
  };

  // Hàm tìm kiếm vật tư theo tên hoặc mã code
  const searchMaterials = (searchTerm, index) => {
    if (!searchTerm.trim()) {
      setMaterialSuggestions([]);
      setShowMaterialSuggestions(prev => ({...prev, [index]: false}));
      return;
    }

    const filtered = materials.filter(material =>
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (material.code && material.code.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5);

    setMaterialSuggestions(filtered);
    setShowMaterialSuggestions(prev => ({...prev, [index]: true}));
  };

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
          category: material.category // Lấy category từ vật tư có sẵn
        } : detail
      )
    }));
    setShowMaterialSuggestions(prev => ({...prev, [index]: false}));
  };

  const handleDetailChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      details: prev.details.map((detail, i) => 
        i === index ? { ...detail, [field]: value } : detail
      )
    }));

    // Nếu là trường tên vật tư, thực hiện tìm kiếm
    if (field === 'materialName') {
      searchMaterials(value, index);
      
      // Nếu người dùng nhập tay, reset materialId (vật tư mới)
      if (value && !materialSuggestions.find(m => m.name === value)) {
        setFormData(prev => ({
          ...prev,
          details: prev.details.map((detail, i) => 
            i === index ? { 
              ...detail, 
              materialId: null,
              proposedCode: "",
              proposedManufacturer: "",
              category: ""
            } : detail
          )
        }));
      }
    }

    // Nếu là trường mã code, kiểm tra xem có trùng với vật tư có sẵn không
    if (field === 'proposedCode' && value.trim()) {
      const existingMaterial = materials.find(m => m.code === value.trim());
      if (existingMaterial) {
        // Nếu mã code trùng với vật tư có sẵn, tự động điền tất cả thông tin TRỪ số lượng
        const currentQty = formData.details[index].qtyRequested; // Giữ lại số lượng hiện tại
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
              category: existingMaterial.category, // Đảm bảo category được điền
              qtyRequested: currentQty // Giữ nguyên số lượng xin cấp
            } : detail
          )
        }));
      } else {
        // Nếu mã code không trùng, đánh dấu là vật tư mới
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
    // Kiểm tra user có department không
    if (!currentUser?.departmentId) {
      setMessage("Không tìm thấy thông tin khoa phòng của bạn. Vui lòng liên hệ quản trị viên.");
      return false;
    }

    // Kiểm tra ghi chú bắt buộc
    if (!formData.note || !formData.note.trim()) {
      setMessage("Vui lòng nhập mục đích sử dụng ghi chú");
      return false;
    }

    // Lọc các dòng có dữ liệu hợp lệ
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

    // Kiểm tra validation chi tiết cho từng dòng
    for (const detail of validDetails) {
      // Kiểm tra số lượng hợp lệ
      if (parseFloat(detail.qtyRequested) <= 0) {
        setMessage("Số lượng phải lớn hơn 0");
        return false;
      }

      // Kiểm tra mã code không được trùng (nếu là vật tư mới)
      if (isNewMaterial(detail) && isCodeExists(detail.proposedCode)) {
        setMessage(`Mã code "${detail.proposedCode}" đã tồn tại trong danh mục. Vui lòng chọn mã khác.`);
        return false;
      }

      // Kiểm tra category hợp lệ
      if (categories.length > 0 && !categories.some(cat => cat.value === detail.category)) {
        setMessage("Loại vật tư không hợp lệ");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Validate form
      if (!validateForm()) {
        setLoading(false);
        return;
      }

      // Chuẩn bị dữ liệu gửi đi
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

      const response = await fetch(`${API_ENDPOINTS.ISSUE_REQUESTS}/create`, {
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
        setMessage("Tạo phiếu xin lĩnh thành công! Phiếu đã được gửi cho lãnh đạo phê duyệt.");
        resetForm();
      } else {
        setMessage("Lỗi: " + result.message);
      }
    } catch (error) {
      setMessage("Lỗi: " + error.message);
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
    setMaterialSuggestions([]);
    setShowMaterialSuggestions({});
  };

  return (
    <div className="create-issue-request">
      <h1 className="page-title">Tạo Phiếu Xin Lĩnh</h1>
      
      {message && (
        <div className={`message ${message.includes("thành công") ? "success" : "error"}`}>
          {message}
        </div>
      )}

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
              Mục đích sử dụng Ghi chú
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="form-textarea"
              placeholder="Nhập mục đích sử dụng hoặc ghi chú cho phiếu xin lĩnh"
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
                  <th>Tên vật tư hóa chất</th>
                  <th>Quy cách đóng gói</th>
                  <th width="120">Đơn vị tính</th>
                  <th width="120">Số lượng xin cấp</th>
                  <th>Mã code</th>
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
                    <td className="autocomplete-container">
                      <input
                        type="text"
                        value={detail.materialName}
                        onChange={(e) => handleDetailChange(index, "materialName", e.target.value)}
                        className="table-input"
                        placeholder="Nhập tên vật tư hoặc mã code"
                        onFocus={() => searchMaterials(detail.materialName, index)}
                        required
                        disabled={!isNewMaterial(detail)}
                      />
                      {showMaterialSuggestions[index] && materialSuggestions.length > 0 && (
                        <div className="autocomplete-dropdown">
                          {materialSuggestions.map((material, idx) => (
                            <div
                              key={idx}
                              className="autocomplete-item"
                              onClick={() => handleMaterialSelect(material, index)}
                            >
                              <div className="material-name">{material.name}</div>
                              <div className="material-details">
                                {material.code} - {material.spec} - {material.manufacturer} - Loại {material.category}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={detail.qtyRequested}
                        onChange={(e) => handleDetailChange(index, "qtyRequested", e.target.value)}
                        className="table-input number-input"
                        placeholder="0.000"
                        required
                      />
                    </td>
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
            <p>Ghi chú:</p>
            <p>Tất cả các thông tin về vật tư đều bắt buộc phải nhập đầy đủ</p>
            <p>Vật tư có sẵn: Khi nhập mã code trùng với danh mục, thông tin sẽ tự động điền (chỉ cần nhập số lượng)</p>
            <p>Vật tư mới: Khi nhập mã code mới, cần điền đầy đủ tất cả thông tin</p>
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
    </div>
  );
}