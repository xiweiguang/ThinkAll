import React from 'react';
import { Form, Select, Row, Col } from 'antd';
import { LabelWithTip } from './chartUtils';

/**
 * 图表字段配置子组件
 * 包含X轴字段、Y轴字段、分组字段的配置
 */
const ChartFieldConfig = ({
  chartType,
  xField,
  yFields,
  groupField,
  visibleFields,
  onXFieldChange,
  onYFieldsChange,
  onGroupFieldChange,
}) => {
  return (
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item label={<LabelWithTip label="X轴字段" tip="图表横轴展示的数据，通常选择维度字段（如日期、类别等）" />} required>
          <Select
            placeholder="请选择X轴字段"
            value={xField}
            onChange={onXFieldChange}
            options={visibleFields.map((f) => ({
              label: f.label || f.name,
              value: f.name,
            }))}
          />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label={<LabelWithTip label={chartType === 'pie' || chartType === 'double_pie' ? '数值字段' : 'Y轴字段'} tip={chartType === 'pie' || chartType === 'double_pie' ? '饼图中表示数值大小的字段，通常选择度量字段' : '图表纵轴展示的数据，通常选择度量字段（如金额、数量等），可多选'} />} required>
          <Select
            mode={chartType === 'pie' ? undefined : 'multiple'}
            placeholder={chartType === 'pie' ? '请选择数值字段' : '请选择Y轴字段'}
            value={yFields}
            onChange={onYFieldsChange}
            options={visibleFields
              .filter((f) => f.type === 'measure' || f.isComputed)
              .map((f) => ({
                label: f.label || f.name,
                value: f.name,
              }))}
          />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label={<LabelWithTip label="分组字段" tip="将数据按某个维度进一步细分，相同分组值的数据会聚合在一起展示" />}>
          <Select
            placeholder="请选择分组字段（可选）"
            value={groupField}
            onChange={onGroupFieldChange}
            allowClear
            options={visibleFields
              .filter((f) => f.type === 'dimension' && f.name !== xField)
              .map((f) => ({
                label: f.label || f.name,
                value: f.name,
              }))}
          />
        </Form.Item>
      </Col>
    </Row>
  );
};

export default ChartFieldConfig;
