-- =========================
-- CƠ SỞ DỮ LIỆU MEDVENTORY_HMU
-- =========================

-- 0) Đơn vị và bộ môn
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL               -- vd: 'Khoa Dược'
);

CREATE TABLE sub_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                     -- vd: 'BHPT', 'Dược lý'
    department_id INT REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE (name, department_id)
);

-- 1) Bảng đơn vị tính (chuẩn hóa)
CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL                -- 'chai', 'lọ', 'hộp 5 vỉ',...
);

-- 2) Người dùng
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    department_id INT REFERENCES departments(id),   -- Đơn vị (Đối với cán bộ)
    role VARCHAR(50) CHECK (role IN ('admin','lanhdao','thukho','canbo')) NOT NULL DEFAULT 'canbo',
    status VARCHAR(20) CHECK (status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3) Danh mục hàng hóa/vật tư
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,                     -- Tên vật tư / hóa chất
    spec VARCHAR(255) NOT NULL,                     -- Quy cách đóng gói
    unit_id INT REFERENCES units(id) NOT NULL,      -- Đơn vị tính 
    code VARCHAR(100) NOT NULL,                     -- Mã/Code
    manufacturer VARCHAR(255) NOT NULL,             -- Hãng sản xuất
    category CHAR(1) CHECK (category IN ('A','B','C','D')), -- A/B/C/D
    UNIQUE (name, COALESCE(spec,''), COALESCE(manufacturer,''))
);

-- 4) Phiếu xin lĩnh hàng hóa (Đơn vị -> xin cấp)
CREATE TABLE issue_req_header (
    id SERIAL PRIMARY KEY,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    sub_department_id INT REFERENCES sub_departments(id),     -- bộ môn sử dụng
    department_id INT REFERENCES departments(id),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
    approval_by INT REFERENCES users(id) ON DELETE SET NULL,  -- lãnh đạo phê duyệt
    approval_at TIMESTAMP,
    approval_note TEXT,
    note TEXT
);

CREATE TABLE issue_req_detail (
    id SERIAL PRIMARY KEY,
    header_id INT REFERENCES issue_req_header(id) ON DELETE CASCADE,

    material_id INT REFERENCES materials(id),

    -- fallback nếu là hàng chưa có trong danh mục chuẩn
    material_name VARCHAR(255),
    spec VARCHAR(255),
    unit_id INT REFERENCES units(id),

    qty_requested NUMERIC(18,3) NOT NULL CHECK (qty_requested > 0),

    proposed_code VARCHAR(100),
    proposed_manufacturer VARCHAR(255),

    CHECK (
        (material_id IS NOT NULL)
        OR (material_name IS NOT NULL AND unit_id IS NOT NULL)
    )
);

-- 5) Dự trù bổ sung hàng hóa 
CREATE TABLE supp_forecast_header (
    id SERIAL PRIMARY KEY,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at DATE DEFAULT CURRENT_DATE,
    academic_year VARCHAR(20),                                -- '2025-2026'
    department_id INT REFERENCES departments(id),
    status VARCHAR(20) CHECK (status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
    approval_by INT REFERENCES users(id) ON DELETE SET NULL,
    approval_at TIMESTAMP,
    approval_note TEXT
);

CREATE TABLE supp_forecast_detail (
    id SERIAL PRIMARY KEY,
    header_id INT REFERENCES supp_forecast_header(id) ON DELETE CASCADE,
    material_id INT REFERENCES materials(id),

    -- Tên vật tư 
    -- Quy cách đóng gói
    -- Đơn vị tính 
    -- => Lấy từ bảng materials

    current_stock NUMERIC(18,3) DEFAULT 0, 
    prev_year_qty NUMERIC(18,3) DEFAULT 0,
    this_year_qty NUMERIC(18,3) NOT NULL,

    proposed_code VARCHAR(100),
    proposed_manufacturer VARCHAR(255),
    justification TEXT
);

-- 6) Bảng tổng hợp danh mục hàng hóa (nhu cầu theo đơn vị)
CREATE TABLE catalog_summary_header (
    id SERIAL PRIMARY KEY,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at DATE DEFAULT CURRENT_DATE
);

CREATE TABLE catalog_summary_detail (
    id SERIAL PRIMARY KEY,
    header_id INT REFERENCES catalog_summary_header(id) ON DELETE CASCADE,

    category CHAR(1) CHECK (category IN ('A','B','C','D')) NOT NULL,
    material_id INT REFERENCES materials(id),

    -- 4 trường dưới lấy từ bảng materials 
    display_name VARCHAR(255),
    display_spec VARCHAR(255),
    unit_id INT REFERENCES units(id),
    qty NUMERIC(18,3) NOT NULL CHECK (qty > 0),

    sub_department_id INT REFERENCES sub_departments(id),
    note TEXT
);

-- 7) Phiếu nhập kho 
CREATE TABLE receipt_header (
    id SERIAL PRIMARY KEY,
    created_by INT REFERENCES users(id),              -- thủ kho lập
    received_from VARCHAR(255),                       -- người giao hàng
    reason TEXT,                                      -- lý do nhập
    receipt_date DATE DEFAULT CURRENT_DATE,
    total_amount NUMERIC(18,2)                        -- tổng số tiền hàng
);

CREATE TABLE receipt_detail (
    id SERIAL PRIMARY KEY,
    header_id INT REFERENCES receipt_header(id) ON DELETE CASCADE,
    material_id INT REFERENCES materials(id),
    
    -- Lấy từ bảng materials
    name VARCHAR(255),          
    spec VARCHAR(255),
    code VARCHAR(100),

    unit_id INT REFERENCES units(id),
    price NUMERIC(18,2),         -- đơn giá
    qty_doc NUMERIC(18,3),       -- số lượng theo chứng từ
    qty_actual NUMERIC(18,3),    -- số lượng thực nhập

    lot_number VARCHAR(100),
    mfg_date DATE,
    exp_date DATE,

    total NUMERIC(18,2)
);

-- 😎 Phiếu xuất kho (cấp phát)
CREATE TABLE issue_header (
    id SERIAL PRIMARY KEY,
    created_by INT REFERENCES users(id),              -- thủ kho lập
    receiver_name VARCHAR(255),                       -- người nhận
    department_id INT REFERENCES departments(id),     -- đơn vị nhận
    issue_date DATE DEFAULT CURRENT_DATE,
    total_amount NUMERIC(18,2)
);

CREATE TABLE issue_detail (
    id SERIAL PRIMARY KEY,
    header_id INT REFERENCES issue_header(id) ON DELETE CASCADE,
    material_id INT REFERENCES materials(id),
    
    -- Lấy từ bảng materials
    name VARCHAR(255),
    spec VARCHAR(255),
    code VARCHAR(100),

    unit_id INT REFERENCES units(id),
    unit_price NUMERIC(18,2),

    qty_requested NUMERIC(18,3),
    qty_issued NUMERIC(18,3),

    total NUMERIC(18,2)
);

-- 9) Thẻ kho (theo dõi tồn theo từng lô / từng thời điểm)
CREATE TABLE inventory_card (
    id SERIAL PRIMARY KEY,
    material_id INT REFERENCES materials(id),
    unit_id INT REFERENCES units(id),

    warehouse_name VARCHAR(255),
    record_date DATE DEFAULT CURRENT_DATE,

    opening_stock NUMERIC(18,3) DEFAULT 0,
    qty_in NUMERIC(18,3) DEFAULT 0,
    qty_out NUMERIC(18,3) DEFAULT 0,
    closing_stock NUMERIC(18,3)
        GENERATED ALWAYS AS (opening_stock + qty_in - qty_out) STORED,

    supplier VARCHAR(255),
    lot_number VARCHAR(100),
    mfg_date DATE,
    exp_date DATE,

    sub_department_id INT REFERENCES sub_departments(id)   -- nơi nhận / nơi sử dụng
);

-- Indexes đề xuất
CREATE INDEX idx_subdep_dept                      ON sub_departments(department_id);
CREATE INDEX idx_issue_req_header_dept            ON issue_req_header(department_id);
CREATE INDEX idx_issue_req_header_status          ON issue_req_header(status);
CREATE INDEX idx_supp_forecast_header_dept        ON supp_forecast_header(department_id);
CREATE INDEX idx_supp_forecast_header_status      ON supp_forecast_header(status);
CREATE INDEX idx_catalog_summary_detail_subdep    ON catalog_summary_detail(sub_department_id);
CREATE INDEX idx_inventory_material               ON inventory_card(material_id);
CREATE INDEX idx_materials_code                   ON materials(code);
