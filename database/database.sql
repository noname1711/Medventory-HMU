-- ============================================
-- MEDVENTORY_HMU - RESET & SEED (PostgreSQL)
-- Safe to rerun: drops schema and recreates all
-- ============================================

BEGIN;

-- 0) RESET SCHEMA
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SET search_path TO public;

-- 1) MASTER DATA
CREATE TABLE departments (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE sub_departments (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    department_id  INT REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE (name, department_id)
);

CREATE TABLE units (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- 2) USERS
CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL,
    password       VARCHAR(100) NOT NULL,
    date_of_birth  DATE,
    department_id  INT REFERENCES departments(id),
    role           VARCHAR(50) CHECK (role IN ('lanhdao','thukho','canbo')) NOT NULL DEFAULT 'canbo',
    status         VARCHAR(20) CHECK (status IN ('pending','approved')) NOT NULL DEFAULT 'pending'
);

-- 3) MATERIALS CATALOG
CREATE TABLE materials (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    spec          VARCHAR(255) NOT NULL,
    unit_id       INT REFERENCES units(id) NOT NULL,
    code          VARCHAR(100) NOT NULL,
    manufacturer  VARCHAR(255) NOT NULL,
    category      CHAR(1) CHECK (category IN ('A','B','C','D')) NOT NULL,
    UNIQUE (code),
    UNIQUE (name, spec, manufacturer)
);

-- 4) ISSUE REQUEST (Đơn vị xin lĩnh)
CREATE TABLE issue_req_header (
    id                SERIAL PRIMARY KEY,
    created_by        INT REFERENCES users(id) ON DELETE SET NULL,
    sub_department_id INT REFERENCES sub_departments(id),
    department_id     INT REFERENCES departments(id),
    requested_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status            VARCHAR(20) CHECK (status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
    approval_by       INT REFERENCES users(id) ON DELETE SET NULL,
    approval_at       TIMESTAMP,
    approval_note     TEXT,
    note              TEXT
);

CREATE TABLE issue_req_detail (
    id                 SERIAL PRIMARY KEY,
    header_id          INT REFERENCES issue_req_header(id) ON DELETE CASCADE,

    material_id        INT REFERENCES materials(id),

    -- fallback nếu đồ chưa có trong danh mục
    material_name      VARCHAR(255),
    spec               VARCHAR(255),
    unit_id            INT REFERENCES units(id),

    qty_requested      NUMERIC(18,3) NOT NULL CHECK (qty_requested > 0),

    proposed_code         VARCHAR(100),
    proposed_manufacturer VARCHAR(255),

    CHECK (
        (material_id IS NOT NULL)
        OR (material_name IS NOT NULL AND unit_id IS NOT NULL)
    )
);

-- 5) SUPPLEMENT FORECAST (Dự trù bổ sung)
CREATE TABLE supp_forecast_header (
    id             SERIAL PRIMARY KEY,
    created_by     INT REFERENCES users(id) ON DELETE SET NULL,
    created_at     DATE DEFAULT CURRENT_DATE,
    academic_year  VARCHAR(20),
    department_id  INT REFERENCES departments(id),
    status         VARCHAR(20) CHECK (status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
    approval_by    INT REFERENCES users(id) ON DELETE SET NULL,
    approval_at    TIMESTAMP,
    approval_note  TEXT
);

CREATE TABLE supp_forecast_detail (
    id                 SERIAL PRIMARY KEY,
    header_id          INT REFERENCES supp_forecast_header(id) ON DELETE CASCADE,
    material_id        INT REFERENCES materials(id),

    current_stock      NUMERIC(18,3) DEFAULT 0,
    prev_year_qty      NUMERIC(18,3) DEFAULT 0,
    this_year_qty      NUMERIC(18,3) NOT NULL,
    proposed_code         VARCHAR(100),
    proposed_manufacturer VARCHAR(255),
    justification      TEXT
);

-- 6) CATALOG SUMMARY (tổng hợp nhu cầu theo đơn vị)
CREATE TABLE catalog_summary_header (
    id          SERIAL PRIMARY KEY,
    created_by  INT REFERENCES users(id) ON DELETE SET NULL,
    created_at  DATE DEFAULT CURRENT_DATE
);

CREATE TABLE catalog_summary_detail (
    id                 SERIAL PRIMARY KEY,
    header_id          INT REFERENCES catalog_summary_header(id) ON DELETE CASCADE,

    category           CHAR(1) CHECK (category IN ('A','B','C','D')) NOT NULL,
    material_id        INT REFERENCES materials(id),

    display_name       VARCHAR(255),
    display_spec       VARCHAR(255),
    unit_id            INT REFERENCES units(id),
    qty                NUMERIC(18,3) NOT NULL CHECK (qty > 0),

    sub_department_id  INT REFERENCES sub_departments(id),
    note               TEXT
);

-- 7) RECEIPT (Phiếu nhập kho)
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
    header_id   INT REFERENCES receipt_header(id) ON DELETE CASCADE,
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

-- 8) ISSUE (Phiếu xuất kho)
CREATE TABLE issue_header (
    id             SERIAL PRIMARY KEY,
    created_by     INT REFERENCES users(id),
    receiver_name  VARCHAR(255),
    department_id  INT REFERENCES departments(id),
    issue_date     DATE DEFAULT CURRENT_DATE,
    total_amount   NUMERIC(18,2)
);

CREATE TABLE issue_detail (
    id            SERIAL PRIMARY KEY,
    header_id     INT REFERENCES issue_header(id) ON DELETE CASCADE,
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

-- 9) INVENTORY CARD (Thẻ kho theo lô)
CREATE TABLE inventory_card (
    id             SERIAL PRIMARY KEY,
    material_id    INT REFERENCES materials(id),
    unit_id        INT REFERENCES units(id),

    warehouse_name VARCHAR(255),
    record_date    DATE DEFAULT CURRENT_DATE,

    opening_stock  NUMERIC(18,3) DEFAULT 0,
    qty_in         NUMERIC(18,3) DEFAULT 0,
    qty_out        NUMERIC(18,3) DEFAULT 0,
    closing_stock  NUMERIC(18,3)
        GENERATED ALWAYS AS (opening_stock + qty_in - qty_out) STORED,

    supplier       VARCHAR(255),
    lot_number     VARCHAR(100),
    mfg_date       DATE,
    exp_date       DATE,

    sub_department_id INT REFERENCES sub_departments(id)
);

-- INDEXES
CREATE INDEX idx_subdep_dept                      ON sub_departments(department_id);
CREATE INDEX idx_issue_req_header_dept            ON issue_req_header(department_id);
CREATE INDEX idx_issue_req_header_status          ON issue_req_header(status);
CREATE INDEX idx_supp_forecast_header_dept        ON supp_forecast_header(department_id);
CREATE INDEX idx_supp_forecast_header_status      ON supp_forecast_header(status);
CREATE INDEX idx_catalog_summary_detail_subdep    ON catalog_summary_detail(sub_department_id);
CREATE INDEX idx_inventory_material               ON inventory_card(material_id);
CREATE INDEX idx_materials_code                   ON materials(code);

-- ============================================
-- SEED DATA
-- ============================================

-- Departments
INSERT INTO departments(name) VALUES
('Khoa Dược'),
('Khoa Hóa học'),
('Khoa Điều dưỡng'),
('Khoa Sinh học'),
('Khoa Vật tư');

-- Sub-departments
INSERT INTO sub_departments(name, department_id) VALUES
('Dược lý',   (SELECT id FROM departments WHERE name='Khoa Dược')),
('Hóa sinh',  (SELECT id FROM departments WHERE name='Khoa Hóa học')),
('BHPT',      (SELECT id FROM departments WHERE name='Khoa Hóa học')),
('Vi sinh',   (SELECT id FROM departments WHERE name='Khoa Sinh học')),
('Vật tư 1',  (SELECT id FROM departments WHERE name='Khoa Vật tư'));

-- Units
INSERT INTO units(name) VALUES
('chai'),('lọ'),('hộp'),('cái'),('ml'),('g'),('viên'),('kg'),('bộ');

-- Users (3+ tài khoản)
INSERT INTO users(full_name, email, password, department_id, role, status) VALUES
('Admin System',        'admin',               '12345', NULL,                                                'lanhdao',   'approved'),
('Lãnh Đạo Khoa Dược',  'lanhdao@gmail.com',    '12345', (SELECT id FROM departments WHERE name='Khoa Dược'), 'lanhdao', 'approved'),
('Thủ Kho Hóa học',     'thukho@gmail.com',   '12345', (SELECT id FROM departments WHERE name='Khoa Hóa học'),'thukho',  'approved'),
('CB Bộ môn BHPT',      'canbo.bhpt@gmail.com',      '12345', (SELECT id FROM departments WHERE name='Khoa Hóa học'),'canbo',   'pending'),
('CB Hóa sinh',         'canbo.hoasinh@gmail.com',   '12345', (SELECT id FROM departments WHERE name='Khoa Hóa học'),'canbo',   'pending');

-- Materials
INSERT INTO materials(name, spec, unit_id, code, manufacturer, category) VALUES
('Ethanol 96%',            'Chai 500 ml',           (SELECT id FROM units WHERE name='chai'), 'ETH96-500',   'ABC Pharma',  'B'),
('Găng tay y tế',          'Hộp 100 chiếc',         (SELECT id FROM units WHERE name='hộp'),  'GLOVE-100',   'GloveCo',     'C'),
('Ống nghiệm thủy tinh',   '10 ml',                 (SELECT id FROM units WHERE name='cái'),  'TUBE-10',     'LabGlass',    'D'),
('Paracetamol 500mg',      'Hộp 10 vỉ x 10 viên',   (SELECT id FROM units WHERE name='hộp'),  'PARA500-100', 'MediPharm',   'A'),
('NaCl 0.9%',              'Chai 1000 ml',          (SELECT id FROM units WHERE name='chai'), 'NACL-1000',   'IVCo',        'B'),
('Khẩu trang y tế',        'Hộp 50 cái',            (SELECT id FROM units WHERE name='hộp'),  'MASK-50',     'ProtectMed',  'C'),
('Glucoza 5%',             'Chai 500 ml',           (SELECT id FROM units WHERE name='chai'), 'GLUC-500',    'IVCo',        'B'),
('Ống pipet 1ml',          'Bộ 100 cái',            (SELECT id FROM units WHERE name='bộ'),   'PIP1-100',    'LabMate',     'D');

-- Supplement forecast (2 headers, nhiều dòng)
INSERT INTO supp_forecast_header(created_by, academic_year, department_id, status, approval_by, approval_at, approval_note)
VALUES
((SELECT id FROM users WHERE email='thukho.hoahoc@hmu'), '2025-2026',
 (SELECT id FROM departments WHERE name='Khoa Hóa học'),
 'approved', (SELECT id FROM users WHERE email='lanhdao.duoc@hmu'), NOW(), 'Đồng ý theo đề xuất'),
((SELECT id FROM users WHERE email='thukho.hoahoc@hmu'), '2025-2026',
 (SELECT id FROM departments WHERE name='Khoa Hóa học'),
 'pending',  NULL, NULL, NULL);

INSERT INTO supp_forecast_detail(header_id, material_id, current_stock, prev_year_qty, this_year_qty, proposed_code, proposed_manufacturer, justification)
SELECT h1.id, m.id, cs, py, ty, m.code, m.manufacturer, j
FROM (
  SELECT 10 cs, 50 py, 80 ty, 'Bổ sung phục vụ thực hành' j, 'ETH96-500' code
  UNION ALL SELECT 20,120,150,'Tăng nhu cầu thực hành',     'GLOVE-100'
  UNION ALL SELECT 50,200,250,'Thay thế hao hụt/vỡ',        'TUBE-10'
) x
JOIN materials m ON m.code = x.code
JOIN supp_forecast_header h1 ON h1.status = 'approved' AND h1.department_id = (SELECT id FROM departments WHERE name='Khoa Hóa học');

-- Issue request (approved) + details
INSERT INTO issue_req_header(created_by, sub_department_id, department_id, requested_at, status, approval_by, approval_at, approval_note, note)
VALUES
((SELECT id FROM users WHERE email='canbo.bhpt@hmu'),
 (SELECT id FROM sub_departments WHERE name='BHPT'),
 (SELECT id FROM departments WHERE name='Khoa Hóa học'),
 NOW(), 'approved',
 (SELECT id FROM users WHERE email='lanhdao.duoc@hmu'),
 NOW(), 'Phê duyệt cấp phát', 'Xin lĩnh vật tư thí nghiệm');

INSERT INTO issue_req_detail(header_id, material_id, qty_requested)
SELECT h.id, m.id, q
FROM (VALUES ('ETH96-500',15), ('GLOVE-100',10), ('MASK-50',5)) v(code,q)
JOIN materials m ON m.code=v.code
JOIN issue_req_header h ON h.status='approved'
ORDER BY m.id;

-- Receipt (1 header, nhiều dòng)
INSERT INTO receipt_header(created_by, received_from, reason, receipt_date, total_amount)
VALUES
((SELECT id FROM users WHERE email='thukho.hoahoc@hmu'),
 'Công ty Vật tư Khoa học ABC', 'Nhập theo hợp đồng 01/2025', CURRENT_DATE, 0);

INSERT INTO receipt_detail(header_id, material_id, name, spec, code, unit_id, price, qty_doc, qty_actual, lot_number, mfg_date, exp_date, total)
SELECT h.id, m.id, m.name, m.spec, m.code, m.unit_id,
       p, q, q, lot, mfg, exp, p*q
FROM (
  SELECT 'ETH96-500' code, 120000::NUMERIC(18,2) p, 100::NUMERIC(18,3) q, 'ETH-0125-A' lot, DATE '2025-01-10' mfg, DATE '2027-01-10' exp
  UNION ALL SELECT 'GLOVE-100', 80000,  200, 'GLO-0125-B',  '2025-01-15', '2026-01-15'
  UNION ALL SELECT 'MASK-50',   50000,  150, 'MSK-0125-C',  '2025-01-20', '2026-01-20'
) x
JOIN materials m ON m.code=x.code
JOIN receipt_header h ON h.receipt_date=CURRENT_DATE;

-- Update total_amount for receipt
UPDATE receipt_header rh
SET total_amount = COALESCE((
    SELECT SUM(total) FROM receipt_detail rd WHERE rd.header_id = rh.id
),0)
WHERE rh.id IN (SELECT id FROM receipt_header);

-- Issue (1 header, nhiều dòng)
INSERT INTO issue_header(created_by, receiver_name, department_id, issue_date, total_amount)
VALUES
((SELECT id FROM users WHERE email='thukho.hoahoc@hmu'),
 'Bộ môn BHPT', (SELECT id FROM departments WHERE name='Khoa Hóa học'),
 CURRENT_DATE, 0);

INSERT INTO issue_detail(header_id, material_id, name, spec, code, unit_id, unit_price, qty_requested, qty_issued, total)
SELECT h.id, m.id, m.name, m.spec, m.code, m.unit_id,
       p, qr, qi, p*qi
FROM (
  SELECT 'ETH96-500' code, 120000::NUMERIC(18,2) p, 10::NUMERIC(18,3) qr, 10::NUMERIC(18,3) qi
  UNION ALL SELECT 'GLOVE-100', 80000, 20, 20
  UNION ALL SELECT 'MASK-50',   50000,  5,  5
) x
JOIN materials m ON m.code=x.code
JOIN issue_header h ON h.issue_date=CURRENT_DATE;

-- Update total_amount for issue
UPDATE issue_header ih
SET total_amount = COALESCE((
  SELECT SUM(total) FROM issue_detail idt WHERE idt.header_id = ih.id
),0)
WHERE ih.id IN (SELECT id FROM issue_header);

-- Inventory cards (ví dụ)
INSERT INTO inventory_card(material_id, unit_id, warehouse_name, record_date, opening_stock, qty_in, qty_out, supplier, lot_number, mfg_date, exp_date, sub_department_id)
SELECT m.id, m.unit_id, 'Kho Hóa chất', CURRENT_DATE, 0, 100, 10, 'Cty ABC', 'ETH-0125-A', '2025-01-10', '2027-01-10',
       (SELECT id FROM sub_departments WHERE name='BHPT')
FROM materials m WHERE m.code='ETH96-500';

COMMIT;

-- Done.

select * from departments
