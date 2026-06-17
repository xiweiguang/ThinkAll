import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Tag, Space, Modal, Form, Switch,
  Select, InputNumber, TreeSelect, message, Popconfirm, Tooltip, Typography
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import {
  getPermissions, createPermission, updatePermission, deletePermission
} from '../services/permissionService';
import { useAuth } from '../contexts/AuthContext';
import './PermissionsPage.css';

const { Title } = Typography;

const PERM_TYPE_MAP = {
  menu: { label: '菜单权限', color: 'blue' },
  button: { label: '按钮权限', color: 'green' },
  api: { label: 'API权限', color: 'orange' }
};

const PERM_TYPE_OPTIONS = [
  { value: 'menu', label: '菜单权限' },
  { value: 'button', label: '按钮权限' },
  { value: 'api', label: 'API权限' }
];

function buildTreeData(list) {
  if (!Array.isArray(list)) return [];
  const map = {};
  const roots = [];
  list.forEach(item => {
    map[item.id] = { ...item, children: [] };
  });
  list.forEach(item => {
    const node = map[item.id];
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}

function flattenTree(tree, result = []) {
  tree.forEach(node => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      flattenTree(node.children, result);
    }
  });
  return result;
}

export default function PermissionsPage() {
  const [allPermissions, setAllPermissions] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedKeys, setExpandedKeys] = useState([]);
  const { hasPermission } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增权限');
  const [editingPerm, setEditingPerm] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [parentTreeData, setParentTreeData] = useState([]);

  const fetchAllPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPermissions({ all: true });
      const data = res.data || res;
      const list = Array.isArray(data) ? data : (data.list || data.records || []);
      setAllPermissions(list);
      const tree = buildTreeData(list);
      setTreeData(tree);
      setExpandedKeys(list.map(p => p.id));
      applyFilters(list, searchText, typeFilter);
      const parentTree = buildParentTreeSelect(list);
      setParentTreeData(parentTree);
    } catch (err) {
      message.error('获取权限列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPermissions();
  }, [fetchAllPermissions]);

  const applyFilters = (list, search, type) => {
    let filtered = list;
    if (search) {
      const kw = search.toLowerCase();
      filtered = filtered.filter(p =>
        (p.permission_name || '').toLowerCase().includes(kw) ||
        (p.permission_code || '').toLowerCase().includes(kw)
      );
    }
    if (type) {
      filtered = filtered.filter(p => p.permission_type === type);
    }
    if (search || type) {
      const matchedIds = new Set(filtered.map(p => p.id));
      const ancestorIds = new Set();
      list.forEach(p => {
        if (matchedIds.has(p.id)) {
          let parentId = p.parent_id;
          while (parentId) {
            ancestorIds.add(parentId);
            const parent = list.find(pp => pp.id === parentId);
            parentId = parent ? parent.parent_id : null;
          }
        }
      });
      const allVisible = new Set([...matchedIds, ...ancestorIds]);
      const visibleList = list.filter(p => allVisible.has(p.id));
      const tree = buildTreeData(visibleList);
      setFilteredData(tree);
      setExpandedKeys([...allVisible]);
    } else {
      const tree = buildTreeData(list);
      setFilteredData(tree);
    }
  };

  const buildParentTreeSelect = (list) => {
    const buildChildren = (parentId) => {
      return list
        .filter(p => p.parent_id === parentId)
        .map(p => ({
          title: p.permission_name || p.name,
          value: p.id,
          key: p.id,
          children: buildChildren(p.id)
        }));
    };
    const roots = list.filter(p => !p.parent_id || p.parent_id === 0);
    return roots.map(p => ({
      title: p.permission_name || p.name,
      value: p.id,
      key: p.id,
      children: buildChildren(p.id)
    }));
  };

  const handleSearch = () => {
    applyFilters(allPermissions, searchText, typeFilter);
  };

  const handleRefresh = () => {
    setSearchText('');
    setTypeFilter('');
    applyFilters(allPermissions, '', '');
  };

  const handleTypeFilterChange = (value) => {
    setTypeFilter(value);
    applyFilters(allPermissions, searchText, value || '');
  };

  const showAddModal = () => {
    setModalTitle('新增权限');
    setEditingPerm(null);
    setModalVisible(true);
  };

  const showEditModal = (record) => {
    setModalTitle('编辑权限');
    setEditingPerm(record);
    setModalVisible(true);
  };

  const handleModalOpen = (open) => {
    if (!open) return;
    setTimeout(() => {
      form.resetFields();
      if (editingPerm) {
        form.setFieldsValue({
          permission_name: editingPerm.permission_name || editingPerm.name,
          permission_code: editingPerm.permission_code || editingPerm.code,
          permission_type: editingPerm.permission_type || editingPerm.type,
          parent_id: editingPerm.parent_id || undefined,
          path: editingPerm.path,
          icon: editingPerm.icon,
          sort_order: editingPerm.sort_order || 0,
          status: editingPerm.status !== false
        });
      } else {
        form.setFieldsValue({ status: true, sort_order: 0 });
      }
    }, 0);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = { ...values };
      if (!payload.parent_id) {
        delete payload.parent_id;
      }
      if (editingPerm) {
        await updatePermission(editingPerm.id, payload);
        message.success('权限更新成功');
      } else {
        await createPermission(payload);
        message.success('权限创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchAllPermissions();
    } catch (err) {
      if (err.errorFields) return;
      message.error(editingPerm ? '权限更新失败' : '权限创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePermission(id);
      message.success('权限删除成功');
      fetchAllPermissions();
    } catch (err) {
      message.error('权限删除失败');
    }
  };

  const getParentName = (parentId) => {
    if (!parentId) return '-';
    const parent = allPermissions.find(p => p.id === parentId);
    return parent ? (parent.permission_name || parent.name || '-') : '-';
  };

  const columns = [
    {
      title: '权限名称',
      dataIndex: 'permission_name',
      key: 'permission_name',
      width: 180,
      render: (text, record) => text || record.name || '-'
    },
    {
      title: '权限编码',
      dataIndex: 'permission_code',
      key: 'permission_code',
      width: 200,
      render: (text, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{text || record.code || '-'}</span>
      )
    },
    {
      title: '权限类型',
      dataIndex: 'permission_type',
      key: 'permission_type',
      width: 110,
      render: (type) => {
        const info = PERM_TYPE_MAP[type];
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{type}</Tag>;
      }
    },
    {
      title: '父级权限',
      dataIndex: 'parent_id',
      key: 'parent_id',
      width: 130,
      render: (parentId) => getParentName(parentId)
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 100,
      render: (text) => text || '-'
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort',
      width: 80,
      render: (text) => text ?? 0
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => (
        status !== false
          ? <Tag color="green">启用</Tag>
          : <Tag color="red">禁用</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {hasPermission('system:permission:update') && (
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => showEditModal(record)}
              />
            </Tooltip>
          )}
          {hasPermission('system:permission:delete') && (
            <Popconfirm
              title="确定删除此权限？"
              description="删除后关联的角色权限也将移除"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="permissions-page">
      <Title level={3}>权限管理</Title>
      <Card>
        <div className="permissions-toolbar">
          <Space wrap>
            <Input.Search
              placeholder="搜索权限名称或编码"
              allowClear
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={handleSearch}
              className="permissions-search-input"
              prefix={<SearchOutlined />}
            />
            <Select
              placeholder="权限类型"
              allowClear
              value={typeFilter || undefined}
              onChange={handleTypeFilterChange}
              className="permissions-type-select"
              options={PERM_TYPE_OPTIONS}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
          </Space>
          {hasPermission('system:permission:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={showAddModal}>
              新增权限
            </Button>
          )}
        </div>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys(keys),
          }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>

      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
        afterOpenChange={handleModalOpen}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="权限名称"
            name="permission_name"
            rules={[{ required: true, message: '请输入权限名称' }]}
          >
            <Input placeholder="请输入权限名称" maxLength={50} />
          </Form.Item>
          <Form.Item
            label="权限编码"
            name="permission_code"
            rules={[{ required: true, message: '请输入权限编码' }]}
          >
            <Input placeholder="请输入权限编码，如 system:user" maxLength={100} disabled={!!editingPerm} />
          </Form.Item>
          <Form.Item
            label="权限类型"
            name="permission_type"
            rules={[{ required: true, message: '请选择权限类型' }]}
          >
            <Select placeholder="请选择权限类型" options={PERM_TYPE_OPTIONS} disabled={!!editingPerm} />
          </Form.Item>
          <Form.Item
            label="父级权限"
            name="parent_id"
          >
            <TreeSelect
              placeholder="请选择父级权限（可选）"
              allowClear
              treeData={parentTreeData}
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item
            label="路径"
            name="path"
          >
            <Input placeholder="请输入路径，如 /users" maxLength={200} />
          </Form.Item>
          <Form.Item
            label="图标"
            name="icon"
          >
            <Input placeholder="请输入图标名称，如 UserOutlined" maxLength={50} />
          </Form.Item>
          <Form.Item
            label="排序"
            name="sort_order"
          >
            <InputNumber min={0} max={9999} style={{ width: '100%' }} placeholder="请输入排序值" />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
