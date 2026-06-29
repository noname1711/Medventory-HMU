import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '../../api/apiConfig';
import { apiGet, apiSend } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import DetailModal from '../../components/DetailModal';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  Section,
  StatCard,
  Field,
  Input,
  Button,
  Badge,
  Empty,
  SegmentControl,
  MonoBadge,
  Pagination,
} from '../../theme/ui';

const PAGE_SIZE = 8;
const HIST_SIZE = 10;

function fmtDate(s) {
  if (!s) return '—';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
}

export default function IssueScreen() {
  const { user } = useAuth();

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState('create');

  // ── Eligible list (create tab) ──
  const [eligible, setEligible] = useState([]);
  const [summary, setSummary] = useState(null);
  const [eligiblePage, setEligiblePage] = useState(1);      // 1-based UI
  const [eligibleLoading, setEligibleLoading] = useState(false);

  // ── Preview modal ──
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewReq, setPreviewReq] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── History tab ──
  const [histItems, setHistItems] = useState([]);
  const [histPage, setHistPage] = useState(1);              // 1-based UI
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histKeyword, setHistKeyword] = useState('');
  const [histLoading, setHistLoading] = useState(false);
  const debounceRef = useRef(null);

  // ── Detail modal (history) ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ────────────────────────────────────────────
  // Eligible list fetch
  // ────────────────────────────────────────────
  const loadEligible = useCallback(
    async (pg = eligiblePage) => {
      if (!user?.id) return;
      setEligibleLoading(true);
      const page0 = pg - 1;                                 // backend 0-based
      const url = `${API_ENDPOINTS.ISSUES_ELIGIBLE}?eligiblePage=${page0}&pageSize=${PAGE_SIZE}`;
      const { ok, data } = await apiGet(url, user.id);
      if (ok && data) {
        const list = Array.isArray(data.eligibleRequests) ? data.eligibleRequests : (Array.isArray(data.eligible) ? data.eligible : []);
        setEligible(list);
        setSummary(data.summary ?? null);
      } else {
        setEligible([]);
        setSummary(null);
      }
      setEligibleLoading(false);
    },
    [user?.id, eligiblePage]
  );

  // Load eligible when create tab is active or page changes
  useEffect(() => {
    if (activeTab !== 'create' || !user?.id) return;
    loadEligible(eligiblePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id, eligiblePage]);

  // Refresh the eligible list whenever the screen regains focus — a request
  // becomes eligible after a leader approves it elsewhere, so the Thủ kho must
  // see it without logging out/in. (Screens stay mounted in the bottom tabs.)
  useFocusEffect(
    useCallback(() => {
      if (user?.id && activeTab === 'create') loadEligible(eligiblePage);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, activeTab, eligiblePage])
  );

  // ────────────────────────────────────────────
  // History fetch
  // ────────────────────────────────────────────
  const loadHistory = useCallback(
    async (kw = histKeyword, pg = histPage) => {
      if (!user?.id) return;
      setHistLoading(true);
      const page0 = Math.max(0, pg - 1);
      const url = `${API_ENDPOINTS.ISSUES_FEED}?page=${page0}&limit=${HIST_SIZE}&keyword=${encodeURIComponent(kw || '')}`;
      const { ok, data } = await apiGet(url, user.id);
      if (ok && data) {
        const list = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
          ? data.data
          : [];
        const total = Math.max(1, Number(data.summary?.totalPages ?? 1));
        setHistItems(list);
        setHistTotalPages(total);
      } else {
        setHistItems([]);
        setHistTotalPages(1);
      }
      setHistLoading(false);
    },
    [user?.id, histKeyword, histPage]
  );

  useEffect(() => {
    if (activeTab !== 'history' || !user?.id) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadHistory(histKeyword, histPage), 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id, histKeyword, histPage]);

  // Reset page when keyword changes
  useEffect(() => {
    setHistPage(1);
  }, [histKeyword]);

  // ────────────────────────────────────────────
  // Preview
  // ────────────────────────────────────────────
  async function openPreview(req) {
    if (!user?.id) return;
    setPreviewReq(req);
    setPreviewData(null);
    setPreviewVisible(true);
    setPreviewLoading(true);
    const url = `${API_ENDPOINTS.ISSUE_PREVIEW}?issueReqId=${req.id}`;
    const { ok, data } = await apiGet(url, user.id);
    if (ok && data) {
      setPreviewData(data);
    } else {
      Toast.show({ type: 'error', text1: 'Không thể tải xem trước phiếu xuất' });
      setPreviewVisible(false);
    }
    setPreviewLoading(false);
  }

  function closePreview() {
    setPreviewVisible(false);
    setPreviewReq(null);
    setPreviewData(null);
  }

  // ────────────────────────────────────────────
  // Create issue (AUTO-FEFO)
  // ────────────────────────────────────────────
  async function handleCreate() {
    if (!user?.id || !previewReq?.id) return;
    setCreating(true);
    const body = {
      issueReqId: previewReq.id,
      autoAllocate: true,
    };
    const { ok, data } = await apiSend('POST', API_ENDPOINTS.ISSUE_CREATE_FROM_REQ, body, user.id);
    setCreating(false);

    if (ok && data?.success !== false) {
      Toast.show({ type: 'success', text1: 'Xuất kho thành công!' });
      closePreview();
      // Reload both tabs
      loadEligible(1);
      setEligiblePage(1);
      if (activeTab === 'history') loadHistory(histKeyword, 1);
    } else {
      Toast.show({ type: 'error', text1: data?.message || 'Xuất kho thất bại!' });
    }
  }

  // ────────────────────────────────────────────
  // Detail (history row tap)
  // ────────────────────────────────────────────
  async function openDetail(id) {
    if (!user?.id) return;
    setDetailLoading(true);
    setDetailData(null);
    setDetailVisible(true);
    const { ok, data } = await apiGet(API_ENDPOINTS.ISSUE_DETAIL(id), user.id);
    if (ok && data) {
      setDetailData(data);
    } else {
      Toast.show({ type: 'error', text1: 'Không thể tải chi tiết phiếu xuất' });
      setDetailVisible(false);
    }
    setDetailLoading(false);
  }

  // Build DetailModal props from detail API response
  const detailHeader = detailData?.header ?? detailData?.data?.header ?? {};
  const detailLines = Array.isArray(detailData?.details)
    ? detailData.details
    : Array.isArray(detailData?.data?.details)
    ? detailData.data.details
    : [];

  const detailInfo =
    detailHeader?.id != null
      ? [
          { label: 'Mã phiếu xuất', value: `#${detailHeader.id}` },
          { label: 'Phiếu xin lĩnh', value: detailHeader.issueReqId ? `#${detailHeader.issueReqId}` : '—' },
          { label: 'Ngày xuất', value: fmtDate(detailHeader.issueDate) },
          { label: 'Khoa/Phòng', value: detailHeader.departmentName || '—' },
          { label: 'Bộ môn', value: detailHeader.subDepartmentName || '—' },
          { label: 'Người nhận', value: detailHeader.receiverName || '—' },
        ]
      : [];

  const detailColumns = [
    { key: 'stt', label: 'STT', flex: 0.5 },
    { key: 'name', label: 'Vật tư', flex: 2 },
    { key: 'unitName', label: 'ĐVT', flex: 1 },
    { key: 'qtyIssued', label: 'SL xuất', flex: 1 },
  ];

  const detailRows = detailLines.map((d) => ({
    name: d.name || d.materialName || '—',
    unitName: d.unitName || '—',
    qtyIssued: String(d.qtyIssued ?? '—'),
  }));

  // Build PreviewModal lines from preview API response
  const previewLines = Array.isArray(previewData?.lines) ? previewData.lines : [];
  const previewInfo = previewReq
    ? [
        { label: 'Phiếu xin lĩnh', value: `#${previewReq.id}` },
        { label: 'Bộ môn', value: previewReq.subDepartmentName || '—' },
        { label: 'Khoa/Phòng', value: previewReq.departmentName || '—' },
        { label: 'Phân bổ lô', value: 'Tự động (FEFO)' },
      ]
    : [];

  const previewColumns = [
    { key: 'stt', label: 'STT', flex: 0.5 },
    { key: 'name', label: 'Vật tư', flex: 2 },
    { key: 'lot', label: 'Lô', flex: 1 },
    { key: 'qty', label: 'SL xuất', flex: 1 },
  ];

  const previewRows = previewLines.map((ln) => {
    const firstLot = Array.isArray(ln.lots) && ln.lots.length ? ln.lots[0] : null;
    return {
      name: ln.name || '—',
      lot: firstLot ? firstLot.lotNumber : 'Auto',
      qty: String(ln.qtyToIssue ?? ln.qtyRequested ?? '—'),
    };
  });

  // Eligible pagination
  const eligibleTotalPages = Math.max(1, Number(summary?.eligibleTotalPages ?? 1));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SegmentControl
        segments={[
          { key: 'create', label: 'Tạo phiếu xuất' },
          { key: 'history', label: 'Lịch sử' },
        ]}
        active={activeTab}
        onChange={(tab) => setActiveTab(tab)}
      />

      {/* ── Stat cards (always visible) ── */}
      <View style={styles.statRow}>
        <StatCard
          label="Đã xét duyệt"
          value={String(summary?.checked ?? '—')}
          variant="success"
          style={styles.statCard}
        />
        <StatCard
          label="Đủ điều kiện"
          value={String(summary?.eligible ?? eligible.length)}
          variant="primary"
          style={styles.statCard}
        />
        <StatCard
          label="Không đủ ĐK"
          value={String(summary?.ineligible ?? '—')}
          variant="warning"
          style={styles.statCard}
        />
      </View>

      {activeTab === 'create' ? (
        <Section title="Phiếu đủ điều kiện xuất kho">
          {eligibleLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
          ) : eligible.length === 0 ? (
            <Empty>Chưa có phiếu sẵn sàng xuất kho</Empty>
          ) : (
            <>
              {eligible.map((req) => {
                const count =
                  req.materialTypeCount ?? req.itemCount ?? req.count ??
                  (Array.isArray(req.details) ? req.details.length : null);
                return (
                  <View key={String(req.id)} style={styles.eligibleCard}>
                    <View style={styles.eligibleTop}>
                      <MonoBadge>#{req.id}</MonoBadge>
                      <Badge variant="success" label="Đủ điều kiện" />
                    </View>
                    <Text style={styles.eligibleDept} numberOfLines={1}>
                      {req.subDepartmentName || req.departmentName || '—'}
                    </Text>
                    {count != null && (
                      <Text style={styles.eligibleMeta}>{count} loại vật tư</Text>
                    )}
                    <Button
                      title="Tạo phiếu xuất"
                      onPress={() => openPreview(req)}
                      style={styles.eligibleBtn}
                    />
                  </View>
                );
              })}
              <Pagination
                page={eligiblePage}
                totalPages={eligibleTotalPages}
                onPrev={() => setEligiblePage((p) => Math.max(1, p - 1))}
                onNext={() => setEligiblePage((p) => Math.min(eligibleTotalPages, p + 1))}
              />
            </>
          )}
        </Section>
      ) : (
        <Section title="Lịch sử phiếu xuất kho">
          <Field label="Tìm kiếm">
            <Input
              value={histKeyword}
              onChangeText={setHistKeyword}
              placeholder="Mã phiếu, khoa, bộ môn, người nhận..."
            />
          </Field>

          {histLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
          ) : histItems.length === 0 ? (
            <Empty>Chưa có phiếu xuất nào</Empty>
          ) : (
            <>
              {histItems.map((item) => (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.histCard}
                  onPress={() => openDetail(item.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.histTop}>
                    <MonoBadge>PX #{item.id}</MonoBadge>
                    <Text style={styles.histDate}>{fmtDate(item.issueDate)}</Text>
                  </View>
                  <Text style={styles.histDept} numberOfLines={1}>
                    {item.subDepartmentName || item.departmentName || '—'}
                  </Text>
                  {item.materialTypeCount != null && (
                    <Text style={styles.histMeta}>{item.materialTypeCount} loại vật tư</Text>
                  )}
                </TouchableOpacity>
              ))}
              <Pagination
                page={histPage}
                totalPages={histTotalPages}
                onPrev={() => setHistPage((p) => Math.max(1, p - 1))}
                onNext={() => setHistPage((p) => Math.min(histTotalPages, p + 1))}
              />
            </>
          )}
        </Section>
      )}

      {/* ── Preview (FEFO) modal ── */}
      <DetailModal
        visible={previewVisible}
        title={previewReq ? `Xem trước xuất kho — Phiếu #${previewReq.id}` : 'Xem trước xuất kho'}
        info={previewInfo}
        columns={previewLoading ? [] : previewColumns}
        rows={previewLoading ? [] : previewRows}
        onClose={closePreview}
        footer={
          previewLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Button
              title={creating ? 'Đang xuất kho...' : 'Xác nhận xuất kho'}
              onPress={handleCreate}
              disabled={creating || !previewData}
            />
          )
        }
      />

      {/* ── Detail modal (history) ── */}
      <DetailModal
        visible={detailVisible}
        title={detailHeader?.id ? `Phiếu xuất #${detailHeader.id}` : 'Chi tiết phiếu xuất'}
        info={detailInfo}
        columns={detailLoading ? [] : detailColumns}
        rows={detailLoading ? [] : detailRows}
        onClose={() => setDetailVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24, paddingHorizontal: 10, paddingTop: 14 },

  // Stat row
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1 },

  // Eligible cards
  eligibleCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  eligibleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  eligibleDept: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text, marginBottom: 2 },
  eligibleMeta: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  eligibleBtn: { marginTop: 4 },

  // History cards
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
  histDept: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  histMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
