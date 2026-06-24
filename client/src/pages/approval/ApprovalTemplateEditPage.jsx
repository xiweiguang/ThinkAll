import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Form, Input, Select, Switch, Space, InputNumber, Radio, Checkbox,
  message, Modal, Typography, Row, Col, Divider, Tag, Empty, Tooltip, Popconfirm,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, SaveOutlined,
  RollbackOutlined, EditOutlined, HolderOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import * as approvalService from '../../services/approvalService';
import api from '../../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 字段类型定义
const FIELD_TYPES = [
  { value: 'input', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'number', label: '数字' },
  { value: 'radio', label: '单选' },
  { value: 'checkbox', label: '多选' },
  { value: 'date', label: '日期' },
  { value: 'daterange', label: '日期范围' },
  { value: 'money', label: '金额' },
  { value: 'file', label: '附件' },
  { value: 'description', label: '说明文字' },
];

// 字段类型标签映射
const fieldTypeLabelMap = FIELD_TYPES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

// 审批人类型
const APPROVER_TYPES = [
  { value: 'user', label: '指定人' },
  { value: 'role', label: '指定角色' },
];

// 审批范围（角色类型时使用）
const SCOPE_TYPES = [
  { value: 'all', label: '全部' },
  { value: 'first_level', label: '一级部门' },
  { value: 'second_level', label: '二级部门' },
];

// 生成唯一ID
function genId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export default function ApprovalTemplateEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  // 基础信息表单
  const [basicForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // 表单字段列表
  const [formFields, setFormFields] = useState([]);
  // 审批节点列表
  const [approvalNodes, setApprovalNodes] = useState([]);

  // 字段编辑弹窗
  const [fieldModalVisible, setFieldModalVisible] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState(-1);
  const [fieldForm] = Form.useForm();

  // 节点编辑弹窗
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [editingNodeIndex, setEditingNodeIndex] = useState(-1);
  const [nodeForm] = Form.useForm();

  // 用户列表和角色列表
  const [userList, setUserList] = useState([]);
  const [roleList, setRoleList] = useState([]);

  // 加载用户和角色数据
  const fetchUsersAndRoles = useCallback(async () => {
    try {
      const [userRes, roleRes] = await Promise.all([
        api.get('/address-book'),
        api.get('/roles', { params: { all: true } }),
      ]);
      // 通讯录返回的是部门树，需要扁平化提取用户
      const userData = userRes.data || userRes;
      const users = extractUsersFromAddressBook(userData);
      setUserList(users);

      const roleData = roleRes.data || roleRes;
      const roles = Array.isArray(roleData) ? roleData : (roleData.list || roleData.records || []);
      setRoleList(roles);
    } catch (err) {
      // 错误信息已由 axios 拦截器统一提示
      setUserList([]);
      setRoleList([]);
    }
  }, []);

  // 从通讯录部门树中提取所有用户
  const extractUsersFromAddressBook = (data) => {
    const users = [];
    if (!Array.isArray(data)) return users;
    const traverse = (nodes) => {
      for (const node of nodes) {
        if (node.users && Array.isArray(node.users)) {
          for (const u of node.users) {
            users.push({
              id: u.id,
              name: u.name || u.real_name || u.username,
              username: u.username,
            });
          }
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(data);
    return users;
  };

  // 加载流程详情
  const fetchFlowDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await approvalService.getFlowById(id);
      const data = res.data || res;
      basicForm.setFieldsValue({
        name: data.name,
        icon: data.icon,
        description: data.description,
        status: data.status !== false && data.status !== 0,
      });
      // 解析 form_config
      let formConfig = data.form_config;
      if (typeof formConfig === 'string') {
        try {
          formConfig = JSON.parse(formConfig);
        } catch (e) {
          formConfig = [];
        }
      }
      setFormFields(Array.isArray(formConfig) ? formConfig : []);
      // 解析 approval_config
      let approvalConfig = data.approval_config;
      if (typeof approvalConfig === 'string') {
        try {
          approvalConfig = JSON.parse(approvalConfig);
        } catch (e) {
          approvalConfig = [];
        }
      }
      setApprovalNodes(Array.isArray(approvalConfig) ? approvalConfig : []);
    } catch (err) {
      // 错误信息已由 axios 拦截器统一提示
    } finally {
      setLoading(false);
    }
  }, [id, basicForm]);

  useEffect(() => {
    fetchUsersAndRoles();
    if (isEdit) {
      fetchFlowDetail();
    } else {
      basicForm.setFieldsValue({ status: true });
    }
  }, [fetchUsersAndRoles, fetchFlowDetail, isEdit, basicForm]);

  // ========== 表单字段操作 ==========
  // 打开字段编辑弹窗（新增或编辑）
  const openFieldModal = (index = -1) => {
    setEditingFieldIndex(index);
    if (index >= 0 && formFields[index]) {
      const field = formFields[index];
      fieldForm.setFieldsValue({
        type: field.type,
        label: field.label,
        fieldKey: field.fieldKey,
        required: !!field.required,
        placeholder: field.placeholder,
        options: Array.isArray(field.options) ? field.options.join('\n') : '',
      });
    } else {
      fieldForm.resetFields();
      fieldForm.setFieldsValue({ type: 'input', required: false });
    }
    setFieldModalVisible(true);
  };

  // 保存字段
  const handleFieldSave = async () => {
    try {
      const values = await fieldForm.validateFields();
      const newField = {
        type: values.type,
        label: values.label,
        fieldKey: values.fieldKey,
        required: !!values.required,
        placeholder: values.placeholder || '',
        options: (values.type === 'radio' || values.type === 'checkbox') && values.options
          ? values.options.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
      };
      if (editingFieldIndex >= 0) {
        const newFields = [...formFields];
        newFields[editingFieldIndex] = newField;
        setFormFields(newFields);
        message.success('字段已更新');
      } else {
        setFormFields([...formFields, newField]);
        message.success('字段已添加');
      }
      setFieldModalVisible(false);
    } catch (err) {
      if (err.errorFields) return;
    }
  };

  // 删除字段
  const handleFieldDelete = (index) => {
    const newFields = formFields.filter((_, i) => i !== index);
    setFormFields(newFields);
    message.success('字段已删除');
  };

  // 字段上移
  const handleFieldUp = (index) => {
    if (index === 0) return;
    const newFields = [...formFields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    setFormFields(newFields);
  };

  // 字段下移
  const handleFieldDown = (index) => {
    if (index === formFields.length - 1) return;
    const newFields = [...formFields];
    [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
    setFormFields(newFields);
  };

  // ========== 审批节点操作 ==========
  // 打开节点编辑弹窗
  const openNodeModal = (index = -1) => {
    setEditingNodeIndex(index);
    if (index >= 0 && approvalNodes[index]) {
      const node = approvalNodes[index];
      nodeForm.setFieldsValue({
        name: node.name,
        approverType: node.approverType || 'user',
        approverId: node.approverId,
        approverName: node.approverName,
        scope: node.scope || 'all',
        description: node.description || '',
      });
    } else {
      nodeForm.resetFields();
      nodeForm.setFieldsValue({ approverType: 'user', scope: 'all' });
    }
    setNodeModalVisible(true);
  };

  // 保存节点
  const handleNodeSave = async () => {
    try {
      const values = await nodeForm.validateFields();
      // 获取审批人名称用于显示
      let approverName = '';
      if (values.approverType === 'user') {
        const user = userList.find(u => u.id === values.approverId);
        approverName = user ? user.name : '';
      } else if (values.approverType === 'role') {
        const role = roleList.find(r => r.id === values.approverId);
        approverName = role ? (role.role_name || role.name) : '';
      }
      const newNode = {
        name: values.name,
        approverType: values.approverType,
        approverId: values.approverId,
        approverName,
        scope: values.approverType === 'role' ? (values.scope || 'all') : 'all',
        description: values.description || '',
      };
      if (editingNodeIndex >= 0) {
        const newNodes = [...approvalNodes];
        newNodes[editingNodeIndex] = newNode;
        setApprovalNodes(newNodes);
        message.success('节点已更新');
      } else {
        setApprovalNodes([...approvalNodes, newNode]);
        message.success('节点已添加');
      }
      setNodeModalVisible(false);
    } catch (err) {
      if (err.errorFields) return;
    }
  };

  // 删除节点
  const handleNodeDelete = (index) => {
    const newNodes = approvalNodes.filter((_, i) => i !== index);
    setApprovalNodes(newNodes);
    message.success('节点已删除');
  };

  // 节点上移
  const handleNodeUp = (index) => {
    if (index === 0) return;
    const newNodes = [...approvalNodes];
    [newNodes[index - 1], newNodes[index]] = [newNodes[index], newNodes[index - 1]];
    setApprovalNodes(newNodes);
  };

  // 节点下移
  const handleNodeDown = (index) => {
    if (index === approvalNodes.length - 1) return;
    const newNodes = [...approvalNodes];
    [newNodes[index + 1], newNodes[index]] = [newNodes[index], newNodes[index + 1]];
    setApprovalNodes(newNodes);
  };

  // ========== 保存流程 ==========
  const handleSave = async () => {
    try {
      const values = await basicForm.validateFields();
      // 校验表单字段
      if (formFields.length === 0) {
        message.warning('请至少添加一个表单字段');
        return;
      }
      // 校验字段标识唯一性
      const fieldKeys = formFields.map(f => f.fieldKey).filter(Boolean);
      const uniqueKeys = new Set(fieldKeys);
      if (uniqueKeys.size !== fieldKeys.length) {
        message.warning('存在重复的字段标识，请检查');
        return;
      }
      // 校验审批节点
      if (approvalNodes.length === 0) {
        message.warning('请至少添加一个审批节点');
        return;
      }
      // 校验节点名称唯一性
      const nodeNames = approvalNodes.map(n => n.name).filter(Boolean);
      const uniqueNames = new Set(nodeNames);
      if (uniqueNames.size !== nodeNames.length) {
        message.warning('存在重复的节点名称，请检查');
        return;
      }

      setSubmitting(true);
      const payload = {
        name: values.name,
        icon: values.icon || '',
        description: values.description || '',
        status: !!values.status,
        form_config: JSON.stringify(formFields),
        approval_config: JSON.stringify(approvalNodes),
      };
      if (isEdit) {
        await approvalService.updateFlow(id, payload);
        message.success('流程更新成功');
      } else {
        await approvalService.createFlow(payload);
        message.success('流程创建成功');
      }
      navigate('/approval/templates');
    } catch (err) {
      if (err.errorFields) return;
      // 错误信息已由 axios 拦截器统一提示
    } finally {
      setSubmitting(false);
    }
  };

  // 返回
  const handleBack = () => {
    navigate('/approval/templates');
  };

  // 当前编辑字段的类型
  const currentFieldType = Form.useWatch('type', fieldForm);
  // 当前编辑节点的审批人类型
  const currentApproverType = Form.useWatch('approverType', nodeForm);

  return (
    <div className="approval-template-edit-page" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{isEdit ? '编辑流程' : '新建流程'}</Title>
          <span style={{ color: '#888' }}>设计审批表单和审批流</span>
        </div>
        <Space>
          <Button icon={<RollbackOutlined />} onClick={handleBack}>返回</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
            保存
          </Button>
        </Space>
      </div>

      {/* 基础信息 */}
      <Card title="基础信息" size="small" style={{ marginBottom: 16 }} loading={loading}>
        <Form form={basicForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="name"
                label="流程名称"
                rules={[{ required: true, message: '请输入流程名称' }]}
              >
                <Input placeholder="请输入流程名称" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="icon" label="图标">
                <Input placeholder="如：📝" maxLength={10} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="description" label="描述">
                <Input placeholder="请输入流程描述" maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="status" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Row gutter={16}>
        {/* 左侧：表单设计区 */}
        <Col span={12}>
          <Card
            title="表单设计"
            size="small"
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openFieldModal(-1)}>
                添加字段
              </Button>
            }
          >
            {formFields.length === 0 ? (
              <Empty description="暂无字段，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {formFields.map((field, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      marginBottom: 8,
                      border: '1px solid #f0f0f0',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#fafafa',
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <HolderOutlined style={{ color: '#999', cursor: 'move' }} />
                      <Tag color="blue">{fieldTypeLabelMap[field.type] || field.type}</Tag>
                      <Text strong>{field.label}</Text>
                      {field.required && <Tag color="red">必填</Tag>}
                      <Text type="secondary" style={{ fontSize: 12 }}>{field.fieldKey}</Text>
                    </div>
                    <Space size="small">
                      <Tooltip title="上移">
                        <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => handleFieldUp(index)} />
                      </Tooltip>
                      <Tooltip title="下移">
                        <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === formFields.length - 1} onClick={() => handleFieldDown(index)} />
                      </Tooltip>
                      <Tooltip title="编辑">
                        <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openFieldModal(index)} />
                      </Tooltip>
                      <Popconfirm
                        title="确认删除"
                        description="确定要删除此字段吗？"
                        onConfirm={() => handleFieldDelete(index)}
                        okText="确定"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title="删除">
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* 右侧：审批流配置区 */}
        <Col span={12}>
          <Card
            title="审批流配置"
            size="small"
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openNodeModal(-1)}>
                添加节点
              </Button>
            }
          >
            {approvalNodes.length === 0 ? (
              <Empty description="暂无节点，请添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {approvalNodes.map((node, index) => (
                  <div key={index}>
                    <div
                      style={{
                        padding: '8px 12px',
                        marginBottom: 8,
                        border: '1px solid #f0f0f0',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#fafafa',
                      }}
                    >
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Tag color="orange">节点 {index + 1}</Tag>
                        <Text strong>{node.name}</Text>
                        <Tag color={node.approverType === 'user' ? 'green' : 'purple'}>
                          {node.approverType === 'user' ? '指定人' : '指定角色'}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {node.approverName || '-'}
                          {node.approverType === 'role' && node.scope && node.scope !== 'all' ? `（${SCOPE_TYPES.find(s => s.value === node.scope)?.label || node.scope}）` : ''}
                        </Text>
                      </div>
                      <Space size="small">
                        <Tooltip title="上移">
                          <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => handleNodeUp(index)} />
                        </Tooltip>
                        <Tooltip title="下移">
                          <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === approvalNodes.length - 1} onClick={() => handleNodeDown(index)} />
                        </Tooltip>
                        <Tooltip title="编辑">
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openNodeModal(index)} />
                        </Tooltip>
                        <Popconfirm
                          title="确认删除"
                          description="确定要删除此节点吗？"
                          onConfirm={() => handleNodeDelete(index)}
                          okText="确定"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <Tooltip title="删除">
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </div>
                    {node.description && (
                      <div style={{ paddingLeft: 24, paddingBottom: 8, color: '#888', fontSize: 12 }}>
                        {node.description}
                      </div>
                    )}
                    {index < approvalNodes.length - 1 && (
                      <div style={{ textAlign: 'center', color: '#ccc', marginBottom: 4 }}>
                        ↓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 字段编辑弹窗 */}
      <Modal
        title={editingFieldIndex >= 0 ? '编辑字段' : '添加字段'}
        open={fieldModalVisible}
        onOk={handleFieldSave}
        onCancel={() => setFieldModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={fieldForm} layout="vertical" preserve={false}>
          <Form.Item
            name="type"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select options={FIELD_TYPES} placeholder="请选择字段类型" />
          </Form.Item>
          <Form.Item
            name="label"
            label="字段名称"
            rules={[{ required: true, message: '请输入字段名称' }]}
          >
            <Input placeholder="请输入字段名称" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="fieldKey"
            label="字段标识"
            rules={[
              { required: true, message: '请输入字段标识' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '只能包含字母、数字和下划线，且以字母开头' },
            ]}
            extra="用于后端识别字段，建议使用英文"
          >
            <Input placeholder="如：reason" maxLength={50} />
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="必填" unCheckedChildren="选填" />
          </Form.Item>
          {currentFieldType !== 'description' && (
            <Form.Item name="placeholder" label="占位提示">
              <Input placeholder="请输入占位提示文字" maxLength={100} />
            </Form.Item>
          )}
          {(currentFieldType === 'radio' || currentFieldType === 'checkbox') && (
            <Form.Item
              name="options"
              label="选项"
              rules={[{ required: true, message: '请输入选项' }]}
              extra="每行一个选项"
            >
              <TextArea rows={4} placeholder={'选项1\n选项2\n选项3'} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 节点编辑弹窗 */}
      <Modal
        title={editingNodeIndex >= 0 ? '编辑节点' : '添加节点'}
        open={nodeModalVisible}
        onOk={handleNodeSave}
        onCancel={() => setNodeModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={nodeForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="节点名称"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="如：部门经理审批" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="approverType"
            label="审批人类型"
            rules={[{ required: true, message: '请选择审批人类型' }]}
          >
            <Radio.Group options={APPROVER_TYPES} />
          </Form.Item>
          {currentApproverType === 'user' && (
            <Form.Item
              name="approverId"
              label="审批人"
              rules={[{ required: true, message: '请选择审批人' }]}
            >
              <Select
                showSearch
                placeholder="请选择审批人"
                optionFilterProp="label"
                options={userList.map(u => ({ value: u.id, label: u.name }))}
              />
            </Form.Item>
          )}
          {currentApproverType === 'role' && (
            <>
              <Form.Item
                name="approverId"
                label="审批角色"
                rules={[{ required: true, message: '请选择审批角色' }]}
              >
                <Select
                  showSearch
                  placeholder="请选择审批角色"
                  optionFilterProp="label"
                  options={roleList.map(r => ({ value: r.id, label: r.role_name || r.name }))}
                />
              </Form.Item>
              <Form.Item name="scope" label="审批范围" rules={[{ required: true, message: '请选择审批范围' }]}>
                <Select options={SCOPE_TYPES} placeholder="请选择审批范围" />
              </Form.Item>
            </>
          )}
          <Form.Item name="description" label="节点描述">
            <TextArea rows={2} placeholder="请输入节点描述（可选）" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
