import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

const ROLE_DISPLAY = {
  lanhdao: 'Lãnh đạo',
  thukho: 'Thủ kho',
  canbo: 'Cán bộ',
  BGH: 'Ban Giám Hiệu',
  bgh: 'Ban Giám Hiệu',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getUser().then((savedUser) => {
      if (savedUser) setUser(savedUser);
      setLoading(false);
    });
  }, []);

  const login = async (userData) => {
    await storage.saveUser(userData);
    setUser(userData);
  };

  const logout = async () => {
    await storage.clearAll();
    setUser(null);
  };

  const getDisplayRole = (roleCode) => {
    const code = typeof roleCode === 'object' ? roleCode?.code : roleCode;
    const key = Object.keys(ROLE_DISPLAY).find(
      (k) => k.toLowerCase() === (code || '').toLowerCase()
    );
    return key ? ROLE_DISPLAY[key] : code || '';
  };

  const getDisplayName = () => {
    if (!user?.fullName) return 'Người dùng';
    const roleCode = typeof user.role === 'object' ? user.role?.code : user.role;
    if (roleCode?.toLowerCase().includes('lanhdao')) return `BS. ${user.fullName}`;
    return user.fullName;
  };

  const isAdmin = user?.isAdmin === true;

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, getDisplayRole, getDisplayName, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
