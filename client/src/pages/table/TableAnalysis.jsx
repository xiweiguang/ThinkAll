import React, { useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { sanitizeHtml } from '../../utils/htmlSanitizer';
import './TableAnalysis.css';

/**
 * 图表总结展示框子组件
 * 样式与描述模块（ChartDescBox）一致
 * 支持分组统计项的 flex 布局展示
 */
export default function TableAnalysis({ analysisText }) {
  const [expanded, setExpanded] = useState(true);

  if (!analysisText) return null;

  return (
    <div className="chart-desc-box" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <InfoCircleOutlined className="chart-desc-box-icon" />
        <a onClick={() => setExpanded(!expanded)} style={{ fontSize: 11, color: '#1890ff', whiteSpace: 'nowrap' }}>
          {expanded ? '收起' : '展开'}
        </a>
      </div>
      <div className="chart-desc-box-content">
        <div className={`chart-desc-box-text ${expanded ? 'chart-desc-box-text-expanded' : ''}`}>
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(analysisText) }} />
        </div>
      </div>
    </div>
  );
}
