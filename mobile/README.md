# Medventory HMU — Mobile (Expo / React Native)

Ứng dụng di động của hệ thống Medventory-HMU. Dùng **chung backend Spring Boot** với bản web (`http://<host>:8080/api`), nhưng **thu gọn phạm vi** cho thao tác tại hiện trường: *tra cứu — tạo yêu cầu — phê duyệt — nhập/xuất nhanh*. Các chức năng cấu hình và nhập liệu nặng (quản trị người dùng, phân quyền, tạo dự trù, quản lý danh mục vật tư) được để cho bản web.

## Mục lục

- [Phạm vi mobile vs web](#phạm-vi-mobile-vs-web)
- [Công nghệ](#công-nghệ)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Cấu hình kết nối backend](#cấu-hình-kết-nối-backend)
- [Cách chạy](#cách-chạy)
- [Màn hình theo vai trò/quyền](#màn-hình-theo-vai-tròquyền)
- [Khác biệt so với bản web](#khác-biệt-so-với-bản-web)
- [Khối dùng chung (shared building blocks)](#khối-dùng-chung-shared-building-blocks)
- [Xác thực và phiên](#xác-thực-và-phiên)
- [Lưu ý kỹ thuật](#lưu-ý-kỹ-thuật)

## Phạm vi mobile vs web

| Nhóm chức năng | Mobile | Web |
| --- | --- | --- |
| Tra cứu tồn kho (Vật tư) | ✅ xem | ✅ xem + thêm vật tư |
| Tạo phiếu xin lĩnh (Cán bộ) | ✅ | ✅ |
| Phê duyệt phiếu xin lĩnh (Lãnh đạo) | ✅ | ✅ |
| Duyệt dự trù (BGH) | ✅ | ✅ |
| Xuất kho (Thủ kho) | ✅ auto-FEFO | ✅ FEFO + chỉnh lô thủ công |
| Nhập kho (Thủ kho) | ✅ rút gọn (VT + SL + đơn giá + lô) | ✅ đầy đủ (lô, NSX, HSD…) |
| Phiếu dự trù (Thủ kho) | 👁️ chỉ xem lịch sử | ✅ tạo + xem |
| Quản lý người dùng / Phân quyền (Admin) | ❌ chỉ web | ✅ |
| Thêm vật tư mới (master data) | ❌ chỉ web | ✅ |

Tài khoản chỉ có quyền quản trị (ADMIN) khi đăng nhập mobile sẽ thấy màn hình thông báo "dùng bản web", không có tab nghiệp vụ.

## Công nghệ

- Expo SDK 54 (`expo ~54.0.0`)
- React Native 0.81, React 19
- React Navigation 6 (native-stack + bottom-tabs)
- `@react-native-async-storage/async-storage` (lưu phiên)
- `@expo/vector-icons` (Ionicons — icon line đơn sắc)
- `@expo-google-fonts/inter`, `expo-font` (typography)
- `react-native-toast-message`
- `react-native-safe-area-context`, `react-native-screens`

## Cấu trúc thư mục

```txt
mobile/
├── App.js
├── app.json                     # Cấu hình Expo (name, icon, splash, bundle id)
├── package.json
├── assets/                      # icon, splash, logo
└── src/
    ├── api/
    │   ├── apiConfig.js          # API_BASE_URL (tự dò host) + API_ENDPOINTS
    │   └── apiClient.js          # apiGet/apiSend → { ok, status, data }, gắn X-User-Id
    ├── components/
    │   ├── AppHeader.js          # Header xanh + chuông thông báo + profile
    │   ├── MaterialPicker.js     # Modal tìm vật tư server-side (/materials/search)
    │   └── DetailModal.js        # Modal chi tiết phiếu (info + bảng dòng + footer)
    ├── context/
    │   └── AuthContext.js        # user, login/logout, hiển thị tên/vai trò
    ├── hooks/
    │   └── useServerHistory.js   # keyword (debounce) + phân trang server-side
    ├── navigation/
    │   └── AppNavigator.js       # Auth stack ↔ Dashboard
    ├── screens/
    │   ├── auth/                 # LoginScreen, ForgotPasswordScreen, RegisterScreen
    │   └── dashboard/
    │       ├── DashboardScreen.js          # Bottom tabs gate theo quyền
    │       ├── EquipmentListScreen.js      # Vật tư (xem)
    │       ├── CreateIssueRequestScreen.js # Tạo phiếu xin
    │       ├── IssueRequestApprovalScreen.js # Phê duyệt lĩnh
    │       ├── ReplenishmentRequestScreen.js # Phiếu dự trù (chỉ lịch sử)
    │       ├── ReceiptScreen.js            # Nhập kho (rút gọn)
    │       ├── IssueScreen.js              # Xuất kho (auto-FEFO)
    │       └── ForecastApprovalScreen.js   # Duyệt dự trù
    ├── theme/
    │   ├── tokens.js             # màu, spacing, radius, fontSize
    │   ├── typography.js         # fontFamily (Inter)
    │   └── ui.js                 # Section, StatCard, Field, Input, Button, Badge,
    │                             #   SegmentControl, Pagination, Empty, MonoBadge…
    └── utils/
        ├── storage.js           # AsyncStorage (currentUser, remember-me) + formatTimeAgo
        └── status.js            # normaliseStatus + statusBadge (màu trạng thái)
```

## Yêu cầu môi trường

- Node.js 20.19+ hoặc 22.12+, npm 10+.
- Expo CLI (chạy qua `npx expo`, không cần cài global).
- Một trong: Android emulator (Android Studio), iOS Simulator (macOS), hoặc app **Expo Go** trên điện thoại thật.
- **Backend đang chạy** tại cổng `8080` và **cùng mạng LAN** với thiết bị.

## Cấu hình kết nối backend

`src/api/apiConfig.js` tự dò host backend nên thường không cần sửa:

- **Thiết bị thật (Expo Go):** lấy IP LAN của máy chạy Expo từ `hostUri` → backend là `http://<IP-LAN>:8080/api`. Máy chạy backend phải cùng Wi-Fi và mở cổng 8080.
- **Android emulator:** dùng `10.0.2.2` (alias tới `localhost` của máy host).
- Có thể đặt `FALLBACK_HOST` trong `apiConfig.js` nếu môi trường không tự dò được IP.

Lưu ý CORS: backend chỉ whitelist `http://localhost:5173` (cho web). API mobile dùng header `X-User-Id` và không bị chặn bởi CORS khi gọi từ app native, nhưng nếu chạy `expo start --web` thì cần thêm origin tương ứng vào `spring.web.cors.allowed-origins`.

## Cách chạy

```bash
cd mobile
npm install
npx expo start          # mở Metro bundler; quét QR bằng Expo Go
# hoặc
npm run android         # mở thẳng Android emulator
npm run ios             # iOS Simulator (macOS)
```

> **Android emulator (đã ghi nhận):** AVD Pixel_9 có thể treo ở màn hình boot nếu dùng GPU mặc định. Khởi chạy với cờ ANGLE để khắc phục:
> ```bash
> emulator -avd Pixel_9 -gpu angle_indirect
> ```

## Màn hình theo vai trò/quyền

Tab dưới được hiển thị theo `permissionCodes` lấy từ `GET /api/auth/my-permissions` (poll mỗi 60s). Mỗi tab gắn đúng một quyền theo `role_permissions` trong `database/final_database.sql`:

| Tab | Quyền yêu cầu | Vai trò có | Ghi chú |
| --- | --- | --- | --- |
| Vật tư | `MATERIAL.VIEW` | BGH, Lãnh đạo, Thủ kho, Cán bộ | Chỉ xem (tìm kiếm + lọc + phân trang server) |
| Tạo phiếu xin | `ISSUE_REQ.CREATE` | Cán bộ | Tạo + lịch sử + đếm "Lịch sử (N)" |
| Phê duyệt lĩnh | `ISSUE_REQ.APPROVE` | Lãnh đạo | Duyệt/Từ chối trong modal chi tiết |
| Phiếu dự trù | `SUPP_FORECAST.CREATE` | Thủ kho | **Chỉ xem lịch sử** |
| Nhập kho | `RECEIPT.CREATE` | Thủ kho | Tạo **rút gọn** + lịch sử |
| Xuất kho | `ISSUE.CREATE` | Thủ kho | **auto-FEFO**: chọn phiếu đủ điều kiện → xác nhận |
| Duyệt dự trù | `SUPP_FORECAST.APPROVE` | BGH | Duyệt/Từ chối + thẻ thống kê |

ADMIN (`USERS.MANAGE`/`PERMISSIONS.MANAGE`) **không có** `MATERIAL.VIEW` nên không thấy tab nào → màn hình "dùng bản web".

## Khác biệt so với bản web

- **Lọc & phân trang ở backend** trên mọi danh sách (vật tư, lịch sử nhập/xuất/xin lĩnh/dự trù) — app chỉ tải đúng một trang, không tải-hết-rồi-lọc.
- **Xuất kho**: chỉ auto-FEFO (không chỉnh lô thủ công như web).
- **Nhập kho**: mỗi dòng chỉ Vật tư + Số lượng + Đơn giá + Số lô (bỏ NSX/HSD/SL chứng từ; backend vẫn nhận hợp lệ).
- **Phiếu dự trù**: chỉ xem lịch sử (tạo dự trù làm trên web).
- **Không có** quản trị người dùng / phân quyền / thêm vật tư mới (web-only).
- **RBAC tab người dùng** (nếu sau này thêm lại) sẽ là chỉ-đọc trên mobile.

## Khối dùng chung (shared building blocks)

- `api/apiClient.js` — `apiGet(url, userId)` / `apiSend(method, url, body, userId)` trả `{ ok, status, data }`, không ném lỗi; tự gắn `X-User-Id`.
- `hooks/useServerHistory.js` — quản lý `keyword` (debounce 300ms), `page` (1-based UI → gửi `page-1`), đọc `data.items`/`data.requests` + `totalPages`/`totalCount`.
- `components/MaterialPicker.js` — tìm vật tư server-side qua `/materials/search?keyword=&limit=`.
- `components/DetailModal.js` — modal chi tiết: khối info, bảng dòng (hỗ trợ cột `stt` tự đánh số), `footer` để gắn nút Duyệt/Từ chối ngay trong modal.
- `utils/status.js` — `statusBadge(status)` ánh xạ 0/1/2 → Chờ duyệt (vàng) / Đã duyệt (xanh) / Từ chối (đỏ).

## Xác thực và phiên

- Đăng nhập lưu `data.user` (UserDTO, có `email`, `departmentId`, `role`) vào AsyncStorage qua `storage.saveUser`.
- "Remember me" lưu email đăng nhập.
- Mọi API cần định danh người dùng gửi header `X-User-Id`.
- `DashboardScreen` poll `GET /api/auth/my-permissions` mỗi 60s để cập nhật tab khả dụng.

## Lưu ý kỹ thuật

- Không có test runner trong `mobile/`; kiểm tra cú pháp bằng cách bundle Expo hoặc `babel-preset-expo` parse từng file.
- Auth đơn giản: backend trả token dạng `user-token-{id}`, app dùng header `X-User-Id` cho hầu hết endpoint.
- App bám sát các endpoint thật của backend (xem bảng API ở README gốc); các endpoint không tồn tại (vd. `/users`, `/roles`) đã được loại bỏ.
- Thiết kế dùng hệ token trong `theme/` — không thêm hệ style mới.
