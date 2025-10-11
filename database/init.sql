-- Tạo database
CREATE DATABASE medventoryhmu
WITH ENCODING 'UTF8'
TEMPLATE = template0;

-- Kết nối đến database
\c medventoryhmu;

-- Tạo bảng users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    birthday DATE NOT NULL,
    job VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('lanhdao', 'thukho', 'canbo')),
    priority INT GENERATED ALWAYS AS (
        CASE 
            WHEN role = 'lanhdao' THEN 1
            WHEN role = 'thukho' THEN 2
            WHEN role = 'canbo' THEN 3
            ELSE NULL
        END
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Tạo index
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Insert admin account (mật khẩu: 12345)
INSERT INTO users (full_name, birthday, job, email, password, role) 
VALUES (
    'Administrator', 
    '1990-01-01', 
    'Quản trị hệ thống', 
    'admin', 
    '$2a$10$ABCDE12345FGHIJ67890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', 
    'lanhdao'
);

-- Insert sample user (mật khẩu: 123456)
INSERT INTO users (full_name, birthday, job, email, password, role) 
VALUES (
    'Nguyễn Văn A', 
    '1985-05-15', 
    'Khoa xét nghiệm', 
    'nguyenvana@gmail.com', 
    '$2a$10$ABCDE12345FGHIJ67890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', 
    'thukho'
);