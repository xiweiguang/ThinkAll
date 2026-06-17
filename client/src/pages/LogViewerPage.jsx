import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Select, List, Tag, Badge, Button, Empty, Spin, Space, Typography, Statistic
} from 'antd';
import {
  WarningOutlined, ReloadOutlined, FileTextOutlined
} from '@ant-design/icons';
import { getErrorLogs, getLogDates } from '../services/logService';
import dayjs from 'dayjs';
import './LogViewerPage.css';

const { Title, Text } = Typography;

const LOG_LEVEL_CONFIG = {
  ERROR: { color: 'red', badgeColor: '#ff4d4f', label: 'ERROR' },
  CRITICAL: { color: 'magenta', badgeColor: '#eb2f96', label: 'CRITICAL' }
};

function parseLogLine(line) {
  const regex = /^\[([^\]]+)\]\s*\[(\w+)\]\s*\[([^\]]*)\]\s*(.*)$/;
  const match = line.match(regex);
  if (match) {
    return {
      timestamp: match[1],
      level: match[2].toUpperCase(),
      module: match[3],
      message: match[4]
    };
  }
  return {
    timestamp: '',
    level: 'UNKNOWN',
    module: '',
    message: line
  };
}

export default function LogViewerPage() {
  const [logs, setLogs] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [limit] = useState(200);

  const fetchDates = useCallback(async () => {
    setDatesLoading(true);
    try {
      const res = await getLogDates();
      const data = res.data || res;
      const dateList = Array.isArray(data) ? data : (data.data || []);
      setDates(dateList);
      if (dateList.length > 0 && !dateList.includes(selectedDate)) {
        setSelectedDate(dateList[0]);
      }
    } catch (err) {
      console.error('获取日志日期失败:', err);
    } finally {
      setDatesLoading(false);
    }
  }, [selectedDate]);

  const fetchLogs = useCallback(async (date, logLimit = 200) => {
    if (!date) return;
    setLoading(true);
    try {
      const res = await getErrorLogs(date, logLimit);
      const data = res.data || res;
      const logList = Array.isArray(data) ? data : (data.data || []);
      setLogs(logList);
    } catch (err) {
      console.error('获取错误日志失败:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  useEffect(() => {
    if (selectedDate) {
      fetchLogs(selectedDate, limit);
    }
  }, [selectedDate, limit, fetchLogs]);

  const handleDateChange = (value) => {
    setSelectedDate(value);
  };

  const handleRefresh = () => {
    if (selectedDate) {
      fetchLogs(selectedDate, limit);
    }
  };

  const parsedLogs = logs.map((line, index) => ({
    key: index,
    raw: line,
    ...parseLogLine(line)
  }));

  const errorCount = parsedLogs.filter(l => l.level === 'ERROR').length;
  const criticalCount = parsedLogs.filter(l => l.level === 'CRITICAL').length;

  const getLevelTag = (level) => {
    const config = LOG_LEVEL_CONFIG[level];
    if (config) {
      return <Tag color={config.color}>{config.label}</Tag>;
    }
    return <Tag>{level}</Tag>;
  };

  return (
    <div className="log-viewer-page">
      <div className="log-viewer-header">
        <div className="log-viewer-title">
          <Title level={3} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            系统日志
          </Title>
          <span className="log-viewer-subtitle">查看 ERROR 和 CRITICAL 级别日志</span>
        </div>
        <div className="log-viewer-stats">
          <Statistic
            title="ERROR"
            value={errorCount}
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<WarningOutlined />}
          />
          <Statistic
            title="CRITICAL"
            value={criticalCount}
            valueStyle={{ color: '#eb2f96' }}
            prefix={<WarningOutlined />}
          />
          <Statistic
            title="总计"
            value={parsedLogs.length}
            valueStyle={{ color: '#1890ff' }}
          />
        </div>
      </div>

      <Card className="log-viewer-card" variant="borderless">
        <div className="log-viewer-toolbar">
          <Space wrap>
            <span className="log-viewer-label">选择日期：</span>
            <Select
              value={selectedDate}
              onChange={handleDateChange}
              loading={datesLoading}
              style={{ width: 180 }}
              placeholder="请选择日期"
              notFoundContent={datesLoading ? <Spin size="small" /> : '无可用日期'}
              options={dates.map(d => ({ value: d, label: d }))}
              suffixIcon={datesLoading ? <Spin size="small" /> : undefined}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
          <div className="log-viewer-limit-info">
            <Text type="secondary">显示上限：{limit} 条</Text>
          </div>
        </div>

        <Spin spinning={loading} tip="加载日志中...">
          {parsedLogs.length > 0 ? (
            <List
              className="log-viewer-list"
              dataSource={parsedLogs}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (total) => `共 ${total} 条日志`,
                size: 'small'
              }}
              renderItem={(item) => (
                <List.Item
                  className={`log-viewer-item log-viewer-item-${item.level.toLowerCase()}`}
                >
                  <div className="log-viewer-item-content">
                    <div className="log-viewer-item-header">
                      <Space size={8}>
                        <Badge
                          color={LOG_LEVEL_CONFIG[item.level]?.badgeColor || '#d9d9d9'}
                          text={getLevelTag(item.level)}
                        />
                        {item.module && (
                          <Tag color="blue" className="log-viewer-module-tag">
                            {item.module}
                          </Tag>
                        )}
                      </Space>
                      <Text type="secondary" className="log-viewer-timestamp">
                        {item.timestamp}
                      </Text>
                    </div>
                    <div className={`log-viewer-message log-viewer-message-${item.level.toLowerCase()}`}>
                      {item.message}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                loading ? '加载中...' : '暂无错误日志'
              }
              style={{ padding: '60px 0' }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}
