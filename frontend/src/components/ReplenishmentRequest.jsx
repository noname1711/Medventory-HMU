import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "./dashboard-ui.css";
import "./ReplenishmentRequest.css";
import MaterialSearchInput from "./MaterialSearchInput";

export default function ReplenishmentRequest() {
  const UNIT_MAP = useMemo(() => ({
    1: "Chai",
    2: "Lọ",
    3: "Hộp",
    4: "Cái",
    5: "ml",
    6: "g",
    7: "Viên",
    8: "kg",
    9: "Bộ",
  }), []);

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

  function handleSelectMaterial(index, material) {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        materialId: material.materialId,
        materialName: material.materialName,
        specification: material.specification || "",
        unitId: material.unitId || "",
        materialCode: material.materialCode || "",
        manufacturer: material.manufacturer || "",
      };
      return updated;
    });
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
        reason: "Tải từ dự trù năm trước",
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

  // Adapter array for MaterialSearchInput (id, materialName, materialCode, unitName)
  const materialSearchItems = useMemo(
    () => materials.map((m) => ({
      id: m.materialId,
      materialName: m.materialName,
      materialCode: m.materialCode || '',
      unitName: UNIT_MAP[m.unitId] || '',
    })),
    [materials, UNIT_MAP]
  );

  return (
    <div className="ui-page req-page">
      <div className="ui-page-frame">
        <div className="ui-page-stack">
          <div className="ui-card-header req-page-header">
            <div>
              <h3 className="ui-card-title">Tạo phiếu dự trù bổ sung vật tư</h3>
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
                          <td className="text-center" data-label="STT">{index + 1}</td>

                          <td data-label="Tên vật tư">
                            <MaterialSearchInput
                              value={item.materialName || ""}
                              onChange={(text) =>
                                setItems((prev) => {
                                  const u = [...prev];
                                  u[index] = { ...u[index], materialName: text };
                                  return u;
                                })
                              }
                              onSelect={(selectedItem) => {
                                const original = materials.find(
                                  (m) => m.materialId === selectedItem.id
                                );
                                if (original) handleSelectMaterial(index, original);
                              }}
                              items={materialSearchItems}
                              placeholder="Chọn vật tư"
                            />
                          </td>

                          <td data-label="Quy cách">
                            <input
                              className="ui-input"
                              name="specification"
                              value={item.specification || ""}
                              readOnly
                            />
                          </td>

                          <td data-label="ĐVT">
                            <input
                              className="ui-input"
                              name="unitId"
                              value={UNIT_MAP[item.unitId] || ""}
                              readOnly
                            />
                          </td>

                          <td data-label="SL hiện có">
                            <input
                              className="ui-input"
                              type="number"
                              name="qtyAvailable"
                              value={item.qtyAvailable || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td data-label="Năm trước">
                            <input
                              className="ui-input"
                              type="number"
                              name="qtyLastYear"
                              value={item.qtyLastYear || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td data-label="Dự trù">
                            <input
                              className="ui-input"
                              type="number"
                              name="qtyRequested"
                              value={item.qtyRequested || ""}
                              onChange={(e) => changeItem(index, e)}
                            />
                          </td>

                          <td data-label="Mã code">
                            <input
                              className="ui-input"
                              name="materialCode"
                              value={item.materialCode || ""}
                              readOnly
                            />
                          </td>

                          <td data-label="Hãng SX">
                            <input
                              className="ui-input"
                              name="manufacturer"
                              value={item.manufacturer || ""}
                              readOnly
                            />
                          </td>

                          <td data-label="Lý do">
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
