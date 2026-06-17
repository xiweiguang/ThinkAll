import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Typography,
  Tree,
  Input,
  Button,
  Modal,
  Form,
  TreeSelect,
  Switch,
  Tag,
  Space,
  message,
  Popconfirm,
  Spin,
  Empty,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  SearchOutlined,
  ApartmentOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as departmentService from '../services/departmentService';
import { useAuth } from '../contexts/AuthContext';
import './DepartmentsPage.css';

const { Title } = Typography;

export default function DepartmentsPage() {
  const { hasPermission } = useAuth();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [deptModalTitle, setDeptModalTitle] = useState('新增部门');
  const [deptModalMode, setDeptModalMode] = useState('create');
  const [deptForm] = Form.useForm();
  const [deptModalLoading, setDeptModalLoading] = useState(false);

  const dataList = useMemo(() => {
    const list = [];
    const generateList = (nodes) => {
      if (!nodes) return;
      for (const node of nodes) {
        list.push({ key: node.key, title: node.title });
        if (node.children) generateList(node.children);
      }
    };
    generateList(treeData);
    return list;
  }, [treeData]);

  const getParentKey = useCallback((key, tree) => {
    for (const node of tree) {
      if (node.children) {
        if (node.children.some((child) => child.key === key)) {
          return node.key;
        }
        const found = getParentKey(key, node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    fetchDepartmentTree();
  }, []);

  const fetchDepartmentTree = async () => {
    setLoading(true);
    try {
      const res = await departmentService.getDepartmentTree();
      const data = res.data || res;
      const formatted = formatTreeData(Array.isArray(data) ? data : []);
      setTreeData(formatted);
      if (formatted.length > 0 && expandedKeys.length === 0) {
        const keys = getAllKeys(formatted);
        setExpandedKeys(keys);
      }
    } catch (error) {
      if (error.response && error.response.status === 403) {
        message.error('没有权限查看部门列表');
      } else {
        message.error('获取部门树失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTreeData = (nodes) => {
    if (!nodes) return [];
    return nodes.map((node) => ({
      key: String(node.id),
      title: node.department_name || node.name,
      value: String(node.id),
      ...node,
      children: node.children ? formatTreeData(node.children) : undefined,
    }));
  };

  const getAllKeys = (nodes) => {
    const keys = [];
    const traverse = (items) => {
      items.forEach((item) => {
        keys.push(item.key);
        if (item.children) traverse(item.children);
      });
    };
    traverse(nodes);
    return keys;
  };

  const handleSearch = (value) => {
    setSearchValue(value);
    if (!value) {
      setExpandedKeys([]);
      setAutoExpandParent(false);
      return;
    }
    const newExpandedKeys = dataList
      .filter((item) => item.title.indexOf(value) > -1)
      .map((item) => {
        return getParentKey(item.key, treeData);
      })
      .filter((item, i, self) => item && self.indexOf(item) === i);
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(true);
  };

  const handleExpand = (keys) => {
    setExpandedKeys(keys);
    setAutoExpandParent(false);
  };

  const handleTreeSelect = (selectedKeys, info) => {
    if (selectedKeys.length > 0) {
      const dept = findDepartmentByKey(treeData, selectedKeys[0]);
      setSelectedDepartment(dept);
    } else {
      setSelectedDepartment(null);
    }
  };

  const findDepartmentByKey = (nodes, key) => {
    for (const node of nodes) {
      if (String(node.key) === String(key)) return node;
      if (node.children) {
        const found = findDepartmentByKey(node.children, key);
        if (found) return found;
      }
    }
    return null;
  };

  const hasChildren = (dept) => {
    return dept && dept.children && dept.children.length > 0;
  };

  const buildTreeSelectData = (nodes, excludeKey = null) => {
    if (!nodes) return [];
    return nodes
      .filter((node) => String(node.key) !== String(excludeKey))
      .map((node) => ({
        title: node.title,
        value: node.key,
        key: node.key,
        children: node.children
          ? buildTreeSelectData(node.children, excludeKey)
          : undefined,
      }));
  };

  const handleCreateDepartment = () => {
    setDeptModalMode('create');
    setDeptModalTitle('新增部门');
    setDeptModalVisible(true);
  };

  const handleAddChildDepartment = () => {
    if (!selectedDepartment) return;
    setDeptModalMode('create');
    setDeptModalTitle('新增子部门');
    setDeptModalVisible(true);
  };

  const handleEditDepartment = () => {
    if (!selectedDepartment) return;
    setDeptModalMode('edit');
    setDeptModalTitle('编辑部门');
    setDeptModalVisible(true);
  };

  const handleDeptModalOpen = (open) => {
    if (!open) return;
    setTimeout(() => {
      deptForm.resetFields();
      if (deptModalMode === 'edit' && selectedDepartment) {
        deptForm.setFieldsValue({
          department_name: selectedDepartment.department_name || selectedDepartment.name,
          parent_id: selectedDepartment.parent_id ? String(selectedDepartment.parent_id) : undefined,
          leader: selectedDepartment.leader,
          phone: selectedDepartment.phone,
          email: selectedDepartment.email,
          sort_order: selectedDepartment.sort_order || 0,
          status: selectedDepartment.status !== false,
        });
      } else if (deptModalMode === 'create') {
        const isChild = deptModalTitle === '新增子部门';
        deptForm.setFieldsValue({
          parent_id: isChild ? selectedDepartment?.key : undefined,
          status: true,
          sort_order: 0,
        });
      }
    }, 0);
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDepartment) return;
    if (hasChildren(selectedDepartment)) {
      message.warning('该部门下存在子部门，无法删除');
      return;
    }
    try {
      await departmentService.deleteDepartment(selectedDepartment.key);
      message.success('删除成功');
      setSelectedDepartment(null);
      fetchDepartmentTree();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleDeptModalOk = async () => {
    try {
      const values = await deptForm.validateFields();
      setDeptModalLoading(true);
      const submitData = {
        ...values,
        status: values.status !== false,
      };
      if (deptModalMode === 'create') {
        await departmentService.createDepartment(submitData);
        message.success('新增部门成功');
      } else {
        await departmentService.updateDepartment(selectedDepartment.key, submitData);
        message.success('更新部门成功');
      }
      setDeptModalVisible(false);
      fetchDepartmentTree();
      if (deptModalMode === 'edit') {
        const updated = findDepartmentByKey(treeData, selectedDepartment.key);
        if (updated) setSelectedDepartment({ ...updated, ...submitData });
      }
    } catch (error) {
      if (error.errorFields) return;
      message.error(deptModalMode === 'create' ? '新增部门失败' : '更新部门失败');
    } finally {
      setDeptModalLoading(false);
    }
  };

  const renderTreeTitle = (nodeData) => {
    const title = nodeData.title;
    if (searchValue && title.indexOf(searchValue) > -1) {
      const index = title.indexOf(searchValue);
      const beforeStr = title.substring(0, index);
      const matchStr = title.substring(index, index + searchValue.length);
      const afterStr = title.substring(index + searchValue.length);
      return (
        <span>
          {beforeStr}
          <span style={{ color: '#f50' }}>{matchStr}</span>
          {afterStr}
        </span>
      );
    }
    return title;
  };

  const renderDetailPanel = () => {
    if (!selectedDepartment) {
      return (
        <div className="detail-empty">
          <ApartmentOutlined />
          <p>请选择左侧部门查看详情</p>
        </div>
      );
    }

    const dept = selectedDepartment;
    return (
      <div className="detail-content">
        <div className="detail-header">
          <span className="detail-title">{dept.department_name || dept.name || dept.title}</span>
          <Space className="detail-actions" wrap>
            {hasPermission('system:department:create') && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddChildDepartment}
              >
                添加子部门
              </Button>
            )}
            {hasPermission('system:department:update') && (
              <Button icon={<EditOutlined />} onClick={handleEditDepartment}>
                编辑
              </Button>
            )}
            {hasPermission('system:department:delete') && (
              <Popconfirm
                title="确定要删除该部门吗？"
                onConfirm={handleDeleteDepartment}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        <div className="detail-info">
          <div className="info-item">
            <span className="info-label">部门名称</span>
            <span className="info-value">{dept.department_name || dept.name || dept.title}</span>
          </div>
          <div className="info-item">
            <span className="info-label">负责人</span>
            <span className="info-value">{dept.leader || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">电话</span>
            <span className="info-value">{dept.phone || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">邮箱</span>
            <span className="info-value">{dept.email || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">排序</span>
            <span className="info-value">{dept.sort ?? '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">状态</span>
            <span className="info-value">
              {dept.status !== false ? (
                <Tag color="success">启用</Tag>
              ) : (
                <Tag color="default">停用</Tag>
              )}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">创建时间</span>
            <span className="info-value">
              {dept.created_at
                ? dayjs(dept.created_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="departments-page">
      <div className="page-header">
        <Title level={3}>部门管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchDepartmentTree}>
            刷新
          </Button>
          {hasPermission('system:department:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDepartment}>
              新增部门
            </Button>
          )}
        </Space>
      </div>

      <div className="departments-layout">
        <Card
          className="departments-tree-panel"
          title={
            <Space>
              <FolderOutlined />
              <span>部门结构</span>
            </Space>
          }
        >
          <div className="tree-search">
            <Input
              placeholder="搜索部门名称"
              prefix={<SearchOutlined />}
              allowClear
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Spin spinning={loading}>
            {treeData.length > 0 ? (
              <Tree
                className="department-tree"
                treeData={treeData}
                expandedKeys={expandedKeys}
                autoExpandParent={autoExpandParent}
                onExpand={handleExpand}
                onSelect={handleTreeSelect}
                titleRender={renderTreeTitle}
                showLine={{ showLeafIcon: false }}
                showIcon={false}
                defaultSelectedKeys={
                  selectedDepartment ? [selectedDepartment.key] : []
                }
              />
            ) : (
              <Empty description="暂无部门数据" />
            )}
          </Spin>
        </Card>

        <Card
          className="departments-detail-panel"
          title={
            <Space>
              <ApartmentOutlined />
              <span>部门详情</span>
            </Space>
          }
        >
          {renderDetailPanel()}
        </Card>
      </div>

      <Modal
        title={deptModalTitle}
        open={deptModalVisible}
        onOk={handleDeptModalOk}
        onCancel={() => setDeptModalVisible(false)}
        confirmLoading={deptModalLoading}
        destroyOnHidden
        afterOpenChange={handleDeptModalOpen}
        width={520}
      >
        <Form
          form={deptForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="department_name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" maxLength={50} />
          </Form.Item>
          <Form.Item name="parent_id" label="上级部门">
            <TreeSelect
              placeholder="请选择上级部门（留空为顶级部门）"
              treeData={buildTreeSelectData(
                treeData,
                deptModalMode === 'edit' ? selectedDepartment?.key : null
              )}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="leader" label="负责人">
            <Input placeholder="请输入负责人" maxLength={20} />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input placeholder="请输入电话" maxLength={20} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" maxLength={50} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} placeholder="请输入排序号" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
