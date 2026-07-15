import React from 'react';
import { Modal, Row, Col, Divider, Tooltip } from 'antd';
import {
  FontSizeOutlined,
  BorderOuterOutlined,
  ClockCircleOutlined,
  DotChartOutlined,
  NumberOutlined,
  GlobalOutlined,
  PieChartOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';

/**
 * 大屏组件库面板
 * 以 Modal 形式展示所有大屏专用组件，分类为"装饰组件"和"数据组件"
 * 点击组件卡片即将其添加到画布，调用 onAdd 回调返回组件信息对象
 *
 * 严格隔离原则：不依赖 ChartRenderer、不依赖 ChartDesignerPage，仅作为大屏组件库入口
 *
 * Props:
 *   - visible: boolean   是否显示组件库面板
 *   - onClose: function  关闭面板回调
 *   - onAdd: function    添加组件回调，参数为 { component_type, name, component_config }
 *
 * 默认 component_config 字段名以各组件实际读取的字段名为准（确保默认配置生效）：
 *   - DecorativeBorder 实际读取 preset（非 borderStyle），无 borderColor 字段
 *   - ClockWidget 实际读取 mode（非 displayMode）
 */

/* antd 图标映射表：将规格中的简短图标名映射到实际的 antd 图标组件 */
const iconMap = {
  Title: FontSizeOutlined,
  BorderOuter: BorderOuterOutlined,
  ClockCircle: ClockCircleOutlined,
  DotChart: DotChartOutlined,
  Number: NumberOutlined,
  Global: GlobalOutlined,
  PieChart: PieChartOutlined,
  OrderedList: OrderedListOutlined,
};

/* 装饰组件列表（纯视觉，无数据源） */
const decorativeComponents = [
  {
    component_type: 'decorative_title',
    name: '装饰性大标题',
    icon: 'Title',
    description: 'SVG 科技感标题，左右装饰图案',
    defaultConfig: {
      text: '可视化大屏标题',
      fontSize: 24,
      color: '#ffffff',
      decorateStyle: 'diamond',
      position: 'top',
    },
  },
  {
    component_type: 'decorative_border',
    name: '装饰边框',
    icon: 'BorderOuter',
    description: 'SVG 预设边框，四角科技角标',
    defaultConfig: {
      preset: 'tech_blue',
      showTitle: false,
      title: '',
    },
  },
  {
    component_type: 'clock',
    name: '时钟',
    icon: 'ClockCircle',
    description: '实时时钟，支持多种显示模式',
    defaultConfig: {
      mode: 'time_date',
      fontSize: 16,
      color: '#ffffff',
    },
  },
  {
    component_type: 'particle',
    name: '粒子背景',
    icon: 'DotChart',
    description: 'Canvas 粒子动画，蛛网连线效果',
    defaultConfig: {
      density: 50,
      color: '#00ffff',
      speed: 1,
    },
  },
];

/* 数据组件列表（数据驱动，需配置数据源） */
const dataComponents = [
  {
    component_type: 'digital',
    name: '数字翻牌器',
    icon: 'Number',
    description: '数字滚动动画，单值指标展示',
    defaultConfig: {
      datasource_id: null,
      query_sql: '',
      value_field: '',
      fontSize: 48,
      color: '#00ffff',
      unit: '',
      prefix: '',
      scrollAnimation: true,
      scrollDuration: 1500,
      title: '',
    },
  },
  {
    component_type: 'map',
    name: '中国地图',
    icon: 'Global',
    description: '中国地图按省份着色，DataV 风格',
    defaultConfig: {
      datasource_id: null,
      query_sql: '',
      province_field: '',
      value_field: '',
      color_start: '#e0f3ff',
      color_end: '#0066cc',
      show_province_name: false,
      show_value_label: false,
    },
  },
  {
    component_type: 'progress_ring',
    name: '双层进度环',
    icon: 'PieChart',
    description: 'echarts gauge 双层圆环',
    defaultConfig: {
      datasource_id: null,
      query_sql: '',
      outer_field: '',
      outer_total_field: '',
      inner_field: '',
      inner_total_field: '',
      outer_color: '#00ffff',
      inner_color: '#ff6b6b',
      center_text: '',
      ring_width: 20,
    },
  },
  {
    component_type: 'ranking',
    name: '排行榜',
    icon: 'OrderedList',
    description: '横条柱状图，跑马灯轮转滚动',
    defaultConfig: {
      datasource_id: null,
      query_sql: '',
      name_field: '',
      value_field: '',
      top_n: 10,
      scroll_animation: true,
      scroll_speed: 2000,
      bar_color: '#00ffff',
    },
  },
];

/**
 * 单个组件卡片
 * 鼠标悬停高亮，点击触发添加
 */
const ComponentCard = ({ component, onAdd }) => {
  // 获取图标组件，若映射不存在则使用默认图标
  const IconComp = iconMap[component.icon] || FontSizeOutlined;

  // 卡片容器样式
  const cardStyle = {
    height: 100,
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: 6,
    background: 'rgba(0, 212, 255, 0.05)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.25s ease',
    userSelect: 'none',
  };

  // 图标样式
  const iconStyle = {
    fontSize: 28,
    color: '#00d4ff',
  };

  // 名称样式
  const nameStyle = {
    fontSize: 14,
    color: '#e0f7ff',
    fontWeight: 500,
  };

  // 描述样式
  const descStyle = {
    fontSize: 11,
    color: '#7fa3b8',
    textAlign: 'center',
    padding: '0 4px',
  };

  // 鼠标悬停高亮效果
  const handleMouseEnter = (e) => {
    e.currentTarget.style.borderColor = '#00d4ff';
    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
    e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 212, 255, 0.4)';
  };

  // 鼠标移出恢复
  const handleMouseLeave = (e) => {
    e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)';
    e.currentTarget.style.boxShadow = 'none';
  };

  // 点击添加组件
  const handleClick = () => {
    onAdd({
      component_type: component.component_type,
      name: component.name,
      component_config: { ...component.defaultConfig },
    });
  };

  return (
    <Tooltip title={component.description} placement="top">
      <div
        style={cardStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <IconComp style={iconStyle} />
        <div style={nameStyle}>{component.name}</div>
        <div style={descStyle}>{component.description}</div>
      </div>
    </Tooltip>
  );
};

/**
 * 大屏组件库面板主组件
 * 受控 Modal，由父组件控制 visible
 */
const ComponentLibrary = ({ visible, onClose, onAdd }) => {
  // 处理添加：先调用 onAdd 回调，再关闭面板
  const handleAdd = (component) => {
    if (onAdd) {
      onAdd(component);
    }
    if (onClose) {
      onClose();
    }
  };

  // 分组标题样式
  const groupTitleStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: '#00d4ff',
    margin: '4px 0 12px 0',
    letterSpacing: '1px',
  };

  return (
    <Modal
      title="添加大屏组件"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      {/* 装饰组件分组 */}
      <div style={groupTitleStyle}>装饰组件</div>
      <Row gutter={[12, 12]}>
        {decorativeComponents.map((comp) => (
          <Col key={comp.component_type} xs={12} sm={8} md={6}>
            <ComponentCard component={comp} onAdd={handleAdd} />
          </Col>
        ))}
      </Row>

      <Divider style={{ borderColor: 'rgba(0, 212, 255, 0.2)', margin: '20px 0 16px 0' }} />

      {/* 数据组件分组 */}
      <div style={groupTitleStyle}>数据组件</div>
      <Row gutter={[12, 12]}>
        {dataComponents.map((comp) => (
          <Col key={comp.component_type} xs={12} sm={8} md={6}>
            <ComponentCard component={comp} onAdd={handleAdd} />
          </Col>
        ))}
      </Row>
    </Modal>
  );
};

export default ComponentLibrary;
