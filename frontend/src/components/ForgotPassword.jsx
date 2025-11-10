import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import "./ForgotPassword.css";

const API_URL = 'http://localhost:8080/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [countdown, setCountdown] = useState(60);
  
  // Dùng useRef để track xem component có còn mounted không
  const isMounted = useRef(true);

  // API endpoints - sử dụng biến API_URL
  const API_ENDPOINTS = {
    FORGOT_PASSWORD: `${API_URL}/auth/forgot-password`
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!showTokenModal) return;

    setCountdown(60);
    
    const timer = setInterval(() => {
      // Kiểm tra component còn mounted trước khi setState
      if (!isMounted.current) {
        clearInterval(timer);
        return;
      }

      setCountdown(prev => {
        const newCountdown = prev - 1;
        
        if (newCountdown <= 0) {
          clearInterval(timer);
          if (isMounted.current) {
            setShowTokenModal(false);
          }
          return 0;
        }
        return newCountdown;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showTokenModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get("email");
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success === "true" || data.success === true) {
        setResetToken(data.resetToken);
        setShowTokenModal(true);
      } else {
        toast.error(data.message || "Gmail không tồn tại trong hệ thống!");
      }
    } catch (error) {
      toast.error("Không thể kết nối đến server!");
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(resetToken);
    toast.success("✅ Đã copy mã vào clipboard!");
    setShowTokenModal(false);
    navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`);
  };

  const handleCloseModal = () => {
    setShowTokenModal(false);
  };

  return (
    <>
      {/* Main Forgot Password Form */}
      <div className="forgot-page">
        <div className="forgot-box">
          <div className="forgot-header">
            <div className="icon-wrapper">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2>Quên mật khẩu</h2>
            <p>Nhập email <span className="highlight">@gmail.com</span> đã đăng ký</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="email"
                name="email"
                placeholder="your-email@gmail.com"
                required
              />
              <div className="input-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            <button type="submit" disabled={isLoading} className="submit-btn">
              {isLoading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  Đang xử lý...
                </div>
              ) : (
                "Gửi mã đặt lại"
              )}
            </button>
            
            <button type="button" onClick={() => navigate("/")} className="back-btn">
              <svg className="back-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại đăng nhập
            </button>
          </form>
        </div>
      </div>

      {/* Token Modal với Countdown */}
      {showTokenModal && (
        <div className="modal-overlay">
          <div className="token-modal">
            <div className="modal-header">
              <div className="modal-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p>Mã có hiệu lực trong 1 phút!</p>
            </div>

            <div className="modal-content">
              <div className="token-box">
                <p className="token-label">Mã đặt lại mật khẩu của bạn:</p>
                <div className="token-display">
                  <code className="token-text">{resetToken}</code>
                </div>
                <div className="countdown-timer">
                  ⏰ Hộp thoại sẽ tự động đóng sau: <span className="countdown-number">{countdown}</span> giây
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={handleCloseModal} className="close-btn">
                  Đóng ngay
                </button>
                <button onClick={handleCopyToken} className="copy-action-btn">
                  <svg className="copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy & Đến trang đặt lại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}