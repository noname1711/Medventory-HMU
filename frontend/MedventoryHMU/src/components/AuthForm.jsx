import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AuthForm.css";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Fake login 
    navigate("/dashboard");
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
              <div className="grid-2">
                <input type="text" placeholder="Họ" required />
                <input type="text" placeholder="Tên" required />
              </div>
            )}

            <input type="email" placeholder="Email @hmu.edu.vn" required />
            <input type="password" placeholder="Mật khẩu" required />

            {!isLogin && (
              <>
                <input type="password" placeholder="Xác nhận mật khẩu" required />
                <select>
                  <option>Bác sĩ</option>
                  <option>Điều dưỡng</option>
                  <option>Kỹ thuật viên</option>
                  <option>Quản lý kho</option>
                  <option>Khác</option>
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
