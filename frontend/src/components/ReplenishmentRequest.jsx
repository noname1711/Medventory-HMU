import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./ReplenishmentRequest.css";

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
    9: "Bộ",
  };

  /* Tạo một dòng trống dùng chung để tránh lặp code */
  const createEmptyRow = () => ({
    rowId: crypto.randomUUID(),
    materialId: "",
    materialName: "",
    specification: "",
    unitId: "",
    qtyAvailable: "",
    qtyLastYear: "",
    qtyRequested: "",
    materialCode: "",
    manufacturer: "",
    reason: "",
  });

  const [items, setItems] = useState([createEmptyRow()]);
  const [materials, setMaterials] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");

  function changeItem(index, e) {
    const { name, value } = e.target;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  }

  function handleSelectMaterial(index, e) {
    const id = e.target.value;
    const material = materials.find((m) => m.materialId === Number(id));

    if (!material) {
      changeItem(index, { target: { name: "materialId", value: "" } });
      return;
    }

    changeItem(index, { target: { name: "materialId", value: material.materialId } });
    changeItem(index, { target: { name: "materialName", value: material.materialName } });
    changeItem(index, { target: { name: "specification", value: material.specification } });
    changeItem(index, { target: { name: "unitId", value: material.unitId } });
    changeItem(index, { target: { name: "materialCode", value: material.materialCode } });
    changeItem(index, { target: { name: "manufacturer", value: material.manufacturer } });
  }

  function addRow() {
    setItems((prev) => [...prev, createEmptyRow()]);
  }

  function deleteRow(rowId) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
  }

  async function submit(e) {
    e.preventDefault();

    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

    const payload = {
      academicYear: "2025-2026",
      departmentId: selectedDept ? Number(selectedDept) : null,
      createdByEmail: currentUser?.email || null,
      items: items.map((item) => ({
        materialId: item.materialId ? Number(item.materialId) : null,
        currentStock: Number(item.qtyAvailable || 0),
        prevYearQty: Number(item.qtyLastYear || 0),
        thisYearQty: Number(item.qtyRequested || 0),
        proposedCode: item.materialCode || null,
        proposedManufacturer: item.manufacturer || null,
        justification: item.reason || null,
      })),
    };

    try {
      const res = await fetch("http://localhost:8080/api/supp-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Lỗi server");
      }

      Swal.fire({
        icon: "success",
        title: "Đã gửi phiếu",
        text: data.message || "Tạo phiếu thành công",
        timer: 1800,
        showConfirmButton: false,
      });

      setItems([createEmptyRow()]);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Gửi thất bại",
        text: error.message,
      });
    }
  }

  async function loadPreviousForecast() {
    try {
      const url = selectedDept
        ? `http://localhost:8080/api/supp-forecast/previous?departmentId=${selectedDept}`
        : `http://localhost:8080/api/supp-forecast/previous`;

      const res = await fetch(url);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Không có dữ liệu dự trù năm trước",
          timer: 1500,
          showConfirmButton: false,
        });
        return;
      }

      const mapped = data.map((item) => ({
        rowId: crypto.randomUUID(),
        materialId: item.materialId,
        materialName: item.materialName,
        specification: item.specification,
        unitId: item.unitId,
        qtyAvailable: Number(item.currentStock || 0),
        qtyLastYear: Number(item.prevYearQty || 0),
        qtyRequested: Number(item.thisYearQty || 0),
        materialCode: item.materialCode,
        manufacturer: item.manufacturer,
        reason: "Tự động tạo dự trù",
      }));

      setItems(mapped);

      Swal.fire({
        icon: "success",
        title: "Đã tải dự trù năm trước",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire("Lỗi", error.message, "error");
    }
  }

  async function fetchDepartments() {
    try {
      const res = await fetch("http://localhost:8080/api/departments");
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi khi lấy departments:", error);
      setDepartments([]);
    }
  }

  async function fetchMaterials() {
    try {
      const res = await fetch("http://localhost:8080/api/materials");
      const data = await res.json();
      setMaterials(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi khi lấy materials:", error);
      setMaterials([]);
    }
  }

  useEffect(() => {
    fetchMaterials();
    fetchDepartments();
  }, []);

  return (
    <div className="ui-page req-page">
      <div className="ui-page-frame">
        <div className="ui-page-stack">
          <div className="ui-card-header req-page-header">
            <div>
              <h3 className="ui-card-title">Phiếu dự trù bổ sung hàng hóa</h3>
              <p className="ui-card-subtitle">
                Trang này dùng cùng khung trắng, cùng giới hạn chiều ngang và cùng hệ điều khiển với trang danh sách vật tư.
              </p>
            </div>
          </div>

          <section className="ui-section req-card">
            <form className="req-form" onSubmit={submit}>
              <div className="req-topbar">
                <div className="ui-field req-department-field">
                  <label className="ui-label">Chọn bộ môn lập dự trù</label>
                  <select
                    className="ui-select"
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

                <div className="req-top-actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn-secondary"
                    onClick={loadPreviousForecast}
                  >
                    Tải dự trù năm trước
                  </button>
                </div>
              </div>

              <div className="ui-table-wrap">
                <table className="ui-table req-table">
                  <thead>
                    <tr>
                      <th className="text-center">STT</th>
                      <th>Tên vật tư</th>
                      <th>Quy cách</th>
                      <th>ĐVT</th>
                      <th>SL hiện có</th>
                      <th>Năm trước</th>
                      <th>Dự trù</th>
                      <th>Mã code</th>
                      <th>Hãng SX</th>
                      <th>Lý do</th>
                      <th className="text-center">Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.length > 0 ? (
                      items.map((item, index) => (
                        <tr key={item.rowId}>
                          <td className="text-center">{index + 1}</td>

                          <td>
                            <select
                              className="ui-select"
                              name="materialId"
                              value={item.materialId || ""}
                              onChange={(e) => handleSelectMaterial(index, e)}
                            >
                              <option value="">Chọn vật tư</option>
                              {materials.map((material) => (
                                <option key={material.materialId} value={material.materialId}>
                                  {material.materialName}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              name="specification"
                              value={item.specification || ""}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              name="unitId"
                              value={UNIT_MAP[item.unitId] || ""}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              type="number"
                              name="qtyAvailable"
                              value={item.qtyAvailable || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              type="number"
                              name="qtyLastYear"
                              value={item.qtyLastYear || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              type="number"
                              name="qtyRequested"
                              value={item.qtyRequested || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              name="materialCode"
                              value={item.materialCode || ""}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              name="manufacturer"
                              value={item.manufacturer || ""}
                              readOnly
                            />
                          </td>

                          <td>
                            <input
                              className="ui-input"
                              name="reason"
                              value={item.reason || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td className="text-center">
                            <button
                              type="button"
                              className="ui-btn ui-btn-danger ui-btn-sm"
                              onClick={() => deleteRow(item.rowId)}
                              disabled={items.length === 1}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" className="ui-empty">
                          Không có dữ liệu
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="req-actions">
                <button type="button" className="ui-btn ui-btn-secondary" onClick={addRow}>
                  + Thêm dòng
                </button>

                <button type="submit" className="ui-btn ui-btn-primary">
                  Gửi phiếu
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
