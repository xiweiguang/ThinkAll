﻿﻿﻿import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Input, Space, Form, message, Empty, Statistic, Typography, Tag,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  TeamOutlined, CrownOutlined, UserOutlined, SecurityScanOutlined,
} from '@ant-design/icons';
import {
  getRoles, getRoleById, createRole, updateRole, deleteRole, assignPermissions
} from '../services/roleService';
import { getPermissions } from '../services/permissionService';
import { getRoleChartPermissions, setRoleChartPermissions, getAllDataPermissionConfigs } from '../services/chartPermissionService';
import { getCategories } from '../services/chartCategoryService';
import { getTableConfig } from '../services/tableService';
import { useAuth } from '../contexts/AuthContext';
import RoleList from './roles/RoleList';
import RoleForm from './roles/RoleForm';
import RolePermissionTransfer from './roles/RolePermissionTransfer';
import './RolesPage.css';

const { Title } = Typography;

const roleIconMap = {
  admin: { icon: <SecurityScanOutlined />, color: '#1890ff', bgColor: '#e6f7ff' },
  sub_admin: { icon: <SecurityScanOutlined />, color: '#722ed1', bgColor: '#f9f0ff' },
  executive_leader: { icon: <TeamOutlined />, color: '#52c41a', bgColor: '#f6ffed' },
  department_leader: { icon: <TeamOutlined />, color: '#13c2c2', bgColor: '#e6fffb' },
  team_leader: { icon: <TeamOutlined />, color: '#fa8c16', bgColor: '#fff7e6' },
  user: { icon: <UserOutlined />, color: '#8c8c8c', bgColor: '#fafafa' }
};

function getRoleIcon(code) {
  return roleIconMap[code] || roleIconMap.user;
}

function getRoleTypeTag(code) {
  const typeMap = {
    admin: { color: 'blue', text: '管理角色' },
    sub_admin: { color: 'purple', text: '管理角色' },
    executive_leader: { color: 'green', text: '业务角色' },
    department_leader: { color: 'cyan', text: '业务角色' },
    team_leader: { color: 'orange', text: '业务角色' },
    user: { color: 'default', text: '业务角色' }
  };
  return typeMap[code] || { color: 'default', text: '自定义' };
}

const roleDataRuleMap = {
  admin: { label: '查看全部数据', desc: '管理员不受数据权限限制，可查看所有数据', color: '#1890ff' },
  sub_admin: { label: '查看全部数据', desc: '子管理员不受数据权限限制，可查看所有数据', color: '#722ed1' },
  executive_leader: { label: '查看全公司数据', desc: '行领导可查看全公司范围的数据，不受部门限制', color: '#52c41a' },
  department_leader: { label: '按部室名称匹配', desc: '部门领导可查看所属部室及下级部门的所有数据', color: '#13c2c2' },
  team_leader: { label: '按二级部门名称匹配', desc: '二层经理可查看所属二级部门的数据', color: '#fa8c16' },
  user: { label: '按用户姓名匹配', desc: '普通用户只能查看自己姓名相关的数据', color: '#8c8c8c' }
};

function getRoleDataRule(code) {
  return roleDataRuleMap[code] || roleDataRuleMap.user;
}

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');

  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleModalTitle, setRoleModalTitle] = useState('新增角色');
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm] = Form.useForm();
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const [permModalVisible, setPermModalVisible] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const [permissionTree, setPermissionTree] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permSubmitting, setPermSubmitting] = useState(false);
  const [allPermissions, setAllPermissions] = useState([]);

  const [chartPermModalVisible, setChartPermModalVisible] = useState(false);
  const [chartPermRole, setChartPermRole] = useState(null);
  const [chartCheckedKeys, setChartCheckedKeys] = useState([]);
  const [chartPermLoading, setChartPermLoading] = useState(false);
  const [chartPermSubmitting, setChartPermSubmitting] = useState(false);
  const [dataPermConfigs, setDataPermConfigs] = useState({});
  const [allCharts, setAllCharts] = useState([]);
  const [chartCategories, setChartCategories] = useState([]);

  const fetchRoles = useCallback(async (page = 1, pageSize = 10, search = '') => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (search) params.roleName = search;
      const res = await getRoles(params);
      const data = res.data || res;
      if (Array.isArray(data)) {
        setRoles(data);
        setPagination(prev => ({ ...prev, current: page, pageSize, total: data.length }));
      } else {
        setRoles(data.list || data.records || []);
        setPagination({
          current: data.current || data.page || page,
          pageSize: data.pageSize || data.size || pageSize,
          total: data.total || 0
        });
      }
    } catch (err) {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleSearch = () => {
    fetchRoles(1, pagination.pageSize, searchText);
  };

  const handleTableChange = (pag) => {
    fetchRoles(pag.current, pag.pageSize, searchText);
  };

  const handleRefresh = () => {
    setSearchText('');
    fetchRoles(1, pagination.pageSize, '');
  };

  const showAddModal = () => {
    setRoleModalTitle('新增角色');
    setEditingRole(null);
    setRoleModalVisible(true);
  };

  const showEditModal = (record) => {
    setRoleModalTitle('编辑角色');
    setEditingRole(record);
    setRoleModalVisible(true);
  };

  const handleRoleModalOpen = (open) => {
    if (!open) return;
    setTimeout(() => {
      roleForm.resetFields();
      if (editingRole) {
        roleForm.setFieldsValue({
          role_name: editingRole.role_name,
          role_code: editingRole.role_code,
          description: editingRole.description,
          status: editingRole.status !== false
        });
      } else {
        roleForm.setFieldsValue({ status: true });
      }
    }, 0);
  };

  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      setRoleSubmitting(true);
      if (editingRole) {
        await updateRole(editingRole.id, values);
        message.success('角色更新成功');
      } else {
        await createRole(values);
        message.success('角色创建成功');
      }
      setRoleModalVisible(false);
      roleForm.resetFields();
      fetchRoles(pagination.current, pagination.pageSize, searchText);
    } catch (err) {
      if (err.errorFields) return;
      message.error(editingRole ? '角色更新失败' : '角色创建失败');
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRole(id);
      message.success('角色删除成功');
      fetchRoles(pagination.current, pagination.pageSize, searchText);
    } catch (err) {
      message.error('角色删除失败');
    }
  };

  // 渲染权限标题，根据权限类型添加视觉标记
  const renderPermTitle = (perm) => {
    const type = perm.permission_type || perm.type;
    const name = perm.permission_name || perm.name;
    if (type === 'button') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Tag color="blue" style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px', marginRight: 0 }}>按钮</Tag>
          {name}
        </span>
      );
    }
    if (type === 'api') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Tag color="green" style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px', marginRight: 0 }}>API</Tag>
          {name}
        </span>
      );
    }
    return name;
  };

  // 构建权限树
  const buildPermissionTree = (permissions) => {
    const buildNode = (perm) => {
      const node = {
        title: renderPermTitle(perm),
        key: String(perm.id),
      };
      const children = permissions.filter(p => p.parent_id === perm.id);
      if (children.length > 0) {
        node.children = children.map(buildNode);
      }
      return node;
    };
    const rootPerms = permissions.filter(p => !p.parent_id || p.parent_id === 0);
    return rootPerms.map(buildNode);
  };

  const showPermModal = async (record) => {
    setCurrentRole(record);
    setPermLoading(true);
    setPermModalVisible(true);
    try {
      const res = await getPermissions({ all: true });
      const data = res.data || res;
      const permList = Array.isArray(data) ? data : (data.list || data.records || []);
      setAllPermissions(permList);
      const tree = buildPermissionTree(permList);
      setPermissionTree(tree);

      const roleRes = await getRoleById(record.id);
      const roleData = roleRes.data || roleRes;
      if (roleData.permissions && Array.isArray(roleData.permissions)) {
        setCheckedKeys(roleData.permissions.map(p => String(p.id || p)));
      } else if (roleData.permission_ids && Array.isArray(roleData.permission_ids)) {
        setCheckedKeys(roleData.permission_ids.map(id => String(id)));
      } else {
        setCheckedKeys([]);
      }
    } catch (err) {
      console.error('获取权限列表失败:', err);
      message.error('获取权限列表失败');
      setCheckedKeys([]);
    } finally {
      setPermLoading(false);
    }
  };

  const handlePermCheck = (checkedKeys) => {
    const keys = Array.isArray(checkedKeys) ? checkedKeys : checkedKeys.checked;
    setCheckedKeys(keys);
  };

  const handlePermSubmit = async () => {
    if (!currentRole) return;
    setPermSubmitting(true);
    try {
      const realKeys = checkedKeys.filter(key => !key.startsWith('type-'));
      await assignPermissions(currentRole.id, realKeys);
      message.success('权限分配成功');
      setPermModalVisible(false);
      fetchRoles(pagination.current, pagination.pageSize, searchText);
    } catch (err) {
      message.error('权限分配失败');
    } finally {
      setPermSubmitting(false);
    }
  };

  const showChartPermModal = async (record) => {
    setChartPermRole(record);
    setChartPermLoading(true);
    setChartPermModalVisible(true);
    try {
      const [permRes, chartRes, catRes] = await Promise.all([
        getRoleChartPermissions(record.id),
        getTableConfig(),
        getCategories()
      ]);
      const data = permRes.data || permRes;
      const tableIds = data.data || data || [];
      setChartCheckedKeys(tableIds);
      const chartData = chartRes?.data || [];
      setAllCharts(chartData);
      const catData = catRes?.data || catRes || [];
      setChartCategories(Array.isArray(catData) ? catData : []);
      try {
        const dpRes = await getAllDataPermissionConfigs(record.id);
        const dpData = dpRes.data || dpRes || {};
        setDataPermConfigs(dpData);
      } catch {
        setDataPermConfigs({});
      }
    } catch {
      setChartCheckedKeys([]);
      setAllCharts([]);
      setChartCategories([]);
    } finally {
      setChartPermLoading(false);
    }
  };

  const handleChartPermSubmit = async () => {
    if (!chartPermRole) return;
    setChartPermSubmitting(true);
    try {
      // 将数据权限配置转换为后端需要的格式
      const dataPermConfigsForApi = {};
      allCharts.forEach(chart => {
        const config = dataPermConfigs[chart.id];
        if (config) {
          dataPermConfigsForApi[chart.id] = {
            enabled: config.enabled,
            match_field: config.match_field,
            department_field: config.department_field
          };
        }
      });
      await setRoleChartPermissions(chartPermRole.id, chartCheckedKeys, dataPermConfigsForApi);
      message.success('图表权限及数据权限设置成功');
      setChartPermModalVisible(false);
    } catch {
      message.error('图表权限设置失败');
    } finally {
      setChartPermSubmitting(false);
    }
  };

  const enabledCount = roles.filter(r => r.status !== false).length;
  const disabledCount = roles.filter(r => r.status === false).length;

  return (
    <div className="roles-page">
      <div className="roles-page-header">
        <div className="roles-page-title">
          <Title level={3} style={{ margin: 0 }}>角色管理</Title>
          <span className="roles-page-subtitle">管理系统角色及其权限分配</span>
        </div>
        <div className="roles-page-stats">
          <Statistic title="总角色数" value={roles.length} />
          <Statistic title="启用" value={enabledCount} valueStyle={{ color: '#3f8600' }} />
          <Statistic title="禁用" value={disabledCount} valueStyle={{ color: '#cf1322' }} />
        </div>
      </div>

      <Card className="roles-card" variant="borderless">
        <div className="roles-toolbar">
          <Space wrap>
            <Input.Search
              placeholder="搜索角色名称或编码"
              allowClear
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={handleSearch}
              className="roles-search-input"
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
          </Space>
          {hasPermission('system:role:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={showAddModal}>
              新增角色
            </Button>
          )}
        </div>

        <RoleList
          roles={roles}
          loading={loading}
          pagination={pagination}
          searchText={searchText}
          onTableChange={handleTableChange}
          onEdit={showEditModal}
          onPermModal={showPermModal}
          onChartPermModal={showChartPermModal}
          onDelete={handleDelete}
          hasPermission={hasPermission}
          getRoleIcon={getRoleIcon}
          getRoleTypeTag={getRoleTypeTag}
        />
      </Card>

      <RoleForm
        visible={roleModalVisible}
        title={roleModalTitle}
        editingRole={editingRole}
        form={roleForm}
        submitting={roleSubmitting}
        onSubmit={handleRoleSubmit}
        onCancel={() => { setRoleModalVisible(false); roleForm.resetFields(); }}
        afterOpenChange={handleRoleModalOpen}
      />

      <RolePermissionTransfer
        permModalVisible={permModalVisible}
        currentRole={currentRole}
        permissionTree={permissionTree}
        checkedKeys={checkedKeys}
        permLoading={permLoading}
        permSubmitting={permSubmitting}
        onPermCheck={handlePermCheck}
        onPermSubmit={handlePermSubmit}
        onPermCancel={() => { setPermModalVisible(false); setCheckedKeys([]); }}
        chartPermModalVisible={chartPermModalVisible}
        chartPermRole={chartPermRole}
        chartCheckedKeys={chartCheckedKeys}
        chartPermLoading={chartPermLoading}
        chartPermSubmitting={chartPermSubmitting}
        allCharts={allCharts}
        chartCategories={chartCategories}
        dataPermConfigs={dataPermConfigs}
        onChartCheckedChange={(targetKeys) => {
          setChartCheckedKeys(targetKeys);
        }}
        onChartPermSubmit={handleChartPermSubmit}
        onChartPermCancel={() => { setChartPermModalVisible(false); setChartCheckedKeys([]); }}
        onSetDataPermConfigs={setDataPermConfigs}
        getRoleDataRule={getRoleDataRule}
      />
    </div>
  );
}
