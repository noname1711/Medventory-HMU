import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '../../api/apiConfig';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { PageFrame, PageHead, Section, StatCard, Field, Input, Button, Badge, Empty, Pagination } from '../../theme/ui';

const CATEGORIES = ['A', 'B', 'C', 'D'];
const PAGE_SIZE = 8;

export default function EquipmentListScreen() {
  const [stockItems, setStockItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // Pagination — reset to page 1 whenever the search changes
  useEffect(() => { setPage(1); }, [keyword]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

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
      fetchStockItems();
    } catch (e) {
      Toast.show({ type: 'error', text1: e.message });
    } finally {
      setAddLoading(false);
    }
  };

  const stockVariant = (qty) => {
    const n = Number(qty);
    if (n <= 0) return 'zero';
    if (n < 10) return 'low';
    return 'ok';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <PageFrame>
        <PageHead title="Quản lý vật tư kho" />

        {/* KPI stat cards (web .ui-stat-grid) */}
        <StatCard variant="primary" label="Tổng mặt hàng" value={totalItems} note="Số lượng mã vật tư đang có trong kho" />
        <StatCard variant="warning" label="Sắp hết hàng" value={lowStock} note="Các mã có tồn kho lớn hơn 0 và nhỏ hơn 10" />
        <StatCard variant="danger" label="Hết hàng" value={outOfStock} note="Các mã vật tư hiện không còn tồn kho" />

        {/* Add material form (web "Thêm vật tư mới" section) — collapsible */}
        <Section title="Thêm vật tư mới" collapsible defaultOpen={false}>
          <Field label="Mã vật tư">
            <Input placeholder="VD: VT001" value={form.materialCode}
              onChangeText={(v) => setForm((f) => ({ ...f, materialCode: v }))} />
          </Field>
          <Field label="Tên vật tư">
            <Input placeholder="Nhập tên vật tư" value={form.materialName}
              onChangeText={(v) => setForm((f) => ({ ...f, materialName: v }))} />
          </Field>
          <Field label="Quy cách đóng gói">
            <Input placeholder="VD: Hộp 50 chiếc" value={form.specification}
              onChangeText={(v) => setForm((f) => ({ ...f, specification: v }))} />
          </Field>
          <Field label="Đơn vị tính">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {units.map((u) => {
                const on = form.unitId === String(u.id);
                return (
                  <TouchableOpacity key={u.id} onPress={() => setForm((f) => ({ ...f, unitId: String(u.id) }))}
                    style={[styles.chip, on && styles.chipActive]}>
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>{u.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Field>
          <Field label="Hãng sản xuất">
            <Input placeholder="Nhập hãng sản xuất" value={form.manufacturer}
              onChangeText={(v) => setForm((f) => ({ ...f, manufacturer: v }))} />
          </Field>
          <Field label="Phân loại">
            <View style={styles.chipRowWrap}>
              {CATEGORIES.map((c) => {
                const on = form.category === c;
                return (
                  <TouchableOpacity key={c} onPress={() => setForm((f) => ({ ...f, category: c }))}
                    style={[styles.chip, on && styles.chipActive]}>
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>Loại {c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
          <Button title={addLoading ? '' : 'Thêm vật tư'} onPress={handleAdd} disabled={addLoading}>
            {addLoading ? <ActivityIndicator color={colors.white} /> : null}
          </Button>
        </Section>

        {/* Inventory list (web "Danh sách vật tư tồn kho" section) */}
        <Section title="Danh sách vật tư tồn kho">
          <Input
            placeholder="Tìm theo mã hoặc tên vật tư..."
            value={keyword}
            onChangeText={setKeyword}
            style={{ marginBottom: 14 }}
          />
          {filtered.length === 0 ? (
            <Empty>
              {keyword
                ? `Không tìm thấy vật tư phù hợp với "${keyword}"`
                : 'Chưa có vật tư nào trong kho.'}
            </Empty>
          ) : (
            <>
              {paged.map((item) => (
                <View key={String(item.materialId || item.id)} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.code}>[{item.materialCode}]</Text>
                    <Text style={styles.name} numberOfLines={2}>{item.materialName}</Text>
                    <Text style={styles.meta}>
                      {item.unitName || '—'}{item.category ? ` · Loại ${item.category}` : ''}
                    </Text>
                  </View>
                  <View style={styles.rowStock}>
                    <Badge variant={stockVariant(item.closingStock)}>
                      {item.closingStock ?? 0}
                    </Badge>
                  </View>
                </View>
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
      </PageFrame>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  chipRow: { gap: 8, paddingVertical: 2 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.base, color: colors.textSoft, fontFamily: fontFamily.medium },
  chipTextActive: { color: colors.white, fontFamily: fontFamily.bold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  code: { fontSize: fontSize.sm, color: colors.primary, fontFamily: fontFamily.bold, marginBottom: 2 },
  name: { fontSize: fontSize.base, fontFamily: fontFamily.semibold, color: colors.text, marginBottom: 2 },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  rowStock: { alignItems: 'flex-end' },
});
