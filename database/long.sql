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

-- 4) Dự trù bổ sung hàng hóa 
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