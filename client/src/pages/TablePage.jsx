import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, Typography, Result, Spin, Table as AntTable, Dropdown, message, Button, Radio } from 'antd';
import dayjs from 'dayjs';
import { DownloadOutlined, FileImageOutlined, FilePdfOutlined, FileExcelOutlined, FullscreenOutlined, FullscreenExitOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getTableConfig, getTableData } from '../services/tableService';
import * as dashboardService from '../services/dashboardService';
import ReactECharts from 'echarts-for-react';
import DataTable from '../components/Table/DataTable';
import FilterPanel from '../components/Filter/FilterPanel';
import { exportAsImage, exportAsPdf, exportAsExcel } from '../utils/chartExport';
import { COLOR_MAP, getTableColorsFromScheme } from '../utils/colorSchemes';
import { computeDateRange } from '../utils/dateRangeUtils';
import { sanitizeHtml } from '../utils/htmlSanitizer';
import { useChartTab } from '../contexts/ChartTabContext';
import TableHeader from './table/TableHeader';
import TableChart from './table/TableChart';
import TableAnalysis from './table/TableAnalysis';
import TableFilter from './table/TableFilter';
import TableSummary from './table/TableSummary';
import ChartDescBox from './table/ChartDescBox';
import './TablePage.css';

const { Title } = Typography;

function getConditionalStyle(value, formats, fieldName) {
  if (!formats || !Array.isArray(formats)) return null;
  const numVal = Number(value);
  for (const fmt of formats) {
    if (fmt.field !== fieldName) continue;
    let match = false;
    switch (fmt.condition) {
      case 'gt': match = numVal > Number(fmt.value); break;
      case 'lt': match = numVal < Number(fmt.value); break;
      case 'eq': match = numVal === Number(fmt.value); break;
      case 'neq': match = numVal !== Number(fmt.value); break;
      case 'between': match = numVal >= Number(fmt.value) && numVal <= Number(fmt.valueEnd); break;
    }
    if (match) return { fontColor: fmt.fontColor, bgColor: fmt.bgColor };
  }
  return null;
}

function buildEchartsOption(tableConfig, chartData) {
  const styleConfig = tableConfig.styleConfig || {};
  const chartType = tableConfig.chartType || 'bar';
  const xField = styleConfig.xField;
  const yFields = styleConfig.yFields || [];
  const chartTitle = styleConfig.title || tableConfig.name || '';
  const colorScheme = styleConfig.colorScheme || 'default';
  const legendPosition = styleConfig.legendPosition || 'top';
  const showDataLabels = styleConfig.showDataLabels !== undefined ? styleConfig.showDataLabels : false;
  const titleFontSize = styleConfig.titleFontSize || 16;
  const titleBold = styleConfig.titleBold !== undefined ? styleConfig.titleBold : true;
  const chartBgColor = styleConfig.chartBgColor || 'transparent';
  const titleColor = styleConfig.titleColor || 'rgba(24,144,255,1)';
  const titleAlign = styleConfig.titleAlign || 'left';
  const showGridLine = styleConfig.showGridLine !== undefined ? styleConfig.showGridLine : true;
  const gridLineColor = styleConfig.gridLineColor || 'rgba(200,200,200,0.3)';
  const axisLabelColor = styleConfig.axisLabelColor || 'rgba(89,89,89,1)';
  const axisLabelFontSize = styleConfig.axisLabelFontSize || 12;
  const legendFontSize = styleConfig.legendFontSize || 12;
  const showChartTitle = styleConfig.showTitle !== undefined ? styleConfig.showTitle : true;

  const titleTextStyle = { fontSize: titleFontSize, fontWeight: titleBold ? 'bold' : 'normal', color: titleColor };

  if (!chartData.length || !xField) return {};

  const colors = COLOR_MAP[colorScheme] || COLOR_MAP.default;
  const xData = chartData.map((row) => row[xField]);

  const legendConfig = {
    orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
    [legendPosition === 'hidden' ? 'top' : legendPosition]: legendPosition === 'top' || legendPosition === 'bottom' ? 30 : 'center',
    left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
    textStyle: { fontSize: legendFontSize },
    ...(legendPosition === 'hidden' ? { show: false } : {}),
  };

  if (chartType === 'pie') {
    const yField = yFields[0];
    if (!yField) return {};
    const pieData = chartData.map((row) => ({
      name: row[xField],
      value: row[yField],
    }));
    return {
      backgroundColor: chartBgColor,
      color: colors,
      title: { show: showChartTitle, text: chartTitle, left: titleAlign, textStyle: titleTextStyle },
      tooltip: { trigger: 'item' },
      legend: legendConfig,
      series: [{
        type: 'pie',
        radius: '60%',
        data: pieData,
        label: { show: showDataLabels },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
        },
      }],
    };
  }

  if (chartType === 'double_pie') {
    if (yFields.length < 2) return {};
    const innerData = chartData.map((row) => ({
      name: row[xField],
      value: row[yFields[0]],
    }));
    const outerData = chartData.map((row) => ({
      name: row[xField],
      value: row[yFields[1]],
    }));
    return {
      backgroundColor: chartBgColor,
      color: colors,
      title: { show: showChartTitle, text: chartTitle, left: titleAlign, textStyle: titleTextStyle },
      tooltip: { trigger: 'item' },
      legend: legendConfig,
      series: [
        {
          type: 'pie',
          radius: ['0%', '40%'],
          data: innerData,
          label: { show: showDataLabels, position: 'inside' },
          name: yFields[0],
        },
        {
          type: 'pie',
          radius: ['50%', '70%'],
          data: outerData,
          label: { show: showDataLabels },
          name: yFields[1],
        },
      ],
    };
  }

  if (chartType === 'radar') {
    const indicator = xData.map((name) => ({ name, max: undefined }));
    const seriesData = yFields.map((yf) => {
      const values = chartData.map((row) => {
        const v = Number(row[yf]);
        return isNaN(v) ? 0 : v;
      });
      return { value: values, name: yf };
    });
    return {
      backgroundColor: chartBgColor,
      color: colors,
      title: { show: showChartTitle, text: chartTitle, left: titleAlign, textStyle: titleTextStyle },
      tooltip: {},
      legend: legendConfig,
      radar: {
        indicator,
        splitLine: {
          show: showGridLine,
          lineStyle: { color: gridLineColor }
        },
        axisLine: {
          lineStyle: { color: gridLineColor }
        },
        axisName: {
          color: axisLabelColor,
          fontSize: axisLabelFontSize
        }
      },
      series: [{ type: 'radar', data: seriesData }],
    };
  }

  const isArea = chartType === 'area';
  const isStacked = chartType === 'stacked_bar';
  const isDoubleLine = chartType === 'double_line';

  const series = yFields.map((yf) => {
    const yData = chartData.map((row) => {
      const v = Number(row[yf]);
      return isNaN(v) ? 0 : v;
    });
    const baseType = (chartType === 'multi_bar' || chartType === 'stacked_bar') ? 'bar'
      : (isArea || isDoubleLine) ? 'line' : chartType;
    return {
      name: yf,
      type: baseType,
      data: yData,
      areaStyle: isArea ? {} : undefined,
      stack: isStacked ? 'total' : undefined,
      label: { show: showDataLabels },
    };
  });

  const splitLineConfig = {
    show: showGridLine,
    lineStyle: { color: gridLineColor },
  };

  return {
    backgroundColor: chartBgColor,
    color: colors,
    title: { show: showChartTitle, text: chartTitle, left: titleAlign, textStyle: titleTextStyle },
    tooltip: { trigger: 'axis' },
    legend: legendConfig,
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      boundaryGap: chartType === 'bar' || chartType === 'multi_bar' || chartType === 'stacked_bar',
      splitLine: splitLineConfig,
      axisLabel: { color: axisLabelColor, fontSize: axisLabelFontSize },
    },
    yAxis: {
      type: 'value',
      splitLine: splitLineConfig,
      axisLabel: { color: axisLabelColor, fontSize: axisLabelFontSize },
    },
    series,
  };
}

const migrateHeaderGroups = (groups) => {
  if (!Array.isArray(groups)) return [];
  const result = [];
  const collectLeafFields = (g, fieldList) => {
    if (g.fields && g.fields.length > 0) {
      fieldList.push(...g.fields);
    }
    if (g.children && g.children.length > 0) {
      g.children.forEach(c => collectLeafFields(c, fieldList));
    }
  };
  const processGroup = (g) => {
    if (!g.children || g.children.length === 0) {
      if (g.fields && g.fields.length > 0) {
        result.push({ name: g.name || '', fields: [...g.fields] });
      }
      return;
    }
    const fields = [];
    g.children.forEach(c => {
      if (c.name && ((c.children && c.children.length > 0) || (c.fields && c.fields.length > 0))) {
        processGroup(c);
        fields.push(`__group__:${c.name}`);
      } else if (!c.name && c.fields && c.fields.length > 0) {
        fields.push(...c.fields);
      } else if (c.children && c.children.length > 0) {
        const subFields = [];
        collectLeafFields(c, subFields);
        fields.push(...subFields);
      }
    });
    if (fields.length > 0) {
      result.push({ name: g.name || '', fields });
    }
  };
  groups.forEach(g => processGroup(g));
  return result;
};

const hasNestedFields = (groups) => {
  if (!Array.isArray(groups)) return false;
  return groups.some(g => g.fields && g.fields.length > 0);
};

const collectGroupedFields = (groups, fieldSet) => {
  if (!Array.isArray(groups)) return;
  const resolveFields = (group, visited) => {
    if (!group.name || visited.has(group.name)) return;
    visited.add(group.name);
    (group.fields || []).forEach(f => {
      if (f.startsWith('__group__:')) {
        const refName = f.replace('__group__:', '');
        const refGroup = groups.find(g => g.name === refName);
        if (refGroup) resolveFields(refGroup, visited);
      } else {
        fieldSet.add(f);
      }
    });
  };
  groups.forEach(g => resolveFields(g, new Set()));
};

const getRootGroups = (groups) => {
  if (!Array.isArray(groups)) return [];
  const referencedGroupNames = new Set();
  groups.forEach(g => {
    (g.fields || []).forEach(f => {
      if (f.startsWith('__group__:')) {
        referencedGroupNames.add(f.replace('__group__:', ''));
      }
    });
  });
  return groups.filter(g => !referencedGroupNames.has(g.name));
};

const getMaxDepth = (groups) => {
  if (!Array.isArray(groups) || groups.length === 0) return 0;
  const rootGroups = getRootGroups(groups);
  let maxDepth = 0;
  const calcDepth = (group, visited) => {
    if (visited.has(group.name)) return 1;
    visited.add(group.name);
    let maxChildDepth = 0;
    let hasRawFields = false;
    (group.fields || []).forEach(f => {
      if (f.startsWith('__group__:')) {
        const refName = f.replace('__group__:', '');
        const refGroup = groups.find(g => g.name === refName);
        if (refGroup) {
          const childDepth = calcDepth(refGroup, new Set(visited));
          maxChildDepth = Math.max(maxChildDepth, childDepth);
        }
      } else {
        hasRawFields = true;
      }
    });
    if (hasRawFields) {
      maxChildDepth = Math.max(maxChildDepth, 1);
    }
    return 1 + maxChildDepth;
  };
  rootGroups.forEach(g => {
    maxDepth = Math.max(maxDepth, calcDepth(g, new Set()));
  });
  return maxDepth;
};

const buildGroupChildren = (group, cols, allGroups, headerStyle, visited) => {
  const children = [];
  (group.fields || []).forEach(f => {
    if (f.startsWith('__group__:')) {
      const refName = f.replace('__group__:', '');
      if (visited.has(refName)) return;
      visited.add(refName);
      const refGroup = allGroups.find(rg => rg.name === refName);
      if (refGroup) {
        const refChildren = buildGroupChildren(refGroup, cols, allGroups, headerStyle, visited);
        if (refChildren.length > 0) {
          const headerCellStyle = () => {
            const style = {
              fontSize: headerStyle.hFontSize,
              fontWeight: headerStyle.hBold ? 'bold' : 'normal',
              fontStyle: headerStyle.hItalic ? 'italic' : 'normal',
              textAlign: headerStyle.hAlign,
            };
            if (headerStyle.hFontColor) style.color = headerStyle.hFontColor;
            if (headerStyle.hBgColor) style.backgroundColor = headerStyle.hBgColor;
            return { style };
          };
          const groupFixed = refChildren.every(c => c.fixed === 'left')
            ? 'left'
            : refChildren.every(c => c.fixed === 'right') ? 'right' : undefined;
          children.push({
            title: refGroup.name || '',
            fixed: groupFixed,
            onHeaderCell: headerCellStyle,
            children: refChildren,
          });
        }
      }
    } else {
      const col = cols.find(c => c.dataIndex === f);
      if (col) children.push(col);
    }
  });
  return children;
};

const buildNestedColumns = (rootGroups, cols, allGroups, maxDepth, headerStyle) => {
  if (!Array.isArray(rootGroups)) return [];
  const result = [];
  rootGroups.forEach(g => {
    const headerCellStyle = () => {
      const style = {
        fontSize: headerStyle.hFontSize,
        fontWeight: headerStyle.hBold ? 'bold' : 'normal',
        fontStyle: headerStyle.hItalic ? 'italic' : 'normal',
        textAlign: headerStyle.hAlign,
      };
      if (headerStyle.hFontColor) style.color = headerStyle.hFontColor;
      if (headerStyle.hBgColor) style.backgroundColor = headerStyle.hBgColor;
      return { style };
    };
    const children = buildGroupChildren(g, cols, allGroups, headerStyle, new Set());
    if (children.length > 0) {
      const groupFixed = children.every(c => c.fixed === 'left')
        ? 'left'
        : children.every(c => c.fixed === 'right') ? 'right' : undefined;
      result.push({
        title: g.name || '',
        fixed: groupFixed,
        onHeaderCell: headerCellStyle,
        children,
      });
    }
  });
  return result;
};

const getLeafColumns = (columns) => {
  const leaves = [];
  const traverse = (cols) => {
    if (!cols) return;
    cols.forEach(col => {
      if (col.children && col.children.length > 0) {
        traverse(col.children);
      } else if (col.dataIndex) {
        leaves.push(col);
      }
    });
  };
  traverse(columns);
  return leaves;
};

const getDateLinkageRange = (config) => {
  if (!config.dateLinkageEnabled || !config.dateLinkageField) return null;
  const field = config.dateLinkageField;
  const range = config.dateLinkageRange || 'today';
  const today = dayjs();
  let startDate, endDate;

  switch (range) {
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
    case 'custom':
      startDate = config.dateLinkageStartDate || undefined;
      endDate = config.dateLinkageEndDate || undefined;
      break;
    default:
      return null;
  }

  if (!startDate && !endDate) return null;
  return { field, startDate, endDate };
};

function _sanitizeCssValue(value) {
  if (typeof value !== 'string') return '#e8e8e8';
  if (/^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/.test(value.trim())) {
    return value.trim();
  }
  return '#e8e8e8';
}

function _sanitizeBorderStyle(value) {
  const allowed = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'none', 'hidden'];
  if (typeof value === 'string' && allowed.includes(value.trim().toLowerCase())) {
    return value.trim().toLowerCase();
  }
  return 'solid';
}

function _sanitizeBorderWidth(value) {
  if (typeof value === 'string' && /^\d+(\.\d+)?px$/.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return value.trim() + 'px';
  }
  return '1px';
}

export default function TablePage({ chartId: chartIdProp, initialFilterParams: initialFilterParamsProp }) {
  const { tableId: tableIdParam } = useParams();
  const tableId = chartIdProp || tableIdParam;
  const navigate = useNavigate();
  const location = useLocation();
  const initialFilterParams = initialFilterParamsProp || {};
  const { openTab, updateTabTitleByChartId, tabs: openTabs, activeTabId: activeTabKey, switchTab, closeTab, isFullscreen, toggleFullscreen, contentRef } = useChartTab();

  const [tableConfig, setTableConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);

  const [dataSource, setDataSource] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [filteredChartData, setFilteredChartData] = useState([]);
  const [chartFilters, setChartFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });
  const [sorter, setSorter] = useState({
    sortField: undefined,
    sortOrder: undefined,
  });
  const [filters, setFilters] = useState({});
  const [allFilteredData, setAllFilteredData] = useState([]);
  const [defaultSortApplied, setDefaultSortApplied] = useState(false);
  const [dateLinkageActiveRange, setDateLinkageActiveRange] = useState(null);
  const [dateLinkageStartDate, setDateLinkageStartDate] = useState(null);
  const [dateLinkageEndDate, setDateLinkageEndDate] = useState(null);
  const [analysisText, setAnalysisText] = useState('');
  const [drilldownFilters, setDrilldownFilters] = useState({});

  const isDynamicChart = tableConfig && (tableConfig.isDynamic || tableConfig.chartType);
  const isTableType = isDynamicChart && tableConfig.chartType === 'table';
  const isRichTextType = isDynamicChart && tableConfig.chartType === 'rich_text';
  const drilldown = tableConfig?.styleConfig?.drilldown || {};

  // 获取当前图表的筛选参数（包含日期范围和其他筛选），用于下钻时传递给目标图表
  const getCurrentFilterParams = useCallback(() => {
    const params = {};
    // 合并当前筛选条件
    if (filters && typeof filters === 'object') {
      Object.assign(params, filters);
    }
    // 合并日期范围筛选
    const dlRange = getDateLinkageRange(tableConfig?.styleConfig || {});
    if (dlRange && dateLinkageStartDate && dateLinkageEndDate) {
      if (!params[`${dlRange.field}_startDate`]) {
        params[`${dlRange.field}_startDate`] = dayjs(dateLinkageStartDate).format('YYYY-MM-DD');
      }
      if (!params[`${dlRange.field}_endDate`]) {
        params[`${dlRange.field}_endDate`] = dayjs(dateLinkageEndDate).format('YYYY-MM-DD');
      }
    }
    return params;
  }, [filters, tableConfig, dateLinkageStartDate, dateLinkageEndDate]);

  // 下钻跳转处理函数
  const handleDrilldown = useCallback((fp) => {
    if (Object.keys(fp).length === 0) return;
    // 当通过标签页上下文渲染时（chartIdProp 存在），使用 openTab 打开新标签页
    // 当通过 Outlet 渲染时（chartIdProp 不存在），使用 navigate 跳转，确保目标页面可见
    if (chartIdProp) {
      openTab(drilldown.targetChartId, fp);
    } else {
      const searchParams = new URLSearchParams();
      Object.entries(fp).forEach(([key, value]) => {
        searchParams.set(key, value);
      });
      navigate(`/table/${drilldown.targetChartId}${searchParams.toString() ? '?' + searchParams.toString() : ''}`);
    }
  }, [chartIdProp, drilldown.targetChartId, openTab, navigate]);

  const echartsEvents = drilldown?.enabled && drilldown.targetChartId ? {
    click: (params) => {
      const drilldownFieldsList = drilldown.drilldownFields || (drilldown.sourceField ? [drilldown.sourceField] : (drilldown.dimensionField ? [drilldown.dimensionField] : []));
      const fieldMappings = drilldown.fieldMappings || (drilldown.sourceField && drilldown.targetField && drilldown.sourceField !== drilldown.targetField ? { [drilldown.sourceField]: drilldown.targetField } : {});
      if (drilldownFieldsList.length === 0) return;
      const fp = getCurrentFilterParams();
      for (const field of drilldownFieldsList) {
        let value;
        // 优先从 params.data 取值（饼图等，data 是对象）
        if (params.data && typeof params.data === 'object' && !Array.isArray(params.data)) {
          value = params.data[field];
        }
        // 其次从 params.name 取值（柱状图/折线图，name 是 X 轴分类值）
        if (value === undefined && params.name !== undefined && params.name !== null) {
          value = params.name;
        }
        if (value !== undefined && value !== null) {
          const targetField = fieldMappings[field] || field;
          fp[`filter_${targetField}`] = value;
        }
      }
      handleDrilldown(fp);
    }
  } : {};

  const urlFilters = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const filters = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith('filter_')) {
        const fieldName = key.replace('filter_', '');
        filters[fieldName] = value;
      }
    });
    return filters;
  }, [location.search]);

  const chartRef = useRef(null);
  const tableRef = useRef(null);
  const urlFilterApplied = useRef(false);
  const initialFilterApplied = useRef(false);
  const handleFilterRef = useRef(null);
  const skipDateLinkageFetch = useRef(false);

  useEffect(() => {
    if (!urlFilterApplied.current && Object.keys(urlFilters).length > 0 && tableConfig && handleFilterRef.current) {
      if (isDynamicChart && !isTableType && chartData.length === 0) return;
      urlFilterApplied.current = true;
      handleFilterRef.current(urlFilters);
    }
  }, [urlFilters, tableConfig, isDynamicChart, isTableType, chartData]);

  useEffect(() => {
    if (!initialFilterApplied.current && Object.keys(initialFilterParams).length > 0 && tableConfig && handleFilterRef.current) {
      if (isDynamicChart && !isTableType && chartData.length === 0) return;
      initialFilterApplied.current = true;
      const cleanParams = {};
      for (const [key, val] of Object.entries(initialFilterParams)) {
        const fieldName = key.startsWith('filter_') ? key.replace('filter_', '') : key;
        cleanParams[fieldName] = val;
      }
      handleFilterRef.current(cleanParams);
      setDrilldownFilters(cleanParams);
    }
  }, [initialFilterParams, tableConfig, isDynamicChart, isTableType, chartData]);

  useEffect(() => {
    // 切换图表时重置筛选相关状态和ref，避免旧图表的筛选参数影响新图表
    setDrilldownFilters({});
    initialFilterApplied.current = false;
    urlFilterApplied.current = false;
  }, [chartIdProp]);

  const handleExportImage = useCallback(async (refEl) => {
    if (!refEl) return;
    const fileName = tableConfig?.name || '图表';
    const success = await exportAsImage(refEl, fileName);
    if (success) {
      message.success('保存图片成功');
    } else {
      message.error('保存图片失败');
    }
  }, [tableConfig]);

  const handleExportPdf = useCallback(async (refEl) => {
    if (!refEl) return;
    const fileName = tableConfig?.name || '图表';
    const success = await exportAsPdf(refEl, fileName);
    if (success) {
      message.success('保存PDF成功');
    } else {
      message.error('保存PDF失败');
    }
  }, [tableConfig]);

  const handleExportExcel = useCallback(async (data, columns) => {
    if (!data || !data.length) {
      message.warning('暂无数据可导出');
      return;
    }
    const fileName = tableConfig?.name || '数据';
    const success = await exportAsExcel(data, columns, fileName);
    if (success) {
      message.success('导出Excel成功');
    } else {
      message.error('导出Excel失败');
    }
  }, [tableConfig]);

  const getChartDownloadItems = useCallback(() => [
    {
      key: 'image',
      icon: <FileImageOutlined />,
      label: '保存为图片',
      onClick: () => handleExportImage(chartRef.current),
    },
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: '保存为PDF',
      onClick: () => handleExportPdf(chartRef.current),
    },
    {
      key: 'excel',
      icon: <FileExcelOutlined />,
      label: '导出Excel',
      onClick: () => {
        const columns = (tableConfig?.columns || []).map((col) => ({
          title: col.title || col.label || col.key,
          dataIndex: col.dataIndex || col.key,
        }));
        handleExportExcel(chartData, columns);
      },
    },
  ], [handleExportImage, handleExportPdf, handleExportExcel, tableConfig, chartData]);

  const getTableDownloadItems = useCallback((refEl, data, columns) => [
    {
      key: 'image',
      icon: <FileImageOutlined />,
      label: '保存为图片',
      onClick: () => handleExportImage(refEl),
    },
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: '保存为PDF',
      onClick: () => handleExportPdf(refEl),
    },
    {
      key: 'excel',
      icon: <FileExcelOutlined />,
      label: '导出Excel',
      onClick: () => handleExportExcel(data, columns),
    },
  ], [handleExportImage, handleExportPdf, handleExportExcel]);

  const fetchDataRef = useRef();

  useEffect(() => {
    const fetchConfig = async () => {
      // 切换图表时先清空旧配置和数据，防止 useEffect([tableId, tableConfig]) 用旧配置加载数据
      setTableConfig(null);
      setDataSource([]);
      setChartData([]);
      setFilteredChartData([]);
      setConfigLoading(true);
      setConfigError(null);
      try {
        const res = await getTableConfig(tableId);
        if (res && res.code === 200 && res.data) {
          setTableConfig(res.data);
          if (chartIdProp) {
            updateTabTitleByChartId(chartIdProp, res.data.name || chartIdProp);
          }
        } else {
          setTableConfig(null);
          setConfigError('未找到表格配置');
        }
      } catch (err) {
        setTableConfig(null);
        setConfigError('获取配置失败');
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, [tableId]);

  const fetchTableData = useCallback(
    async (params = {}) => {
      if (!tableConfig) return;
      setLoading(true);
      try {
        const requestParams = {
          page: params.page || pagination.page,
          pageSize: params.pageSize || pagination.pageSize,
          ...params.filters,
        };
        if (params.sortField) {
          requestParams.sortField = params.sortField;
          requestParams.sortOrder = params.sortOrder;
        }
        const dlConfig = tableConfig.styleConfig || {};
        const dlRange = getDateLinkageRange(dlConfig);
        if (dlRange) {
          const activeRange = dateLinkageActiveRange || dlConfig.dateLinkageRange;
          const today = dayjs();
          let dlStart, dlEnd;
          switch (activeRange) {
            case 'today':
              dlStart = today.format('YYYY-MM-DD');
              dlEnd = today.format('YYYY-MM-DD');
              break;
            case 'week':
              dlStart = today.startOf('week').format('YYYY-MM-DD');
              dlEnd = today.format('YYYY-MM-DD');
              break;
            case 'month':
              dlStart = today.startOf('month').format('YYYY-MM-DD');
              dlEnd = today.format('YYYY-MM-DD');
              break;
            case 'yesterday':
              dlStart = today.subtract(1, 'day').format('YYYY-MM-DD');
              dlEnd = today.subtract(1, 'day').format('YYYY-MM-DD');
              break;
            case 'dayBeforeYesterday':
              dlStart = today.subtract(2, 'day').format('YYYY-MM-DD');
              dlEnd = today.subtract(2, 'day').format('YYYY-MM-DD');
              break;
            case 'custom':
              // 自定义日期范围（下钻传递的日期范围）
              if (dateLinkageStartDate) dlStart = dayjs(dateLinkageStartDate).format('YYYY-MM-DD');
              if (dateLinkageEndDate) dlEnd = dayjs(dateLinkageEndDate).format('YYYY-MM-DD');
              break;
          }
          if (dlStart && !requestParams[`${dlRange.field}_startDate`]) {
            requestParams[`${dlRange.field}_startDate`] = dlStart;
          }
          if (dlEnd && !requestParams[`${dlRange.field}_endDate`]) {
            requestParams[`${dlRange.field}_endDate`] = dlEnd;
          }
        }
        const res = await getTableData(tableId, requestParams);
        if (res.code === 200 && res.data) {
          const rawData = res.data.list || [];
          setDataSource(rawData);
          setPagination((prev) => ({
            ...prev,
            page: res.data.page,
            pageSize: res.data.pageSize,
            total: res.data.total,
          }));
          fetchAllFilteredData(requestParams);
        }
      } catch (err) {
        console.error('获取表格数据失败:', err);
      } finally {
        setLoading(false);
      }
    },
    [tableConfig, tableId, pagination.page, pagination.pageSize, dateLinkageActiveRange, dateLinkageStartDate, dateLinkageEndDate]
  );

  const fetchAllFilteredData = useCallback(
    async (filterParams = {}) => {
      if (!tableConfig || !isTableType) return;
      const sc = tableConfig.styleConfig || {};
      const summaryFields = sc.summaryFields || [];
      if (summaryFields.length === 0) {
        setAllFilteredData([]);
        return;
      }
      try {
        const { page, pageSize, ...params } = filterParams;
        const res = await getTableData(tableId, { ...params, page: 1, pageSize: 999999 });
        if (res.code === 200 && res.data) {
          setAllFilteredData(res.data.list || []);
        }
      } catch (err) {
        console.error('获取全量筛选数据失败:', err);
      }
    },
    [tableConfig, tableId, isTableType]
  );

  const fetchChartData = useCallback(
    async () => {
      if (!tableConfig || !isDynamicChart || isTableType) return;
      setLoading(true);
      try {
        const requestParams = { page: 1, pageSize: 9999 };
        const dlConfig = tableConfig.styleConfig || {};
        const dlRange = getDateLinkageRange(dlConfig);
        if (dlRange) {
          const activeRange = dateLinkageActiveRange || dlConfig.dateLinkageRange;
          const today = dayjs();
          let dlStart, dlEnd;
          switch (activeRange) {
            case 'today':
              dlStart = today.format('YYYY-MM-DD');
              dlEnd = today.format('YYYY-MM-DD');
              break;
            case 'week':
              dlStart = today.startOf('week').format('YYYY-MM-DD');
              dlEnd = today.format('YYYY-MM-DD');
              break;
            case 'month':
              dlStart = today.startOf('month').format('YYYY-MM-DD');
              dlEnd = today.format('YYYY-MM-DD');
              break;
            case 'yesterday':
              dlStart = today.subtract(1, 'day').format('YYYY-MM-DD');
              dlEnd = today.subtract(1, 'day').format('YYYY-MM-DD');
              break;
            case 'dayBeforeYesterday':
              dlStart = today.subtract(2, 'day').format('YYYY-MM-DD');
              dlEnd = today.subtract(2, 'day').format('YYYY-MM-DD');
              break;
            case 'custom':
              // 自定义日期范围（下钻传递的日期范围）
              if (dateLinkageStartDate) dlStart = dayjs(dateLinkageStartDate).format('YYYY-MM-DD');
              if (dateLinkageEndDate) dlEnd = dayjs(dateLinkageEndDate).format('YYYY-MM-DD');
              break;
          }
          if (dlStart && !requestParams[`${dlRange.field}_startDate`]) {
            requestParams[`${dlRange.field}_startDate`] = dlStart;
          }
          if (dlEnd && !requestParams[`${dlRange.field}_endDate`]) {
            requestParams[`${dlRange.field}_endDate`] = dlEnd;
          }
        }
        const res = await getTableData(tableId, requestParams);
        if (res.code === 200 && res.data) {
          const rawData = res.data.list || [];
          setChartData(rawData);
          setFilteredChartData(rawData);
        }
      } catch (err) {
        console.error('获取图表数据失败:', err);
      } finally {
        setLoading(false);
      }
    },
    [tableConfig, tableId, isDynamicChart, isTableType, dateLinkageActiveRange, dateLinkageStartDate, dateLinkageEndDate]
  );

  fetchDataRef.current = isDynamicChart && !isTableType ? fetchChartData : fetchTableData;

  useEffect(() => {
    const analysisConfig = tableConfig?.analysisConfig || tableConfig?.styleConfig?.analysisConfig;
    const showAnalysis = tableConfig?.styleConfig?.showAnalysis;
    // 如果分析说明开关关闭，不请求分析数据
    if (!showAnalysis || !tableId || !tableConfig) {
      setAnalysisText('');
      return;
    }
    // 判断是否有有效的新格式配置（V2 格式：只要有 refs 就视为有效配置）
    let hasAnalysisConfig = false;
    if (analysisConfig) {
      try {
        const parsed = typeof analysisConfig === 'string' ? JSON.parse(analysisConfig) : analysisConfig;
        if (parsed && parsed.refs && Object.keys(parsed.refs).length > 0) {
          hasAnalysisConfig = true;
        }
      } catch { /* 解析失败，忽略 */ }
    }
    if (!hasAnalysisConfig) {
      setAnalysisText('');
      return;
    }
    const compute = async () => {
      try {
        const requestData = { filterParams: filters };
        // 使用新格式 analysisConfig
        if (hasAnalysisConfig) {
          const parsed = typeof analysisConfig === 'string' ? JSON.parse(analysisConfig) : analysisConfig;
          requestData.analysisConfig = JSON.stringify(parsed);
        }
        const res = await dashboardService.computeAnalysis(tableId, requestData);
        if (res && res.code === 200 && res.data) {
          const text = res.data.text || '';
          if (text) {
            setAnalysisText(text);
          } else {
            setAnalysisText('');
          }
        } else {
          setAnalysisText('');
        }
      } catch (e) {
        setAnalysisText('');
      }
    };
    compute();
  }, [tableId, tableConfig?.analysisConfig, tableConfig?.styleConfig?.analysisConfig, JSON.stringify(filters)]);

  useEffect(() => {
    if (tableConfig) {
      setPagination({ page: 1, pageSize: 20, total: 0 });
      // 合并下钻筛选参数（URL参数 + 标签页传入参数），确保初始请求就包含下钻筛选
      const drilldownFilterParams = {};
      // 合并 URL 中的下钻筛选参数
      if (Object.keys(urlFilters).length > 0) {
        Object.assign(drilldownFilterParams, urlFilters);
        urlFilterApplied.current = true;
      }
      // 合并标签页传入的下钻筛选参数
      if (Object.keys(initialFilterParams).length > 0) {
        for (const [key, val] of Object.entries(initialFilterParams)) {
          const fieldName = key.startsWith('filter_') ? key.replace('filter_', '') : key;
          drilldownFilterParams[fieldName] = val;
        }
        initialFilterApplied.current = true;
        setDrilldownFilters(drilldownFilterParams);
      }
      setFilters(drilldownFilterParams);
      setDefaultSortApplied(false);
      setDataSource([]);
      setChartData([]);
      const sc = tableConfig.styleConfig || {};
      setDateLinkageActiveRange(null);
      setDateLinkageStartDate(null);
      setDateLinkageEndDate(null);

      // 检查下钻筛选参数中是否包含日期范围（${field}_startDate / ${field}_endDate）
      const dlRange = getDateLinkageRange(sc);
      let drilldownDateStart = null;
      let drilldownDateEnd = null;
      if (dlRange) {
        const startKey = `${dlRange.field}_startDate`;
        const endKey = `${dlRange.field}_endDate`;
        if (drilldownFilterParams[startKey]) {
          drilldownDateStart = drilldownFilterParams[startKey];
        }
        if (drilldownFilterParams[endKey]) {
          drilldownDateEnd = drilldownFilterParams[endKey];
        }
      }

      if (drilldownDateStart && drilldownDateEnd) {
        // 下钻参数中包含日期范围，使用下钻传递的日期范围
        setDateLinkageActiveRange('custom');
        setDateLinkageStartDate(drilldownDateStart);
        setDateLinkageEndDate(drilldownDateEnd);
      } else {
        // 无下钻日期范围，使用默认日期范围
        const initialRange = (sc.dateLinkageEnabled && sc.dateLinkageField)
          ? (sc.dateLinkageRange || 'today')
          : 'today';
        setDateLinkageActiveRange(initialRange);
        const dateRange = computeDateRange(initialRange);
        if (dateRange) {
          setDateLinkageStartDate(dateRange.start);
          setDateLinkageEndDate(dateRange.end);
        }
      }
      if (isDynamicChart && !isTableType) {
        fetchChartData();
      } else {
        const initialSortField = sc.defaultSortField || undefined;
        const initialSortOrder = (sc.defaultSortField && sc.defaultSortOrder && sc.defaultSortOrder !== 'none')
          ? (sc.defaultSortOrder === 'asc' ? 'ASC' : 'DESC')
          : undefined;
        if (initialSortField && initialSortOrder) {
          setSorter({ sortField: initialSortField, sortOrder: initialSortOrder });
          fetchTableData({ page: 1, pageSize: 20, filters: drilldownFilterParams, sortField: initialSortField, sortOrder: initialSortOrder });
          setDefaultSortApplied(true);
        } else {
          setSorter({ sortField: undefined, sortOrder: undefined });
          fetchTableData({ page: 1, pageSize: 20, filters: drilldownFilterParams });
        }
        // 标记跳过 dateLinkageActiveRange 效果的首次触发，避免重复请求
        skipDateLinkageFetch.current = true;
      }
    }
  }, [tableId, tableConfig]);

  useEffect(() => {
    if (tableConfig && dateLinkageActiveRange !== null) {
      // 跳过 tableConfig 效果触发的首次 dateLinkage 请求，避免重复
      if (skipDateLinkageFetch.current) {
        skipDateLinkageFetch.current = false;
        return;
      }
      const dateRange = computeDateRange(dateLinkageActiveRange);
      if (dateRange) {
        setDateLinkageStartDate(dateRange.start);
        setDateLinkageEndDate(dateRange.end);
      }
      if (isDynamicChart && !isTableType) {
        fetchChartData();
      } else {
        fetchTableData({ page: 1, pageSize: pagination.pageSize, filters, sortField: sorter.sortField, sortOrder: sorter.sortOrder });
      }
    }
  }, [dateLinkageActiveRange]);

  const handleFilter = useCallback(
    (filterParams) => {
      setFilters(filterParams);
      setPagination((prev) => ({ ...prev, page: 1 }));

      if (isDynamicChart && !isTableType) {
        setChartFilters(filterParams);
        if (!filterParams || Object.keys(filterParams).length === 0) {
          setFilteredChartData(chartData);
          return;
        }
        const filtered = chartData.filter((row) => {
          return Object.entries(filterParams).every(([key, val]) => {
            if (val === undefined || val === null || val === '') return true;
            const cellVal = String(row[key] || '');
            if (key.endsWith('_min')) {
              const field = key.replace('_min', '');
              const num = Number(row[field]);
              return isNaN(num) || num >= Number(val);
            }
            if (key.endsWith('_max')) {
              const field = key.replace('_max', '');
              const num = Number(row[field]);
              return isNaN(num) || num <= Number(val);
            }
            if (key.endsWith('_startDate')) {
              const field = key.replace('_startDate', '');
              return String(row[field] || '').substring(0, 10) >= String(val);
            }
            if (key.endsWith('_endDate')) {
              const field = key.replace('_endDate', '');
              return String(row[field] || '').substring(0, 10) <= String(val);
            }
            return cellVal.toLowerCase().includes(String(val).toLowerCase());
          });
        });
        setFilteredChartData(filtered);
      } else {
        fetchTableData({
          page: 1,
          filters: filterParams,
          sortField: sorter.sortField,
          sortOrder: sorter.sortOrder,
        });
      }
    },
    [sorter, fetchTableData, isDynamicChart, isTableType, chartData]
  );
  handleFilterRef.current = handleFilter;

  const handleTableChange = useCallback(
    (paginationConfig, filterConfig, sorterConfig) => {
      const newPage = paginationConfig.current;
      const newPageSize = paginationConfig.pageSize;
      const newSortField =
        sorterConfig && sorterConfig.field ? sorterConfig.field : undefined;
      const newSortOrder =
        sorterConfig && sorterConfig.order
          ? sorterConfig.order === 'ascend'
            ? 'ASC'
            : 'DESC'
          : undefined;

      setPagination((prev) => ({
        ...prev,
        page: newPage,
        pageSize: newPageSize,
      }));
      setSorter({ sortField: newSortField, sortOrder: newSortOrder });

      fetchTableData({
        page: newPage,
        pageSize: newPageSize,
        filters,
        sortField: newSortField,
        sortOrder: newSortOrder,
      });
    },
    [filters, fetchTableData]
  );

  const echartsOption = useMemo(() => {
    if (!tableConfig || !filteredChartData.length) return {};
    const sc = tableConfig.styleConfig || {};
    let sortedData = filteredChartData;
    if (sc.defaultSortField && sc.defaultSortOrder && sc.defaultSortOrder !== 'none') {
      sortedData = [...filteredChartData].sort((a, b) => {
        const va = a[sc.defaultSortField];
        const vb = b[sc.defaultSortField];
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) {
          return sc.defaultSortOrder === 'asc' ? na - nb : nb - na;
        }
        return sc.defaultSortOrder === 'asc'
          ? String(va || '').localeCompare(String(vb || ''))
          : String(vb || '').localeCompare(String(va || ''));
      });
    }
    const option = buildEchartsOption(tableConfig, sortedData);
    // 为每个 series 设置 cursor 属性：下钻启用时为 pointer，否则为 default
    if (option.series) {
      const cursor = drilldown?.enabled ? 'pointer' : 'default';
      option.series = option.series.map(s => ({ ...s, cursor }));
    }
    return option;
  }, [tableConfig, filteredChartData]);

  const isTimestampField = (fieldName) => {
    if (!fieldName) return false;
    const name = fieldName.toLowerCase();
    return name.endsWith('_at') || name.endsWith('_time') || name.endsWith('_date') || name === 'time' || name === 'date' || /日期|时间/.test(fieldName);
  };

  const filterableColumns = useMemo(() => {
    if (!tableConfig || !tableConfig.columns) return [];
    const mapped = tableConfig.columns
      .filter((col) => col.filterable !== false)
      .map((col) => {
        const dataIndex = col.dataIndex || col.key;
        let colType = col.type || 'text';
        if (colType === 'dimension') colType = 'text';
        if (colType === 'measure') colType = 'number';
        if (colType === 'date') colType = 'date';
        return {
          ...col,
          dataIndex,
          key: dataIndex,
          filterable: col.filterable !== undefined ? col.filterable : true,
          type: colType,
        };
      });
    const currentData = chartData.length > 0 ? chartData : dataSource;
    if (currentData && currentData.length > 0) {
      return mapped.map(col => {
        if (col.type === 'date') {
          return col;
        }
        if (col.type === 'text' && isTimestampField(col.dataIndex)) {
          return { ...col, type: 'date' };
        }
        if (col.type === 'text') {
          const uniqueValues = new Set(
            currentData.map(row => row[col.dataIndex]).filter(v => v != null && v !== '')
          );
          if (uniqueValues.size > 0 && uniqueValues.size <= 50) {
            return { ...col, type: 'select', fetchOptions: true };
          }
        }
        if (col.type === 'number') {
          const uniqueValues = new Set(
            currentData.map(row => row[col.dataIndex]).filter(v => v != null && v !== '')
          );
          if (uniqueValues.size > 0 && uniqueValues.size <= 50) {
            return { ...col, type: 'select', fetchOptions: true };
          }
        }
        return col;
      });
    }
    return mapped;
  }, [tableConfig, chartData, dataSource]);

  const cellMergeInfo = useMemo(() => {
    const sc = tableConfig?.styleConfig || {};
    const mf = sc.mergeField || (sc.cellMergeFields && sc.cellMergeFields.length > 0 ? sc.cellMergeFields[0] : undefined);
    if (!mf || !dataSource.length) {
      return {};
    }
    const info = {};
    const spans = [];
    let i = 0;
    while (i < dataSource.length) {
      let span = 1;
      while (i + span < dataSource.length && dataSource[i + span][mf] === dataSource[i][mf]) {
        span++;
      }
      for (let j = 0; j < span; j++) {
        spans.push({ rowSpan: j === 0 ? span : 0 });
      }
      i += span;
    }
    info[mf] = spans;
    return info;
  }, [tableConfig, dataSource]);

  // 下钻字段列单元格点击回调（仅下钻字段列触发，替代之前的整行点击）
  const handleCellDrilldown = useCallback((record) => {
    if (!drilldown?.enabled || !drilldown.targetChartId) return;
    const drilldownFieldsList = drilldown.drilldownFields || (drilldown.sourceField ? [drilldown.sourceField] : (drilldown.dimensionField ? [drilldown.dimensionField] : []));
    const fieldMappings = drilldown.fieldMappings || (drilldown.sourceField && drilldown.targetField && drilldown.sourceField !== drilldown.targetField ? { [drilldown.sourceField]: drilldown.targetField } : {});
    if (drilldownFieldsList.length === 0) return;
    const fp = getCurrentFilterParams();
    for (const field of drilldownFieldsList) {
      const value = record[field];
      if (value !== undefined && value !== null) {
        const targetField = fieldMappings[field] || field;
        fp[`filter_${targetField}`] = value;
      }
    }
    handleDrilldown(fp);
  }, [drilldown, handleDrilldown, getCurrentFilterParams]);

  // 下钻字段列表（传给 DataTable 组件，用于标记下钻字段列）
  const drilldownFieldsList = drilldown?.enabled && drilldown.targetChartId
    ? (drilldown.drilldownFields || (drilldown.sourceField ? [drilldown.sourceField] : (drilldown.dimensionField ? [drilldown.dimensionField] : [])))
    : [];

  // 日期范围变更回调
  const handleDateRangeChange = useCallback((rangeType, field, startDate, endDate) => {
    setDateLinkageActiveRange(rangeType);
    const newFilters = {
      ...filters,
      [`${field}_startDate`]: startDate,
      [`${field}_endDate`]: endDate,
    };
    handleFilter(newFilters);
  }, [filters, handleFilter]);

  // 全屏标签栏渲染（多处复用）
  const renderFullscreenTabs = () => {
    if (!isFullscreen || !openTabs || openTabs.length <= 1) return null;
    return (
      <div className="chrome-tabs-bar-fullscreen">
        <div className="chrome-tabs-list">
          {openTabs.map((tab) => (
            <div
              key={tab.tabId}
              onClick={() => switchTab(tab.tabId)}
              className={`chrome-tab${activeTabKey === tab.tabId ? ' active' : ''}`}
            >
              <span className="chrome-tab-title">{tab.title || tab.chartId}</span>
              <span
                className="chrome-tab-close"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.tabId); }}
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (configLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!tableConfig) {
    return (
      <div>
        <Title level={3} style={{ margin: 0 }}>数据表格</Title>
        <Card>
          <Result
            status="404"
            title="404"
            subTitle={configError || `未找到表格配置，tableId: ${tableId}`}
          />
        </Card>
      </div>
    );
  }

  const tableStyleConfig = tableConfig?.styleConfig || {};
  const showOuterBorder = tableStyleConfig.showOuterBorder !== undefined
    ? tableStyleConfig.showOuterBorder
    : (tableStyleConfig.showBorder !== undefined ? tableStyleConfig.showBorder : true);
  const outerBorderWidth = tableStyleConfig.outerBorderWidth || '1px';
  const outerBorderStyle = showOuterBorder
    ? { border: `${outerBorderWidth} ${tableStyleConfig.borderStyle || 'solid'} ${tableStyleConfig.borderColor || '#e8e8e8'}`, borderRadius: '8px' }
    : {};

  // 富文本类型渲染
  if (isRichTextType) {
    const rtStyle = tableConfig.styleConfig || {};
    return (
      <div className="table-page-wrap">
        <div className="table-page-header">
          <Title level={3} className="table-page-title">{tableConfig.name}</Title>
        </div>
        <Card style={{ borderRadius: 12, border: '1px solid rgba(24,144,255,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="table-page-top-bar" />
          <div
            style={{
              padding: rtStyle.richTextPadding || 16,
              backgroundColor: rtStyle.richTextBgColor || 'transparent',
              fontSize: rtStyle.richTextFontSize || 14,
              color: rtStyle.richTextFontColor || 'rgba(51,51,51,1)',
              textAlign: rtStyle.richTextAlign || 'left',
              lineHeight: rtStyle.richTextLineHeight || 1.8,
              borderRadius: rtStyle.richTextBorderRadius || 8,
              minHeight: 200,
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(rtStyle.richTextContent || '<p style="color:#999">暂无内容</p>') }}
          />
        </Card>
      </div>
    );
  }

  // 图表类型渲染（非表格类型）
  if (isDynamicChart && !isTableType) {
    const descStyleConfig = tableConfig.styleConfig || tableConfig.style_config || {};
    return (
      <div style={{ padding: 0 }}>
        <TableHeader
          tableConfig={tableConfig}
          dateLinkageActiveRange={dateLinkageActiveRange}
          dateLinkageStartDate={dateLinkageStartDate}
          dateLinkageEndDate={dateLinkageEndDate}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          downloadItems={getChartDownloadItems()}
          descStyleConfig={descStyleConfig}
          descPosition={descStyleConfig.descPosition || 'bottom'}
          showDescOnTop={(descStyleConfig.descPosition || 'bottom') === 'top'}
          drilldown={drilldown}
        />
        {isFullscreen && descStyleConfig.showDescription && tableConfig.description && (descStyleConfig.descPosition || 'bottom') === 'top' && (
          <ChartDescBox description={tableConfig.description} styleConfig={descStyleConfig} />
        )}
        {renderFullscreenTabs()}
        <Card className="table-page-card" style={outerBorderStyle}>
          <div className="table-page-top-bar" />
          <TableFilter
            tableConfig={tableConfig}
            dateLinkageActiveRange={dateLinkageActiveRange}
            filters={filters}
            filterableColumns={filterableColumns}
            tableId={tableId}
            urlFilters={Object.keys(drilldownFilters).length > 0 ? { ...urlFilters, ...drilldownFilters } : urlFilters}
            onDateRangeChange={handleDateRangeChange}
            onFilter={handleFilter}
          />
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
        {tableConfig?.styleConfig?.showAnalysis && chartData.length > 0 && <TableAnalysis analysisText={analysisText} />}
        {(descStyleConfig.descPosition || 'bottom') === 'bottom' && <ChartDescBox description={tableConfig.description} styleConfig={descStyleConfig} />}
      </div>
    );
  }

  const showInnerBorder = tableStyleConfig.showInnerBorder !== undefined
    ? tableStyleConfig.showInnerBorder
    : (tableStyleConfig.showBorder !== undefined ? tableStyleConfig.showBorder : true);
  const innerBorderWidth = tableStyleConfig.innerBorderWidth || '1px';
  const tableBorderStyle = showOuterBorder
    ? { border: `${outerBorderWidth} ${tableStyleConfig.borderStyle || 'solid'} ${tableStyleConfig.borderColor || '#e8e8e8'}` }
    : { border: 'none' };

  // 表格类型渲染
  if (isTableType) {
    const descStyleConfig = tableConfig.styleConfig || tableConfig.style_config || {};
    // 导出用的列配置
    const downloadColumns = (tableConfig.columns || []).map((col) => ({
      title: col.title || col.label || col.key,
      dataIndex: col.dataIndex || col.key,
    }));
    // 判断是否有表头背景色配置，用于设置 CSS 变量控制渐变显示
    const hasHeaderBg = !!(tableStyleConfig.headerBgColor || (tableStyleConfig.colorScheme ? getTableColorsFromScheme(tableStyleConfig.colorScheme).headerBg : undefined));
    return (
      <div className="table-page-wrap">
        <div className="table-page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Title level={3} className="table-page-title">
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
          {(descStyleConfig.descPosition || 'bottom') === 'top' && <ChartDescBox description={tableConfig.description} styleConfig={descStyleConfig} />}
          <div className="table-page-actions">
            <Button type="text" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} style={{ color: '#1890ff' }} onClick={toggleFullscreen}>
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
            <Dropdown menu={{ items: getTableDownloadItems(tableRef.current, dataSource, downloadColumns) }} trigger={['click']} placement="bottomRight">
              <Button type="text" icon={<DownloadOutlined />} style={{ color: '#1890ff' }}>
                下载
              </Button>
            </Dropdown>
          </div>
        </div>
        {isFullscreen && descStyleConfig.showDescription && tableConfig.description && (descStyleConfig.descPosition || 'bottom') === 'top' && (
          <ChartDescBox description={tableConfig.description} styleConfig={descStyleConfig} />
        )}
        {renderFullscreenTabs()}
        <Card style={{ borderRadius: 12, border: '1px solid rgba(24,144,255,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', ...outerBorderStyle, backgroundColor: tableStyleConfig.chartBgColor || undefined }}>
          <div className="table-page-top-bar" />
          <TableFilter
            tableConfig={tableConfig}
            dateLinkageActiveRange={dateLinkageActiveRange}
            filters={filters}
            filterableColumns={filterableColumns}
            tableId={tableId}
            urlFilters={Object.keys(drilldownFilters).length > 0 ? { ...urlFilters, ...drilldownFilters } : urlFilters}
            onDateRangeChange={handleDateRangeChange}
            onFilter={handleFilter}
          />
          <div ref={tableRef} style={{
            '--header-bg-image': hasHeaderBg ? 'none' : undefined,
          }}>
            <DataTable
              columns={tableConfig.columns}
              dataSource={dataSource}
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              styleConfig={tableConfig.styleConfig || {}}
              drilldownFields={drilldownFieldsList}
              onDrilldown={handleCellDrilldown}
            />
            {/* 汇总行：当配置了汇总字段时，在表格下方显示合计行 */}
            {(() => {
              const summaryFields = tableStyleConfig.summaryFields || [];
              if (summaryFields.length === 0) return null;
              const cols = tableConfig.columns || [];
              const customStyle = tableStyleConfig.summaryRowCustomStyle;
              const sFontColor = customStyle ? tableStyleConfig.summaryFontColor : undefined;
              const sBgColor = customStyle ? tableStyleConfig.summaryBgColor : undefined;
              const sBold = customStyle ? (tableStyleConfig.summaryBold !== undefined ? tableStyleConfig.summaryBold : false) : false;
              const sAlign = customStyle ? (tableStyleConfig.summaryAlign || 'left') : undefined;
              const sFontSize = customStyle ? tableStyleConfig.summaryFontSize : undefined;
              const sItalic = customStyle ? (tableStyleConfig.summaryItalic || false) : false;
              const summaryFixed = tableStyleConfig.summaryFixed || false;
              const summaryStyle = {
                display: 'flex',
                backgroundColor: sBgColor || '#fafafa',
                borderTop: '2px solid #f0f0f0',
                padding: '8px 0',
                fontSize: sFontSize || 13,
              };
              // 汇总行固定在底部
              if (summaryFixed) {
                summaryStyle.position = 'sticky';
                summaryStyle.bottom = '0';
                summaryStyle.zIndex = '1';
                summaryStyle.backgroundColor = sBgColor || '#fafafa';
              }
              return (
                <div style={summaryStyle}>
                  {cols.map((col, idx) => {
                    const dataIndex = col.dataIndex || col.key;
                    const isSummary = summaryFields.includes(dataIndex);
                    const total = isSummary ? allFilteredData.reduce((sum, row) => {
                      const val = Number(row[dataIndex]);
                      return sum + (isNaN(val) ? 0 : val);
                    }, 0) : null;
                    return (
                      <div key={dataIndex} style={{
                        flex: 1,
                        padding: '4px 16px',
                        fontWeight: sBold ? 700 : 400,
                        fontStyle: sItalic ? 'italic' : 'normal',
                        color: sFontColor || undefined,
                        textAlign: sAlign || (col.type === 'number' ? 'right' : 'left'),
                      }}>
                        {isSummary ? total?.toLocaleString() : (idx === 0 ? '合计' : '')}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Card>
        {tableConfig?.styleConfig?.showAnalysis && dataSource.length > 0 && <TableAnalysis analysisText={analysisText} />}
        {(descStyleConfig.descPosition || 'bottom') === 'bottom' && <ChartDescBox description={tableConfig.description} styleConfig={descStyleConfig} />}
      </div>
    );
  }

  // 默认渲染（非动态图表类型）
  const dataTableColumns = useMemo(() => {
    if (!tableConfig || !tableConfig.columns) return [];
    return tableConfig.columns.map((col) => ({
      title: col.title || col.label || col.key,
      dataIndex: col.dataIndex || col.key,
    }));
  }, [tableConfig]);

  const defaultDescStyleConfig = tableConfig.styleConfig || tableConfig.style_config || {};
  return (
    <div style={{ padding: 0 }}>
      <TableHeader
        tableConfig={tableConfig}
        dateLinkageActiveRange={dateLinkageActiveRange}
        dateLinkageStartDate={dateLinkageStartDate}
        dateLinkageEndDate={dateLinkageEndDate}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        downloadItems={getTableDownloadItems(tableRef.current, dataSource, dataTableColumns)}
        descStyleConfig={defaultDescStyleConfig}
        descPosition={defaultDescStyleConfig.descPosition || 'bottom'}
        showDescOnTop={(defaultDescStyleConfig.descPosition || 'bottom') === 'top'}
        drilldown={drilldown}
      />
      {isFullscreen && defaultDescStyleConfig.showDescription && tableConfig.description && (defaultDescStyleConfig.descPosition || 'bottom') === 'top' && (
        <ChartDescBox description={tableConfig.description} styleConfig={defaultDescStyleConfig} />
      )}
      {renderFullscreenTabs()}
      <Card style={{ borderRadius: 12, border: '1px solid rgba(24,144,255,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div ref={tableRef}>
          <TableFilter
            tableConfig={tableConfig}
            dateLinkageActiveRange={dateLinkageActiveRange}
            filters={filters}
            filterableColumns={filterableColumns}
            tableId={tableId}
            urlFilters={Object.keys(drilldownFilters).length > 0 ? { ...urlFilters, ...drilldownFilters } : urlFilters}
            onDateRangeChange={handleDateRangeChange}
            onFilter={handleFilter}
          />
          <DataTable
            columns={tableConfig.columns}
            dataSource={dataSource}
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            styleConfig={tableConfig.styleConfig || {}}
            drilldownFields={drilldownFieldsList}
            onDrilldown={handleCellDrilldown}
          />
        </div>
      </Card>
      {tableConfig?.styleConfig?.showAnalysis && dataSource.length > 0 && <TableAnalysis analysisText={analysisText} />}
      {(defaultDescStyleConfig.descPosition || 'bottom') === 'bottom' && <ChartDescBox description={tableConfig.description} styleConfig={defaultDescStyleConfig} />}
    </div>
  );
}
