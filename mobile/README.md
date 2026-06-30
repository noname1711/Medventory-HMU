# Medventory HMU — Mobile (Expo / React Native)

Ứng dụng di động của hệ thống quản lý vật tư y tế Medventory-HMU (Đại học Y Hà Nội). Dùng chung backend Spring Boot với bản web, nhưng thu gọn phạm vi cho thao tác tại hiện trường: tra cứu, tạo yêu cầu, phê duyệt, nhập/xuất nhanh. Các chức năng cấu hình và nhập liệu nặng (quản trị người dùng, phân quyền, tạo dự trù, quản lý danh mục vật tư) để cho bản web.

README này tự chứa đầy đủ các bước để chạy độc lập: cài database, chạy backend, rồi chạy mobile.

## Mục lục

- [Kiến trúc](#kiến-trúc)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Bước 1 — Cài đặt database](#bước-1--cài-đặt-database)
- [Bước 2 — Chạy backend](#bước-2--chạy-backend)
- [Bước 3 — Chạy mobile](#bước-3--chạy-mobile)
- [Tài khoản mẫu](#tài-khoản-mẫu)
- [Phạm vi mobile so với web](#phạm-vi-mobile-so-với-web)
- [Màn hình theo vai trò và quyền](#màn-hình-theo-vai-trò-và-quyền)
- [Cấu trúc thư mục mobile](#cấu-trúc-thư-mục-mobile)
- [Khối dùng chung](#khối-dùng-chung)
- [Xác thực và phiên](#xác-thực-và-phiên)
- [Lưu ý kỹ thuật](#lưu-ý-kỹ-thuật)

## Kiến trúc

```txt
Mobile (Expo/React Native)  ->  Backend (Spring Boot, cổng 8080)  ->  PostgreSQL
```

Thiết bị và máy chạy backend phải cùng mạng LAN. App tự dò địa chỉ backend (xem Bước 3).

## Yêu cầu môi trường

- Java JDK 17 trở lên (chạy backend).
- Maven 3.9 trở lên, hoặc dùng Maven Wrapper kèm theo trong `backend/`.
- Node.js 20.19 trở lên hoặc 22.12 trở lên, npm 10 trở lên (chạy mobile).
- PostgreSQL 14 trở lên.
- Một trong các môi trường chạy app: Android emulator (Android Studio), iOS Simulator (macOS), hoặc ứng dụng Expo Go trên điện thoại thật.

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

Backend chạy tại `http://localhost:8080`. Lưu ý cổng `8080` phải mở trên máy chạy backend để thiết bị di động trong cùng mạng truy cập được.

## Bước 3 — Chạy mobile

```bash
cd mobile
npm install
npx expo start        # mở Metro bundler; quét QR bằng Expo Go
```

Hoặc mở thẳng trình giả lập:

```bash
npm run android       # Android emulator
npm run ios           # iOS Simulator (macOS)
```

App tự dò địa chỉ backend trong `src/api/apiConfig.js`, thường không cần sửa:

- Điện thoại thật chạy qua Expo Go: app lấy IP LAN của máy chạy Expo và gọi `http://<IP-LAN>:8080/api`. Máy chạy backend phải cùng Wi-Fi.
- Android emulator: app dùng `10.0.2.2` (alias tới `localhost` của máy host).
- Có thể đặt `FALLBACK_HOST` trong `apiConfig.js` nếu môi trường không tự dò được IP.

Nếu Android emulator (ví dụ AVD Pixel_9) treo ở màn hình boot do GPU mặc định, khởi chạy với cờ ANGLE:

```bash
emulator -avd Pixel_9 -gpu angle_indirect
```

## Tài khoản mẫu

Mật khẩu mặc định của dữ liệu seed: `12345`.

| Email | Vai trò | Trạng thái |
| --- | --- | --- |
| `canbo.hoasinh@gmail.com` | Cán bộ | Đã duyệt |
| `lanhdao@gmail.com` | Lãnh đạo | Đã duyệt |
| `thukho@gmail.com` | Thủ kho | Đã duyệt |
| `hieutruong@gmail.com` | BGH | Đã duyệt |
| `admin@gmail.com` | ADMIN | Đã duyệt (không có tab nghiệp vụ trên mobile) |

## Phạm vi mobile so với web

| Nhóm chức năng | Mobile | Web |
| --- | --- | --- |
| Tra cứu tồn kho (Vật tư) | Có (chỉ xem) | Có (xem và thêm vật tư) |
| Tạo phiếu xin lĩnh (Cán bộ) | Có | Có |
| Phê duyệt phiếu xin lĩnh (Lãnh đạo) | Có | Có |
| Duyệt dự trù (BGH) | Có | Có |
| Xuất kho (Thủ kho) | Có (auto-FEFO) | Có (FEFO và chỉnh lô thủ công) |
| Nhập kho (Thủ kho) | Có (rút gọn: vật tư, số lượng, đơn giá, số lô) | Có (đầy đủ: lô, NSX, HSD) |
| Phiếu dự trù (Thủ kho) | Chỉ xem lịch sử | Có (tạo và xem) |
| Quản lý người dùng / Phân quyền (Admin) | Không (chỉ web) | Có |
| Thêm vật tư mới (master data) | Không (chỉ web) | Có |

Tài khoản chỉ có quyền quản trị (ADMIN) khi đăng nhập mobile sẽ thấy màn hình thông báo dùng bản web, không có tab nghiệp vụ.

## Màn hình theo vai trò và quyền

Tab dưới hiển thị theo `permissionCodes` lấy từ `GET /api/auth/my-permissions` (poll mỗi 60 giây). Mỗi tab gắn đúng một quyền theo bảng `role_permissions` trong `database/final_database.sql`:

| Tab | Quyền yêu cầu | Vai trò có | Ghi chú |
| --- | --- | --- | --- |
| Vật tư | `MATERIAL.VIEW` | BGH, Lãnh đạo, Thủ kho, Cán bộ | Chỉ xem; tìm kiếm, lọc, phân trang ở backend |
| Tạo phiếu xin | `ISSUE_REQ.CREATE` | Cán bộ | Tạo và xem lịch sử, kèm số đếm Lịch sử (N) |
| Phê duyệt lĩnh | `ISSUE_REQ.APPROVE` | Lãnh đạo | Duyệt/Từ chối trong modal chi tiết |
| Phiếu dự trù | `SUPP_FORECAST.CREATE` | Thủ kho | Chỉ xem lịch sử |
| Nhập kho | `RECEIPT.CREATE` | Thủ kho | Tạo rút gọn và xem lịch sử |
| Xuất kho | `ISSUE.CREATE` | Thủ kho | auto-FEFO: chọn phiếu đủ điều kiện rồi xác nhận |
| Duyệt dự trù | `SUPP_FORECAST.APPROVE` | BGH | Duyệt/Từ chối, kèm thẻ thống kê |

ADMIN (`USERS.MANAGE`, `PERMISSIONS.MANAGE`) không có `MATERIAL.VIEW` nên không thấy tab nào.

## Cấu trúc thư mục mobile

```txt
mobile/
├── App.js
├── app.json                     # Cấu hình Expo (name, icon, splash, bundle id)
├── package.json
├── assets/                      # icon, splash, logo
└── src/
    ├── api/
    │   ├── apiConfig.js          # API_BASE_URL (tự dò host) và API_ENDPOINTS
    │   └── apiClient.js          # apiGet/apiSend trả { ok, status, data }, gắn X-User-Id
    ├── components/
    │   ├── AppHeader.js          # Header, chuông thông báo, profile
    │   ├── MaterialPicker.js     # Modal tìm vật tư server-side (/materials/search)
    │   └── DetailModal.js        # Modal chi tiết phiếu (info, bảng dòng, footer)
    ├── context/
    │   └── AuthContext.js        # user, login/logout, hiển thị tên và vai trò
    ├── hooks/
    │   └── useServerHistory.js   # keyword (debounce) và phân trang server-side
    ├── navigation/
    │   └── AppNavigator.js       # Chuyển giữa Auth và Dashboard
    ├── screens/
    │   ├── auth/                 # LoginScreen, ForgotPasswordScreen, RegisterScreen
    │   └── dashboard/
    │       ├── DashboardScreen.js              # Bottom tabs theo quyền
    │       ├── EquipmentListScreen.js          # Vật tư (xem)
    │       ├── CreateIssueRequestScreen.js     # Tạo phiếu xin
    │       ├── IssueRequestApprovalScreen.js   # Phê duyệt lĩnh
    │       ├── ReplenishmentRequestScreen.js   # Phiếu dự trù (chỉ lịch sử)
    │       ├── ReceiptScreen.js                # Nhập kho (rút gọn)
    │       ├── IssueScreen.js                  # Xuất kho (auto-FEFO)
    │       └── ForecastApprovalScreen.js       # Duyệt dự trù
    ├── theme/
    │   ├── tokens.js             # màu, spacing, radius, fontSize
    │   ├── typography.js         # fontFamily (Inter)
    │   └── ui.js                 # Section, StatCard, Field, Input, Button, Badge,
    │                             #   SegmentControl, Pagination, Empty, MonoBadge
    └── utils/
        ├── storage.js           # AsyncStorage (currentUser, remember-me), formatTimeAgo
        └── status.js            # normaliseStatus và statusBadge (màu trạng thái)
```

## Khối dùng chung

- `api/apiClient.js` — `apiGet(url, userId)` / `apiSend(method, url, body, userId)` trả `{ ok, status, data }`, không ném lỗi; tự gắn `X-User-Id`.
- `hooks/useServerHistory.js` — quản lý `keyword` (debounce 300ms) và `page` (1-based ở UI, gửi `page-1` cho backend); đọc `data.items`/`data.requests` cùng `totalPages`/`totalCount`.
- `components/MaterialPicker.js` — tìm vật tư server-side qua `/materials/search?keyword=&limit=`.
- `components/DetailModal.js` — modal chi tiết: khối info, bảng dòng (hỗ trợ cột `stt` tự đánh số), `footer` để gắn nút Duyệt/Từ chối ngay trong modal.
- `utils/status.js` — `statusBadge(status)` ánh xạ 0/1/2 thành Chờ duyệt (vàng), Đã duyệt (xanh lá), Từ chối (đỏ).

## Xác thực và phiên

- Đăng nhập lưu `data.user` (gồm `email`, `departmentId`, `role`) vào AsyncStorage.
- "Remember me" lưu email đăng nhập.
- Mọi API cần định danh người dùng gửi header `X-User-Id`.
- `DashboardScreen` poll `GET /api/auth/my-permissions` mỗi 60 giây để cập nhật tab khả dụng.

## Lưu ý kỹ thuật

- Không có test runner trong `mobile/`; kiểm tra cú pháp bằng cách bundle Expo hoặc parse từng file bằng `babel-preset-expo`.
- Auth đơn giản: backend trả token dạng `user-token-{id}`, app dùng header `X-User-Id` cho hầu hết endpoint.
- App bám sát các endpoint thật của backend; các đường dẫn không tồn tại (ví dụ `/users`, `/roles`) đã được loại bỏ.
- Toàn bộ danh sách lọc và phân trang ở backend; app chỉ tải đúng một trang.
- Giao diện dùng hệ token trong `theme/`, không thêm hệ style mới.
