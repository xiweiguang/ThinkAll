// 大屏组件属性配置面板
// 独立 React 组件，不依赖 ChartDesignerPage、不依赖 ChartStyleConfig
// 根据 component_type 显示不同配置项：
//   - 装饰组件（decorative_title/decorative_border/clock/particle）：仅样式配置
//   - 数据组件（digital/map/progress_ring/ranking）：数据配置 + 样式配置 + SQL 预览
// 配置变更通过 onChange 回调实时传递
//
// 重要：字段名与各 BigScreen 组件实际使用的 config 字段名严格一致，
//       确保配置面板修改后组件能正确读取并生效
import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  ColorPicker,
  Button,
  Collapse,
  Divider,
  Table,
  message,
  Spin,
  Empty,
  Typography,
} from 'antd';

const { TextArea } = Input;
const { Text } = Typography;

// 装饰组件类型集合（仅样式配置，无数据源/SQL/预览）
const DECORATIVE_TYPES = ['decorative_title', 'decorative_border', 'clock', 'particle'];
// 数据组件类型集合（数据配置 + 样式配置 + SQL 预览）
const DATA_TYPES = ['digital', 'map', 'progress_ring', 'ranking'];

/**
 * 从 localStorage 获取登录 token
 * 兼容 data_vis_token 与 token 两种 key（与大屏组件保持一致）
 * @returns {string} token 字符串，可能为空字符串
 */
const getToken = () => localStorage.getItem('data_vis_token') || localStorage.getItem('token') || '';

/**
 * 组件属性配置面板
 * @param {Object} props
 * @param {string} props.component_type 组件类型（decorative_title/decorative_border/clock/particle/digital/map/progress_ring/ranking）
 * @param {Object} props.config 当前 component_config 对象
 * @param {(newConfig: Object) => void} props.onChange 配置变更回调
 */
const ComponentConfigPanel = (props) => {
  const { component_type, config = {}, onChange } = props;

  // 数据源列表
  const [dataSources, setDataSources] = useState([]);
  // 数据源列表加载状态
  const [dsLoading, setDsLoading] = useState(false);
  // SQL 预览数据
  const [previewData, setPreviewData] = useState(null);
  // SQL 预览加载状态
  const [previewLoading, setPreviewLoading] = useState(false);

  // 预览表格列定义：从查询结果第一行对象提取所有 key 作为列
  // 注意：useMemo 必须在组件顶层调用，不能放在嵌套函数中（Hooks 规则）
  const previewColumns = useMemo(() => {
    if (!previewData || previewData.length === 0) return [];
    const firstRow = previewData[0] || {};
    return Object.keys(firstRow).map((key) => ({
      title: key,
      dataIndex: key,
      key,
      ellipsis: true,
    }));
  }, [previewData]);

  // 预览表格行数据：仅取前 5 行，并附加唯一行键
  const previewRows = useMemo(() => {
    if (!previewData) return [];
    return previewData.slice(0, 5).map((row, idx) => ({ ...row, __rowKey: idx }));
  }, [previewData]);

  // 组件挂载时获取数据源列表
  // 接口：GET /api/data-sources（与 dataSourceService.js 一致）
  useEffect(() => {
    let mounted = true;
    setDsLoading(true);
    const token = getToken();
    fetch('/api/data-sources', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        // 兼容两种返回格式：{code:200, data} 或 {success:true, data}
        const ok = json.success === true || json.code === 200 || json.code === '200';
        if (ok) {
          setDataSources(Array.isArray(json.data) ? json.data : []);
        }
      })
      .catch(() => {
        // 静默处理，不打扰用户
      })
      .finally(() => {
        if (mounted) setDsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * 更新单个配置项
   * 保留原有配置，仅覆盖指定 key
   * @param {string} key 配置键名
   * @param {*} value 配置值
   */
  const updateConfig = (key, value) => {
    onChange({ ...config, [key]: value });
  };

  /**
   * SQL 预览：调用 POST /api/dashboard/component-data 测试查询
   * 查询结果前 5 行用 antd Table 显示，列名从数据中提取
   */
  const handlePreview = async () => {
    if (!config.datasource_id) {
      message.warning('请先选择数据源');
      return;
    }
    if (!config.query_sql || !config.query_sql.trim()) {
      message.warning('请先输入 SQL 语句');
      return;
    }
    setPreviewLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/dashboard/component-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          datasource_id: config.datasource_id,
          query_sql: config.query_sql,
        }),
      });
      const json = await res.json();
      // 兼容两种返回格式：{code:200, data} 或 {success:true, data}
      const ok = json.success === true || json.code === 200 || json.code === '200';
      if (ok) {
        const rows = Array.isArray(json.data) ? json.data : [];
        setPreviewData(rows);
        if (rows.length === 0) {
          message.info('查询结果为空');
        }
      } else {
        message.error(json.message || '查询失败');
      }
    } catch (e) {
      message.error('查询请求失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * 渲染数据源选择控件（数据组件通用）
   * @returns {React.ReactNode} Form.Item
   */
  const renderDataSourceSelect = () => (
    <Form.Item label="数据源">
      <Select
        placeholder="请选择数据源"
        value={config.datasource_id || undefined}
        onChange={(val) => updateConfig('datasource_id', val)}
        loading={dsLoading}
        allowClear
        options={dataSources.map((ds) => ({
          label: ds.name || ds.datasource_name || `数据源-${ds.id}`,
          value: ds.id,
        }))}
      />
    </Form.Item>
  );

  /**
   * 渲染 SQL 输入框（数据组件通用）
   * @returns {React.ReactNode} Form.Item
   */
  const renderSqlInput = () => (
    <Form.Item label="SQL 语句">
      <TextArea
        rows={4}
        placeholder="请输入查询 SQL，例如 SELECT region, sales FROM sales_table"
        value={config.query_sql || ''}
        onChange={(e) => updateConfig('query_sql', e.target.value)}
      />
    </Form.Item>
  );

  /**
   * 渲染 SQL 预览按钮及结果表格
   * 列名从查询结果第一行对象提取，最多显示前 5 行
   * 列定义与行数据通过组件顶层的 useMemo 计算（previewColumns / previewRows）
   * @returns {React.ReactNode} 预览区块
   */
  const renderPreviewBlock = () => (
    <Form.Item label="数据预览">
      <Button type="primary" size="small" loading={previewLoading} onClick={handlePreview} block>
        预览查询结果
      </Button>
      {previewLoading ? (
        <div style={{ textAlign: 'center', padding: '12px' }}>
          <Spin />
        </div>
      ) : previewData ? (
        previewData.length === 0 ? (
          <Empty description="查询结果为空" style={{ marginTop: '12px' }} />
        ) : (
          <Table
            size="small"
            columns={previewColumns}
            dataSource={previewRows}
            rowKey="__rowKey"
            pagination={false}
            scroll={{ x: 'max-content' }}
            style={{ marginTop: '8px' }}
          />
        )
      ) : null}
    </Form.Item>
  );

  // ===================== 装饰组件配置项 =====================

  /**
   * 装饰性大标题配置
   * 字段名与 DecorativeTitle.jsx 保持一致
   */
  const renderDecorativeTitleConfig = () => (
    <Form layout="vertical">
      <Form.Item label="标题文字">
        <Input
          placeholder="请输入标题"
          value={config.text || ''}
          onChange={(e) => updateConfig('text', e.target.value)}
        />
      </Form.Item>
      <Form.Item label="字号">
        <InputNumber
          min={12}
          max={120}
          value={config.fontSize ?? 28}
          onChange={(val) => updateConfig('fontSize', val)}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item label="文字颜色">
        <ColorPicker
          value={config.color || '#00ffff'}
          onChange={(color) => updateConfig('color', color.toHexString())}
          showText
        />
      </Form.Item>
      <Form.Item label="装饰样式">
        <Select
          value={config.decorateStyle || 'line'}
          onChange={(val) => updateConfig('decorateStyle', val)}
          options={[
            { label: '菱形', value: 'diamond' },
            { label: '线条', value: 'line' },
            { label: '尖角', value: 'angle' },
          ]}
        />
      </Form.Item>
      <Form.Item label="位置">
        <Select
          value={config.position || 'top'}
          onChange={(val) => updateConfig('position', val)}
          options={[
            { label: '顶部', value: 'top' },
            { label: '中央', value: 'center' },
          ]}
        />
      </Form.Item>
    </Form>
  );

  /**
   * 装饰边框配置
   * 字段名与 DecorativeBorder.jsx 保持一致：
   *   - preset（预设配色，决定边框颜色，无独立 borderColor 字段）
   *   - showTitle / title
   */
  const renderDecorativeBorderConfig = () => (
    <Form layout="vertical">
      <Form.Item label="边框预设">
        <Select
          value={config.preset || 'tech_blue'}
          onChange={(val) => updateConfig('preset', val)}
          options={[
            { label: '科技蓝', value: 'tech_blue' },
            { label: '科技紫', value: 'tech_purple' },
            { label: '医疗青', value: 'medical_green' },
            { label: '暗夜', value: 'night' },
            { label: '尖角', value: 'angle' },
            { label: '流光', value: 'stream' },
          ]}
        />
      </Form.Item>
      <Form.Item label="显示标题栏">
        <Switch
          checked={!!config.showTitle}
          onChange={(val) => updateConfig('showTitle', val)}
        />
      </Form.Item>
      {config.showTitle ? (
        <Form.Item label="标题栏文字">
          <Input
            placeholder="请输入标题栏文字"
            value={config.title || ''}
            onChange={(e) => updateConfig('title', e.target.value)}
          />
        </Form.Item>
      ) : null}
    </Form>
  );

  /**
   * 时钟配置
   * 字段名与 ClockWidget.jsx 保持一致：
   *   - mode（显示模式，注意不是 displayMode）
   *   - fontSize / color
   */
  const renderClockConfig = () => (
    <Form layout="vertical">
      <Form.Item label="显示模式">
        <Select
          value={config.mode || 'time_date'}
          onChange={(val) => updateConfig('mode', val)}
          options={[
            { label: '时钟', value: 'time' },
            { label: '日期', value: 'date' },
            { label: '时钟+日期', value: 'time_date' },
            { label: '日期+星期', value: 'date_week' },
          ]}
        />
      </Form.Item>
      <Form.Item label="字号">
        <InputNumber
          min={10}
          max={80}
          value={config.fontSize ?? 24}
          onChange={(val) => updateConfig('fontSize', val)}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item label="颜色">
        <ColorPicker
          value={config.color || '#00ffff'}
          onChange={(color) => updateConfig('color', color.toHexString())}
          showText
        />
      </Form.Item>
    </Form>
  );

  /**
   * 粒子背景配置
   * 字段名与 ParticleBackground.jsx 保持一致：density / color / speed
   */
  const renderParticleConfig = () => (
    <Form layout="vertical">
      <Form.Item label="密度（1-100）">
        <InputNumber
          min={1}
          max={100}
          value={config.density ?? 50}
          onChange={(val) => updateConfig('density', val)}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item label="颜色">
        <ColorPicker
          value={config.color || '#00d4ff'}
          onChange={(color) => updateConfig('color', color.toHexString())}
          showText
        />
      </Form.Item>
      <Form.Item label="速度（0.1-3）">
        <InputNumber
          min={0.1}
          max={3}
          step={0.1}
          value={config.speed ?? 1}
          onChange={(val) => updateConfig('speed', val)}
          style={{ width: '100%' }}
        />
      </Form.Item>
    </Form>
  );

  // ===================== 数据组件配置项 =====================

  /**
   * 数字翻牌器配置（数据组件）
   * 字段名与 DigitalFlipCard.jsx 保持一致
   */
  const renderDigitalConfig = () => {
    // 数据配置 + 样式配置，使用 Collapse 分组
    const dataConfigPanel = (
      <Form layout="vertical">
        {renderDataSourceSelect()}
        {renderSqlInput()}
        <Form.Item label="数值字段名">
          <Input
            placeholder="如 total"
            value={config.value_field || ''}
            onChange={(e) => updateConfig('value_field', e.target.value)}
          />
        </Form.Item>
        {renderPreviewBlock()}
      </Form>
    );

    const styleConfigPanel = (
      <Form layout="vertical">
        <Form.Item label="标题">
          <Input
            placeholder="显示在数字上方"
            value={config.title || ''}
            onChange={(e) => updateConfig('title', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="数字字号">
          <InputNumber
            min={16}
            max={160}
            value={config.fontSize ?? 48}
            onChange={(val) => updateConfig('fontSize', val)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="数字颜色">
          <ColorPicker
            value={config.color || '#00ffff'}
            onChange={(color) => updateConfig('color', color.toHexString())}
            showText
          />
        </Form.Item>
        <Form.Item label="单位">
          <Input
            placeholder="如 人、元"
            value={config.unit || ''}
            onChange={(e) => updateConfig('unit', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="前缀文字">
          <Input
            placeholder="如 ¥"
            value={config.prefix || ''}
            onChange={(e) => updateConfig('prefix', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="滚动动画">
          <Switch
            checked={config.scrollAnimation !== false}
            onChange={(val) => updateConfig('scrollAnimation', val)}
          />
        </Form.Item>
        <Form.Item label="滚动时长（毫秒）">
          <InputNumber
            min={0}
            max={10000}
            step={100}
            value={config.scrollDuration ?? 1500}
            onChange={(val) => updateConfig('scrollDuration', val)}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    );

    return (
      <Collapse
        defaultActiveKey={['data', 'style']}
        items={[
          { key: 'data', label: '数据配置', children: dataConfigPanel },
          { key: 'style', label: '样式配置', children: styleConfigPanel },
        ]}
      />
    );
  };

  /**
   * 中国地图配置（数据组件）
   * 字段名与 ChinaMap.jsx 保持一致
   */
  const renderMapConfig = () => {
    const dataConfigPanel = (
      <Form layout="vertical">
        {renderDataSourceSelect()}
        {renderSqlInput()}
        <Form.Item label="省份字段名">
          <Input
            placeholder="如 省份"
            value={config.province_field || ''}
            onChange={(e) => updateConfig('province_field', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="数值字段名">
          <Input
            placeholder="如 销量"
            value={config.value_field || ''}
            onChange={(e) => updateConfig('value_field', e.target.value)}
          />
        </Form.Item>
        {renderPreviewBlock()}
      </Form>
    );

    const styleConfigPanel = (
      <Form layout="vertical">
        <Form.Item label="起始颜色">
          <ColorPicker
            value={config.color_start || '#e0f3ff'}
            onChange={(color) => updateConfig('color_start', color.toHexString())}
            showText
          />
        </Form.Item>
        <Form.Item label="结束颜色">
          <ColorPicker
            value={config.color_end || '#0066cc'}
            onChange={(color) => updateConfig('color_end', color.toHexString())}
            showText
          />
        </Form.Item>
        <Form.Item label="显示省份名称">
          <Switch
            checked={!!config.show_province_name}
            onChange={(val) => updateConfig('show_province_name', val)}
          />
        </Form.Item>
        <Form.Item label="显示数值标签">
          <Switch
            checked={!!config.show_value_label}
            onChange={(val) => updateConfig('show_value_label', val)}
          />
        </Form.Item>
      </Form>
    );

    return (
      <Collapse
        defaultActiveKey={['data', 'style']}
        items={[
          { key: 'data', label: '数据配置', children: dataConfigPanel },
          { key: 'style', label: '样式配置', children: styleConfigPanel },
        ]}
      />
    );
  };

  /**
   * 双层进度环配置（数据组件）
   * 字段名与 ProgressRing.jsx 保持一致
   */
  const renderProgressRingConfig = () => {
    const dataConfigPanel = (
      <Form layout="vertical">
        {renderDataSourceSelect()}
        {renderSqlInput()}
        <Form.Item label="外环数值字段">
          <Input
            placeholder="如 done"
            value={config.outer_field || ''}
            onChange={(e) => updateConfig('outer_field', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="外环总数字段">
          <Input
            placeholder="如 count"
            value={config.outer_total_field || ''}
            onChange={(e) => updateConfig('outer_total_field', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="内环数值字段（可选）">
          <Input
            placeholder="留空则只显示外环"
            value={config.inner_field || ''}
            onChange={(e) => updateConfig('inner_field', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="内环总数字段（可选）">
          <Input
            placeholder="留空则只显示外环"
            value={config.inner_total_field || ''}
            onChange={(e) => updateConfig('inner_total_field', e.target.value)}
          />
        </Form.Item>
        {renderPreviewBlock()}
      </Form>
    );

    const styleConfigPanel = (
      <Form layout="vertical">
        <Form.Item label="外环颜色">
          <ColorPicker
            value={config.outer_color || '#00ffff'}
            onChange={(color) => updateConfig('outer_color', color.toHexString())}
            showText
          />
        </Form.Item>
        <Form.Item label="内环颜色">
          <ColorPicker
            value={config.inner_color || '#ff6b6b'}
            onChange={(color) => updateConfig('inner_color', color.toHexString())}
            showText
          />
        </Form.Item>
        <Form.Item label="中心文字">
          <Input
            placeholder="留空显示外环百分比"
            value={config.center_text || ''}
            onChange={(e) => updateConfig('center_text', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="环宽">
          <InputNumber
            min={4}
            max={80}
            value={config.ring_width ?? 20}
            onChange={(val) => updateConfig('ring_width', val)}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    );

    return (
      <Collapse
        defaultActiveKey={['data', 'style']}
        items={[
          { key: 'data', label: '数据配置', children: dataConfigPanel },
          { key: 'style', label: '样式配置', children: styleConfigPanel },
        ]}
      />
    );
  };

  /**
   * 排行榜配置（数据组件）
   * 字段名与 RankingList.jsx 保持一致
   */
  const renderRankingConfig = () => {
    const dataConfigPanel = (
      <Form layout="vertical">
        {renderDataSourceSelect()}
        {renderSqlInput()}
        <Form.Item label="名称字段">
          <Input
            placeholder="如 地区"
            value={config.name_field || ''}
            onChange={(e) => updateConfig('name_field', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="数值字段">
          <Input
            placeholder="如 销量"
            value={config.value_field || ''}
            onChange={(e) => updateConfig('value_field', e.target.value)}
          />
        </Form.Item>
        {renderPreviewBlock()}
      </Form>
    );

    const styleConfigPanel = (
      <Form layout="vertical">
        <Form.Item label="显示行数 TOP N">
          <InputNumber
            min={1}
            max={100}
            value={config.top_n ?? 10}
            onChange={(val) => updateConfig('top_n', val)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="滚动动画">
          <Switch
            checked={config.scroll_animation !== false}
            onChange={(val) => updateConfig('scroll_animation', val)}
          />
        </Form.Item>
        <Form.Item label="滚动速度（毫秒）">
          <InputNumber
            min={500}
            max={10000}
            step={100}
            value={config.scroll_speed ?? 2000}
            onChange={(val) => updateConfig('scroll_speed', val)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="柱条颜色">
          <ColorPicker
            value={config.bar_color || '#00ffff'}
            onChange={(color) => updateConfig('bar_color', color.toHexString())}
            showText
          />
        </Form.Item>
      </Form>
    );

    return (
      <Collapse
        defaultActiveKey={['data', 'style']}
        items={[
          { key: 'data', label: '数据配置', children: dataConfigPanel },
          { key: 'style', label: '样式配置', children: styleConfigPanel },
        ]}
      />
    );
  };

  // 根据组件类型分发到对应的配置渲染函数
  const renderConfigByType = () => {
    switch (component_type) {
      // 装饰组件：仅样式配置
      case 'decorative_title':
        return renderDecorativeTitleConfig();
      case 'decorative_border':
        return renderDecorativeBorderConfig();
      case 'clock':
        return renderClockConfig();
      case 'particle':
        return renderParticleConfig();
      // 数据组件：数据配置 + 样式配置
      case 'digital':
        return renderDigitalConfig();
      case 'map':
        return renderMapConfig();
      case 'progress_ring':
        return renderProgressRingConfig();
      case 'ranking':
        return renderRankingConfig();
      default:
        return (
          <Empty
            description={
              <Text type="secondary">
                未知组件类型：{component_type || '未指定'}
              </Text>
            }
          />
        );
    }
  };

  return (
    <div className="component-config-panel" style={{ padding: '12px' }}>
      {/* 顶部组件类型标识 */}
      <Divider style={{ marginTop: 0, marginBottom: '12px' }}>
        <Text type="secondary">
          {DECORATIVE_TYPES.includes(component_type) ? '装饰组件配置' : ''}
          {DATA_TYPES.includes(component_type) ? '数据组件配置' : ''}
          {!DECORATIVE_TYPES.includes(component_type) && !DATA_TYPES.includes(component_type)
            ? '组件配置'
            : ''}
        </Text>
      </Divider>
      {renderConfigByType()}
    </div>
  );
};

export default ComponentConfigPanel;
