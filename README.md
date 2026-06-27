# Medventory-HMU

Medventory-HMU là hệ thống quản lý vật tư y tế cho đơn vị bệnh viện/trường Đại học Y Hà Nội. Project gồm backend Spring Boot REST API, frontend React/Vite SPA và bộ script PostgreSQL để khởi tạo dữ liệu mẫu.

## Mục lục

- [Tổng quan chức năng](#tổng-quan-chức-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Cấu hình database](#cấu-hình-database)
- [Cách chạy project](#cách-chạy-project)
- [Backend](#backend)
- [Frontend](#frontend)
- [API chính](#api-chính)
- [Tài khoản mẫu](#tài-khoản-mẫu)
- [Luồng nghiệp vụ](#luồng-nghiệp-vụ)
- [RBAC và phân quyền](#rbac-và-phân-quyền)
- [Kiểm thử và build](#kiểm-thử-và-build)
- [Lưu ý kỹ thuật](#lưu-ý-kỹ-thuật)

## Tổng quan chức năng

Hệ thống hỗ trợ quản lý nghiệp vụ vật tư y tế:

- Đăng ký, đăng nhập và quản lý tài khoản người dùng.
- Duyệt tài khoản mới theo trạng thái người dùng.
- Quản lý vai trò và quyền truy cập theo RBAC.
- Tạo và phê duyệt phiếu xin lĩnh vật tư.
- Tạo phiếu xuất kho từ phiếu xin lĩnh đã đủ điều kiện.
- Tạo phiếu nhập kho và theo dõi lô vật tư.
- Tạo, xem lại và phê duyệt phiếu dự trù bổ sung.
- Theo dõi danh mục vật tư, đơn vị tính, khoa/phòng.
- Theo dõi tồn kho theo thẻ kho và lô hàng.
- Gửi và đọc thông báo nghiệp vụ.

## Công nghệ sử dụng

### Backend

- Java 17
- Spring Boot 3.2.0
- Spring Web
- Spring Data JPA / Hibernate
- Spring Validation
- PostgreSQL JDBC Driver
- Lombok
- Spring Boot DevTools
- JUnit/Spring Boot Test
- H2 Database cho test

### Frontend

- React 19
- Vite 7
- React Router DOM v7
- Tailwind CSS v4 qua `@tailwindcss/vite`
- CSS theo từng component
- SweetAlert2
- React Hot Toast
- Chart.js
- ESLint

### Database

- PostgreSQL
- Script chính: `database/final_database.sql`

## Cấu trúc thư mục

```txt
Medventory-HMU/
├── backend/                         # Spring Boot REST API
│   ├── .mvn/                        # Maven Wrapper metadata
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/backend/
│   │   │   │   ├── config/          # Cấu hình backend
│   │   │   │   ├── controller/      # REST controllers
│   │   │   │   ├── dto/             # Request/response DTO
│   │   │   │   ├── entity/          # Entity ánh xạ bảng database
│   │   │   │   ├── repository/      # Giao tiếp database qua JPA
│   │   │   │   ├── service/         # Xử lý nghiệp vụ
│   │   │   │   └── BackendApplication.java
│   │   │   └── resources/
│   │   │       └── application.properties
│   │   └── test/
│   │       ├── java/com/backend/
│   │       │   ├── controller/      # AdminControllerTests
│   │       │   └── BackendApplicationTests.java
│   │       └── resources/
│   │           └── application.properties
│   ├── target/                      # Output build/test Maven, sinh tự động
│   ├── mvnw
│   ├── mvnw.cmd
│   ├── .gitattributes
│   ├── .gitignore
│   └── pom.xml
├── frontend/                        # React/Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard-ui.css     # Style chung cho dashboard/table/modal/button/input
│   │   │   ├── Dashboard*.jsx/css   # Layout dashboard, header, tabs
│   │   │   ├── AuthForm.jsx/css     # Đăng nhập/đăng ký
│   │   │   ├── ForgotPassword.jsx/css
│   │   │   ├── ResetPassword.jsx
│   │   │   ├── EquipmentList.jsx/css
│   │   │   ├── ReplenishmentRequest.jsx/css
│   │   │   ├── ForecastApproval.jsx/css
│   │   │   ├── CreateIssueRequest.jsx/css
│   │   │   ├── IssueRequestApproval.jsx/css
│   │   │   ├── ReceiptPage.jsx/css
│   │   │   ├── IssuePage.jsx/css
│   │   │   ├── Admin.jsx/css
│   │   │   ├── RBACSection.jsx/css
│   │   │   ├── MaterialSearchInput.jsx/css
│   │   │   ├── ExportEquipment.jsx
│   │   │   └── dashboardConstants.js
│   │   ├── assets/                  # Static assets của React
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/                      # Public static files cho Vite
│   ├── dist/                        # Output `npm run build`, sinh tự động
│   ├── node_modules/                # Dependencies npm, sinh tự động
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── taiwind.config.js
│   ├── vite.config.js
│   ├── eslint.config.js
│   ├── .gitignore
│   ├── vite-dev.err.log
│   └── vite-dev.out.log
├── database/                        # SQL khởi tạo database
│   └── final_database.sql
├── report/                          # Báo cáo và slide
│   ├── BCCK.pdf
│   ├── BCCK.pptx
│   └── SETUP.pdf
├── test_screenshots/                # Script và ảnh chụp UI phục vụ kiểm thử giao diện
│   ├── capture_remaining_ui.py
│   └── *.png
├── AC2070_Medventory_HMU_Filled.xlsx
├── AC2070_Report_Tables_Checklist_Template.xlsx
├── .gitignore
└── README.md
```

## Yêu cầu môi trường

Cài các công cụ sau trước khi chạy project:

- Java JDK 17 trở lên.
- Maven 3.9 trở lên, hoặc dùng Maven Wrapper trong `backend`.
- Node.js `20.19.0` trở lên hoặc `22.12.0` trở lên.
- npm 10 trở lên.
- PostgreSQL 14 trở lên.
- VS Code nếu chạy bằng editor.

Extension VS Code khuyến nghị:

- Extension Pack for Java
- Spring Boot Extension Pack
- ESLint
- Database Client hoặc PostgreSQL extension

## Cấu hình database

Backend đang dùng cấu hình trong `backend/src/main/resources/application.properties`:

```properties
server.port=8080

spring.datasource.url=jdbc:postgresql://localhost:5432/medventory_hmu
spring.datasource.username=postgres
spring.datasource.password=admin123

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.properties.hibernate.format_sql=true
logging.level.org.hibernate=DEBUG

spring.web.cors.allowed-origins=http://localhost:5173

medventory.issue-req.auto-approve-enabled=false
```

Tạo database:

```sql
CREATE DATABASE medventory_hmu;
```

Import dữ liệu mẫu:

```bash
psql -U postgres -d medventory_hmu -f database/final_database.sql
```

Nếu dùng pgAdmin, tạo database `medventory_hmu`, mở Query Tool rồi chạy toàn bộ nội dung file `database/final_database.sql`.

Lưu ý: `final_database.sql` có lệnh `DROP SCHEMA IF EXISTS public CASCADE`, vì vậy chạy lại file này sẽ xóa schema hiện tại và seed lại dữ liệu từ đầu.

## Cách chạy project

Project cần chạy backend và frontend ở hai terminal riêng.

### 1. Chạy backend

```bash
cd backend
mvn spring-boot:run
```

Trên Windows có thể dùng Maven Wrapper:

```bash
cd backend
.\mvnw.cmd spring-boot:run
```

Backend chạy tại:

```txt
http://localhost:8080
```

### 2. Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại:

```txt
http://localhost:5173
```

Frontend gọi backend qua base URL hardcode:

```txt
http://localhost:8080/api
```

## Backend

Backend là REST API theo kiến trúc phân lớp:

```txt
Client -> Controller -> Service -> Repository -> Database
```

Vai trò từng lớp:

- `entity`: ánh xạ bảng trong database, mỗi entity tương ứng với một bảng.
- `repository`: interface Spring Data JPA để CRUD và query dữ liệu.
- `service`: xử lý nghiệp vụ trước khi trả dữ liệu cho controller.
- `dto`: object dùng để truyền dữ liệu giữa client và server.
- `controller`: nhận HTTP request, gọi service và trả HTTP response.

Package root:

```txt
com.backend
```

Các lệnh backend:

```bash
mvn compile
mvn spring-boot:run
mvn clean package
mvn test
mvn test -Dtest=ClassName
mvn clean package -DskipTests
```

## Frontend

Frontend là SPA React 19 + Vite, không dùng TypeScript.

Các lệnh frontend:

```bash
npm run dev       # Chạy dev server
npm run build     # Build production
npm run preview   # Preview bản build
npm run lint      # Kiểm tra ESLint
```

Route chính:

| Path | Component | Mô tả |
| --- | --- | --- |
| `/` | `AuthForm` | Đăng nhập/đăng ký |
| `/forgot-password` | `ForgotPassword` | Quên mật khẩu |
| `/reset-password` | `ResetPassword` | Đặt lại mật khẩu |
| `/dashboard` | `Dashboard` | Giao diện chính sau đăng nhập |

Frontend lưu session như sau:

- Sau khi đăng nhập, object `data.user` từ backend được lưu vào `localStorage.currentUser`.
- Chức năng "Remember me" lưu `rememberedEmail`, `rememberedPassword`, `rememberMe` vào cookie trong 30 ngày.
- `DashboardTabs.jsx` gọi `GET /api/auth/my-permissions` mỗi 60 giây để cập nhật tab được hiển thị.
- Header `X-User-Id` được gửi cho các API cần xác định người dùng.

## API chính

Tất cả API backend nằm dưới prefix `/api`.

| Controller | Base path | Chức năng |
| --- | --- | --- |
| `AuthController` | `/api/auth` | Đăng ký, đăng nhập, quên mật khẩu, reset mật khẩu, thông tin user, quyền user |
| `AdminController` | `/api/admin` | Duyệt user, quản lý user, vai trò và phân quyền |
| `MaterialController` | `/api/materials` | Danh mục vật tư, tìm kiếm vật tư, feed vật tư |
| `IssueReqController` | `/api/issue-requests` | Tạo, xem, duyệt, từ chối phiếu xin lĩnh |
| `IssueController` | `/api/issues` | Xem trước, kiểm tra điều kiện và tạo phiếu xuất kho |
| `ReceiptController` | `/api/receipts` | Tạo và xem phiếu nhập kho |
| `SuppForecastController` | `/api/supp-forecast` | Phiếu dự trù bổ sung và phê duyệt dự trù |
| `NotificationController` | `/api/notifications` | Thông báo và đánh dấu đã đọc |
| `DepartmentController` | `/api/departments` | Danh sách và tìm kiếm khoa/phòng |
| `UnitController` | `/api/units` | Danh sách đơn vị tính |
| `InventorySummaryController` | `/api/inventory` | Theo dõi tồn kho |

Một số endpoint tiêu biểu:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/my-permissions`
- `GET /api/admin/users/pending`
- `GET /api/admin/users/all`
- `POST /api/admin/users/{userId}/approve`
- `POST /api/admin/users/{userId}/reject`
- `DELETE /api/admin/users/{userId}`
- `PUT /api/admin/users/{userId}/role`
- `GET /api/admin/settings/issue-req-auto-approve`
- `PUT /api/admin/settings/issue-req-auto-approve`
- `GET /api/admin/rbac/roles`
- `GET /api/admin/rbac/permissions`
- `GET /api/admin/rbac/roles/{roleCode}/permissions`
- `PUT /api/admin/rbac/roles/{roleCode}/permissions`
- `POST /api/admin/rbac/roles/{roleCode}/permissions/reset`
- `GET /api/admin/rbac/users/{userId}/permissions`
- `PUT /api/admin/rbac/users/{userId}/permissions`
- `POST /api/admin/rbac/users/{userId}/permissions/grant`
- `POST /api/admin/rbac/users/{userId}/permissions/remove`
- `DELETE /api/admin/rbac/users/{userId}/permissions`
- `GET /api/materials`
- `GET /api/materials/search`
- `GET /api/materials/categories`
- `GET /api/materials/feed`
- `POST /api/materials`
- `POST /api/issue-requests/canbo/create`
- `GET /api/issue-requests/canbo/my-requests`
- `GET /api/issue-requests/canbo/previous`
- `GET /api/issue-requests/leader/pending`
- `GET /api/issue-requests/leader/processed`
- `GET /api/issue-requests/{id}/detail`
- `POST /api/issue-requests/{id}/approve`
- `POST /api/issue-requests/{id}/reject`
- `POST /api/receipts/create`
- `GET /api/receipts/feed`
- `GET /api/receipts/{id}/detail`
- `GET /api/issues/feed`
- `GET /api/issues/preview`
- `GET /api/issues/eligible-requests`
- `GET /api/issues/eligible-requests-with-reasons`
- `GET /api/issues/{id}/detail`
- `GET /api/issues/materials/{materialId}/lots`
- `POST /api/issues/create-from-issue-req`
- `POST /api/supp-forecast`
- `GET /api/supp-forecast/bgh/pending`
- `GET /api/supp-forecast/bgh/processed`
- `GET /api/supp-forecast/bgh/stats`
- `GET /api/supp-forecast/my`
- `GET /api/supp-forecast/previous`
- `GET /api/supp-forecast/{id}`
- `POST /api/supp-forecast/approve`
- `GET /api/notifications/my`
- `POST /api/notifications/{id}/read`
- `POST /api/notifications/read-all`
- `POST /api/notifications/issue-req/{issueReqId}/schedule`

## Tài khoản mẫu

File `database/final_database.sql` seed một số tài khoản mẫu. Mật khẩu mặc định trong dữ liệu seed là:

```txt
12345
```

Một số email mẫu:

| Email | Vai trò | Trạng thái |
| --- | --- | --- |
| `admin@gmail.com` | Admin | Đã duyệt |
| `hieutruong@gmail.com` | BGH | Đã duyệt |
| `phohieutruong1@gmail.com` | BGH | Đã duyệt |
| `phohieutruong2@gmail.com` | BGH | Đã duyệt |
| `phohieutruong3@gmail.com` | BGH | Đã duyệt |
| `phohieutruong4@gmail.com` | BGH | Đã duyệt |
| `lanhdao@gmail.com` | Lãnh đạo | Đã duyệt |
| `pholanhdao@gmail.com` | Lãnh đạo | Đã duyệt |
| `thukho@gmail.com` | Thủ kho | Đã duyệt |
| `thukho2@gmail.com` | Thủ kho | Đã duyệt |
| `canbo.bhpt@gmail.com` | Cán bộ | Chờ duyệt |
| `canbo.hoasinh@gmail.com` | Cán bộ | Đã duyệt |
| `canbo.visinh@gmail.com` | Cán bộ | Chờ duyệt |
| `canbo.duocly@gmail.com` | Cán bộ | Đã duyệt |

## Luồng nghiệp vụ

### Quản lý người dùng

```txt
Người dùng đăng ký -> PENDING -> ADMIN duyệt hoặc từ chối -> APPROVED/REJECTED
```

ADMIN quản lý tài khoản và phân quyền hệ thống. BGH xử lý nghiệp vụ phê duyệt dự trù theo quyền được seed trong database.

### Phiếu xin lĩnh và xuất kho

```txt
CAN_BO tạo phiếu xin lĩnh
-> LANH_DAO phê duyệt hoặc từ chối
-> THU_KHO tạo phiếu xuất kho
-> Hệ thống cập nhật tồn kho và lô vật tư
```

Hệ thống có cơ chế giữ chỗ tồn kho (`issue_reservations`) để bảo vệ lượng tồn đã dùng cho phiếu xin lĩnh được tự động duyệt. Cơ chế tự động duyệt phiếu xin lĩnh khi đủ tồn kho được điều khiển bằng setting `issue_req.auto_approve_enabled`, mặc định tắt trong `database/final_database.sql` và `application.properties`.

### Phiếu dự trù bổ sung

```txt
THU_KHO tạo phiếu dự trù
-> BGH xem danh sách chờ duyệt
-> BGH phê duyệt hoặc xử lý phiếu
```

### Nhập kho

```txt
THU_KHO tạo phiếu nhập kho
-> Nhập thông tin vật tư, số lượng, đơn giá, lô, hạn dùng
-> Hệ thống ghi nhận vào thẻ kho
```

## RBAC và phân quyền

Vai trò chính:

- `ADMIN`: Quản trị hệ thống, quản lý người dùng và phân quyền.
- `BGH`: Ban Giám Hiệu / nhóm lãnh đạo cấp cao.
- `LANH_DAO`: Lãnh đạo khoa/phòng.
- `THU_KHO`: Thủ kho.
- `CAN_BO`: Cán bộ đơn vị.

Mã quyền chính:

| Permission code | Ý nghĩa | Tab frontend |
| --- | --- | --- |
| `SUPP_FORECAST.CREATE` | Tạo phiếu dự trù bổ sung | `ReplenishmentRequest` |
| `SUPP_FORECAST.APPROVE` | Phê duyệt phiếu dự trù | `ForecastApproval` |
| `ISSUE_REQ.CREATE` | Tạo phiếu xin lĩnh | `CreateIssueRequest` |
| `ISSUE_REQ.APPROVE` | Phê duyệt phiếu xin lĩnh | `IssueRequestApproval` |
| `RECEIPT.CREATE` | Tạo phiếu nhập kho | `ReceiptPage` |
| `ISSUE.CREATE` | Tạo phiếu xuất kho | `IssuePage` |
| `MATERIAL.MANAGE` | Quản lý/theo dõi vật tư | Các màn hình vật tư |
| `USERS.MANAGE` | Quản lý người dùng | `Admin` |
| `PERMISSIONS.MANAGE` | Phân quyền vai trò | `RBACSection` |
| `NOTIF.MANAGE` | Quản lý thông báo | Header/thông báo nghiệp vụ |

Quyền mặc định theo vai trò được định nghĩa trong `RbacService.DEFAULT_ROLE_PERMS` và seed vào bảng `role_permissions` trong `database/final_database.sql`. Ngoài quyền theo vai trò, hệ thống có bảng `user_permissions` để grant/revoke quyền riêng cho từng người dùng.

Phân quyền seed mặc định:

| Role | Quyền mặc định |
| --- | --- |
| `ADMIN` | `USERS.MANAGE`, `PERMISSIONS.MANAGE` |
| `BGH` | `MATERIAL.VIEW`, `SUPP_FORECAST.APPROVE`, `NOTIF.MANAGE` |
| `LANH_DAO` | `MATERIAL.VIEW`, `ISSUE_REQ.APPROVE`, `NOTIF.MANAGE` |
| `THU_KHO` | `MATERIAL.VIEW`, `SUPP_FORECAST.CREATE`, `RECEIPT.CREATE`, `ISSUE.CREATE`, `MATERIAL.MANAGE`, `NOTIF.MANAGE` |
| `CAN_BO` | `MATERIAL.VIEW`, `ISSUE_REQ.CREATE` |

## Kiểm thử và build

Backend có cấu hình test dùng H2 trong `backend/src/test/resources/application.properties`.

Chạy test backend:

```bash
cd backend
mvn test
```

Build backend:

```bash
cd backend
mvn clean package
```

Build frontend:

```bash
cd frontend
npm run build
```

Kiểm tra ESLint frontend:

```bash
cd frontend
npm run lint
```

Frontend hiện chưa có test suite riêng.

## Lưu ý kỹ thuật

- Backend đang chạy ở port `8080`.
- Frontend Vite đang chạy ở port `5173`.
- CORS backend chỉ cho phép origin `http://localhost:5173`.
- Frontend đang hardcode API URL là `http://localhost:8080/api` trong nhiều component, chưa có API client/env abstraction tập trung.
- Authentication hiện đơn giản: nhiều endpoint dùng header `X-User-Id` thay vì Bearer token.
- Login trả token dạng `user-token-{userId}` và token được lưu in-memory, restart server sẽ mất token.
- Mật khẩu trong dữ liệu hiện đang lưu plaintext. Không tự ý thêm BCrypt nếu chưa có migration plan cho dữ liệu cũ.
- `spring.jpa.hibernate.ddl-auto=update`, nên Hibernate có thể tự cập nhật schema khi app chạy.
- `database/final_database.sql` là script reset/seed chính, có tạo role, permission, user mẫu, system settings, notification, phiếu mẫu, thẻ kho và reservation.
- `issue_req.auto_approve_enabled` mặc định `false`; có thể bật/tắt qua màn hình phân quyền/admin hoặc API admin settings.
- Tồn kho hiển thị ở frontend lấy từ `/api/inventory/materials`, đã trừ lượng reservation đang active.

