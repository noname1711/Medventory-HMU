import { useNavigate } from "react-router-dom";
import "./ForgotPassword.css";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const email = e.target[0].value;

    if (!email.endsWith("@gmail.com")) {
      toast.error("Email phải có đuôi @gmail.com!");
      return;
    }

    toast.success("Link đặt lại mật khẩu đã được gửi đến email!");
    setTimeout(() => navigate("/"), 1500);
  };

  return (
    <div className="forgot-page flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200">
      <div className="forgot-box bg-white shadow-xl p-8 rounded-2xl w-full max-w-md transform transition-all hover:scale-[1.02]">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
          Quên mật khẩu
        </h2>
        <p className="text-center text-gray-500 mb-6">
          Nhập email <span className="font-medium">@hmu.edu.vn</span> để nhận liên kết đặt lại mật khẩu
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email @hmu.edu.vn"
            required
            className="border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-md transition"
          >
            Gửi liên kết đặt lại
          </button>
          <a
            onClick={() => navigate("/")}
            className="text-indigo-600 hover:text-indigo-800 text-center cursor-pointer transition"
          >
            ← Quay lại đăng nhập
          </a>
        </form>
      </div>
    </div>
  );
}
