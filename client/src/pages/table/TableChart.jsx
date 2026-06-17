import React from 'react';
import { Card, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';

/**
 * 图表展示子组件
 * 包含ECharts图表渲染
 */
export default function TableChart({
  filteredChartData,
  echartsOption,
  loading,
  chartRef,
  drilldown,
  echartsEvents,
  outerBorderStyle,
  chartData,
}) {
  return (
    <Card className="table-page-card" style={outerBorderStyle}>
      <div className="table-page-top-bar" />
      <div ref={chartRef}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : filteredChartData.length > 0 ? (
          <ReactECharts
            option={echartsOption}
            style={{ height: 450, width: '100%', cursor: drilldown?.enabled ? 'pointer' : 'default' }}
            notMerge={true}
            onEvents={echartsEvents}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            {chartData.length > 0 ? '没有符合筛选条件的数据' : '暂无数据'}
          </div>
        )}
      </div>
    </Card>
  );
}
