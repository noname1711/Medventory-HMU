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
  const navigate = useNavigate();
  
  const passwordTimeoutRef = useRef(null);
  const confirmPasswordTimeoutRef = useRef(null);

  // Danh sách phòng ban đầy đủ từ HMU
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

  const handleSubmit = (e) => {
    e.preventDefault();

    // Kiểm tra email hợp lệ cho cả đăng nhập và đăng ký (trừ admin)
    if (!email.endsWith("@gmail.com") && email !== "admin") {
      toast.error("Vui lòng dùng email @gmail.com để đăng nhập/đăng ký!");
      return;
    }

    // Kiểm tra xác nhận mật khẩu khi đăng ký
    if (!isLogin && password !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    // Cho phép admin đăng nhập không cần email thật
    if (isLogin) {
      if (email === "admin" && password === "12345") {
        toast.success("Xin chào Admin 👑");
        setTimeout(() => navigate("/admin"), 800);
        return;
      }

      toast.success("Chào mừng đến Medventory-HMU 👋");
      setTimeout(() => navigate("/dashboard"), 800);
    } else {
      toast.success("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.");
      setIsLogin(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
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
              onClick={() => setIsLogin(true)}
            >
              Đăng nhập
            </button>
            <button
              className={!isLogin ? "tab active" : "tab"}
              onClick={() => setIsLogin(false)}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <>
                <input type="text" placeholder="Họ và tên" required />

                <div className="grid-2">
                  <input type="date" placeholder="Ngày sinh" required />
                  <select required className="department-select">
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

            {/*Nếu là admin thì cho phép nhập text thường, còn người khác thì dùng email */}
            <input
              type={email === "admin" ? "text" : "email"}
              placeholder={
                email === "admin" ? "Tài khoản admin" : "Email @gmail.com"
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span 
                className={`password-toggle ${showPassword ? 'visible' : ''}`}
                onClick={togglePasswordVisibility}
              >
                {showPassword ? "🔓" : "🔒"}
              </span>
              {showPassword && (
                <div className="password-timer">
                  <div className="timer-bar"></div>
                </div>
              )}
            </div>

            {!isLogin && (
              <>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Xác nhận mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <span 
                    className={`password-toggle ${showConfirmPassword ? 'visible' : ''}`}
                    onClick={toggleConfirmPasswordVisibility}
                  >
                    {showConfirmPassword ? "🔓" : "🔒"}
                  </span>
                  {showConfirmPassword && (
                    <div className="password-timer">
                      <div className="timer-bar"></div>
                    </div>
                  )}
                </div>
                
                <select required>
                  <option value="">Phân quyền</option>
                  <option>Lãnh đạo</option>
                  <option>Thủ kho</option>
                  <option>Cán bộ khác</option>
                </select>
              </>
            )}

            {isLogin && (
              <div className="remember-row">
                <label>
                  <input type="checkbox" /> Ghi nhớ đăng nhập
                </label>
                <a href="#" onClick={() => navigate("/forgot")}>
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