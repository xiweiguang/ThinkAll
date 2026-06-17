import React, { useState } from 'react';
import { Form, Input, Select, Switch, Row, Col, InputNumber, ColorPicker, Alert, Button, Tooltip, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, QuestionCircleOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import CollapsibleSection from '../../components/Common/CollapsibleSection';
import HeaderGroupEditor from './HeaderGroupEditor';
import { LabelWithTip } from './chartUtils';

/**
 * 图表样式配置子组件
 * 采用三段式面板结构：
 * 1. 表格配置 — 表格整体属性（基础样式、标题、排序、汇总行、ECharts专用配置）
 * 2. 表头配置 — 表头全部配置（文字样式、颜色样式、自动换行、合并表头）
 * 3. 单元格配置 — 单元格全部配置（文字样式、颜色样式、自动换行、固定列、边框、隔行变色、列宽列序、条件格式、单元格合并）
 * 富文本内容 + 富文本样式保持独立，仅在 chartType === 'rich_text' 时显示
 */
const ChartStyleConfig = ({
  chartType,
  visibleFields,
  fields,
  // 样式配置
  chartTitle, setChartTitle,
  showTitle, setShowTitle,
  colorScheme, setColorScheme,
  legendPosition, setLegendPosition,
  showDataLabels, setShowDataLabels,
  chartBgColor, setChartBgColor,
  titleColor, setTitleColor,
  titleAlign, setTitleAlign,
  titleFontSize, setTitleFontSize,
  titleBold, setTitleBold,
  showGridLine, setShowGridLine,
  gridLineColor, setGridLineColor,
  axisLabelColor, setAxisLabelColor,
  axisLabelFontSize, setAxisLabelFontSize,
  legendFontSize, setLegendFontSize,
  // 文字样式
  headerAlign, setHeaderAlign,
  headerFontSize, setHeaderFontSize,
  headerBold, setHeaderBold,
  headerItalic, setHeaderItalic,
  cellAlign, setCellAlign,
  cellFontSize, setCellFontSize,
  // 默认排序
  defaultSortField, setDefaultSortField,
  defaultSortOrder, setDefaultSortOrder,
  // 边框与隔行
  showOuterBorder, setShowOuterBorder,
  showInnerBorder, setShowInnerBorder,
  borderColor, setBorderColor,
  borderStyle, setBorderStyle,
  outerBorderWidth, setOuterBorderWidth,
  innerBorderWidth, setInnerBorderWidth,
  innerBorderColor, setInnerBorderColor,
  innerBorderStyle, setInnerBorderStyle,
  stripeRow, setStripeRow,
  oddRowBgColor, setOddRowBgColor,
  evenRowBgColor, setEvenRowBgColor,
  // 表格高级配置
  fixedLeftColumns, setFixedLeftColumns,
  fixedRightColumns, setFixedRightColumns,
  fixedHeader, setFixedHeader,
  headerAutoWrap, setHeaderAutoWrap,
  cellAutoWrap, setCellAutoWrap,
  // 列宽与列顺序
  columnWidths, setColumnWidths,
  columnOrder, setColumnOrder,
  fieldsState, setFields,
  // 表格配色
  headerFontColor, setHeaderFontColor,
  cellFontColor, setCellFontColor,
  headerBgColor, setHeaderBgColor,
  cellBgColor, setCellBgColor,
  // 条件格式
  conditionalFormats, setConditionalFormats,
  // 合并表头
  headerGroups, setHeaderGroups,
  // 单元格合并
  mergeField, setMergeField,
  mergeBgColor, setMergeBgColor,
  // 汇总行样式
  summaryRowCustomStyle, setSummaryRowCustomStyle,
  summaryFontColor, setSummaryFontColor,
  summaryBgColor, setSummaryBgColor,
  summaryBold, setSummaryBold,
  summaryAlign, setSummaryAlign,
  summaryFontSize, setSummaryFontSize,
  summaryItalic, setSummaryItalic,
  summaryFixed, setSummaryFixed,
  // 富文本配置
  richTextContent, setRichTextContent,
  richTextBgColor, setRichTextBgColor,
  richTextPadding, setRichTextPadding,
  richTextFontSize, setRichTextFontSize,
  richTextAlign, setRichTextAlign,
  richTextFontColor, setRichTextFontColor,
  richTextLineHeight, setRichTextLineHeight,
  richTextBorderRadius, setRichTextBorderRadius,
  // 配色方案选项
  colorSchemes,
  legendPositions,
}) => {
  return (
    <>
      {/* ===== 富文本配置（保持独立，仅 rich_text 类型显示）===== */}
      {chartType === 'rich_text' && (
        <>
          <CollapsibleSection title="富文本内容">
            <Form.Item label="富文本内容">
              <ReactQuill
                value={richTextContent}
                onChange={(val) => setRichTextContent(val)}
                style={{ height: 200, marginBottom: 40 }}
                placeholder="请输入富文本内容..."
              />
            </Form.Item>
          </CollapsibleSection>
          <CollapsibleSection title="富文本样式">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="背景色">
                  <ColorPicker
                    value={richTextBgColor}
                    allowClear
                    format="rgb"
                    onChange={(color) => setRichTextBgColor(color ? color.toRgbString() : undefined)}
                    onChangeComplete={(color) => setRichTextBgColor(color ? color.toRgbString() : undefined)}
                    showText size="small"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="字体颜色">
                  <ColorPicker
                    value={richTextFontColor}
                    allowClear
                    format="rgb"
                    onChange={(color) => setRichTextFontColor(color ? color.toRgbString() : 'rgba(51,51,51,1)')}
                    onChangeComplete={(color) => setRichTextFontColor(color ? color.toRgbString() : 'rgba(51,51,51,1)')}
                    showText size="small"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="文字对齐">
                  <Select
                    value={richTextAlign}
                    onChange={setRichTextAlign}
                    options={[
                      { label: '左对齐', value: 'left' },
                      { label: '居中', value: 'center' },
                      { label: '右对齐', value: 'right' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item label="内边距">
                  <InputNumber min={0} max={100} value={richTextPadding} onChange={setRichTextPadding} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="字体大小">
                  <InputNumber min={10} max={48} value={richTextFontSize} onChange={setRichTextFontSize} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="行高">
                  <InputNumber min={1} max={4} step={0.1} value={richTextLineHeight} onChange={setRichTextLineHeight} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="边框圆角">
                  <InputNumber min={0} max={50} value={richTextBorderRadius} onChange={setRichTextBorderRadius} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </CollapsibleSection>
        </>
      )}

      {/* ===== 面板一：表格配置 — 表格整体属性 ===== */}
      {chartType !== 'rich_text' && (
        <CollapsibleSection title="表格配置">
          {/* --- 基础配置：配色方案与图表背景色 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>基础配置</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="配色方案">
                <Select
                  value={colorScheme}
                  onChange={setColorScheme}
                  options={colorSchemes}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="图表背景色">
                <ColorPicker
                  value={chartBgColor}
                  allowClear
                  format="rgb"
                  onChange={(color) => setChartBgColor(color ? color.toRgbString() : undefined)}
                  onChangeComplete={(color) => setChartBgColor(color ? color.toRgbString() : undefined)}
                  showText size="small"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 标题配置区域 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>标题配置</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="标题文字">
                <Input
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="请输入图表标题"
                />
              </Form.Item>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, marginRight: 8 }}>显示标题</span>
                <Switch checked={showTitle} onChange={setShowTitle} />
              </div>
            </Col>
            <Col span={12}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="标题颜色">
                    <ColorPicker
                      value={titleColor}
                      allowClear
                      format="rgb"
                      onChange={(color) => setTitleColor(color ? color.toRgbString() : undefined)}
                      onChangeComplete={(color) => setTitleColor(color ? color.toRgbString() : undefined)}
                      showText size="small"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="标题位置">
                    <Select
                      value={titleAlign}
                      onChange={setTitleAlign}
                      options={[
                        { label: '左', value: 'left' },
                        { label: '中', value: 'center' },
                        { label: '右', value: 'right' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label="标题字号">
                    <InputNumber value={titleFontSize} onChange={setTitleFontSize} min={12} max={36} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="标题加粗">
                    <Switch checked={titleBold} onChange={setTitleBold} checkedChildren="是" unCheckedChildren="否" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <span></span>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* --- 排序配置 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>排序配置</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<LabelWithTip label="排序字段" tip="数据默认按此字段排序，仅在图表展示页生效" />}>
                <Select
                  value={defaultSortField}
                  onChange={setDefaultSortField}
                  allowClear
                  placeholder="不排序"
                  options={fields.map((f) => ({
                    label: (f.label || f.name) + (f.visible ? '' : '（隐藏）'),
                    value: f.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="排序方式">
                <Select
                  value={defaultSortOrder}
                  onChange={setDefaultSortOrder}
                  options={[
                    { label: '默认（不排序）', value: 'none' },
                    { label: '升序（从小到大）', value: 'asc' },
                    { label: '降序（从大到小）', value: 'desc' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 表格高级配置：固定表头 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>表格高级设置</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="固定表头">
                <Switch checked={fixedHeader} onChange={setFixedHeader} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 汇总行样式（整个面板迁入）--- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>汇总行样式</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="自定义汇总行样式">
                <Switch checked={summaryRowCustomStyle} onChange={setSummaryRowCustomStyle} />
              </Form.Item>
            </Col>
            {summaryRowCustomStyle && (
              <>
                <Col span={8}>
                  <Form.Item label="字体颜色">
                    <ColorPicker value={summaryFontColor} allowClear format="rgb" onChange={(color) => setSummaryFontColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setSummaryFontColor(color ? color.toRgbString() : undefined)} size="small" showText />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="背景颜色">
                    <ColorPicker value={summaryBgColor} allowClear format="rgb" onChange={(color) => setSummaryBgColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setSummaryBgColor(color ? color.toRgbString() : undefined)} size="small" showText />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="字体大小">
                    <InputNumber min={10} max={30} value={summaryFontSize} onChange={(val) => setSummaryFontSize(val || 14)} style={{ width: '100%' }} addonAfter="px" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="对齐方式">
                    <Select value={summaryAlign} onChange={setSummaryAlign} style={{ width: '100%' }}>
                      <Select.Option value="left">左对齐</Select.Option>
                      <Select.Option value="center">居中</Select.Option>
                      <Select.Option value="right">右对齐</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="加粗">
                    <Switch checked={summaryBold} onChange={setSummaryBold} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="倾斜">
                    <Switch checked={summaryItalic} onChange={setSummaryItalic} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="固定汇总行">
                    <Switch checked={summaryFixed} onChange={setSummaryFixed} />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          {/* --- ECharts 图表专用配置（非表格、非富文本类型）--- */}
          {chartType !== 'table' && chartType !== 'rich_text' && (
            <>
              <Divider orientation="left" style={{ margin: '16px 0 12px', fontSize: 13, color: '#666' }}>ECharts 图表专用</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="图例位置">
                    <Select
                      value={legendPosition}
                      onChange={setLegendPosition}
                      options={legendPositions}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="显示数据标签">
                    <Switch
                      checked={showDataLabels}
                      onChange={setShowDataLabels}
                      checkedChildren="是"
                      unCheckedChildren="否"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="显示网格线">
                    <Switch
                      checked={showGridLine}
                      onChange={setShowGridLine}
                      checkedChildren="是"
                      unCheckedChildren="否"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="坐标轴标签颜色">
                    <ColorPicker
                      value={axisLabelColor}
                      allowClear
                      format="rgb"
                      onChange={(color) => setAxisLabelColor(color ? color.toRgbString() : undefined)}
                      onChangeComplete={(color) => setAxisLabelColor(color ? color.toRgbString() : undefined)}
                      showText size="small"
                    />
                  </Form.Item>
                </Col>
              </Row>
              {showGridLine && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="网格线颜色">
                      <ColorPicker
                        value={gridLineColor}
                        allowClear
                        format="rgb"
                        onChange={(color) => setGridLineColor(color ? color.toRgbString() : undefined)}
                        onChangeComplete={(color) => setGridLineColor(color ? color.toRgbString() : undefined)}
                        showText size="small"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              )}
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="坐标轴标签字号">
                    <InputNumber value={axisLabelFontSize} onChange={setAxisLabelFontSize} min={10} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="图例字号">
                    <InputNumber value={legendFontSize} onChange={setLegendFontSize} min={10} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </CollapsibleSection>
      )}

      {/* ===== 面板二：表头配置 — 表头全部配置 ===== */}
      {chartType !== 'rich_text' && (
        <CollapsibleSection title="表头配置">
          {/* --- 表头文字样式 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>文字样式</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label={<LabelWithTip label="表头对齐" tip="表格表头文字的对齐方式" />}>
                <Select
                  value={headerAlign}
                  onChange={setHeaderAlign}
                  options={[
                    { label: '左对齐', value: 'left' },
                    { label: '居中', value: 'center' },
                    { label: '右对齐', value: 'right' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="表头字号">
                <InputNumber value={headerFontSize} onChange={setHeaderFontSize} min={10} max={28} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="表头加粗">
                <Switch checked={headerBold} onChange={setHeaderBold} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="表头倾斜">
                <Switch checked={headerItalic} onChange={setHeaderItalic} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 表头颜色样式 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>颜色样式</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="表头字体颜色">
                <ColorPicker value={headerFontColor || '#000000'} allowClear format="rgb" onChange={(color) => setHeaderFontColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setHeaderFontColor(color ? color.toRgbString() : undefined)} size="small" showText />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="表头底色">
                <ColorPicker value={headerBgColor || '#fafafa'} allowClear format="rgb" onChange={(color) => setHeaderBgColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setHeaderBgColor(color ? color.toRgbString() : undefined)} size="small" showText />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 表头自动换行（来自原表格高级配置）--- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>自动换行</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="表头自动换行">
                <Switch checked={headerAutoWrap} onChange={setHeaderAutoWrap} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 合并表头（整个面板迁入，仅表格类型显示）--- */}
          {chartType === 'table' && (
            <>
              <Divider orientation="left" style={{ margin: '16px 0 12px', fontSize: 13, color: '#666' }}>合并表头</Divider>
              <Alert message="添加表头分组后，可创建多级嵌套表头。先创建基础分组（选择原始字段），再创建上级分组（选择已创建的分组名）。只能合并相邻的列，请先通过列排序调整列顺序。" type="info" showIcon style={{ marginBottom: 12 }} />
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  setHeaderGroups([...headerGroups, { name: '', fields: [] }]);
                }}
                style={{ marginBottom: 8 }}
              >
                添加表头分组
              </Button>
              <HeaderGroupEditor
                groups={headerGroups}
                onChange={setHeaderGroups}
                visibleFields={visibleFields}
              />
            </>
          )}
        </CollapsibleSection>
      )}

      {/* ===== 面板三：单元格配置 — 单元格全部配置 ===== */}
      {chartType !== 'rich_text' && (
        <CollapsibleSection title="单元格配置">
          {/* --- 单元格文字样式 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>文字样式</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label={<LabelWithTip label="单元格对齐" tip="表格数据单元格文字的对齐方式" />}>
                <Select
                  value={cellAlign}
                  onChange={setCellAlign}
                  options={[
                    { label: '左对齐', value: 'left' },
                    { label: '居中', value: 'center' },
                    { label: '右对齐', value: 'right' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="单元格字号">
                <InputNumber value={cellFontSize} onChange={setCellFontSize} min={10} max={28} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 单元格颜色样式 --- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>颜色样式</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="单元格字体颜色">
                <ColorPicker value={cellFontColor || '#000000'} allowClear format="rgb" onChange={(color) => setCellFontColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setCellFontColor(color ? color.toRgbString() : undefined)} size="small" showText />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="单元格底色">
                <ColorPicker value={cellBgColor || '#ffffff'} allowClear format="rgb" onChange={(color) => setCellBgColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setCellBgColor(color ? color.toRgbString() : undefined)} size="small" showText />
              </Form.Item>
            </Col>
          </Row>

          {/* --- 单元格自动换行与固定列（来自原表格高级配置，仅表格类型显示）--- */}
          {chartType === 'table' && (
            <>
              <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>自动换行与固定列</Divider>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label={<LabelWithTip label="左侧固定列数" tip="横向滚动时左侧固定的列数" />}>
                    <InputNumber value={fixedLeftColumns} onChange={setFixedLeftColumns} min={0} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label={<LabelWithTip label="右侧固定列数" tip="横向滚动时右侧固定的列数" />}>
                    <InputNumber value={fixedRightColumns} onChange={setFixedRightColumns} min={0} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="单元格自动换行">
                    <Switch checked={cellAutoWrap} onChange={setCellAutoWrap} checkedChildren="是" unCheckedChildren="否" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* --- 边框设置（来自原表格样式→边框设置子分区）--- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>边框设置</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="显示外边框">
                <Switch checked={showOuterBorder} onChange={setShowOuterBorder} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="外边框粗细">
                <Select value={outerBorderWidth} onChange={setOuterBorderWidth} size="small" disabled={!showOuterBorder} options={[
                  { label: '细 (1px)', value: '1px' },
                  { label: '中 (2px)', value: '2px' },
                  { label: '粗 (3px)', value: '3px' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="边框颜色">
                <ColorPicker value={borderColor || '#e8e8e8'} allowClear format="rgb" onChange={(color) => setBorderColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setBorderColor(color ? color.toRgbString() : undefined)} size="small" showText />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="边框样式">
                <Select value={borderStyle} onChange={setBorderStyle} size="small" options={[
                  { label: '实线', value: 'solid' },
                  { label: '虚线', value: 'dashed' },
                  { label: '点线', value: 'dotted' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="显示内边框">
                <Switch checked={showInnerBorder} onChange={setShowInnerBorder} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="内边框粗细">
                <Select value={innerBorderWidth} onChange={setInnerBorderWidth} size="small" disabled={!showInnerBorder} options={[
                  { label: '细 (1px)', value: '1px' },
                  { label: '中 (2px)', value: '2px' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              {/* 内边框颜色 */}
              <Form.Item label="内边框颜色">
                <ColorPicker
                  value={innerBorderColor}
                  allowClear
                  format="rgb"
                  onChange={(color) => setInnerBorderColor(color ? color.toRgbString() : undefined)}
                  onChangeComplete={(color) => setInnerBorderColor(color ? color.toRgbString() : undefined)}
                  showText size="small"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              {/* 内边框样式 */}
              <Form.Item label="内边框样式">
                <Select value={innerBorderStyle} onChange={setInnerBorderStyle} style={{ width: '100%' }}>
                  <Select.Option value="solid">实线</Select.Option>
                  <Select.Option value="dashed">虚线</Select.Option>
                  <Select.Option value="dotted">点线</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* --- 隔行变色（来自原表格样式→隔行变色子分区）--- */}
          <Divider orientation="left" style={{ margin: '8px 0 12px', fontSize: 13, color: '#666' }}>隔行变色</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="启用隔行变色">
                <Switch checked={stripeRow} onChange={setStripeRow} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
          {stripeRow && (
            <>
              {cellBgColor && (
                <Alert message="隔行变色优先于单元格底色" type="warning" showIcon style={{ marginBottom: 8 }} />
              )}
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="奇数行底色">
                    <ColorPicker value={oddRowBgColor || '#ffffff'} allowClear format="rgb" onChange={(color) => setOddRowBgColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setOddRowBgColor(color ? color.toRgbString() : undefined)} size="small" showText />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="偶数行底色">
                    <ColorPicker value={evenRowBgColor || '#fafafa'} allowClear format="rgb" onChange={(color) => setEvenRowBgColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setEvenRowBgColor(color ? color.toRgbString() : undefined)} size="small" showText />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* --- 列宽与列顺序（整个面板迁入，仅表格类型显示）--- */}
          {chartType === 'table' && (
            <SortableColumnList
              visibleFields={visibleFields}
              fieldsState={fieldsState}
              setFields={setFields}
              setColumnOrder={setColumnOrder}
              columnWidths={columnWidths}
              setColumnWidths={setColumnWidths}
            />
          )}

          {/* --- 条件格式（整个面板迁入，仅表格类型显示）--- */}
          {chartType === 'table' && (
            <>
              <Divider orientation="left" style={{ margin: '16px 0 12px', fontSize: 13, color: '#666' }}>条件格式</Divider>
              <div style={{ marginBottom: 12 }}>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setConditionalFormats([...conditionalFormats, {
                      field: undefined,
                      condition: 'gt',
                      value: 0,
                      valueEnd: 0,
                      fontColor: '#ff0000',
                      bgColor: '#fff2f0',
                    }]);
                  }}
                >
                  添加规则
                </Button>
              </div>
              {conditionalFormats.map((fmt, idx) => (
                <Row key={idx} gutter={8} align="middle" style={{ marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  <Col span={4}>
                    <Select
                      value={fmt.field}
                      onChange={(val) => {
                        const newFmts = [...conditionalFormats];
                        newFmts[idx] = { ...newFmts[idx], field: val };
                        setConditionalFormats(newFmts);
                      }}
                      placeholder="字段"
                      size="small"
                      style={{ width: '100%' }}
                      options={visibleFields.map((f) => ({ label: f.label || f.name, value: f.name }))}
                    />
                  </Col>
                  <Col span={3}>
                    <Select
                      value={fmt.condition}
                      onChange={(val) => {
                        const newFmts = [...conditionalFormats];
                        newFmts[idx] = { ...newFmts[idx], condition: val };
                        setConditionalFormats(newFmts);
                      }}
                      size="small"
                      style={{ width: '100%' }}
                      options={[
                        { label: '大于', value: 'gt' },
                        { label: '小于', value: 'lt' },
                        { label: '等于', value: 'eq' },
                        { label: '不等于', value: 'neq' },
                        { label: '范围', value: 'between' },
                      ]}
                    />
                  </Col>
                  <Col span={3}>
                    <InputNumber
                      value={fmt.value}
                      onChange={(val) => {
                        const newFmts = [...conditionalFormats];
                        newFmts[idx] = { ...newFmts[idx], value: val };
                        setConditionalFormats(newFmts);
                      }}
                      size="small"
                      style={{ width: '100%' }}
                      placeholder="值"
                    />
                  </Col>
                  {fmt.condition === 'between' && (
                    <Col span={3}>
                      <InputNumber
                        value={fmt.valueEnd}
                        onChange={(val) => {
                          const newFmts = [...conditionalFormats];
                          newFmts[idx] = { ...newFmts[idx], valueEnd: val };
                          setConditionalFormats(newFmts);
                        }}
                        size="small"
                        style={{ width: '100%' }}
                        placeholder="结束值"
                      />
                    </Col>
                  )}
                  <Col span={4}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>字体色</span>
                      <ColorPicker
                        value={fmt.fontColor || '#ff0000'}
                        allowClear
                        format="rgb"
                        onChange={(color) => {
                          const newFmts = [...conditionalFormats];
                          newFmts[idx] = { ...newFmts[idx], fontColor: color ? color.toRgbString() : undefined };
                          setConditionalFormats(newFmts);
                        }}
                        onChangeComplete={(color) => {
                          const newFmts = [...conditionalFormats];
                          newFmts[idx] = { ...newFmts[idx], fontColor: color ? color.toRgbString() : undefined };
                          setConditionalFormats(newFmts);
                        }}
                        size="small"
                      />
                    </div>
                  </Col>
                  <Col span={4}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>背景色</span>
                      <ColorPicker
                        value={fmt.bgColor || '#fff2f0'}
                        allowClear
                        format="rgb"
                        onChange={(color) => {
                          const newFmts = [...conditionalFormats];
                          newFmts[idx] = { ...newFmts[idx], bgColor: color ? color.toRgbString() : undefined };
                          setConditionalFormats(newFmts);
                        }}
                        onChangeComplete={(color) => {
                          const newFmts = [...conditionalFormats];
                          newFmts[idx] = { ...newFmts[idx], bgColor: color ? color.toRgbString() : undefined };
                          setConditionalFormats(newFmts);
                        }}
                        size="small"
                      />
                    </div>
                  </Col>
                  <Col span={1}>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        setConditionalFormats(conditionalFormats.filter((_, i) => i !== idx));
                      }}
                    />
                  </Col>
                </Row>
              ))}
            </>
          )}

          {/* --- 单元格合并（整个面板迁入，仅表格类型显示）--- */}
          {chartType === 'table' && (
            <>
              <Divider orientation="left" style={{ margin: '16px 0 12px', fontSize: 13, color: '#666' }}>单元格合并</Divider>
              <Alert message="选择需要合并的字段，该字段中连续相同值的单元格将自动合并显示。合并后可设置自定义底色，该列自动取消奇偶行底色" type="info" showIcon style={{ marginBottom: 12 }} />
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="合并字段">
                    <Select
                      value={mergeField}
                      onChange={setMergeField}
                      placeholder="选择要合并的字段"
                      allowClear
                      size="small"
                      style={{ width: '100%' }}
                      options={visibleFields.map((f) => ({ label: f.label || f.name, value: f.name }))}
                    />
                  </Form.Item>
                </Col>
                {mergeField && (
                  <Col span={8}>
                    <Form.Item label="合并底色">
                      <ColorPicker value={mergeBgColor || '#e6f7ff'} allowClear format="rgb" onChange={(color) => setMergeBgColor(color ? color.toRgbString() : undefined)} onChangeComplete={(color) => setMergeBgColor(color ? color.toRgbString() : undefined)} size="small" showText />
                    </Form.Item>
                  </Col>
                )}
              </Row>
            </>
          )}
        </CollapsibleSection>
      )}
    </>
  );
};

export default ChartStyleConfig;

/**
 * 可拖拽排序的列项组件
 */
const SortableColumnItem = ({ field, idx, total, fieldsState, setFields, setColumnOrder, columnWidths, setColumnWidths }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: 4,
    padding: '4px 8px',
    background: isDragging ? '#e6f4ff' : (idx % 2 === 0 ? '#fafafa' : '#fff'),
    borderRadius: 4,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  // 上下移动辅助函数
  const moveField = (fromName, toName) => {
    const newFields = [...fieldsState];
    const curIdx = newFields.findIndex(nf => nf.name === fromName);
    const targetIdx = newFields.findIndex(nf => nf.name === toName);
    [newFields[curIdx], newFields[targetIdx]] = [newFields[targetIdx], newFields[curIdx]];
    setFields(newFields);
    setColumnOrder(newFields.filter(nf => nf.visible).map(nf => nf.name));
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Row gutter={8} align="middle">
        <Col span={1} style={{ cursor: 'grab', textAlign: 'center' }} {...attributes} {...listeners}>
          <HolderOutlined style={{ color: '#999', fontSize: 14 }} />
        </Col>
        <Col span={1}>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={idx === 0}
            onClick={() => {
              const prevField = fieldsState.filter(f => f.visible)[idx - 1];
              if (prevField) moveField(field.name, prevField.name);
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={idx === total - 1}
            onClick={() => {
              const nextField = fieldsState.filter(f => f.visible)[idx + 1];
              if (nextField) moveField(field.name, nextField.name);
            }}
          />
        </Col>
        <Col span={5}>
          <span style={{ fontSize: 13 }}>{field.label || field.name}</span>
        </Col>
        <Col span={6}>
          <InputNumber
            value={columnWidths[field.name] || undefined}
            onChange={(val) => setColumnWidths(prev => ({ ...prev, [field.name]: val || undefined }))}
            min={50}
            max={800}
            placeholder="自动"
            style={{ width: '100%' }}
            size="small"
          />
        </Col>
      </Row>
    </div>
  );
};

/**
 * 可拖拽排序的列宽与列顺序列表组件
 */
const SortableColumnList = ({ visibleFields, fieldsState, setFields, setColumnOrder, columnWidths, setColumnWidths }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // 获取当前可见字段的顺序
    const visibleNames = visibleFields.map(f => f.name);
    const oldIndex = visibleNames.indexOf(active.id);
    const newIndex = visibleNames.indexOf(over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // 计算新的可见字段顺序
    const newVisibleNames = arrayMove(visibleNames, oldIndex, newIndex);

    // 根据 newVisibleNames 重排 fieldsState
    const newFields = [...fieldsState];
    // 构建新的排序：不可见字段保持原位，可见字段按新顺序排列
    const invisibleFields = newFields.filter(f => !f.visible);
    const visibleFieldMap = {};
    newFields.forEach(f => { visibleFieldMap[f.name] = f; });
    const reorderedVisible = newVisibleNames.map(name => visibleFieldMap[name]).filter(Boolean);
    // 合并：先放不可见字段（保持原序），再放可见字段（新顺序）
    // 但实际上 fieldsState 中可见和不可见是混合的，需要保持不可见字段的相对位置
    // 更好的方式：直接在 fieldsState 中按新顺序重排可见字段
    const finalFields = [];
    let visIdx = 0;
    for (const f of newFields) {
      if (f.visible) {
        finalFields.push(reorderedVisible[visIdx]);
        visIdx++;
      } else {
        finalFields.push(f);
      }
    }

    setFields(finalFields);
    setColumnOrder(reorderedVisible.map(f => f.name));
  };

  return (
    <>
      <Divider orientation="left" style={{ margin: '16px 0 12px', fontSize: 13, color: '#666' }}>列宽与列顺序</Divider>
      <Alert message="设置每列的宽度（像素值），留空表示自动分配。可拖拽左侧手柄或点击上下箭头调整列顺序。" type="info" showIcon style={{ marginBottom: 12 }} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleFields.map(f => f.name)} strategy={verticalListSortingStrategy}>
          {visibleFields.map((f, idx) => (
            <SortableColumnItem
              key={f.name}
              field={f}
              idx={idx}
              total={visibleFields.length}
              fieldsState={fieldsState}
              setFields={setFields}
              setColumnOrder={setColumnOrder}
              columnWidths={columnWidths}
              setColumnWidths={setColumnWidths}
            />
          ))}
        </SortableContext>
      </DndContext>
    </>
  );
};
