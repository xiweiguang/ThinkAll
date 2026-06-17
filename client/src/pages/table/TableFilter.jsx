import React from 'react';
import { Radio } from 'antd';
import dayjs from 'dayjs';
import FilterPanel from '../../components/Filter/FilterPanel';

/**
 * 日期联动过滤子组件
 * 包含日期范围Radio.Group和FilterPanel
 */
export default function TableFilter({
  tableConfig,
  dateLinkageActiveRange,
  filters,
  filterableColumns,
  tableId,
  urlFilters,
  onDateRangeChange,
  onFilter,
}) {
  const styleConfig = tableConfig?.styleConfig || {};
  const dateLinkageEnabled = styleConfig.dateLinkageEnabled;
  const dateLinkageField = styleConfig.dateLinkageField;

  return (
    <>
      {dateLinkageEnabled && dateLinkageField && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#666' }}>日期范围：</span>
          <Radio.Group
            size="small"
            value={dateLinkageActiveRange || styleConfig.dateLinkageRange || 'today'}
            onChange={(e) => {
              const rangeType = e.target.value;
              const field = dateLinkageField;
              const today = dayjs();
              let startDate, endDate;
              switch (rangeType) {
                case 'today':
                  startDate = today.format('YYYY-MM-DD');
                  endDate = today.format('YYYY-MM-DD');
                  break;
                case 'week':
                  startDate = today.startOf('week').format('YYYY-MM-DD');
                  endDate = today.format('YYYY-MM-DD');
                  break;
                case 'month':
                  startDate = today.startOf('month').format('YYYY-MM-DD');
                  endDate = today.format('YYYY-MM-DD');
                  break;
                case 'yesterday':
                  startDate = today.subtract(1, 'day').format('YYYY-MM-DD');
                  endDate = today.subtract(1, 'day').format('YYYY-MM-DD');
                  break;
                case 'dayBeforeYesterday':
                  startDate = today.subtract(2, 'day').format('YYYY-MM-DD');
                  endDate = today.subtract(2, 'day').format('YYYY-MM-DD');
                  break;
              }
              if (startDate && endDate) {
                onDateRangeChange(rangeType, field, startDate, endDate);
              }
            }}
          >
            <Radio.Button value="today">当日</Radio.Button>
            <Radio.Button value="yesterday">前1天</Radio.Button>
            <Radio.Button value="dayBeforeYesterday">前2天</Radio.Button>
            <Radio.Button value="week">本周</Radio.Button>
            <Radio.Button value="month">本月</Radio.Button>
          </Radio.Group>
        </div>
      )}
      <FilterPanel
        columns={filterableColumns}
        onFilter={onFilter}
        tableId={tableId}
        initialFilters={Object.keys(urlFilters).length > 0 ? urlFilters : undefined}
      />
    </>
  );
}
