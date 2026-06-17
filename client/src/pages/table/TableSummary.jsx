import React from 'react';
import { Table as AntTable } from 'antd';

/**
 * 表格汇总行子组件
 * 包含AntTable的summary渲染逻辑
 */
export default function TableSummary({ tableColumns, allFilteredData, tableStyleConfig }) {
  const summaryFields = tableStyleConfig.summaryFields || [];
  if (summaryFields.length === 0) return null;

  const customStyle = tableStyleConfig.summaryRowCustomStyle;
  const sFontColor = customStyle ? tableStyleConfig.summaryFontColor : undefined;
  const sBgColor = customStyle ? tableStyleConfig.summaryBgColor : undefined;
  const sBold = customStyle ? (tableStyleConfig.summaryBold !== undefined ? tableStyleConfig.summaryBold : false) : false;
  const sAlign = customStyle ? (tableStyleConfig.summaryAlign || 'left') : undefined;
  const sFontSize = customStyle ? tableStyleConfig.summaryFontSize : undefined;
  const sItalic = customStyle ? !!tableStyleConfig.summaryItalic : false;
  const sFixed = tableStyleConfig.summaryFixed || false;

  const summarySpanStyle = {
    fontWeight: sBold ? 700 : 400,
    display: 'block',
    ...(sFontColor ? { color: sFontColor } : {}),
    ...(sFontSize ? { fontSize: sFontSize } : {}),
    ...(customStyle && sAlign ? { textAlign: sAlign } : {}),
    ...(sItalic ? { fontStyle: 'italic' } : {}),
  };

  // 获取叶子列
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

  const leafColumns = getLeafColumns(tableColumns);

  return (
    <AntTable.Summary fixed={sFixed || undefined}>
      <AntTable.Summary.Row style={sBgColor ? { backgroundColor: sBgColor } : undefined}>
        {leafColumns.map((col, idx) => {
          if (summaryFields.includes(col.dataIndex)) {
            const total = allFilteredData.reduce((sum, row) => {
              const val = Number(row[col.dataIndex]);
              return sum + (isNaN(val) ? 0 : val);
            }, 0);
            return (
              <AntTable.Summary.Cell key={col.dataIndex} index={col.dataIndex} style={{ textAlign: sAlign }}>
                <span style={summarySpanStyle}>{total}</span>
              </AntTable.Summary.Cell>
            );
          }
          return (
            <AntTable.Summary.Cell key={col.dataIndex} index={col.dataIndex} style={{ textAlign: sAlign }}>
              {idx === 0 ? <span style={summarySpanStyle}>合计</span> : ''}
            </AntTable.Summary.Cell>
          );
        })}
      </AntTable.Summary.Row>
    </AntTable.Summary>
  );
}
