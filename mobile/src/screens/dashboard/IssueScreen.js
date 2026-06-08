import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { storage } from '../../utils/storage';

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

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardTop}>
        <Text style={styles.cardId}>Phiếu xuất #{item.id}</Text>
        <Text style={styles.cardDate}>{item.issueDate ? new Date(item.issueDate).toLocaleDateString('vi-VN') : '—'}</Text>
      </View>
      <Text style={styles.cardDept} numberOfLines={1}>{item.subDepartmentName || '—'}</Text>
      <Text style={styles.cardMeta}>{(item.details || []).length} vật tư</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {[['create', 'Tạo phiếu xuất'], ['history', 'Lịch sử xuất']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'create' ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Ngày xuất</Text>
          <TextInput style={styles.input} value={form.issueDate} onChangeText={(v) => setForm((f) => ({ ...f, issueDate: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#9BA3AF" />

          <Text style={styles.label}>Phòng/Khoa nhận *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {subDepartments.map((d) => (
              <TouchableOpacity key={d.id} style={[styles.chip, form.subDepartmentId === String(d.id) && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, subDepartmentId: String(d.id) }))}>
                <Text style={[styles.chipText, form.subDepartmentId === String(d.id) && styles.chipTextActive]} numberOfLines={1}>{d.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Ghi chú</Text>
          <TextInput style={[styles.input, { height: 64, textAlignVertical: 'top' }]} value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} placeholder="Ghi chú..." placeholderTextColor="#9BA3AF" multiline />

          <Text style={styles.label}>Danh sách vật tư xuất kho</Text>
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
              <TextInput style={styles.input} placeholder="Tên vật tư" placeholderTextColor="#9BA3AF" value={row.materialName} onChangeText={(v) => updateRow(i, 'materialName', v)} />
              <TextInput style={styles.input} placeholder="Số lượng xuất" placeholderTextColor="#9BA3AF" value={row.qtyIssued} onChangeText={(v) => updateRow(i, 'qtyIssued', v)} keyboardType="numeric" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {units.map((u) => (
                  <TouchableOpacity key={u.id} style={[styles.chip, row.unitId === String(u.id) && styles.chipActive]} onPress={() => updateRow(i, 'unitId', String(u.id))}>
                    <Text style={[styles.chipText, row.unitId === String(u.id) && styles.chipTextActive]}>{u.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={() => setForm((f) => ({ ...f, details: [...f.details, createRow()] }))}>
            <Text style={styles.addBtnText}>+ Thêm vật tư</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Xác nhận xuất kho</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={histLoading} onRefresh={() => currentUser?.id && fetchHistory(currentUser.id)} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có phiếu xuất nào</Text>}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>Phiếu xuất #{selected.id}</Text>
                {[['Ngày xuất', selected.issueDate ? new Date(selected.issueDate).toLocaleDateString('vi-VN') : '—'], ['Phòng/Khoa', selected.subDepartmentName || '—'], ['Ghi chú', selected.note || '—']].map(([k, v]) => (
                  <View key={k} style={styles.infoRow}><Text style={styles.infoKey}>{k}:</Text><Text style={styles.infoVal}>{v}</Text></View>
                ))}
                <Text style={[styles.label, { marginTop: 12 }]}>Danh sách vật tư:</Text>
                {(selected.details || []).map((d, i) => (
                  <View key={i} style={styles.detailItem}>
                    <Text style={styles.detailName}>{d.materialName}</Text>
                    <Text style={styles.detailMeta}>SL: {d.qtyIssued} {d.unitName || ''}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E6EF' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#1565C0' },
  tabText: { fontSize: 14, color: '#6B7280' },
  tabTextActive: { color: '#1565C0', fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  list: { padding: 12, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: '#E0E6EF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A2E', marginBottom: 10, backgroundColor: '#FFF' },
  chip: { borderWidth: 1.5, borderColor: '#E0E6EF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipText: { fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  rowCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginBottom: 10, elevation: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#1565C0' },
  removeText: { fontSize: 13, color: '#EF4444' },
  addBtn: { borderWidth: 1.5, borderColor: '#1565C0', borderRadius: 10, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#1565C0', fontWeight: '700', fontSize: 14 },
  submitBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardId: { fontSize: 15, fontWeight: '700', color: '#1565C0' },
  cardDate: { fontSize: 12, color: '#9CA3AF' },
  cardDept: { fontSize: 13, color: '#374151', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  emptyText: { textAlign: 'center', color: '#9BA3AF', paddingVertical: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoKey: { fontSize: 13, color: '#6B7280', width: 110 },
  infoVal: { fontSize: 13, color: '#1A1A2E', flex: 1, fontWeight: '500' },
  detailItem: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 8 },
  detailName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  detailMeta: { fontSize: 12, color: '#6B7280' },
  closeBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
