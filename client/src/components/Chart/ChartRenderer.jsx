import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Spin } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getChartConfigByPk, getChartDataByPk, getPublicChartConfig, getPublicChartData, computeAnalysis, computePublicAnalysis } from '../../services/dashboardService';
import { COLOR_MAP, getTableColorsFromScheme } from '../../utils/colorSchemes';
import DataTable from '../Table/DataTable';
import { sanitizeHtml } from '../../utils/htmlSanitizer';
import './ChartRenderer.css';
import '../../pages/TablePage.css';

/**
 * 根据 tableConfig 和图表数据构建 ECharts option 对象
 * 支持 bar、line、pie、double_pie、radar、area、stacked_bar、multi_bar、double_line 等图表类型
 */
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
  // 新增样式配置，带默认值确保旧数据兼容
  // 默认使用透明背景，避免遮挡可视化页面的背景图
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

  // 通用图例配置
  const legendConfig = {
    orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
    [legendPosition === 'hidden' ? 'top' : legendPosition]: legendPosition === 'top' || legendPosition === 'bottom' ? 30 : 'center',
    left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
    textStyle: { fontSize: legendFontSize },
    ...(legendPosition === 'hidden' ? { show: false } : {}),
  };

  // 网格线配置
  const splitLineConfig = {
    show: showGridLine,
    lineStyle: { color: gridLineColor },
  };

  /* 饼图 */
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

  /* 双层饼图 */
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

  /* 雷达图 */
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

  /* 柱状图、折线图、面积图、堆叠柱状图、多系列柱状图、双折线图等 */
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

/**
 * 可复用的图表渲染组件
 * 根据图表配置自动判断渲染为 ECharts 图表或 DataTable 表格
 * 支持筛选参数联动和图表点击回调
 *
 * @param {number} chartId - 图表ID（必需）
 * @param {number|string} width - 宽度（可选，默认100%）
 * @param {number|string} height - 高度（可选，默认300）
 * @param {object} styleOverrides - 样式覆盖（可选）
 * @param {object} filterParams - 筛选参数，用于联动（可选）
 * @param {function} onChartClick - 图表点击回调（可选）
 * @param {boolean} showTitle - 是否显示标题（可选，默认true）
 */
export default function ChartRenderer({
  chartId,
  width,
  height = 300,
  styleOverrides = {},
  filterParams = {},
  onChartClick,
  onDrilldown,
  showTitle = true,
  usePublicApi = false,
}) {
  const [tableConfig, setTableConfig] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisText, setAnalysisText] = useState('');
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const echartsRef = useRef(null);

  /* 获取图表配置 */
  useEffect(() => {
    if (!chartId) return;
    let cancelled = false;
    const fetchConfig = async () => {
      try {
        const res = usePublicApi ? await getPublicChartConfig(chartId) : await getChartConfigByPk(chartId);
        if (!cancelled && res && res.code === 200 && res.data) {
          setTableConfig(res.data);
        } else if (!cancelled) {
          setTableConfig(null);
          setError('未找到图表配置');
        }
      } catch (err) {
        if (!cancelled) {
          setTableConfig(null);
          setError('获取图表配置失败');
        }
      }
    };
    fetchConfig();
    return () => { cancelled = true; };
  }, [chartId, usePublicApi]);

  /* 获取图表数据，当 chartId、tableConfig 或 filterParams 变化时重新获取 */
  const filterParamsKey = JSON.stringify(filterParams || {});
  useEffect(() => {
    if (!chartId || !tableConfig) return;
    // 富文本类型不需要获取数据
    if (tableConfig.chartType === 'rich_text') return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const isTableType = tableConfig.chartType === 'table';
        const requestParams = isTableType
          ? { page: 1, pageSize: 9999, ...filterParams }
          : { page: 1, pageSize: 9999, ...filterParams };
        const res = usePublicApi ? await getPublicChartData(chartId, requestParams) : await getChartDataByPk(chartId, requestParams);
        if (!cancelled && res && res.code === 200 && res.data) {
          setChartData(res.data.list || []);
        } else if (!cancelled) {
          setChartData([]);
        }
      } catch (err) {
        if (!cancelled) {
          setChartData([]);
          setError('获取图表数据失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [chartId, tableConfig, filterParamsKey, usePublicApi]);

  /* 计算分析说明（基于新格式 analysisConfig） */
  useEffect(() => {
    const analysisConfig = tableConfig?.analysisConfig || tableConfig?.styleConfig?.analysisConfig;
    const showAnalysis = tableConfig?.styleConfig?.showAnalysis || tableConfig?.showAnalysis;
    // 如果分析说明开关关闭，不请求分析数据
    if (!showAnalysis || !chartId || !tableConfig) {
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
        const computeFn = usePublicApi ? computePublicAnalysis : computeAnalysis;
        const requestData = { filterParams: filterParams };
        // 使用新格式 analysisConfig
        if (hasAnalysisConfig) {
          const parsed = typeof analysisConfig === 'string' ? JSON.parse(analysisConfig) : analysisConfig;
          requestData.analysisConfig = JSON.stringify(parsed);
        }
        const res = await computeFn(chartId, requestData);
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
  }, [chartId, tableConfig?.analysisConfig, tableConfig?.styleConfig?.analysisConfig, filterParamsKey, usePublicApi]);

  /* 对图表数据应用前端筛选（当 filterParams 中包含非API参数时） */
  const filteredData = useMemo(() => {
    if (!chartData.length) return [];
    if (!filterParams || Object.keys(filterParams).length === 0) return chartData;
    return chartData.filter((row) => {
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
  }, [chartData, filterParams]);

  /* 构建 ECharts option */
  const echartsOption = useMemo(() => {
    if (!tableConfig || !filteredData.length) return {};
    const sc = tableConfig.styleConfig || {};
    let sortedData = filteredData;
    if (sc.defaultSortField && sc.defaultSortOrder && sc.defaultSortOrder !== 'none') {
      sortedData = [...filteredData].sort((a, b) => {
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
      const drilldown = tableConfig?.styleConfig?.drilldown;
      const cursor = drilldown?.enabled ? 'pointer' : 'default';
      option.series = option.series.map(s => ({ ...s, cursor }));
    }
    return option;
  }, [tableConfig, filteredData]);

  /* ECharts 点击事件处理：优先处理下钻，其次处理联动 */
  const handleEchartsClick = useCallback((params) => {
    // 如果图表配置了下钻且传入了 onDrilldown 回调，则优先处理下钻
    const drilldown = tableConfig?.styleConfig?.drilldown;
    if (drilldown?.enabled && drilldown.targetChartId && onDrilldown) {
      // 兼容旧的 sourceField/targetField/dimensionField 格式
      const drilldownFieldsList = drilldown.drilldownFields || (drilldown.sourceField ? [drilldown.sourceField] : (drilldown.dimensionField ? [drilldown.dimensionField] : []));
      const fieldMappings = drilldown.fieldMappings || (drilldown.sourceField && drilldown.targetField && drilldown.sourceField !== drilldown.targetField ? { [drilldown.sourceField]: drilldown.targetField } : {});

      if (drilldownFieldsList.length > 0) {
        const drilldownFilterParams = {};
        // 先合并当前图表的筛选条件（日期范围等），确保下钻后目标图表也应用相同的筛选
        if (filterParams && typeof filterParams === 'object') {
          Object.assign(drilldownFilterParams, filterParams);
        }
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
            drilldownFilterParams[`filter_${targetField}`] = value;
          }
        }
        if (Object.keys(drilldownFilterParams).length > 0) {
          onDrilldown(drilldown.targetChartId, drilldownFilterParams);
          return;
        }
      }
    }
    // 非下钻情况，走联动逻辑
    if (onChartClick && chartId) {
      const fieldName = params.seriesName || '';
      const value = params.name || (params.data && params.data.name) || '';
      onChartClick(chartId, fieldName, value);
    }
  }, [onChartClick, onDrilldown, chartId, tableConfig, filterParams]);

  /* 绑定 ECharts 事件：当下钻、联动回调存在或配置了下钻时绑定点击事件 */
  const onEvents = useMemo(() => {
    const drilldown = tableConfig?.styleConfig?.drilldown;
    if (!onChartClick && !onDrilldown && !(drilldown?.enabled && drilldown.targetChartId)) return {};
    return { click: handleEchartsClick };
  }, [onChartClick, onDrilldown, handleEchartsClick, tableConfig]);

  /* 下钻字段列单元格点击回调（仅下钻字段列触发，替代之前的整行点击） */
  const handleCellDrilldown = useCallback((record) => {
    const drilldown = tableConfig?.styleConfig?.drilldown;
    if (!drilldown?.enabled || !drilldown.targetChartId || !onDrilldown) return;
    const drilldownFieldsList = drilldown.drilldownFields || (drilldown.sourceField ? [drilldown.sourceField] : (drilldown.dimensionField ? [drilldown.dimensionField] : []));
    const fieldMappings = drilldown.fieldMappings || (drilldown.sourceField && drilldown.targetField && drilldown.sourceField !== drilldown.targetField ? { [drilldown.sourceField]: drilldown.targetField } : {});
    if (drilldownFieldsList.length === 0) return;
    const fp = {};
    // 先合并当前图表的筛选条件（日期范围等），确保下钻后目标图表也应用相同的筛选
    if (filterParams && typeof filterParams === 'object') {
      Object.assign(fp, filterParams);
    }
    for (const field of drilldownFieldsList) {
      const value = record[field];
      if (value !== undefined && value !== null) {
        const targetField = fieldMappings[field] || field;
        fp[`filter_${targetField}`] = value;
      }
    }
    if (Object.keys(fp).length > 0) {
      onDrilldown(drilldown.targetChartId, fp);
    }
  }, [tableConfig, onDrilldown, filterParams]);

  /* 下钻字段列表（传给 DataTable 组件，用于标记下钻字段列） */
  const drilldownFieldsList = useMemo(() => {
    const drilldown = tableConfig?.styleConfig?.drilldown;
    if (!drilldown?.enabled || !drilldown.targetChartId) return [];
    return drilldown.drilldownFields || (drilldown.sourceField ? [drilldown.sourceField] : (drilldown.dimensionField ? [drilldown.dimensionField] : []));
  }, [tableConfig]);

  /* 判断图表类型 */
  const isTableType = tableConfig && tableConfig.chartType === 'table';
  const isRichTextType = tableConfig && tableConfig.chartType === 'rich_text';
  const isChartType = tableConfig && tableConfig.chartType && tableConfig.chartType !== 'table' && tableConfig.chartType !== 'rich_text';

  /* 计算容器样式 */
  const containerStyle = useMemo(() => ({
    width: width || '100%',
    height: height || 300,
    ...styleOverrides,
  }), [width, height, styleOverrides]);

  /* 加载中状态 */
  if (loading) {
    return (
      <div className="chart-renderer" style={containerStyle}>
        {showTitle && tableConfig && (
          <div className="chart-renderer-title">{tableConfig.name || ''}</div>
        )}
        <div className="chart-renderer-content">
          <div className="chart-renderer-loading">
            <Spin size="large" />
          </div>
        </div>
      </div>
    );
  }

  /* 错误状态 */
  if (error && !tableConfig) {
    return (
      <div className="chart-renderer" style={containerStyle}>
        <div className="chart-renderer-content">
          <div className="chart-renderer-error">{error}</div>
        </div>
      </div>
    );
  }

  /* 无配置 */
  if (!tableConfig) {
    return (
      <div className="chart-renderer" style={containerStyle}>
        <div className="chart-renderer-content">
          <div className="chart-renderer-error">未找到图表配置</div>
        </div>
      </div>
    );
  }

  /* 表格类型渲染 */
  if (isTableType) {
    const sc = tableConfig.styleConfig || {};
    const hasHeaderBg = !!(sc.headerBgColor || (sc.colorScheme ? getTableColorsFromScheme(sc.colorScheme).headerBg : undefined));
    return (
      <>
        <div className="chart-renderer" style={containerStyle}>
          {showTitle && (
            <div className="chart-renderer-title">
              {tableConfig.name || ''}
            </div>
          )}
          <div className="chart-renderer-content" style={{
            '--header-bg-image': hasHeaderBg ? 'none' : undefined,
            backgroundColor: sc.chartBgColor || undefined,
          }}>
            <DataTable
              columns={tableConfig.columns}
              dataSource={filteredData}
              loading={loading}
              pagination={false}
              styleConfig={tableConfig.styleConfig || {}}
              drilldownFields={drilldownFieldsList}
              onDrilldown={handleCellDrilldown}
          />
        </div>
        </div>
        {(() => {
          const analysisConfig = tableConfig?.analysisConfig || tableConfig?.styleConfig?.analysisConfig;
          const showAnalysisFlag = tableConfig?.styleConfig?.showAnalysis || tableConfig?.showAnalysis;
          let hasAnalysis = false;
          if (analysisConfig) {
            try {
              const parsed = typeof analysisConfig === 'string' ? JSON.parse(analysisConfig) : analysisConfig;
              if (parsed && parsed.refs && Object.keys(parsed.refs).length > 0) {
                hasAnalysis = true;
              }
            } catch {}
          }
          if (!showAnalysisFlag || !hasAnalysis || !chartData.length) return null;
          return (
            <div className="chart-desc-box" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <InfoCircleOutlined className="chart-desc-box-icon" />
                <a onClick={() => setAnalysisExpanded(!analysisExpanded)} style={{ fontSize: 11, color: '#1890ff', whiteSpace: 'nowrap' }}>
                  {analysisExpanded ? '收起' : '展开'}
                </a>
              </div>
              <div className="chart-desc-box-content">
                <div className={`chart-desc-box-text ${analysisExpanded ? 'chart-desc-box-text-expanded' : ''}`}>
                  {analysisText ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(analysisText) }} />
                  ) : (
                    <div style={{ color: '#999', fontSize: 13 }}>暂无分析数据</div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </>
    );
  }

  /* 富文本类型渲染 */
  if (isRichTextType) {
    const rtStyle = tableConfig.styleConfig || {};
    return (
      <div className="chart-renderer" style={containerStyle}>
        {showTitle && (
          <div className="chart-renderer-title">{tableConfig.name || ''}</div>
        )}
        <div
          className="chart-renderer-content"
          style={{
            padding: rtStyle.richTextPadding || 16,
            backgroundColor: rtStyle.richTextBgColor || 'transparent',
            fontSize: rtStyle.richTextFontSize || 14,
            color: rtStyle.richTextFontColor || 'rgba(51,51,51,1)',
            textAlign: rtStyle.richTextAlign || 'left',
            lineHeight: rtStyle.richTextLineHeight || 1.8,
            borderRadius: rtStyle.richTextBorderRadius || 8,
            overflow: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(rtStyle.richTextContent || '<p style="color:#999">暂无内容</p>') }}
        />
      </div>
    );
  }

  /* 图表类型渲染 */
  if (isChartType) {
    return (
      <>
        <div className="chart-renderer" style={containerStyle}>
          {showTitle && (
            <div className="chart-renderer-title">
              {tableConfig.name || ''}
            </div>
          )}
          <div className="chart-renderer-content">
            {filteredData.length > 0 && Object.keys(echartsOption).length > 0 ? (
              <ReactECharts
                ref={echartsRef}
                option={echartsOption}
                style={{ height: '100%', width: '100%' }}
                notMerge={true}
                onEvents={onEvents}
              />
            ) : (
              <div className="chart-renderer-error">
                {chartData.length > 0 ? '没有符合筛选条件的数据' : '暂无数据'}
              </div>
            )}
          </div>
        </div>
        {(() => {
          const analysisConfig = tableConfig?.analysisConfig || tableConfig?.styleConfig?.analysisConfig;
          const showAnalysisFlag = tableConfig?.styleConfig?.showAnalysis || tableConfig?.showAnalysis;
          let hasAnalysis = false;
          if (analysisConfig) {
            try {
              const parsed = typeof analysisConfig === 'string' ? JSON.parse(analysisConfig) : analysisConfig;
              if (parsed && parsed.refs && Object.keys(parsed.refs).length > 0) {
                hasAnalysis = true;
              }
            } catch {}
          }
          if (!showAnalysisFlag || !hasAnalysis || !chartData.length) return null;
          return (
            <div className="chart-desc-box" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <InfoCircleOutlined className="chart-desc-box-icon" />
                <a onClick={() => setAnalysisExpanded(!analysisExpanded)} style={{ fontSize: 11, color: '#1890ff', whiteSpace: 'nowrap' }}>
                  {analysisExpanded ? '收起' : '展开'}
                </a>
              </div>
              <div className="chart-desc-box-content">
                <div className={`chart-desc-box-text ${analysisExpanded ? 'chart-desc-box-text-expanded' : ''}`}>
                  {analysisText ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(analysisText) }} />
                  ) : (
                    <div style={{ color: '#999', fontSize: 13 }}>暂无分析数据</div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </>
    );
  }

  /* 非动态图表（普通表格），使用 DataTable 渲染 */
  const defaultSc = tableConfig.styleConfig || {};
  const defaultHasHeaderBg = !!(defaultSc.headerBgColor || (defaultSc.colorScheme ? getTableColorsFromScheme(defaultSc.colorScheme).headerBg : undefined));
  return (
    <>
      <div className="chart-renderer" style={containerStyle}>
        {showTitle && (
          <div className="chart-renderer-title">
            {tableConfig.name || ''}
          </div>
        )}
        <div className="chart-renderer-content" style={{
          '--header-bg-image': defaultHasHeaderBg ? 'none' : undefined,
        }}>
          <DataTable
            columns={tableConfig.columns}
            dataSource={filteredData}
            loading={loading}
            pagination={false}
            styleConfig={tableConfig.styleConfig || {}}
            drilldownFields={drilldownFieldsList}
            onDrilldown={handleCellDrilldown}
          />
        </div>
      </div>
      {(() => {
        const analysisConfig = tableConfig?.analysisConfig || tableConfig?.styleConfig?.analysisConfig;
        const showAnalysisFlag = tableConfig?.styleConfig?.showAnalysis || tableConfig?.showAnalysis;
        let hasAnalysis = false;
        if (analysisConfig) {
          try {
            const parsed = typeof analysisConfig === 'string' ? JSON.parse(analysisConfig) : analysisConfig;
            if (parsed && parsed.refs && Object.keys(parsed.refs).length > 0) {
              hasAnalysis = true;
            }
          } catch {}
        }
        if (!showAnalysisFlag || !hasAnalysis || !chartData.length) return null;
        return (
          <div className="chart-desc-box" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <InfoCircleOutlined className="chart-desc-box-icon" />
              <a onClick={() => setAnalysisExpanded(!analysisExpanded)} style={{ fontSize: 11, color: '#1890ff', whiteSpace: 'nowrap' }}>
                {analysisExpanded ? '收起' : '展开'}
              </a>
            </div>
            <div className="chart-desc-box-content">
              <div className={`chart-desc-box-text ${analysisExpanded ? 'chart-desc-box-text-expanded' : ''}`}>
                {analysisText ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(analysisText) }} />
                ) : (
                  <div style={{ color: '#999', fontSize: 13 }}>暂无分析数据</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
