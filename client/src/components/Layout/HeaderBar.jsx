import React from 'react';
import { Layout, Button, Dropdown, Avatar } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, MenuOutlined } from '@ant-design/icons';
import { getAvatarColor } from '../../utils/avatarUtils';

const { Header } = Layout;

/**
 * 顶部栏子组件
 * 包含折叠按钮和用户下拉菜单
 */
export default function HeaderBar({
  collapsed,
  isMobile,
  user,
  userMenuItems,
  onToggleCollapse,
  onOpenDrawer,
  colorBgContainer,
}) {
  return (
    <Header className="main-header" style={{ background: colorBgContainer }}>
      {isMobile ? (
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onOpenDrawer}
          className="trigger-btn hamburger-btn"
        />
      ) : (
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleCollapse}
          className="trigger-btn"
        />
      )}
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <div className="user-info">
            {user?.avatar ? (
              <Avatar src={user.avatar} size="small" />
            ) : (
              <Avatar
                size="small"
                style={{
                  backgroundColor: getAvatarColor(user?.username || ''),
                  verticalAlign: 'middle',
                }}
              >
                {(user?.real_name || user?.username || '用')[0].toUpperCase()}
              </Avatar>
            )}
            <span className="username">{user?.real_name || user?.username || '用户'}</span>
          </div>
        </Dropdown>
      </div>
    </Header>
  );
}
