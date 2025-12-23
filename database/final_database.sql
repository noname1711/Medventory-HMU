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
  entity_id      INT NOT NULL,
  event_type_id  INT NOT NULL REFERENCES notification_events(id),

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
('Dược lý',  (SELECT id FROM departments WHERE name='Khoa dược')),
('Hóa sinh', (SELECT id FROM departments WHERE name='Khoa xét nghiệm')),
('BHPT',     (SELECT id FROM departments WHERE name='Khoa xét nghiệm')),
('Vi sinh',  (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng')),
('Kho chính',(SELECT id FROM departments WHERE name='Quản trị vật tư'));

INSERT INTO units(name) VALUES
('chai'),('lọ'),('hộp'),('cái'),('ml'),('g'),('viên'),('kg'),('bộ');

-- ============================================================
-- SEED: USERS
-- ============================================================

INSERT INTO users(full_name, email, password, department_id, role_id, job_title, status_id) VALUES
('Trưởng phòng QTVT', 'lanhdao@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), (SELECT id FROM roles WHERE code='LANH_DAO'), 'Trưởng phòng Quản trị vật tư', (SELECT id FROM user_status WHERE code='APPROVED')),
('Phó phòng QTVT', 'pholanhdao@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), (SELECT id FROM roles WHERE code='LANH_DAO'), 'Phó phòng Quản trị vật tư', (SELECT id FROM user_status WHERE code='APPROVED')),
('Thủ Kho Chính', 'thukho@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), (SELECT id FROM roles WHERE code='THU_KHO'), 'Thủ kho chính', (SELECT id FROM user_status WHERE code='APPROVED')),
('Thủ Kho Phụ', 'thukho2@gmail.com', '12345', (SELECT id FROM departments WHERE name='Quản trị vật tư'), (SELECT id FROM roles WHERE code='THU_KHO'), 'Thủ kho phụ', (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Bộ môn BHPT', 'canbo.bhpt@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), (SELECT id FROM roles WHERE code='CAN_BO'), 'Cán bộ Bộ môn BHPT', (SELECT id FROM user_status WHERE code='PENDING')),
('CB Hóa sinh', 'canbo.hoasinh@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa xét nghiệm'), (SELECT id FROM roles WHERE code='CAN_BO'), 'Cán bộ Hóa sinh', (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Vi sinh', 'canbo.visinh@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng'), (SELECT id FROM roles WHERE code='CAN_BO'), 'Cán bộ Vi sinh', (SELECT id FROM user_status WHERE code='PENDING')),
('CB Dược lý', 'canbo.duocly@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa dược'), (SELECT id FROM roles WHERE code='CAN_BO'), 'Cán bộ Dược lý', (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Khám bệnh', 'canbo.khambenh@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa khám bệnh'), (SELECT id FROM roles WHERE code='CAN_BO'), 'Cán bộ Khám bệnh', (SELECT id FROM user_status WHERE code='APPROVED')),
('CB Cấp cứu', 'canbo.capcuu@gmail.com', '12345', (SELECT id FROM departments WHERE name='Khoa cấp cứu'), (SELECT id FROM roles WHERE code='CAN_BO'), 'Cán bộ Cấp cứu', (SELECT id FROM user_status WHERE code='PENDING')),
('GS. TS. BS. Nguyễn Hữu Tú', 'hieutruong@gmail.com', '12345', NULL, (SELECT id FROM roles WHERE code='BGH'), 'Hiệu trưởng', (SELECT id FROM user_status WHERE code='APPROVED')),
('PGS. TS. BS. Kim Bảo Giang', 'phohieutruong1@gmail.com', '12345', NULL, (SELECT id FROM roles WHERE code='BGH'), 'Phó Hiệu trưởng', (SELECT id FROM user_status WHERE code='APPROVED')),
('PGS. TS. BS. Hồ Thị Kim Thanh', 'phohieutruong2@gmail.com', '12345', NULL, (SELECT id FROM roles WHERE code='BGH'), 'Phó Hiệu trưởng', (SELECT id FROM user_status WHERE code='APPROVED')),
('PGS. TS. BS. Lê Đình Tùng', 'phohieutruong3@gmail.com', '12345', NULL, (SELECT id FROM roles WHERE code='BGH'), 'Phó Hiệu trưởng', (SELECT id FROM user_status WHERE code='APPROVED')),
('TS. Phạm Xuân Thắng', 'phohieutruong4@gmail.com', '12345', NULL, (SELECT id FROM roles WHERE code='BGH'), 'Phó Hiệu trưởng', (SELECT id FROM user_status WHERE code='APPROVED'));

-- ============================================================
-- SEED: MATERIALS
-- ============================================================

INSERT INTO materials(name, spec, unit_id, code, manufacturer, category) VALUES
('Ethanol 96%','Chai 500 ml',(SELECT id FROM units WHERE name='chai'),'ETH96-500','ABC Pharma','B'),
('Găng tay y tế','Hộp 100 chiếc',(SELECT id FROM units WHERE name='hộp'),'GLOVE-100','GloveCo','C'),
('Ống nghiệm thủy tinh','10 ml',(SELECT id FROM units WHERE name='cái'),'TUBE-10','LabGlass','D'),
('Paracetamol 500mg','Hộp 10 vỉ x 10 viên',(SELECT id FROM units WHERE name='hộp'),'PARA500-100','MediPharm','A'),
('NaCl 0.9%','Chai 1000 ml',(SELECT id FROM units WHERE name='chai'),'NACL-1000','IVCo','B'),
('Khẩu trang y tế','Hộp 50 cái',(SELECT id FROM units WHERE name='hộp'),'MASK-50','ProtectMed','C'),
('Glucoza 5%','Chai 500 ml',(SELECT id FROM units WHERE name='chai'),'GLUC-500','IVCo','B'),
('Ống pipet 1ml','Bộ 100 cái',(SELECT id FROM units WHERE name='bộ'),'PIP1-100','LabMate','D'),
('Bông y tế vô trùng','Hộp 500g',(SELECT id FROM units WHERE name='hộp'),'COTTON-500','MediCotton','C'),
('Băng gạc cá nhân','Hộp 100 cái',(SELECT id FROM units WHERE name='hộp'),'BANDAGE-100','FirstAid Co','C'),
('Cồn 70 độ','Chai 500 ml',(SELECT id FROM units WHERE name='chai'),'ALCOHOL-70','ABC Pharma','B'),
('Kim tiêm vô trùng','Hộp 100 cái',(SELECT id FROM units WHERE name='hộp'),'SYRINGE-100','MediNeedle','A'),
('Gạc vô trùng','Hộp 50 miếng',(SELECT id FROM units WHERE name='hộp'),'GAUZE-50','MediGauze','C'),
('Bơm kim tiêm 5ml','Hộp 50 cái',(SELECT id FROM units WHERE name='hộp'),'SYRINGE-5ML','MediNeedle','A'),
('Hóa chất xét nghiệm','Lọ 100ml',(SELECT id FROM units WHERE name='lọ'),'CHEM-TEST','LabChem','B'),
('Ống nghiệm plastic','Hộp 200 cái',(SELECT id FROM units WHERE name='hộp'),'TUBE-PLASTIC','LabPlastic','D');

-- ============================================================
-- SEED: Dự trù (5 header + detail)
-- ============================================================

WITH h AS (
  INSERT INTO supp_forecast_header(created_by, academic_year, department_id, status_id, approval_by, approval_at, approval_note)
  VALUES
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',(SELECT id FROM departments WHERE name='Khoa xét nghiệm'),(SELECT id FROM doc_status WHERE code='APPROVED'),(SELECT id FROM users WHERE email='hieutruong@gmail.com'),NOW(),'Đồng ý theo đề xuất'),
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',(SELECT id FROM departments WHERE name='Khoa xét nghiệm'),(SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL),
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'),'2025-2026',(SELECT id FROM departments WHERE name='Khoa dược'),(SELECT id FROM doc_status WHERE code='APPROVED'),(SELECT id FROM users WHERE email='phohieutruong1@gmail.com'),NOW(),'Phê duyệt đủ số lượng'),
    ((SELECT id FROM users WHERE email='thukho@gmail.com'),'2025-2026',(SELECT id FROM departments WHERE name='Khoa cấp cứu'),(SELECT id FROM doc_status WHERE code='REJECTED'),(SELECT id FROM users WHERE email='phohieutruong2@gmail.com'),NOW(),'Cần điều chỉnh giảm số lượng'),
    ((SELECT id FROM users WHERE email='thukho2@gmail.com'),'2025-2026',(SELECT id FROM departments WHERE name='Khoa khám bệnh'),(SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL)
  RETURNING id
),
x AS (
  SELECT
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 0) h1,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 1) h2,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 2) h3,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 3) h4,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 4) h5
)
INSERT INTO supp_forecast_detail(header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification)
SELECT x.h1, (SELECT id FROM materials WHERE code='ETH96-500'), 10, 50, 80, 'ETH96-500','ABC Pharma','Bổ sung phục vụ thực hành' FROM x
UNION ALL SELECT x.h1, (SELECT id FROM materials WHERE code='GLOVE-100'), 20, 120, 150, 'GLOVE-100','GloveCo','Tăng nhu cầu thực hành' FROM x
UNION ALL SELECT x.h1, (SELECT id FROM materials WHERE code='TUBE-10'), 50, 200, 250, 'TUBE-10','LabGlass','Thay thế hao hụt/vỡ' FROM x
UNION ALL SELECT x.h2, (SELECT id FROM materials WHERE code='PIP1-100'), 30, 100, 150, 'PIP1-100','LabMate','Bổ sung dụng cụ thí nghiệm' FROM x
UNION ALL SELECT x.h2, (SELECT id FROM materials WHERE code='CHEM-TEST'), 5, 20, 40, 'CHEM-TEST','LabChem','Tăng cường hóa chất xét nghiệm' FROM x
UNION ALL SELECT x.h3, (SELECT id FROM materials WHERE code='PARA500-100'), 15, 60, 90, 'PARA500-100','MediPharm','Dự trù cho nghiên cứu dược lý' FROM x
UNION ALL SELECT x.h3, (SELECT id FROM materials WHERE code='NACL-1000'), 25, 80, 120, 'NACL-1000','IVCo','Dung dịch truyền nghiên cứu' FROM x
UNION ALL SELECT x.h3, (SELECT id FROM materials WHERE code='SYRINGE-100'), 40, 150, 200, 'SYRINGE-100','MediNeedle','Kim tiêm thí nghiệm' FROM x
UNION ALL SELECT x.h4, (SELECT id FROM materials WHERE code='ALCOHOL-70'), 5, 40, 60, 'ALCOHOL-70','ABC Pharma','Dự phòng cho trường hợp khẩn cấp' FROM x
UNION ALL SELECT x.h4, (SELECT id FROM materials WHERE code='MASK-50'), 20, 60, 100, 'MASK-50','ProtectMed','Khẩu trang y tế' FROM x
UNION ALL SELECT x.h5, (SELECT id FROM materials WHERE code='COTTON-500'), 25, 80, 120, 'COTTON-500','MediCotton','Tăng cường vật tư khám bệnh' FROM x;

-- ============================================================
-- SEED: Phiếu xin lĩnh (7 header + detail)
-- FIX CHỐT: dùng VALUES + ép kiểu để không còn lỗi UNION type mismatch
-- ============================================================

WITH h AS (
  INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status_id, approval_by, approval_at, approval_note, note)
  VALUES
    ((SELECT id FROM users WHERE email='canbo.bhpt@gmail.com'),(SELECT id FROM sub_departments WHERE name='BHPT'),(SELECT id FROM departments WHERE name='Khoa xét nghiệm'),NOW()-INTERVAL '3 days',(SELECT id FROM doc_status WHERE code='APPROVED'),(SELECT id FROM users WHERE email='lanhdao@gmail.com'),NOW()-INTERVAL '2 days','Phê duyệt cấp phát đầy đủ','Xin lĩnh vật tư thí nghiệm'),
    ((SELECT id FROM users WHERE email='canbo.hoasinh@gmail.com'),(SELECT id FROM sub_departments WHERE name='Hóa sinh'),(SELECT id FROM departments WHERE name='Khoa xét nghiệm'),NOW()-INTERVAL '2 days',(SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư Hóa sinh'),
    ((SELECT id FROM users WHERE email='canbo.visinh@gmail.com'),(SELECT id FROM sub_departments WHERE name='Vi sinh'),(SELECT id FROM departments WHERE name='Khoa vi sinh - ký sinh trùng'),NOW()-INTERVAL '1 day',(SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư vi sinh'),
    ((SELECT id FROM users WHERE email='canbo.khambenh@gmail.com'),NULL,(SELECT id FROM departments WHERE name='Khoa khám bệnh'),NOW()-INTERVAL '12 hours',(SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư khám bệnh'),
    ((SELECT id FROM users WHERE email='canbo.capcuu@gmail.com'),NULL,(SELECT id FROM departments WHERE name='Khoa cấp cứu'),NOW()-INTERVAL '6 hours',(SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh vật tư cấp cứu'),
    ((SELECT id FROM users WHERE email='canbo.duocly@gmail.com'),(SELECT id FROM sub_departments WHERE name='Dược lý'),(SELECT id FROM departments WHERE name='Khoa dược'),NOW()-INTERVAL '5 days',(SELECT id FROM doc_status WHERE code='REJECTED'),(SELECT id FROM users WHERE email='lanhdao@gmail.com'),NOW()-INTERVAL '4 days','Vượt định mức','Xin lĩnh số lượng lớn'),
    ((SELECT id FROM users WHERE email='canbo.hoasinh@gmail.com'),(SELECT id FROM sub_departments WHERE name='Hóa sinh'),(SELECT id FROM departments WHERE name='Khoa xét nghiệm'),NOW()-INTERVAL '1 day',(SELECT id FROM doc_status WHERE code='PENDING'),NULL,NULL,NULL,'Xin lĩnh có vật tư mới')
  RETURNING id
),
x AS (
  SELECT
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 0) i1,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 1) i2,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 2) i3,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 3) i4,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 4) i5,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 5) i6,
    (SELECT id FROM h ORDER BY id LIMIT 1 OFFSET 6) i7
)
INSERT INTO issue_req_detail(
  header_id, material_id, material_name, spec, unit_id,
  qty_requested, proposed_code, proposed_manufacturer, material_category
)
SELECT v.*
FROM x
CROSS JOIN LATERAL (VALUES
  (x.i1, (SELECT id FROM materials WHERE code='ETH96-500')::int, NULL::varchar(255), NULL::varchar(255), NULL::int, 15::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'B'::char(1)),
  (x.i1, (SELECT id FROM materials WHERE code='GLOVE-100')::int, NULL::varchar(255), NULL::varchar(255), NULL::int, 10::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i2, (SELECT id FROM materials WHERE code='TUBE-10')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int, 25::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'D'::char(1)),
  (x.i3, (SELECT id FROM materials WHERE code='MASK-50')::int,   NULL::varchar(255), NULL::varchar(255), NULL::int, 15::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i4, (SELECT id FROM materials WHERE code='COTTON-500')::int, NULL::varchar(255), NULL::varchar(255), NULL::int,  5::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'C'::char(1)),
  (x.i5, (SELECT id FROM materials WHERE code='SYRINGE-100')::int,NULL::varchar(255), NULL::varchar(255), NULL::int, 12::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i6, (SELECT id FROM materials WHERE code='PARA500-100')::int, NULL::varchar(255), NULL::varchar(255), NULL::int, 30::numeric(18,3), NULL::varchar(100), NULL::varchar(255), 'A'::char(1)),
  (x.i7, NULL::int, 'Hóa chất XYZ mới'::varchar(255), 'Lọ 250ml'::varchar(255), (SELECT id FROM units WHERE name='lọ')::int, 10::numeric(18,3), 'XYZ-NEW-250'::varchar(100), 'NewChem Co'::varchar(255), 'A'::char(1))
) AS v(
  header_id, material_id, material_name, spec, unit_id,
  qty_requested, proposed_code, proposed_manufacturer, material_category
);

-- ============================================================
-- SEED: Receipt + details (tối thiểu)
-- ============================================================

WITH rh AS (
  INSERT INTO receipt_header(created_by, received_from, reason, receipt_date, total_amount)
  VALUES ((SELECT id FROM users WHERE email='thukho@gmail.com'),'Cty ABC','Nhập hợp đồng 01/2025',CURRENT_DATE,0)
  RETURNING id
)
INSERT INTO receipt_detail(header_id, material_id, name, spec, code, unit_id, price, qty_doc, qty_actual, lot_number, mfg_date, exp_date, total)
SELECT rh.id, m.id, m.name, m.spec, m.code, m.unit_id, x.p, x.q, x.q, x.lot, x.mfg, x.exp, x.p*x.q
FROM rh
JOIN (VALUES
  ('ETH96-500',120000::NUMERIC(18,2),100::NUMERIC(18,3),'ETH-0125-A',DATE '2025-01-10',DATE '2027-01-10'),
  ('GLOVE-100', 80000::NUMERIC(18,2),200::NUMERIC(18,3),'GLO-0125-B',DATE '2025-01-15',DATE '2026-01-15')
) AS x(code,p,q,lot,mfg,exp) ON TRUE
JOIN materials m ON m.code=x.code;

UPDATE receipt_header r
SET total_amount = COALESCE((SELECT SUM(total) FROM receipt_detail d WHERE d.header_id=r.id),0)
WHERE r.id = (SELECT id FROM receipt_header ORDER BY id DESC LIMIT 1);

-- ============================================================
-- SEED: Inventory card (tối thiểu 1 dòng)
-- ============================================================

INSERT INTO inventory_card(material_id, unit_id, warehouse_name, record_date, opening_stock, qty_in, qty_out, supplier, lot_number, mfg_date, exp_date, sub_department_id)
SELECT m.id, m.unit_id, 'Kho Hóa chất', CURRENT_DATE, 0, 100, 10, 'Cty ABC', 'ETH-0125-A', DATE '2025-01-10', DATE '2027-01-10',
       (SELECT id FROM sub_departments WHERE name='BHPT')
FROM materials m WHERE m.code='ETH96-500';

-- ============================================================
-- SEED: Notifications (1 thông báo mẫu -> 1 người nhận)
-- ============================================================

WITH leader AS (
  SELECT id AS user_id FROM users WHERE email='lanhdao@gmail.com'
),
pending_issue AS (
  SELECT id, created_by FROM issue_req_header
  WHERE status_id = (SELECT id FROM doc_status WHERE code='PENDING')
  ORDER BY requested_at
  LIMIT 1
),
n AS (
  INSERT INTO notifications(entity_type_id, entity_id, event_type_id, title, content, created_at, created_by)
  SELECT
    (SELECT id FROM notification_entities WHERE code='ISSUE_REQ'),
    (SELECT id FROM pending_issue),
    (SELECT id FROM notification_events WHERE code='PENDING'),
    'Phiếu xin lĩnh mới cần phê duyệt',
    'Có phiếu xin lĩnh #'||(SELECT id FROM pending_issue)||' cần phê duyệt',
    NOW() - INTERVAL '6 hours',
    (SELECT created_by FROM pending_issue)
  RETURNING id
)
INSERT INTO notification_recipients(notification_id, user_id, is_read, read_at)
SELECT (SELECT id FROM n), (SELECT user_id FROM leader), FALSE, NULL;

COMMIT;
