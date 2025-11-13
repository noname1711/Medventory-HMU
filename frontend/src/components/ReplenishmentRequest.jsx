import React from "react";
import "./ReplenishmentRequest.css";

export default function ReplenishmentRequest({
  items,
  materials,
  departments,
  selectedDept,
  setSelectedDept,
  onChangeItem,
  onAddRow,
  onDeleteRow,
  onSubmit,
  onLoadPrevious
}) {
  const UNIT_MAP = {
  1: "Hộp",
  2: "Chai",
  3: "Cái",
  4: "Túi",
  5: "Bộ"
};

  const handleSelectMaterial = (index, e) => {
    const id = e.target.value;
    const material = materials.find(m => m.materialId === Number(id));

    if (material) {
      onChangeItem(index, { target: { name: "materialId", value: material.materialId }});
      onChangeItem(index, { target: { name: "materialName", value: material.materialName }});
      onChangeItem(index, { target: { name: "specification", value: material.specification }});
      onChangeItem(index, { target: { name: "unitId", value: material.unitId }});
      onChangeItem(index, { target: { name: "materialCode", value: material.materialCode }});
      onChangeItem(index, { target: { name: "manufacturer", value: material.manufacturer }});
    } else {
      onChangeItem(index, { target: { name: "materialId", value: "" }});
    }
  };

  return (
    <div className="req-root card">
      <div className="req-header">
        <h3>Phiếu Dự Trù Bổ Sung Hàng Hoá</h3>
      </div>

      <form className="req-form" onSubmit={onSubmit}>

        <div className="req-field half">
          <label>Chọn bộ môn lập dự trù</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            required
          >
            <option value="">-- Chọn bộ môn --</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="req-actions" style={{ marginBottom: "12px" }}>
  <button 
    type="button"
    className="btn secondary"
    onClick={onLoadPrevious}
  >
    🔄 Load dự trù năm trước
  </button>
</div>


        <div className="req-table-wrap">
          <table className="req-table">
           <thead>
  <tr>
    <th>STT</th>
    <th>Tên vật tư</th>
    <th>Quy cách</th>
    <th>ĐVT</th>
    <th>SL hiện có</th>
    <th>Năm trước</th>
    <th>Dự trù</th>     {/* qtyRequested */}
    <th>Mã Code</th>
    <th>Hãng SX</th>
    <th>Lý do</th>
    <th></th>          {/* Cột Xóa riêng */}
  </tr>
</thead>


<tbody>
  {items.length > 0 ? items.map((item, index) => (
    <tr key={item.materialId}>
      <td className="text-center">{index + 1}</td>  {/* STT */}

      {/* Tên vật tư */}
      <td>
        <select
          name="materialId"
          value={item.materialId || ""}
          onChange={(e) => handleSelectMaterial(index, e)}
        >
          <option value="">Chọn vật tư</option>
          {materials.map((m) => (
            <option key={m.materialId} value={m.materialId}>
              {m.materialName}
            </option>
          ))}
        </select>
      </td>

      {/* Quy cách */}
      <td>
        <input name="specification" value={item.specification || ""} readOnly />
      </td>

      {/* Đơn vị tính */}
      <td>
        <input name="unitId" value={UNIT_MAP[item.unitId] || ""} readOnly />  
      </td>

      {/* Số lượng hiện có */}
      <td>
        <input type="number" name="qtyAvailable" value={item.qtyAvailable || ""} onChange={(e) => onChangeItem(index, e)} />
      </td>

      {/* Năm trước */}
      <td>
        <input type="number" name="qtyLastYear" value={item.qtyLastYear || ""} onChange={(e) => onChangeItem(index, e)} />
      </td>

      {/* Dự trù */}
      <td>
        <input type="number" name="qtyRequested" value={item.qtyRequested || ""} onChange={(e) => onChangeItem(index, e)} />
      </td>

      {/* Mã Code */}
      <td>
        <input name="materialCode" value={item.materialCode || ""} readOnly />
      </td>

      {/* Hãng sản xuất */}
      <td>
        <input name="manufacturer" value={item.manufacturer || ""} readOnly />
      </td>

      {/* Lý do dự trù */}
      <td>
        <input name="reason" value={item.reason || ""} onChange={(e) => onChangeItem(index, e)} />
      </td>

      {/* Nút Xóa - nằm ở cột riêng */}
      <td>
        <button type="button" className="link danger" onClick={() => onDeleteRow(item.materialId)}>
          Xóa
        </button>
      </td>
    </tr>
  )) : (
    <tr>
      <td colSpan="11" style={{ textAlign: "center", padding: 20 }}>
        Không có dữ liệu
      </td>
    </tr>
  )}
</tbody>

          </table>
        </div>

        <div className="req-actions">
          <button type="button" className="btn secondary" onClick={onAddRow}>+ Thêm dòng</button>
          <button type="submit" className="btn primary">Gửi phiếu</button>
        </div>
      </form>
    </div>
  );
}
