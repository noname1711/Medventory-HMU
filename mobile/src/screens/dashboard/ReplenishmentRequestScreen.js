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
import { apiGet, apiSend } from '../../api/apiClient';
import { useServerHistory } from '../../hooks/useServerHistory';
import { useAuth } from '../../context/AuthContext';
import { statusBadge } from '../../utils/status';
import MaterialPicker from '../../components/MaterialPicker';
import DetailModal from '../../components/DetailModal';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  Section,
  SegmentControl,
  MonoBadge,
  Field,
  Input,
  Button,
  Badge,
  Empty,
  Pagination,
} from '../../theme/ui';

// ─── Constants ───────────────────────────────────────────────────────────────


const CURRENT_ACADEMIC_YEAR = '2025-2026';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createRow() {
  return {
    materialId: null,
    materialName: '',
    materialCode: '',
    specification: '',
    unitId: '',
    manufacturer: '',
    qtyAvailable: '',   // currentStock
    qtyLastYear: '',    // prevYearQty
    qtyRequested: '',   // thisYearQty
    reason: '',
  };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ReplenishmentRequestScreen() {
  const { user } = useAuth();

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState('create');

  // ── Create tab state ──
  const [departments, setDepartments] = useState([]);
  const [deptsLoaded, setDeptsLoaded] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  const [rows, setRows] = useState([createRow()]);
  const [pickerRowIndex, setPickerRowIndex] = useState(null); // which row is open
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── History tab state ──
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
    active: activeTab === 'history',
  });

  // ── Detail modal state ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── Departments ─────────────────────────────────────────────────────────

  async function ensureDepts() {
    if (deptsLoaded) { setShowDeptPicker(true); return; }
    const { ok, data } = await apiGet(API_ENDPOINTS.DEPARTMENTS_ALL, user?.id);
    const list = ok && Array.isArray(data) ? data : [];
    setDepartments(list);
    setDeptsLoaded(true);
    setShowDeptPicker(true);
  }

  // ─── Material pick ────────────────────────────────────────────────────────

  async function fetchCurrentStock(code, materialId) {
    if (!code && !materialId) return null;
    const kw = code || '';
    const { ok, data } = await apiGet(
      `${API_ENDPOINTS.INVENTORY_MATERIALS}?keyword=${encodeURIComponent(kw)}&size=50`,
      user?.id,
    );
    if (!ok || !data) return null;
    const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    const found = list.find((x) => x.materialId === materialId);
    return found ? (found.closingStock ?? null) : null;
  }

  async function handleSelectMaterial(dto) {
    // dto = { id, name, code, spec, unit:{id}, unitId, manufacturer, category }
    const idx = pickerRowIndex;
    setPickerRowIndex(null);
    if (idx === null) return;

    const stock = await fetchCurrentStock(dto.code, dto.id);

    setRows((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        materialId:    dto.id,
        materialName:  dto.name,
        materialCode:  dto.code || '',
        specification: dto.spec || '',
        unitId:        dto.unit?.id ?? dto.unitId ?? '',
        manufacturer:  dto.manufacturer || '',
        qtyAvailable:  stock != null ? String(stock) : '',
      };
      return next;
    });
  }

  function updateRow(idx, key, val) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  }

  function removeRow(idx) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRow() {
    setRows((prev) => [...prev, createRow()]);
  }

  // ─── Load previous year forecast ─────────────────────────────────────────

  async function loadPreviousForecast() {
    if (!selectedDeptId) {
      Toast.show({ type: 'info', text1: 'Vui lòng chọn bộ môn trước!' });
      return;
    }
    setLoadingPrev(true);
    try {
      const url = `${API_ENDPOINTS.SUPP_FORECAST_PREVIOUS}?departmentId=${selectedDeptId}`;
      const { ok, data } = await apiGet(url, user?.id);
      if (!ok || !Array.isArray(data) || data.length === 0) {
        Toast.show({ type: 'info', text1: 'Không có dữ liệu dự trù năm trước' });
        setLoadingPrev(false);
        return;
      }
      const mapped = data.map((item) => {
        const currentStock = Number(item.currentStock || 0);
        const prevYearQty  = Number(item.prevYearQty  || 0);
        const proposed     = Math.max(0, prevYearQty - currentStock);
        return {
          materialId:    item.materialId,
          materialName:  item.materialName  || '',
          materialCode:  item.materialCode  || '',
          specification: item.specification || '',
          unitId:        item.unitId        ?? '',
          manufacturer:  item.manufacturer  || '',
          qtyAvailable:  String(currentStock),
          qtyLastYear:   String(prevYearQty),
          qtyRequested:  String(proposed),
          reason:        'Tải từ dự trù năm trước',
        };
      });
      setRows(mapped);
      Toast.show({ type: 'success', text1: `Đã tải ${mapped.length} dòng từ năm trước` });
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi khi tải dự trù năm trước' });
    } finally {
      setLoadingPrev(false);
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const validRows = rows.filter((r) => r.materialId && Number(r.qtyRequested) > 0);
    if (!validRows.length) {
      Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 vật tư với số lượng > 0!' });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        academicYear:    CURRENT_ACADEMIC_YEAR,
        departmentId:    selectedDeptId ? Number(selectedDeptId) : null,
        createdByEmail:  user?.email ?? null,
        items: validRows.map((r) => ({
          materialId:          r.materialId ? Number(r.materialId) : null,
          currentStock:        Number(r.qtyAvailable  || 0),
          prevYearQty:         Number(r.qtyLastYear    || 0),
          thisYearQty:         Number(r.qtyRequested   || 0),
          proposedCode:        r.materialCode   || null,
          proposedManufacturer:r.manufacturer   || null,
          justification:       r.reason         || null,
        })),
      };

      const { ok, data } = await apiSend('POST', API_ENDPOINTS.SUPP_FORECAST_CREATE, body, user?.id);
      if (ok) {
        Toast.show({ type: 'success', text1: data?.message || 'Tạo phiếu dự trù thành công!' });
        setRows([createRow()]);
        setSelectedDeptId(null);
        setSelectedDeptName('');
        setActiveTab('history');
        histReload();
      } else {
        Toast.show({ type: 'error', text1: data?.message || data?.error || 'Tạo phiếu thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setSubmitting(false);
    }
  }

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
          activeTab === 'history' ? (
            <RefreshControl refreshing={histLoading} onRefresh={histReload} />
          ) : undefined
        }
      >
        <SegmentControl
          segments={[
            { key: 'create',  label: 'Tạo phiếu' },
            { key: 'history', label: 'Lịch sử'   },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {/* ═══════════════ CREATE TAB ═══════════════ */}
        {activeTab === 'create' && (
          <>
            {/* Department selector */}
            <Section title="Thông tin phiếu">
              <Field label="Bộ môn lập dự trù">
                <TouchableOpacity style={styles.deptBtn} onPress={ensureDepts} activeOpacity={0.75}>
                  <Text style={selectedDeptName ? styles.deptSelected : styles.deptPlaceholder}>
                    {selectedDeptName || 'Chọn bộ môn...'}
                  </Text>
                  <Text style={styles.deptArrow}>▾</Text>
                </TouchableOpacity>
              </Field>

              <TouchableOpacity
                style={[styles.ghostBtn, loadingPrev && styles.ghostBtnDisabled]}
                onPress={loadPreviousForecast}
                disabled={loadingPrev}
                activeOpacity={0.8}
              >
                {loadingPrev
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.ghostBtnText}>↻ Tải dự trù năm trước</Text>
                }
              </TouchableOpacity>
            </Section>

            {/* Row list */}
            <Section title="Danh sách vật tư dự trù">
              {rows.map((row, i) => (
                <View key={i} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>Vật tư #{i + 1}</Text>
                    {rows.length > 1 && (
                      <TouchableOpacity onPress={() => removeRow(i)}>
                        <Text style={styles.removeText}>✕ Xóa</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Material picker trigger */}
                  <Field label="Tên vật tư">
                    <TouchableOpacity
                      style={styles.pickerTrigger}
                      onPress={() => setPickerRowIndex(i)}
                      activeOpacity={0.75}
                    >
                      <Text style={row.materialName ? styles.pickerSelected : styles.pickerPlaceholder} numberOfLines={1}>
                        {row.materialName || 'Chọn vật tư...'}
                      </Text>
                      <Text style={styles.pickerArrow}>▾</Text>
                    </TouchableOpacity>
                  </Field>

                  {/* Read-only auto-filled fields */}
                  {!!row.specification && (
                    <Field label="Quy cách">
                      <Input value={row.specification} editable={false} style={styles.readOnly} />
                    </Field>
                  )}

                  <Field label="Tồn kho hiện có">
                    <Input
                      value={row.qtyAvailable}
                      editable={false}
                      style={styles.readOnly}
                      placeholder="—"
                    />
                  </Field>

                  <Field label="Năm trước">
                    <Input
                      value={row.qtyLastYear}
                      editable={false}
                      style={styles.readOnly}
                      placeholder="—"
                    />
                  </Field>

                  {/* Editable fields */}
                  <Field label="Số lượng dự trù *">
                    <Input
                      placeholder="Nhập số lượng"
                      value={row.qtyRequested}
                      onChangeText={(v) => updateRow(i, 'qtyRequested', v)}
                      keyboardType="numeric"
                    />
                  </Field>

                  <Field label="Lý do">
                    <Input
                      placeholder="Lý do dự trù"
                      value={row.reason}
                      onChangeText={(v) => updateRow(i, 'reason', v)}
                    />
                  </Field>
                </View>
              ))}

              <TouchableOpacity style={styles.addRowBtn} onPress={addRow} activeOpacity={0.8}>
                <Text style={styles.addRowText}>＋ Thêm vật tư</Text>
              </TouchableOpacity>

              <Button
                title={submitting ? '' : 'Gửi phiếu dự trù'}
                onPress={handleSubmit}
                disabled={submitting}
                style={{ marginTop: 10 }}
              >
                {submitting ? <ActivityIndicator color={colors.white} /> : null}
              </Button>
            </Section>
          </>
        )}

        {/* ═══════════════ HISTORY TAB ═══════════════ */}
        {activeTab === 'history' && (
          <Section title="Lịch sử phiếu dự trù">
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
          </Section>
        )}
      </ScrollView>

      {/* ── Department picker modal (reuses the same sheet style) ── */}
      {showDeptPicker && (
        <DeptPickerModal
          departments={departments}
          onSelect={(dept) => {
            setSelectedDeptId(dept.id);
            setSelectedDeptName(dept.name);
            setShowDeptPicker(false);
          }}
          onClose={() => setShowDeptPicker(false)}
        />
      )}

      {/* ── Material picker modal ── */}
      <MaterialPicker
        visible={pickerRowIndex !== null}
        onClose={() => setPickerRowIndex(null)}
        onSelect={handleSelectMaterial}
      />

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

// ─── Department picker ────────────────────────────────────────────────────────

function DeptPickerModal({ departments, onSelect, onClose }) {
  const [kw, setKw] = React.useState('');
  const filtered = kw
    ? departments.filter((d) => d.name?.toLowerCase().includes(kw.toLowerCase()))
    : departments;

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Chọn bộ môn</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.sheetClose}>Đóng</Text></TouchableOpacity>
        </View>
        <Input
          placeholder="Tìm bộ môn..."
          value={kw}
          onChangeText={setKw}
          style={{ marginHorizontal: 16, marginBottom: 8 }}
        />
        <ScrollView keyboardShouldPersistTaps="handled">
          {filtered.length === 0 && (
            <Text style={styles.sheetEmpty}>Không tìm thấy bộ môn</Text>
          )}
          {filtered.map((dept) => (
            <TouchableOpacity key={dept.id} style={styles.sheetRow} onPress={() => onSelect(dept)}>
              <Text style={styles.sheetRowText}>{dept.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { paddingBottom: 32, paddingHorizontal: 10, paddingTop: 14 },

  // ── Dept button ──
  deptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.white,
  },
  deptSelected:    { flex: 1, fontSize: fontSize.base, color: colors.text,     fontFamily: fontFamily.medium  },
  deptPlaceholder: { flex: 1, fontSize: fontSize.base, color: colors.textMuted, fontFamily: fontFamily.regular },
  deptArrow:       { fontSize: 12, color: colors.textSoft, marginLeft: 6 },

  // ── Ghost button (load prev year) ──
  ghostBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  ghostBtnDisabled: { borderColor: colors.border, opacity: 0.6 },
  ghostBtnText: { fontSize: fontSize.base, color: colors.primary, fontFamily: fontFamily.semibold },

  // ── Row card ──
  rowCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rowTitle:  { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.primary },
  removeText:{ fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.semibold },

  // ── Material picker trigger ──
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.white,
  },
  pickerSelected:    { flex: 1, fontSize: fontSize.base, color: colors.text,     fontFamily: fontFamily.medium,  marginRight: 4 },
  pickerPlaceholder: { flex: 1, fontSize: fontSize.base, color: colors.textMuted, fontFamily: fontFamily.regular, marginRight: 4 },
  pickerArrow:       { fontSize: 12, color: colors.textSoft },

  // ── Read-only input ──
  readOnly: { backgroundColor: colors.bg, color: colors.textSoft },

  // ── Add row button ──
  addRowBtn: {
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c7d2e0',
    backgroundColor: '#f8fafd',
    alignItems: 'center',
  },
  addRowText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary },

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

  // ── Dept picker modal overlay ──
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle:    { fontSize: fontSize.md,   fontFamily: fontFamily.bold,     color: colors.text    },
  sheetClose:    { fontSize: fontSize.base, fontFamily: fontFamily.semibold, color: colors.primary },
  sheetRow:      { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetRowText:  { fontSize: fontSize.base, fontFamily: fontFamily.medium, color: colors.text },
  sheetEmpty:    { textAlign: 'center', color: colors.textMuted, paddingVertical: 24, fontFamily: fontFamily.regular },
});
