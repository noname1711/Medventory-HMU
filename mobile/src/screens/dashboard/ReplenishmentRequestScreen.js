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

const STATUS_MAP = {
  PENDING: { label: 'Chờ duyệt', color: '#F59E0B', bg: '#FEF3C7' },
  APPROVED: { label: 'Đã duyệt', color: '#10B981', bg: '#D1FAE5' },
  REJECTED: { label: 'Từ chối', color: '#EF4444', bg: '#FEE2E2' },
};

export default function ReplenishmentRequestScreen() {
  const [activeTab, setActiveTab] = useState('create');
  const [currentUser, setCurrentUser] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({
    note: '',
    details: [createRow()],
  });

  function createRow() {
    return { materialId: null, materialName: '', unitId: '', qtyRequested: '', reason: '' };
  }

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      fetchMaterials();
      fetchUnits();
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
      const r = await fetch(API_ENDPOINTS.REPLENISHMENTS, { headers: buildHeaders(userId) });
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
    const validRows = form.details.filter((d) => d.qtyRequested && Number(d.qtyRequested) > 0);
    if (!validRows.length) {
      Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 vật tư!' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        requestedById: currentUser?.id,
        note: form.note,
        details: validRows.map((d) => ({
          materialId: d.materialId || null,
          materialName: d.materialName,
          unitId: d.unitId ? Number(d.unitId) : null,
          qtyRequested: Number(d.qtyRequested),
          reason: d.reason,
        })),
      };
      const r = await fetch(API_ENDPOINTS.REPLENISHMENTS, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Tạo phiếu dự trù thành công!' });
        setForm({ note: '', details: [createRow()] });
        setActiveTab('history');
        if (currentUser?.id) fetchHistory(currentUser.id);
      } else {
        Toast.show({ type: 'error', text1: d.error || 'Tạo phiếu thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const status = STATUS_MAP[item.status] || { label: item.status, color: '#6B7280', bg: '#F3F4F6' };
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardTop}>
          <Text style={styles.cardId}>Phiếu dự trù #{item.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</Text>
        {item.note && <Text style={styles.cardNote} numberOfLines={1}>{item.note}</Text>}
        <Text style={styles.cardMeta}>{(item.details || []).length} vật tư</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {[['create', 'Tạo phiếu'], ['history', 'Lịch sử']].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'create' ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
            placeholder="Nhập ghi chú..."
            placeholderTextColor="#9BA3AF"
            value={form.note}
            onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
            multiline
          />

          <Text style={styles.label}>Danh sách vật tư cần bổ sung</Text>
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
              <TextInput style={styles.input} placeholder="Số lượng yêu cầu" placeholderTextColor="#9BA3AF" value={row.qtyRequested} onChangeText={(v) => updateRow(i, 'qtyRequested', v)} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="Lý do bổ sung" placeholderTextColor="#9BA3AF" value={row.reason} onChangeText={(v) => updateRow(i, 'reason', v)} />
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
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Gửi phiếu dự trù</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={histLoading} onRefresh={() => currentUser?.id && fetchHistory(currentUser.id)} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có phiếu dự trù nào</Text>}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>Phiếu dự trù #{selected.id}</Text>
                {[
                  ['Ngày tạo', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('vi-VN') : '—'],
                  ['Ghi chú', selected.note || '—'],
                ].map(([k, v]) => (
                  <View key={k} style={styles.infoRow}><Text style={styles.infoKey}>{k}:</Text><Text style={styles.infoVal}>{v}</Text></View>
                ))}
                <Text style={[styles.label, { marginTop: 12 }]}>Danh sách vật tư:</Text>
                {(selected.details || []).map((d, i) => (
                  <View key={i} style={styles.detailItem}>
                    <Text style={styles.detailName}>{d.materialName}</Text>
                    <Text style={styles.detailMeta}>SL: {d.qtyRequested} {d.unitName || ''}</Text>
                    {d.reason && <Text style={styles.detailMeta}>Lý do: {d.reason}</Text>}
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
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardDate: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  cardNote: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  emptyText: { textAlign: 'center', color: '#9BA3AF', paddingVertical: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoKey: { fontSize: 13, color: '#6B7280', width: 100 },
  infoVal: { fontSize: 13, color: '#1A1A2E', flex: 1, fontWeight: '500' },
  detailItem: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 8 },
  detailName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  detailMeta: { fontSize: 12, color: '#6B7280' },
  closeBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
