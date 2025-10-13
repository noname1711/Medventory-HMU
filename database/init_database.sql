-- Tạo database
CREATE DATABASE medventory_hmu;

-- Kết nối đến database vừa tạo
\c medventory_hmu;

-- Tạo bảng users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    department VARCHAR(150),
    role VARCHAR(50) NOT NULL DEFAULT 'canbo',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chèn tài khoản admin mặc định
INSERT INTO users (full_name, email, password, role, status, priority) 
VALUES 
('Admin System', 'admin', '12345', 'admin', 'approved', 0),
('Lãnh Đạo Khoa A', 'lanhdao@gmail.com', '12345', 'lanhdao', 'approved', 1),
('Thủ Kho B', 'thukho@gmail.com', '12345', 'thukho', 'approved', 2);

-- Chèn một số user demo đang chờ duyệt
INSERT INTO users (full_name, email, password, date_of_birth, department, role, status, priority) 
VALUES 
('Nguyễn Văn A', 'nguyenvana@gmail.com', '12345', '1990-05-15', 'Khoa xét nghiệm', 'canbo', 'pending', 3),
('Trần Thị B', 'tranthib@gmail.com', '12345', '1985-08-20', 'Khoa phục hồi chức năng', 'thukho', 'pending', 2),
('Lê Văn C', 'levanc@gmail.com', '12345', '1992-12-10', 'Khoa gây mê hồi sức và chống đau', 'lanhdao', 'pending', 1),
('Phạm Thị D', 'phamthid@gmail.com', '12345', '1988-03-25', 'Khoa cấp cứu', 'canbo', 'approved', 3),
('Hoàng Văn E', 'hoangvane@gmail.com', '12345', '1995-07-30', 'Khoa mắt', 'canbo', 'rejected', 3);

-- Tạo indexes cho hiệu suất
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);

-- Kiểm tra dữ liệu
SELECT * FROM users ORDER BY priority, status;

-- Xem thống kê
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 2) as percentage
FROM users 
GROUP BY status 
ORDER BY count DESC;