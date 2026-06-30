import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../../api/apiConfig';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { StatCard, Badge, Empty, Pagination } from '../../theme/ui';

const PAGE_SIZE = 8;

export default function EquipmentListScreen() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [matFilter, setMatFilter] = useState('all');
  const [page, setPage] = useState(1); // 1-based ở UI; backend dùng 0-based
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalItems: 0, lowStock: 0, outOfStock: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchStockItems(keyword, matFilter, page);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lọc + phân trang ở backend; debounce theo từ khóa.
  useEffect(() => {
    const t = setTimeout(() => {
      fetchStockItems(keyword, matFilter, page);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, matFilter, page]);

  // Quay về trang 1 khi đổi từ khóa / bộ lọc
  useEffect(() => { setPage(1); }, [keyword, matFilter]);

  // Tồn kho thay đổi sau khi nhập/xuất kho ở màn khác → tải lại khi quay lại
  // màn này (các tab dưới luôn được mount sẵn nên cần focus reload).
  useFocusEffect(
    useCallback(() => {
      fetchStockItems(keyword, matFilter, page);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword, matFilter, page])
  );

  async function fetchStockItems(kw = keyword, status = matFilter, pageNum = page) {
    try {
      const qs = new URLSearchParams({
        keyword: kw || '',
        status: status || 'all',
        page: String(Math.max(0, pageNum - 1)),
        size: String(PAGE_SIZE),
      });
      const res = await fetch(`${API_ENDPOINTS.INVENTORY_MATERIALS}?${qs.toString()}`);
      const data = await res.json();
      setStockItems(Array.isArray(data?.items) ? data.items : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setSummary({
        totalItems: data?.totalItems || 0,
        lowStock: data?.lowStock || 0,
        outOfStock: data?.outOfStock || 0,
      });
    } catch {
      setStockItems([]);
      setTotalPages(1);
      setSummary({ totalItems: 0, lowStock: 0, outOfStock: 0 });
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStockItems(keyword, matFilter, page);
    setRefreshing(false);
  };

  // Dữ liệu đã lọc + phân trang ở backend.
  const paged = stockItems;
  const pageSafe = Math.min(page, totalPages);
  const totalItems = summary.totalItems;
  const lowStock = summary.lowStock;
  const outOfStock = summary.outOfStock;

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

        {/* KPI stat row */}
        <View style={styles.statRow}>
          <StatCard variant="primary" label="Tổng mặt hàng" value={totalItems} style={styles.statItem} />
          <StatCard variant="warning" label="Sắp hết hàng" value={lowStock} style={styles.statItem} />
          <StatCard variant="danger" label="Hết hàng" value={outOfStock} style={styles.statItem} />
        </View>

        {/* Search with leading icon */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9aa6b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm vật tư..."
            placeholderTextColor={colors.textMuted}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'low', label: 'Sắp hết' },
            { key: 'out', label: 'Hết hàng' },
          ].map((f) => {
            const on = matFilter === f.key;
            return (
              <TouchableOpacity key={f.key} onPress={() => setMatFilter(f.key)}
                style={[styles.filterPill, on && styles.filterPillActive]}>
                <Text style={[styles.filterText, on && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Inventory list — material cards */}
        <View>
          {stockItems.length === 0 ? (
            <Empty>
              {keyword
                ? `Không tìm thấy vật tư phù hợp với "${keyword}"`
                : 'Chưa có vật tư nào trong kho.'}
            </Empty>
          ) : (
            <>
              {paged.map((item) => (
                <View key={String(item.materialId || item.id)} style={styles.card}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.name} numberOfLines={2}>{item.materialName}</Text>
                    <View style={styles.cardMeta}>
                      <Text style={styles.code}>{item.materialCode}</Text>
                      {!!item.unitName && <Text style={styles.meta}>{item.unitName}</Text>}
                      {!!item.category && <Text style={styles.meta}>Loại {item.category}</Text>}
                    </View>
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
        </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24, paddingHorizontal: 10, paddingTop: 10 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statItem: { flex: 1 },
  searchBox: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 12,
  },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingLeft: 36,
    paddingRight: 14,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 13.5,
    fontFamily: fontFamily.regular,
  },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12.5, fontFamily: fontFamily.bold, color: colors.textSoft },
  filterTextActive: { color: colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 13,
    padding: 13,
    marginBottom: 9,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardMeta: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  code: { fontSize: 11, color: colors.primary, fontFamily: fontFamily.bold, backgroundColor: '#eff4ff', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  name: { fontSize: 13.5, fontFamily: fontFamily.semibold, color: colors.text },
  meta: { fontSize: 11.5, color: '#94a3b8', fontFamily: fontFamily.regular },
  rowStock: { alignItems: 'flex-end', flexShrink: 0 },
});
