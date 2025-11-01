import React, { useState, useRef, useEffect } from "react";
import "./DashboardHeader.css";

// COOKIE MANAGER UTILITIES
const cookieManager = {
  deleteCookie: (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
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
  }
};

export default function DashboardHeader({ userInfo }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format hiển thị tên
  const getDisplayName = (user) => {
    if (!user || !user.fullName) return "BS. Nguyễn Văn An";
    
    const role = user.role?.toLowerCase();
    if (role?.includes('bacsi') || role?.includes('truongkhoa') || role?.includes('bác sĩ') || role?.includes('lãnh đạo')) {
      return `BS. ${user.fullName}`;
    }
    return user.fullName;
  };

  // Format hiển thị chức vụ
  const getDisplayRole = (user) => {
    if (!user || !user.role) return "Trưởng khoa Thiết bị Y tế";
    
    const roleMap = {
      'canbo': 'Cán bộ',
      'truongkhoa': 'Trưởng khoa',
      'admin': 'Quản trị viên',
      'bacsi': 'Bác sĩ',
      'bác sĩ': 'Bác sĩ',
      'lãnh đạo': 'Lãnh đạo',
      'thủ kho': 'Thủ kho',
      'cán bộ khác': 'Cán bộ'
    };
    
    return roleMap[user.role.toLowerCase()] || user.role;
  };

  // Lấy avatar image theo role
  const getAvatarImage = (user) => {
    if (!user || !user.role) return "/avatar-canbo.png";
    
    const role = user.role.toLowerCase();
    
    if (role.includes('lãnh đạo') || role.includes('truongkhoa') || role.includes('admin')) {
      return "/avatar-lanhdao.png";
    } else if (role.includes('thủ kho') || role.includes('thukho')) {
      return "/avatar-thukho.png";
    } else {
      return "/avatar-canbo.png";
    }
  };

  // Lấy avatar text fallback
  const getAvatarText = (user) => {
    if (!user || !user.fullName) return "NA";
    return user.fullName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  // Format ngày tháng
  const formatDate = (dateString) => {
    if (!dateString) return "Chưa cập nhật";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN');
    } catch {
      return "Chưa cập nhật";
    }
  };

  const handleAvatarError = () => {
    setAvatarError(true);
  };

  const handleProfileClick = () => {
    setShowProfileModal(true);
    setShowDropdown(false);
  };

  // XÓA COOKIES KHI ĐĂNG XUẤT
  const handleLogout = () => {
    // XÓA TẤT CẢ COOKIES ĐĂNG NHẬP
    const cookiesToDelete = [
      "rememberedEmail",
      "rememberedPassword", 
      "rememberMe",
      "authToken",
      "refreshToken"
    ];
    
    cookiesToDelete.forEach(cookieName => {
      cookieManager.deleteCookie(cookieName);
    });
    
    // XÓA LOCAL STORAGE
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    
    // CHUYỂN HƯỚNG VỀ TRANG LOGIN
    setTimeout(() => {
      window.location.href = "/";
    }, 300);
  };

  const displayName = getDisplayName(userInfo);
  const displayRole = getDisplayRole(userInfo);
  const avatarImage = getAvatarImage(userInfo);
  const avatarText = getAvatarText(userInfo);

  return (
    <>
      <header className="dh-header">
        <div className="dh-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="dh-left">
            <div className="dh-logo">
              <img
                src="/logo.jpg"
                alt="Logo"
                className="dh-logo"
              />
            </div>
            <div className="dh-brand">
              <h1>Quản lý Vật tư Y tế</h1>
              <p className="dh-sub">Bệnh viện Đại học Y Hà Nội</p>
            </div>
          </div>

          <div className="dh-right">
            <div 
              className="dh-userinfo"
              onClick={() => setShowDropdown(!showDropdown)}
              ref={dropdownRef}
            >
              <div className="dh-usertext">
                <div className="dh-username">{displayName}</div>
                <div className="dh-userrole">{displayRole}</div>
              </div>
              <div className="dh-avatar">
                {!avatarError ? (
                  <img 
                    src={avatarImage} 
                    alt="Avatar"
                    className="dh-avatar-img"
                    onError={handleAvatarError}
                  />
                ) : (
                  <div className="dh-avatar-text">
                    {avatarText}
                  </div>
                )}
              </div>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="dh-dropdown">
                  <div className="dh-dropdown-header">
                    <div className="dh-dropdown-avatar">
                      {!avatarError ? (
                        <img 
                          src={avatarImage} 
                          alt="Avatar"
                          onError={handleAvatarError}
                        />
                      ) : (
                        <div className="dh-dropdown-avatar-text">
                          {avatarText}
                        </div>
                      )}
                    </div>
                    <div className="dh-dropdown-userinfo">
                      <div className="dh-dropdown-name">{displayName}</div>
                      <div className="dh-dropdown-role">{displayRole}</div>
                    </div>
                  </div>
                  
                  <div className="dh-dropdown-divider"></div>
                  
                  <div className="dh-dropdown-menu">
                    <div 
                      className="dh-dropdown-item"
                      onClick={handleProfileClick}
                    >
                      <span className="dh-dropdown-icon">👤</span>
                      Thông tin cá nhân
                    </div>
                    <div className="dh-dropdown-item">
                      <span className="dh-dropdown-icon">⚙️</span>
                      Cài đặt
                    </div>
                  </div>

                  <div className="dh-dropdown-divider"></div>

                  <div className="dh-dropdown-menu">
                    <div 
                      className="dh-dropdown-item dh-dropdown-logout"
                      onClick={handleLogout}
                    >
                      <span className="dh-dropdown-icon">🚪</span>
                      Đăng xuất
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="profile-modal-overlay">
          <div className="profile-modal">
            <div className="profile-modal-header">
              <h2>Thông tin cá nhân</h2>
              <button 
                className="profile-modal-close"
                onClick={() => setShowProfileModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="profile-modal-content">
              <div className="profile-avatar-section">
                <div className="profile-avatar">
                  {!avatarError ? (
                    <img 
                      src={avatarImage} 
                      alt="Avatar"
                      onError={handleAvatarError}
                    />
                  ) : (
                    <div className="profile-avatar-text">
                      {avatarText}
                    </div>
                  )}
                </div>
                <div className="profile-basic-info">
                  <h3>{displayName}</h3>
                  <p className="profile-role">{displayRole}</p>
                </div>
              </div>

              <div className="profile-details">
                <div className="profile-detail-row">
                  <span className="profile-detail-label">Họ và tên:</span>
                  <span className="profile-detail-value">{userInfo?.fullName || "Chưa cập nhật"}</span>
                </div>

                <div className="profile-detail-row">
                  <span className="profile-detail-label">Email:</span>
                  <span className="profile-detail-value">{userInfo?.email || "Chưa cập nhật"}</span>
                </div>

                <div className="profile-detail-row">
                  <span className="profile-detail-label">Ngày sinh:</span>
                  <span className="profile-detail-value">{formatDate(userInfo?.dateOfBirth)}</span>
                </div>

                <div className="profile-detail-row">
                  <span className="profile-detail-label">Khoa/Phòng:</span>
                  <span className="profile-detail-value">{userInfo?.department || "Chưa cập nhật"}</span>
                </div>

                <div className="profile-detail-row">
                  <span className="profile-detail-label">Chức vụ:</span>
                  <span className="profile-detail-value">{userInfo?.role || "Chưa cập nhật"}</span>
                </div>

                <div className="profile-detail-row">
                  <span className="profile-detail-label">Trạng thái:</span>
                  <span className={`profile-detail-value status-${userInfo?.status?.toLowerCase() || 'pending'}`}>
                    {userInfo?.status === 'approved' ? 'Đã phê duyệt' : 
                     userInfo?.status === 'pending' ? 'Chờ phê duyệt' : 
                     userInfo?.status || 'Chưa xác định'}
                  </span>
                </div>
              </div>
            </div>

            <div className="profile-modal-footer">
              <button 
                className="profile-modal-btn profile-modal-btn-close"
                onClick={() => setShowProfileModal(false)}
              >
                Đóng
              </button>
              <button className="profile-modal-btn profile-modal-btn-primary">
                Chỉnh sửa thông tin
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}