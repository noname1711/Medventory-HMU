import React, { useState, useRef, useEffect } from "react";
import "./DashboardHeader.css";

// --- UTILITIES ---
const cookieManager = {
  deleteCookie: (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  },
  getCookie: (name) => {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [cookieName, cookieValue] = cookie.trim().split("=");
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  },
};

// Hàm format thời gian (VD: "5 phút trước", "vừa xong")
const formatTimeAgo = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN");
};

export default function DashboardHeader({ userInfo }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef(null);

  // --- NOTIFICATION STATE ---
  const [showNoti, setShowNoti] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiItems, setNotiItems] = useState([]);
  const [notiLoading, setNotiLoading] = useState(false);
  const notiRef = useRef(null);

  // Lấy userId từ props hoặc localStorage để gọi API
  const getUserId = () => {
    if (userInfo?.id) return userInfo.id;
    try {
      const saved = JSON.parse(localStorage.getItem("currentUser"));
      return saved?.id;
    } catch {
      return null;
    }
  };
  const userId = getUserId();

  // --- CLICK OUTSIDE HANDLERS ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notiRef.current && !notiRef.current.contains(event.target)) {
        setShowNoti(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- API CALLS ---

  // Gọi API lấy danh sách thông báo
  const fetchMyNotifications = async ({ unreadOnly, page = 0, size = 20 }) => {
    if (!userId) return null;

    const qs = new URLSearchParams({
      unreadOnly: String(!!unreadOnly),
      page: String(page),
      size: String(size),
    });

    try {
      const res = await fetch(`http://localhost:8080/api/notifications/my?${qs.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId), // Quan trọng: Backend dùng header này để xác định user
        },
      });

      if (!res.ok) throw new Error("Failed to load notifications");
      return await res.json();
    } catch (err) {
      console.error("Noti Error:", err);
      return null;
    }
  };

  // API Đánh dấu 1 tin là đã đọc
  const markRead = async (notificationId) => {
    if (!userId) return;
    try {
      await fetch(`http://localhost:8080/api/notifications/${notificationId}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
        },
      });
    } catch (e) {
      console.error(e);
    }
  };

  // API Đánh dấu tất cả là đã đọc
  const markAllRead = async () => {
    if (!userId) return;
    try {
      await fetch(`http://localhost:8080/api/notifications/read-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
        },
      });
      // Cập nhật UI ngay lập tức
      setNotiItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  // --- EFFECTS ---

  // 1. Load số lượng badge (unread count) ngay khi load trang
  useEffect(() => {
    if (userId) {
      // Chỉ cần lấy 1 item unreadOnly=true để lấy summary count
      fetchMyNotifications({ unreadOnly: true, size: 1 }).then((res) => {
        // Backend trả về structure: { data: [...], summary: { unreadCount: 5, ... } }
        if (res?.summary?.unreadCount !== undefined) {
          setUnreadCount(res.summary.unreadCount);
        }
      });
    }
  }, [userId]);

  // 2. Xử lý khi bấm nút chuông
  const handleToggleNoti = async () => {
    const nextState = !showNoti;
    setShowNoti(nextState);

    if (nextState && userId) {
      setNotiLoading(true);
      // Lấy tất cả thông báo (cả đã đọc và chưa đọc) để hiển thị list
      const res = await fetchMyNotifications({ unreadOnly: false, size: 20 });
      setNotiLoading(false);

      if (res) {
        const list = res.notifications || [];
        setNotiItems(list);
        if (res.summary?.unreadCount !== undefined) {
          setUnreadCount(res.summary.unreadCount);
        }
      }
    }
  };

  // 3. Xử lý khi click vào 1 item thông báo
  const handleNotiClick = async (it) => {
    if (!it.isRead) {
      await markRead(it.id);
      // Update local state
      setNotiItems((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, isRead: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    // TODO: Điều hướng dựa trên entityType/entityId
    // Ví dụ: if (it.entityType === 'ISSUE_REQ') navigate(`/issue-req/${it.entityId}`);
    setShowNoti(false);
  };

  // --- DISPLAY HELPERS ---
  const roleDisplayMapping = {
    lanhdao: "Lãnh đạo",
    thukho: "Thủ kho",
    canbo: "Cán bộ",
    BGH: "Ban Giám Hiệu",
    bgh: "Ban Giám Hiệu"
  };

  const getDisplayName = (user) => {
    if (!user || !user.fullName) return "Người dùng";
    const roleCode = typeof user.role === 'object' ? user.role.code : user.role;
    if (roleCode?.toLowerCase().includes("lanhdao")) return `BS. ${user.fullName}`;
    return user.fullName;
  };

  const getDisplayRole = (user) => {
    if (!user || !user.role) return "";
    const roleCode = typeof user.role === 'object' ? user.role.code : user.role;
    // Tìm key khớp trong mapping
    const key = Object.keys(roleDisplayMapping).find(k => k.toLowerCase() === roleCode?.toLowerCase());
    return key ? roleDisplayMapping[key] : roleCode;
  };

  const getAvatarImage = (user) => {
    const roleCode = (typeof user?.role === 'object' ? user.role.code : user?.role) || "";
    const r = roleCode.toLowerCase();
    if (r.includes("lanhdao") || r.includes("bgh")) return "/avatar-lanhdao.png";
    if (r.includes("thukho")) return "/avatar-thukho.png";
    return "/avatar-canbo.png";
  };

  const getAvatarText = (user) => {
    if (!user?.fullName) return "U";
    return user.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().substring(0, 2);
  };

  const handleLogout = () => {
    ["rememberedEmail", "rememberedPassword", "rememberMe", "authToken", "refreshToken"].forEach(
      cookieManager.deleteCookie
    );
    localStorage.clear();
    setTimeout(() => { window.location.href = "/"; }, 300);
  };

  const displayName = getDisplayName(userInfo);
  const displayRole = getDisplayRole(userInfo);
  const avatarImage = getAvatarImage(userInfo);
  const avatarText = getAvatarText(userInfo);

  return (
    <>
      <header className="dh-header">
        <div className="dh-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo Section */}
          <div className="dh-left">
            <div className="dh-logo">
              <img src="/logo.jpg" alt="Logo" className="dh-logo-img" />
            </div>
            <div className="dh-brand">
              <h1>Quản lý Vật tư Y tế</h1>
              <p className="dh-sub">Bệnh viện Đại học Y Hà Nội</p>
            </div>
          </div>

          <div className="dh-right">
            {/* User Dropdown */}
            {/* Notification Bell */}
                        <div className="dh-noti" ref={notiRef}>
                          <button className="dh-noti-btn" onClick={handleToggleNoti} type="button">
                            <span className="dh-noti-icon">🔔</span>
                            {unreadCount > 0 && (
                              <span className="dh-noti-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                            )}
                          </button>

                          {showNoti && (
                            <div className="dh-noti-panel">
                              <div className="dh-noti-header">
                                <div className="dh-noti-title">Thông báo</div>
                                {unreadCount > 0 && (
                                  <button className="dh-noti-mark-all" onClick={markAllRead}>
                                    Đánh dấu đã đọc hết
                                  </button>
                                )}
                              </div>

                              <div className="dh-noti-content">
                                {notiLoading ? (
                                  <div className="dh-noti-empty">Đang tải...</div>
                                ) : notiItems.length === 0 ? (
                                  <div className="dh-noti-empty">Không có thông báo nào</div>
                                ) : (
                                  <div className="dh-noti-list">
                                    {notiItems.map((it) => (
                                      <div
                                        key={it.id}
                                        className={`dh-noti-item ${it.isRead ? "read" : "unread"}`}
                                        onClick={() => handleNotiClick(it)}
                                      >
                                        <div className="dh-noti-item-top">
                                            <span className="dh-noti-item-title">{it.title}</span>
                                            {!it.isRead && <span className="dh-noti-dot"></span>}
                                        </div>
                                        <div className="dh-noti-item-body">{it.content}</div>
                                        <div className="dh-noti-item-time">{formatTimeAgo(it.createdAt)}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
            <div className="dh-userinfo" onClick={() => setShowDropdown(!showDropdown)} ref={dropdownRef}>
              <div className="dh-usertext">
                <div className="dh-username">{displayName}</div>
                <div className="dh-userrole">{displayRole}</div>
              </div>
              <div className="dh-avatar">
                {!avatarError ? (
                  <img src={avatarImage} alt="Avatar" className="dh-avatar-img" onError={() => setAvatarError(true)} />
                ) : (
                  <div className="dh-avatar-text">{avatarText}</div>
                )}
              </div>

              {showDropdown && (
                <div className="dh-dropdown">
                  <div className="dh-dropdown-header">
                    <div className="dh-dropdown-avatar">
                         {!avatarError ? <img src={avatarImage} alt="Avt" onError={() => setAvatarError(true)} /> : avatarText}
                    </div>
                    <div className="dh-dropdown-userinfo">
                         <div className="dh-dropdown-name">{displayName}</div>
                         <div className="dh-dropdown-role">{displayRole}</div>
                    </div>
                  </div>
                  <div className="dh-dropdown-divider"></div>
                  <div className="dh-dropdown-menu">
                    <div className="dh-dropdown-item" onClick={() => setShowProfileModal(true)}>
                      <span className="dh-dropdown-icon">👤</span> Thông tin cá nhân
                    </div>
                    <div className="dh-dropdown-item dh-dropdown-logout" onClick={handleLogout}>
                      <span className="dh-dropdown-icon">⎋</span> Đăng xuất
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
              <button className="profile-modal-close" onClick={() => setShowProfileModal(false)}>✕</button>
            </div>
            <div className="profile-modal-content">
              {/* Giữ nguyên nội dung modal profile cũ của bạn hoặc render từ userInfo */}
              <div className="profile-avatar-section">
                <div className="profile-avatar">
                    {!avatarError ? <img src={avatarImage} alt="Avt" /> : <div className="profile-avatar-text">{avatarText}</div>}
                </div>
                <div className="profile-basic-info">
                   <h3>{userInfo?.fullName}</h3>
                   <p className="profile-role">{displayRole}</p>
                </div>
              </div>
              <div className="profile-details">
                 <div className="profile-detail-row"><span className="profile-detail-label">Email:</span> <span>{userInfo?.email}</span></div>
                 <div className="profile-detail-row"><span className="profile-detail-label">Khoa/Phòng:</span> <span>{userInfo?.department?.name || userInfo?.department}</span></div>
              </div>
            </div>
            <div className="profile-modal-footer">
              <button className="profile-modal-btn profile-modal-btn-close" onClick={() => setShowProfileModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}