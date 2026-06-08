import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { API_ENDPOINTS } from '../../api/apiConfig';

const CATEGORIES = ['A', 'B', 'C'];

export default function EquipmentListScreen() {
  const [stockItems, setStockItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [form, setForm] = useState({
    materialCode: '',
    materialName: '',
    specification: '',
    unitId: '',
    manufacturer: '',
    category: 'C',
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([fetchUnits(), fetchStockItems()]);
    setLoading(false);
  }

  async function fetchUnits() {
    try {
      const res = await fetch(API_ENDPOINTS.UNITS);
      const data = await res.json();
      setUnits(Array.isArray(data) ? data : []);
    } catch {
      setUnits([]);
    }
  }

  async function fetchStockItems() {
    try {
      const res = await fetch(API_ENDPOINTS.INVENTORY_MATERIALS);
      const data = await res.json();
      setStockItems(Array.isArray(data) ? data : []);
    } catch {
      setStockItems([]);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStockItems();
    setRefreshing(false);
  };

  const filtered = stockItems.filter((item) => {
    const code = String(item.materialCode || '').toLowerCase();
    const name = String(item.materialName || '').toLowerCase();
    const kw = keyword.toLowerCase();
    return code.includes(kw) || name.includes(kw);
  });

  const totalItems = stockItems.length;
  const lowStock = stockItems.filter((i) => Number(i.closingStock) > 0 && Number(i.closingStock) < 10).length;
  const outOfStock = stockItems.filter((i) => Number(i.closingStock) <= 0).length;

  const handleAdd = async () => {
    if (!form.materialCode || !form.materialName || !form.unitId) {
      Toast.show({ type: 'error', text1: 'Vui lòng điền đủ mã, tên và đơn vị tính!' });
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.MATERIALS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể thêm vật tư');
      Toast.show({ type: 'success', text1: 'Thêm vật tư thành công!' });
      setForm({ materialCode: '', materialName: '', specification: '', unitId: '', manufacturer: '', category: 'C' });
      setShowAddModal(false);
      fetchStockItems();
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message });
    } finally {
      setAddLoading(false);
    }
  };

  const getStockColor = (qty) => {
    const n = Number(qty);
    if (n <= 0) return '#EF4444';
    if (n < 10) return '#F59E0B';
    return '#10B981';
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.materialCode}>[{item.materialCode}]</Text>
          <Text style={styles.materialName} numberOfLines={2}>{item.materialName}</Text>
          {item.specification ? (
            <Text style={styles.spec} numberOfLines={1}>{item.specification}</Text>
          ) : null}
        </View>
        <View style={[styles.stockBadge, { backgroundColor: getStockColor(item.closingStock) + '20' }]}>
          <Text style={[styles.stockNum, { color: getStockColor(item.closingStock) }]}>
            {item.closingStock ?? 0}
          </Text>
          <Text style={[styles.stockLabel, { color: getStockColor(item.closingStock) }]}>
            {item.unitName || ''}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>Loại: {item.category || '—'}</Text>
        {item.manufacturer ? <Text style={styles.metaText}>NSX: {item.manufacturer}</Text> : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1565C0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: '#1565C0' }]}>
          <Text style={styles.summaryNum}>{totalItems}</Text>
          <Text style={styles.summaryLabel}>Tổng vật tư</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
          <Text style={[styles.summaryNum, { color: '#F59E0B' }]}>{lowStock}</Text>
          <Text style={styles.summaryLabel}>Sắp hết</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#EF4444' }]}>
          <Text style={[styles.summaryNum, { color: '#EF4444' }]}>{outOfStock}</Text>
          <Text style={styles.summaryLabel}>Hết hàng</Text>
        </View>
      </View>

      {/* Search + Add */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm mã hoặc tên vật tư..."
          placeholderTextColor="#9BA3AF"
          value={keyword}
          onChangeText={setKeyword}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>+ Thêm</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.materialId || item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Không có vật tư nào</Text>
        }
      />

      {/* Add Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Thêm vật tư mới</Text>

              {[
                { label: 'Mã vật tư *', key: 'materialCode' },
                { label: 'Tên vật tư *', key: 'materialName' },
                { label: 'Quy cách', key: 'specification' },
                { label: 'Nhà sản xuất', key: 'manufacturer' },
              ].map(({ label, key }) => (
                <View key={key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={form[key]}
                    onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                    placeholder={label}
                    placeholderTextColor="#9BA3AF"
                  />
                </View>
              ))}

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Đơn vị tính *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {units.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.chip, form.unitId === String(u.id) && styles.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, unitId: String(u.id) }))}
                    >
                      <Text style={[styles.chipText, form.unitId === String(u.id) && styles.chipTextActive]}>
                        {u.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Phân loại</Text>
                <View style={styles.chipRow}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, form.category === c && styles.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, category: c }))}
                    >
                      <Text style={[styles.chipText, form.category === c && styles.chipTextActive]}>
                        Loại {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, addLoading && styles.submitBtnDisabled]}
                onPress={handleAdd}
                disabled={addLoading}
              >
                {addLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Lưu vật tư</Text>}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryRow: { flexDirection: 'row', padding: 12, gap: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    elevation: 2,
  },
  summaryNum: { fontSize: 22, fontWeight: '700', color: '#1565C0' },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E6EF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: '#FFF',
    color: '#1A1A2E',
  },
  addBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 12 },
  materialCode: { fontSize: 12, color: '#1565C0', fontWeight: '600', marginBottom: 2 },
  materialName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  spec: { fontSize: 12, color: '#6B7280' },
  stockBadge: { alignItems: 'center', borderRadius: 8, padding: 8, minWidth: 60 },
  stockNum: { fontSize: 20, fontWeight: '700' },
  stockLabel: { fontSize: 11, marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metaText: { fontSize: 12, color: '#9CA3AF' },
  emptyText: { textAlign: 'center', color: '#9BA3AF', paddingVertical: 40, fontSize: 15 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 16, textAlign: 'center' },
  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: '#E0E6EF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
    backgroundColor: '#F8FAFC',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E0E6EF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipText: { fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
