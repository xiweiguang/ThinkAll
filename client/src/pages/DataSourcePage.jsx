import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Modal,
  Form,
  InputNumber,
  Popconfirm,
  message,
  Tooltip,
  Row,
  Col,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  ApiOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import * as dataSourceService from '../services/dataSourceService';
import { formatDate } from '../utils';
import './DataSourcePage.css';

const DATABASE_TYPES = [
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'SQL Server', value: 'sqlserver' },
  { label: 'Oracle', value: 'oracle' },
];

export default function DataSourcePage() {
  const { hasPermission } = useAuth();

  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  const [testLoading, setTestLoading] = useState(false);

  const fetchDataSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dataSourceService.getDataSources();
      const data = res.data || res;
      const list = Array.isArray(data) ? data : (data?.list || []);
      setDataSources(list);
    } catch (error) {
      message.error('获取数据源列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  const filteredData = dataSources.filter((item) => {
    const matchSearch = !searchText
      || (item.name && item.name.toLowerCase().includes(searchText.toLowerCase()))
      || (item.host && item.host.toLowerCase().includes(searchText.toLowerCase()))
      || (item.database_name && item.database_name.toLowerCase().includes(searchText.toLowerCase()));
    const matchType = !typeFilter || item.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleAdd = () => {
    setEditingRecord(null);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleModalOpen = (open) => {
    if (!open) return;
    setTimeout(() => {
      form.resetFields();
      if (editingRecord) {
        form.setFieldsValue({
          name: editingRecord.name,
          type: editingRecord.type,
          host: editingRecord.host,
          port: editingRecord.port,
          database_name: editingRecord.database_name,
          username: editingRecord.username,
          password: '',
        });
      } else {
        form.setFieldsValue({ type: 'mysql', port: 3306 });
      }
    }, 0);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);
      const submitData = { ...values };
      if (editingRecord) {
        if (!submitData.password) {
          delete submitData.password;
        }
        await dataSourceService.updateDataSource(editingRecord.id, submitData);
        message.success('更新数据源成功');
      } else {
        await dataSourceService.createDataSource(submitData);
        message.success('创建数据源成功');
      }
      setModalVisible(false);
      fetchDataSources();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error(editingRecord ? '更新数据源失败' : '创建数据源失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (record) => {
    try {
      await dataSourceService.deleteDataSource(record.id);
      message.success('删除数据源成功');
      fetchDataSources();
    } catch (error) {
      message.error('删除数据源失败');
    }
  };

  const handleTestConnection = async (record) => {
    setTestLoading(true);
    try {
      const res = await dataSourceService.testExistingConnection(record.id);
      const data = res.data || res;
      if (data.success || data.code === 200) {
        message.success('连接测试成功');
        fetchDataSources();
      } else {
        message.error(data.message || '连接测试失败');
      }
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || '连接测试失败';
      message.error(errMsg);
    } finally {
      setTestLoading(false);
    }
  };

  const handleTestInForm = async () => {
    try {
      const values = await form.validateFields(['type', 'host', 'port', 'database_name', 'username']);
      setTestLoading(true);
      const testData = {
        type: values.type,
        host: values.host,
        port: values.port,
        database_name: values.database_name,
        username: values.username,
        password: form.getFieldValue('password') || undefined,
      };
      const res = await dataSourceService.testConnection(testData);
      const data = res.data || res;
      if (data.success || data.code === 200) {
        message.success('连接测试成功');
      } else {
        message.error(data.message || '连接测试失败');
      }
    } catch (error) {
      if (error.errorFields) {
        message.warning('请先填写必要的连接信息');
        return;
      }
      const errMsg = error?.response?.data?.message || error?.message || '连接测试失败';
      message.error(errMsg);
    } finally {
      setTestLoading(false);
    }
  };

  const getTypeLabel = (type) => {
    const found = DATABASE_TYPES.find((t) => t.value === type);
    return found ? found.label : type || '-';
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => <Tag color="blue">{getTypeLabel(type)}</Tag>,
    },
    {
      title: '主机地址',
      dataIndex: 'host',
      key: 'host',
      width: 160,
      ellipsis: true,
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
    },
    {
      title: '数据库名',
      dataIndex: 'database_name',
      key: 'database_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) =>
        status === 'connected' || status === 'active' ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>已连接</Tag>
        ) : status === 'error' ? (
          <Tag color="red" icon={<CloseCircleOutlined />}>异常</Tag>
        ) : (
          <Tag color="default">未测试</Tag>
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
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {hasPermission('system:datasource:update') && (
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
            </Tooltip>
          )}
          <Tooltip title="测试连接">
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              loading={testLoading}
              onClick={() => handleTestConnection(record)}
            >
              测试
            </Button>
          </Tooltip>
          {hasPermission('system:datasource:delete') && (
            <Popconfirm
              title="确定删除该数据源吗？删除后不可恢复。"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
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
    <div className="datasource-page">
      <Card className="datasource-page-card">
        <Row gutter={[16, 16]} className="datasource-filter-row" align="middle">
          <Col flex="auto">
            <Space wrap size="middle" className="datasource-filter-controls">
              <Input.Search
                placeholder="搜索名称/主机/数据库名"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="datasource-search-input"
                prefix={<SearchOutlined />}
                enterButton="搜索"
              />
              <Select
                placeholder="类型筛选"
                allowClear
                value={typeFilter}
                onChange={(val) => setTypeFilter(val)}
                className="datasource-type-select"
                options={DATABASE_TYPES}
              />
              <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); setTypeFilter(undefined); }}>
                重置
              </Button>
            </Space>
          </Col>
          <Col>
            {hasPermission('system:datasource:create') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} block={window.innerWidth < 768}>
                新增数据源
              </Button>
            )}
          </Col>
        </Row>

        <Table
          className="datasource-table"
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑数据源' : '新增数据源'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        confirmLoading={modalLoading}
        destroyOnHidden
        afterOpenChange={handleModalOpen}
        width={560}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          className="datasource-modal-form"
        >
          <Form.Item
            name="name"
            label="数据源名称"
            rules={[
              { required: true, message: '请输入数据源名称' },
              { max: 50, message: '名称最多50个字符' },
            ]}
          >
            <Input placeholder="请输入数据源名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select placeholder="请选择数据库类型" options={DATABASE_TYPES} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="host"
                label="主机地址"
                rules={[{ required: true, message: '请输入主机地址' }]}
              >
                <Input placeholder="请输入主机地址，如 127.0.0.1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: '请输入端口' }]}
              >
                <InputNumber placeholder="端口" min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="database_name"
            label="数据库名"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="请输入数据库名" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={
              editingRecord
                ? []
                : [{ required: true, message: '请输入密码' }]
            }
            extra={editingRecord ? '不修改密码请留空' : ''}
          >
            <Input.Password placeholder={editingRecord ? '不修改请留空' : '请输入密码'} />
          </Form.Item>
          <Form.Item>
            <Button
              icon={<ApiOutlined />}
              onClick={handleTestInForm}
              loading={testLoading}
              style={{ width: '100%' }}
            >
              测试连接
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
