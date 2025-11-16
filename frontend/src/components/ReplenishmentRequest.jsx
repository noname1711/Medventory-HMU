import React, { useState, useEffect } from "react";
import "./ReplenishmentRequest.css";
import Swal from "sweetalert2";

export default function ReplenishmentRequest() {
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

  // 🟢 Dòng mẫu (emptyRow)
  const emptyRow = {
    rowId: "",           // key nội bộ UI
    materialId: "",
    materialName: "",
    specification: "",
    unitId: "",
    qtyAvailable: "",
    qtyLastYear: "",
    qtyRequested: "",
    materialCode: "",
    manufacturer: "",
    reason: ""
  };

  const [items, setItems] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");

  const handleSelectMaterial = (index, e) => {
    const id = e.target.value;
    const material = materials.find(m => m.materialId === Number(id));

    if (material) {
      changeItem(index, { target: { name: "materialId", value: material.materialId } });
      changeItem(index, { target: { name: "materialName", value: material.materialName } });
      changeItem(index, { target: { name: "specification", value: material.specification } });
      changeItem(index, { target: { name: "unitId", value: material.unitId } });
      changeItem(index, { target: { name: "materialCode", value: material.materialCode } });
      changeItem(index, { target: { name: "manufacturer", value: material.manufacturer } });
    } else {
      changeItem(index, { target: { name: "materialId", value: "" } });
    }
  };

  // 🟢 changeItem tránh mutate object trực tiếp
  function changeItem(index, e) {
    const { name, value } = e.target;
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  }

  // 🟢 Add row – chỉ tạo rowId uuid, materialId = ""
  function addRow() {
    setItems(prev => [...prev, { ...emptyRow, rowId: crypto.randomUUID() }]);
  }

  // 🟢 Delete row dùng rowId
  function deleteRow(rowId) {
    setItems(prev => prev.filter(i => i.rowId !== rowId));
  }

  async function submit(e) {
    e.preventDefault();

    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

    const payload = {
      academicYear: "2025-2026",
      departmentId: selectedDept ? Number(selectedDept) : null,
      createdByEmail: currentUser?.email || null,
      items: items.map(it => ({
        materialId: it.materialId ? Number(it.materialId) : null,
        currentStock: Number(it.qtyAvailable || 0),
        prevYearQty: Number(it.qtyLastYear || 0),
        thisYearQty: Number(it.qtyRequested || 0),
        proposedCode: it.materialCode || null,
        proposedManufacturer: it.manufacturer || null,
        justification: it.reason || null
      }))
    };

    try {
      const res = await fetch("http://localhost:8080/api/supp-forecasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Đã gửi phiếu",
          text: data.message || "Tạo phiếu thành công",
          timer: 1800,
          showConfirmButton: false
        });

        setItems([{ ...emptyRow, rowId: crypto.randomUUID() }]);

      } else {
        Swal.fire({
          icon: "error",
          title: "Gửi thất bại",
          text: data.message || "Lỗi server"
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Lỗi kết nối",
        text: err.message
      });
    }
  }

  async function loadPreviousForecast() {
    try {
      const url = selectedDept
        ? `http://localhost:8080/api/supp-forecasts/previous?departmentId=${selectedDept}`
        : `http://localhost:8080/api/supp-forecasts/previous`;

      const res = await fetch(url);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Không có dữ liệu dự trù năm trước",
          timer: 1500,
          showConfirmButton: false
        });
        return;
      }

      const mapped = data.map(item => ({
        rowId: crypto.randomUUID(),        // 🔥 Tạo key riêng cho UI
        materialId: item.materialId,
        materialName: item.materialName,
        specification: item.specification,
        unitId: item.unitId,
        qtyAvailable: Number(item.currentStock || 0),
        qtyLastYear: Number(item.prevYearQty || 0),
        qtyRequested: Number(item.thisYearQty || 0),
        materialCode: item.materialCode,
        manufacturer: item.manufacturer,
        reason: "Tự động tạo dự trù"
      }));

      setItems(mapped);

      Swal.fire({
        icon: "success",
        title: "Đã load dự trù năm trước",
        timer: 1200,
        showConfirmButton: false
      });

    } catch (err) {
      Swal.fire("Lỗi", err.message, "error");
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/departments");
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      console.error("Lỗi khi lấy departments:", err);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/materials");
      const data = await response.json();
      setMaterials(data);
    } catch (error) {
      console.error("Lỗi khi lấy materials:", error);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchDepartments();
  }, []);

  return (
    <div className="req-root card">
      <div className="req-header">
        <h3>Phiếu Dự Trù Bổ Sung Hàng Hoá</h3>
      </div>

      {/* 🟢 Sửa lại chỗ này */}
      <form className="req-form" onSubmit={submit}>

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
            onClick={loadPreviousForecast}
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
                <th>Dự trù</th>
                <th>Mã Code</th>
                <th>Hãng SX</th>
                <th>Lý do</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {items.length > 0 ? items.map((item, index) => (
                <tr key={item.rowId}>
                  <td className="text-center">{index + 1}</td>

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

                  <td>
                    <input name="specification" value={item.specification || ""} readOnly />
                  </td>

                  <td>
                    <input name="unitId" value={UNIT_MAP[item.unitId] || ""} readOnly />
                  </td>

                  <td>
                    <input type="number" name="qtyAvailable" value={item.qtyAvailable || ""} onChange={(e) => changeItem(index, e)} />
                  </td>

                  <td>
                    <input type="number" name="qtyLastYear" value={item.qtyLastYear || ""} onChange={(e) => changeItem(index, e)} />
                  </td>

                  <td>
                    <input type="number" name="qtyRequested" value={item.qtyRequested || ""} onChange={(e) => changeItem(index, e)} />
                  </td>

                  <td>
                    <input name="materialCode" value={item.materialCode || ""} readOnly />
                  </td>

                  <td>
                    <input name="manufacturer" value={item.manufacturer || ""} readOnly />
                  </td>

                  <td>
                    <input name="reason" value={item.reason || ""} onChange={(e) => changeItem(index, e)} />
                  </td>

                  <td>
                    <button type="button" className="link danger" onClick={() => deleteRow(item.rowId)}>
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
          <button type="button" className="btn secondary" onClick={addRow}>+ Thêm dòng</button>
          <button type="submit" className="btn primary">Gửi phiếu</button>
        </div>

      </form>
    </div>
  );
}
