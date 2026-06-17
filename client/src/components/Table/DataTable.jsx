import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Table, Empty } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { formatDate } from '../../utils';
import { getTableColorsFromScheme } from '../../utils/colorSchemes';
import { buildTableColumnDefs } from '../../utils/buildTableColumns';
import './DataTable.css';

/**
 * 通用数据表格组件
 * 支持动态列配置、分页、排序、横向滚动
 * 根据列 type 渲染不同内容：number 右对齐、date 格式化、text 默认
 * 支持 styleConfig 自定义表格样式（表头、单元格、边框、隔行变色等）
 * 使用 buildTableColumnDefs 公共函数构建列定义，确保与 ChartPreview 预览效果一致
 */
export default function DataTable({
  columns: configColumns,
  dataSource,
  loading,
  pagination,
  onChange,
  rowKey = 'id',
  styleConfig = {}, // 自定义样式配置对象
  drilldownFields, // 下钻字段列表
  onDrilldown, // 下钻点击回调函数，接收 record 参数
}) {
  const [isMobile, setIsMobile] = useState(false);

  // 使用 ref 保存 debounce 定时器，确保清理时能正确取消
  const debounceTimerRef = useRef(null);

  // 表格容器 ref，用于合并单元格跨行 hover 事件监听
  const tableRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      // 使用 debounce 避免频繁触发重渲染，延迟200ms执行
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setIsMobile(document.documentElement.clientWidth < 768);
      }, 200);
    };
    // 初始化时立即判断一次
    setIsMobile(document.documentElement.clientWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 根据配色方案获取表格颜色（当未显式设置表头/行颜色时使用配色方案的颜色）
  const schemeColors = styleConfig.colorScheme ? getTableColorsFromScheme(styleConfig.colorScheme) : null;

  // 合并配色方案颜色到 styleConfig（用户显式设置优先）
  const resolvedStyleConfig = useMemo(() => {
    const sc = { ...styleConfig };
    if (schemeColors) {
      if (!sc.headerBgColor) sc.headerBgColor = schemeColors.headerBg;
      if (!sc.headerFontColor) sc.headerFontColor = schemeColors.headerColor;
      if (!sc.evenRowBgColor) sc.evenRowBgColor = schemeColors.evenRowBg;
      // 当配色方案存在时，自动启用隔行变色（除非用户显式关闭）
      if (sc.stripeRow === undefined) sc.stripeRow = true;
    }
    return sc;
  }, [styleConfig, schemeColors]);

  // 合并单元格跨行 hover：当鼠标悬停在某行时，跨越该行的合并单元格也变色
  useEffect(() => {
    if (!resolvedStyleConfig.mergeField) return;

    const tableEl = tableRef.current;
    if (!tableEl) return;

    const handleMouseOver = (e) => {
      const tr = e.target.closest('tr.ant-table-row');
      if (!tr) return;

      // 移除所有合并单元格的 hover 类
      tableEl.querySelectorAll('.merge-cell-hover').forEach(el => {
        el.classList.remove('merge-cell-hover');
      });

      // 找到当前行对应的合并单元格并添加 hover 类
      // 合并单元格的 rowSpan > 1，属于前面的行
      const allRows = tableEl.querySelectorAll('tr.ant-table-row');
      const currentRowIndex = Array.from(allRows).indexOf(tr);

      allRows.forEach((row, idx) => {
        if (idx >= currentRowIndex) return; // 只检查前面的行
        const mergeTds = row.querySelectorAll('td[rowspan]');
        mergeTds.forEach(td => {
          const rowSpan = parseInt(td.getAttribute('rowspan') || '1');
          if (idx + rowSpan > currentRowIndex) {
            // 这个合并单元格跨越了当前行
            td.classList.add('merge-cell-hover');
          }
        });
      });
    };

    const handleMouseOut = (e) => {
      if (!e.target.closest('tr.ant-table-row')) {
        tableEl.querySelectorAll('.merge-cell-hover').forEach(el => {
          el.classList.remove('merge-cell-hover');
        });
      }
    };

    tableEl.addEventListener('mouseover', handleMouseOver);
    tableEl.addEventListener('mouseout', handleMouseOut);

    return () => {
      tableEl.removeEventListener('mouseover', handleMouseOver);
      tableEl.removeEventListener('mouseout', handleMouseOut);
    };
  }, [resolvedStyleConfig.mergeField]);

  // 默认排序处理（提前计算，供 antColumns 构建合并单元格时使用排序后的数据）
  const sortedDataSource = useMemo(() => {
    if (!dataSource || !dataSource.length) return dataSource;
    const { defaultSortField, defaultSortOrder, mergeField } = resolvedStyleConfig;

    // 同时配置了合并字段和排序字段：分组排序（先按合并字段分组，组内按排序字段排序）
    if (mergeField && defaultSortField && defaultSortOrder && defaultSortOrder !== 'none') {
      const sorted = [...dataSource].sort((a, b) => {
        // 先按合并字段排序
        const mergeCompare = String(a[mergeField] || '').localeCompare(String(b[mergeField] || ''), 'zh-CN');
        if (mergeCompare !== 0) return mergeCompare;
        // 组内按排序字段排序
        const aVal = a[defaultSortField];
        const bVal = b[defaultSortField];
        if (aVal === bVal) return 0;
        const numA = Number(aVal);
        const numB = Number(bVal);
        let compare = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          compare = numA - numB;
        } else {
          compare = String(aVal || '').localeCompare(String(bVal || ''), 'zh-CN');
        }
        return defaultSortOrder === 'descend' ? -compare : compare;
      });
      return sorted;
    }

    // 只有合并字段：按合并字段排序
    if (mergeField) {
      return [...dataSource].sort((a, b) => {
        return String(a[mergeField] || '').localeCompare(String(b[mergeField] || ''), 'zh-CN');
      });
    }

    // 只有排序字段：按排序字段排序
    if (defaultSortField && defaultSortOrder && defaultSortOrder !== 'none') {
      return [...dataSource].sort((a, b) => {
        const aVal = a[defaultSortField];
        const bVal = b[defaultSortField];
        if (aVal === bVal) return 0;
        const numA = Number(aVal);
        const numB = Number(bVal);
        let compare = 0;
        if (!isNaN(numA) && !isNaN(numB)) {
          compare = numA - numB;
        } else {
          compare = String(aVal || '').localeCompare(String(bVal || ''), 'zh-CN');
        }
        return defaultSortOrder === 'descend' ? -compare : compare;
      });
    }

    return dataSource;
  }, [dataSource, resolvedStyleConfig.defaultSortField, resolvedStyleConfig.defaultSortOrder, resolvedStyleConfig.mergeField]);

  // 使用公共函数构建带样式的列定义，然后添加类型渲染
  // 注意：使用 sortedDataSource 而非原始 dataSource，确保合并单元格的索引与实际渲染行一致
  const antColumns = useMemo(() => {
    if (!configColumns) return [];

    // 调用公共函数构建列定义（含 onHeaderCell、onCell、列宽、固定列、合并单元格、下钻字段标记等）
    const styledCols = buildTableColumnDefs(configColumns, resolvedStyleConfig, sortedDataSource, { drilldownFields, onDrilldown });

    // 递归处理列，包括 children（合并表头时子列也需要类型渲染和下钻图标）
    const processColumn = (col) => {
      // 如果有 children，递归处理子列
      if (col.children && col.children.length > 0) {
        return {
          ...col,
          children: col.children.map(processColumn),
        };
      }

      // 叶子列的处理逻辑：类型渲染、合并渲染包装、下钻图标包装
      const dataIndex = col.dataIndex || col.key;
      // 从原始配置中查找类型和排序信息
      const originalConfig = configColumns.find(c => (c.dataIndex || c.key) === dataIndex);
      if (!originalConfig) return col;

      const { type, sortable } = originalConfig;
      const existingRender = col.render;
      const isDrilldownField = col.isDrilldownField;

      // 类型渲染函数
      let typeRender;
      if (type === 'number') {
        typeRender = (val) => {
          if (val === null || val === undefined) return '-';
          return <span className="cell-number">{Number(val).toLocaleString()}</span>;
        };
      } else if (type === 'date') {
        typeRender = (val) => {
          if (!val) return '-';
          return <span className="cell-date">{formatDate(val)}</span>;
        };
      } else {
        typeRender = (val) => {
          if (val === null || val === undefined) return '-';
          return val;
        };
      }

      // 下钻字段列的渲染包装函数：在类型渲染内容后添加标靶图标和点击事件
      const wrapWithDrilldown = (content, record) => (
        <span
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          onClick={(e) => {
            e.stopPropagation();
            if (onDrilldown) onDrilldown(record);
          }}
        >
          {content}
          <AimOutlined style={{ color: '#1890ff', fontSize: 12, marginLeft: 4 }} />
        </span>
      );

      // 组合渲染函数：如果有合并单元格的 render，需要保留 rowSpan 信息
      if (existingRender) {
        col.render = (val, record, index) => {
          const content = typeRender(val);
          const mergeResult = existingRender(val, record, index);
          if (mergeResult && typeof mergeResult === 'object' && mergeResult.props) {
            // 合并单元格：保留 rowSpan，children 使用类型渲染 + 下钻包装
            const finalContent = isDrilldownField ? wrapWithDrilldown(content, record) : content;
            return { children: finalContent, props: mergeResult.props };
          }
          // 非合并单元格：类型渲染 + 下钻包装
          if (isDrilldownField) {
            return wrapWithDrilldown(content, record);
          }
          return content;
        };
      } else {
        col.render = (val, record, index) => {
          const content = typeRender(val);
          if (isDrilldownField) {
            return wrapWithDrilldown(content, record);
          }
          return content;
        };
      }

      // 排序支持
      if (sortable) {
        col.sorter = true;
      }

      return col;
    };

    return styledCols.map(processColumn);
  }, [configColumns, resolvedStyleConfig, sortedDataSource, drilldownFields, onDrilldown]);

  const tablePagination = pagination
    ? {
        current: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: !isMobile,
        showQuickJumper: !isMobile,
        pageSizeOptions: [10, 20, 50, 100],
        showTotal: isMobile
          ? (total) => `共 ${total} 条`
          : (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        size: isMobile ? 'small' : 'default',
      }
    : false;

  // 根据 styleConfig 构建动态 CSS 变量样式
  // 表头/单元格样式已由 onHeaderCell/onCell 回调处理
  const wrapperStyle = {
    '--border-color': styleConfig.borderColor || undefined,
    '--border-style': styleConfig.borderStyle || undefined,
    '--merge-bg-color': resolvedStyleConfig.mergeBgColor || 'transparent',
  };

  // 外边框：支持 outerBorderWidth 配置边框宽度
  if (styleConfig.showOuterBorder !== false) {
    const width = styleConfig.outerBorderWidth || '1px';
    const style = styleConfig.borderStyle || 'solid';
    const color = styleConfig.borderColor || '#e8e8e8';
    wrapperStyle['--outer-border'] = `${width} ${style} ${color}`;
  } else {
    wrapperStyle['--outer-border'] = 'none';
  }

  // 内边框宽度 CSS 变量
  wrapperStyle['--inner-border-width'] = styleConfig.innerBorderWidth || '1px';
  // 内边框颜色 CSS 变量（默认回退到外边框颜色，再回退到 #f0f0f0）
  wrapperStyle['--inner-border-color'] = resolvedStyleConfig.innerBorderColor || resolvedStyleConfig.borderColor || '#f0f0f0';
  // 内边框样式 CSS 变量
  wrapperStyle['--inner-border-style'] = resolvedStyleConfig.innerBorderStyle || 'solid';

  // 滚动配置
  const scrollConfig = { x: 'max-content' };
  if (resolvedStyleConfig.fixedHeader) {
    scrollConfig.y = 500;
  }

  return (
    <div
      ref={tableRef}
      className="data-table-wrapper"
      style={wrapperStyle}
      data-has-merge={resolvedStyleConfig.mergeField ? "true" : undefined}
    >
      <Table
        columns={antColumns}
        dataSource={sortedDataSource}
        loading={loading}
        rowKey={rowKey}
        pagination={tablePagination}
        onChange={onChange}
        scroll={scrollConfig}
        bordered={resolvedStyleConfig.showInnerBorder === true}
        locale={{
          emptyText: <Empty description="暂无数据" />,
        }}
        size="middle"
      />
    </div>
  );
}
