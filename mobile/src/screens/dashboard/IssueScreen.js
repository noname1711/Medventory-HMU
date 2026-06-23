import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { storage } from '../../utils/storage';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  PageFrame,
  PageHead,
  Section,
  Field,
  Input,
  Button,
  Badge,
  Empty,
  Pagination,
} from '../../theme/ui';

const PAGE_SIZE = 8;

export default function IssueScreen() {
  const [activeTab, setActiveTab] = useState('create');
  const [currentUser, setCurrentUser] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    issueDate: new Date().toISOString().split('T')[0],
    subDepartmentId: '',
    note: '',
    details: [createRow()],
  });

  function createRow() {
    return { materialId: null, materialName: '', unitId: '', qtyIssued: '' };
  }

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      Promise.all([fetchMaterials(), fetchUnits(), fetchSubDepts()]);
      if (u?.id) fetchHistory(u.id);
    });
  }, []);

  async function fetchMaterials() {
    try { const r = await fetch(API_ENDPOINTS.MATERIALS); setMaterials(await r.json()); } catch { setMaterials([]); }
  }
  async function fetchUnits() {
    try { const r = await fetch(API_ENDPOINTS.UNITS); setUnits(await r.json()); } catch { setUnits([]); }
  }
  async function fetchSubDepts() {
    try { const r = await fetch(API_ENDPOINTS.SUB_DEPARTMENTS); setSubDepartments(await r.json()); } catch { setSubDepartments([]); }
  }
  async function fetchHistory(userId) {
    setHistLoading(true);
    try {
      const r = await fetch(API_ENDPOINTS.ISSUES, { headers: buildHeaders(userId) });
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
    if (!form.subDepartmentId) { Toast.show({ type: 'error', text1: 'Vui lòng chọn phòng/khoa!' }); return; }
    const validRows = form.details.filter((d) => d.qtyIssued && Number(d.qtyIssued) > 0);
    if (!validRows.length) { Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 vật tư!' }); return; }

    setLoading(true);
    try {
      const payload = {
        issueDate: form.issueDate,
        subDepartmentId: Number(form.subDepartmentId),
        note: form.note,
        issuedById: currentUser?.id,
        details: validRows.map((d) => ({
          materialId: d.materialId || null,
          materialName: d.materialName,
          unitId: d.unitId ? Number(d.unitId) : null,
          qtyIssued: Number(d.qtyIssued),
        })),
      };
      const r = await fetch(API_ENDPOINTS.ISSUES, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Xuất kho thành công!' });
        setForm({ issueDate: new Date().toISOString().split('T')[0], subDepartmentId: '', note: '', details: [createRow()] });
        setActiveTab('history');
        if (currentUser?.id) fetchHistory(currentUser.id);
      } else {
        Toast.show({ type: 'error', text1: d.error || 'Xuất kho thất bại!' });
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        activeTab === 'history' ? (
          <RefreshControl refreshing={histLoading} onRefresh={() => currentUser?.id && fetchHistory(currentUser.id)} />
        ) : undefined
      }
    >
      <PageFrame>
        <PageHead title="Xuất kho" />

        {/* Tab switch (web tabs): Tạo phiếu xuất / Lịch sử xuất */}
        <View style={styles.tabs}>
          {[['create', 'Tạo phiếu xuất'], ['history', 'Lịch sử xuất']].map(([key, label]) => {
            const on = activeTab === key;
            return (
              <TouchableOpacity key={key} style={[styles.tab, on && styles.tabActive]} onPress={() => setActiveTab(key)}>
                <Text style={[styles.tabText, on && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'create' ? (
          <>
            <Section title="Thông tin phiếu xuất">
              <Field label="Ngày xuất">
                <Input
                  value={form.issueDate}
                  onChangeText={(v) => setForm((f) => ({ ...f, issueDate: v }))}
                  placeholder="YYYY-MM-DD"
                />
              </Field>

              <Field label="Phòng/Khoa nhận *">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {subDepartments.map((d) => {
                    const on = form.subDepartmentId === String(d.id);
                    return (
                      <TouchableOpacity key={d.id} style={[styles.chip, on && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, subDepartmentId: String(d.id) }))}>
                        <Text style={[styles.chipText, on && styles.chipTextActive]} numberOfLines={1}>{d.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
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

            <Section title="Danh sách vật tư xuất kho">
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
                  <Field label="Số lượng xuất">
                    <Input placeholder="Số lượng xuất" value={row.qtyIssued} onChangeText={(v) => updateRow(i, 'qtyIssued', v)} keyboardType="numeric" />
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

              <Button
                title="+ Thêm vật tư"
                variant="secondary"
                onPress={() => setForm((f) => ({ ...f, details: [...f.details, createRow()] }))}
                style={styles.addBtn}
              />

              <Button title={loading ? '' : 'Xác nhận xuất kho'} onPress={handleSubmit} disabled={loading} style={{ marginTop: 10 }}>
                {loading ? <ActivityIndicator color={colors.white} /> : null}
              </Button>
            </Section>
          </>
        ) : (
          <Section title="Lịch sử xuất kho">
            {history.length === 0 ? (
              <Empty>Chưa có phiếu xuất nào</Empty>
            ) : (
              <>
                {pagedHistory.map((item) => (
                  <TouchableOpacity key={String(item.id)} style={styles.row} onPress={() => setSelected(item)}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.cardId}>Phiếu xuất #{item.id}</Text>
                      <Text style={styles.cardDept} numberOfLines={1}>{item.subDepartmentName || '—'}</Text>
                      <Text style={styles.cardMeta}>
                        {item.issueDate ? new Date(item.issueDate).toLocaleDateString('vi-VN') : '—'} · {(item.details || []).length} vật tư
                      </Text>
                    </View>
                    <Badge variant="info">{(item.details || []).length} VT</Badge>
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
          </Section>
        )}
      </PageFrame>

      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>Phiếu xuất #{selected.id}</Text>
                {[['Ngày xuất', selected.issueDate ? new Date(selected.issueDate).toLocaleDateString('vi-VN') : '—'], ['Phòng/Khoa', selected.subDepartmentName || '—'], ['Ghi chú', selected.note || '—']].map(([k, v]) => (
                  <View key={k} style={styles.infoRow}><Text style={styles.infoKey}>{k}:</Text><Text style={styles.infoVal}>{v}</Text></View>
                ))}
                <Text style={[styles.detailLabel, { marginTop: 12 }]}>Danh sách vật tư:</Text>
                {(selected.details || []).map((d, i) => (
                  <View key={i} style={styles.detailItem}>
                    <Text style={styles.detailName}>{d.materialName}</Text>
                    <Text style={styles.detailMeta}>SL: {d.qtyIssued} {d.unitName || ''}</Text>
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
  content: { paddingBottom: 24 },
  // Tabs
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  tab: {
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.textSoft },
  tabTextActive: { color: colors.white },
  // Chips
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.base, color: colors.textSoft, fontFamily: fontFamily.medium },
  chipTextActive: { color: colors.white, fontFamily: fontFamily.bold },
  // Material row card (Vật tư #n)
  rowCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 10, backgroundColor: colors.white },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rowTitle: { fontSize: fontSize.md, fontFamily: fontFamily.bold, color: colors.primary },
  removeText: { fontSize: fontSize.base, color: colors.statRed, fontFamily: fontFamily.semibold },
  addBtn: { marginTop: 2 },
  // History row
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  rowInfo: { flex: 1 },
  cardId: { fontSize: fontSize.md, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 2 },
  cardDept: { fontSize: fontSize.base, color: colors.label, marginBottom: 2 },
  cardMeta: { fontSize: fontSize.sm, color: colors.textMuted },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  infoKey: { fontSize: 13, color: colors.textSoft, width: 110 },
  infoVal: { fontSize: 13, color: colors.text, flex: 1, fontFamily: fontFamily.medium },
  detailLabel: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.label, marginBottom: 8 },
  detailItem: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, marginBottom: 8 },
  detailName: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text, marginBottom: 4 },
  detailMeta: { fontSize: 12, color: colors.textSoft },
});
