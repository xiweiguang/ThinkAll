import React from 'react';
import { Layout, Menu, Drawer, Badge, Tooltip } from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  BarChartOutlined,
  FolderOutlined,
  FolderAddOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  KeyOutlined,
  DatabaseOutlined,
  FundOutlined,
  FileTextOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  FundProjectionScreenOutlined,
  LayoutOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { getTableIcon } from '../../config/tables';

const { Sider } = Layout;

/**
 * 侧边栏子组件
 * 包含桌面端Sider和移动端Drawer两种模式
 */
export default function Sidebar({
  collapsed,
  isMobile,
  drawerVisible,
  menuItems,
  openKeys,
  selectedKeys,
  onOpenChange,
  onMenuClick,
  onDrawerClose,
}) {
  // 桌面端侧边栏
  const desktopSider = (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      className="main-sider"
      theme="dark"
      width={220}
      collapsedWidth={80}
    >
      {/* flex列布局：logo固定顶部，Menu独立滚动，footer固定底部 */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="logo">
          {collapsed ? (
            <img src="/logo.png" alt="想集" className="logo-img" />
          ) : (
            <>
              <img src="/logo.png" alt="想集" className="logo-img" />
              <span className="logo-text">想集</span>
            </>
          )}
        </div>
        {/* Menu区域，随页面整体滚动 */}
        <div style={{ flex: 1 }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={onOpenChange}
            items={menuItems}
            onClick={onMenuClick}
          />
        </div>
        <div className="sider-footer">
          <div className="sider-footer-slogan">智能无边界 · 集所想，办所事</div>
          <div className="sider-footer-info">想集 ThinkAll · 智能办公平台 v0.0.1</div>
        </div>
      </div>
    </Sider>
  );

  // 移动端抽屉式侧边栏
  const mobileDrawer = (
    <Drawer
      title={null}
      placement="left"
      onClose={onDrawerClose}
      open={drawerVisible}
      width={256}
      className="mobile-sider-drawer"
      styles={{
        body: { padding: 0, background: '#001529' },
        header: { display: 'none' },
      }}
    >
      <div className="logo">
        <img src="/logo.png" alt="想集" className="logo-img" />
        <span className="logo-text">想集</span>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        onOpenChange={onOpenChange}
        items={menuItems}
        onClick={onMenuClick}
      />
      <div className="sider-footer">
        <div className="sider-footer-slogan">智能无边界 · 集所想，办所事</div>
        <div className="sider-footer-info">想集 ThinkAll · 智能办公平台 v0.0.1</div>
      </div>
    </Drawer>
  );

  return (
    <>
      {!isMobile && desktopSider}
      {isMobile && mobileDrawer}
    </>
  );
}
