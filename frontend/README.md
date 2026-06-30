# Medventory HMU — Web (React / Vite)

Giao diện web đầy đủ chức năng của hệ thống quản lý vật tư y tế Medventory-HMU (Đại học Y Hà Nội). Đây là bản đầy đủ: ngoài nghiệp vụ kho/vật tư còn có quản trị người dùng và phân quyền (RBAC). Bản web dùng chung backend Spring Boot với bản mobile.

README này tự chứa đầy đủ các bước để chạy độc lập: cài database, chạy backend, rồi chạy web.

## Mục lục

- [Kiến trúc](#kiến-trúc)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Bước 1 — Cài đặt database](#bước-1--cài-đặt-database)
- [Bước 2 — Chạy backend](#bước-2--chạy-backend)
- [Bước 3 — Chạy web](#bước-3--chạy-web)
- [Tài khoản mẫu](#tài-khoản-mẫu)
- [Cấu trúc thư mục web](#cấu-trúc-thư-mục-web)
- [Route và điều hướng](#route-và-điều-hướng)
- [Tab dashboard theo quyền](#tab-dashboard-theo-quyền)
- [Lọc và phân trang phía server](#lọc-và-phân-trang-phía-server)
- [Xác thực và phiên](#xác-thực-và-phiên)

## Kiến trúc

```txt
Web (React/Vite, cổng 5173)  ->  Backend (Spring Boot, cổng 8080)  ->  PostgreSQL
```

Web gọi backend qua base URL `http://localhost:8080/api`.

## Yêu cầu môi trường

- Java JDK 17 trở lên (chạy backend).
- Maven 3.9 trở lên, hoặc dùng Maven Wrapper kèm theo trong `backend/`.
- Node.js 20.19 trở lên hoặc 22.12 trở lên, npm 10 trở lên (chạy web).
- PostgreSQL 14 trở lên.

## Bước 1 — Cài đặt database

Tạo database:

```sql
CREATE DATABASE medventory_hmu;
```

Import dữ liệu mẫu (tạo bảng, seed vai trò, quyền, người dùng, phiếu mẫu, tồn kho):

```bash
psql -U postgres -d medventory_hmu -f database/final_database.sql
```

Nếu dùng pgAdmin: tạo database `medventory_hmu`, mở Query Tool và chạy toàn bộ nội dung `database/final_database.sql`.

Lưu ý: script có lệnh `DROP SCHEMA IF EXISTS public CASCADE`, nên chạy lại sẽ xóa schema hiện tại và seed lại từ đầu.

## Bước 2 — Chạy backend

Cấu hình nằm trong `backend/src/main/resources/application.properties`. Sửa user/password PostgreSQL cho khớp máy của bạn:

```properties
server.port=8080
spring.datasource.url=jdbc:postgresql://localhost:5432/medventory_hmu
spring.datasource.username=postgres
spring.datasource.password=admin123
spring.web.cors.allowed-origins=http://localhost:5173
```

Chạy backend:

```bash
cd backend
mvn spring-boot:run
```

Trên Windows có thể dùng Maven Wrapper:

```bash
cd backend
.\mvnw.cmd spring-boot:run
```

Backend chạy tại `http://localhost:8080`. CORS hiện chỉ cho phép origin `http://localhost:5173` (đúng với web dev server bên dưới).

## Bước 3 — Chạy web

```bash
cd frontend
npm install
npm run dev
```

Web chạy tại `http://localhost:5173` và gọi backend tại `http://localhost:8080/api`.

Các lệnh khác:

```bash
npm run build     # build production vào dist/
npm run preview   # xem thử bản build
npm run lint      # ESLint
```

## Tài khoản mẫu

Mật khẩu mặc định của dữ liệu seed: `12345`.

| Email | Vai trò | Trạng thái |
| --- | --- | --- |
| `admin@gmail.com` | ADMIN | Đã duyệt |
| `hieutruong@gmail.com` | BGH | Đã duyệt |
| `lanhdao@gmail.com` | Lãnh đạo | Đã duyệt |
| `thukho@gmail.com` | Thủ kho | Đã duyệt |
| `canbo.hoasinh@gmail.com` | Cán bộ | Đã duyệt |

## Cấu trúc thư mục web

```txt
frontend/
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── public/                       # static cho Vite
└── src/
    ├── App.jsx / App.css         # Router + nền chung
    ├── main.jsx / index.css      # entry + reset toàn cục, font Be Vietnam Pro
    ├── assets/
    └── components/
        ├── dashboard-ui.css      # Hệ component dùng chung: card, table, modal,
        │                         #   button, input, stat-card, filter-pill, badge
        ├── Dashboard.jsx/.css         # Layout 1 cột 1280px (header/nav/content cùng cột)
        ├── DashboardHeader.jsx/.css   # Header + chuông thông báo + dropdown
        ├── DashboardTabs.jsx/.css     # Thanh tab hiển thị theo quyền
        ├── AuthForm.jsx/.css          # Đăng nhập / đăng ký
        ├── ForgotPassword.jsx/.css, ResetPassword.jsx
        ├── EquipmentList.jsx/.css     # Danh sách vật tư (kèm form thêm cho Thủ kho)
        ├── CreateIssueRequest.jsx/.css    # Tạo phiếu xin lĩnh + lịch sử
        ├── IssueRequestApproval.jsx       # Phê duyệt phiếu xin lĩnh
        ├── ReplenishmentRequest.jsx       # Tạo phiếu dự trù + lịch sử
        ├── ForecastApproval.jsx           # Duyệt dự trù (BGH)
        ├── ReceiptPage.jsx/.css           # Nhập kho + lịch sử
        ├── IssuePage.jsx/.css             # Xuất kho + lịch sử
        ├── Admin.jsx/.css                 # Quản trị người dùng
        ├── RBACSection.jsx/.css           # Phân quyền theo role/user + auto-approve
        ├── MaterialSearchInput.jsx/.css   # Ô tìm vật tư (server-side)
        ├── Pagination.jsx                 # Component phân trang dùng chung
        └── ExportEquipment.jsx
```

## Route và điều hướng

| Path | Component | Mô tả |
| --- | --- | --- |
| `/` | `AuthForm` | Đăng nhập / đăng ký |
| `/forgot-password` | `ForgotPassword` | Quên mật khẩu |
| `/reset-password` | `ResetPassword` | Đặt lại mật khẩu |
| `/dashboard` | `Dashboard` | Giao diện chính sau đăng nhập |

## Tab dashboard theo quyền

`DashboardTabs.jsx` hiển thị tab theo `permissionCodes` lấy từ `GET /api/auth/my-permissions` (poll mỗi 60 giây):

| Tab | Quyền | Vai trò mặc định |
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

## Lọc và phân trang phía server

Mọi danh sách lọc/tìm/phân trang ở backend (trình duyệt không tải hết rồi lọc):

- Tồn kho: `GET /api/inventory/materials?keyword=&status=&page=&size=` (kèm tổng/sắp hết/hết hàng).
- Ô tìm vật tư: `GET /api/materials/search?keyword=&limit=`.
- Quản trị người dùng: `GET /api/admin/users?status=&keyword=&page=&size=`.
- Lịch sử nhập/xuất: `GET /api/receipts/feed`, `GET /api/issues/feed` với `keyword=&page=&limit=`.
- Lịch sử xin lĩnh/dự trù: `GET /api/issue-requests/canbo/my-requests`, `GET /api/supp-forecast/my` với `keyword=&page=&size=`.
- Danh sách đủ điều kiện xuất: `GET /api/issues/eligible-requests-with-reasons?eligiblePage=&pageSize=`.

`Pagination.jsx` là component phân trang dùng chung.

## Xác thực và phiên

- Sau đăng nhập, `data.user` lưu vào `localStorage.currentUser`.
- "Remember me" lưu `rememberedEmail`, `rememberedPassword`, `rememberMe` vào cookie 30 ngày.
- Các API cần định danh gửi header `X-User-Id`.
