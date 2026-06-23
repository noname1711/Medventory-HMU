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
  Tabs,
  Field,
  Input,
  Button,
  Badge,
  Empty,
  Pagination,
} from '../../theme/ui';

const STATUS_MAP = {
  PENDING: { label: 'Chờ duyệt', variant: 'pending' },
  APPROVED: { label: 'Đã duyệt', variant: 'approved' },
  REJECTED: { label: 'Từ chối', variant: 'rejected' },
};

const PAGE_SIZE = 8;

export default function ReplenishmentRequestScreen() {
  const [activeTab, setActiveTab] = useState('create');
  const [currentUser, setCurrentUser] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);

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

  // Pagination — reset to page 1 whenever the tab switches to history
  useEffect(() => { setPage(1); }, [activeTab, history.length]);
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
          <RefreshControl
            refreshing={histLoading}
            onRefresh={() => currentUser?.id && fetchHistory(currentUser.id)}
          />
        ) : undefined
      }
    >
      <PageFrame>
        <PageHead title="Tạo phiếu dự trù bổ sung vật tư" />

        <Tabs
          tabs={[
            { key: 'create', label: 'Tạo phiếu' },
            { key: 'history', label: 'Lịch sử' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'create' ? (
          <>
            <Section title="Thông tin phiếu">
              <Field label="Ghi chú">
                <Input
                  placeholder="Nhập ghi chú..."
                  value={form.note}
                  onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
                  multiline
                />
              </Field>
            </Section>

            <Section title="Danh sách vật tư cần bổ sung">
              {form.details.map((row, i) => (
                <View key={i} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>Vật tư #{i + 1}</Text>
                    {form.details.length > 1 && (
                      <TouchableOpacity
                        onPress={() =>
                          setForm((f) => ({ ...f, details: f.details.filter((_, idx) => idx !== i) }))
                        }
                      >
                        <Text style={styles.removeText}>✕ Xóa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Field label="Tên vật tư">
                    <Input
                      placeholder="Tên vật tư"
                      value={row.materialName}
                      onChangeText={(v) => updateRow(i, 'materialName', v)}
                    />
                  </Field>
                  <Field label="Số lượng yêu cầu">
                    <Input
                      placeholder="Số lượng yêu cầu"
                      value={row.qtyRequested}
                      onChangeText={(v) => updateRow(i, 'qtyRequested', v)}
                      keyboardType="numeric"
                    />
                  </Field>
                  <Field label="Lý do bổ sung">
                    <Input
                      placeholder="Lý do bổ sung"
                      value={row.reason}
                      onChangeText={(v) => updateRow(i, 'reason', v)}
                    />
                  </Field>
                  <Field label="Đơn vị tính">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {units.map((u) => {
                        const on = row.unitId === String(u.id);
                        return (
                          <TouchableOpacity
                            key={u.id}
                            style={[styles.chip, on && styles.chipActive]}
                            onPress={() => updateRow(i, 'unitId', String(u.id))}
                          >
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
              <Button title={loading ? '' : 'Gửi phiếu dự trù'} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.white} /> : null}
              </Button>
            </Section>
          </>
        ) : (
          <Section title="Lịch sử phiếu dự trù">
            {history.length === 0 ? (
              <Empty>Chưa có phiếu dự trù nào</Empty>
            ) : (
              <>
                {pagedHistory.map((item) => {
                  const status = STATUS_MAP[item.status] || { label: item.status, variant: 'info' };
                  return (
                    <TouchableOpacity key={String(item.id)} style={styles.histRow} onPress={() => setSelected(item)}>
                      <View style={styles.histInfo}>
                        <Text style={styles.histId}>Phiếu dự trù #{item.id}</Text>
                        <Text style={styles.histDate}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}
                        </Text>
                        {!!item.note && (
                          <Text style={styles.histNote} numberOfLines={1}>{item.note}</Text>
                        )}
                        <Text style={styles.histMeta}>{(item.details || []).length} vật tư</Text>
                      </View>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TouchableOpacity>
                  );
                })}
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
  label: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.label, marginBottom: 6 },
  chipRow: { gap: 8, paddingVertical: 2 },
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
  rowCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rowTitle: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.primary },
  removeText: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.semibold },
  addBtn: { marginBottom: 10 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  histInfo: { flex: 1 },
  histId: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 2 },
  histDate: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 2 },
  histNote: { fontSize: fontSize.sm, color: colors.textSoft, marginBottom: 2 },
  histMeta: { fontSize: fontSize.sm, color: colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  infoKey: { fontSize: 13, color: colors.textSoft, width: 100 },
  infoVal: { fontSize: 13, color: colors.text, flex: 1, fontFamily: fontFamily.medium },
  detailItem: { backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginBottom: 8 },
  detailName: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text, marginBottom: 4 },
  detailMeta: { fontSize: 12, color: colors.textSoft },
});
