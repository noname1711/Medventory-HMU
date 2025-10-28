import React, { useState } from "react";
import toast from "react-hot-toast";

export default function ReplenishmentRequest() {
  const [note, setNote] = useState("");
  const [items, setItems] = useState([{ materialName: "", qty: "", unit: "" }]);

  const handleChangeItem = (i, key, value) => {
    const newItems = [...items];
    newItems[i][key] = value;
    setItems(newItems);
  };

  const addRow = () => setItems([...items, { materialName: "", qty: "", unit: "" }]);

  const submit = async () => {
    const body = {
      note,
      details: items.map(i => ({
        materialName: i.materialName,
        qtyRequested: parseFloat(i.qty),
        unit: { id: 1 } // tạm fix, sau này chọn từ dropdown
      }))
    };

    const res = await fetch("http://localhost:8080/api/replenishment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (res.ok) toast.success("Đã gửi phiếu đề nghị!");
    else toast.error("Lỗi khi gửi phiếu!");
  };

  return (
    <div className="card p-6">
      <h3 className="text-xl font-bold mb-4">Đề nghị bổ sung hàng hoá</h3>
      <textarea
        placeholder="Ghi chú..."
        className="border p-2 w-full mb-4 rounded"
        value={note}
        onChange={e => setNote(e.target.value)}
      />

      <table className="w-full border mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th>Tên vật tư</th>
            <th>Số lượng</th>
            <th>Đơn vị</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={idx}>
              <td><input className="border p-1 w-full" value={i.materialName} onChange={e => handleChangeItem(idx, "materialName", e.target.value)} /></td>
              <td><input type="number" className="border p-1 w-full" value={i.qty} onChange={e => handleChangeItem(idx, "qty", e.target.value)} /></td>
              <td><input className="border p-1 w-full" value={i.unit} onChange={e => handleChangeItem(idx, "unit", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={addRow} className="bg-blue-500 text-white px-4 py-2 rounded mr-2">+ Thêm dòng</button>
      <button onClick={submit} className="bg-green-500 text-white px-4 py-2 rounded">Gửi phiếu</button>
    </div>
  );
}
