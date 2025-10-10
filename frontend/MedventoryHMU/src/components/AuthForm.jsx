import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./AuthForm.css";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    // Cho phép admin đăng nhập không cần email thật
    if (isLogin) {
      if (email === "admin" && password === "12345") {
        toast.success("Xin chào Admin 👑");
        setTimeout(() => navigate("/admin"), 800);
        return;
      }

      // Kiểm tra email người dùng thường
      if (!email.endsWith("@gmail.com")) {
        toast.error("Vui lòng dùng email @gmail.com để đăng nhập!");
        return;
      }

      toast.success("Chào mừng đến Medventory-HMU 👋");
      setTimeout(() => navigate("/dashboard"), 800);
    } else {
      // Kiểm tra email hợp lệ khi đăng ký
      if (!email.endsWith("@gmail.com")) {
        toast.error("Email phải có đuôi @gmail.com");
        return;
      }

      toast.success("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.");
      setIsLogin(true);
      setEmail("");
      setPassword("");
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
                  <select required>
                    <option value="">Phòng ban</option>
                    <option>Khoa Ngoại</option>
                    <option>Khoa Nội</option>
                    <option>Khoa Nhi</option>
                    <option>Khoa Sản</option>
                    <option>Khoa Xét nghiệm</option>
                    <option>Kho Vật tư</option>
                    <option>Hành chính</option>
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

            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {!isLogin && (
              <>
                <input type="password" placeholder="Xác nhận mật khẩu" required />
                <select required>
                  <option value="">Phân quyền</option>
                  <option>Bác sĩ</option>
                  <option>Điều dưỡng</option>
                  <option>Kỹ thuật viên</option>
                  <option>Quản lý kho</option>
                  <option>Admin</option>
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
