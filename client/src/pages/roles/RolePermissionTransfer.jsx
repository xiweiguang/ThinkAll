import React from 'react';
import { Modal, Tree, Empty, Space, Transfer, Table, Switch, Tag, Alert, Button } from 'antd';
import {
  SafetyCertificateOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

/**
 * 权限穿梭框组件
 * 包含功能权限分配和图表权限分配两个弹窗
 */
function RolePermissionTransfer({
  // 功能权限相关
  permModalVisible,
  currentRole,
  permissionTree,
  checkedKeys,
  permLoading,
  permSubmitting,
  onPermCheck,
  onPermSubmit,
  onPermCancel,
  // 图表权限相关
  chartPermModalVisible,
  chartPermRole,
  chartCheckedKeys,
  chartPermLoading,
  chartPermSubmitting,
  allCharts,
  chartCategories,
  dataPermConfigs,
  onChartCheckedChange,
  onChartPermSubmit,
  onChartPermCancel,
  onSetDataPermConfigs,
  getRoleDataRule,
}) {
  return (
    <>
      {/* 功能权限分配弹窗 */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
            <span>分配权限 - {currentRole?.role_name || ''}</span>
          </Space>
        }
        open={permModalVisible}
        onOk={onPermSubmit}
        onCancel={onPermCancel}
        confirmLoading={permSubmitting}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnHidden
      >
        {permLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div>加载权限数据中...</div>
          </div>
        ) : permissionTree.length > 0 ? (
          <div className="permission-tree-wrapper">
            <Tree
              checkable
              checkStrictly
              defaultExpandAll
              checkedKeys={checkedKeys}
              onCheck={onPermCheck}
              treeData={permissionTree}
              selectable={false}
            />
          </div>
        ) : (
          <Empty description="暂无权限数据" />
        )}
      </Modal>

      {/* 图表权限分配弹窗 */}
      <Modal
        title={
          <Space>
            <BarChartOutlined style={{ color: '#52c41a' }} />
            <span>图表权限 - {chartPermRole?.role_name || ''}</span>
          </Space>
        }
        open={chartPermModalVisible}
        onOk={onChartPermSubmit}
        onCancel={onChartPermCancel}
        confirmLoading={chartPermSubmitting}
        okText="保存"
        cancelText="取消"
        width={700}
        destroyOnHidden
      >
        {chartPermLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>加载图表权限数据中...</div>
        ) : allCharts.length > 0 ? (
          <div className="chart-perm-wrapper">
            <div className="chart-perm-tip">选择该角色可以查看的图表（左侧为未授权，右侧为已授权）</div>
            <Transfer
              dataSource={allCharts.map(c => ({
                key: c.id,
                title: c.name,
                description: c.description || '',
              }))}
              targetKeys={chartCheckedKeys}
              onChange={onChartCheckedChange}
              render={item => (
                <span>{item.title}{item.description ? <span style={{ color: '#999', fontSize: 12, marginLeft: 4 }}>- {item.description}</span> : null}</span>
              )}
              showSearch
              filterOption={(inputValue, item) =>
                item.title?.toLowerCase().includes(inputValue.toLowerCase()) ||
                item.description?.toLowerCase().includes(inputValue.toLowerCase())
              }
              titles={['未授权图表', '已授权图表']}
              listStyle={{ width: 280, height: 350 }}
            />
            <div className="chart-data-perm-section" style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1890ff' }}>
                  数据权限配置
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="small" onClick={() => {
                    const newConfigs = {};
                    allCharts.forEach(chart => {
                      newConfigs[chart.id] = { enabled: true, match_field: dataPermConfigs[chart.id]?.match_field || chart.matchField || '' };
                    });
                    onSetDataPermConfigs(newConfigs);
                  }}>全部开启</Button>
                  <Button size="small" onClick={() => {
                    const newConfigs = {};
                    allCharts.forEach(chart => {
                      newConfigs[chart.id] = { enabled: false, match_field: dataPermConfigs[chart.id]?.match_field || chart.matchField || '' };
                    });
                    onSetDataPermConfigs(newConfigs);
                  }}>全部关闭</Button>
                </div>
              </div>
              {chartPermRole && (() => {
                const rule = getRoleDataRule(chartPermRole.role_code);
                return (
                  <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    style={{ marginBottom: 12 }}
                    message={
                      <span>
                        当前角色（<Tag color={rule.color}>{chartPermRole.role_name}</Tag>）的数据过滤规则：
                        <strong>{rule.label}</strong>
                      </span>
                    }
                    description={rule.desc}
                  />
                );
              })()}
              <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                开启数据权限后，该图表数据将按角色层级自动过滤。管理员和行领导查看全部数据，部门领导查看本部门数据，二层经理查看二级部门数据，普通用户只看自己数据。
              </div>
              <Table
                dataSource={allCharts.map(chart => {
                  const config = dataPermConfigs[chart.id] || { enabled: false, match_field: null };
                  const cat = chartCategories ? (function findCat(cats) {
                    for (const c of cats) {
                      if (c.id === chart.categoryId) return c.name;
                      if (c.children) {
                        const found = findCat(c.children);
                        if (found) return found;
                      }
                    }
                    return null;
                  })(chartCategories) : null;
                  return { ...chart, key: chart.id, categoryName: cat || '未分类', permEnabled: config.enabled, matchField: config.match_field || chart.matchField || '' };
                })}
                columns={[
                  {
                    title: '图表名称',
                    dataIndex: 'name',
                    key: 'name',
                    width: 200,
                    ellipsis: true,
                  },
                  {
                    title: '分类',
                    dataIndex: 'categoryName',
                    key: 'categoryName',
                    width: 120,
                    ellipsis: true,
                  },
                  {
                    title: '数据权限',
                    dataIndex: 'permEnabled',
                    key: 'permEnabled',
                    width: 100,
                    render: (enabled, record) => (
                      <Switch
                        size="small"
                        checked={enabled || false}
                        onChange={(checked) => {
                          onSetDataPermConfigs(prev => ({
                            ...prev,
                            [record.id]: { ...prev[record.id], enabled: checked, match_field: prev[record.id]?.match_field || record.matchField || '' }
                          }));
                        }}
                        checkedChildren="开"
                        unCheckedChildren="关"
                      />
                    ),
                  },
                  {
                    title: '匹配字段',
                    key: 'matchField',
                    render: (_, record) => {
                      const config = dataPermConfigs[record.id] || {};
                      if (!config.enabled) return <span style={{ color: '#ccc' }}>-</span>;
                      return (
                        <div style={{ fontSize: 12 }}>
                          <div><span style={{ color: '#999' }}>姓名：</span><span style={{ color: '#1890ff' }}>{record.matchField || '-'}</span></div>
                          <div><span style={{ color: '#999' }}>部门：</span><span style={{ color: '#1890ff' }}>{record.departmentField || '-'}</span></div>
                        </div>
                      );
                    },
                  },
                ]}
                pagination={false}
                size="small"
                scroll={{ y: 400 }}
              />
            </div>
          </div>
        ) : (
          <Empty description="暂无图表数据" />
        )}
      </Modal>
    </>
  );
}

export default RolePermissionTransfer;
