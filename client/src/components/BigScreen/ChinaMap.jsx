import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Spin, Empty } from 'antd';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';

/**
 * 中国地图大屏组件
 * 数据驱动：通过 POST /api/dashboard/component-data 获取数据
 * 地图渲染：运行时从阿里云 DataV CDN 获取中国 GeoJSON，使用 echarts.registerMap 注册
 * 视觉映射：使用 visualMap 按数值对省份着色（颜色从 color_start 到 color_end）
 * 不依赖 ChartRenderer、ChartDesignerPage，独立 React 组件
 *
 * props:
 *   - config: component_config 对象，包含数据源、SQL、字段名、样式等配置
 *   - refreshKey: 可选，变化时触发数据刷新
 */
const ChinaMap = (props) => {
  // config 为 undefined 时使用默认值，保证组件健壮性
  const {
    datasource_id,
    query_sql,
    province_field = '省份',
    value_field = '销量',
    color_start = '#e0f3ff',
    color_end = '#0066cc',
    show_province_name = false,
    show_value_label = false,
    backgroundColor = 'transparent',
  } = props.config || {};

  // 状态：地图数据（查询得到的原始数组 [{name, value}]）
  const [mapData, setMapData] = useState([]);
  // 状态：GeoJSON 是否已加载并注册完成
  const [mapReady, setMapReady] = useState(false);
  // 状态：数据加载中
  const [loading, setLoading] = useState(false);
  // 状态：错误信息（数据加载失败时）
  const [errorMsg, setErrorMsg] = useState('');
  // 缓存 GeoJSON 注册是否已执行，避免重复注册
  const registeredRef = useRef(false);
  // 缓存 GeoJSON 中的省份名列表（完整名，如"广东省"），用于与数据省份名匹配
  const geoProvinceNamesRef = useRef([]);

  /**
   * 省份名称归一化函数
   * 去除"省/市/自治区/维吾尔自治区/回族自治区/壮族自治区/特别行政区"等后缀
   * 例如："广东省" -> "广东"，"内蒙古自治区" -> "内蒙古"
   */
  const normalizeProvince = (name) => {
    if (name === null || name === undefined) return '';
    return String(name)
      .replace(/(省|市|自治区|维吾尔自治区|回族自治区|壮族自治区|特别行政区)$/, '')
      .trim();
  };

  /**
   * 加载中国 GeoJSON 并注册到 echarts
   * 使用阿里云 DataV 开放数据 CDN（标准 GeoJSON 编码，兼容 echarts.registerMap）
   * 注册成功后设置 mapReady = true
   */
  const loadAndRegisterMap = async () => {
    // 已注册则跳过
    if (registeredRef.current) {
      setMapReady(true);
      return;
    }
    try {
      const res = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json');
      if (!res.ok) {
        throw new Error(`GeoJSON 加载失败：HTTP ${res.status}`);
      }
      const geoJson = await res.json();
      echarts.registerMap('china', geoJson);
      registeredRef.current = true;
      // 缓存 GeoJSON 中所有省份的完整名（features.properties.name），用于数据匹配
      const names = [];
      if (geoJson && Array.isArray(geoJson.features)) {
        geoJson.features.forEach((feature) => {
          const name = feature && feature.properties && feature.properties.name;
          if (name) names.push(name);
        });
      }
      geoProvinceNamesRef.current = names;
      setMapReady(true);
    } catch (err) {
      // GeoJSON 加载失败时设置错误信息
      setErrorMsg(`地图加载失败：${err.message}`);
      setMapReady(false);
    }
  };

  /**
   * 调用后端接口获取组件数据
   * 接口：POST /api/dashboard/component-data
   * 返回格式：{code: 200, message, data: [行数据数组]}（兼容 {success, data}）
   */
  const fetchData = async () => {
    // 数据源 ID 或 SQL 缺失时不查询
    if (!datasource_id || !query_sql || !query_sql.trim()) {
      setMapData([]);
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
      // 将行数据按 province_field / value_field 映射为 echarts 地图数据格式
      const mapped = rows
        .map((row) => {
          const rawName = row ? row[province_field] : undefined;
          const rawValue = row ? row[value_field] : undefined;
          const numValue = Number(rawValue);
          return {
            name: rawName === null || rawName === undefined ? '' : String(rawName),
            value: isNaN(numValue) ? 0 : numValue,
          };
        })
        .filter((item) => item.name !== '');
      setMapData(mapped);
    } catch (err) {
      setErrorMsg(`数据加载失败：${err.message}`);
      setMapData([]);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载并注册地图，卸载时不需特殊清理（registerMap 全局注册，重复注册会被覆盖）
  useEffect(() => {
    loadAndRegisterMap();
  }, []);

  // 数据查询：挂载时执行一次；refreshKey 变化时重新查询
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource_id, query_sql, province_field, value_field, props.refreshKey]);

  /**
   * 将查询到的 mapData 与 GeoJSON 省份名称进行匹配
   * 匹配规则：
   *   1. 精确匹配（数据"广东省" === GeoJSON"广东省"）
   *   2. 归一化匹配（normalize 后比较，如数据"广东"匹配 GeoJSON"广东省"）
   *   3. 前缀包含匹配（数据归一化名 === GeoJSON 归一化名的前缀）
   * 匹配成功则使用 GeoJSON 的完整省份名（保证 echarts 能正确渲染着色）
   * 未匹配的数据项保留原名称（不会着色，但 tooltip 仍可显示）
   */
  const matchedData = useMemo(() => {
    if (!mapReady) return [];
    const geoNames = geoProvinceNamesRef.current;
    if (!geoNames.length) return mapData;
    // 预计算 GeoJSON 省份名的归一化形式
    const normalizedGeo = geoNames.map((n) => ({ full: n, norm: normalizeProvince(n) }));
    return mapData.map((item) => {
      const normData = normalizeProvince(item.name);
      // 1. 精确匹配
      const exact = normalizedGeo.find((g) => g.full === item.name);
      if (exact) return { ...item, name: exact.full };
      // 2. 归一化完全匹配
      const normMatch = normalizedGeo.find((g) => g.norm === normData);
      if (normMatch) return { ...item, name: normMatch.full };
      // 3. 前缀包含匹配（数据归一化名是 GeoJSON 归一化名的前缀，或反之）
      const prefixMatch = normalizedGeo.find(
        (g) => g.norm.indexOf(normData) === 0 || normData.indexOf(g.norm) === 0
      );
      if (prefixMatch) return { ...item, name: prefixMatch.full };
      // 未匹配，保留原名称
      return item;
    });
  }, [mapData, mapReady]);

  // 计算数值范围（用于 visualMap 的 min/max），避免空数据导致 NaN
  const valueRange = useMemo(() => {
    if (!matchedData.length) return { min: 0, max: 0 };
    const values = matchedData.map((d) => Number(d.value) || 0);
    let min = Math.min(...values);
    let max = Math.max(...values);
    // 当所有值相等时，max 加 1 避免 visualMap 除零
    if (min === max) {
      max = min + 1;
    }
    return { min, max };
  }, [matchedData]);

  /**
   * 构建 echarts option
   * - visualMap 连续型，颜色从 color_start 到 color_end
   * - series type='map', map='china'
   * - 悬停 tooltip 显示省份名和数值
   */
  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          // params.name 为省份名，params.value 为数值
          const val = params.value !== undefined && params.value !== null ? params.value : '无数据';
          return `${params.name}<br/>数值：${val}`;
        },
      },
      visualMap: {
        type: 'continuous',
        min: valueRange.min,
        max: valueRange.max,
        left: 20,
        bottom: 20,
        inRange: { color: [color_start, color_end] },
        textStyle: { color: '#fff' },
        text: ['高', '低'],
        calculable: true,
      },
      series: [
        {
          type: 'map',
          map: 'china',
          roam: false,
          label: {
            show: show_province_name,
            color: '#fff',
            fontSize: 10,
          },
          // emphasis 高亮样式
          emphasis: {
            label: { show: true, color: '#fff' },
            itemStyle: { areaColor: '#ffd700', borderColor: '#fff', borderWidth: 1 },
          },
          itemStyle: {
            borderColor: 'rgba(255,255,255,0.3)',
            borderWidth: 0.5,
          },
          // 数据中数值用于 visualMap 着色；显示数值标签需开启 label.formatter
          data: matchedData.map((d) => ({
            name: d.name,
            value: d.value,
            label: {
              show: show_value_label,
              formatter: `${d.value}`,
              color: '#fff',
              fontSize: 9,
            },
          })),
        },
      ],
    };
  }, [matchedData, valueRange, color_start, color_end, show_province_name, show_value_label]);

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
    // 地图未就绪：显示地图加载中
    if (!mapReady) {
      return <Spin tip="地图加载中..." />;
    }
    // 地图就绪但无数据且不在加载中：显示暂无数据
    if (!matchedData.length && !loading) {
      return <Empty description={<span style={{ color: '#b0b0b0' }}>暂无数据</span>} />;
    }
    // 数据加载中且无已有数据：显示数据加载中
    if (loading && !matchedData.length) {
      return <Spin tip="数据加载中..." />;
    }
    return null;
  };

  return (
    <div className="china-map-container" style={containerStyle}>
      {renderLoading()}
      {mapReady && matchedData.length > 0 ? (
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

export default ChinaMap;
