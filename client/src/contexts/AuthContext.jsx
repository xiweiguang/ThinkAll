import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { getToken, setToken, removeToken, getUserInfo, setUserInfo, getUserInfoFromStorage, removeUserInfo } from '../utils';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await authService.getPermissions();
      const data = res.data || res;
      setPermissions(data.codes || []);
      setIsSuperAdmin(data.isSuperAdmin || false);
    } catch {
      setPermissions([]);
      setIsSuperAdmin(false);
    }
  }, []);

  const hasPermission = useCallback((permissionCode) => {
    if (isSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    // 精确匹配：与后端 permission_required 保持一致
    return permissions.includes(permissionCode);
  }, [permissions, isSuperAdmin]);

  const checkAuth = useCallback(() => {
    const savedToken = getToken();
    if (savedToken) {
      const jwtInfo = getUserInfo();
      if (jwtInfo) {
        const now = Math.floor(Date.now() / 1000);
        if (jwtInfo.exp && jwtInfo.exp > now) {
          setUser(jwtInfo);
          setTokenState(savedToken);
          setIsAuthenticated(true);
          setLoading(false);
          return true;
        }
      }
      const storedInfo = getUserInfoFromStorage();
      if (storedInfo) {
        setUser(storedInfo);
        setTokenState(savedToken);
        setIsAuthenticated(true);
        setLoading(false);
        return true;
      }
      removeToken();
      removeUserInfo();
      setTokenState(null);
      setUser(null);
      setIsAuthenticated(false);
    } else {
      setUser(null);
      setTokenState(null);
      setIsAuthenticated(false);
    }
    setLoading(false);
    return false;
  }, []);

  useEffect(() => {
    const init = async () => {
      const authenticated = checkAuth();
      if (authenticated) {
        await fetchPermissions();
      }
    };
    init();
  }, [checkAuth, fetchPermissions]);

  const login = useCallback(async (username, password, remember = true) => {
    const response = await authService.login(username, password);
    const { token: newToken, user: userData } = response.data || response;
    setToken(newToken, remember);
    setTokenState(newToken);
    const userInfo = userData || getUserInfo();
    setUser(userInfo);
    if (userInfo) {
      setUserInfo(userInfo, remember);
    }
    setIsAuthenticated(true);
    // 登录成功后获取权限
    await fetchPermissions();
    return userInfo;
  }, [fetchPermissions]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      // 即使退出接口调用失败，也清除本地状态
    }
    removeToken();
    removeUserInfo();
    setTokenState(null);
    setUser(null);
    setIsAuthenticated(false);
    setPermissions([]);
    setIsSuperAdmin(false);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser((prev) => {
      const updated = { ...prev, ...userData };
      const remember = !!localStorage.getItem('data_vis_token');
      setUserInfo(updated, remember);
      return updated;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated,
    loading,
    login,
    logout,
    checkAuth,
    permissions,
    isSuperAdmin,
    hasPermission,
    updateUser,
  }), [user, token, isAuthenticated, loading, login, logout, checkAuth, permissions, isSuperAdmin, hasPermission, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
