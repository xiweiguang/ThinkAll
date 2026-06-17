import React from 'react';
import { Card, Tree, Spin, Empty, Badge } from 'antd';
import { BankOutlined, UserOutlined } from '@ant-design/icons';
import { Space } from 'antd';

/**
 * 部门树组件
 * 显示企业通讯录的部门-人员树形结构
 */
function DepartmentTree({
  loading,
  treeData,
  filteredTreeData,
  expandedKeys,
  onExpand,
  onSelect,
  searchValue,
  unreadMap,
  getDeptUnreadCount,
  titleExtra,
}) {
  // 渲染树节点标题
  const renderTreeTitle = (node) => {
    const title = node.title || '';
    if (node.type === 'department') {
      const userCount = node.children ? node.children.filter((c) => c.type === 'user').length : 0;
      const subDeptCount = node.children ? node.children.filter((c) => c.type === 'department').length : 0;
      const deptUnread = getDeptUnreadCount(node);
      let index = title.indexOf(searchValue);
      let displayTitle = title;
      if (searchValue && index > -1) {
        const beforeStr = title.substring(0, index);
        const matchStr = title.substring(index, index + searchValue.length);
        const afterStr = title.substring(index + searchValue.length);
        displayTitle = (
          <span>
            {beforeStr}
            <span style={{ color: '#f50' }}>{matchStr}</span>
            {afterStr}
          </span>
        );
      }
      return (
        <span className="addr-dept-title">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayTitle}</span>
          <span className="addr-dept-count" style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>
            ({subDeptCount > 0 ? `${subDeptCount}个子部门, ` : ''}{userCount}人)
          </span>
          {deptUnread > 0 && (
            <Badge count={deptUnread} style={{ marginLeft: 8 }} />
          )}
        </span>
      );
    }
    if (node.type === 'user') {
      let index = title.indexOf(searchValue);
      let displayTitle = title;
      if (searchValue && index > -1) {
        const beforeStr = title.substring(0, index);
        const matchStr = title.substring(index, index + searchValue.length);
        const afterStr = title.substring(index + searchValue.length);
        displayTitle = (
          <span>
            {beforeStr}
            <span style={{ color: '#f50' }}>{matchStr}</span>
            {afterStr}
          </span>
        );
      }
      const userId = node.id || (node.key ? node.key.replace('user-', '') : '');
      const unread = unreadMap[String(userId)] || 0;
      return (
        <span className="addr-user-title">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayTitle}</span>
          {node.position && (
            <span className="addr-position-tag">{node.position}</span>
          )}
          {unread > 0 && (
            <Badge count={unread} size="small" style={{ marginLeft: 4, flexShrink: 0 }} />
          )}
        </span>
      );
    }
    return title;
  };

  // 转换为Ant Design Tree数据格式
  const convertToAntTree = (nodes) => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map((node) => ({
      key: node.key,
      title: renderTreeTitle(node),
      icon: node.type === 'department' ? <BankOutlined style={{ color: '#1890ff' }} /> : <UserOutlined style={{ color: '#52c41a' }} />,
      data: node,
      children: node.children ? convertToAntTree(node.children) : [],
    }));
  };

  return (
    <Card
      title={
        <Space>
          <BankOutlined />
          <span>企业通讯录</span>
        </Space>
      }
      extra={titleExtra}
      style={{ height: '100%', overflow: 'auto' }}
      styles={{ body: { padding: '8px 12px', overflow: 'auto', height: 'calc(100% - 57px)' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : treeData.length === 0 ? (
        <Empty description="暂无通讯录数据" />
      ) : (
        <Tree
          showIcon
          expandAction="click"  // 点击节点标题也能展开/折叠
          treeData={convertToAntTree(filteredTreeData || treeData)}
          expandedKeys={expandedKeys}
          onExpand={onExpand}
          onSelect={onSelect}
          style={{ fontSize: 13 }}
        />
      )}
    </Card>
  );
}

export default DepartmentTree;
