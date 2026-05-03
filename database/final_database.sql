-- ============================================================
-- MEDVENTORY_HMU - RESET & SEED (PostgreSQL)
-- Rerunnable: drops schema, recreates all tables
-- Includes RBAC (Role/Permission) + Notifications 1->N
-- Adds Stock Reservation for safe auto-approve Issue Requests
-- ============================================================
BEGIN;

-- ============================================================
-- 0) RESET SCHEMA
-- ============================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SET search_path TO public;

-- ============================================================
-- 1) MASTER DATA
-- ============================================================

CREATE TABLE departments (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE sub_departments (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE (name, department_id)
);

CREATE TABLE units (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

-- ============================================================
-- 2) LOOKUP TABLES (tường minh, tránh magic number)
-- ============================================================

CREATE TABLE roles (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,      -- 'BGH','LANH_DAO','THU_KHO','CAN_BO'
  name VARCHAR(80) NOT NULL
);

CREATE TABLE user_status (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,      -- 'PENDING','APPROVED'
  name VARCHAR(80) NOT NULL
);

CREATE TABLE doc_status (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,      -- 'PENDING','APPROVED','REJECTED'
  name VARCHAR(80) NOT NULL
);

CREATE TABLE notification_entities (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,      -- 'ISSUE_REQ','SUPP_FORECAST'
  name VARCHAR(120) NOT NULL
);

CREATE TABLE notification_events (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,      -- 'PENDING','APPROVED','REJECTED','SCHEDULED'
  name VARCHAR(120) NOT NULL
);

CREATE TABLE reservation_status (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,      -- 'ACTIVE','CANCELLED','CONSUMED'
  name VARCHAR(120) NOT NULL
);

-- ============================================================
-- 3) RBAC
-- ============================================================

CREATE TABLE permissions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(80) UNIQUE NOT NULL,   -- VD: 'SUPP_FORECAST.CREATE'
  name        VARCHAR(150) NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
-- grant: cấp quyền, revoke: thu hồi quyền
CREATE TABLE user_permissions (
  user_id       INT NOT NULL,
  permission_id INT NOT NULL,
  effect        VARCHAR(10) NOT NULL CHECK (effect IN ('GRANT','REVOKE')),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id)
);

-- ============================================================
-- 4) USERS
-- ============================================================

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(120) UNIQUE NOT NULL,
  password      VARCHAR(200) NOT NULL,
  date_of_birth DATE,
  department_id INT REFERENCES departments(id),

  role_id       INT NOT NULL REFERENCES roles(id),
  job_title     VARCHAR(150),
  status_id     INT NOT NULL REFERENCES user_status(id),

  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_permissions
  ADD CONSTRAINT fk_user_permissions_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_permissions
  ADD CONSTRAINT fk_user_permissions_permission
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

-- ============================================================
-- 5) MATERIALS CATALOG
-- ============================================================

CREATE TABLE materials (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  spec         VARCHAR(255) NOT NULL,
  unit_id      INT NOT NULL REFERENCES units(id),
  code         VARCHAR(100) NOT NULL UNIQUE,
  manufacturer VARCHAR(255) NOT NULL,
  category     CHAR(1) NOT NULL CHECK (category IN ('A','B','C','D')),
  UNIQUE (name, spec, manufacturer)
);

-- ============================================================
-- 6) ISSUE REQUEST (Phiếu xin lĩnh)
-- ============================================================

CREATE TABLE issue_req_header (
  id                SERIAL PRIMARY KEY,
  created_by        INT REFERENCES users(id) ON DELETE SET NULL,
  sub_department_id INT REFERENCES sub_departments(id),
  department_id     INT REFERENCES departments(id),
  requested_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  status_id         INT NOT NULL REFERENCES doc_status(id),

  approval_by       INT REFERENCES users(id) ON DELETE SET NULL,
  approval_at       TIMESTAMP,
  approval_note     TEXT,
  note              TEXT
);

CREATE TABLE issue_req_detail (
  id                    SERIAL PRIMARY KEY,
  header_id             INT NOT NULL REFERENCES issue_req_header(id) ON DELETE CASCADE,

  material_id           INT REFERENCES materials(id),

  material_name         VARCHAR(255),
  spec                  VARCHAR(255),
  unit_id               INT REFERENCES units(id),

  qty_requested         NUMERIC(18,3) NOT NULL CHECK (qty_requested > 0),

  proposed_code         VARCHAR(100),
  proposed_manufacturer VARCHAR(255),

  material_category     CHAR(1) CHECK (material_category IN ('A','B','C','D')),

  CHECK (
    (material_id IS NOT NULL)
    OR (material_name IS NOT NULL AND unit_id IS NOT NULL)
  )
);

-- ============================================================
-- 7) SUPPLEMENT FORECAST (Phiếu dự trù bổ sung)
-- ============================================================

CREATE TABLE supp_forecast_header (
  id            SERIAL PRIMARY KEY,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    DATE DEFAULT CURRENT_DATE,
  academic_year VARCHAR(20),
  department_id INT REFERENCES departments(id),

  status_id     INT NOT NULL REFERENCES doc_status(id),

  approval_by   INT REFERENCES users(id) ON DELETE SET NULL,
  approval_at   TIMESTAMP,
  approval_note TEXT
);

CREATE TABLE supp_forecast_detail (
  id                    SERIAL PRIMARY KEY,
  header_id             INT NOT NULL REFERENCES supp_forecast_header(id) ON DELETE CASCADE,
  material_id           INT REFERENCES materials(id),

  current_stock         NUMERIC(18,3) DEFAULT 0,
  prev_year_qty         NUMERIC(18,3) DEFAULT 0,
  this_year_qty         NUMERIC(18,3) NOT NULL CHECK (this_year_qty >= 0),

  proposed_code         VARCHAR(100),
  proposed_manufacturer VARCHAR(255),
  justification         TEXT
);

-- ============================================================
-- 8) RECEIPT (Phiếu nhập kho)
-- ============================================================

CREATE TABLE receipt_header (
  id            SERIAL PRIMARY KEY,
  created_by    INT REFERENCES users(id),
  received_from VARCHAR(255),
  reason        TEXT,
  receipt_date  DATE DEFAULT CURRENT_DATE,
  total_amount  NUMERIC(18,2)
);

CREATE TABLE receipt_detail (
  id          SERIAL PRIMARY KEY,
  header_id   INT NOT NULL REFERENCES receipt_header(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id),

  name        VARCHAR(255),
  spec        VARCHAR(255),
  code        VARCHAR(100),

  unit_id     INT REFERENCES units(id),
  price       NUMERIC(18,2),
  qty_doc     NUMERIC(18,3),
  qty_actual  NUMERIC(18,3),

  lot_number  VARCHAR(100),
  mfg_date    DATE,
  exp_date    DATE,

  total       NUMERIC(18,2)
);

-- ============================================================
-- 9) ISSUE (Phiếu xuất kho)
-- ============================================================

CREATE TABLE issue_header (
  id            SERIAL PRIMARY KEY,
  created_by    INT REFERENCES users(id),

  issue_req_id  INT REFERENCES issue_req_header(id) ON DELETE SET NULL,

  receiver_name VARCHAR(255),
  department_id INT REFERENCES departments(id),
  issue_date    DATE DEFAULT CURRENT_DATE,
  total_amount  NUMERIC(18,2)
);

CREATE TABLE issue_detail (
  id            SERIAL PRIMARY KEY,
  header_id     INT NOT NULL REFERENCES issue_header(id) ON DELETE CASCADE,
  material_id   INT REFERENCES materials(id),

  name          VARCHAR(255),
  spec          VARCHAR(255),
  code          VARCHAR(100),

  unit_id       INT REFERENCES units(id),
  unit_price    NUMERIC(18,2),

  qty_requested NUMERIC(18,3),
  qty_issued    NUMERIC(18,3),

  total         NUMERIC(18,2)
);

-- ============================================================
-- 10) INVENTORY CARD (Thẻ kho theo lô)
-- ============================================================

CREATE TABLE inventory_card (
  id                SERIAL PRIMARY KEY,
  material_id       INT REFERENCES materials(id),
  unit_id           INT REFERENCES units(id),

  warehouse_name    VARCHAR(255),
  record_date       DATE DEFAULT CURRENT_DATE,

  opening_stock     NUMERIC(18,3) DEFAULT 0,
  qty_in            NUMERIC(18,3) DEFAULT 0,
  qty_out           NUMERIC(18,3) DEFAULT 0,
  closing_stock     NUMERIC(18,3)
    GENERATED ALWAYS AS (opening_stock + qty_in - qty_out) STORED,

  supplier          VARCHAR(255),
  lot_number        VARCHAR(100),
  mfg_date          DATE,
  exp_date          DATE,

  sub_department_id INT REFERENCES sub_departments(id)
);

-- ============================================================
-- 10.1) STOCK RESERVATION (Giữ chỗ tồn kho cho auto-approve)
-- ============================================================

CREATE TABLE issue_reservations (
  id                    SERIAL PRIMARY KEY,

  issue_req_header_id   INT NOT NULL REFERENCES issue_req_header(id) ON DELETE CASCADE,
  issue_req_detail_id   INT REFERENCES issue_req_detail(id) ON DELETE SET NULL,

  material_id           INT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  lot_number            VARCHAR(100) NOT NULL,

  qty_reserved          NUMERIC(18,3) NOT NULL CHECK (qty_reserved > 0),

  status_id             INT NOT NULL REFERENCES reservation_status(id),

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by            INT REFERENCES users(id) ON DELETE SET NULL,

  consumed_at           TIMESTAMP,
  note                  TEXT
);

-- ============================================================
-- 11) NOTIFICATIONS: 1 thông báo -> nhiều người nhận
-- ============================================================

CREATE TABLE notifications (
  id             SERIAL PRIMARY KEY,
  entity_type_id INT NOT NULL REFERENCES notification_entities(id),
  event_type_id  INT NOT NULL REFERENCES notification_events(id),
  entity_id      INT NOT NULL,

  title          VARCHAR(255),
  content        TEXT,

  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by     INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notification_recipients (
  notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMP,
  PRIMARY KEY (notification_id, user_id)
);

-- ============================================================
-- 12) INDEXES
-- ============================================================

CREATE INDEX idx_subdep_dept           ON sub_departments(department_id);
CREATE INDEX idx_users_role            ON users(role_id);
CREATE INDEX idx_users_status          ON users(status_id);

CREATE INDEX idx_issue_req_dept        ON issue_req_header(department_id);
CREATE INDEX idx_issue_req_status      ON issue_req_header(status_id);
CREATE INDEX idx_issue_req_created     ON issue_req_header(created_by);

CREATE INDEX idx_supp_forecast_dept    ON supp_forecast_header(department_id);
CREATE INDEX idx_supp_forecast_status  ON supp_forecast_header(status_id);

CREATE INDEX idx_inventory_material    ON inventory_card(material_id);
CREATE INDEX idx_inventory_lot         ON inventory_card(material_id, lot_number);
CREATE INDEX idx_inventory_exp         ON inventory_card(material_id, exp_date);

CREATE INDEX idx_materials_code        ON materials(code);

CREATE INDEX idx_issue_header_req      ON issue_header(issue_req_id);

CREATE INDEX idx_resv_header           ON issue_reservations(issue_req_header_id);
CREATE INDEX idx_resv_detail           ON issue_reservations(issue_req_detail_id);
CREATE INDEX idx_resv_material_lot     ON issue_reservations(material_id, lot_number);
CREATE INDEX idx_resv_status           ON issue_reservations(status_id);

CREATE INDEX idx_notif_entity          ON notifications(entity_type_id, entity_id);
CREATE INDEX idx_notif_recip_user      ON notification_recipients(user_id, is_read);

-- ============================================================
-- SEED: LOOKUPS
-- ============================================================

INSERT INTO roles (code, name) VALUES
('BGH',      'Ban Giám Hiệu'),
('LANH_DAO', 'Lãnh đạo'),
('THU_KHO',  'Thủ kho'),
('CAN_BO',   'Cán bộ');

INSERT INTO user_status (code, name) VALUES
('PENDING',  'Chờ duyệt'),
('APPROVED', 'Đã duyệt');

INSERT INTO doc_status (code, name) VALUES
('PENDING',  'Chờ duyệt'),
('APPROVED', 'Đã duyệt'),
('REJECTED', 'Từ chối');

INSERT INTO notification_entities (code, name) VALUES
('ISSUE_REQ',     'Phiếu xin lĩnh hàng hóa'),
('SUPP_FORECAST', 'Phiếu dự trù bổ sung hàng hóa');

INSERT INTO notification_events (code, name) VALUES
('PENDING',   'Chờ phê duyệt'),
('APPROVED',  'Đã phê duyệt'),
('REJECTED',  'Từ chối'),
('SCHEDULED', 'Hẹn lịch / Thông báo thời gian');

INSERT INTO reservation_status (code, name) VALUES
('ACTIVE',    'Đang giữ chỗ'),
('CANCELLED', 'Đã hủy'),
('CONSUMED',  'Đã tiêu thụ');

-- ============================================================
-- SEED: PERMISSIONS
-- ============================================================

INSERT INTO permissions(code, name, description) VALUES
('SUPP_FORECAST.CREATE',  'Tạo phiếu dự trù bổ sung',                       'Thủ kho tạo phiếu dự trù'),
('SUPP_FORECAST.APPROVE', 'Phê duyệt phiếu dự trù',                         'BGH phê duyệt phiếu dự trù'),
('ISSUE_REQ.CREATE',      'Tạo phiếu xin lĩnh',                             'Đơn vị tạo phiếu xin lĩnh'),
('ISSUE_REQ.APPROVE',     'Phê duyệt phiếu xin lĩnh',                       'Lãnh đạo phê duyệt phiếu xin lĩnh'),
('RECEIPT.CREATE',        'Tạo phiếu nhập kho',                             'Thủ kho lập phiếu nhập kho'),
('ISSUE.CREATE',          'Tạo phiếu xuất kho',                             'Thủ kho lập phiếu xuất kho'),
('MATERIAL.MANAGE',       'Theo dõi hàng tồn, thêm mới danh mục vật tư',    'Theo dõi tồn kho, thêm danh mục vật tư'),
('USERS.MANAGE',          'Quản lý danh mục người dùng',                    'Phê duyệt/điều chỉnh quyền tài khoản, thêm mới đơn vị'),
('PERMISSIONS.MANAGE',    'Quản lý danh sách quyền hệ thống',               'Mở rộng quyền hệ thống'),
('NOTIF.MANAGE',          'Quản lý thông báo',                              'Tạo thông báo và phân phối tới người nhận');

-- ROLE -> PERMISSIONS
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code='BGH' AND p.code IN ('SUPP_FORECAST.APPROVE','NOTIF.MANAGE');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code='BGH' AND p.code IN ('USERS.MANAGE','PERMISSIONS.MANAGE');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code='LANH_DAO' AND p.code IN ('ISSUE_REQ.APPROVE','NOTIF.MANAGE');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code='THU_KHO' AND p.code IN (
  'SUPP_FORECAST.CREATE', 'RECEIPT.CREATE','ISSUE.CREATE','MATERIAL.MANAGE','NOTIF.MANAGE'
);

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code='CAN_BO' AND p.code IN ('ISSUE_REQ.CREATE');

-- ============================================================
-- SEED: MASTER DATA
-- ============================================================

INSERT INTO departments(name) VALUES
('Quản trị vật tư'),('Khoa xét nghiệm'),('Khoa phục hồi chức năng'),('Khoa gây mê hồi sức và chống đau'),
('Khoa cấp cứu'),('Khoa mắt'),('Khoa ngoại tim mạch và lồng ngực'),('Khoa ngoại tiết niệu'),
('Khoa dược'),('Khoa hồi sức tích cực'),('Khoa khám chữa bệnh theo yêu cầu'),('Khoa giải phẫu bệnh'),
('Khoa nội thần kinh'),('Khoa vi sinh - ký sinh trùng'),('Khoa nội tổng hợp'),('Khoa dinh dưỡng và tiết chế'),
('Khoa phẫu thuật tạo hình thẩm mỹ'),('Khoa hô hấp'),('Khoa kiểm soát nhiễm khuẩn'),('Khoa thăm dò chức năng'),
('Khoa phụ sản'),('Khoa nam học và y học giới tính'),('Khoa ngoại tổng hợp'),('Khoa nhi'),
('Khoa ngoại thần kinh - cột sống'),('Khoa dị ứng - miễn dịch lâm sàng'),('Khoa nội tiết'),
('Khoa huyết học và truyền máu'),('Khoa y học cổ truyền'),('Khoa răng hàm mặt'),
('Khoa chấn thương chỉnh hình và y học thể thao'),('Khoa khám bệnh'),('Khoa nội thận - tiết niệu'),
('Khoa bệnh nhiệt đới và can thiệp giảm hại');

INSERT INTO sub_departments(name, department_id) VALUES
('Dược lý',         (SELECT id FROM departments WHERE name='Khoa dược')),
('Hóa sinh',        (SELECT id FROM departments WHERE name='Khoa xét nghiệm')),
('BHPT',            (SELECT id FROM departments WHERE name='Khoa xét nghiệm')),
('Vi sinh',         (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng')),
('Kho chính',       (SELECT id FROM departments WHERE name='Quản trị vật tư')),
('Huyết học',       (SELECT id FROM departments WHERE name='Khoa xét nghiệm')),
('Hồi sức nội',     (SELECT id FROM departments WHERE name='Khoa hồi sức tích cực')),
('Hồi sức ngoại',   (SELECT id FROM departments WHERE name='Khoa hồi sức tích cực')),
('Cấp cứu người lớn',(SELECT id FROM departments WHERE name='Khoa cấp cứu')),
('Cấp cứu nhi',     (SELECT id FROM departments WHERE name='Khoa cấp cứu')),
('Sản khoa',        (SELECT id FROM departments WHERE name='Khoa phụ sản')),
('Kế hoạch hóa',    (SELECT id FROM departments WHERE name='Khoa phụ sản')),
('Nhi sơ sinh',     (SELECT id FROM departments WHERE name='Khoa nhi')),
('Nhi tổng hợp',    (SELECT id FROM departments WHERE name='Khoa nhi')),
('Kho phụ',         (SELECT id FROM departments WHERE name='Quản trị vật tư'));

INSERT INTO units(name) VALUES
('Chai'),('Lọ'),('Hộp'),('Cái'),('ml'),('g'),('Viên'),('kg'),('Bộ'),
('Túi'),('Ống'),('Gói'),('Cuộn'),('Tấm');

-- ============================================================
-- SEED: USERS
-- ============================================================

INSERT INTO users(full_name, email, password, date_of_birth, department_id, role_id, job_title, status_id) VALUES
('Trưởng phòng QTVT',           'lanhdao@gmail.com',        '12345', '1975-03-12', (SELECT id FROM departments WHERE name='Quản trị vật tư'),             (SELECT id FROM roles WHERE code='LANH_DAO'), 'Trưởng phòng Quản trị vật tư',       (SELECT id FROM user_status WHERE code='APPROVED')),
('Phó phòng QTVT',              'pholanhdao@gmail.com',     '12345', '1980-07-25', (SELECT id FROM departments WHERE name='Quản trị vật tư'),             (SELECT id FROM roles WHERE code='LANH_DAO'), 'Phó phòng Quản trị vật tư',          (SELECT id FROM user_status WHERE code='APPROVED')),
('Thủ Kho Chính',               'thukho@gmail.com',         '12345', '1985-11-08', (SELECT id FROM departments WHERE name='Quản trị vật tư'),             (SELECT id FROM roles WHERE code='THU_KHO'),  'Thủ kho chính',                       (SELECT id FROM user_status WHERE code='APPROVED')),
('Thủ Kho Phụ',                 'thukho2@gmail.com',        '12345', '1990-04-17', (SELECT id FROM departments WHERE name='Quản trị vật tư'),             (SELECT id FROM roles WHERE code='THU_KHO'),  'Thủ kho phụ',                         (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Bộ môn BHPT',              'canbo.bhpt@gmail.com',     '12345', '1992-09-30', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),             (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Bộ môn BHPT',                  (SELECT id FROM user_status WHERE code='PENDING')),
('CB Hóa sinh',                 'canbo.hoasinh@gmail.com',  '12345', '1988-02-14', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),             (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Hóa sinh',                     (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Vi sinh',                  'canbo.visinh@gmail.com',   '12345', '1991-06-22', (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng'),(SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Vi sinh',                      (SELECT id FROM user_status WHERE code='PENDING')),
('CB Dược lý',                  'canbo.duocly@gmail.com',   '12345', '1987-12-05', (SELECT id FROM departments WHERE name='Khoa dược'),                   (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Dược lý',                      (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Khám bệnh',                'canbo.khambenh@gmail.com', '12345', '1993-08-18', (SELECT id FROM departments WHERE name='Khoa khám bệnh'),              (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Khám bệnh',                    (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Cấp cứu',                  'canbo.capcuu@gmail.com',   '12345', '1994-01-27', (SELECT id FROM departments WHERE name='Khoa cấp cứu'),                (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Cấp cứu',                      (SELECT id FROM user_status WHERE code='PENDING')),
('GS. TS. BS. Nguyễn Hữu Tú',  'hieutruong@gmail.com',     '12345', '1965-05-10', NULL,                                                                  (SELECT id FROM roles WHERE code='BGH'),      'Hiệu trưởng',                          (SELECT id FROM user_status WHERE code='APPROVED')),
('PGS. TS. BS. Kim Bảo Giang',  'phohieutruong1@gmail.com', '12345', '1968-09-03', NULL,                                                                  (SELECT id FROM roles WHERE code='BGH'),      'Phó Hiệu trưởng',                      (SELECT id FROM user_status WHERE code='APPROVED')),
('PGS. TS. BS. Hồ Thị Kim Thanh','phohieutruong2@gmail.com','12345', '1970-11-19', NULL,                                                                  (SELECT id FROM roles WHERE code='BGH'),      'Phó Hiệu trưởng',                      (SELECT id FROM user_status WHERE code='APPROVED')),
('PGS. TS. BS. Lê Đình Tùng',   'phohieutruong3@gmail.com', '12345', '1967-04-28', NULL,                                                                  (SELECT id FROM roles WHERE code='BGH'),      'Phó Hiệu trưởng',                      (SELECT id FROM user_status WHERE code='APPROVED')),
('TS. Phạm Xuân Thắng',         'phohieutruong4@gmail.com', '12345', '1972-07-15', NULL,                                                                  (SELECT id FROM roles WHERE code='BGH'),      'Phó Hiệu trưởng',                      (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Hồi sức tích cực',         'canbo.hoisu@gmail.com',    '12345', '1989-03-11', (SELECT id FROM departments WHERE name='Khoa hồi sức tích cực'),       (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Hồi sức tích cực',             (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Khoa Nhi',                 'canbo.nhi@gmail.com',      '12345', '1995-06-04', (SELECT id FROM departments WHERE name='Khoa nhi'),                    (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Khoa Nhi',                     (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Phụ sản',                  'canbo.phusan@gmail.com',   '12345', '1990-10-21', (SELECT id FROM departments WHERE name='Khoa phụ sản'),                (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Khoa Phụ sản',                 (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Ngoại tổng hợp',           'canbo.ngoai@gmail.com',    '12345', '1986-08-09', (SELECT id FROM departments WHERE name='Khoa ngoại tổng hợp'),         (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Ngoại tổng hợp',               (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Huyết học',                'canbo.huyethoc@gmail.com', '12345', '1993-12-16', (SELECT id FROM departments WHERE name='Khoa huyết học và truyền máu'),(SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Huyết học',                    (SELECT id FROM user_status WHERE code='PENDING')),
('CB Khoa Mắt',                 'canbo.mat@gmail.com',      '12345', '1991-02-28', (SELECT id FROM departments WHERE name='Khoa mắt'),                    (SELECT id FROM roles WHERE code='CAN_BO'),   'Cán bộ Khoa Mắt',                     (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Dị ứng',                   'canbo.diung@gmail.com',    '12345', '1988-07-07', (SELECT id FROM departments WHERE name='Khoa dị ứng - miễn dịch lâm sàng'),(SELECT id FROM roles WHERE code='CAN_BO'),'Cán bộ Dị ứng - Miễn dịch',          (SELECT id FROM user_status WHERE code='APPROVED'));

-- ============================================================
-- SEED: MATERIALS
-- ============================================================

INSERT INTO materials(name, spec, unit_id, code, manufacturer, category) VALUES
-- Hóa chất & dung dịch
('Ethanol 96%',                 'Chai 500 ml',          (SELECT id FROM units WHERE name='Chai'), 'ETH96-500',     'ABC Pharma',    'B'),
('NaCl 0.9%',                   'Chai 1000 ml',         (SELECT id FROM units WHERE name='Chai'), 'NACL-1000',     'IVCo',          'B'),
('Glucoza 5%',                  'Chai 500 ml',          (SELECT id FROM units WHERE name='Chai'), 'GLUC-500',      'IVCo',          'B'),
('Cồn 70 độ',                   'Chai 500 ml',          (SELECT id FROM units WHERE name='Chai'), 'ALCOHOL-70',    'ABC Pharma',    'B'),
('Dung dịch Povidone Iodine 10%','Chai 500 ml',         (SELECT id FROM units WHERE name='Chai'), 'PVDI-500',      'MediPharm',     'B'),
('Dung dịch Formalin 10%',      'Chai 1000 ml',         (SELECT id FROM units WHERE name='Chai'), 'FORM-1000',     'LabChem',       'B'),
('Dung dịch Chlorhexidine 2%',  'Chai 500 ml',          (SELECT id FROM units WHERE name='Chai'), 'CHLORHEX-500',  'MölnlyckeVN',   'B'),
('Dung dịch khử khuẩn Cidex',   'Lọ 3.8 L',            (SELECT id FROM units WHERE name='Lọ'),   'CID-3800',      'JohnsonMed',    'B'),
('Hóa chất xét nghiệm sinh hóa','Lọ 100 ml',           (SELECT id FROM units WHERE name='Lọ'),   'CHEM-TEST',     'LabChem',       'B'),
('Thuốc thử nước tiểu 10 thông số','Hộp 100 que',       (SELECT id FROM units WHERE name='Hộp'),  'URINE-10P',     'Analyticon',    'B'),
-- Thuốc & sinh phẩm
('Paracetamol 500mg',           'Hộp 10 vỉ x 10 viên', (SELECT id FROM units WHERE name='Hộp'),  'PARA500-100',   'MediPharm',     'A'),
('Que thử đường huyết',         'Hộp 50 que',           (SELECT id FROM units WHERE name='Hộp'),  'GLUCOSE-50',    'DiabTest',      'A'),
('Que thử thai',                'Hộp 20 que',           (SELECT id FROM units WHERE name='Hộp'),  'PREG-20',       'FemiTest',      'B'),
-- Vật tư tiêu hao (nhóm A - kiểm soát cao)
('Kim tiêm vô trùng 23G',       'Hộp 100 cái',          (SELECT id FROM units WHERE name='Hộp'),  'SYRINGE-100',   'MediNeedle',    'A'),
('Bơm tiêm 5ml',                'Hộp 100 cái',          (SELECT id FROM units WHERE name='Hộp'),  'SYRINGE-5ML',   'MediNeedle',    'A'),
('Bơm tiêm 10ml',               'Hộp 100 cái',          (SELECT id FROM units WHERE name='Hộp'),  'SYR10-100',     'BBraun',        'A'),
('Bơm tiêm 20ml',               'Hộp 100 cái',          (SELECT id FROM units WHERE name='Hộp'),  'SYR20-100',     'BBraun',        'A'),
('Dây truyền dịch có kim',      'Hộp 50 bộ',            (SELECT id FROM units WHERE name='Hộp'),  'IV-SET-50',     'MediSet',       'A'),
('Catheter tĩnh mạch 22G',      'Hộp 50 cái',           (SELECT id FROM units WHERE name='Hộp'),  'CATH-22G',      'BBraun',        'A'),
('Catheter tĩnh mạch 20G',      'Hộp 50 cái',           (SELECT id FROM units WHERE name='Hộp'),  'CATH-20G',      'BBraun',        'A'),
('Ống hút máu EDTA 3ml',        'Hộp 100 ống',          (SELECT id FROM units WHERE name='Hộp'),  'EDTA-3ML',      'VacuTech',      'A'),
('Ống hút máu thường 5ml',      'Hộp 100 ống',          (SELECT id FROM units WHERE name='Hộp'),  'TUBE-PLAIN-5',  'VacuTech',      'A'),
('Chỉ khâu Silk 2-0',          'Hộp 12 sợi',           (SELECT id FROM units WHERE name='Hộp'),  'SILK-2-0',      'SutureKo',      'A'),
('Chỉ khâu Vicryl 3-0',        'Hộp 12 sợi',           (SELECT id FROM units WHERE name='Hộp'),  'VCR-3-0',       'Ethicon',       'A'),
('Dao mổ cán số 3',             'Hộp 10 cái',           (SELECT id FROM units WHERE name='Hộp'),  'SCALPEL-3',     'SurgMed',       'A'),
('Ống thông tiểu Foley 14Fr',   'Cái',                  (SELECT id FROM units WHERE name='Cái'),  'FOLEY-14',      'Coloplast',     'A'),
-- Vật tư tiêu hao (nhóm B & C)
('Găng tay y tế không bột',     'Hộp 100 chiếc',        (SELECT id FROM units WHERE name='Hộp'),  'GLOVE-100',     'GloveCo',       'C'),
('Găng tay phẫu thuật cỡ 7',   'Hộp 50 đôi',           (SELECT id FROM units WHERE name='Hộp'),  'GLOVE-SRG-7',   'Ansell',        'A'),
('Khẩu trang y tế 3 lớp',      'Hộp 50 cái',           (SELECT id FROM units WHERE name='Hộp'),  'MASK-50',       'ProtectMed',    'C'),
('Khẩu trang N95',              'Hộp 20 cái',           (SELECT id FROM units WHERE name='Hộp'),  'N95-20',        '3M',            'B'),
('Bông y tế vô trùng',          'Hộp 500g',             (SELECT id FROM units WHERE name='Hộp'),  'COTTON-500',    'MediCotton',    'C'),
('Bông viên vô trùng',          'Túi 100 viên',         (SELECT id FROM units WHERE name='Túi'),  'COTTON-BALL',   'MediCotton',    'C'),
('Gạc vô trùng 10x10',          'Hộp 50 miếng',         (SELECT id FROM units WHERE name='Hộp'),  'GAUZE-50',      'MediGauze',     'C'),
('Gạc cuộn 10cm x 5m',         'Cuộn',                 (SELECT id FROM units WHERE name='Cuộn'), 'GAUZE-ROLL-10', 'MediGauze',     'C'),
('Băng dính y tế 5cm x 5m',    'Cuộn',                 (SELECT id FROM units WHERE name='Cuộn'), 'TAPE-5CM',      '3M Med',        'C'),
('Băng gạc cá nhân',            'Hộp 100 cái',          (SELECT id FROM units WHERE name='Hộp'),  'BANDAGE-100',   'FirstAid Co',   'C'),
('Băng vết thương Hydrocolloid','Hộp 10 miếng',         (SELECT id FROM units WHERE name='Hộp'),  'HYDROCO-10',    'ConvaTec',      'B'),
('Tấm lót phẫu thuật vô trùng','Gói 5 tấm',            (SELECT id FROM units WHERE name='Gói'),  'DRAPE-5',       'SurgMed',       'B'),
('Mặt nạ thở oxy người lớn',   'Cái',                  (SELECT id FROM units WHERE name='Cái'),  'OXYMASK-ADULT', 'OxyMed',        'B'),
-- Dụng cụ & thiết bị (nhóm D)
('Ống nghiệm thủy tinh 10ml',   '10 ml',                (SELECT id FROM units WHERE name='Cái'),  'TUBE-10',       'LabGlass',      'D'),
('Ống nghiệm plastic',          'Hộp 200 cái',          (SELECT id FROM units WHERE name='Hộp'),  'TUBE-PLASTIC',  'LabPlastic',    'D'),
('Ống đựng mẫu nước tiểu',      'Hộp 100 ống',          (SELECT id FROM units WHERE name='Hộp'),  'URINE-TUBE-100','LabPlastic',    'D'),
('Ống pipet 1ml',               'Bộ 100 cái',           (SELECT id FROM units WHERE name='Bộ'),   'PIP1-100',      'LabMate',       'D'),
('Kéo phẫu thuật thẳng',       'Cái',                  (SELECT id FROM units WHERE name='Cái'),  'SCISSORS-ST',   'SurgMed',       'C'),
('Kéo phẫu thuật cong',        'Cái',                  (SELECT id FROM units WHERE name='Cái'),  'SCISSORS-CV',   'SurgMed',       'C'),
('Bộ dụng cụ khâu vết thương', 'Bộ',                   (SELECT id FROM units WHERE name='Bộ'),   'SUTURE-KIT',    'SurgMed',       'B');

-- ============================================================
-- SEED: Dự trù bổ sung (8 header + detail)
-- ============================================================

WITH h AS (
  INSERT INTO supp_forecast_header(created_by, academic_year, department_id, status_id, approval_by, approval_at, approval_note)
  VALUES
    -- 1: Xét nghiệm - APPROVED
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),
     (SELECT id FROM doc_status WHERE code='APPROVED'),
     (SELECT id FROM users WHERE email='hieutruong@gmail.com'),NOW()-INTERVAL '15 days','Đồng ý theo đề xuất'),
    -- 2: Xét nghiệm - PENDING
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL),
    -- 3: Dược - APPROVED
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa dược'),
     (SELECT id FROM doc_status WHERE code='APPROVED'),
     (SELECT id FROM users WHERE email='phohieutruong1@gmail.com'),NOW()-INTERVAL '10 days','Phê duyệt đủ số lượng'),
    -- 4: Cấp cứu - REJECTED
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa cấp cứu'),
     (SELECT id FROM doc_status WHERE code='REJECTED'),
     (SELECT id FROM users WHERE email='phohieutruong2@gmail.com'),NOW()-INTERVAL '5 days','Cần điều chỉnh giảm số lượng'),
    -- 5: Khám bệnh - PENDING
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa khám bệnh'),
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL),
    -- 6: Hồi sức tích cực - APPROVED
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa hồi sức tích cực'),
     (SELECT id FROM doc_status WHERE code='APPROVED'),
     (SELECT id FROM users WHERE email='hieutruong@gmail.com'),NOW()-INTERVAL '20 days','Phê duyệt toàn bộ danh mục'),
    -- 7: Phụ sản - PENDING
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa phụ sản'),
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL),
    -- 8: Nhi - APPROVED
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',
     (SELECT id FROM departments WHERE name='Khoa nhi'),
     (SELECT id FROM doc_status WHERE code='APPROVED'),
     (SELECT id FROM users WHERE email='phohieutruong3@gmail.com'),NOW()-INTERVAL '8 days','Duyệt theo kế hoạch năm học')
  RETURNING id
),
x AS (
  SELECT
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 0) h1,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 1) h2,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 2) h3,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 3) h4,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 4) h5,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 5) h6,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 6) h7,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 7) h8
)
INSERT INTO supp_forecast_detail(header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification)
-- h1: Xét nghiệm APPROVED
SELECT x.h1,(SELECT id FROM materials WHERE code='ETH96-500'),   10,  50,  80, 'ETH96-500',    'ABC Pharma', 'Bổ sung phục vụ thực hành' FROM x UNION ALL
SELECT x.h1,(SELECT id FROM materials WHERE code='GLOVE-100'),   20, 120, 150, 'GLOVE-100',    'GloveCo',   'Tăng nhu cầu thực hành' FROM x UNION ALL
SELECT x.h1,(SELECT id FROM materials WHERE code='TUBE-10'),     50, 200, 250, 'TUBE-10',      'LabGlass',  'Thay thế hao hụt/vỡ' FROM x UNION ALL
SELECT x.h1,(SELECT id FROM materials WHERE code='CHEM-TEST'),    5,  30,  50, 'CHEM-TEST',    'LabChem',   'Tăng cường hóa chất' FROM x UNION ALL
SELECT x.h1,(SELECT id FROM materials WHERE code='EDTA-3ML'),    15,  80, 120, 'EDTA-3ML',     'VacuTech',  'Ống hút máu EDTA phục vụ XN' FROM x UNION ALL
-- h2: Xét nghiệm PENDING
SELECT x.h2,(SELECT id FROM materials WHERE code='PIP1-100'),    30, 100, 150, 'PIP1-100',     'LabMate',   'Bổ sung dụng cụ thí nghiệm' FROM x UNION ALL
SELECT x.h2,(SELECT id FROM materials WHERE code='TUBE-PLASTIC'),10,  60, 100, 'TUBE-PLASTIC', 'LabPlastic','Ống nghiệm plastic thay thế' FROM x UNION ALL
SELECT x.h2,(SELECT id FROM materials WHERE code='URINE-10P'),    3,  20,  36, 'URINE-10P',    'Analyticon','Que thử nước tiểu đa chỉ số' FROM x UNION ALL
-- h3: Dược APPROVED
SELECT x.h3,(SELECT id FROM materials WHERE code='PARA500-100'), 15,  60,  90, 'PARA500-100',  'MediPharm', 'Dự trù cho nghiên cứu dược lý' FROM x UNION ALL
SELECT x.h3,(SELECT id FROM materials WHERE code='NACL-1000'),   25,  80, 120, 'NACL-1000',    'IVCo',      'Dung dịch truyền nghiên cứu' FROM x UNION ALL
SELECT x.h3,(SELECT id FROM materials WHERE code='PVDI-500'),     8,  40,  60, 'PVDI-500',     'MediPharm', 'Sát khuẩn trước thủ thuật' FROM x UNION ALL
SELECT x.h3,(SELECT id FROM materials WHERE code='GLUCOSE-50'),   6,  24,  36, 'GLUCOSE-50',   'DiabTest',  'Theo dõi đường huyết BN mãn tính' FROM x UNION ALL
-- h4: Cấp cứu REJECTED
SELECT x.h4,(SELECT id FROM materials WHERE code='SYRINGE-100'), 40, 150, 200, 'SYRINGE-100',  'MediNeedle','Kim tiêm cấp cứu' FROM x UNION ALL
SELECT x.h4,(SELECT id FROM materials WHERE code='IV-SET-50'),    5,  30,  80, 'IV-SET-50',    'MediSet',   'Dây truyền dịch tăng cao bất thường' FROM x UNION ALL
SELECT x.h4,(SELECT id FROM materials WHERE code='CATH-22G'),     8,  40,  60, 'CATH-22G',     'BBraun',    'Catheter tĩnh mạch ngoại vi' FROM x UNION ALL
-- h5: Khám bệnh PENDING
SELECT x.h5,(SELECT id FROM materials WHERE code='COTTON-500'),  25,  80, 120, 'COTTON-500',   'MediCotton','Tăng cường vật tư khám bệnh' FROM x UNION ALL
SELECT x.h5,(SELECT id FROM materials WHERE code='MASK-50'),     30, 100, 150, 'MASK-50',      'ProtectMed','Khẩu trang phòng khám' FROM x UNION ALL
SELECT x.h5,(SELECT id FROM materials WHERE code='GLOVE-100'),   10,  50,  80, 'GLOVE-100',    'GloveCo',   'Găng tay khám bệnh' FROM x UNION ALL
SELECT x.h5,(SELECT id FROM materials WHERE code='BANDAGE-100'),  5,  20,  35, 'BANDAGE-100',  'FirstAid Co','Băng gạc sơ cứu vết thương nhỏ' FROM x UNION ALL
-- h6: Hồi sức tích cực APPROVED
SELECT x.h6,(SELECT id FROM materials WHERE code='SYR10-100'),   12,  60,  90, 'SYR10-100',    'BBraun',    'Bơm tiêm hút thuốc hồi sức' FROM x UNION ALL
SELECT x.h6,(SELECT id FROM materials WHERE code='SYR20-100'),    8,  40,  60, 'SYR20-100',    'BBraun',    'Bơm tiêm liều lớn ICU' FROM x UNION ALL
SELECT x.h6,(SELECT id FROM materials WHERE code='CATH-20G'),    10,  50,  80, 'CATH-20G',     'BBraun',    'Catheter 20G cho BN cần tiêm tĩnh mạch' FROM x UNION ALL
SELECT x.h6,(SELECT id FROM materials WHERE code='OXYMASK-ADULT'), 5, 20,  30, 'OXYMASK-ADULT','OxyMed',    'Mặt nạ oxy thay thế hao mòn' FROM x UNION ALL
SELECT x.h6,(SELECT id FROM materials WHERE code='N95-20'),       6,  30,  48, 'N95-20',       '3M',        'Khẩu trang N95 phòng chống nhiễm khuẩn ICU' FROM x UNION ALL
-- h7: Phụ sản PENDING
SELECT x.h7,(SELECT id FROM materials WHERE code='GLOVE-SRG-7'), 10,  60, 100, 'GLOVE-SRG-7',  'Ansell',    'Găng tay phẫu thuật đỡ đẻ' FROM x UNION ALL
SELECT x.h7,(SELECT id FROM materials WHERE code='VCR-3-0'),      5,  24,  40, 'VCR-3-0',      'Ethicon',   'Chỉ khâu tầng sinh môn' FROM x UNION ALL
SELECT x.h7,(SELECT id FROM materials WHERE code='DRAPE-5'),      4,  20,  36, 'DRAPE-5',      'SurgMed',   'Tấm lót phẫu thuật sản khoa' FROM x UNION ALL
SELECT x.h7,(SELECT id FROM materials WHERE code='FOLEY-14'),    15,  60,  80, 'FOLEY-14',     'Coloplast', 'Ống thông tiểu sau sinh' FROM x UNION ALL
-- h8: Nhi APPROVED
SELECT x.h8,(SELECT id FROM materials WHERE code='COTTON-BALL'), 20,  80, 120, 'COTTON-BALL',  'MediCotton','Bông viên sát khuẩn nhi' FROM x UNION ALL
SELECT x.h8,(SELECT id FROM materials WHERE code='PREG-20'),      2,  10,  18, 'PREG-20',      'FemiTest',  'Que thử thai cho đơn vị nội trú' FROM x UNION ALL
SELECT x.h8,(SELECT id FROM materials WHERE code='BANDAGE-100'),  8,  30,  48, 'BANDAGE-100',  'FirstAid Co','Băng gạc cá nhân cho nhi' FROM x;

-- ============================================================
-- SEED: Phiếu xin lĩnh (12 header + detail)
-- ============================================================

WITH h AS (
  INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status_id, approval_by, approval_at, approval_note, note)
  VALUES
    -- i1: BHPT - APPROVED
    ((SELECT id FROM users WHERE email='canbo.bhpt@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='BHPT'),
     (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),
     NOW()-INTERVAL '10 days',
     (SELECT id FROM doc_status WHERE code='APPROVED'),
     (SELECT id FROM users WHERE email='lanhdao@gmail.com'),NOW()-INTERVAL '9 days','Phê duyệt cấp phát đầy đủ','Xin lĩnh vật tư thí nghiệm'),
    -- i2: Hóa sinh - PENDING
    ((SELECT id FROM users WHERE email='canbo.hoasinh@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Hóa sinh'),
     (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),
     NOW()-INTERVAL '2 days',
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư Hóa sinh'),
    -- i3: Vi sinh - PENDING
    ((SELECT id FROM users WHERE email='canbo.visinh@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Vi sinh'),
     (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng'),
     NOW()-INTERVAL '1 day',
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư vi sinh'),
    -- i4: Khám bệnh - PENDING
    ((SELECT id FROM users WHERE email='canbo.khambenh@gmail.com'),
     NULL,
     (SELECT id FROM departments WHERE name='Khoa khám bệnh'),
     NOW()-INTERVAL '12 hours',
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư khám bệnh'),
    -- i5: Cấp cứu - PENDING
    ((SELECT id FROM users WHERE email='canbo.capcuu@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Cấp cứu người lớn'),
     (SELECT id FROM departments WHERE name='Khoa cấp cứu'),
     NOW()-INTERVAL '6 hours',
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư cấp cứu'),
    -- i6: Dược lý - REJECTED
    ((SELECT id FROM users WHERE email='canbo.duocly@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Dược lý'),
     (SELECT id FROM departments WHERE name='Khoa dược'),
     NOW()-INTERVAL '5 days',
     (SELECT id FROM doc_status WHERE code='REJECTED'),
     (SELECT id FROM users WHERE email='lanhdao@gmail.com'),NOW()-INTERVAL '4 days','Vượt định mức','Xin lĩnh số lượng lớn'),
    -- i7: Hóa sinh - PENDING (có vật tư mới)
    ((SELECT id FROM users WHERE email='canbo.hoasinh@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Hóa sinh'),
     (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),
     NOW()-INTERVAL '1 day',
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh có vật tư mới chưa có mã'),
    -- i8: Hồi sức - APPROVED
    ((SELECT id FROM users WHERE email='canbo.hoisu@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Hồi sức nội'),
     (SELECT id FROM departments WHERE name='Khoa hồi sức tích cực'),
     NOW()-INTERVAL '7 days',
     (SELECT id FROM doc_status WHERE code='APPROVED'),
     (SELECT id FROM users WHERE email='pholanhdao@gmail.com'),NOW()-INTERVAL '6 days','Đồng ý cấp phát khẩn','Xin lĩnh khẩn vật tư ICU'),
    -- i9: Phụ sản - PENDING
    ((SELECT id FROM users WHERE email='canbo.phusan@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Sản khoa'),
     (SELECT id FROM departments WHERE name='Khoa phụ sản'),
     NOW()-INTERVAL '3 days',
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư sản khoa'),
    -- i10: Nhi - APPROVED
    ((SELECT id FROM users WHERE email='canbo.nhi@gmail.com'),
     (SELECT id FROM sub_departments WHERE name='Nhi tổng hợp'),
     (SELECT id FROM departments WHERE name='Khoa nhi'),
     NOW()-INTERVAL '8 days',
     (SELECT id FROM doc_status WHERE code='APPROVED'),
     (SELECT id FROM users WHERE email='lanhdao@gmail.com'),NOW()-INTERVAL '7 days','Phê duyệt theo kế hoạch','Xin lĩnh vật tư khoa nhi'),
    -- i11: Ngoại tổng hợp - REJECTED
    ((SELECT id FROM users WHERE email='canbo.ngoai@gmail.com'),
     NULL,
     (SELECT id FROM departments WHERE name='Khoa ngoại tổng hợp'),
     NOW()-INTERVAL '4 days',
     (SELECT id FROM doc_status WHERE code='REJECTED'),
     (SELECT id FROM users WHERE email='pholanhdao@gmail.com'),NOW()-INTERVAL '3 days','Tồn kho còn đủ, chưa cần cấp','Xin lĩnh vật tư ngoại'),
    -- i12: Mắt - PENDING
    ((SELECT id FROM users WHERE email='canbo.mat@gmail.com'),
     NULL,
     (SELECT id FROM departments WHERE name='Khoa mắt'),
     NOW()-INTERVAL '18 hours',
     (SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư khoa mắt')
  RETURNING id
),
x AS (
  SELECT
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 0)  i1,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 1)  i2,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 2)  i3,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 3)  i4,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 4)  i5,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 5)  i6,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 6)  i7,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 7)  i8,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 8)  i9,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 9)  i10,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 10) i11,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 11) i12
)
INSERT INTO issue_req_detail(
  header_id, material_id, material_name, spec, unit_id,
  qty_requested, proposed_code, proposed_manufacturer, material_category
)
SELECT v.*
FROM x
CROSS JOIN LATERAL (VALUES
  -- i1: BHPT
  (x.i1, (SELECT id FROM materials WHERE code='ETH96-500')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int, 15::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'B'::char(1)),
  (x.i1, (SELECT id FROM materials WHERE code='GLOVE-100')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int, 10::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i1, (SELECT id FROM materials WHERE code='EDTA-3ML')::int,    NULL::varchar(255), NULL::varchar(255), NULL::int, 20::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  -- i2: Hóa sinh
  (x.i2, (SELECT id FROM materials WHERE code='TUBE-10')::int,     NULL::varchar(255), NULL::varchar(255), NULL::int, 25::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'D'::char(1)),
  (x.i2, (SELECT id FROM materials WHERE code='CHEM-TEST')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'B'::char(1)),
  (x.i2, (SELECT id FROM materials WHERE code='ALCOHOL-70')::int,  NULL::varchar(255), NULL::varchar(255), NULL::int,  8::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'B'::char(1)),
  -- i3: Vi sinh
  (x.i3, (SELECT id FROM materials WHERE code='MASK-50')::int,     NULL::varchar(255), NULL::varchar(255), NULL::int, 15::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i3, (SELECT id FROM materials WHERE code='GLOVE-100')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int, 10::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  -- i4: Khám bệnh
  (x.i4, (SELECT id FROM materials WHERE code='COTTON-500')::int,  NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i4, (SELECT id FROM materials WHERE code='BANDAGE-100')::int, NULL::varchar(255), NULL::varchar(255), NULL::int,  3::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i4, (SELECT id FROM materials WHERE code='GLOVE-100')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  -- i5: Cấp cứu
  (x.i5, (SELECT id FROM materials WHERE code='SYRINGE-100')::int, NULL::varchar(255), NULL::varchar(255), NULL::int, 12::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i5, (SELECT id FROM materials WHERE code='IV-SET-50')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int,  3::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i5, (SELECT id FROM materials WHERE code='CATH-22G')::int,    NULL::varchar(255), NULL::varchar(255), NULL::int,  2::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i5, (SELECT id FROM materials WHERE code='NACL-1000')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int, 20::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'B'::char(1)),
  -- i6: Dược lý - REJECTED
  (x.i6, (SELECT id FROM materials WHERE code='PARA500-100')::int, NULL::varchar(255), NULL::varchar(255), NULL::int, 30::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  -- i7: Hóa sinh - vật tư mới
  (x.i7, NULL::int, 'Hóa chất XYZ mới'::varchar(255), 'Lọ 250ml'::varchar(255),
   (SELECT id FROM units WHERE name='Lọ')::int, 10::numeric(18,3), 'XYZ-NEW-250'::varchar(100), 'NewChem Co'::varchar(255), 'A'::char(1)),
  -- i8: Hồi sức - APPROVED
  (x.i8, (SELECT id FROM materials WHERE code='SYR10-100')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int, 10::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i8, (SELECT id FROM materials WHERE code='SYR20-100')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i8, (SELECT id FROM materials WHERE code='CATH-20G')::int,    NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i8, (SELECT id FROM materials WHERE code='OXYMASK-ADULT')::int,NULL::varchar(255),NULL::varchar(255), NULL::int,  3::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'B'::char(1)),
  -- i9: Phụ sản - PENDING
  (x.i9, (SELECT id FROM materials WHERE code='GLOVE-SRG-7')::int, NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i9, (SELECT id FROM materials WHERE code='VCR-3-0')::int,     NULL::varchar(255), NULL::varchar(255), NULL::int,  3::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i9, (SELECT id FROM materials WHERE code='FOLEY-14')::int,    NULL::varchar(255), NULL::varchar(255), NULL::int, 10::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  -- i10: Nhi - APPROVED
  (x.i10,(SELECT id FROM materials WHERE code='COTTON-BALL')::int, NULL::varchar(255), NULL::varchar(255), NULL::int, 10::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i10,(SELECT id FROM materials WHERE code='BANDAGE-100')::int, NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i10,(SELECT id FROM materials WHERE code='SYRINGE-5ML')::int, NULL::varchar(255), NULL::varchar(255), NULL::int,  8::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  -- i11: Ngoại - REJECTED
  (x.i11,(SELECT id FROM materials WHERE code='SCALPEL-3')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i11,(SELECT id FROM materials WHERE code='SILK-2-0')::int,    NULL::varchar(255), NULL::varchar(255), NULL::int,  4::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i11,(SELECT id FROM materials WHERE code='SUTURE-KIT')::int,  NULL::varchar(255), NULL::varchar(255), NULL::int,  3::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'B'::char(1)),
  -- i12: Mắt - PENDING
  (x.i12,(SELECT id FROM materials WHERE code='COTTON-BALL')::int, NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i12,(SELECT id FROM materials WHERE code='GAUZE-50')::int,    NULL::varchar(255), NULL::varchar(255), NULL::int,  3::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1))
) AS v(
  header_id, material_id, material_name, spec, unit_id,
  qty_requested, proposed_code, proposed_manufacturer, material_category
);

-- ============================================================
-- SEED: Receipt (4 phiếu nhập kho)
-- ============================================================

WITH rh AS (
  INSERT INTO receipt_header(created_by, received_from, reason, receipt_date, total_amount)
  VALUES
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),  'Công ty TNHH ABC Pharma',        'Nhập theo hợp đồng số 01/2025',       DATE '2025-01-15', 0),
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'), 'Công ty CP MediSupply',           'Nhập bổ sung Q1/2025',                DATE '2025-02-20', 0),
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),  'Công ty TNHH BBraun Vietnam',    'Nhập thiết bị xâm lấn theo hợp đồng', DATE '2025-03-10', 0),
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'), 'Công ty CP Dược phẩm Trung ương','Nhập thuốc và hóa chất Q2/2025',      DATE '2025-04-05', 0)
  RETURNING id
)
INSERT INTO receipt_detail(header_id, material_id, name, spec, code, unit_id, price, qty_doc, qty_actual, lot_number, mfg_date, exp_date, total)
SELECT rh_id, m.id, m.name, m.spec, m.code, m.unit_id, x.p, x.q, x.q, x.lot, x.mfg, x.exp, ROUND(x.p * x.q, 2)
FROM (VALUES
  -- receipt 1: Hóa chất & tiêu hao cơ bản
  (1, 'ETH96-500',   30000::NUMERIC(18,2), 200::NUMERIC(18,3), 'ETH-0125-A',  DATE '2025-01-05', DATE '2027-01-05'),
  (1, 'GLOVE-100',   85000::NUMERIC(18,2), 500::NUMERIC(18,3), 'GLO-0125-B',  DATE '2025-01-08', DATE '2026-07-08'),
  (1, 'NACL-1000',   14500::NUMERIC(18,2), 300::NUMERIC(18,3), 'NACL-0125-A', DATE '2025-01-10', DATE '2027-01-10'),
  (1, 'ALCOHOL-70',  22000::NUMERIC(18,2), 150::NUMERIC(18,3), 'ALC-0125-A',  DATE '2025-01-10', DATE '2026-10-10'),
  (1, 'MASK-50',     55000::NUMERIC(18,2), 200::NUMERIC(18,3), 'MSK-0125-A',  DATE '2025-01-12', DATE '2028-01-12'),
  (1, 'COTTON-500',  45000::NUMERIC(18,2), 100::NUMERIC(18,3), 'COT-0125-A',  DATE '2025-01-12', DATE '2028-01-12'),
  (1, 'BANDAGE-100', 38000::NUMERIC(18,2), 100::NUMERIC(18,3), 'BND-0125-A',  DATE '2025-01-13', DATE '2028-01-13'),
  -- receipt 2: Vật tư xét nghiệm & dụng cụ
  (2, 'TUBE-10',      8500::NUMERIC(18,2), 500::NUMERIC(18,3), 'TUB-0225-A',  DATE '2025-02-01', DATE '2030-01-01'),
  (2, 'TUBE-PLASTIC', 6500::NUMERIC(18,2), 400::NUMERIC(18,3), 'TBP-0225-A',  DATE '2025-02-01', DATE '2030-01-01'),
  (2, 'PIP1-100',    95000::NUMERIC(18,2), 100::NUMERIC(18,3), 'PIP-0225-A',  DATE '2025-02-05', DATE '2030-01-01'),
  (2, 'CHEM-TEST',  420000::NUMERIC(18,2),  50::NUMERIC(18,3), 'CHT-0225-A',  DATE '2025-02-10', DATE '2026-02-10'),
  (2, 'EDTA-3ML',   180000::NUMERIC(18,2), 100::NUMERIC(18,3), 'EDT-0225-A',  DATE '2025-02-12', DATE '2026-08-12'),
  (2, 'TUBE-PLAIN-5',175000::NUMERIC(18,2), 80::NUMERIC(18,3), 'TPL-0225-A',  DATE '2025-02-12', DATE '2026-08-12'),
  (2, 'URINE-10P',  320000::NUMERIC(18,2),  40::NUMERIC(18,3), 'URI-0225-A',  DATE '2025-02-15', DATE '2026-02-15'),
  (2, 'PVDI-500',    42000::NUMERIC(18,2), 120::NUMERIC(18,3), 'PVI-0225-A',  DATE '2025-02-15', DATE '2027-02-15'),
  -- receipt 3: Vật tư xâm lấn & phẫu thuật
  (3, 'SYRINGE-100',  82000::NUMERIC(18,2), 300::NUMERIC(18,3), 'SYR-0325-A', DATE '2025-03-01', DATE '2028-03-01'),
  (3, 'SYRINGE-5ML',  75000::NUMERIC(18,2), 200::NUMERIC(18,3), 'SY5-0325-A', DATE '2025-03-01', DATE '2028-03-01'),
  (3, 'SYR10-100',    78000::NUMERIC(18,2), 200::NUMERIC(18,3), 'S10-0325-A', DATE '2025-03-02', DATE '2028-03-02'),
  (3, 'SYR20-100',    82000::NUMERIC(18,2), 150::NUMERIC(18,3), 'S20-0325-A', DATE '2025-03-02', DATE '2028-03-02'),
  (3, 'CATH-22G',    750000::NUMERIC(18,2),  80::NUMERIC(18,3), 'C22-0325-A', DATE '2025-03-05', DATE '2028-03-05'),
  (3, 'CATH-20G',    780000::NUMERIC(18,2),  80::NUMERIC(18,3), 'C20-0325-A', DATE '2025-03-05', DATE '2028-03-05'),
  (3, 'IV-SET-50',   345000::NUMERIC(18,2), 100::NUMERIC(18,3), 'IVS-0325-A', DATE '2025-03-06', DATE '2028-03-06'),
  (3, 'GLOVE-SRG-7', 285000::NUMERIC(18,2),  60::NUMERIC(18,3), 'GSG-0325-A', DATE '2025-03-08', DATE '2028-03-08'),
  (3, 'SCALPEL-3',   195000::NUMERIC(18,2),  30::NUMERIC(18,3), 'SCP-0325-A', DATE '2025-03-08', DATE '2028-03-08'),
  (3, 'SILK-2-0',   1150000::NUMERIC(18,2),  20::NUMERIC(18,3), 'SLK-0325-A', DATE '2025-03-10', DATE '2028-03-10'),
  (3, 'VCR-3-0',   1250000::NUMERIC(18,2),  20::NUMERIC(18,3), 'VCR-0325-A', DATE '2025-03-10', DATE '2028-03-10'),
  (3, 'FOLEY-14',   125000::NUMERIC(18,2),  50::NUMERIC(18,3), 'FLY-0325-A', DATE '2025-03-12', DATE '2028-03-12'),
  -- receipt 4: Thuốc, hóa chất, vật tư tổng hợp
  (4, 'PARA500-100',  24000::NUMERIC(18,2), 200::NUMERIC(18,3), 'PAR-0425-A', DATE '2025-04-01', DATE '2027-04-01'),
  (4, 'GLUC-500',     16000::NUMERIC(18,2), 200::NUMERIC(18,3), 'GLC-0425-A', DATE '2025-04-01', DATE '2027-04-01'),
  (4, 'GLUCOSE-50',  285000::NUMERIC(18,2),  60::NUMERIC(18,3), 'GLU-0425-A', DATE '2025-04-03', DATE '2026-04-03'),
  (4, 'FORM-1000',    85000::NUMERIC(18,2),  40::NUMERIC(18,3), 'FRM-0425-A', DATE '2025-04-05', DATE '2027-04-05'),
  (4, 'CHLORHEX-500', 65000::NUMERIC(18,2),  80::NUMERIC(18,3), 'CHL-0425-A', DATE '2025-04-05', DATE '2027-04-05'),
  (4, 'N95-20',      248000::NUMERIC(18,2), 100::NUMERIC(18,3), 'N95-0425-A', DATE '2025-04-08', DATE '2028-04-08'),
  (4, 'GAUZE-50',     42000::NUMERIC(18,2), 150::NUMERIC(18,3), 'GAZ-0425-A', DATE '2025-04-08', DATE '2028-04-08'),
  (4, 'COTTON-BALL',  35000::NUMERIC(18,2), 200::NUMERIC(18,3), 'CTB-0425-A', DATE '2025-04-10', DATE '2028-04-10'),
  (4, 'HYDROCO-10',  450000::NUMERIC(18,2),  30::NUMERIC(18,3), 'HDC-0425-A', DATE '2025-04-10', DATE '2027-10-10'),
  (4, 'OXYMASK-ADULT',85000::NUMERIC(18,2),  40::NUMERIC(18,3), 'OXM-0425-A', DATE '2025-04-12', DATE '2028-04-12')
) AS x(rn, code, p, q, lot, mfg, exp)
JOIN (SELECT id AS rh_id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM rh) rh_ranked ON rh_ranked.rn = x.rn
JOIN materials m ON m.code = x.code;

-- Cập nhật tổng tiền cho tất cả phiếu nhập
UPDATE receipt_header r
SET total_amount = COALESCE((SELECT SUM(total) FROM receipt_detail d WHERE d.header_id = r.id), 0);

-- ============================================================
-- SEED: Inventory card (thẻ kho nhiều lô)
-- ============================================================

INSERT INTO inventory_card(material_id, unit_id, warehouse_name, record_date, opening_stock, qty_in, qty_out, supplier, lot_number, mfg_date, exp_date, sub_department_id)
SELECT m.id, m.unit_id, wh, rd, os, qi, qo, sup, lot, mfg, exp, sd
FROM (VALUES
  -- Ethanol 96% - 2 lô
  ('ETH96-500',  'Kho Hóa chất',   DATE '2025-01-15',   0, 200, 15, 'Công ty TNHH ABC Pharma',        'ETH-0125-A', DATE '2025-01-05', DATE '2027-01-05', 'BHPT'),
  ('ETH96-500',  'Kho Hóa chất',   DATE '2025-03-01',   0,  80,  5, 'Công ty TNHH ABC Pharma',        'ETH-0325-B', DATE '2025-03-01', DATE '2027-03-01', 'BHPT'),
  -- NaCl 0.9% - 2 lô
  ('NACL-1000',  'Kho Dịch truyền',DATE '2025-01-15',   0, 300, 25, 'IVCo',                           'NACL-0125-A',DATE '2025-01-10', DATE '2027-01-10', 'Kho chính'),
  ('NACL-1000',  'Kho Dịch truyền',DATE '2025-04-01',   0, 150, 10, 'IVCo',                           'NACL-0425-B',DATE '2025-04-01', DATE '2027-04-01', 'Kho chính'),
  -- Glucoza 5%
  ('GLUC-500',   'Kho Dịch truyền',DATE '2025-04-05',   0, 200, 20, 'IVCo',                           'GLC-0425-A', DATE '2025-04-01', DATE '2027-04-01', 'Kho chính'),
  -- Cồn 70 độ
  ('ALCOHOL-70', 'Kho Hóa chất',   DATE '2025-01-15',   0, 150, 20, 'Công ty TNHH ABC Pharma',        'ALC-0125-A', DATE '2025-01-10', DATE '2026-10-10', 'BHPT'),
  -- Găng tay y tế - 2 lô
  ('GLOVE-100',  'Kho Vật tư',     DATE '2025-01-15',   0, 500, 35, 'GloveCo',                        'GLO-0125-B', DATE '2025-01-08', DATE '2026-07-08', 'Kho chính'),
  ('GLOVE-100',  'Kho Vật tư',     DATE '2025-03-15',   0, 200, 10, 'GloveCo',                        'GLO-0325-C', DATE '2025-03-10', DATE '2026-09-10', 'Kho chính'),
  -- Khẩu trang y tế
  ('MASK-50',    'Kho Vật tư',     DATE '2025-01-15',   0, 200, 18, 'ProtectMed',                     'MSK-0125-A', DATE '2025-01-12', DATE '2028-01-12', 'Kho chính'),
  -- Khẩu trang N95
  ('N95-20',     'Kho Vật tư',     DATE '2025-04-08',   0, 100,  5, '3M',                             'N95-0425-A', DATE '2025-04-08', DATE '2028-04-08', 'Kho chính'),
  -- Kim tiêm vô trùng
  ('SYRINGE-100','Kho Vật tư',     DATE '2025-03-10',   0, 300, 40, 'MediNeedle',                     'SYR-0325-A', DATE '2025-03-01', DATE '2028-03-01', 'Kho chính'),
  -- Bơm tiêm 5ml
  ('SYRINGE-5ML','Kho Vật tư',     DATE '2025-03-10',   0, 200, 25, 'MediNeedle',                     'SY5-0325-A', DATE '2025-03-01', DATE '2028-03-01', 'Kho chính'),
  -- Bơm tiêm 10ml
  ('SYR10-100',  'Kho Vật tư',     DATE '2025-03-10',   0, 200, 12, 'BBraun',                         'S10-0325-A', DATE '2025-03-02', DATE '2028-03-02', 'Kho chính'),
  -- Bơm tiêm 20ml
  ('SYR20-100',  'Kho Vật tư',     DATE '2025-03-10',   0, 150,  8, 'BBraun',                         'S20-0325-A', DATE '2025-03-02', DATE '2028-03-02', 'Kho chính'),
  -- Catheter 22G
  ('CATH-22G',   'Kho Vật tư',     DATE '2025-03-10',   0,  80, 10, 'BBraun',                         'C22-0325-A', DATE '2025-03-05', DATE '2028-03-05', 'Kho chính'),
  -- Catheter 20G
  ('CATH-20G',   'Kho Vật tư',     DATE '2025-03-10',   0,  80,  8, 'BBraun',                         'C20-0325-A', DATE '2025-03-05', DATE '2028-03-05', 'Kho chính'),
  -- Dây truyền dịch
  ('IV-SET-50',  'Kho Vật tư',     DATE '2025-03-10',   0, 100, 12, 'MediSet',                        'IVS-0325-A', DATE '2025-03-06', DATE '2028-03-06', 'Kho chính'),
  -- Ống hút máu EDTA
  ('EDTA-3ML',   'Kho XN',         DATE '2025-02-20',   0, 100, 20, 'VacuTech',                       'EDT-0225-A', DATE '2025-02-12', DATE '2026-08-12', 'Hóa sinh'),
  -- Ống hút máu thường
  ('TUBE-PLAIN-5','Kho XN',        DATE '2025-02-20',   0,  80, 15, 'VacuTech',                       'TPL-0225-A', DATE '2025-02-12', DATE '2026-08-12', 'Hóa sinh'),
  -- Hóa chất xét nghiệm
  ('CHEM-TEST',  'Kho XN',         DATE '2025-02-20',   0,  50, 12, 'LabChem',                        'CHT-0225-A', DATE '2025-02-10', DATE '2026-02-10', 'Hóa sinh'),
  -- Que thử nước tiểu
  ('URINE-10P',  'Kho XN',         DATE '2025-02-20',   0,  40,  6, 'Analyticon',                     'URI-0225-A', DATE '2025-02-15', DATE '2026-02-15', 'Hóa sinh'),
  -- Ống nghiệm thủy tinh
  ('TUBE-10',    'Kho XN',         DATE '2025-02-20',   0, 500, 50, 'LabGlass',                       'TUB-0225-A', DATE '2025-02-01', DATE '2030-01-01', 'Hóa sinh'),
  -- Ống nghiệm plastic
  ('TUBE-PLASTIC','Kho XN',        DATE '2025-02-20',   0, 400, 30, 'LabPlastic',                     'TBP-0225-A', DATE '2025-02-01', DATE '2030-01-01', 'BHPT'),
  -- Paracetamol
  ('PARA500-100','Kho Dược',       DATE '2025-04-05',   0, 200, 15, 'MediPharm',                      'PAR-0425-A', DATE '2025-04-01', DATE '2027-04-01', 'Dược lý'),
  -- Bông y tế
  ('COTTON-500', 'Kho Vật tư',     DATE '2025-01-15',   0, 100, 10, 'MediCotton',                     'COT-0125-A', DATE '2025-01-12', DATE '2028-01-12', 'Kho chính'),
  -- Bông viên
  ('COTTON-BALL','Kho Vật tư',     DATE '2025-04-10',   0, 200, 15, 'MediCotton',                     'CTB-0425-A', DATE '2025-04-10', DATE '2028-04-10', 'Kho chính'),
  -- Gạc vô trùng
  ('GAUZE-50',   'Kho Vật tư',     DATE '2025-04-08',   0, 150, 18, 'MediGauze',                      'GAZ-0425-A', DATE '2025-04-08', DATE '2028-04-08', 'Kho chính'),
  -- Băng gạc
  ('BANDAGE-100','Kho Vật tư',     DATE '2025-01-15',   0, 100,  8, 'FirstAid Co',                    'BND-0125-A', DATE '2025-01-13', DATE '2028-01-13', 'Kho chính'),
  -- Povidone Iodine
  ('PVDI-500',   'Kho Hóa chất',   DATE '2025-02-20',   0, 120, 15, 'MediPharm',                      'PVI-0225-A', DATE '2025-02-15', DATE '2027-02-15', 'Kho chính'),
  -- Chlorhexidine
  ('CHLORHEX-500','Kho Hóa chất',  DATE '2025-04-05',   0,  80,  8, 'MölnlyckeVN',                    'CHL-0425-A', DATE '2025-04-05', DATE '2027-04-05', 'Kho chính'),
  -- Formalin
  ('FORM-1000',  'Kho Hóa chất',   DATE '2025-04-05',   0,  40,  4, 'LabChem',                        'FRM-0425-A', DATE '2025-04-05', DATE '2027-04-05', 'Vi sinh'),
  -- Que thử đường huyết
  ('GLUCOSE-50', 'Kho Dược',       DATE '2025-04-03',   0,  60,  8, 'DiabTest',                       'GLU-0425-A', DATE '2025-04-03', DATE '2026-04-03', 'Dược lý'),
  -- Chỉ khâu Silk
  ('SILK-2-0',   'Kho Vật tư PT',  DATE '2025-03-10',   0,  20,  3, 'SutureKo',                       'SLK-0325-A', DATE '2025-03-10', DATE '2028-03-10', 'Kho chính'),
  -- Chỉ khâu Vicryl
  ('VCR-3-0',    'Kho Vật tư PT',  DATE '2025-03-10',   0,  20,  2, 'Ethicon',                        'VCR-0325-A', DATE '2025-03-10', DATE '2028-03-10', 'Kho chính'),
  -- Găng tay phẫu thuật
  ('GLOVE-SRG-7','Kho Vật tư PT',  DATE '2025-03-08',   0,  60,  8, 'Ansell',                         'GSG-0325-A', DATE '2025-03-08', DATE '2028-03-08', 'Kho chính'),
  -- Dao mổ
  ('SCALPEL-3',  'Kho Vật tư PT',  DATE '2025-03-08',   0,  30,  4, 'SurgMed',                        'SCP-0325-A', DATE '2025-03-08', DATE '2028-03-08', 'Kho chính'),
  -- Ống thông tiểu
  ('FOLEY-14',   'Kho Vật tư',     DATE '2025-03-12',   0,  50,  6, 'Coloplast',                      'FLY-0325-A', DATE '2025-03-12', DATE '2028-03-12', 'Kho chính'),
  -- Mặt nạ oxy
  ('OXYMASK-ADULT','Kho Vật tư',   DATE '2025-04-12',   0,  40,  5, 'OxyMed',                         'OXM-0425-A', DATE '2025-04-12', DATE '2028-04-12', 'Kho chính'),
  -- Băng Hydrocolloid
  ('HYDROCO-10', 'Kho Vật tư',     DATE '2025-04-10',   0,  30,  3, 'ConvaTec',                       'HDC-0425-A', DATE '2025-04-10', DATE '2027-10-10', 'Kho chính'),
  -- Ống pipet
  ('PIP1-100',   'Kho XN',         DATE '2025-02-20',   0, 100, 10, 'LabMate',                        'PIP-0225-A', DATE '2025-02-05', DATE '2030-01-01', 'Hóa sinh')
) AS d(code, wh, rd, os, qi, qo, sup, lot, mfg, exp, sd_name)
JOIN materials m ON m.code = d.code
LEFT JOIN sub_departments sd ON sd.name = d.sd_name;

-- ============================================================
-- SEED: Phiếu xuất kho (từ phiếu xin lĩnh đã APPROVED)
-- ============================================================

WITH ih AS (
  INSERT INTO issue_header(created_by, issue_req_id, receiver_name, department_id, issue_date, total_amount)
  VALUES
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),
     (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.bhpt@gmail.com' LIMIT 1),
     'CB Bộ môn BHPT',
     (SELECT id FROM departments WHERE name='Khoa xét nghiệm'),
     DATE '2025-04-22', 0),
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),
     (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.hoisu@gmail.com' LIMIT 1),
     'CB Hồi sức tích cực',
     (SELECT id FROM departments WHERE name='Khoa hồi sức tích cực'),
     DATE '2025-04-25', 0),
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'),
     (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.nhi@gmail.com' LIMIT 1),
     'CB Khoa Nhi',
     (SELECT id FROM departments WHERE name='Khoa nhi'),
     DATE '2025-04-26', 0)
  RETURNING id
),
ih_arr AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM ih
)
INSERT INTO issue_detail(header_id, material_id, name, spec, code, unit_id, unit_price, qty_requested, qty_issued, total)
SELECT ih_arr.id, m.id, m.name, m.spec, m.code, m.unit_id, x.price, x.qty_req, x.qty_iss, ROUND(x.price * x.qty_iss, 2)
FROM (VALUES
  (1, 'ETH96-500',    30000::NUMERIC(18,2), 15::NUMERIC(18,3), 15::NUMERIC(18,3)),
  (1, 'GLOVE-100',    85000::NUMERIC(18,2), 10::NUMERIC(18,3), 10::NUMERIC(18,3)),
  (1, 'EDTA-3ML',    180000::NUMERIC(18,2), 20::NUMERIC(18,3), 20::NUMERIC(18,3)),
  (2, 'SYR10-100',    78000::NUMERIC(18,2), 10::NUMERIC(18,3), 10::NUMERIC(18,3)),
  (2, 'SYR20-100',    82000::NUMERIC(18,2),  5::NUMERIC(18,3),  5::NUMERIC(18,3)),
  (2, 'CATH-20G',    780000::NUMERIC(18,2),  5::NUMERIC(18,3),  5::NUMERIC(18,3)),
  (2, 'OXYMASK-ADULT',85000::NUMERIC(18,2),  3::NUMERIC(18,3),  3::NUMERIC(18,3)),
  (3, 'COTTON-BALL',  35000::NUMERIC(18,2), 10::NUMERIC(18,3), 10::NUMERIC(18,3)),
  (3, 'BANDAGE-100',  38000::NUMERIC(18,2),  5::NUMERIC(18,3),  5::NUMERIC(18,3)),
  (3, 'SYRINGE-5ML',  75000::NUMERIC(18,2),  8::NUMERIC(18,3),  8::NUMERIC(18,3))
) AS x(rn, code, price, qty_req, qty_iss)
JOIN ih_arr ON ih_arr.rn = x.rn
JOIN materials m ON m.code = x.code;

UPDATE issue_header ih
SET total_amount = COALESCE((SELECT SUM(total) FROM issue_detail d WHERE d.header_id = ih.id), 0);

-- ============================================================
-- SEED: Notifications
-- ============================================================

-- Thông báo 1: Hóa sinh xin lĩnh - PENDING -> lãnh đạo
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='ISSUE_REQ'),
  (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.hoasinh@gmail.com' AND irh.status_id=(SELECT id FROM doc_status WHERE code='PENDING') ORDER BY irh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='PENDING'),
  'Phiếu xin lĩnh Hóa sinh chờ phê duyệt',
  'Cán bộ Hóa sinh vừa tạo phiếu xin lĩnh vật tư. Vui lòng xem xét và phê duyệt.',
  NOW() - INTERVAL '2 days',
  (SELECT id FROM users WHERE email='canbo.hoasinh@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, FALSE, NULL
FROM users u WHERE u.email IN ('lanhdao@gmail.com','pholanhdao@gmail.com');

-- Thông báo 2: Vi sinh xin lĩnh - PENDING -> lãnh đạo
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='ISSUE_REQ'),
  (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.visinh@gmail.com' ORDER BY irh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='PENDING'),
  'Phiếu xin lĩnh Vi sinh chờ phê duyệt',
  'Cán bộ Vi sinh vừa tạo phiếu xin lĩnh vật tư thực hành.',
  NOW() - INTERVAL '1 day',
  (SELECT id FROM users WHERE email='canbo.visinh@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, FALSE, NULL
FROM users u WHERE u.email IN ('lanhdao@gmail.com','pholanhdao@gmail.com');

-- Thông báo 3: BHPT phiếu xin lĩnh đã duyệt -> thủ kho (đã đọc)
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='ISSUE_REQ'),
  (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.bhpt@gmail.com' ORDER BY irh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='APPROVED'),
  'Phiếu xin lĩnh đã được phê duyệt',
  'Phiếu xin lĩnh vật tư của bộ môn BHPT đã được lãnh đạo phê duyệt. Vui lòng đến kho nhận hàng.',
  NOW() - INTERVAL '9 days',
  (SELECT id FROM users WHERE email='lanhdao@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, TRUE, NOW() - INTERVAL '8 days'
FROM users u WHERE u.email IN ('thukho@gmail.com','canbo.bhpt@gmail.com');

-- Thông báo 4: Dự trù bổ sung PENDING -> BGH
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='SUPP_FORECAST'),
  (SELECT sfh.id FROM supp_forecast_header sfh WHERE sfh.status_id=(SELECT id FROM doc_status WHERE code='PENDING') ORDER BY sfh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='PENDING'),
  'Phiếu dự trù bổ sung chờ BGH phê duyệt',
  'Thủ kho vừa tạo phiếu dự trù bổ sung vật tư. Kính mời BGH xem xét phê duyệt.',
  NOW() - INTERVAL '3 days',
  (SELECT id FROM users WHERE email='thukho@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, FALSE, NULL
FROM users u WHERE u.email IN ('hieutruong@gmail.com','phohieutruong1@gmail.com','phohieutruong2@gmail.com');

-- Thông báo 5: Dự trù XN đã duyệt -> thủ kho (đã đọc)
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='SUPP_FORECAST'),
  (SELECT sfh.id FROM supp_forecast_header sfh WHERE sfh.status_id=(SELECT id FROM doc_status WHERE code='APPROVED') ORDER BY sfh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='APPROVED'),
  'Phiếu dự trù bổ sung Khoa XN đã được duyệt',
  'BGH đã phê duyệt phiếu dự trù bổ sung vật tư Khoa Xét nghiệm năm học 2025-2026.',
  NOW() - INTERVAL '15 days',
  (SELECT id FROM users WHERE email='hieutruong@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, TRUE, NOW() - INTERVAL '14 days'
FROM users u WHERE u.email IN ('thukho@gmail.com','thukho2@gmail.com');

-- Thông báo 6: Dược lý bị từ chối -> cán bộ + lãnh đạo (đã đọc)
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='ISSUE_REQ'),
  (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.duocly@gmail.com' ORDER BY irh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='REJECTED'),
  'Phiếu xin lĩnh bị từ chối',
  'Phiếu xin lĩnh của CB Dược lý đã bị từ chối. Lý do: Vượt định mức quy định. Vui lòng điều chỉnh và tạo lại.',
  NOW() - INTERVAL '4 days',
  (SELECT id FROM users WHERE email='lanhdao@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, TRUE, NOW() - INTERVAL '3 days'
FROM users u WHERE u.email IN ('canbo.duocly@gmail.com','thukho@gmail.com');

-- Thông báo 7: Cấp cứu xin lĩnh khẩn - PENDING -> lãnh đạo
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='ISSUE_REQ'),
  (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.capcuu@gmail.com' ORDER BY irh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='PENDING'),
  'Phiếu xin lĩnh khẩn Khoa Cấp cứu',
  'Khoa Cấp cứu xin lĩnh vật tư khẩn cấp. Đề nghị ưu tiên phê duyệt sớm.',
  NOW() - INTERVAL '6 hours',
  (SELECT id FROM users WHERE email='canbo.capcuu@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, FALSE, NULL
FROM users u WHERE u.email IN ('lanhdao@gmail.com','pholanhdao@gmail.com');

-- Thông báo 8: Dự trù ICU đã duyệt -> thủ kho (đã đọc)
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='SUPP_FORECAST'),
  (SELECT sfh.id FROM supp_forecast_header sfh WHERE sfh.department_id=(SELECT id FROM departments WHERE name='Khoa hồi sức tích cực') LIMIT 1),
  (SELECT id FROM notification_events WHERE code='APPROVED'),
  'Phiếu dự trù Khoa Hồi sức đã được duyệt',
  'BGH đã phê duyệt phiếu dự trù bổ sung vật tư Khoa Hồi sức tích cực. Thủ kho tiến hành lên kế hoạch mua sắm.',
  NOW() - INTERVAL '20 days',
  (SELECT id FROM users WHERE email='hieutruong@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, TRUE, NOW() - INTERVAL '19 days'
FROM users u WHERE u.email IN ('thukho@gmail.com','thukho2@gmail.com');

-- Thông báo 9: Hồi sức đã duyệt phiếu xin lĩnh -> thủ kho + cán bộ
INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
VALUES (
  (SELECT id FROM notification_entities WHERE code='ISSUE_REQ'),
  (SELECT irh.id FROM issue_req_header irh JOIN users u ON u.id=irh.created_by WHERE u.email='canbo.hoisu@gmail.com' ORDER BY irh.id LIMIT 1),
  (SELECT id FROM notification_events WHERE code='APPROVED'),
  'Phiếu xin lĩnh ICU đã được phê duyệt',
  'Phiếu xin lĩnh khẩn vật tư Khoa Hồi sức tích cực đã được phê duyệt. Đến kho nhận hàng.',
  NOW() - INTERVAL '6 days',
  (SELECT id FROM users WHERE email='pholanhdao@gmail.com')
);
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT MAX(id) FROM notifications), u.id, TRUE, NOW() - INTERVAL '5 days'
FROM users u WHERE u.email IN ('thukho@gmail.com','canbo.hoisu@gmail.com');

COMMIT;
