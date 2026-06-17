import React from 'react';
import { useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { sanitizeHtml } from '../../utils/htmlSanitizer';

/**
 * 图表描述展示框子组件
 * 支持展开/收起、开关控制和样式配置
 */
export default function ChartDescBox({ description, styleConfig }) {
  const [expanded, setExpanded] = useState(true);
  // 根据开关控制是否显示
  if (!styleConfig?.showDescription || !description) return null;
  const descAlign = styleConfig.descAlign || 'left';
  // 构建描述框内联样式
  const descBoxStyle = {
    textAlign: descAlign,
    fontSize: `${styleConfig.descFontSize || 13}px`,
    color: styleConfig.descFontColor || '#333333',
    fontWeight: styleConfig.descBold ? 'bold' : 'normal',
    fontStyle: styleConfig.descItalic ? 'italic' : 'normal',
    backgroundColor: styleConfig.descBgColor || '#f0f5ff',
    borderLeftColor: styleConfig.descBorderColor || '#1890ff',
    lineHeight: styleConfig.descLineHeight || 1.6,
  };
  if (styleConfig.descFontFamily) {
    descBoxStyle.fontFamily = styleConfig.descFontFamily;
  }
  return (
    <div className="chart-desc-box" style={descBoxStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <InfoCircleOutlined className="chart-desc-box-icon" />
        <a onClick={() => setExpanded(!expanded)} style={{ fontSize: 11, color: '#1890ff', whiteSpace: 'nowrap' }}>
          {expanded ? '收起' : '展开'}
        </a>
      </div>
      <div className="chart-desc-box-content">
        <div className={`chart-desc-box-text ${expanded ? 'chart-desc-box-text-expanded' : ''}`}>
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(description || '') }} />
        </div>
      </div>
    </div>
  );
}
