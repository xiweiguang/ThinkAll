import React, { useState } from 'react';
import { RightOutlined } from '@ant-design/icons';

const sectionStyle = {
  marginBottom: 8,
  borderRadius: 6,
  border: '1px solid #f0f0f0',
  overflow: 'hidden',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#fafafa',
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: '1px solid #f0f0f0',
  transition: 'background 0.2s',
};

const headerHoverStyle = {
  background: '#f0f0f0',
};

const titleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontWeight: 500,
  color: '#333',
};

const iconStyle = {
  fontSize: 12,
  color: '#999',
  transition: 'transform 0.2s',
};

const contentStyle = {
  padding: '12px 16px',
};

export default function CollapsibleSection({ title, children, defaultCollapsed = true, extra }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={sectionStyle}>
      <div
        style={{ ...headerStyle, ...(hovered ? headerHoverStyle : {}) }}
        onClick={() => setCollapsed(!collapsed)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={titleStyle}>
          <RightOutlined style={{ ...iconStyle, transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }} />
          <span>{title}</span>
        </div>
        {extra && <div onClick={(e) => e.stopPropagation()}>{extra}</div>}
      </div>
      {!collapsed && <div style={contentStyle}>{children}</div>}
    </div>
  );
}
