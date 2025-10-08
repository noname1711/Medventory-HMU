import React, { useEffect, useState } from "react";
import "./EquipmentList.css";

export default function EquipmentList({ equipmentData, onDelete, onEdit }) {
  const [filter, setFilter] = useState("");
  const [displayData, setDisplayData] = useState(equipmentData);

  useEffect(() => {
    if (!filter) setDisplayData(equipmentData);
    else setDisplayData(equipmentData.filter((eq) => eq.status === filter));
  }, [equipmentData, filter]);

  function getStatusClass(s) {
    if (s === "Hoạt động tốt") return "st-badge green";
    if (s === "Cần bảo trì") return "st-badge yellow";
    if (s === "Hỏng hóc") return "st-badge red";
    return "st-badge gray";
  }

  return (
    <div className="el-root card">
      <div className="el-header">
        <h3>Danh sách Vật tư Y tế</h3>
        <div className="el-actions">
          <button className="el-export" onClick={() => alert("Chức năng xuất Excel đang được phát triển!")}>📤 Xuất Excel</button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="el-filter">
            <option value="">Tất cả trạng thái</option>
            <option value="Hoạt động tốt">Hoạt động tốt</option>
            <option value="Cần bảo trì">Cần bảo trì</option>
            <option value="Hỏng hóc">Hỏng hóc</option>
          </select>
        </div>
      </div>

      <div className="el-table-wrap">
        <table className="el-table">
          <thead>
            <tr>
              <th>Mã TB</th>
              <th>Tên vật tư</th>
              <th>Khoa phòng</th>
              <th>Trạng thái</th>
              <th>Ngày mua</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length > 0 ? displayData.map((eq) => (
              <tr key={eq.id}>
                <td>{eq.code}</td>
                <td>{eq.name}</td>
                <td>{eq.department}</td>
                <td><span className={getStatusClass(eq.status)}>{eq.status}</span></td>
                <td>{eq.date}</td>
                <td className="el-actions-col">
                  <button className="link" onClick={() => onEdit(eq.id)}>Sửa</button>
                  <button className="link danger" onClick={() => onDelete(eq.id)}>Xóa</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="6" style={{ textAlign: "center", padding: 20 }}>Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
