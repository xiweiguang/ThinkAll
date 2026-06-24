import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Table, Space, Tag, Popconfirm, message, Typography, Input, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as approvalService from '../../services/approvalService';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

// 状态标签映射
const statusTagMap = {
  true: { color: 'green', text: '启用' },
  false: { color: 'red', text: '禁用' },
};

// 图标渲染：将字符串图标名渲染为对应字符显示
function renderIcon(icon) {
  if (!icon) return <Tag>默认</Tag>;
  return <span style={{ fontSize: 16 }}>{icon}</span>;
}

export default function ApprovalTemplateListPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 获取流程模板列表
  const fetchFlows = useCallback(async (page = 1, pageSize = 10, search = '') => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (search) params.keyword = search;
      const res = await approvalService.getFlows(params);
      const data = res.data || res;
      // 兼容数组和分页对象两种返回格式
      if (Array.isArray(data)) {
        setFlows(data);
        setPagination(prev => ({ ...prev, current: page, pageSize, total: data.length }));
      } else {
        const list = data.list || data.records || data.items || [];
        setFlows(list);
        setPagination({
          current: data.current || data.page || page,
          pageSize: data.pageSize || data.size || pageSize,
          total: data.total || 0,
        });
      }
    } catch (err) {
      // 错误信息已由 axios 拦截器统一提示
      setFlows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // 搜索
  const handleSearch = () => {
    fetchFlows(1, pagination.pageSize, searchText);
  };

  // 刷新
  const handleRefresh = () => {
    setSearchText('');
    fetchFlows(1, pagination.pageSize, '');
  };

  // 分页变化
  const handleTableChange = (pag) => {
    fetchFlows(pag.current, pag.pageSize, searchText);
  };

  // 新建流程
  const handleCreate = () => {
    navigate('/approval/template-edit');
  };

  // 编辑流程
  const handleEdit = (record) => {
    navigate(`/approval/template-edit/${record.id}`);
  };

  // 删除流程
  const handleDelete = async (record) => {
    try {
      await approvalService.deleteFlow(record.id);
      message.success('流程删除成功');
      fetchFlows(pagination.current, pagination.pageSize, searchText);
    } catch (err) {
      // 错误信息已由 axios 拦截器统一提示
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '流程名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => <span style={{ fontWeight: 500 }}>{text || '-'}</span>,
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (icon) => renderIcon(icon),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span>{text || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const tag = statusTagMap[status === true || status === 1 ? 'true' : 'false'] || { color: 'default', text: '未知' };
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {hasPermission('approval:template:update') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {hasPermission('approval:template:delete') && (
            <Popconfirm
              title="确认删除"
              description={`确定要删除流程"${record.name}"吗？`}
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="approval-template-list-page" style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>审批管理</Title>
        <span style={{ color: '#888' }}>管理审批流程模板，配置表单和审批流</span>
      </div>

      <Card variant="borderless">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search
              placeholder="搜索流程名称"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
          </Space>
          {hasPermission('approval:template:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建流程
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={flows}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>
    </div>
  );
}
