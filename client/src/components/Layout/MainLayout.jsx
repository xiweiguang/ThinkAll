import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Badge, Modal, Input, message, theme, Tooltip } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  TeamOutlined,
  LogoutOutlined,
  SafetyOutlined,
  KeyOutlined,
  BookOutlined,
  DatabaseOutlined,
  FundOutlined,
  FileTextOutlined,
  EditOutlined,
  LockOutlined,
  BarChartOutlined,
  SettingOutlined,
  FolderOutlined,
  FolderAddOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  FundProjectionScreenOutlined,
  LayoutOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getTableIcon } from '../../config/tables';
import { getTableConfig } from '../../services/tableService';
import { getUnreadCount } from '../../services/chatService';
import * as chartCategoryService from '../../services/chartCategoryService';
import ProfileModal from '../User/ProfileModal';
import ChangePasswordModal from '../User/ChangePasswordModal';
import { ChartTabProvider, useChartTab } from '../../contexts/ChartTabContext';
import TablePage from '../../pages/TablePage';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import CategoryModal from './CategoryModal';
import './MainLayout.css';

const { Content, Footer } = Layout;

// 递归构建分类子菜单
function buildCategoryMenuItems(categoryTree, tables, onCategoryAction, onEditAction, hasPermission) {
  const items = [];
  for (const cat of categoryTree) {
    const catTables = tables.filter(t => t.categoryId === cat.id);
    const childMenus = buildCategoryMenuItems(cat.children || [], tables, onCategoryAction, onEditAction, hasPermission);

    const children = [];
    // 子分类菜单
    if (childMenus.length > 0) {
      children.push(...childMenus);
    }
    // 当前分类下的图表
    for (const table of catTables) {
      children.push({
        key: `/table/${table.id}`,
        icon: React.createElement(getTableIcon(table.icon)),
        label: <Tooltip title={table.name} placement="right"><span style={{ display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{table.name}</span></Tooltip>,
      });
    }
    // 编辑目录按钮需要 chart:category:update 权限
    if (hasPermission && hasPermission('chart:category:update') && onEditAction) {
      children.push({
        key: `cat-edit-${cat.id}`,
        icon: <EditOutlined />,
        label: '编辑目录',
        onClick: () => onEditAction(cat),
      });
    }
    // 删除目录按钮需要 chart:category:delete 权限
    if (hasPermission && hasPermission('chart:category:delete')) {
      children.push({
        key: `cat-action-${cat.id}`,
        icon: <DeleteOutlined />,
        label: '删除目录',
        onClick: () => onCategoryAction && onCategoryAction(cat),
      });
    }

    items.push({
      key: `cat-${cat.id}`,
      icon: <FolderOutlined />,
      label: cat.name,
      children,
    });
  }
  return items;
}

function MainLayoutInner() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [visibleTables, setVisibleTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const [idleWarningVisible, setIdleWarningVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [openKeys, setOpenKeys] = useState([]);
  const IDLE_TIMEOUT = 30 * 60 * 1000;
  const IDLE_WARNING_BEFORE = 25 * 60 * 1000;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission, updateUser } = useAuth();
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const { tabs, activeTabId, openTab, switchTab, closeTab, deactivateTab, isFullscreen, toggleFullscreen, contentRef } = useChartTab();

  // 初始化时判断是否为移动端（仅执行一次，不在 resize 时切换）
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (mobile) {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tableRes, catRes] = await Promise.all([
          getTableConfig(),
          chartCategoryService.getCategories(),
        ]);
        if (tableRes && tableRes.code === 200) {
          setVisibleTables(tableRes.data || []);
        } else {
          setVisibleTables([]);
        }
        const catData = catRes.data || catRes;
        setCategories(Array.isArray(catData) ? catData : []);
      } catch {
        setVisibleTables([]);
        setCategories([]);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    setOpenKeys(getOpenKeys());
  }, [categories, visibleTables, location.pathname]);

  // 未读消息轮询
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await getUnreadCount();
        const data = res.data || res;
        setUnreadCount(data.count || 0);
      } catch {
        // 静默处理
      }
    };
    fetchUnread();
    unreadTimerRef.current = setInterval(fetchUnread, 15000);
    // 监听聊天已读事件，实时刷新红点
    const handleChatReadUpdated = () => {
      fetchUnread();
    };
    window.addEventListener('chat-read-updated', handleChatReadUpdated);
    return () => {
      if (unreadTimerRef.current) clearInterval(unreadTimerRef.current);
      window.removeEventListener('chat-read-updated', handleChatReadUpdated);
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [navigate]);

  // 30分钟无操作自动退出
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setIdleWarningVisible(false);
    warningTimerRef.current = setTimeout(() => {
      setIdleWarningVisible(true);
    }, IDLE_WARNING_BEFORE);
    idleTimerRef.current = setTimeout(() => {
      handleLogout();
      message.warning('由于长时间未操作，您已自动退出登录');
    }, IDLE_TIMEOUT);
  }, [IDLE_WARNING_BEFORE, IDLE_TIMEOUT, handleLogout]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handler = () => resetIdleTimer();
    events.forEach(e => window.addEventListener(e, handler));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [resetIdleTimer]);

  // 刷新分类和表格数据
  const refreshCategoriesAndTables = async () => {
    try {
      const [tableRes, catRes] = await Promise.all([
        getTableConfig(),
        chartCategoryService.getCategories(),
      ]);
      if (tableRes && tableRes.code === 200) {
        setVisibleTables(tableRes.data || []);
      } else {
        setVisibleTables([]);
      }
      const catData = catRes.data || catRes;
      setCategories(Array.isArray(catData) ? catData : []);
    } catch {
      // 刷新失败时静默处理
    }
  };

  // 处理新建目录确认
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      message.warning('请输入目录名称');
      return;
    }
    try {
      await chartCategoryService.createCategory({ name: newCategoryName.trim() });
      message.success('目录创建成功');
      setCategoryModalVisible(false);
      setNewCategoryName('');
      await refreshCategoriesAndTables();
      setOpenKeys(['tables-menu']);
    } catch {
      message.error('目录创建失败');
    }
  };

  const [deleteCategoryModalVisible, setDeleteCategoryModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [editCategoryModalVisible, setEditCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const handleDeleteCategory = (cat) => {
    setCategoryToDelete(cat);
    setDeleteCategoryModalVisible(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await chartCategoryService.deleteCategory(categoryToDelete.id);
      message.success('目录删除成功');
      setDeleteCategoryModalVisible(false);
      setCategoryToDelete(null);
      await refreshCategoriesAndTables();
    } catch {
      message.error('目录删除失败');
    }
  };

  // 处理编辑目录
  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setEditCategoryName(cat.name || '');
    setEditCategoryModalVisible(true);
  };

  // 确认编辑目录
  const confirmEditCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) {
      message.warning('请输入目录名称');
      return;
    }
    try {
      await chartCategoryService.updateCategory(editingCategory.id, { name: editCategoryName.trim() });
      message.success('目录修改成功');
      setEditCategoryModalVisible(false);
      setEditingCategory(null);
      setEditCategoryName('');
      await refreshCategoriesAndTables();
    } catch {
      message.error('目录修改失败');
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <EditOutlined />,
      label: '编辑资料',
      onClick: () => setProfileModalVisible(true),
    },
    {
      key: 'changePassword',
      icon: <LockOutlined />,
      label: '修改密码',
      onClick: () => setChangePasswordModalVisible(true),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const menuItems = [];

  // 首页（需要 home 权限）
  if (hasPermission('home')) {
    menuItems.push({
      key: '/home',
      icon: <HomeOutlined />,
      label: '首页',
    });
  }

  // 企业通讯录（需要 address-book 权限）
  if (hasPermission('address-book')) {
    menuItems.push({
      key: '/address-book',
      icon: <BookOutlined />,
      label: (
        <span style={{ position: 'relative', display: 'inline-block' }}>
          企业通讯录
          {unreadCount > 0 && (
            <Badge count={unreadCount} size="small" style={{ position: 'absolute', top: -8, right: -30 }} />
          )}
        </span>
      ),
    });
  }

  // 数据图表（顶层菜单，需要 chart 权限，按分类层级嵌套）
  if (hasPermission('chart') && visibleTables.length > 0) {
    const tableChildren = [];

    // 新建目录菜单项需要 chart:category:create 权限
    if (hasPermission('chart:category:create')) {
      tableChildren.push({
        key: 'new-category',
        icon: <FolderAddOutlined />,
        label: '新建目录',
        onClick: () => setCategoryModalVisible(true),
      });
    }

    // 按分类构建子菜单
    if (categories.length > 0) {
      const categoryMenus = buildCategoryMenuItems(categories, visibleTables, handleDeleteCategory, handleEditCategory, hasPermission);
      tableChildren.push(...categoryMenus);
    }

    // 未分类的图表直接显示在"数据图表"下
    const uncategorizedTables = visibleTables.filter(t => !t.categoryId);
    for (const table of uncategorizedTables) {
      tableChildren.push({
        key: `/table/${table.id}`,
        icon: React.createElement(getTableIcon(table.icon)),
        label: <Tooltip title={table.name} placement="right"><span style={{ display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{table.name}</span></Tooltip>,
      });
    }

    // 无分类时保持原有平铺逻辑
    if (categories.length === 0) {
      const noCatChildren = [];
      // 新建目录按钮需要 chart:category:create 权限
      if (hasPermission('chart:category:create')) {
        noCatChildren.push({
          key: 'new-category',
          icon: <FolderAddOutlined />,
          label: '新建目录',
          onClick: () => setCategoryModalVisible(true),
        });
      }
      noCatChildren.push(...visibleTables.map((table) => ({
        key: `/table/${table.id}`,
        icon: React.createElement(getTableIcon(table.icon)),
        label: <Tooltip title={table.name} placement="right"><span style={{ display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{table.name}</span></Tooltip>,
      })));
      menuItems.push({
        key: 'tables-menu',
        icon: <BarChartOutlined />,
        label: '数据图表',
        children: noCatChildren,
      });
    } else {
      menuItems.push({
        key: 'tables-menu',
        icon: <BarChartOutlined />,
        label: '数据图表',
        children: tableChildren,
      });
    }
  }

  // 数据分析（需要 dashboard 权限）
  if (hasPermission('dashboard')) {
    menuItems.push({
      key: 'data-analysis-menu',
      icon: <FundProjectionScreenOutlined />,
      label: '数据分析',
      children: [
        {
          key: '/dashboard-list',
          icon: <LayoutOutlined />,
          label: '可视化页面',
        },
        {
          key: '/storyboard-list',
          icon: <PlayCircleOutlined />,
          label: '故事板',
        },
      ],
    });
  }

  // 系统管理（父菜单，仅当用户拥有任意 system:* 权限时显示）
  const systemChildren = [];
  if (hasPermission('system:user')) {
    systemChildren.push({
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    });
  }
  if (hasPermission('system:department')) {
    systemChildren.push({
      key: '/departments',
      icon: <TeamOutlined />,
      label: '部门管理',
    });
  }
  if (hasPermission('system:role')) {
    systemChildren.push({
      key: '/roles',
      icon: <SafetyOutlined />,
      label: '角色管理',
    });
  }
  if (hasPermission('system:permission')) {
    systemChildren.push({
      key: '/permissions',
      icon: <KeyOutlined />,
      label: '权限管理',
    });
  }
  if (hasPermission('system:datasource')) {
    systemChildren.push({
      key: '/data-sources',
      icon: <DatabaseOutlined />,
      label: '数据源管理',
    });
  }
  if (hasPermission('system:chart-designer')) {
    systemChildren.push({
      key: '/chart-designer',
      icon: <FundOutlined />,
      label: '图表设计',
    });
  }
  if (hasPermission('system:log') || hasPermission('system:log:read')) {
    systemChildren.push({
      key: '/log-viewer',
      icon: <FileTextOutlined />,
      label: '系统日志',
    });
  }
  if (systemChildren.length > 0) {
    menuItems.push({
      key: 'system-menu',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: systemChildren,
    });
  }

  // 关于页面（需要 system:about 权限）
  if (hasPermission('system:about')) {
    menuItems.push({
      key: '/about',
      icon: <InfoCircleOutlined />,
      label: '关于',
    });
  }

  const getSelectedKeys = () => {
    return [location.pathname];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/table/')) {
      // 查找当前表格所属分类，展开对应菜单
      const tableId = path.replace('/table/', '');
      const table = visibleTables.find(t => t.id === tableId);
      const keys = ['tables-menu'];
      if (table && table.categoryId) {
        // 递归查找分类路径
        const findCategoryPath = (nodes, targetId, path = []) => {
          for (const node of nodes) {
            const currentPath = [...path, `cat-${node.id}`];
            if (node.id === targetId) return currentPath;
            if (node.children && node.children.length > 0) {
              const found = findCategoryPath(node.children, targetId, currentPath);
              if (found) return found;
            }
          }
          return null;
        };
        const catPath = findCategoryPath(categories, table.categoryId);
        if (catPath) {
          keys.push(...catPath);
        }
      }
      return keys;
    }
    // 系统管理子菜单路径自动展开
    const systemPaths = ['/users', '/departments', '/roles', '/permissions', '/data-sources', '/chart-designer', '/log-viewer'];
    if (systemPaths.some(p => path.startsWith(p))) {
      return ['system-menu'];
    }
    // 数据分析子菜单路径自动展开
    if (path.startsWith('/dashboard-list') || path.startsWith('/dashboard-editor') || path.startsWith('/dashboard-view') || path.startsWith('/storyboard-list') || path.startsWith('/storyboard-editor') || path.startsWith('/storyboard-play')) {
      return ['data-analysis-menu'];
    }
    return [];
  };

  const handleMenuClick = ({ key }) => {
    if (key === 'new-category' || /^cat-\d+$/.test(key) || key.startsWith('cat-action-') || key.startsWith('cat-edit-')) {
      if (isMobile) {
        setDrawerVisible(false);
      }
      return;
    }
    if (key.startsWith('/table/')) {
      const chartId = key.replace('/table/', '');
      const table = visibleTables.find(t => t.id === chartId);
      openTab(chartId, {}, table?.name || '');
      if (isMobile) {
        setDrawerVisible(false);
      }
      return;
    }
    deactivateTab();
    navigate(key);
    if (isMobile) {
      setDrawerVisible(false);
    }
  };

  return (
    <Layout className="main-layout">
      {/* 侧边栏子组件 */}
      <Sidebar
        collapsed={collapsed}
        isMobile={isMobile}
        drawerVisible={drawerVisible}
        menuItems={menuItems}
        openKeys={openKeys}
        selectedKeys={getSelectedKeys()}
        onOpenChange={(keys) => setOpenKeys(keys)}
        onMenuClick={handleMenuClick}
        onDrawerClose={() => setDrawerVisible(false)}
      />

      <Layout>
        {/* 顶部栏子组件 */}
        <HeaderBar
          collapsed={collapsed}
          isMobile={isMobile}
          user={user}
          userMenuItems={userMenuItems}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onOpenDrawer={() => setDrawerVisible(true)}
          colorBgContainer={colorBgContainer}
        />
        <Content className="main-content" style={{ display: 'flex', flexDirection: 'column', padding: 0, minWidth: 900, margin: tabs.length > 0 ? '16px 16px 0' : undefined }}>
          {tabs.length > 0 && (
            <div className="chrome-tabs-bar">
              <div className="chrome-tabs-list">
                {tabs.map((tab) => (
                  <div
                    key={tab.tabId}
                    onClick={() => switchTab(tab.tabId)}
                    className={`chrome-tab${activeTabId === tab.tabId ? ' active' : ''}`}
                  >
                    <Tooltip title={tab.title || tab.chartId} mouseEnterDelay={0.5}>
                      <span className="chrome-tab-title">{tab.title || tab.chartId}</span>
                    </Tooltip>
                    <span
                      className="chrome-tab-close"
                      onClick={(e) => { e.stopPropagation(); closeTab(tab.tabId); }}
                    >
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={contentRef} style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto', padding: tabs.length > 0 ? '16px 0 0 0' : undefined, ...(isFullscreen ? { background: '#fff', height: '100vh' } : {}) }}>
            {activeTabId && tabs.find(t => t.tabId === activeTabId) ? (
              <TablePage chartId={tabs.find(t => t.tabId === activeTabId).chartId} initialFilterParams={tabs.find(t => t.tabId === activeTabId).filterParams} />
            ) : (
              <Outlet />
            )}
          </div>
        </Content>
        <Footer className="main-footer">
          <div className="footer-left">
            <img src="/logo.png" alt="想集" className="footer-logo" />
            <span>想集 ThinkAll</span>
          </div>
          <div className="footer-right">
            智能无边界 · 集所想，办所事
          </div>
        </Footer>
      </Layout>

      <ProfileModal
        open={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        user={user}
        updateUser={updateUser}
      />
      <ChangePasswordModal
        open={changePasswordModalVisible}
        onClose={() => setChangePasswordModalVisible(false)}
      />
      <Modal
        open={idleWarningVisible}
        title="系统提示"
        okText="继续使用"
        cancelText="退出登录"
        onOk={() => { setIdleWarningVisible(false); resetIdleTimer(); }}
        onCancel={handleLogout}
        closable={false}
        maskClosable={false}
      >
        <p>您已长时间未操作，系统将在5分钟后自动退出。</p>
        <p>是否继续使用？</p>
      </Modal>

      {/* 分类管理弹窗子组件 */}
      <CategoryModal
        categoryModalVisible={categoryModalVisible}
        newCategoryName={newCategoryName}
        deleteCategoryModalVisible={deleteCategoryModalVisible}
        categoryToDelete={categoryToDelete}
        onCreateCategory={handleCreateCategory}
        onCancelCreate={() => {
          setCategoryModalVisible(false);
          setNewCategoryName('');
        }}
        onNewCategoryNameChange={setNewCategoryName}
        onConfirmDelete={confirmDeleteCategory}
        onCancelDelete={() => {
          setDeleteCategoryModalVisible(false);
          setCategoryToDelete(null);
        }}
      />

      {/* 编辑目录弹窗 */}
      <Modal
        title="编辑目录"
        open={editCategoryModalVisible}
        onOk={confirmEditCategory}
        onCancel={() => {
          setEditCategoryModalVisible(false);
          setEditingCategory(null);
          setEditCategoryName('');
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={editCategoryName}
          onChange={(e) => setEditCategoryName(e.target.value)}
          placeholder="请输入目录名称"
          onPressEnter={confirmEditCategory}
          autoFocus
        />
      </Modal>
    </Layout>
  );
}

export default function MainLayout() {
  return (
    <ChartTabProvider>
      <MainLayoutInner />
    </ChartTabProvider>
  );
}
