import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { storage } from '../../utils/storage';
import { colors, radius } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { Section, Field, Input, Button, Badge, SegmentControl, MonoBadge, Empty, Pagination } from '../../theme/ui';

const PAGE_SIZE = 8;

export default function ReceiptScreen() {
  const [activeTab, setActiveTab] = useState('create');
  const [currentUser, setCurrentUser] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    receiptDate: new Date().toISOString().split('T')[0],
    supplierName: '',
    note: '',
    details: [createRow()],
  });

  function createRow() {
    return { materialId: null, materialName: '', unitId: '', qty: '', unitPrice: '', batchNumber: '', expiryDate: '' };
  }

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      Promise.all([fetchMaterials(), fetchUnits()]);
      if (u?.id) fetchHistory(u.id);
    });
  }, []);

  async function fetchMaterials() {
    try {
      const r = await fetch(API_ENDPOINTS.MATERIALS);
      const d = await r.json();
      setMaterials(Array.isArray(d) ? d : []);
    } catch { setMaterials([]); }
  }

  async function fetchUnits() {
    try {
      const r = await fetch(API_ENDPOINTS.UNITS);
      const d = await r.json();
      setUnits(Array.isArray(d) ? d : []);
    } catch { setUnits([]); }
  }

  async function fetchHistory(userId) {
    setHistLoading(true);
    try {
      const r = await fetch(API_ENDPOINTS.RECEIPTS, { headers: buildHeaders(userId) });
      const d = await r.json();
      setHistory(Array.isArray(d) ? d : (d?.content || []));
    } catch { setHistory([]); }
    finally { setHistLoading(false); }
  }

  const updateRow = (i, key, val) => {
    setForm((f) => {
      const details = [...f.details];
      details[i] = { ...details[i], [key]: val };
      return { ...f, details };
    });
  };

  const handleSubmit = async () => {
    const validRows = form.details.filter((d) => d.qty && Number(d.qty) > 0);
    if (!validRows.length) {
      Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 vật tư!' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        receiptDate: form.receiptDate,
        supplierName: form.supplierName,
        note: form.note,
        createdById: currentUser?.id,
        details: validRows.map((d) => ({
          materialId: d.materialId || null,
          materialName: d.materialName,
          unitId: d.unitId ? Number(d.unitId) : null,
          qty: Number(d.qty),
          unitPrice: d.unitPrice ? Number(d.unitPrice) : null,
          batchNumber: d.batchNumber,
          expiryDate: d.expiryDate || null,
        })),
      };
      const r = await fetch(API_ENDPOINTS.RECEIPTS, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Nhập kho thành công!' });
        setForm({ receiptDate: new Date().toISOString().split('T')[0], supplierName: '', note: '', details: [createRow()] });
        setActiveTab('history');
        if (currentUser?.id) fetchHistory(currentUser.id);
      } else {
        Toast.show({ type: 'error', text1: d.error || 'Nhập kho thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setLoading(false);
    }
  };

  // Pagination — reset to page 1 when the history list changes
  useEffect(() => { setPage(1); }, [history]);
  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedHistory = history.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // Running total of the create form (prototype "Tổng chi phí")
  const rcTotal = form.details.reduce(
    (sum, d) => sum + (Number(d.qty) || 0) * (Number(d.unitPrice) || 0),
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >

        <SegmentControl
          segments={[
            { key: 'create', label: 'Tạo phiếu' },
            { key: 'history', label: 'Lịch sử' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'create' ? (
          <>
            <Section title="Thông tin phiếu nhập">
              <Field label="Ngày nhập">
                <Input
                  value={form.receiptDate}
                  onChangeText={(v) => setForm((f) => ({ ...f, receiptDate: v }))}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
              <Field label="Nhà cung cấp">
                <Input
                  value={form.supplierName}
                  onChangeText={(v) => setForm((f) => ({ ...f, supplierName: v }))}
                  placeholder="Tên nhà cung cấp"
                />
              </Field>
              <Field label="Ghi chú">
                <Input
                  value={form.note}
                  onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
                  placeholder="Ghi chú..."
                  multiline
                />
              </Field>
            </Section>

            <Section title="Danh sách vật tư nhập kho">
              {form.details.map((row, i) => (
                <View key={i} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>Vật tư #{i + 1}</Text>
                    {form.details.length > 1 && (
                      <TouchableOpacity onPress={() => setForm((f) => ({ ...f, details: f.details.filter((_, idx) => idx !== i) }))}>
                        <Text style={styles.removeText}>✕ Xóa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Field label="Tên vật tư">
                    <Input placeholder="Tên vật tư" value={row.materialName} onChangeText={(v) => updateRow(i, 'materialName', v)} />
                  </Field>
                  <View style={styles.twoCol}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Field label="Số lượng">
                        <Input placeholder="Số lượng" value={row.qty} onChangeText={(v) => updateRow(i, 'qty', v)} keyboardType="numeric" />
                      </Field>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Đơn giá">
                        <Input placeholder="Đơn giá" value={row.unitPrice} onChangeText={(v) => updateRow(i, 'unitPrice', v)} keyboardType="numeric" />
                      </Field>
                    </View>
                  </View>
                  <Field label="Số lô">
                    <Input placeholder="Số lô" value={row.batchNumber} onChangeText={(v) => updateRow(i, 'batchNumber', v)} />
                  </Field>
                  <Field label="Hạn dùng">
                    <Input placeholder="Hạn dùng (YYYY-MM-DD)" value={row.expiryDate} onChangeText={(v) => updateRow(i, 'expiryDate', v)} />
                  </Field>
                  <Field label="Đơn vị tính">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {units.map((u) => {
                        const on = row.unitId === String(u.id);
                        return (
                          <TouchableOpacity key={u.id} style={[styles.chip, on && styles.chipActive]} onPress={() => updateRow(i, 'unitId', String(u.id))}>
                            <Text style={[styles.chipText, on && styles.chipTextActive]}>{u.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </Field>
                </View>
              ))}

              <TouchableOpacity style={styles.addBtn} onPress={() => setForm((f) => ({ ...f, details: [...f.details, createRow()] }))}>
                <Text style={styles.addBtnText}>＋ Thêm vật tư</Text>
              </TouchableOpacity>

              {/* Total cost card (prototype) */}
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Tổng chi phí</Text>
                <Text style={styles.totalValue}>{rcTotal.toLocaleString('vi-VN')} đ</Text>
              </View>

              <Button title={loading ? '' : 'Lưu phiếu nhập'} onPress={handleSubmit} disabled={loading} style={{ marginTop: 10 }}>
                {loading ? <ActivityIndicator color={colors.white} /> : null}
              </Button>
            </Section>
          </>
        ) : (
          <View>
            {histLoading && history.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
            ) : history.length === 0 ? (
              <Empty>Chưa có phiếu nhập nào</Empty>
            ) : (
              <>
                {pagedHistory.map((item) => (
                  <TouchableOpacity key={String(item.id)} style={styles.histCard} onPress={() => setSelected(item)} activeOpacity={0.85}>
                    <View style={styles.histTop}>
                      <MonoBadge>PN #{item.id}</MonoBadge>
                      <Text style={styles.histDate}>
                        {item.receiptDate ? new Date(item.receiptDate).toLocaleDateString('vi-VN') : '—'}
                      </Text>
                    </View>
                    <Text style={styles.histSupplier} numberOfLines={1}>{item.supplierName || 'Nhà cung cấp'}</Text>
                    <Text style={styles.histMeta}>{(item.details || []).length} vật tư</Text>
                  </TouchableOpacity>
                ))}
                <Pagination
                  page={pageSafe}
                  totalPages={totalPages}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              </>
            )}
          </View>
        )}

      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>Phiếu nhập #{selected.id}</Text>
                {[['Ngày nhập', selected.receiptDate ? new Date(selected.receiptDate).toLocaleDateString('vi-VN') : '—'], ['Nhà cung cấp', selected.supplierName || '—'], ['Ghi chú', selected.note || '—']].map(([k, v]) => (
                  <View key={k} style={styles.infoRow}><Text style={styles.infoKey}>{k}:</Text><Text style={styles.infoVal}>{v}</Text></View>
                ))}
                <Text style={[styles.label, { marginTop: 12 }]}>Danh sách vật tư:</Text>
                {(selected.details || []).map((d, i) => (
                  <View key={i} style={styles.detailItem}>
                    <Text style={styles.detailName}>{d.materialName}</Text>
                    <Text style={styles.detailMeta}>SL: {d.qty} {d.unitName || ''} | Đơn giá: {d.unitPrice ? d.unitPrice.toLocaleString('vi-VN') : '—'} đ</Text>
                    {d.batchNumber && <Text style={styles.detailMeta}>Số lô: {d.batchNumber}</Text>}
                    {d.expiryDate && <Text style={styles.detailMeta}>HSD: {d.expiryDate}</Text>}
                  </View>
                ))}
                <Button title="Đóng" variant="secondary" onPress={() => setSelected(null)} style={{ marginTop: 16 }} />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24, paddingHorizontal: 10 },
  label: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.label, marginBottom: 8 },
  twoCol: { flexDirection: 'row' },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSoft },
  chipTextActive: { color: colors.white, fontFamily: fontFamily.semibold },
  rowCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 10, backgroundColor: colors.white },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rowTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.primary },
  removeText: { fontSize: 13, color: colors.danger },
  addBtn: { borderWidth: 1, borderColor: '#c7d2e0', borderRadius: 11, borderStyle: 'dashed', backgroundColor: '#f8fafd', paddingVertical: 11, alignItems: 'center' },
  addBtnText: { color: colors.primary, fontFamily: fontFamily.bold, fontSize: 13 },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginTop: 12,
  },
  totalLabel: { fontSize: 13, color: colors.textSoft, fontFamily: fontFamily.medium },
  totalValue: { fontSize: 16, color: colors.primary, fontFamily: fontFamily.extrabold },
  histCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  histDate: { fontSize: 11, color: '#94a3b8' },
  histSupplier: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  histMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  infoKey: { fontSize: 13, color: colors.textSoft, width: 110 },
  infoVal: { fontSize: 13, color: colors.text, flex: 1, fontFamily: fontFamily.medium },
  detailItem: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, marginBottom: 8 },
  detailName: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text, marginBottom: 4 },
  detailMeta: { fontSize: 12, color: colors.textSoft },
});
