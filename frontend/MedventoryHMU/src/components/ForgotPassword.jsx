import { useNavigate } from "react-router-dom";
import "./ForgotPassword.css";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Link đặt lại mật khẩu đã được gửi đến email!");
    navigate("/");
  };

  return (
    <div className="forgot-page">
      <div className="forgot-box">
        <h2>Quên mật khẩu</h2>
        <p>Nhập email @hmu.edu.vn để nhận liên kết đặt lại mật khẩu</p>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email @hmu.edu.vn" required />
          <button type="submit">Gửi liên kết đặt lại</button>
          <a onClick={() => navigate("/")}>Quay lại đăng nhập</a>
        </form>
      </div>
    </div>
  );
}
