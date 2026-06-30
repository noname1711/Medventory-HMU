import React, { useCallback, useState } from 'react';
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
import { apiGet } from '../../api/apiClient';
import { useServerHistory } from '../../hooks/useServerHistory';
import { useAuth } from '../../context/AuthContext';
import { statusBadge } from '../../utils/status';
import DetailModal from '../../components/DetailModal';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  MonoBadge,
  Field,
  Input,
  Badge,
  Empty,
  Pagination,
} from '../../theme/ui';

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ReplenishmentRequestScreen() {
  const { user } = useAuth();

  // ── History state ──
  const buildUrl = useCallback(
    ({ keyword, page0, size }) =>
      `${API_ENDPOINTS.SUPP_FORECAST_MINE}?userId=${user?.id ?? ''}&keyword=${encodeURIComponent(keyword)}&page=${page0}&size=${size}`,
    [user?.id],
  );

  const {
    items: histItems,
    page: histPage,
    setPage: setHistPage,
    totalPages: histTotalPages,
    keyword: histKeyword,
    setKeyword: setHistKeyword,
    loading: histLoading,
    reload: histReload,
  } = useServerHistory({
    buildUrl,
    userId: user?.id,
    pageSize: 8,
    active: true,
  });

  // ── Detail modal state ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── History: open detail ────────────────────────────────────────────────

  async function openDetail(id) {
    setDetailLoading(true);
    setDetailVisible(true);
    setDetailData(null);
    const { ok, data } = await apiGet(
      `${API_ENDPOINTS.SUPP_FORECAST_DETAIL(id)}?userId=${user?.id ?? ''}`,
      user?.id,
    );
    if (ok && data) {
      setDetailData(data);
    } else {
      setDetailVisible(false);
      Toast.show({ type: 'error', text1: 'Không thể tải chi tiết phiếu' });
    }
    setDetailLoading(false);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const detailInfo = detailData ? [
    { label: 'Mã phiếu',   value: `#${detailData.id}`                                                         },
    { label: 'Năm học',    value: detailData.academicYear || '—'                                                },
    { label: 'Bộ môn',     value: detailData.department?.name || '—'                                           },
    { label: 'Người tạo',  value: detailData.createdBy?.fullName || '—'                                        },
    { label: 'Ngày tạo',   value: detailData.createdAt ? new Date(detailData.createdAt).toLocaleDateString('vi-VN') : '—' },
    { label: 'Trạng thái', value: statusBadge(detailData.status, detailData.statusName).label                  },
    ...(detailData.approvalNote ? [{ label: 'Ghi chú duyệt', value: detailData.approvalNote }] : []),
  ] : [];

  const detailColumns = [
    { key: 'stt',       label: 'TT',       flex: 0.4 },
    { key: 'name',      label: 'Vật tư',   flex: 2   },
    { key: 'current',   label: 'Hiện có',  flex: 0.8 },
    { key: 'lastYear',  label: 'Năm trước',flex: 0.8 },
    { key: 'requested', label: 'Dự trù',   flex: 0.8 },
  ];

  const detailRows = (detailData?.details || []).map((d, i) => ({
    stt:       String(i + 1),
    name:      d.material?.name || '—',
    current:   d.currentStock  != null ? String(d.currentStock)  : '—',
    lastYear:  d.prevYearQty   != null ? String(d.prevYearQty)   : '—',
    requested: d.thisYearQty   != null ? String(d.thisYearQty)   : '—',
  }));

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={histLoading} onRefresh={histReload} />
        }
      >
        <Text style={styles.screenTitle}>Lịch sử phiếu dự trù</Text>

        <Field label="">
          <Input
            placeholder="Tìm theo mã phiếu / bộ môn / trạng thái..."
            value={histKeyword}
            onChangeText={(v) => { setHistKeyword(v); setHistPage(1); }}
          />
        </Field>

        {histLoading && histItems.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : histItems.length === 0 ? (
          <Empty>Chưa có phiếu dự trù nào</Empty>
        ) : (
          <>
            {histItems.map((item) => {
              const s = statusBadge(item.status, item.statusName);
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.histCard}
                  onPress={() => openDetail(item.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.histTop}>
                    <MonoBadge>DT #{item.id}</MonoBadge>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </View>
                  <Text style={styles.histDept} numberOfLines={1}>
                    {item.departmentName || 'Chưa rõ bộ môn'}
                  </Text>
                  <Text style={styles.histMeta}>
                    {item.academicYear || '—'}
                    {item.itemCount != null ? ` · ${item.itemCount} vật tư` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Pagination
              page={histPage}
              totalPages={histTotalPages}
              onPrev={() => setHistPage((p) => Math.max(1, p - 1))}
              onNext={() => setHistPage((p) => Math.min(histTotalPages, p + 1))}
            />
          </>
        )}
      </ScrollView>

      {/* ── Detail modal ── */}
      <DetailModal
        visible={detailVisible}
        title={detailData ? `Phiếu dự trù #${detailData.id}` : 'Đang tải…'}
        info={detailInfo}
        columns={detailColumns}
        rows={detailRows}
        onClose={() => { setDetailVisible(false); setDetailData(null); }}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { paddingBottom: 32, paddingHorizontal: 10, paddingTop: 14 },

  screenTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    color: colors.text,
    marginBottom: 14,
  },

  // ── History cards ──
  histCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  histTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  histDept: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  histMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
