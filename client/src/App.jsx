import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/Layout/MainLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import PermissionsPage from './pages/PermissionsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import TablePage from './pages/TablePage';
import AddressBookPage from './pages/AddressBookPage';
import DataSourcePage from './pages/DataSourcePage';
import ChartDesignerPage from './pages/ChartDesignerPage';
import DashboardListPage from './pages/DashboardListPage';
import DashboardEditorPage from './pages/DashboardEditorPage';
import DashboardViewPage from './pages/DashboardViewPage';
import DashboardPublicPage from './pages/DashboardPublicPage';
import StoryboardListPage from './pages/StoryboardListPage';
import StoryboardEditorPage from './pages/StoryboardEditorPage';
import StoryboardPlayPage from './pages/StoryboardPlayPage';
import StoryboardPublicPage from './pages/StoryboardPublicPage';
import LogViewerPage from './pages/LogViewerPage';
import AboutPage from './pages/AboutPage';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/home" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route path="/dashboard-public/:id" element={<DashboardPublicPage />} />
      <Route path="/storyboard-public/:id" element={<StoryboardPublicPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="address-book" element={<AddressBookPage />} />
        <Route path="data-sources" element={<DataSourcePage />} />
        <Route path="chart-designer" element={<ChartDesignerPage />} />
        <Route path="dashboard-list" element={<DashboardListPage />} />
        <Route path="dashboard-editor/:id" element={<DashboardEditorPage />} />
        <Route path="dashboard-view/:id" element={<DashboardViewPage />} />
        <Route path="storyboard-list" element={<StoryboardListPage />} />
        <Route path="storyboard-editor/:id" element={<StoryboardEditorPage />} />
        <Route path="storyboard-play/:id" element={<StoryboardPlayPage />} />
        <Route path="log-viewer" element={<LogViewerPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="table/:tableId" element={<TablePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
