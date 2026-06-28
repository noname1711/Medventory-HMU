# Mobile ↔ Web Parity — Design Spec

**Date:** 2026-06-28
**Scope:** Make the Expo/React Native mobile app reach full feature + backend-API parity with the web app for Medventory-HMU. Mobile-only changes; no backend or web changes.

## Problem

The mobile screens call REST endpoints that do not exist in the Spring Boot backend (`/users`, `/receipts` plain GET, `/issues` plain GET, `/forecasts`, `/replenishments`, `/roles`, `/permissions`, `/issue-requests?requestedById=`). The actual backend roots are:

```
/api/admin  /api/auth  /api/departments  /api/inventory  /api/issue-requests
/api/issues /api/materials  /api/notifications  /api/supp-forecast  /api/units
```

As a result, the mobile history / approval / admin / RBAC / create flows are non-functional. They must be re-pointed to the real endpoints and implement the same functions as the web, with server-side filtering and pagination, reusing the existing mobile design system.

## What already works (keep unchanged)

- `src/navigation/AppNavigator.js` — auth gate.
- `src/context/AuthContext.js` — user/role/login/logout.
- `src/screens/dashboard/DashboardScreen.js` — bottom tabs gated by permission codes from `/auth/my-permissions` (`ISSUE_REQ.CREATE`, `ISSUE_REQ.APPROVE`, `SUPP_FORECAST.CREATE`, `RECEIPT.CREATE`, `ISSUE.CREATE`, `SUPP_FORECAST.APPROVE`, `USERS.MANAGE`, `PERMISSIONS.MANAGE`).
- `src/theme/ui.js` + `theme/tokens.js` + `theme/typography.js` — design system (`Section, StatCard, Field, Input, Button, Badge, Empty, Pagination`, etc.).
- `src/screens/dashboard/EquipmentListScreen.js` — already converted to server-side keyword/status/page against `/inventory/materials`.

## Decisions

- **Flow fidelity:** same backend API + cover every function, but touch-simplified UI for the densest interactions:
  - **Issue (Xuất kho) create:** select eligible voucher → read-only FEFO preview → confirm → create via auto-FEFO. No manual per-lot editing on mobile.
  - **RBAC:** role-permission editing fully functional; per-user permission overrides shown **read-only** with a note.
- **Delivery:** all remaining screens in one pass, verify together at the end.
- **No backend changes** — every endpoint already exists (the web filtering/pagination work added the needed params).

## Architecture

### Shared API layer
1. Rewrite `src/api/apiConfig.js` endpoint constants to the real roots (table below).
2. Add `src/api/apiClient.js` — thin helper:
   - `apiGet(url, userId)`, `apiSend(method, url, body, userId)` → set `Content-Type`, `X-User-Id`; parse JSON; return `{ ok, status, data }`; never throw on HTTP error.
   - Keeps every screen consistent and removes ad-hoc `fetch` + header duplication.

### Shared UI patterns (reused across screens)
- **Server history hook** `useServerHistory({ url, userId, pageSize })`: holds `keyword` (debounced 300ms, resets to page 0), `page` (1-based UI → send `page-1`), `items`, `totalPages`, `loading`; refetches on keyword/page change. Returns helpers for the screen.
- **MaterialPicker** (shared component): searchable modal calling `/materials/search?keyword=&limit=20`; `onSelect(material)` returns the full DTO for auto-fill.
- **DetailModal**: read-only header info + line table built from `theme/ui.js`.
- **Stat cards**: values always read from backend summaries — never recomputed client-side.

### Endpoint map (mobile → backend)

| Constant | URL |
|---|---|
| `MATERIALS` / `MATERIALS_SEARCH` | `/materials`, `/materials/search?keyword=&limit=` |
| `INVENTORY_MATERIALS` | `/inventory/materials?keyword=&status=&page=&size=` |
| `UNITS` | `/units` |
| `SUB_DEPARTMENTS` | `/departments/sub-departments` |
| `ISSUE_REQ_LEADER_PENDING/PROCESSED` | `/issue-requests/leader/pending|processed` (X-User-Id) |
| `ISSUE_REQ_DETAIL(id)` | `/issue-requests/{id}/detail` |
| `ISSUE_REQ_APPROVE/REJECT(id)` | `POST /issue-requests/{id}/approve|reject` (body `ApprovalActionDTO`) |
| `ISSUE_REQ_MINE` | `/issue-requests/canbo/my-requests?keyword=&page=&size=` (X-User-Id) |
| `ISSUE_REQ_CREATE` | `POST /issue-requests/canbo/create` (X-User-Id) |
| `SUPP_FORECAST` | `POST /supp-forecast` |
| `SUPP_FORECAST_MINE` | `/supp-forecast/my?userId=&keyword=&page=&size=` |
| `SUPP_FORECAST_PREVIOUS` | `/supp-forecast/previous?departmentId=` |
| `SUPP_FORECAST_DETAIL(id)` | `/supp-forecast/{id}?userId=` |
| `SUPP_FORECAST_BGH_*` | `/supp-forecast/bgh/pending|processed|stats?bghId=` |
| `SUPP_FORECAST_APPROVE` | `POST /supp-forecast/approve` (body `SuppForecastApprovalDTO`) |
| `RECEIPTS_FEED` | `/receipts/feed?page=&limit=&keyword=` |
| `RECEIPT_CREATE` | `POST /receipts/create` |
| `RECEIPT_DETAIL(id)` | `/receipts/{id}/detail` |
| `ISSUES_FEED` | `/issues/feed?page=&limit=&keyword=` |
| `ISSUES_ELIGIBLE` | `/issues/eligible-requests-with-reasons?…&eligiblePage=&pageSize=` |
| `ISSUE_PREVIEW` | `/issues/preview?issueReqId=` |
| `ISSUE_CREATE_FROM_REQ` | `POST /issues/create-from-issue-req` |
| `ISSUE_DETAIL(id)` | `/issues/{id}/detail` |
| `ADMIN_USERS` | `/admin/users?status=&keyword=&page=&size=` |
| `ADMIN_USER_ACTION(id)` | `/admin/users/{id}/approve|reject|role`, `DELETE /admin/users/{id}` |
| `RBAC_ROLES/PERMISSIONS` | `/admin/rbac/roles`, `/admin/rbac/permissions` |
| `RBAC_ROLE_PERMS(code)` | `/admin/rbac/roles/{code}/permissions` (GET/PUT), `…/reset` (POST) |
| `RBAC_USER_PERMS(id)` | `/admin/rbac/users/{id}/permissions` (GET) |
| `SETTINGS_AUTO_APPROVE` | `/admin/settings/issue-req-auto-approve` (GET/PUT) |
| `MY_PERMISSIONS` | `/auth/my-permissions` |

## Per-screen specifications

### CreateIssueRequestScreen
- Sender info bar (name/dept/subdept/role).
- Material lines: MaterialPicker (server search) auto-fills name/spec/unit/manufacturer/category; "Mã code" blur → server lookup; qty numeric.
- Submit → `POST /canbo/create` (X-User-Id); on success go to history.
- History tab: server keyword search + pagination via `/canbo/my-requests`; row → detail modal (`/{id}/detail`); status badges.

### IssueRequestApprovalScreen
- Pending / Processed segment.
- Lists from `/leader/pending|processed` (X-User-Id) — these return full per-status lists (no server paging param); mobile keeps simple client paging for the approval queue (acceptable; status-scoped, no keyword filter on web either).
- Row → detail modal; Approve / Reject buttons → `POST /{id}/approve|reject` with `{ note }`.

### ReplenishmentRequestScreen (Phiếu dự trù)
- Department picker; line table.
- "Tải dự trù năm trước" → `/previous?departmentId=`; **Dự trù = max(0, năm trước − hiện có)** (matches web fix). Current stock per material via `/inventory/materials?keyword=` on demand (no full preload).
- Submit → `POST /supp-forecast`.
- History tab: server keyword + pagination via `/my`; row → detail (`/{id}?userId=`).

### ForecastApprovalScreen
- Pending / Processed segment + stat cards from `/bgh/stats`.
- Lists from `/bgh/pending|processed?bghId=`.
- Row → detail; Approve / Reject → `POST /supp-forecast/approve` with `SuppForecastApprovalDTO` (id + decision + note).

### ReceiptScreen (Nhập kho)
- Create: info (supplier, date, reason) + line rows (MaterialPicker server search, qty, price) + total; submit `POST /receipts/create`.
- History tab: `/receipts/feed?page=&keyword=` server search + pagination; row → detail (`/{id}/detail`).

### IssueScreen (Xuất kho)
- 3 stat cards from eligible-with-reasons summary (checked/eligible/ineligible).
- Eligible list: `/eligible-requests-with-reasons?eligiblePage=&pageSize=` server-paged; row → `/preview?issueReqId=` (read-only FEFO) → confirm → `POST /create-from-issue-req` (auto-FEFO).
- History tab: `/issues/feed?page=&keyword=` server search + pagination; row → detail.

### AdminScreen (Người dùng)
- Status segment (Chờ duyệt / Đã duyệt) + stat cards (total/pending/approved) from `/admin/users` summary.
- Server keyword search + pagination via `/admin/users?status=&keyword=&page=`.
- Row actions: approve (`/{id}/approve`), reject (`/{id}/reject`), change role (`PUT /{id}/role`), delete (`DELETE /{id}`); refetch current page after each.

### RBACScreen (Phân quyền)
- Auto-approve toggle: GET/PUT `/admin/settings/issue-req-auto-approve`.
- Role tab: pick role (`/admin/rbac/roles`), list permissions (`/admin/rbac/permissions`), toggle, save (`PUT /roles/{code}/permissions`), reset (`POST …/reset`). Admin role locked.
- User tab: pick user, show effective vs role-default permissions **read-only** (note explains editing is on web).

## Testing / verification
- Expo has no compile gate; verify by: (a) `npx expo export` or Metro bundle dry-run if available; (b) per-file parse via babel if bundler unavailable; (c) manual endpoint cross-check against backend controllers.
- Backend left unchanged; confirm no controller signatures referenced that don't exist.

## Risks
- Some backend list endpoints (`/leader/pending|processed`, `/bgh/pending|processed`) are status-scoped without paging params — mobile keeps light client paging for those queues (consistent with web, which does the same). All keyword-searchable histories use server paging.
- Response shapes differ per endpoint; each screen uses a small normalizer (as the web does).
