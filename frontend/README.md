# Medventory HMU — Web (React / Vite SPA)

Giao diện web đầy đủ chức năng của hệ thống Medventory-HMU. Đây là **bản đầy đủ**: ngoài nghiệp vụ kho/vật tư, web còn có **quản trị người dùng** và **phân quyền (RBAC)** — những phần được để riêng cho web (bản mobile đã lược bỏ). Web gọi backend Spring Boot tại `http://localhost:8080/api`.

## Mục lục

- [Công nghệ](#công-nghệ)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Cách chạy](#cách-chạy)
- [Route và điều hướng](#route-và-điều-hướng)
- [Tab dashboard theo quyền](#tab-dashboard-theo-quyền)
- [Lọc & phân trang phía server](#lọc--phân-trang-phía-server)
- [Xác thực và phiên](#xác-thực-và-phiên)
- [Lưu ý kỹ thuật](#lưu-ý-kỹ-thuật)

## Công nghệ

- React 19 + Vite 7 (không dùng TypeScript)
- React Router DOM v7
- Tailwind CSS v4 (qua `@tailwindcss/vite`) + CSS theo từng component
- SweetAlert2 (dialog), React Hot Toast (toast)
- Chart.js
- ESLint

## Cấu trúc thư mục

```txt
frontend/
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── public/                       # static cho Vite
└── src/
    ├── App.jsx / App.css         # Router + nền chung
    ├── main.jsx / index.css      # entry + reset (box-sizing, font Be Vietnam Pro)
    ├── assets/
    └── components/
        ├── dashboard-ui.css      # Hệ component dùng chung: card, table, modal,
        │                         #   button, input, stat-card, filter-pill, badge…
        ├── Dashboard.jsx/.css     # Layout 1 cột 1280px (header/nav/content cùng cột)
        ├── DashboardHeader.jsx/.css  # Header + chuông thông báo đơn sắc + dropdown
        ├── DashboardTabs.jsx/.css     # Thanh tab gate theo quyền
        ├── AuthForm.jsx/.css          # Đăng nhập / đăng ký
        ├── ForgotPassword.jsx/.css, ResetPassword.jsx
        ├── EquipmentList.jsx/.css     # Danh sách vật tư (+ form thêm cho Thủ kho)
        ├── CreateIssueRequest.jsx/.css   # Tạo phiếu xin lĩnh + lịch sử
        ├── IssueRequestApproval.jsx      # Phê duyệt phiếu xin lĩnh
        ├── ReplenishmentRequest.jsx      # Tạo phiếu dự trù + lịch sử
        ├── ForecastApproval.jsx          # Duyệt dự trù (BGH)
        ├── ReceiptPage.jsx/.css          # Nhập kho (đầy đủ) + lịch sử
        ├── IssuePage.jsx/.css            # Xuất kho (FEFO) + lịch sử
        ├── Admin.jsx/.css                # Quản trị người dùng (duyệt/role/xóa)
        ├── RBACSection.jsx/.css          # Phân quyền theo role/user + auto-approve
        ├── MaterialSearchInput.jsx/.css  # Ô tìm vật tư (server-side qua /materials/search)
        ├── Pagination.jsx                # Component phân trang dùng chung (‹ 1 2 3 ›)
        └── ExportEquipment.jsx
```

## Yêu cầu môi trường

- Node.js 20.19+ hoặc 22.12+, npm 10+.
- Backend Medventory chạy tại `http://localhost:8080` (xem README gốc).

## Cách chạy

```bash
cd frontend
npm install
npm run dev        # dev server tại http://localhost:5173
npm run build      # build production → dist/
npm run preview    # xem thử bản build
npm run lint       # ESLint
```

Web gọi backend qua base URL **hardcode** `http://localhost:8080/api` trong các component.

## Route và điều hướng

| Path | Component | Mô tả |
| --- | --- | --- |
| `/` | `AuthForm` | Đăng nhập / đăng ký |
| `/forgot-password` | `ForgotPassword` | Quên mật khẩu |
| `/reset-password` | `ResetPassword` | Đặt lại mật khẩu |
| `/dashboard` | `Dashboard` | Giao diện chính sau đăng nhập |

## Tab dashboard theo quyền

`DashboardTabs.jsx` hiển thị tab theo `permissionCodes` từ `GET /api/auth/my-permissions` (poll mỗi 60s):

| Tab | Quyền | Vai trò |
| --- | --- | --- |
| Danh sách vật tư | `MATERIAL.VIEW` | BGH, Lãnh đạo, Thủ kho, Cán bộ |
| Tạo phiếu xin lĩnh | `ISSUE_REQ.CREATE` | Cán bộ |
| Phê duyệt phiếu xin lĩnh | `ISSUE_REQ.APPROVE` | Lãnh đạo |
| Tạo phiếu dự trù | `SUPP_FORECAST.CREATE` | Thủ kho |
| Duyệt dự trù | `SUPP_FORECAST.APPROVE` | BGH |
| Nhập kho | `RECEIPT.CREATE` | Thủ kho |
| Xuất kho | `ISSUE.CREATE` | Thủ kho |
| Người dùng (Admin) | `USERS.MANAGE` | ADMIN |
| Phân quyền (RBAC) | `PERMISSIONS.MANAGE` | ADMIN |

Form "Thêm vật tư mới" trong màn Vật tư chỉ hiện cho người có `MATERIAL.MANAGE` (Thủ kho).

## Lọc & phân trang phía server

Toàn bộ danh sách lọc/tìm/phân trang **ở backend** (trình duyệt không tải-hết-rồi-lọc):

- Tồn kho: `GET /api/inventory/materials?keyword=&status=&page=&size=` (kèm summary tổng/sắp hết/hết hàng).
- Ô tìm vật tư: `GET /api/materials/search?keyword=&limit=` (autocomplete).
- Quản trị người dùng: `GET /api/admin/users?status=&keyword=&page=&size=`.
- Lịch sử nhập/xuất: `GET /api/receipts/feed`, `GET /api/issues/feed` với `keyword=&page=&limit=`.
- Lịch sử xin lĩnh/dự trù: `GET /api/issue-requests/canbo/my-requests`, `GET /api/supp-forecast/my` với `keyword=&page=&size=`.
- Danh sách đủ điều kiện xuất: `GET /api/issues/eligible-requests-with-reasons?eligiblePage=&pageSize=` (phân trang ở backend).

`Pagination.jsx` là component phân trang dùng chung (ký hiệu `‹ › + số trang`).

## Xác thực và phiên

- Sau đăng nhập, `data.user` lưu vào `localStorage.currentUser`.
- "Remember me" lưu `rememberedEmail`, `rememberedPassword`, `rememberMe` vào cookie 30 ngày.
- Các API cần định danh gửi header `X-User-Id`.

## Lưu ý kỹ thuật

- API URL đang hardcode `http://localhost:8080/api` ở nhiều component (chưa có API client/env tập trung).
- CORS backend chỉ cho phép origin `http://localhost:5173`.
- Nền `#eef1f6`, font Be Vietnam Pro; reset `box-sizing: border-box` toàn cục trong `index.css`.
- Chưa có test suite riêng cho frontend.
