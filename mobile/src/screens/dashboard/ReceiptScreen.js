import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '../../api/apiConfig';
import { apiGet, apiSend } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import MaterialPicker from '../../components/MaterialPicker';
import DetailModal from '../../components/DetailModal';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  Section,
  Field,
  Input,
  Button,
  SegmentControl,
  MonoBadge,
  Empty,
  Pagination,
} from '../../theme/ui';

const PAGE_SIZE = 10;

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function createRow() {
  return {
    key: String(Date.now() + Math.random()),
    materialId: null,
    materialName: '',
    materialCode: '',
    unitId: '',
    unitName: '',
    qtyActual: '',
    price: '',
    lotNumber: '',
    pickerVisible: false,
  };
}

function fmtDate(s) {
  if (!s) return '—';
  const match = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(s);
}

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('vi-VN') + ' đ';
}

export default function ReceiptScreen() {
  const { user } = useAuth();

  // ── Tab ──
  const [activeTab, setActiveTab] = useState('create');

  // ── Create form ──
  const [header, setHeader] = useState({
    receivedFrom: '',
    reason: '',
    receiptDate: todayISO(),
  });
  const [rows, setRows] = useState([createRow()]);
  const [submitting, setSubmitting] = useState(false);

  // ── History ──
  const [histItems, setHistItems] = useState([]);
  const [histPage, setHistPage] = useState(1);          // 1-based UI
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histKeyword, setHistKeyword] = useState('');
  const [histLoading, setHistLoading] = useState(false);

  // ── Detail modal ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ────────────────────────────────────────────
  // History fetch (local — feed shape doesn't match useServerHistory)
  // ────────────────────────────────────────────
  const debounceRef = useRef(null);

  const loadHistory = useCallback(
    async (kw = histKeyword, pg = histPage) => {
      if (!user?.id) return;
      setHistLoading(true);
      const page0 = Math.max(0, pg - 1);
      const url = `${API_ENDPOINTS.RECEIPTS_FEED}?page=${page0}&limit=${PAGE_SIZE}&keyword=${encodeURIComponent(kw || '')}`;
      const { ok, data } = await apiGet(url, user.id);
      if (ok && data) {
        // Backend ReceiptFeedResponseDTO exposes the list under `items`.
        const list = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.receipts)
          ? data.receipts
          : Array.isArray(data.data)
          ? data.data
          : [];
        const total = Math.max(1, data.summary?.totalPages ?? 1);
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

  // Reload when tab becomes active or user changes
  useEffect(() => {
    if (activeTab !== 'history' || !user?.id) return undefined;
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
  // Row helpers
  // ────────────────────────────────────────────
  function updateRow(key, patch) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function openPicker(key) {
    updateRow(key, { pickerVisible: true });
  }

  function closePicker(key) {
    updateRow(key, { pickerVisible: false });
  }

  function onPickMaterial(key, dto) {
    updateRow(key, {
      materialId: dto.id,
      materialName: dto.name || '',
      materialCode: dto.code || '',
      unitId: dto.unit?.id ?? dto.unitId ?? '',
      unitName: '',          // MaterialPicker DTO doesn't carry unit name
      pickerVisible: false,
    });
  }

  // Computed total
  const grandTotal = rows.reduce(
    (sum, r) => sum + (Number(r.qtyActual) || 0) * (Number(r.price) || 0),
    0
  );

  // ────────────────────────────────────────────
  // Submit
  // ────────────────────────────────────────────
  async function handleSubmit() {
    if (!user?.id) {
      Toast.show({ type: 'error', text1: 'Chưa xác định người dùng!' });
      return;
    }
    if (!header.receivedFrom.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập nhà cung cấp!' });
      return;
    }

    const validRows = rows.filter((r) => r.materialId && (Number(r.qtyActual) > 0));
    if (!validRows.length) {
      Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 vật tư với số lượng > 0!' });
      return;
    }

    const missingLot = validRows.find((r) => !r.lotNumber.trim());
    if (missingLot) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập số lô cho tất cả vật tư!' });
      return;
    }

    const payload = {
      receivedFrom: header.receivedFrom.trim(),
      reason: header.reason.trim() || null,
      receiptDate: header.receiptDate || null,
      details: validRows.map((r) => ({
        materialId: r.materialId,
        price: Number(r.price) || 0,
        qtyActual: Number(r.qtyActual),
        qtyDoc: Number(r.qtyActual),
        lotNumber: r.lotNumber.trim(),
      })),
    };

    setSubmitting(true);
    const { ok, data } = await apiSend('POST', API_ENDPOINTS.RECEIPT_CREATE, payload, user.id);
    setSubmitting(false);

    if (ok && data?.success !== false) {
      Toast.show({ type: 'success', text1: 'Nhập kho thành công!' });
      // Reset form
      setHeader({ receivedFrom: '', reason: '', receiptDate: todayISO() });
      setRows([createRow()]);
      // Switch to history and reload
      setHistPage(1);
      setActiveTab('history');
    } else {
      Toast.show({ type: 'error', text1: data?.message || 'Nhập kho thất bại!' });
    }
  }

  // ────────────────────────────────────────────
  // Detail
  // ────────────────────────────────────────────
  async function openDetail(id) {
    if (!user?.id) return;
    setDetailLoading(true);
    setDetailData(null);
    setDetailVisible(true);
    const { ok, data } = await apiGet(API_ENDPOINTS.RECEIPT_DETAIL(id), user.id);
    if (ok && data) {
      setDetailData(data);
    } else {
      Toast.show({ type: 'error', text1: 'Không thể tải chi tiết phiếu nhập' });
      setDetailVisible(false);
    }
    setDetailLoading(false);
  }

  // Build DetailModal props from raw API response
  const detailHeader = detailData?.receipt ?? detailData?.header ?? detailData?.data?.receipt ?? detailData?.data ?? {};
  const detailLines = detailData?.details ?? detailData?.items ?? detailData?.lines ?? detailData?.data?.details ?? [];

  const detailInfo = detailHeader?.id != null
    ? [
        { label: 'Mã phiếu', value: `#${detailHeader.id}` },
        { label: 'Ngày nhập', value: fmtDate(detailHeader.receiptDate ?? detailHeader.receipt_date) },
        { label: 'Nhà cung cấp', value: detailHeader.receivedFrom ?? detailHeader.received_from ?? '—' },
        { label: 'Lý do', value: detailHeader.reason ?? '—' },
        { label: 'Tổng tiền', value: fmtMoney(detailHeader.totalAmount ?? detailHeader.total_amount ?? 0) },
      ]
    : [];

  const detailColumns = [
    { key: 'stt', label: 'STT', flex: 0.5 },
    { key: 'name', label: 'Tên vật tư', flex: 2 },
    { key: 'lot', label: 'Số lô', flex: 0.9 },
    { key: 'qty', label: 'SL', flex: 0.7 },
    { key: 'price', label: 'Đơn giá', flex: 1 },
  ];

  const detailRows = Array.isArray(detailLines)
    ? detailLines.map((d) => ({
        name: d?.name ?? d?.materialName ?? '—',
        lot: d?.lotNumber ?? d?.lot_number ?? '—',
        qty: String(d?.qtyActual ?? d?.qty_actual ?? 0),
        price: fmtMoney(d?.price ?? 0),
      }))
    : [];

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────
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

      {/* ── CREATE TAB ── */}
      {activeTab === 'create' && (
        <>
          <Section title="Thông tin phiếu nhập">
            <Field label="Nhà cung cấp / người giao">
              <Input
                value={header.receivedFrom}
                onChangeText={(v) => setHeader((h) => ({ ...h, receivedFrom: v }))}
                placeholder="Ví dụ: Công ty ABC"
              />
            </Field>
            <Field label="Ngày nhập">
              <Input
                value={header.receiptDate}
                onChangeText={(v) => setHeader((h) => ({ ...h, receiptDate: v }))}
                placeholder="YYYY-MM-DD"
              />
            </Field>
            <Field label="Lý do nhập">
              <Input
                value={header.reason}
                onChangeText={(v) => setHeader((h) => ({ ...h, reason: v }))}
                placeholder="Ví dụ: Nhập theo hợp đồng..."
                multiline
              />
            </Field>
          </Section>

          <Section title="Danh sách vật tư nhập kho">
            {rows.map((row, i) => (
              <View key={row.key} style={styles.rowCard}>
                {/* Row header */}
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>Vật tư #{i + 1}</Text>
                  {rows.length > 1 && (
                    <TouchableOpacity onPress={() => removeRow(row.key)}>
                      <Text style={styles.removeText}>✕ Xóa</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Material picker trigger */}
                <Field label="Tên vật tư">
                  <TouchableOpacity
                    style={[styles.pickerBtn, row.materialId ? styles.pickerBtnFilled : null]}
                    onPress={() => openPicker(row.key)}
                  >
                    <Text
                      style={row.materialId ? styles.pickerBtnTextFilled : styles.pickerBtnText}
                      numberOfLines={1}
                    >
                      {row.materialName || 'Chọn vật tư...'}
                    </Text>
                    {!!row.materialCode && (
                      <Text style={styles.pickerCode}>{row.materialCode}</Text>
                    )}
                  </TouchableOpacity>
                </Field>

                {/* MaterialPicker modal */}
                <MaterialPicker
                  visible={row.pickerVisible}
                  onClose={() => closePicker(row.key)}
                  onSelect={(dto) => onPickMaterial(row.key, dto)}
                />

                {/* Qty Actual */}
                <Field label="Số lượng *">
                  <Input
                    placeholder="0"
                    value={row.qtyActual}
                    onChangeText={(v) => updateRow(row.key, { qtyActual: v })}
                    keyboardType="numeric"
                  />
                </Field>

                {/* Price */}
                <Field label="Đơn giá *">
                  <Input
                    placeholder="0"
                    value={row.price}
                    onChangeText={(v) => updateRow(row.key, { price: v })}
                    keyboardType="numeric"
                  />
                </Field>

                {/* Lot */}
                <Field label="Số lô *">
                  <Input
                    placeholder="Ví dụ: LOT-0125-A"
                    value={row.lotNumber}
                    onChangeText={(v) => updateRow(row.key, { lotNumber: v })}
                  />
                </Field>

                {/* Row subtotal */}
                {(Number(row.qtyActual) > 0 && Number(row.price) > 0) && (
                  <View style={styles.rowTotal}>
                    <Text style={styles.rowTotalLabel}>Thành tiền:</Text>
                    <Text style={styles.rowTotalValue}>
                      {fmtMoney((Number(row.qtyActual) || 0) * (Number(row.price) || 0))}
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {/* Add row */}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setRows((prev) => [...prev, createRow()])}
            >
              <Text style={styles.addBtnText}>＋ Thêm vật tư</Text>
            </TouchableOpacity>

            {/* Grand total */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Tổng chi phí</Text>
              <Text style={styles.totalValue}>{fmtMoney(grandTotal)}</Text>
            </View>

            {/* Submit */}
            <Button
              title={submitting ? '' : 'Lưu phiếu nhập'}
              onPress={handleSubmit}
              disabled={submitting}
              style={{ marginTop: 10 }}
            >
              {submitting ? <ActivityIndicator color={colors.white} /> : null}
            </Button>
          </Section>
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <View>
          {/* Search bar */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo mã phiếu / NCC / lý do..."
              placeholderTextColor={colors.textMuted}
              value={histKeyword}
              onChangeText={setHistKeyword}
            />
            <TouchableOpacity
              style={styles.reloadBtn}
              onPress={() => loadHistory(histKeyword, histPage)}
              disabled={histLoading}
            >
              <Text style={styles.reloadBtnText}>Tải lại</Text>
            </TouchableOpacity>
          </View>

          {histLoading && histItems.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 32 }} />
          ) : histItems.length === 0 ? (
            <Empty>Chưa có phiếu nhập nào</Empty>
          ) : (
            <>
              {histItems.map((item) => {
                const id = item?.id;
                const date = fmtDate(item?.receiptDate ?? item?.receipt_date);
                const from = item?.receivedFrom ?? item?.received_from ?? '—';
                const reason = item?.reason ?? '';
                const total = item?.totalAmount ?? item?.total_amount ?? 0;
                return (
                  <TouchableOpacity
                    key={String(id)}
                    style={styles.histCard}
                    onPress={() => openDetail(id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.histTop}>
                      <MonoBadge>PN #{id}</MonoBadge>
                      <Text style={styles.histDate}>{date}</Text>
                    </View>
                    <Text style={styles.histFrom} numberOfLines={1}>{from}</Text>
                    {!!reason && (
                      <Text style={styles.histReason} numberOfLines={1}>{reason}</Text>
                    )}
                    <Text style={styles.histTotal}>{fmtMoney(total)}</Text>
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
        </View>
      )}

      {/* ── DETAIL MODAL ── */}
      <DetailModal
        visible={detailVisible}
        title={
          detailLoading
            ? 'Đang tải...'
            : detailHeader?.id != null
            ? `Phiếu nhập #${detailHeader.id}`
            : 'Chi tiết phiếu nhập'
        }
        info={detailInfo}
        columns={detailColumns}
        rows={detailRows}
        onClose={() => { setDetailVisible(false); setDetailData(null); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 32, paddingHorizontal: 10, paddingTop: 14 },

  // ── Create rows ──
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowTitle: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.primary },
  removeText: { fontSize: 13, color: colors.danger },

  // Picker button (acts like an Input but opens a modal)
  pickerBtn: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  pickerBtnFilled: { borderColor: colors.primary },
  pickerBtnText: { fontSize: 14, color: colors.textMuted, fontFamily: fontFamily.regular },
  pickerBtnTextFilled: { fontSize: 14, color: colors.text, fontFamily: fontFamily.medium },
  pickerCode: { fontSize: 11, color: colors.primary, fontFamily: fontFamily.bold, marginTop: 2 },

  rowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  rowTotalLabel: { fontSize: 12, color: colors.textSoft, fontFamily: fontFamily.medium },
  rowTotalValue: { fontSize: 13, color: colors.primary, fontFamily: fontFamily.bold },

  addBtn: {
    borderWidth: 1,
    borderColor: '#c7d2e0',
    borderRadius: 11,
    borderStyle: 'dashed',
    backgroundColor: '#f8fafd',
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 10,
  },
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
    marginTop: 4,
    marginBottom: 4,
  },
  totalLabel: { fontSize: 13, color: colors.textSoft, fontFamily: fontFamily.medium },
  totalValue: { fontSize: 16, color: colors.primary, fontFamily: fontFamily.extrabold },

  // ── History ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 13.5,
  },
  reloadBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  reloadBtnText: { color: colors.primary, fontFamily: fontFamily.semibold, fontSize: 13 },

  histCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  histTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  histDate: { fontSize: 11, color: '#94a3b8' },
  histFrom: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  histReason: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  histTotal: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary, marginTop: 4 },
});
