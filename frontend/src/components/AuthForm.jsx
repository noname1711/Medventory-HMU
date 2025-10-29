import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./AuthForm.css";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // THÊM STATE CHO CÁC TRƯỜNG ĐĂNG KÝ
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");

  const navigate = useNavigate();
  
  const passwordTimeoutRef = useRef(null);
  const confirmPasswordTimeoutRef = useRef(null);

  // Danh sách phân khoa HMU
  const departments = [
    "Khoa xét nghiệm",
    "Khoa phục hồi chức năng",
    "Khoa gây mê hồi sức và chống đau",
    "Khoa cấp cứu",
    "Khoa mắt",
    "Khoa ngoại tim mạch và lồng ngực",
    "Khoa ngoại tiết niệu",
    "Khoa dược",
    "Khoa hồi sức tích cực",
    "Khoa khám chữa bệnh theo yêu cầu",
    "Khoa giải phẫu bệnh",
    "Khoa nội thần kinh",
    "Khoa vi sinh - ký sinh trùng",
    "Khoa nội tổng hợp",
    "Khoa dinh dưỡng và tiết chế",
    "Khoa phẫu thuật tạo hình thẩm mỹ",
    "Khoa hô hấp",
    "Khoa kiểm soát nhiễm khuẩn",
    "Khoa thăm dò chức năng",
    "Khoa phụ sản",
    "Khoa nam học và y học giới tính",
    "Khoa ngoại tổng hợp",
    "Khoa nhi",
    "Khoa ngoại thần kinh - cột sống",
    "Khoa dị ứng - miễn dịch lâm sàng",
    "Khoa nội tiết",
    "Khoa huyết học và truyền máu",
    "Khoa y học cổ truyền",
    "Khoa răng hàm mặt",
    "Khoa chấn thương chỉnh hình và y học thể thao",
    "Khoa khám bệnh",
    "Khoa nội thận - tiết niệu",
    "Khoa bệnh nhiệt đới và can thiệp giảm hại"
  ];

  // Clear timeout khi component unmount
  useEffect(() => {
    return () => {
      if (passwordTimeoutRef.current) {
        clearTimeout(passwordTimeoutRef.current);
      }
      if (confirmPasswordTimeoutRef.current) {
        clearTimeout(confirmPasswordTimeoutRef.current);
      }
    };
  }, []);

  // Reset form khi chuyển tab
  const resetForm = () => {
    setFullName("");
    setDateOfBirth("");
    setDepartment("");
    setRole("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Kiểm tra email hợp lệ
    if (!email.endsWith("@gmail.com") && email !== "admin") {
      toast.error("Vui lòng dùng email @gmail.com để đăng nhập/đăng ký!");
      return;
    }

    // Kiểm tra xác nhận mật khẩu khi đăng ký
    if (!isLogin && password !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    // Kiểm tra các trường bắt buộc khi đăng ký
    if (!isLogin && (!fullName || !dateOfBirth || !department || !role)) {
      toast.error("Vui lòng điền đầy đủ thông tin đăng ký!");
      return;
    }

    try {
      if (isLogin) {
        // Đăng nhập
        const response = await fetch('http://localhost:8080/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (data.success) {
          toast.success(data.message);
          if (data.user) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
          }
          if (email === "admin") {
            setTimeout(() => navigate("/admin"), 800);
          } else {
            setTimeout(() => navigate("/dashboard"), 800);
          }
        } else {
          toast.error(data.message);
        }
      } else {
        // Đăng ký - SỬ DỤNG STATE THAY VÌ QUERYSELECTOR
        const registerData = {
          fullName,
          email,
          password,
          confirmPassword,
          dateOfBirth,
          department,
          role,
        };

        console.log("Register data:", registerData); // Debug

        const response = await fetch('http://localhost:8080/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registerData),
        });

        const data = await response.json();

        if (data.success) {
          toast.success(data.message);
          setIsLogin(true);
          // Reset toàn bộ form
          setEmail("");
          setPassword("");
          resetForm();
        } else {
          toast.error(data.message);
        }
      }
    } catch (error) {
      toast.error("Lỗi kết nối đến server!");
    }
  };

  const togglePasswordVisibility = () => {
    // Clear existing timeout
    if (passwordTimeoutRef.current) {
      clearTimeout(passwordTimeoutRef.current);
    }

    const newShowPassword = !showPassword;
    setShowPassword(newShowPassword);

    // Nếu đang bật hiện mật khẩu, set timeout để tắt sau 3 giây
    if (newShowPassword) {
      passwordTimeoutRef.current = setTimeout(() => {
        setShowPassword(false);
      }, 3000);
    }
  };

  const toggleConfirmPasswordVisibility = () => {
    // Clear existing timeout
    if (confirmPasswordTimeoutRef.current) {
      clearTimeout(confirmPasswordTimeoutRef.current);
    }

    const newShowConfirmPassword = !showConfirmPassword;
    setShowConfirmPassword(newShowConfirmPassword);

    // Nếu đang bật hiện mật khẩu, set timeout để tắt sau 3 giây
    if (newShowConfirmPassword) {
      confirmPasswordTimeoutRef.current = setTimeout(() => {
        setShowConfirmPassword(false);
      }, 3000);
    }
  };

  const handleTabChange = (isLoginTab) => {
    setIsLogin(isLoginTab);
    if (isLoginTab) {
      resetForm();
    }
  };

  return (
    <div className="auth-page">
      <div className="demo-badge">Medventory-HMU</div>

      <div className="auth-wrapper">
        <div className="auth-header">
          <div className="logo-circle">
            <img src="/logo.jpg" alt="HMU Logo" className="logo-img" />
          </div>
          <h1>HMU Medical</h1>
          <p>Hệ thống quản lý vật tư y tế</p>
          <p className="sub">Bệnh viện Đại học Y Hà Nội</p>
        </div>

        <div className="form-container">
          <div className="tabs">
            <button
              className={isLogin ? "tab active" : "tab"}
              onClick={() => handleTabChange(true)}
            >
              Đăng nhập
            </button>
            <button
              className={!isLogin ? "tab active" : "tab"}
              onClick={() => handleTabChange(false)}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <>
                <input 
                  type="text" 
                  placeholder="Họ và tên" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                />

                <div className="grid-2">
                  <input 
                    type="date" 
                    placeholder="Ngày sinh" 
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required 
                  />
                  <select 
                    required 
                    className="department-select"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">Phòng ban</option>
                    {departments.map((dept, index) => (
                      <option key={index} value={dept} title={dept}>
                        {dept.length > 30 ? dept.substring(0, 30) + "..." : dept}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Email input */}
            <input
              type={email === "admin" ? "text" : "email"}
              placeholder={
                email === "admin" ? "Tài khoản admin" : "Email @gmail.com"
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {/* Password input với con mắt */}
            <div className="input-group">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
              {showPassword && (
                <div className="password-timer">
                  <div className="timer-bar"></div>
                </div>
              )}
            </div>

            {!isLogin && (
              <>
                {/* Confirm Password */}
                <div className="input-group">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Xác nhận mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="password-toggle"
                    onClick={toggleConfirmPasswordVisibility}
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showConfirmPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                  </button>
                  {showConfirmPassword && (
                    <div className="password-timer">
                      <div className="timer-bar"></div>
                    </div>
                  )}
                </div>
                
                {/* Role select */}
                <select 
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="role-select"
                >
                  <option value="">Phân quyền</option>
                  <option value="Lãnh đạo">Lãnh đạo</option>
                  <option value="Thủ kho">Thủ kho</option>
                  <option value="Cán bộ">Cán bộ khác</option>
                </select>
              </>
            )}

            {isLogin && (
              <div className="remember-row">
                <label>
                  <input type="checkbox" /> Ghi nhớ đăng nhập
                </label>
                <a href="#" onClick={() => navigate("/forgot-password")}>
                  Quên mật khẩu?
                </a>
              </div>
            )}

            <button type="submit" className="submit-btn">
              {isLogin ? "Đăng nhập" : "Đăng ký tài khoản"}
            </button>
          </form>

          <div className="footer">
            <small>Demo Version</small>
          </div>
        </div>
      </div>
    </div>
  );
}