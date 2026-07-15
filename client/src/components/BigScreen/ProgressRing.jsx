import React, { useState, useEffect, useMemo } from 'react';
import { Spin, Empty } from 'antd';
import ReactECharts from 'echarts-for-react';

/**
 * 双层进度环大屏组件
 * 数据驱动：通过 POST /api/dashboard/component-data 获取数据
 * 渲染方式：使用 echarts gauge 实现双层圆环（外环 + 内环）
 * 中心显示：center_text 或外环百分比
 * 不依赖 ChartRenderer、ChartDesignerPage，独立 React 组件
 *
 * props:
 *   - config: component_config 对象，包含数据源、SQL、字段名、样式等配置
 *   - refreshKey: 可选，变化时触发数据刷新
 *
 * config 配置项：
 *   - datasource_id: 数据源ID
 *   - query_sql: SQL 语句
 *   - outer_field: 外环数值字段名
 *   - outer_total_field: 外环总数字段（外环百分比 = outer_field / outer_total_field * 100）
 *   - inner_field: 内环数值字段名（可选，留空则只显示外环）
 *   - inner_total_field: 内环总数字段（可选）
 *   - outer_color: 外环颜色（默认 '#00ffff'）
 *   - inner_color: 内环颜色（默认 '#ff6b6b'）
 *   - center_text: 中心文字（留空显示外环百分比）
 *   - ring_width: 环宽（默认 20）
 *   - backgroundColor: 背景颜色（默认 'transparent'）
 */
const ProgressRing = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    datasource_id,
    query_sql,
    outer_field = 'done',
    outer_total_field = 'count',
    inner_field = '',
    inner_total_field = '',
    outer_color = '#00ffff',
    inner_color = '#ff6b6b',
    center_text = '',
    ring_width = 20,
    backgroundColor = 'transparent',
  } = props.config || {};

  // 状态：外环百分比（0~100）
  const [outerPercent, setOuterPercent] = useState(0);
  // 状态：内环百分比（0~100）
  const [innerPercent, setInnerPercent] = useState(0);
  // 状态：数据加载中
  const [loading, setLoading] = useState(false);
  // 状态：错误信息（数据加载失败时）
  const [errorMsg, setErrorMsg] = useState('');
  // 状态：是否有数据（用于判断显示空状态）
  const [hasData, setHasData] = useState(false);

  /**
   * 计算百分比，避免除零
   * @param {number} value 当前值
   * @param {number} total 总值
   * @returns {number} 百分比 0~100
   */
  const calcPercent = (value, total) => {
    const numValue = Number(value);
    const numTotal = Number(total);
    // 总值为 0 或非数字时返回 0，避免除零
    if (!numTotal || isNaN(numTotal) || isNaN(numValue)) {
      return 0;
    }
    const percent = (numValue / numTotal) * 100;
    // 限制在 0~100 范围内
    return Math.max(0, Math.min(100, percent));
  };

  /**
   * 调用后端接口获取组件数据
   * 接口：POST /api/dashboard/component-data
   * 返回格式：{code: 200, message, data: [行数据数组]}（兼容 {success, data}）
   * 从返回数据的第一行取 outer_field/outer_total_field 计算外环百分比
   * 若配置了 inner_field/inner_total_field 则同时计算内环百分比
   */
  const fetchData = async () => {
    // 数据源 ID 或 SQL 缺失时不查询，重置为 0
    if (!datasource_id || !query_sql || !query_sql.trim()) {
      setOuterPercent(0);
      setInnerPercent(0);
      setHasData(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      // token 兼容 data_vis_token 与 token 两种 key
      const token = localStorage.getItem('data_vis_token') || localStorage.getItem('token') || '';
      const res = await fetch('/api/dashboard/component-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ datasource_id, query_sql }),
      });
      const json = await res.json();
      // 兼容两种返回格式：{code:200, data} 或 {success:true, data}
      const ok = json.success === true || json.code === 200 || json.code === '200';
      if (!ok) {
        throw new Error(json.message || '数据查询失败');
      }
      const rows = Array.isArray(json.data) ? json.data : [];
      // 无数据时重置为 0
      if (rows.length === 0 || !rows[0]) {
        setOuterPercent(0);
        setInnerPercent(0);
        setHasData(false);
        return;
      }
      const row = rows[0];
      // 计算外环百分比
      const outer = calcPercent(row[outer_field], row[outer_total_field]);
      setOuterPercent(outer);
      // 计算内环百分比（仅当配置了 inner_field 和 inner_total_field 时）
      if (inner_field && inner_total_field) {
        const inner = calcPercent(row[inner_field], row[inner_total_field]);
        setInnerPercent(inner);
      } else {
        setInnerPercent(0);
      }
      setHasData(true);
    } catch (err) {
      setErrorMsg(`数据加载失败：${err.message}`);
      // 出错时不改变当前显示值，保持上一次的数据
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时和 refreshKey 变化时调用 fetchData
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    datasource_id,
    query_sql,
    outer_field,
    outer_total_field,
    inner_field,
    inner_total_field,
    props.refreshKey,
  ]);

  // 是否显示内环（仅当配置了 inner_field 和 inner_total_field 时）
  const showInner = !!(inner_field && inner_total_field);

  /**
   * 构建 echarts option
   * - 外环 gauge：radius 85%，显示进度弧，无刻度无指针
   * - 内环 gauge：radius 60%（仅当 showInner 为 true），同样无刻度无指针
   * - 中心文字：使用外环 gauge 的 detail 显示 center_text 或外环百分比
   * - 圆环起始角度 90 度（顶部），结束角度 -270 度（顺时针完整一圈）
   */
  const option = useMemo(() => {
    // 中心显示文字：优先 center_text，否则显示外环百分比
    const centerDisplayText = center_text || `${outerPercent.toFixed(1)}%`;

    // 外环 gauge 配置
    const outerSeries = {
      type: 'gauge',
      radius: '85%',
      center: ['50%', '50%'],
      startAngle: 90,
      endAngle: -270,
      pointer: { show: false },
      // 进度弧配置：显示、圆角、不重叠
      progress: {
        show: true,
        overlap: false,
        roundCap: true,
        clip: false,
        itemStyle: { color: outer_color },
      },
      // 轴线（背景圆环）：半透明白色
      axisLine: {
        lineStyle: {
          width: ring_width,
          color: [[1, 'rgba(255,255,255,0.1)']],
        },
      },
      // 不显示分割线、刻度、刻度标签
      splitLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      // 数据：外环百分比
      data: [{ value: outerPercent }],
      // 不显示 gauge 标题
      title: { show: false },
      // 中心文字配置：显示在圆环中心
      detail: {
        show: true,
        valueAnimation: false,
        formatter: function () {
          return centerDisplayText;
        },
        fontSize: Math.max(18, ring_width + 6),
        color: '#ffffff',
        fontWeight: 'bold',
        offsetCenter: [0, 0],
      },
    };

    // 内环 gauge 配置（仅当 showInner 为 true 时添加）
    const innerSeries = {
      type: 'gauge',
      radius: '60%',
      center: ['50%', '50%'],
      startAngle: 90,
      endAngle: -270,
      pointer: { show: false },
      progress: {
        show: true,
        overlap: false,
        roundCap: true,
        clip: false,
        itemStyle: { color: inner_color },
      },
      axisLine: {
        lineStyle: {
          width: ring_width,
          color: [[1, 'rgba(255,255,255,0.08)']],
        },
      },
      splitLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      // 数据：内环百分比
      data: [{ value: innerPercent }],
      title: { show: false },
      // 内环不显示 detail，避免与外环中心文字重叠
      detail: { show: false },
    };

    // 根据是否显示内环决定 series 数组
    const series = showInner ? [outerSeries, innerSeries] : [outerSeries];

    return { series };
  }, [outerPercent, innerPercent, outer_color, inner_color, center_text, ring_width, showInner]);

  // 容器样式：充满父元素
  const containerStyle = {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: backgroundColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // 加载中遮罩（数据查询时显示）
  const renderLoading = () => {
    if (!loading) return null;
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.2)',
          zIndex: 10,
        }}
      >
        <Spin tip="数据加载中..." />
      </div>
    );
  };

  // 错误或无数据提示
  const renderEmpty = () => {
    // 错误信息优先显示
    if (errorMsg) {
      return (
        <div style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 16 }}>
          {errorMsg}
        </div>
      );
    }
    // 无数据且不在加载中：显示暂无数据
    if (!hasData && !loading) {
      return <Empty description={<span style={{ color: '#b0b0b0' }}>暂无数据</span>} />;
    }
    // 数据加载中且无已有数据：显示数据加载中
    if (loading && !hasData) {
      return <Spin tip="数据加载中..." />;
    }
    return null;
  };

  return (
    <div className="progress-ring-container" style={containerStyle}>
      {renderLoading()}
      {hasData || loading ? (
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          opts={{ renderer: 'canvas' }}
        />
      ) : (
        renderEmpty()
      )}
    </div>
  );
};

export default ProgressRing;
