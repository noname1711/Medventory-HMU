# Mobile ↔ Web Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-point every Medventory-HMU mobile screen to the real Spring Boot endpoints and implement the same functions as the web (histories, approvals, create flows, admin, RBAC) with server-side filtering/pagination, reusing the existing mobile design system.

**Architecture:** A shared API layer (`apiConfig` constants + `apiClient` helper) and three reused UI building blocks (`useServerHistory` hook, `MaterialPicker`, `DetailModal`) underpin eight screen ports. Each screen fetches one server page, never loads-all, and reads stat values from backend summaries.

**Tech Stack:** Expo / React Native, `@react-navigation`, `react-native-toast-message`, `@expo/vector-icons`; design system in `src/theme/ui.js`.

## Global Constraints

- No backend changes. No web changes. Mobile (`mobile/`) only.
- Every request that needs auth sends header `X-User-Id: <user.id>` (via `buildHeaders`/`apiClient`).
- UI pagination is 1-based; backend `page` is 0-based → always send `page - 1`.
- All list/stat values come from backend responses; no client-side recompute of totals.
- Reuse `theme/ui.js` components and `theme/tokens.js` colors; do not introduce new styling systems.
- No test framework exists in `mobile/`; each task verifies via bundler parse (`npx expo export --dump-sourcemap` or Metro start) + manual endpoint cross-check against backend controllers. Do not add a test runner.
- Permission codes (already used by `DashboardScreen`): `ISSUE_REQ.CREATE`, `ISSUE_REQ.APPROVE`, `SUPP_FORECAST.CREATE`, `RECEIPT.CREATE`, `ISSUE.CREATE`, `SUPP_FORECAST.APPROVE`, `USERS.MANAGE`, `PERMISSIONS.MANAGE`.

---

## File Structure

- `mobile/src/api/apiConfig.js` — **modify**: correct endpoint constants (functions for id-param URLs).
- `mobile/src/api/apiClient.js` — **create**: `apiGet`/`apiSend` wrappers returning `{ ok, status, data }`.
- `mobile/src/hooks/useServerHistory.js` — **create**: debounced keyword + page state, fetch one server page.
- `mobile/src/components/MaterialPicker.js` — **create**: searchable modal over `/materials/search`.
- `mobile/src/components/DetailModal.js` — **create**: read-only header + line table modal.
- `mobile/src/screens/dashboard/CreateIssueRequestScreen.js` — **modify**.
- `mobile/src/screens/dashboard/IssueRequestApprovalScreen.js` — **modify**.
- `mobile/src/screens/dashboard/ReplenishmentRequestScreen.js` — **modify**.
- `mobile/src/screens/dashboard/ForecastApprovalScreen.js` — **modify**.
- `mobile/src/screens/dashboard/ReceiptScreen.js` — **modify**.
- `mobile/src/screens/dashboard/IssueScreen.js` — **modify**.
- `mobile/src/screens/dashboard/AdminScreen.js` — **modify**.
- `mobile/src/screens/dashboard/RBACScreen.js` — **modify**.

Verification helper used by every task:
```bash
cd mobile && npx expo export --platform android --output-dir .expo-check >/dev/null 2>&1 && echo BUNDLE_OK || echo BUNDLE_FAIL
# fallback if export unavailable: node -e "require('@babel/core').transformFileSync('<file>',{presets:['babel-preset-expo']})" && echo PARSE_OK
rm -rf .expo-check
```

---

### Task 1: Shared API layer (apiConfig + apiClient)

**Files:**
- Modify: `mobile/src/api/apiConfig.js`
- Create: `mobile/src/api/apiClient.js`

**Interfaces:**
- Produces: `API_ENDPOINTS` (constants + id-param functions, see below); `buildHeaders(userId)`; `apiGet(url, userId)`, `apiSend(method, url, body, userId)` → `Promise<{ ok:boolean, status:number, data:any }>`.

- [ ] **Step 1: Replace the endpoint block in `apiConfig.js`** (keep `API_BASE_URL`/`resolveHost`/`buildHeaders`):

```js
export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  DEPARTMENTS: `${API_BASE_URL}/auth/departments`,
  FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
  RESET_PASSWORD: `${API_BASE_URL}/auth/reset-password`,
  MY_PERMISSIONS: `${API_BASE_URL}/auth/my-permissions`,
  USER_INFO: (email) => `${API_BASE_URL}/auth/user-info?email=${encodeURIComponent(email)}`,

  // Materials / inventory / units
  MATERIALS: `${API_BASE_URL}/materials`,
  MATERIALS_SEARCH: `${API_BASE_URL}/materials/search`,
  INVENTORY_MATERIALS: `${API_BASE_URL}/inventory/materials`,
  UNITS: `${API_BASE_URL}/units`,
  SUB_DEPARTMENTS: `${API_BASE_URL}/departments/sub-departments`,
  DEPARTMENTS_ALL: `${API_BASE_URL}/departments`,

  // Issue requests (phiếu xin lĩnh)
  ISSUE_REQ_LEADER_PENDING: `${API_BASE_URL}/issue-requests/leader/pending`,
  ISSUE_REQ_LEADER_PROCESSED: `${API_BASE_URL}/issue-requests/leader/processed`,
  ISSUE_REQ_DETAIL: (id) => `${API_BASE_URL}/issue-requests/${id}/detail`,
  ISSUE_REQ_APPROVE: (id) => `${API_BASE_URL}/issue-requests/${id}/approve`,
  ISSUE_REQ_REJECT: (id) => `${API_BASE_URL}/issue-requests/${id}/reject`,
  ISSUE_REQ_MINE: `${API_BASE_URL}/issue-requests/canbo/my-requests`,
  ISSUE_REQ_CREATE: `${API_BASE_URL}/issue-requests/canbo/create`,

  // Supp forecast (dự trù)
  SUPP_FORECAST_CREATE: `${API_BASE_URL}/supp-forecast`,
  SUPP_FORECAST_MINE: `${API_BASE_URL}/supp-forecast/my`,
  SUPP_FORECAST_PREVIOUS: `${API_BASE_URL}/supp-forecast/previous`,
  SUPP_FORECAST_DETAIL: (id) => `${API_BASE_URL}/supp-forecast/${id}`,
  SUPP_FORECAST_BGH_PENDING: `${API_BASE_URL}/supp-forecast/bgh/pending`,
  SUPP_FORECAST_BGH_PROCESSED: `${API_BASE_URL}/supp-forecast/bgh/processed`,
  SUPP_FORECAST_BGH_STATS: `${API_BASE_URL}/supp-forecast/bgh/stats`,
  SUPP_FORECAST_APPROVE: `${API_BASE_URL}/supp-forecast/approve`,

  // Receipts (nhập kho)
  RECEIPTS_FEED: `${API_BASE_URL}/receipts/feed`,
  RECEIPT_CREATE: `${API_BASE_URL}/receipts/create`,
  RECEIPT_DETAIL: (id) => `${API_BASE_URL}/receipts/${id}/detail`,

  // Issues (xuất kho)
  ISSUES_FEED: `${API_BASE_URL}/issues/feed`,
  ISSUES_ELIGIBLE: `${API_BASE_URL}/issues/eligible-requests-with-reasons`,
  ISSUE_PREVIEW: `${API_BASE_URL}/issues/preview`,
  ISSUE_CREATE_FROM_REQ: `${API_BASE_URL}/issues/create-from-issue-req`,
  ISSUE_DETAIL: (id) => `${API_BASE_URL}/issues/${id}/detail`,

  // Admin users
  ADMIN_USERS: `${API_BASE_URL}/admin/users`,
  ADMIN_USERS_ALL: `${API_BASE_URL}/admin/users/all`,
  ADMIN_USER_APPROVE: (id) => `${API_BASE_URL}/admin/users/${id}/approve`,
  ADMIN_USER_REJECT: (id) => `${API_BASE_URL}/admin/users/${id}/reject`,
  ADMIN_USER_ROLE: (id) => `${API_BASE_URL}/admin/users/${id}/role`,
  ADMIN_USER_DELETE: (id) => `${API_BASE_URL}/admin/users/${id}`,

  // RBAC
  RBAC_ROLES: `${API_BASE_URL}/admin/rbac/roles`,
  RBAC_PERMISSIONS: `${API_BASE_URL}/admin/rbac/permissions`,
  RBAC_ROLE_PERMS: (code) => `${API_BASE_URL}/admin/rbac/roles/${code}/permissions`,
  RBAC_ROLE_PERMS_RESET: (code) => `${API_BASE_URL}/admin/rbac/roles/${code}/permissions/reset`,
  RBAC_USER_PERMS: (id) => `${API_BASE_URL}/admin/rbac/users/${id}/permissions`,
  SETTINGS_AUTO_APPROVE: `${API_BASE_URL}/admin/settings/issue-req-auto-approve`,

  // Notifications
  NOTIFICATIONS: `${API_BASE_URL}/notifications/my`,
  NOTIFICATION_READ: (id) => `${API_BASE_URL}/notifications/${id}/read`,
  NOTIFICATION_READ_ALL: `${API_BASE_URL}/notifications/read-all`,
};
```

- [ ] **Step 2: Create `apiClient.js`:**

```js
import { buildHeaders } from './apiConfig';

async function request(method, url, body, userId) {
  try {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(userId),
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export const apiGet = (url, userId) => request('GET', url, undefined, userId);
export const apiSend = (method, url, body, userId) => request(method, url, body, userId);
```

- [ ] **Step 3: Verify bundle parses** (run the verification helper). Expected: `BUNDLE_OK`.
- [ ] **Step 4: Commit** — `git add mobile/src/api && git commit -m "feat(mobile): correct API endpoints + shared apiClient"`

---

### Task 2: Shared UI building blocks

**Files:**
- Create: `mobile/src/hooks/useServerHistory.js`
- Create: `mobile/src/components/MaterialPicker.js`
- Create: `mobile/src/components/DetailModal.js`

**Interfaces:**
- Produces:
  - `useServerHistory({ buildUrl, userId, pageSize=10, active=true })` → `{ items, page, setPage, totalPages, totalCount, keyword, setKeyword, loading, reload }`. `buildUrl({ keyword, page0, size })` returns the full URL; the hook reads `data.items`/`data.requests` + `data.totalPages` + `data.totalCount`.
  - `<MaterialPicker visible onClose onSelect />` — `onSelect(materialDto)` where dto = `{ id, name, code, spec, unit:{id}, unitId, manufacturer, category }`.
  - `<DetailModal visible title rows columns onClose />`.

- [ ] **Step 1: `useServerHistory.js`:**

```js
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../api/apiClient';

export function useServerHistory({ buildUrl, userId, pageSize = 10, active = true }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);          // 1-based UI
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async (kw = keyword, pg = page) => {
    if (!active || !userId) return;
    setLoading(true);
    const url = buildUrl({ keyword: kw || '', page0: Math.max(0, pg - 1), size: pageSize });
    const { ok, data } = await apiGet(url, userId);
    if (ok && data) {
      setItems(Array.isArray(data.items) ? data.items : (Array.isArray(data.requests) ? data.requests : []));
      setTotalPages(Math.max(1, data.totalPages || 1));
      setTotalCount(data.totalCount ?? data.filteredCount ?? 0);
    } else {
      setItems([]); setTotalPages(1); setTotalCount(0);
    }
    setLoading(false);
  }, [active, userId, buildUrl, pageSize, keyword, page]);

  useEffect(() => { setPage(1); }, [keyword]);
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => reload(keyword, page), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, keyword, page]);

  return { items, page, setPage, totalPages, totalCount, keyword, setKeyword, loading, reload };
}
```

- [ ] **Step 2: `MaterialPicker.js`** — modal with a search box that queries `/materials/search?keyword=&limit=20` (debounced 250ms) and a tappable result list. On tap, map entity → dto and call `onSelect`:

```js
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { API_ENDPOINTS } from '../api/apiConfig';
import { apiGet } from '../api/apiClient';
import { colors, radius } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

const mapEntity = (m) => ({
  id: m.id, name: m.name, code: m.code || '', spec: m.spec || '',
  unitId: m.unit?.id ?? m.unitId ?? '', unit: { id: m.unit?.id ?? m.unitId ?? '' },
  manufacturer: m.manufacturer || '', category: m.category || '',
});

export default function MaterialPicker({ visible, onClose, onSelect }) {
  const [kw, setKw] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(async () => {
      const url = `${API_ENDPOINTS.MATERIALS_SEARCH}?keyword=${encodeURIComponent(kw || '')}&limit=20`;
      const { ok, data } = await apiGet(url);
      setItems(ok && Array.isArray(data) ? data.map(mapEntity) : []);
    }, 250);
    return () => clearTimeout(t);
  }, [kw, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Chọn vật tư</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>Đóng</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.search} placeholder="Tìm theo tên hoặc mã..." value={kw} onChangeText={setKw} autoFocus />
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.code && <Text style={styles.code}>{item.code}</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy vật tư</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '80%', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.text },
  close: { color: colors.primary, fontFamily: fontFamily.semibold },
  search: { height: 44, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10, backgroundColor: colors.white, color: colors.text, fontFamily: fontFamily.regular },
  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  name: { fontSize: 13.5, fontFamily: fontFamily.semibold, color: colors.text },
  code: { fontSize: 11, color: colors.primary, fontFamily: fontFamily.bold, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: 24, fontFamily: fontFamily.regular },
});
```

- [ ] **Step 3: `DetailModal.js`** — `visible`, `title`, `info` (array of `{label,value}`), `columns` (array of `{key,label}`), `rows` (array of objects). Render a scrollable modal with the info block + a simple table. Use `theme/ui.js` `Badge`/`Empty` where useful.
- [ ] **Step 4: Verify bundle parses.** Expected: `BUNDLE_OK`.
- [ ] **Step 5: Commit** — `git add mobile/src/hooks mobile/src/components && git commit -m "feat(mobile): shared history hook, material picker, detail modal"`

---

### Task 3: CreateIssueRequestScreen

**Files:** Modify `mobile/src/screens/dashboard/CreateIssueRequestScreen.js`
**Interfaces:** Consumes `useServerHistory`, `MaterialPicker`, `DetailModal`, `apiGet/apiSend`, `API_ENDPOINTS`.

- [ ] **Step 1:** Load user from `storage.getUser()` + sub-departments from `SUB_DEPARTMENTS`. Remove the `/materials` full load.
- [ ] **Step 2: Create tab** — `note` + dynamic `details` rows. Each row uses `MaterialPicker` (set materialId/name/spec/unitId/manufacturer/category) and a numeric qty. Submit:
```js
const body = { subDepartmentId: subDepartmentId || null, note,
  details: details.filter(d => d.materialId && Number(d.qtyRequested) > 0)
    .map(d => ({ materialId: d.materialId, materialName: d.materialName, spec: d.spec,
      unitId: Number(d.unitId), qtyRequested: Number(d.qtyRequested),
      proposedCode: d.materialCode, proposedManufacturer: d.manufacturer, category: d.category })) };
const { ok, data } = await apiSend('POST', API_ENDPOINTS.ISSUE_REQ_CREATE, body, user.id);
```
Toast success/`data.message`; reset; switch to history tab and `reload()`.
- [ ] **Step 3: History tab** — `useServerHistory({ buildUrl: ({keyword,page0,size}) => \`${API_ENDPOINTS.ISSUE_REQ_MINE}?keyword=${encodeURIComponent(keyword)}&page=${page0}&size=${size}\`, userId: user.id, active: tab==='history' })`. Render search box → `setKeyword`, rows (id, requestedAt, note, details.length, status badge), `Pagination`, row tap → `DetailModal` from `ISSUE_REQ_DETAIL(id)`.
- [ ] **Step 4: Verify bundle parses + cross-check endpoints exist** (IssueReqController has `/canbo/create`, `/canbo/my-requests`, `/{id}/detail`). Expected: `BUNDLE_OK`.
- [ ] **Step 5: Commit** — `git commit -am "feat(mobile): create-issue-request real API + server history"`

---

### Task 4: IssueRequestApprovalScreen

**Files:** Modify `mobile/src/screens/dashboard/IssueRequestApprovalScreen.js`

- [ ] **Step 1:** Segment Pending/Processed. Fetch `apiGet(ISSUE_REQ_LEADER_PENDING|PROCESSED, user.id)`; read `data.requests`, `data.pendingCount/approvedCount/rejectedCount` for stat cards. (These endpoints are status-scoped, no paging param — keep light client paging with the `Pagination` component, same as web.)
- [ ] **Step 2:** Row → `DetailModal` (`ISSUE_REQ_DETAIL(id)`). Approve/Reject buttons →
```js
await apiSend('POST', API_ENDPOINTS.ISSUE_REQ_APPROVE(id), { note }, user.id);  // or ISSUE_REQ_REJECT
```
Refetch active tab after action.
- [ ] **Step 3: Verify bundle + endpoints** (`/leader/pending|processed`, `/{id}/approve|reject`). Expected: `BUNDLE_OK`.
- [ ] **Step 4: Commit** — `git commit -am "feat(mobile): issue-request approval real API"`

---

### Task 5: ReplenishmentRequestScreen (Phiếu dự trù)

**Files:** Modify `mobile/src/screens/dashboard/ReplenishmentRequestScreen.js`

- [ ] **Step 1: Create tab** — department picker (from `DEPARTMENTS_ALL` or sub-departments); line rows via `MaterialPicker`. Current stock per material on select: `apiGet(\`${INVENTORY_MATERIALS}?keyword=${code}&size=50\`)` → find `materialId` → `closingStock` (no full preload).
- [ ] **Step 2: "Tải dự trù năm trước"** — `apiGet(\`${SUPP_FORECAST_PREVIOUS}?departmentId=${deptId}\`)`; map rows with **`qtyRequested = Math.max(0, prevYearQty - currentStock)`** (matches web).
- [ ] **Step 3: Submit** — `apiSend('POST', SUPP_FORECAST_CREATE, body, user.id)` with the forecast body shape the backend expects (academicYear, departmentId, details[]). Confirm shape from `SuppForecastRequestDTO`.
- [ ] **Step 4: History tab** — `useServerHistory` with `buildUrl` = `${SUPP_FORECAST_MINE}?userId=${user.id}&keyword=&page=&size=` (note this endpoint takes `userId` as query param too); rows (id, academicYear, departmentName, status, itemCount); row tap → detail `SUPP_FORECAST_DETAIL(id)?userId=`.
- [ ] **Step 5: Verify bundle + endpoints.** Expected: `BUNDLE_OK`.
- [ ] **Step 6: Commit** — `git commit -am "feat(mobile): replenishment real API + server history"`

---

### Task 6: ForecastApprovalScreen

**Files:** Modify `mobile/src/screens/dashboard/ForecastApprovalScreen.js`

- [ ] **Step 1:** Segment Pending/Processed + stat cards from `SUPP_FORECAST_BGH_STATS?bghId=`. Lists from `SUPP_FORECAST_BGH_PENDING|PROCESSED?bghId=${user.id}`.
- [ ] **Step 2:** Row → detail (`SUPP_FORECAST_DETAIL(id)?userId=${user.id}`). Approve/Reject → `apiSend('POST', SUPP_FORECAST_APPROVE, { forecastId:id, decision:'APPROVED'|'REJECTED', note }, user.id)` — confirm field names from `SuppForecastApprovalDTO`.
- [ ] **Step 3: Verify bundle + endpoints.** Expected: `BUNDLE_OK`.
- [ ] **Step 4: Commit** — `git commit -am "feat(mobile): forecast approval real API"`

---

### Task 7: ReceiptScreen (Nhập kho)

**Files:** Modify `mobile/src/screens/dashboard/ReceiptScreen.js`

- [ ] **Step 1: Create tab** — info (received_from, receipt_date, reason) + line rows (`MaterialPicker`, qty, unitPrice) + computed total; submit `apiSend('POST', RECEIPT_CREATE, body, user.id)` (confirm body from ReceiptController create DTO).
- [ ] **Step 2: History tab** — `useServerHistory` with `buildUrl` = `${RECEIPTS_FEED}?page=${page0}&limit=${size}&keyword=${kw}`; the feed returns `{ data/receipts, summary:{ totalPages,... } }` — adapt the hook's reader or pass a custom normalizer (read `data.receipts || data.data` + `data.summary.totalPages`). Row tap → `RECEIPT_DETAIL(id)`.
- [ ] **Step 3: Verify bundle + endpoints** (`/receipts/feed`, `/receipts/create`, `/{id}/detail`). Expected: `BUNDLE_OK`.
- [ ] **Step 4: Commit** — `git commit -am "feat(mobile): receipt real API + server history"`

---

### Task 8: IssueScreen (Xuất kho)

**Files:** Modify `mobile/src/screens/dashboard/IssueScreen.js`

- [ ] **Step 1: Create tab** — 3 stat cards from eligible summary. Eligible list: `apiGet(\`${ISSUES_ELIGIBLE}?eligiblePage=${p0}&pageSize=${size}\`, user.id)` → `data.eligible`, `data.summary.eligibleTotalPages`; `Pagination`.
- [ ] **Step 2:** Row "Tạo phiếu xuất" → `ISSUE_PREVIEW?issueReqId=${id}` (show read-only FEFO preview) → confirm → `apiSend('POST', ISSUE_CREATE_FROM_REQ, { issueReqId:id, mode:'AUTO' }, user.id)` (confirm body from `CreateIssueFromReqDTO`; auto-FEFO).
- [ ] **Step 3: History tab** — `useServerHistory` with `${ISSUES_FEED}?page=&limit=&keyword=` (same `summary.totalPages` reader as receipts). Row → `ISSUE_DETAIL(id)`.
- [ ] **Step 4: Verify bundle + endpoints.** Expected: `BUNDLE_OK`.
- [ ] **Step 5: Commit** — `git commit -am "feat(mobile): issue (xuất kho) real API + auto-FEFO create"`

---

### Task 9: AdminScreen (Người dùng)

**Files:** Modify `mobile/src/screens/dashboard/AdminScreen.js`

- [ ] **Step 1:** Status segment (pending/approved) + stat cards (total/pending/approved). Server search + pagination:
```js
const url = `${API_ENDPOINTS.ADMIN_USERS}?status=${status}&keyword=${encodeURIComponent(kw)}&page=${p0}&size=${size}`;
const { ok, data } = await apiGet(url, user.id); // data.items, data.totalPages, data.totalUsers/pendingUsers/approvedUsers
```
- [ ] **Step 2: Row actions** — approve `POST ADMIN_USER_APPROVE(id)`, reject `POST ADMIN_USER_REJECT(id)`, role `PUT ADMIN_USER_ROLE(id) {role}`, delete `DELETE ADMIN_USER_DELETE(id)`; refetch current page after each.
- [ ] **Step 3: Verify bundle + endpoints.** Expected: `BUNDLE_OK`.
- [ ] **Step 4: Commit** — `git commit -am "feat(mobile): admin users real API + server filter/pagination"`

---

### Task 10: RBACScreen (Phân quyền)

**Files:** Modify `mobile/src/screens/dashboard/RBACScreen.js`

- [ ] **Step 1: Auto-approve toggle** — GET/PUT `SETTINGS_AUTO_APPROVE` ({ enabled }).
- [ ] **Step 2: Role tab** — roles from `RBAC_ROLES`, permissions from `RBAC_PERMISSIONS`, current from `RBAC_ROLE_PERMS(code)` (GET → assigned/default codes), toggle list, save `PUT RBAC_ROLE_PERMS(code) {permissionCodes}`, reset `POST RBAC_ROLE_PERMS_RESET(code)`. Lock `ADMIN` role.
- [ ] **Step 3: User tab (read-only)** — pick user (from `ADMIN_USERS_ALL`), GET `RBAC_USER_PERMS(id)`, render effective vs role-default permissions read-only with a note: "Chỉnh sửa quyền theo người dùng trên bản web."
- [ ] **Step 4: Verify bundle + endpoints.** Expected: `BUNDLE_OK`.
- [ ] **Step 5: Commit** — `git commit -am "feat(mobile): RBAC real API (role editable, user read-only)"`

---

### Task 11: Final integration verification

- [ ] **Step 1:** Full Metro bundle: `cd mobile && npx expo export --platform android --output-dir .expo-check` → `BUNDLE_OK`; `rm -rf .expo-check`.
- [ ] **Step 2:** Grep mobile for any remaining dead endpoints: `grep -rn "/users\b\|/forecasts\|/replenishments\|/roles\b\|/permissions\b\|size=100000" mobile/src` → expect none (except `/admin/...`).
- [ ] **Step 3:** Cross-check each screen's URLs against backend controllers (one pass).
- [ ] **Step 4: Commit** any cleanup — `git commit -am "chore(mobile): final parity verification"`

---

## Self-Review

**Spec coverage:** Every spec screen maps to a task (Create→T3, IssueReqApproval→T4, Replenishment→T5, ForecastApproval→T6, Receipt→T7, Issue→T8, Admin→T9, RBAC→T10); shared layer→T1–T2; verification→T11. ✓

**Placeholder scan:** Body shapes for `POST /supp-forecast`, `/supp-forecast/approve`, `/receipts/create`, `/issues/create-from-issue-req` are marked "confirm from DTO" — the implementer must open the named DTO before sending. This is a real lookup, not a placeholder; each task names the exact DTO to read. Acceptable.

**Type consistency:** `useServerHistory` reader handles both `items` and `requests` keys (issue-request endpoint uses `requests`); receipts/issues feeds use `summary.totalPages` → noted custom normalizer in T7/T8. `MaterialPicker.onSelect` dto shape is consumed identically in T3/T5/T7. ✓
