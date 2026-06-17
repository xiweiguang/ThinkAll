import React from 'react';
import { Table, Button, Tooltip, Tag, Popconfirm, Avatar } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';

/**
 * 角色列表组件
 * 显示角色表格，包含角色信息、类型、描述、状态和操作按钮
 */
function RoleList({ roles, loading, pagination, searchText, onTableChange, onEdit, onPermModal, onChartPermModal, onDelete, hasPermission, getRoleIcon, getRoleTypeTag }) {
  const columns = [
    {
      title: '角色信息',
      key: 'roleInfo',
      width: 280,
      render: (_, record) => {
        const { icon, color, bgColor } = getRoleIcon(record.role_code);
        return (
          <div className="role-info-cell">
            <Avatar size={48} style={{ backgroundColor: color, fontSize: 20 }}>
              {icon}
            </Avatar>
            <div className="role-info-detail">
              <div className="role-info-name">{record.role_name}</div>
              <div className="role-info-code">{record.role_code}</div>
            </div>
          </div>
        );
      }
    },
    {
      title: '类型',
      key: 'roleType',
      width: 100,
      render: (_, record) => {
        const { color, text } = getRoleTypeTag(record.role_code);
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        record.status !== false
          ? <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
          : <Tag icon={<StopOutlined />} color="error">禁用</Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => {
        const { color } = getRoleIcon(record.role_code);
        return (
          <div className="role-actions">
            {hasPermission('system:role:update') && (
              <Tooltip title="编辑">
                <Button
                  className="role-action-btn"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(record)}
                />
              </Tooltip>
            )}
            {hasPermission('system:role:update') && (
              <Tooltip title="分配权限">
                <Button
                  className="role-action-btn"
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => onPermModal(record)}
                />
              </Tooltip>
            )}
            {hasPermission('system:role:update') && (
              <Tooltip title="图表权限">
                <Button
                  className="role-action-btn"
                  icon={<BarChartOutlined />}
                  onClick={() => onChartPermModal(record)}
                />
              </Tooltip>
            )}
            {hasPermission('system:role:delete') && record.role_code !== 'admin' && (
              <Popconfirm
                title="确定删除该角色吗？"
                description="删除后无法恢复"
                onConfirm={() => onDelete(record.id)}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="删除">
                  <Button className="role-action-btn role-action-btn-danger" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={roles}
      rowKey="id"
      loading={loading}
      pagination={{
        ...pagination,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条记录`
      }}
      onChange={onTableChange}
      scroll={{ x: 1000 }}
    />
  );
}

export default RoleList;
