import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Descriptions, Steps, Timeline, Button, Modal, Input, Form, message,
  Tag, Typography, Spin, Empty, Space, Select, Alert,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, ForwardOutlined, RollbackOutlined,
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import * as approvalService from '../../services/approvalService';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 实例状态标签映射
const statusTagMap = {
  pending: { color: 'blue', text: '审批中' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
  withdrawn: { color: 'default', text: '已撤回' },
};

// 节点状态标签映射
const nodeStatusMap = {
  pending: { color: 'blue', text: '待审批' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
  withdrawn: { color: 'default', text: '已撤回' },
  current: { color: 'processing', text: '审批中' },
};

// 字段类型标签映射
const fieldTypeLabelMap = {
  input: '单行文本',
  textarea: '多行文本',
  number: '数字',
  radio: '单选',
  checkbox: '多选',
  date: '日期',
  daterange: '日期范围',
  money: '金额',
  file: '附件',
  description: '说明文字',
};

export default function ApprovalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [formConfig, setFormConfig] = useState([]);
  const [approvalNodes, setApprovalNodes] = useState([]);
  const [nodeRecords, setNodeRecords] = useState([]);

  // 操作弹窗
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState(''); // approve / reject / transfer / withdraw
  const [actionForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [userList, setUserList] = useState([]);

  // 获取审批详情
  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await approvalService.getInstanceById(id);
      const data = res.data || res;
      setDetail(data);
      // 解析 form_config
      let config = data.form_config;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (e) {
          config = [];
        }
      }
      setFormConfig(Array.isArray(config) ? config : []);
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
      // 审批记录
      setNodeRecords(Array.isArray(data.node_records) ? data.node_records : (Array.isArray(data.records) ? data.records : []));
    } catch (err) {
      // 错误信息已由 axios 拦截器统一提示
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 获取用户列表（用于转交）
  const fetchUserList = useCallback(async () => {
    try {
      const res = await api.get('/address-book');
      const data = res.data || res;
      const users = extractUsersFromAddressBook(data);
      setUserList(users);
    } catch (err) {
      setUserList([]);
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

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // 是否为当前审批人（实例状态为pending且当前用户在待审批节点的审批人中）
  const isCurrentApprover = () => {
    if (!detail || detail.status !== 'pending') return false;
    // 后端通常会返回 is_current_approver 字段
    if (detail.is_current_approver !== undefined) return !!detail.is_current_approver;
    // 兜底：检查当前节点审批人
    if (!user) return false;
    const currentNode = nodeRecords.find(r => r.status === 'pending' || r.status === 'current');
    if (!currentNode) return false;
    return currentNode.approver_id === user.id || currentNode.approver_id === user.username;
  };

  // 是否为发起人
  const isInitiator = () => {
    if (!detail || !user) return false;
    return detail.initiator_id === user.id || detail.initiator_id === user.username;
  };

  // 打开操作弹窗
  const openActionModal = (type) => {
    setActionType(type);
    actionForm.resetFields();
    setActionModalVisible(true);
    if (type === 'transfer') {
      fetchUserList();
    }
  };

  // 提交操作
  const handleActionSubmit = async () => {
    try {
      const values = await actionForm.validateFields();
      setSubmitting(true);
      const payload = { ...values };
      if (actionType === 'approve') {
        await approvalService.approveInstance(id, payload);
        message.success('已同意审批');
      } else if (actionType === 'reject') {
        await approvalService.rejectInstance(id, payload);
        message.success('已拒绝审批');
      } else if (actionType === 'transfer') {
        await approvalService.transferInstance(id, payload);
        message.success('已转交审批');
      } else if (actionType === 'withdraw') {
        await approvalService.withdrawInstance(id, payload);
        message.success('已撤回审批');
      }
      setActionModalVisible(false);
      fetchDetail();
    } catch (err) {
      if (err.errorFields) return;
      // 错误信息已由 axios 拦截器统一提示
    } finally {
      setSubmitting(false);
    }
  };

  // 返回
  const handleBack = () => {
    navigate('/approval/todo');
  };

  // 渲染表单数据
  const renderFormData = () => {
    if (!detail) return null;
    const formData = detail.form_data || {};
    if (formConfig.length === 0) {
      // 没有 form_config 时，直接展示 form_data 的键值对
      const entries = Object.entries(formData);
      if (entries.length === 0) {
        return <Empty description="无表单数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
      }
      return (
        <Descriptions bordered column={1} size="small">
          {entries.map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {formatValue(value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      );
    }
    return (
      <Descriptions bordered column={1} size="small">
        {formConfig.map((field) => {
          let value = formData[field.fieldKey];
          // 描述类型字段直接显示
          if (field.type === 'description') {
            return (
              <Descriptions.Item key={field.fieldKey} label={field.label}>
                <Alert type="info" message={field.placeholder || field.label} showIcon />
              </Descriptions.Item>
            );
          }
          return (
            <Descriptions.Item key={field.fieldKey} label={field.label}>
              {formatValue(value, field.type)}
            </Descriptions.Item>
          );
        })}
      </Descriptions>
    );
  };

  // 格式化值显示
  const formatValue = (value, type) => {
    if (value === undefined || value === null || value === '') return '-';
    if (type === 'money') {
      return `¥ ${Number(value).toFixed(2)}`;
    }
    if (type === 'date' && typeof value === 'string') {
      return value;
    }
    if (type === 'daterange' && Array.isArray(value)) {
      return value.join(' 至 ');
    }
    if (type === 'file' && Array.isArray(value)) {
      return (
        <Space direction="vertical" size="small">
          {value.map((f, idx) => (
            <a key={idx} href={f.url} target="_blank" rel="noopener noreferrer">
              📎 {f.name}
            </a>
          ))}
        </Space>
      );
    }
    if (Array.isArray(value)) {
      return value.join('、');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  // 渲染审批流程
  const renderApprovalFlow = () => {
    if (approvalNodes.length === 0 && nodeRecords.length === 0) {
      return <Empty description="无审批流程" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    // 优先使用审批记录构建时间线
    if (nodeRecords.length > 0) {
      const timelineItems = nodeRecords.map((record, index) => {
        const status = record.status || 'pending';
        let color = 'blue';
        let dot = <ClockCircleOutlined style={{ fontSize: 16 }} />;
        if (status === 'approved') {
          color = 'green';
          dot = <CheckCircleOutlined style={{ fontSize: 16, color: '#52c41a' }} />;
        } else if (status === 'rejected') {
          color = 'red';
          dot = <CloseCircleOutlined style={{ fontSize: 16, color: '#ff4d4f' }} />;
        } else if (status === 'withdrawn') {
          color = 'gray';
        } else if (status === 'current' || status === 'pending') {
          color = 'blue';
          dot = <ClockCircleOutlined style={{ fontSize: 16, color: '#1890ff' }} />;
        }
        return {
          color,
          dot,
          children: (
            <div style={{ paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text strong>{record.node_name || `节点 ${index + 1}`}</Text>
                {(() => {
                  const tag = nodeStatusMap[status] || { color: 'default', text: status };
                  return <Tag color={tag.color}>{tag.text}</Tag>;
                })()}
              </div>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                审批人：{record.approver_name || record.approver || '-'}
              </div>
              {record.comment && (
                <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                  审批意见：{record.comment}
                </div>
              )}
              {record.operated_at && (
                <div style={{ color: '#999', fontSize: 12 }}>
                  操作时间：{dayjs(record.operated_at).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              )}
            </div>
          ),
        };
      });
      return <Timeline items={timelineItems} />;
    }

    // 兜底：使用审批节点配置构建 Steps
    const currentStep = detail?.current_node_index || 0;
    const stepsItems = approvalNodes.map((node, index) => {
      let status = 'wait';
      if (detail?.status === 'approved') {
        status = 'finish';
      } else if (detail?.status === 'rejected' && index === currentStep) {
        status = 'error';
      } else if (index < currentStep) {
        status = 'finish';
      } else if (index === currentStep) {
        status = 'process';
      }
      return {
        title: node.name,
        description: (
          <div style={{ fontSize: 12 }}>
            <div>审批人：{node.approverName || '-'}</div>
            {node.description && <div style={{ color: '#999' }}>{node.description}</div>}
          </div>
        ),
        status,
      };
    });
    return <Steps current={currentStep} direction="vertical" items={stepsItems} size="small" />;
  };

  // 操作弹窗标题
  const getActionModalTitle = () => {
    switch (actionType) {
      case 'approve': return '同意审批';
      case 'reject': return '拒绝审批';
      case 'transfer': return '转交审批';
      case 'withdraw': return '撤回审批';
      default: return '审批操作';
    }
  };

  // 操作弹窗确认按钮文本
  const getActionOkText = () => {
    switch (actionType) {
      case 'approve': return '确认同意';
      case 'reject': return '确认拒绝';
      case 'transfer': return '确认转交';
      case 'withdraw': return '确认撤回';
      default: return '确定';
    }
  };

  return (
    <div className="approval-detail-page" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>审批详情</Title>
          <span style={{ color: '#888' }}>查看审批表单和流程</span>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回</Button>
      </div>

      <Spin spinning={loading}>
        {detail ? (
          <>
            {/* 基础信息 */}
            <Card title="基础信息" size="small" style={{ marginBottom: 16 }} variant="borderless">
              <Descriptions size="small" column={3}>
                <Descriptions.Item label="审批标题">{detail.title || detail.flow_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="流程名称">{detail.flow_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="发起人">{detail.initiator_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {(() => {
                    const tag = statusTagMap[detail.status] || { color: 'default', text: detail.status || '-' };
                    return <Tag color={tag.color}>{tag.text}</Tag>;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="发起时间">
                  {detail.created_at ? dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {detail.updated_at ? dayjs(detail.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 表单数据 */}
            <Card title="表单数据" size="small" style={{ marginBottom: 16 }} variant="borderless">
              {renderFormData()}
            </Card>

            {/* 审批流程 */}
            <Card title="审批流程" size="small" style={{ marginBottom: 16 }} variant="borderless">
              {renderApprovalFlow()}
            </Card>

            {/* 操作区 */}
            <Card title="操作" size="small" variant="borderless">
              {detail.status === 'pending' && isCurrentApprover() && (
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => openActionModal('approve')}
                  >
                    同意
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => openActionModal('reject')}
                  >
                    拒绝
                  </Button>
                  <Button
                    icon={<ForwardOutlined />}
                    onClick={() => openActionModal('transfer')}
                  >
                    转交
                  </Button>
                </Space>
              )}
              {detail.status === 'pending' && isInitiator() && (
                <Space wrap>
                  <Button
                    icon={<RollbackOutlined />}
                    onClick={() => openActionModal('withdraw')}
                    danger
                  >
                    撤回
                  </Button>
                </Space>
              )}
              {detail.status !== 'pending' && (
                <Empty description="审批已结束，无可用操作" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              {detail.status === 'pending' && !isCurrentApprover() && !isInitiator() && (
                <Empty description="当前无可用操作" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </>
        ) : (
          !loading && <Empty description="未找到审批详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Spin>

      {/* 操作弹窗 */}
      <Modal
        title={getActionModalTitle()}
        open={actionModalVisible}
        onOk={handleActionSubmit}
        onCancel={() => setActionModalVisible(false)}
        okText={getActionOkText()}
        cancelText="取消"
        confirmLoading={submitting}
        okButtonProps={actionType === 'reject' || actionType === 'withdraw' ? { danger: true } : {}}
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical" preserve={false}>
          {actionType === 'transfer' && (
            <Form.Item
              name="transfer_to"
              label="转交给"
              rules={[{ required: true, message: '请选择转交人' }]}
            >
              <Select
                showSearch
                placeholder="请选择转交人"
                optionFilterProp="label"
                options={userList.map(u => ({ value: u.id, label: u.name }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="comment"
            label={actionType === 'transfer' ? '转交说明' : '审批意见'}
            rules={actionType === 'reject' ? [{ required: true, message: '请输入审批意见' }] : []}
          >
            <TextArea rows={4} placeholder={actionType === 'reject' ? '请输入拒绝原因（必填）' : '请输入审批意见（选填）'} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
