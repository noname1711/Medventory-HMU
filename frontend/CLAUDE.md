# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite, default http://localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint check
```

There is no test suite configured.

## Architecture

**Medventory-HMU** is a Vietnamese-language medical supply management frontend for Hanoi Medical University hospital. It is a React 19 + Vite SPA with no TypeScript.

### Tech stack
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin) + per-component `.css` files
- **Dialogs**: SweetAlert2 (`Swal.fire(...)`)
- **Toasts**: `react-hot-toast`
- **Charts**: Chart.js (used in `Admin.jsx`)
- **Backend**: Spring Boot at `http://localhost:8080/api` — must be running separately

### Route structure (`App.jsx`)
| Path | Component |
|---|---|
| `/` | `AuthForm` — login/register |
| `/forgot-password` | `ForgotPassword` |
| `/reset-password` | `ResetPassword` |
| `/dashboard` | `Dashboard` — main app shell |

### Dashboard tab system
`Dashboard.jsx` holds top-level state (`equipmentData`, `activeTab`, `userInfo`, `isAdmin`) and renders a single active tab component at a time. `DashboardTabs.jsx` controls which tabs are visible by fetching permission codes from the backend every 60 seconds via `GET /api/auth/my-permissions` with an `X-User-Id` header.

**Permission code → tab mapping:**
| Permission code | Tab | Component |
|---|---|---|
| `SUPP_FORECAST.CREATE` | Tạo phiếu dự trù | `ReplenishmentRequest` |
| `RECEIPT.CREATE` | Nhập kho | `ReceiptPage` |
| `ISSUE.CREATE` | Xuất kho | `IssuePage` |
| `ISSUE_REQ.CREATE` | Tạo phiếu xin lĩnh | `CreateIssueRequest` |
| `ISSUE_REQ.APPROVE` | Phê duyệt phiếu xin lĩnh | `IssueRequestApproval` |
| `SUPP_FORECAST.APPROVE` | Phê duyệt dự trù | `ForecastApproval` |
| `USERS.MANAGE` | Quản lý người dùng | `Admin` |
| `PERMISSIONS.MANAGE` | Phân quyền vai trò | `RBACSection` |

### Auth & session
- After login, the backend response's `data.user` object is stored in `localStorage.currentUser` (JSON).
- "Remember me" stores credentials in browser cookies (`rememberedEmail`, `rememberedPassword`, `rememberMe`) for 30 days and attempts auto-login on page load.
- The `isBanGiamHieu` boolean on the user object grants admin access regardless of RBAC permissions.
- User roles (stored as backend enums): `lanhdao`, `thukho`, `canbo` — displayed in Vietnamese as Lãnh đạo, Thủ kho, Cán bộ.

### API base URL
All components hardcode `const API_URL = "http://localhost:8080/api"` locally. There is no central API client or env variable abstraction. Key endpoints:
- `POST /api/auth/login`, `POST /api/auth/register`
- `GET /api/auth/departments`
- `GET /api/auth/my-permissions` (requires `X-User-Id` header)
- `GET/POST /api/admin/users/...`, `GET /api/admin/rbac/permissions`

### Shared CSS
`dashboard-ui.css` is a shared stylesheet imported by multiple feature components alongside their own component-specific `.css` files. Each component in `src/components/` has a matching `.css` file.

### Equipment data
The equipment list in `Dashboard.jsx` is currently seeded with hardcoded `initialData` and managed in local React state — it is not persisted to the backend.
