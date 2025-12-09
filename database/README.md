run be
```bash
mvn compile
mvn spring-boot:run
```
run fe and go to the website
```bash
npm run dev
```

Spring-boot:

entity:
+ Là bản sao của bảng trong database.
+ Mỗi class Entity tương ứng với 1 bảng, mỗi thuộc tính là 1 cột.

repository:
+ Là người giao tiếp với database.
+ Chứa interface để thực hiện các thao tác CRUD (thêm, sửa, xóa, tìm kiếm) với Entity.

service: Xử lý các tính toán, quy tắc nghiệp vụ trước khi trả dữ liệu về controller.

dto (Data Transfer Object):
+ Là người đưa thư, chuyên chở dữ liệu.
+ Dùng để trao đổi dữ liệu giữa client-server, thường đơn giản hóa hoặc gom nhóm dữ liệu từ Entity để phù hợp với nhu cầu.

controller (API):
+ Là bộ mặt của ứng dụng, tiếp nhận các request từ client (trình duyệt, app, ...).
+ Nhận request, gọi đến Service xử lý, rồi trả kết quả (response) về cho client.

Luồng đi cơ bản:
Client → Controller → Service → Repository → Database
Và ngược lại, dữ liệu đi từ Database sẽ được "gói" thành DTO trước khi trả về Client.