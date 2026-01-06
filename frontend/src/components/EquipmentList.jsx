import React, { useEffect, useState } from "react";
import "./EquipmentList.css";

export default function InventoryPage() {
  const UNIT_MAP = {
    1: "Chai",
    2: "Lọ",
    3: "Hộp",
    4: "Cái",
    5: "ml",
    6: "g",
    7: "Viên",
    8: "kg",
    9: "Bộ"
  };
  
  /* ================= STATE ================= */
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [stockItems, setStockItems] = useState([]);

  const [form, setForm] = useState({
    materialCode: "",
    materialName: "",
    specification: "",
    unitId: "",
    manufacturer: "",
    category: "C"
  });

  /* ================= LOAD DATA ================= */
  // Load units
  useEffect(() => {
    fetch("http://localhost:8080/api/units")
      .then(res => res.json())
      .then(setUnits);
  }, []);

  // Load materials
  useEffect(() => {
    fetch("http://localhost:8080/api/materials")
      .then(res => res.json())
      .then(setProducts);
  }, []);

  // Load inventory stock summary
useEffect(() => {
  fetch("http://localhost:8080/api/inventory/materials")
    .then(res => res.json())
    .then(setStockItems)
    .catch(err => console.error("Load stock error", err));
}, []);

  /* ================= FILTER ================= */

  const filteredProducts = products.filter(p =>
    p.materialName.toLowerCase().includes(keyword.toLowerCase()) ||
    p.materialCode.toLowerCase().includes(keyword.toLowerCase())
  );

  const filteredStockItems = stockItems.filter(p =>
  p.materialName.toLowerCase().includes(keyword.toLowerCase()) ||
  p.materialCode.toLowerCase().includes(keyword.toLowerCase())
  );

  const totalItems = stockItems.length;

  const lowStockItems = stockItems.filter(
  item => item.closingStock > 0 && item.closingStock < 10
  ).length;

  const outOfStockItems = stockItems.filter(
  item => item.closingStock <= 0
  ).length;

  /* ================= SUBMIT ================= */

  async function handleSubmit() {
    try {
      const res = await fetch("http://localhost:8080/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert("Thêm vật tư thành công");

      // reload list
      setProducts(prev => [...prev, data]);

      // reset form
      setForm({
        materialCode: "",
        materialName: "",
        specification: "",
        unitId: "",
        manufacturer: "",
        category: "C"
      });

    } catch (e) {
      alert(e.message);
    }
  }

  /* ================= RENDER ================= */

  return (
    <div className="inventory-page">

      {/* ADD PRODUCT */}
      <div className="card add-form">
        <h3>➕ Thêm hàng hoá mới</h3>

        <div className="form-grid">

          <div className="field">
            <input
              placeholder="Mã VT"
              value={form.materialCode}
              onChange={e => setForm({...form, materialCode: e.target.value})}
            />
            <small>Mã vật tư</small>
          </div>

          <div className="field">
            <input
              placeholder="Tên VT"
              value={form.materialName}
              onChange={e => setForm({...form, materialName: e.target.value})}
            />
            <small>Tên vật tư</small>
          </div>

          <div className="field">
            <input
              placeholder="QC"
              value={form.specification}
              onChange={e => setForm({...form, specification: e.target.value})}
            />
            <small>Quy cách đóng gói</small>
          </div>

          <div className="field">
            <select
              value={form.unitId}
              onChange={e => setForm({...form, unitId: Number(e.target.value)})}
            >
              <option value="">ĐVT</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <small>Đơn vị tính</small>
          </div>

          <div className="field">
            <input
              placeholder="NSX"
              value={form.manufacturer}
              onChange={e => setForm({...form, manufacturer: e.target.value})}
            />
            <small>Hãng sản xuất</small>
          </div>

          <div className="field">
            <select
              value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
            >
              <option value="A">A – Quan trọng</option>
              <option value="B">B – Thiết yếu</option>
              <option value="C">C – Thông dụng</option>
              <option value="D">D – Ít quan trọng</option>
            </select>
            <small>Phân loại vật tư</small>
          </div>

          <div className="field submit">
            <button className="btn primary" onClick={handleSubmit}>
              Thêm
            </button>
            <small>&nbsp;</small>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="inventory-content">

        {/* PRODUCT LIST */}
        <div className="card product-list">
          <div className="list-header">
            <h3>📦 Danh sách hàng hoá</h3>
            <input
              className="search"
              placeholder="🔍 Tìm theo mã hoặc tên..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Tên hàng</th>
      <th>ĐVT</th>
      <th style={{ textAlign: "right" }}>Tồn</th>
    </tr>
  </thead>

  <tbody>
    {filteredStockItems.length > 0 ? (
      filteredStockItems.map(item => (
        <tr key={item.materialId}>
          <td>{item.materialCode}</td>
          <td>{item.materialName}</td>
          <td>{item.unitName}</td>
          <td style={{ textAlign: "right" }}>
            <span
              className={
                item.closingStock <= 0
                  ? "stock-zero"
                  : item.closingStock < 10
                  ? "stock-low"
                  : "stock-ok"
              }
            >
              {item.closingStock}
            </span>
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan="4" style={{ textAlign: "center" }}>
          Không có dữ liệu
        </td>
      </tr>
    )}
  </tbody>
</table>
        </div>

        {/* STOCK SUMMARY (placeholder) */}
<div className="card stock-summary">
  <h3>📊 Tồn kho</h3>

  <p>
    <b>Tổng mặt hàng:</b> {totalItems}
  </p>

  <p className="warn">
    ⚠️ Sắp hết hàng: {lowStockItems} 
  </p>

  <p className="danger">
    ❌ Hết hàng: {outOfStockItems} 
  </p>
</div>


      </div>
    </div>
  );
}
