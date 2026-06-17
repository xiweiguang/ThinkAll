import React from 'react';
import { Typography, Button, Dropdown } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, DownloadOutlined, AimOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import ChartDescBox from './ChartDescBox';

const { Title } = Typography;

/**
 * 页面头部子组件
 * 包含标题、日期范围显示、全屏按钮、下载按钮、描述框
 */
export default function TableHeader({
  tableConfig,
  dateLinkageActiveRange,
  dateLinkageStartDate,
  dateLinkageEndDate,
  isFullscreen,
  onToggleFullscreen,
  downloadItems,
  descStyleConfig,
  descPosition,
  showDescOnTop,
  drilldown,
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Title level={3} style={{ margin: 0, background: 'linear-gradient(135deg, #1890ff, #36cfc9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {tableConfig.name}
        </Title>
        {dateLinkageActiveRange && dateLinkageStartDate && (
          <span style={{
            padding: '6px 14px',
            background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
            borderRadius: 4,
            fontSize: 16,
            fontWeight: 600,
            color: '#0050b3',
            boxShadow: '0 2px 6px rgba(24, 144, 255, 0.25)',
            border: '1px solid #91d5ff',
            whiteSpace: 'nowrap'
          }}>
            数据日期：{dayjs(dateLinkageStartDate).format('YYYY年M月D日')} - {dayjs(dateLinkageEndDate).format('YYYY年M月D日')}
          </span>
        )}
      </div>
      {showDescOnTop && <ChartDescBox description={tableConfig.description} styleConfig={descStyleConfig} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {drilldown?.enabled && drilldown.targetChartId && (
          <Tooltip title="支持下钻点击">
            <AimOutlined style={{ color: '#1890ff', fontSize: 16, marginLeft: 8 }} />
          </Tooltip>
        )}
        <Button type="text" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} style={{ color: '#1890ff' }} onClick={onToggleFullscreen}>
          {isFullscreen ? '退出全屏' : '全屏'}
        </Button>
        <Dropdown menu={{ items: downloadItems }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<DownloadOutlined />} style={{ color: '#1890ff' }}>
            下载
          </Button>
        </Dropdown>
      </div>
    </div>
  );
}
