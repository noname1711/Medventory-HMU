import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./AuthForm.css";

const API_URL = 'http://localhost:8080/api';

// COOKIE MANAGER UTILITIES
const cookieManager = {
  setCookie: (name, value, days = 30) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  },

  getCookie: (name) => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [cookieName, cookieValue] = cookie.trim().split('=');
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  },

  deleteCookie: (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  },

  clearAllAuthCookies: () => {
    const cookiesToDelete = [
      "rememberedEmail", "rememberedPassword", "rememberMe",
      "rememberedAdmin", "rememberedAdminPassword", "rememberAdmin"
    ];
    cookiesToDelete.forEach(cookieName => {
      cookieManager.deleteCookie(cookieName);
    });
  }
};

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  
  // STATE CHO CÁC TRƯỜNG ĐĂNG KÝ
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");

  // DANH SÁCH KHOA LẤY TỪ BACKEND
  const [departments, setDepartments] = useState([]);

  const navigate = useNavigate();
  
  const passwordTimeoutRef = useRef(null);
  const confirmPasswordTimeoutRef = useRef(null);

  // Role mapping - chuyển đổi từ tiếng Việt sang backend enum
  const roleMapping = {
    "Lãnh đạo": "lanhdao",
    "Thủ kho": "thukho", 
    "Cán bộ": "canbo"
  };

  // Reverse role mapping - chuyển từ backend enum sang tiếng Việt
  const reverseRoleMapping = {
    "lanhdao": "Lãnh đạo",
    "thukho": "Thủ kho",
    "canbo": "Cán bộ"
  };

  // API endpoints - sử dụng biến API_URL
  const API_ENDPOINTS = {
    LOGIN: `${API_URL}/auth/login`,
    REGISTER: `${API_URL}/auth/register`,
    DEPARTMENTS: `${API_URL}/auth/departments`
  };

  // LẤY DANH SÁCH KHOA TỪ BACKEND
  useEffect(() => {
    const fetchDepartments = async () => {
      setIsLoadingDepartments(true);
      try {
        const response = await fetch(API_ENDPOINTS.DEPARTMENTS);
        if (response.ok) {
          const data = await response.json();
          // API trả về array of objects {id, name} - lấy ra tên khoa
          const departmentNames = data.map(dept => dept.name);
          setDepartments(departmentNames);
        } else {
          toast.error("Không thể tải danh sách khoa từ hệ thống");
          setDepartments([]);
        }
      } catch (error) {
        toast.error("Lỗi kết nối đến server");
        setDepartments([]);
      } finally {
        setIsLoadingDepartments(false);
      }
    };

    // Chỉ fetch departments khi component mount
    fetchDepartments();
  }, []);

  // AUTO LOGIN - CHỈ CHO USER THƯỜNG, KHÔNG CHO ADMIN
  useEffect(() => {
    const attemptAutoLogin = async () => {
      // CHỈ KIỂM TRA COOKIES USER THƯỜNG
      const savedEmail = cookieManager.getCookie("rememberedEmail");
      const savedPassword = cookieManager.getCookie("rememberedPassword");
      const savedRememberMe = cookieManager.getCookie("rememberMe") === "true";
      
      console.log("Auto Login Check - User only:", {
        savedEmail, 
        savedRememberMe,
        isAdmin: savedEmail === "admin"
      });
      
      // QUAN TRỌNG: KHÔNG auto login cho admin
      if (savedEmail === "admin") {
        console.log("Admin detected - Skipping auto login");
        // Xóa cookies admin cũ nếu có
        cookieManager.deleteCookie("rememberedEmail");
        cookieManager.deleteCookie("rememberedPassword");
        cookieManager.deleteCookie("rememberMe");
        return;
      }
      
      // CHỈ AUTO LOGIN CHO USER THƯỜNG
      if (savedRememberMe && savedEmail && savedPassword) {
        console.log("Attempting user auto login");
        setIsAutoLogging(true);
        
        try {
          const response = await fetch(API_ENDPOINTS.LOGIN, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              email: savedEmail, 
              password: savedPassword 
            }),
          });

          const data = await response.json();

          if (data.success) {
            console.log("User auto login successful");
            
            if (data.user) {
              // Chuyển đổi role từ backend enum sang tiếng Việt nếu cần
              const userData = {
                ...data.user,
                role: reverseRoleMapping[data.user.role] || data.user.role
              };
              localStorage.setItem('currentUser', JSON.stringify(userData));
            }
            
            // CHỈ chuyển hướng đến dashboard, KHÔNG đến admin
            setTimeout(() => navigate("/dashboard"), 500);
          } else {
            // Nếu auto login thất bại, chỉ điền email
            setEmail(savedEmail);
            setRememberMe(true);
          }
        } catch (error) {
          console.error("User auto login error:", error);
          // Nếu có lỗi, chỉ điền email
          setEmail(savedEmail);
          setRememberMe(true);
        } finally {
          setIsAutoLogging(false);
        }
      } else if (savedRememberMe && savedEmail) {
        // Chỉ có email, không có password -> chỉ điền email
        setEmail(savedEmail);
        setRememberMe(true);
        
        // Auto-focus password field
        setTimeout(() => {
          const passwordInput = document.querySelector('input[type="password"]');
          if (passwordInput) {
            passwordInput.focus();
          }
        }, 500);
      }
    };

    attemptAutoLogin();
  }, [navigate]);

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

  // HANDLE REMEMBER ME CHANGE - CHỈ CHO USER THƯỜNG
  const handleRememberMeChange = (e) => {
    const isChecked = e.target.checked;
    setRememberMe(isChecked);
    
    if (!isChecked) {
      // Xóa cookies user thường
      cookieManager.deleteCookie("rememberedEmail");
      cookieManager.deleteCookie("rememberedPassword");
      cookieManager.deleteCookie("rememberMe");
    }
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

    // Kiểm tra nếu không có khoa nào khi đăng ký
    if (!isLogin && departments.length === 0) {
      toast.error("Hệ thống chưa có khoa nào. Vui lòng thử lại sau!");
      return;
    }

    try {
      if (isLogin) {
        // XỬ LÝ GHI NHỚ ĐĂNG NHẬP - CHỈ CHO USER THƯỜNG
        if (rememberMe && email !== "admin") {
          // CHỈ lưu cookies cho user thường
          cookieManager.setCookie("rememberedEmail", email, 30);
          cookieManager.setCookie("rememberedPassword", password, 30);
          cookieManager.setCookie("rememberMe", "true", 30);
          // Xóa cookies admin nếu có
          cookieManager.deleteCookie("rememberedAdmin");
          cookieManager.deleteCookie("rememberedAdminPassword");
          cookieManager.deleteCookie("rememberAdmin");
        } else {
          // Xóa tất cả cookies khi không chọn remember me hoặc là admin
          cookieManager.clearAllAuthCookies();
        }

        // Đăng nhập
        const response = await fetch(API_ENDPOINTS.LOGIN, {
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
            // Chuyển đổi role từ backend enum sang tiếng Việt để hiển thị
            const userData = {
              ...data.user,
              role: reverseRoleMapping[data.user.role] || data.user.role
            };
            localStorage.setItem('currentUser', JSON.stringify(userData));
          }
          
          // CHUYỂN HƯỚNG
          if (email === "admin") {
            // THÊM SESSION FLAG CHO ADMIN
            sessionStorage.setItem('adminJustLoggedIn', 'true');
            setTimeout(() => navigate("/admin"), 800);
          } else {
            setTimeout(() => navigate("/dashboard"), 800);
          }
        } else {
          toast.error(data.message);
          // Nếu đăng nhập thất bại, xóa password khỏi cookies
          if (rememberMe && email !== "admin") {
            cookieManager.deleteCookie("rememberedPassword");
          }
        }
      } else {
        // Đăng ký (chỉ cho user thường)
        // Chuyển đổi role từ tiếng Việt sang backend enum
        const backendRole = roleMapping[role] || "canbo";
        
        const registerData = {
          fullName,
          email,
          password,
          confirmPassword,
          dateOfBirth,
          department,
          role: backendRole, // Gửi role dạng enum cho backend
        };

        const response = await fetch(API_ENDPOINTS.REGISTER, {
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
    if (passwordTimeoutRef.current) {
      clearTimeout(passwordTimeoutRef.current);
    }

    const newShowPassword = !showPassword;
    setShowPassword(newShowPassword);

    if (newShowPassword) {
      passwordTimeoutRef.current = setTimeout(() => {
        setShowPassword(false);
      }, 3000);
    }
  };

  const toggleConfirmPasswordVisibility = () => {
    if (confirmPasswordTimeoutRef.current) {
      clearTimeout(confirmPasswordTimeoutRef.current);
    }

    const newShowConfirmPassword = !showConfirmPassword;
    setShowConfirmPassword(newShowConfirmPassword);

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

  // LOADING KHI AUTO LOGIN 
  if (isAutoLogging) {
    return (
      <div className="auth-page">
        <div className="auth-wrapper">
          <div className="auto-login-loading">
            <div className="loading-spinner"></div>
            <p>Đang tải...</p>
          </div>
        </div>
      </div>
    );
  }

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
                    disabled={isLoadingDepartments || departments.length === 0}
                  >
                    <option value="">
                      {isLoadingDepartments 
                        ? "Đang tải..." 
                        : departments.length === 0
                          ? "Không có khoa nào"
                          : "Chọn khoa"}
                    </option>
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

            {/* Password input */}
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

            {/* CHỈ HIỂN THỊ REMEMBER ROW CHO USER THƯỜNG */}
            {isLogin && email !== "admin" && (
              <div className="remember-row">
                <label>
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={handleRememberMeChange}
                  /> 
                  Ghi nhớ đăng nhập
                </label>
                <a href="#" onClick={() => navigate("/forgot-password")}>
                  Quên mật khẩu?
                </a>
              </div>
            )}

            {isLogin && email === "admin" && (
              <div style={{ height: '20px' }}></div> 
            )}

            <button 
              type="submit" 
              className="submit-btn"
              disabled={!isLogin && (isLoadingDepartments || departments.length === 0)}
            >
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