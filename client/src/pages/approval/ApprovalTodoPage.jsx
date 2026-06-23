import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs, Table, Tag, Button, Space, Typography, Card,
} from 'antd';
import {
  EyeOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as approvalService from '../../services/approvalService';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

// 状态标签映射
const statusTagMap = {
  pending: { color: 'blue', text: '审批中' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
  withdrawn: { color: 'default', text: '已撤回' },
};

// 获取状态标签
function getStatusTag(status) {
  const tag = statusTagMap[status] || { color: 'default', text: status || '未知' };
  return <Tag color={tag.color}>{tag.text}</Tag>;
}

export default function ApprovalTodoPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [pendingList, setPendingList] = useState([]);
  const [processedList, setProcessedList] = useState([]);
  const [initiatedList, setInitiatedList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 获取列表数据
  const fetchList = useCallback(async (type, page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const res = await approvalService.getInstances({ type, page, pageSize });
      const data = res.data || res;
      let list = [];
      let total = 0;
      if (Array.isArray(data)) {
        list = data;
        total = data.length;
      } else {
        list = data.list || data.records || data.items || [];
        total = data.total || 0;
      }
      if (type === 'pending') setPendingList(list);
      else if (type === 'processed') setProcessedList(list);
      else if (type === 'initiated') setInitiatedList(list);
      setPagination({
        current: (data.current || data.page || page),
        pageSize: (data.pageSize || data.size || pageSize),
        total,
      });
    } catch (err) {
      // 错误信息已由 axios 拦截器统一提示
      if (type === 'pending') setPendingList([]);
      else if (type === 'processed') setProcessedList([]);
      else if (type === 'initiated') setInitiatedList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初次加载待办
  useEffect(() => {
    fetchList('pending');
  }, [fetchList]);

  // Tab切换
  const handleTabChange = (key) => {
    setActiveTab(key);
    fetchList(key);
  };

  // 分页变化
  const handleTableChange = (pag) => {
    fetchList(activeTab, pag.current, pag.pageSize);
  };

  // 刷新
  const handleRefresh = () => {
    fetchList(activeTab, pagination.current, pagination.pageSize);
  };

  // 查看详情
  const handleViewDetail = (record) => {
    navigate(`/approval/detail/${record.id}`);
  };

  // 表格列定义
  const columns = [
    {
      title: '审批标题',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      render: (text, record) => (
        <a onClick={() => handleViewDetail(record)}>{text || record.flow_name || '-'}</a>
      ),
    },
    {
      title: '流程名称',
      dataIndex: 'flow_name',
      key: 'flow_name',
      width: 160,
      render: (text) => text || '-',
    },
    {
      title: '发起人',
      dataIndex: 'initiator_name',
      key: 'initiator_name',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '发起时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  // 渲染表格
  const renderTable = (data) => (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={data}
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
  );

  // Tab项
  const tabItems = [
    {
      key: 'pending',
      label: '待办',
      children: renderTable(pendingList),
    },
    {
      key: 'processed',
      label: '已办',
      children: renderTable(processedList),
    },
    {
      key: 'initiated',
      label: '我发起的',
      children: renderTable(initiatedList),
    },
  ];

  return (
    <div className="approval-todo-page" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>我的审批</Title>
          <span style={{ color: '#888' }}>查看待办、已办及我发起的审批</span>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
      </div>

      <Card variant="borderless">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
        />
      </Card>
    </div>
  );
}
