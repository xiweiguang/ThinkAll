import React, { useRef, useEffect } from 'react';
import { Table, Empty, Dropdown, Button, message } from 'antd';
import { DownloadOutlined, FileImageOutlined, FilePdfOutlined, FileExcelOutlined, InfoCircleOutlined, AimOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { exportAsImage, exportAsPdf, exportAsExcel } from '../../utils/chartExport';
import { sanitizeHtml } from '../../utils/htmlSanitizer';
import { buildTableColumnDefs } from '../../utils/buildTableColumns';
import { getTableColorsFromScheme } from '../../utils/colorSchemes';
import '../../components/Table/DataTable.css';
import '../TablePage.css';

/**
 * 图表预览子组件
 * 包含图表/表格/富文本的预览区域和下载功能
 */
const ChartPreview = ({
  // 预览数据
  chartType,
  previewData,
  previewColumns,
  previewChartRef,
  getEchartsOption,
  // 图表名称（用于下载文件名）
  chartName,
  // 富文本配置
  richTextContent,
  richTextBgColor,
  richTextPadding,
  richTextFontSize,
  richTextFontColor,
  richTextAlign,
  richTextLineHeight,
  richTextBorderRadius,
  // 表格样式配置
  cellAlign,
  cellFontSize,
  cellAutoWrap,
  cellFontColor,
  cellBgColor,
  headerFontSize,
  headerBold,
  headerItalic,
  headerAlign,
  headerAutoWrap,
  headerFontColor,
  headerBgColor,
  columnWidths,
  columnOrder,
  fixedLeftColumns,
  fixedRightColumns,
  headerGroups,
  conditionalFormats,
  defaultSortField,
  defaultSortOrder,
  showInnerBorder,
  stripeRow,
  showOuterBorder,
  outerBorderWidth,
  borderStyle,
  borderColor,
  innerBorderColor,
  innerBorderStyle,
  innerBorderWidth,
  // 单元格合并与隔行变色
  mergeField,
  mergeBgColor,
  oddRowBgColor,
  evenRowBgColor,
  // 固定表头与配色方案
  fixedHeader,
  colorScheme,
  // 分析说明模板
  analysisTemplate,
  // 分析说明配置（新格式）
  analysisConfig,
  // 下钻字段列表
  drilldownFields,
}) => {
  const tableRef = useRef(null);

  // 合并单元格跨行hover：当鼠标悬停在某行时，跨越该行的合并单元格也变色
  useEffect(() => {
    if (!mergeField) return;
    const tableEl = tableRef.current;
    if (!tableEl) return;

    const handleMouseOver = (e) => {
      const tr = e.target.closest('tr.ant-table-row');
      if (!tr) return;
      tableEl.querySelectorAll('.merge-cell-hover').forEach(el => {
        el.classList.remove('merge-cell-hover');
      });
      const allRows = tableEl.querySelectorAll('tr.ant-table-row');
      const currentRowIndex = Array.from(allRows).indexOf(tr);
      allRows.forEach((row, idx) => {
        if (idx >= currentRowIndex) return;
        const mergeTds = row.querySelectorAll('td[rowspan]');
        mergeTds.forEach(td => {
          const rowSpan = parseInt(td.getAttribute('rowspan') || '1');
          if (idx + rowSpan > currentRowIndex) {
            td.classList.add('merge-cell-hover');
          }
        });
      });
    };

    const handleMouseOut = (e) => {
      if (!e.target.closest('tr.ant-table-row')) {
        tableEl.querySelectorAll('.merge-cell-hover').forEach(el => {
          el.classList.remove('merge-cell-hover');
        });
      }
    };

    tableEl.addEventListener('mouseover', handleMouseOver);
    tableEl.addEventListener('mouseout', handleMouseOut);

    return () => {
      tableEl.removeEventListener('mouseover', handleMouseOver);
      tableEl.removeEventListener('mouseout', handleMouseOut);
    };
  }, [mergeField]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>图表预览</span>
        <Dropdown
          menu={{
            items: [
              {
                key: 'image',
                label: '保存为图片',
                icon: <FileImageOutlined />,
                onClick: async () => {
                  if (!previewChartRef.current) return;
                  const ok = await exportAsImage(previewChartRef.current, chartName || '图表预览');
                  if (ok) message.success('图片已保存');
                  else message.error('保存图片失败');
                },
              },
              {
                key: 'pdf',
                label: '保存为PDF',
                icon: <FilePdfOutlined />,
                onClick: async () => {
                  if (!previewChartRef.current) return;
                  const ok = await exportAsPdf(previewChartRef.current, chartName || '图表预览');
                  if (ok) message.success('PDF已保存');
                  else message.error('保存PDF失败');
                },
              },
              {
                key: 'excel',
                label: '导出Excel',
                icon: <FileExcelOutlined />,
                onClick: async () => {
                  if (!previewData.length) {
                    message.warning('暂无数据可导出');
                    return;
                  }
                  const cols = previewColumns.map((c) => ({ title: c.title, dataIndex: c.dataIndex }));
                  const ok = await exportAsExcel(previewData, cols, chartName || '图表预览');
                  if (ok) message.success('Excel已导出');
                  else message.error('导出Excel失败');
                },
              },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<DownloadOutlined />}>下载</Button>
        </Dropdown>
      </div>

      <div ref={(el) => { previewChartRef.current = el; tableRef.current = el; }} className={`chart-preview-area data-table-wrapper${mergeField ? ' has-merge' : ''}`} data-has-merge={mergeField ? "true" : undefined} style={{
        ...(showOuterBorder ? { border: `${outerBorderWidth} ${borderStyle} ${borderColor}`, borderRadius: '8px' } : {}),
        '--merge-bg-color': mergeBgColor || 'transparent',
      }}>
        {chartType === 'rich_text' ? (
          <div
            style={{
              padding: richTextPadding,
              backgroundColor: richTextBgColor || 'transparent',
              fontSize: richTextFontSize,
              color: richTextFontColor,
              textAlign: richTextAlign,
              lineHeight: richTextLineHeight,
              borderRadius: richTextBorderRadius,
              minHeight: 200,
              overflow: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(richTextContent || '<p style="color:#999">暂无内容，请在上方编辑富文本内容</p>') }}
          />
        ) : chartType === 'table' && previewData.length > 0 ? (
          (() => {
            // 根据配色方案解析颜色
            const schemeColors = colorScheme ? getTableColorsFromScheme(colorScheme) : null;
            // 合并 styleConfig，配色方案颜色作为后备
            const effectiveStyleConfig = {
              cellAlign, cellFontSize, cellAutoWrap, cellFontColor, cellBgColor,
              headerFontSize, headerBold, headerItalic, headerAlign, headerAutoWrap,
              columnWidths, columnOrder,
              fixedLeftColumns, fixedRightColumns,
              headerGroups, conditionalFormats,
              stripeRow,
              mergeField,
              mergeBgColor,
              oddRowBgColor,
              innerBorderColor,
              innerBorderStyle,
              innerBorderWidth,
              // 配色方案颜色作为后备值：用户显式设置优先，否则使用配色方案颜色
              headerBgColor: headerBgColor || (schemeColors ? schemeColors.headerBg : undefined),
              headerFontColor: headerFontColor || (schemeColors ? schemeColors.headerColor : undefined),
              evenRowBgColor: evenRowBgColor || (schemeColors ? schemeColors.evenRowBg : undefined),
            };
            return (
              <Table
                columns={(() => {
                  const styledCols = buildTableColumnDefs(previewColumns, effectiveStyleConfig, previewData.slice(0, 50), { isPreview: true, drilldownFields });
                  // 递归处理列，为下钻字段添加标靶图标
                  const processColumn = (col) => {
                    // 如果有 children，递归处理子列
                    if (col.children && col.children.length > 0) {
                      return { ...col, children: col.children.map(processColumn) };
                    }
                    // 叶子列：为下钻字段添加 AimOutlined 图标
                    if (col.isDrilldownField) {
                      const originalRender = col.render;
                      const newRender = originalRender
                        ? (val, record, index) => {
                            const result = originalRender(val, record, index);
                            if (result && typeof result === 'object' && result.props) {
                              // 合并单元格场景：保留 rowSpan，children 中添加标靶图标
                              const finalContent = (
                                <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                                  {result.children}
                                  <AimOutlined style={{ color: '#1890ff', fontSize: 12, marginLeft: 4 }} />
                                </span>
                              );
                              return { children: finalContent, props: result.props };
                            }
                            // 非合并单元格
                            return (
                              <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                                {result}
                                <AimOutlined style={{ color: '#1890ff', fontSize: 12, marginLeft: 4 }} />
                              </span>
                            );
                          }
                        : (val) => (
                            <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                              {val !== null && val !== undefined ? val : '-'}
                              <AimOutlined style={{ color: '#1890ff', fontSize: 12, marginLeft: 4 }} />
                            </span>
                          );
                      return { ...col, render: newRender };
                    }
                    return col;
                  };
                  return styledCols.map(processColumn);
                })()}
                dataSource={(() => {
                  let data = previewData.slice(0, 50);
                  // 同时配置了合并字段和排序字段：分组排序
                  if (mergeField && defaultSortField && defaultSortOrder !== 'none') {
                    data = [...data].sort((a, b) => {
                      // 先按合并字段排序
                      const mergeCompare = String(a[mergeField] || '').localeCompare(String(b[mergeField] || ''), 'zh-CN');
                      if (mergeCompare !== 0) return mergeCompare;
                      // 组内按排序字段排序
                      const aVal = a[defaultSortField];
                      const bVal = b[defaultSortField];
                      if (aVal === bVal) return 0;
                      const numA = Number(aVal);
                      const numB = Number(bVal);
                      let compare = 0;
                      if (!isNaN(numA) && !isNaN(numB)) {
                        compare = numA - numB;
                      } else {
                        compare = String(aVal || '').localeCompare(String(bVal || ''), 'zh-CN');
                      }
                      return defaultSortOrder === 'desc' ? -compare : compare;
                    });
                  } else if (mergeField) {
                    // 只有合并字段：按合并字段排序
                    data = [...data].sort((a, b) => {
                      return String(a[mergeField] || '').localeCompare(String(b[mergeField] || ''), 'zh-CN');
                    });
                  } else if (defaultSortField && defaultSortOrder !== 'none') {
                    // 只有排序字段：按排序字段排序
                    data = [...data].sort((a, b) => {
                      const aVal = a[defaultSortField];
                      const bVal = b[defaultSortField];
                      if (aVal === bVal) return 0;
                      const numA = Number(aVal);
                      const numB = Number(bVal);
                      let compare = 0;
                      if (!isNaN(numA) && !isNaN(numB)) {
                        compare = numA - numB;
                      } else {
                        compare = String(aVal || '').localeCompare(String(bVal || ''), 'zh-CN');
                      }
                      return defaultSortOrder === 'desc' ? -compare : compare;
                    });
                  }
                  return data;
                })()}
                rowKey={(record) => record.id || JSON.stringify(record)}
                size="small"
                scroll={{ x: 'max-content', y: fixedHeader ? 500 : undefined }}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                bordered={showInnerBorder}
              />
            );
          })()
        ) : previewData.length > 0 ? (
          <ReactECharts
            option={getEchartsOption()}
            style={{ height: 400, width: '100%' }}
            notMerge={true}
          />
        ) : (
          <Empty description="请先完成前几步配置以预览图表" />
        )}
      </div>

      {/* 总结预览区域 */}
      {(analysisTemplate || analysisConfig) && (() => {
        // 优先使用新格式 analysisConfig 的模板，否则使用旧格式 analysisTemplate
        let previewHtml = '';
        if (analysisConfig) {
          try {
            const parsed = typeof analysisConfig === 'string' ? JSON.parse(analysisConfig) : analysisConfig;
            previewHtml = parsed.template || '';
          } catch {
            previewHtml = analysisTemplate || '';
          }
        } else {
          previewHtml = analysisTemplate || '';
        }
        if (!previewHtml) return null;
        return (
          <div className="chart-desc-box" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <InfoCircleOutlined className="chart-desc-box-icon" />
            </div>
            <div className="chart-desc-box-content">
              <div className="chart-desc-box-text chart-desc-box-text-expanded">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }} />
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default ChartPreview;
