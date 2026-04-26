import React, { useState } from "react";
import "./dashboard-ui.css";

/* Trang thêm vật tư y tế mới vào danh sách quản lý (demo – chưa kết nối API). */
export default function AddEquipment({ onAdd }) {
  const [form, setForm] = useState({
    code: "", name: "", department: "", status: "", date: "", value: "", notes: ""
  });

  function handleChange(e) {
    const { id, value } = e.target;
    setForm(prev => ({ ...prev, [id]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.code || !form.name || !form.department || !form.status || !form.date || !form.value) {
      return;
    }
    onAdd({
      code: form.code,
      name: form.name,
      department: form.department,
      status: form.status,
      date: form.date,
      value: parseInt(form.value, 10) || 0,
      notes: form.notes
    });
    setForm({ code: "", name: "", department: "", status: "", date: "", value: "", notes: "" });
  }

  function reset() {
    setForm({ code: "", name: "", department: "", status: "", date: "", value: "", notes: "" });
  }

  return (
    <div className="ui-page">
      <div className="ui-page-frame">
        {/* Page header */}
        <div className="ui-page-head">
          <div>
            <h1 className="ui-page-title">Thêm vật tư y tế</h1>
          </div>
        </div>

        <div className="ui-section">
          <form onSubmit={submit}>
            {/* Thông tin cơ bản */}
            <div className="ui-form-grid cols-2">
              <div className="ui-field">
                <label className="ui-label" htmlFor="code">Mã vật tư <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  id="code"
                  className="ui-input"
                  placeholder="VD: TB001"
                  value={form.code}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="name">Tên vật tư / thiết bị <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  id="name"
                  className="ui-input"
                  placeholder="VD: Máy đo huyết áp"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="department">Khoa / Phòng <span style={{ color: "#dc2626" }}>*</span></label>
                <select id="department" className="ui-select" value={form.department} onChange={handleChange} required>
                  <option value="">Chọn khoa phòng</option>
                  <option value="Khoa Nội">Khoa Nội</option>
                  <option value="Khoa Ngoại">Khoa Ngoại</option>
                  <option value="Khoa Sản">Khoa Sản</option>
                  <option value="Khoa Nhi">Khoa Nhi</option>
                  <option value="Khoa Cấp cứu">Khoa Cấp cứu</option>
                  <option value="Khoa Xét nghiệm">Khoa Xét nghiệm</option>
                  <option value="Khoa Tim mạch">Khoa Tim mạch</option>
                  <option value="Khoa Thần kinh">Khoa Thần kinh</option>
                </select>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="status">Tình trạng <span style={{ color: "#dc2626" }}>*</span></label>
                <select id="status" className="ui-select" value={form.status} onChange={handleChange} required>
                  <option value="">Chọn tình trạng</option>
                  <option value="Hoạt động tốt">Hoạt động tốt</option>
                  <option value="Cần bảo trì">Cần bảo trì</option>
                  <option value="Hỏng hóc">Hỏng hóc</option>
                  <option value="Ngừng sử dụng">Ngừng sử dụng</option>
                </select>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="date">Ngày nhập / ngày mua <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  id="date"
                  className="ui-input"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="value">Giá trị (VNĐ) <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  id="value"
                  className="ui-input"
                  type="number"
                  min="0"
                  placeholder="VD: 5000000"
                  value={form.value}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div className="ui-field" style={{ marginTop: 14 }}>
              <label className="ui-label" htmlFor="notes">Ghi chú thêm</label>
              <textarea
                id="notes"
                className="ui-textarea"
                rows="3"
                placeholder="Nhập mô tả, nhà sản xuất, số serial hoặc thông tin liên quan khác..."
                value={form.notes}
                onChange={handleChange}
              />
            </div>

            {/* Nút hành động */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button type="button" className="ui-btn ui-btn-secondary" onClick={reset}>
                Nhập lại
              </button>
              <button type="submit" className="ui-btn ui-btn-primary">
                Thêm vật tư
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
