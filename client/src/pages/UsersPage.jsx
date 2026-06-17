import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  TreeSelect,
  Tag,
  Space,
  Modal,
  Form,
  Switch,
  Popconfirm,
  Checkbox,
  message,
  Tooltip,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserSwitchOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import * as userService from '../services/userService';
import * as roleService from '../services/roleService';
import * as departmentService from '../services/departmentService';
import * as systemConfigService from '../services/systemConfigService';
import { formatDate } from '../utils';
import './UsersPage.css';

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();

  // 用户列表相关状态
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [departmentFilter, setDepartmentFilter] = useState(undefined);

  // 部门列表（用于筛选和表单下拉）
  const [departments, setDepartments] = useState([]);
  // 部门树形数据（用于 TreeSelect）
  const [departmentTree, setDepartmentTree] = useState([]);

  // 新增/编辑用户 Modal
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm] = Form.useForm();

  // 分配角色 Modal
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleModalLoading, setRoleModalLoading] = useState(false);
  const [allRoles, setAllRoles] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [assigningUserId, setAssigningUserId] = useState(null);
  const [maxRoles, setMaxRoles] = useState(5);

  // 加载部门列表
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await departmentService.getDepartments();
      const data = res.data || res;
      const list = Array.isArray(data) ? data : (data?.list || []);
      setDepartments(list);

      // 获取部门树形数据
      const treeRes = await departmentService.getDepartmentTree();
      const treeData = treeRes.data || treeRes || [];
      setDepartmentTree(convertToTreeSelectData(treeData));
    } catch (error) {
      console.error('获取部门列表失败', error);
    }
  }, []);

  // 将后端部门树数据转换为 Ant Design TreeSelect 格式
  const convertToTreeSelectData = (treeData) => {
    if (!Array.isArray(treeData)) return [];
    return treeData.map((item) => ({
      title: item.department_name,
      value: item.id,
      key: item.id,
      children: item.children ? convertToTreeSelectData(item.children) : [],
    }));
  };

  // 加载用户列表
  const fetchUsers = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
      };
      if (searchText) {
        params.username = searchText;
        params.real_name = searchText;
      }
      if (statusFilter !== undefined && statusFilter !== null) {
        params.status = statusFilter;
      }
      if (departmentFilter !== undefined && departmentFilter !== null) {
        params.department_id = departmentFilter;
      }
      const res = await userService.getUsers(params);
      const data = res.data || res;
      if (Array.isArray(data)) {
        setUsers(data);
        setPagination((prev) => ({ ...prev, current: page, pageSize, total: data.length }));
      } else if (data && typeof data === 'object') {
        const list = data.list || data.rows || data.records || data.items || [];
        const total = data.total || data.count || list.length;
        setUsers(list);
        setPagination({ current: page, pageSize, total });
      }
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, departmentFilter]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchUsers(1, pagination.pageSize);
  }, [fetchUsers]);

  // 搜索
  const handleSearch = () => {
    fetchUsers(1, pagination.pageSize);
  };

  // 重置筛选
  const handleReset = () => {
    setSearchText('');
    setStatusFilter(undefined);
    setDepartmentFilter(undefined);
  };

  // 分页变化
  const handleTableChange = (pag) => {
    fetchUsers(pag.current, pag.pageSize);
  };

  // 打开新增用户 Modal
  const handleAddUser = () => {
    setEditingUser(null);
    setUserModalVisible(true);
  };

  // 打开编辑用户 Modal
  const handleEditUser = async (record) => {
    setEditingUser(record);
    try {
      const res = await userService.getUserById(record.id);
      const detail = res.data || res || record;
      setEditingUser((prev) => ({ ...prev, _detail: detail }));
      setUserModalVisible(true);
    } catch (error) {
      setUserModalVisible(true);
    }
  };

  // Modal打开后设置表单值
  const handleUserModalOpen = (open) => {
    if (!open) return;
    setTimeout(() => {
      userForm.resetFields();
      if (editingUser) {
        const detail = editingUser._detail || editingUser;
        userForm.setFieldsValue({
          username: detail.username,
          real_name: detail.real_name,
          email: detail.email,
          phone: detail.phone,
          department_id: detail.department_id,
          status: detail.status !== false,
        });
      } else {
        userForm.setFieldsValue({ status: true });
      }
    }, 0);
  };

  // 提交新增/编辑用户
  const handleUserModalOk = async () => {
    try {
      const values = await userForm.validateFields();
      setUserModalLoading(true);
      const submitData = {
        ...values,
        status: values.status !== false,
      };
      if (editingUser) {
        if (!submitData.password) {
          delete submitData.password;
        }
        await userService.updateUser(editingUser.id, submitData);
        message.success('更新用户成功');
      } else {
        await userService.createUser(submitData);
        message.success('创建用户成功');
      }
      setUserModalVisible(false);
      fetchUsers(pagination.current, pagination.pageSize);
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error(editingUser ? '更新用户失败' : '创建用户失败');
    } finally {
      setUserModalLoading(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async (record) => {
    if (currentUser && (currentUser.id === record.id || currentUser.userId === record.id || currentUser.username === record.username)) {
      message.warning('不能删除当前登录用户');
      return;
    }
    try {
      await userService.deleteUser(record.id);
      message.success('删除用户成功');
      fetchUsers(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('删除用户失败');
    }
  };

  // 打开分配角色 Modal
  const handleAssignRoles = async (record) => {
    setAssigningUserId(record.id);
    try {
      const [rolesRes, configRes] = await Promise.all([
        roleService.getRoles(),
        systemConfigService.getConfigByKey('max_roles_per_user').catch(() => null),
      ]);
      const rolesData = rolesRes.data || rolesRes || [];
      const rolesList = Array.isArray(rolesData) ? rolesData : (rolesData.list || rolesData.records || rolesData.rows || []);
      setAllRoles(rolesList);
      const existingRoleIds = (record.roles || []).map((r) =>
        typeof r === 'object' ? r.id : r
      );
      setSelectedRoleIds(existingRoleIds);
      // 获取最大角色数配置
      if (configRes) {
        const configData = configRes.data || configRes;
        if (configData && configData.config_value) {
          setMaxRoles(parseInt(configData.config_value, 10) || 5);
        }
      }
      setRoleModalVisible(true);
    } catch (error) {
      message.error('获取角色列表失败');
    }
  };

  // 提交分配角色
  const handleRoleModalOk = async () => {
    setRoleModalLoading(true);
    try {
      await userService.assignRoles(assigningUserId, selectedRoleIds);
      message.success('分配角色成功');
      setRoleModalVisible(false);
      fetchUsers(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('分配角色失败');
    } finally {
      setRoleModalLoading(false);
    }
  };

  // 角色选择变化
  const handleRoleChange = (checkedValues) => {
    if (checkedValues.length > maxRoles) {
      message.warning(`每个用户最多只能选择 ${maxRoles} 个角色`);
      return;
    }
    setSelectedRoleIds(checkedValues);
  };

  // 获取部门名称
  const getDepartmentName = (departmentId) => {
    if (!departmentId) return '-';
    const dept = departments.find((d) => d.id === departmentId);
    return dept ? dept.department_name : '-';
  };

  const getRoleTagColor = (roleCode) => {
    const colorMap = {
      admin: 'blue',
      sub_admin: 'purple',
      executive_leader: 'green',
      department_leader: 'cyan',
      team_leader: 'orange',
      user: 'default',
    };
    return colorMap[roleCode] || 'default';
  };

  // 表格列定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      ellipsis: true,
    },
    {
      title: '真实姓名',
      dataIndex: 'real_name',
      key: 'realName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      ellipsis: true,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      ellipsis: true,
    },
    {
      title: '部门',
      key: 'department',
      width: 160,
      ellipsis: true,
      render: (_, record) => record.department_path || getDepartmentName(record.department_id),
    },
    {
      title: '岗位',
      dataIndex: 'position',
      key: 'position',
      width: 100,
      ellipsis: true,
    },
    {
      title: '角色',
      key: 'roles',
      width: 180,
      render: (_, record) => {
        const roles = record.roles || [];
        if (roles.length === 0) return <Tag color="default">未分配</Tag>;
        return (
          <Space size={[4, 4]} wrap>
            {roles.map((r) => (
              <Tag key={r.id} color={getRoleTagColor(r.role_code)}>
                {r.role_name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) =>
        status !== false ? (
          <Tag color="green">启用</Tag>
        ) : (
          <Tag color="red">禁用</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'createdAt',
      width: 170,
      render: (text) => (text ? formatDate(text, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const isCurrentUser =
          currentUser &&
          (currentUser.id === record.id ||
            currentUser.userId === record.id ||
            currentUser.username === record.username);
        return (
          <Space size="small">
            {hasPermission('system:user:update') && (
              <Tooltip title="编辑">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditUser(record)}
                >
                  编辑
                </Button>
              </Tooltip>
            )}
            {hasPermission('system:user:delete') && (
              isCurrentUser ? (
                <Tooltip title="不能删除当前登录用户">
                  <Button type="link" size="small" disabled icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Tooltip>
              ) : (
                <Popconfirm
                  title="确定删除该用户吗？"
                  onConfirm={() => handleDeleteUser(record)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              )
            )}
            {hasPermission('system:user:update') && (
              <Tooltip title="分配角色">
                <Button
                  type="link"
                  size="small"
                  icon={<UserSwitchOutlined />}
                  onClick={() => handleAssignRoles(record)}
                >
                  角色
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="users-page">
      <Card className="users-page-card">
        {/* 搜索筛选区域 */}
        <Row gutter={[16, 16]} className="users-filter-row" align="middle">
          <Col flex="auto">
            <Space wrap size="middle" className="users-filter-controls">
              <Input.Search
                placeholder="搜索用户名/真实姓名"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={handleSearch}
                className="users-search-input"
                prefix={<SearchOutlined />}
                enterButton="搜索"
              />
              <Select
                placeholder="状态筛选"
                allowClear
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                className="users-status-select"
                options={[
                  { label: '启用', value: true },
                  { label: '禁用', value: false },
                ]}
              />
              <TreeSelect
                placeholder="部门筛选"
                allowClear
                treeData={departmentTree}
                treeDefaultExpandAll
                showSearch
                treeNodeFilterProp="title"
                value={departmentFilter}
                onChange={(val) => setDepartmentFilter(val)}
                className="users-dept-select"
                style={{ minWidth: 180 }}
              />
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
          <Col>
          {hasPermission('system:user:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser} block={window.innerWidth < 768}>
              新增用户
            </Button>
          )}
          </Col>
        </Row>

        {/* 用户列表表格 */}
        <Table
          className="users-table"
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </Card>

      {/* 新增/编辑用户 Modal */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={userModalVisible}
        onOk={handleUserModalOk}
        onCancel={() => setUserModalVisible(false)}
        confirmLoading={userModalLoading}
        destroyOnHidden
        afterOpenChange={handleUserModalOpen}
        width={520}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={userForm}
          layout="vertical"
          autoComplete="off"
          className="users-modal-form"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 2, max: 20, message: '用户名长度为2-20个字符' },
            ]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={
              editingUser
                ? []
                : [
                    { required: true, message: '请输入密码' },
                    { min: 6, max: 30, message: '密码长度为6-30个字符' },
                  ]
            }
            extra={editingUser ? '不修改密码请留空' : ''}
          >
            <Input.Password placeholder={editingUser ? '不修改请留空' : '请输入密码'} />
          </Form.Item>
          <Form.Item
            name="real_name"
            label="真实姓名"
            rules={[{ max: 20, message: '真实姓名最多20个字符' }]}
          >
            <Input placeholder="请输入真实姓名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
            ]}
          >
            <Input placeholder="请输入手机号" maxLength={11} />
          </Form.Item>
          <Form.Item name="department_id" label="部门">
            <TreeSelect
              placeholder="请选择部门"
              allowClear
              treeData={departmentTree}
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="title"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="position" label="岗位"
            rules={[{ max: 50, message: '岗位最多50个字符' }]}
          >
            <Input placeholder="请输入岗位" />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配角色 Modal */}
      <Modal
        title="分配角色"
        open={roleModalVisible}
        onOk={handleRoleModalOk}
        onCancel={() => setRoleModalVisible(false)}
        confirmLoading={roleModalLoading}
        destroyOnHidden
        width={480}
        okText="确定"
        cancelText="取消"
      >
        <div className="users-role-assign">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`每个用户最多可选择 ${maxRoles} 个角色（已选 ${selectedRoleIds.length}/${maxRoles}）`}
          />
          {allRoles.length > 0 ? (
            <Checkbox.Group
              options={allRoles.map((r) => ({
                label: r.role_name,
                value: r.id,
                disabled: selectedRoleIds.length >= maxRoles && !selectedRoleIds.includes(r.id),
              }))}
              value={selectedRoleIds}
              onChange={handleRoleChange}
              className="users-role-checkbox-group"
            />
          ) : (
            <p className="users-role-empty">暂无可分配的角色</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
