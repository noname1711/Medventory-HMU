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
      "rememberedEmail", "rememberedPassword", "rememberMe"
    ];
    cookiesToDelete.forEach(cookieName => {
      cookieManager.deleteCookie(cookieName);
    });
  }
};

// Department Search Component với tìm kiếm nâng cao
const DepartmentSearch = ({ value, onChange, onSelect, departments }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter departments với tìm kiếm không phân biệt hoa thường và vị trí từ
  useEffect(() => {
    if (value.trim() === '') {
      setFilteredDepartments(departments);
    } else {
      const searchTerms = value.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
      
      const filtered = departments.filter(dept => {
        const departmentName = dept.name.toLowerCase();
        
        // Kiểm tra tất cả các từ khóa có xuất hiện trong tên khoa không
        const matches = searchTerms.every(term => 
          departmentName.includes(term)
        );
        return matches;
      });
      
      setFilteredDepartments(filtered);
    }
  }, [value, departments]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelectDepartment = (department) => {
    onSelect(department.name);
    setIsOpen(false);
    // Focus lại input sau khi chọn
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Delay đóng dropdown để cho phép click vào suggestions
    setTimeout(() => setIsOpen(false), 200);
  };

  // Hàm highlight từ khóa tìm kiếm trong kết quả
  const highlightText = (text, searchValue) => {
    if (!searchValue.trim()) return text;
    
    const searchTerms = searchValue.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
    let highlightedText = text;
    
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
  };

  return (
    <div className="department-search-container" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Phân khoa..."
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className="department-input"
        required
      />
      
      {isOpen && filteredDepartments.length > 0 && (
        <div className="department-suggestions">
          <div className="suggestion-header">
            Tìm thấy {filteredDepartments.length} kết quả
          </div>
          {filteredDepartments.map((dept) => (
            <div
              key={dept.id}
              className="suggestion-item"
              onClick={() => handleSelectDepartment(dept)}
              onMouseDown={(e) => e.preventDefault()} // Ngăn blur khi click
            >
              <span 
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(dept.name, value) 
                }} 
              />
            </div>
          ))}
        </div>
      )}
      
      {isOpen && value.trim() !== '' && filteredDepartments.length === 0 && (
        <div className="department-suggestions">
          <div className="suggestion-item no-results">
            Không tìm thấy khoa phù hợp với "{value}"
          </div>
          <div className="suggestion-item hint">
            Thử tìm với từ khóa khác như: "xét nghiệm", "ngoại", "nội"
          </div>
        </div>
      )}
      
      {isOpen && value.trim() === '' && departments.length > 0 && (
        <div className="department-suggestions">
          <div className="suggestion-header">
            Tất cả khoa ({departments.length})
          </div>
          {departments.slice(0, 10).map((dept) => (
            <div
              key={dept.id}
              className="suggestion-item"
              onClick={() => handleSelectDepartment(dept)}
              onMouseDown={(e) => e.preventDefault()}
            >
              {dept.name}
            </div>
          ))}
          {departments.length > 10 && (
            <div className="suggestion-item hint">
              Và {departments.length - 10} khoa khác...
            </div>
          )}
        </div>
      )}
    </div>
  );
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

  // API endpoints
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
          setDepartments(data);
        } else {
          toast.error("Không thể tải danh sách khoa từ hệ thống");
          setDepartments([]);
        }
      } catch (error) {
        toast.error("Lỗi kết nối đến server khi tải danh sách khoa");
        setDepartments([]);
      } finally {
        setIsLoadingDepartments(false);
      }
    };

    // Luôn fetch departments bất kể tab nào, nhưng chỉ hiển thị khi cần
    fetchDepartments();
  }, []);

  // AUTO LOGIN
  useEffect(() => {
    const attemptAutoLogin = async () => {
      const savedEmail = cookieManager.getCookie("rememberedEmail");
      const savedPassword = cookieManager.getCookie("rememberedPassword");
      const savedRememberMe = cookieManager.getCookie("rememberMe") === "true";
      
      if (savedRememberMe && savedEmail && savedPassword) {
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
            if (data.user) {
              localStorage.setItem('currentUser', JSON.stringify(data.user));
            }
            setTimeout(() => navigate("/dashboard"), 500);
          } else {
            setEmail(savedEmail);
            setRememberMe(true);
          }
        } catch (error) {
          setEmail(savedEmail);
          setRememberMe(true);
        } finally {
          setIsAutoLogging(false);
        }
      } else if (savedRememberMe && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
        
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
    // Giữ lại email và password để tiện sử dụng
    // setEmail("");
    // setPassword("");
  };

  // HANDLE REMEMBER ME CHANGE
  const handleRememberMeChange = (e) => {
    const isChecked = e.target.checked;
    setRememberMe(isChecked);
    
    if (!isChecked) {
      cookieManager.deleteCookie("rememberedEmail");
      cookieManager.deleteCookie("rememberedPassword");
      cookieManager.deleteCookie("rememberMe");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLogin) {
      // ĐĂNG NHẬP
      if (!email || !password) {
        toast.error("Vui lòng điền đầy đủ thông tin đăng nhập!");
        return;
      }

      // XỬ LÝ GHI NHỚ ĐĂNG NHẬP
      if (rememberMe) {
        cookieManager.setCookie("rememberedEmail", email, 30);
        cookieManager.setCookie("rememberedPassword", password, 30);
        cookieManager.setCookie("rememberMe", "true", 30);
      } else {
        cookieManager.clearAllAuthCookies();
      }

      try {
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
            localStorage.setItem('currentUser', JSON.stringify(data.user));
          }
          setTimeout(() => navigate("/dashboard"), 800);
        } else {
          toast.error(data.message);
          if (rememberMe) {
            cookieManager.deleteCookie("rememberedPassword");
          }
        }
      } catch (error) {
        toast.error("Lỗi kết nối đến server!");
      }
    } else {
      // ĐĂNG KÝ
      if (password !== confirmPassword) {
        toast.error("Mật khẩu xác nhận không khớp!");
        return;
      }

      if (!fullName || !dateOfBirth || !department || !role) {
        toast.error("Vui lòng điền đầy đủ thông tin đăng ký!");
        return;
      }

      // Kiểm tra khoa có hợp lệ không
      const isValidDepartment = departments.some(dept => dept.name === department);
      if (!isValidDepartment) {
        toast.error("Vui lòng chọn khoa hợp lệ từ danh sách gợi ý!");
        return;
      }

      try {
        const registerData = {
          fullName,
          email,
          password,
          confirmPassword,
          dateOfBirth,
          department,
          role,
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
          resetForm();
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error("Lỗi kết nối đến server!");
      }
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
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="role-select"
                  >
                    <option value="">Phân quyền</option>
                    <option value="Lãnh đạo">Lãnh đạo</option>
                    <option value="Thủ kho">Thủ kho</option>
                    <option value="Cán bộ">Cán bộ khác</option>
                  </select>
                </div>

                {/* COMPONENT TÌM KIẾM KHOA NÂNG CAO */}
                <div className="department-section">
                  <DepartmentSearch
                    value={department}
                    onChange={setDepartment}
                    onSelect={setDepartment}
                    departments={departments}
                  />
                  
                  {isLoadingDepartments && (
                    <div className="loading-text">Đang tải danh sách khoa...</div>
                  )}
                  
                  {!isLoadingDepartments && departments.length === 0 && (
                    <div className="error-text">Không thể tải danh sách khoa</div>
                  )}
                </div>
              </>
            )}

            {/* INPUT EMAIL CHO CẢ ĐĂNG NHẬP VÀ ĐĂNG KÝ */}
            <input
              type="email"
              placeholder="Email"
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
              </>
            )}

            {/* REMEMBER ME - HIỂN THỊ CHO CẢ ĐĂNG NHẬP */}
            {isLogin && (
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

            <button 
              type="submit" 
              className="submit-btn"
              disabled={!isLogin && (isLoadingDepartments || departments.length === 0)}
            >
              {isLogin ? "Đăng nhập" : "Đăng ký tài khoản"}
            </button>
          </form>

          <div className="footer">
            <small>Version 2.0</small>
          </div>
        </div>
      </div>
    </div>
  );
}