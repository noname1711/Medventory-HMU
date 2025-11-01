import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import "./ForgotPassword.css";


export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    token: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl) {
      setFormData(prev => ({
        ...prev,
        token: tokenFromUrl
      }));
    }
  }, [searchParams]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    // Chỉ cho phép thay đổi password fields, không cho thay đổi token
    if (e.target.name !== "token") {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    if (!formData.newPassword) {
      toast.error("Vui lòng nhập mật khẩu mới!");
      return;
    }

    if (!formData.token) {
      toast.error("Không tìm thấy mã đặt lại!");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8080/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: formData.token,
          newPassword: formData.newPassword
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Đặt lại mật khẩu thành công! Đang chuyển hướng...");
        setTimeout(() => navigate("/"), 2000);
      } else {
        toast.error(data.message || "Mã không hợp lệ hoặc đã hết hạn!");
      }
    } catch (error) {
      toast.error("Không thể kết nối đến server!");
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className="forgot-page">
      <div className="forgot-box">
        <div className="forgot-header">
          <div className="icon-wrapper">
            <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2>Đặt lại mật khẩu</h2>
          <p>Nhập mật khẩu mới của bạn</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              name="token"
              placeholder="Mã đặt lại..."
              value={formData.token}
              onChange={handleChange}
              readOnly // Không thể chỉnh sửa
              className="readonly-input" 
              required
            />
            <div className="input-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </div>

          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              name="newPassword"
              placeholder="Nhập mật khẩu mới..."
              value={formData.newPassword}
              onChange={handleChange}
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
          </div>

          <div className="input-group">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Xác nhận lại mật khẩu mới..."
              value={formData.confirmPassword}
              onChange={handleChange}
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
          </div>

          <button type="submit" disabled={isLoading} className="submit-btn">
            {isLoading ? (
              <div className="loading">
                <div className="spinner"></div>
                Đang xử lý...
              </div>
            ) : (
              "Đặt lại mật khẩu"
            )}
          </button>

          <button type="button" onClick={() => navigate("/forgot-password")} className="back-btn">
            <svg className="back-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại quên mật khẩu
          </button>
        </form>
      </div>
    </div>
  );
}