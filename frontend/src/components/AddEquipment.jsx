import React, { useState } from "react";
import "./AddEquipment.css";

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
      alert("Vui lòng điền đủ thông tin bắt buộc");
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
    <div className="ae-root card">
      <h3>Thêm Vật tư Y tế mới</h3>
      <form className="ae-form" onSubmit={submit}>
        <div className="ae-grid">
          <div className="ae-field">
            <label>Mã vật tư</label>
            <input id="code" value={form.code} onChange={handleChange} required />
          </div>
          <div className="ae-field">
            <label>Tên vật tư</label>
            <input id="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="ae-field">
            <label>Khoa phòng</label>
            <select id="department" value={form.department} onChange={handleChange} required>
              <option value="">Chọn khoa phòng</option>
              <option value="Khoa Nội">Khoa Nội</option>
              <option value="Khoa Ngoại">Khoa Ngoại</option>
              <option value="Khoa Sản">Khoa Sản</option>
              <option value="Khoa Nhi">Khoa Nhi</option>
              <option value="Khoa Cấp cứu">Khoa Cấp cứu</option>
              <option value="Khoa Xét nghiệm">Khoa Xét nghiệm</option>
            </select>
          </div>

          <div className="ae-field">
            <label>Trạng thái</label>
            <select id="status" value={form.status} onChange={handleChange} required>
              <option value="">Chọn trạng thái</option>
              <option value="Hoạt động tốt">Hoạt động tốt</option>
              <option value="Cần bảo trì">Cần bảo trì</option>
              <option value="Hỏng hóc">Hỏng hóc</option>
            </select>
          </div>

          <div className="ae-field">
            <label>Ngày mua</label>
            <input id="date" type="date" value={form.date} onChange={handleChange} required />
          </div>
          <div className="ae-field">
            <label>Giá trị (VNĐ)</label>
            <input id="value" type="number" value={form.value} onChange={handleChange} required />
          </div>
        </div>

        <div className="ae-field full">
          <label>Ghi chú</label>
          <textarea id="notes" rows="3" value={form.notes} onChange={handleChange}></textarea>
        </div>

        <div className="ae-actions">
          <button type="button" className="btn cancel" onClick={reset}>Hủy</button>
          <button type="submit" className="btn primary">Thêm vật tư</button>
        </div>
      </form>
    </div>
  );
}
