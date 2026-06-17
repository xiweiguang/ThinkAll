import React from 'react';
import { Form, Input, Select, Switch, Row, Col, InputNumber, TreeSelect } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import CollapsibleSection from '../../components/Common/CollapsibleSection';
import { LabelWithTip } from './chartUtils';

/**
 * 图表基础配置子组件
 * 包含图表标识、名称、分类、描述、数据权限等基础信息表单
 */
const ChartBasicConfig = ({
  // 基本信息
  chartId, setChartId,
  chartName, setChartName,
  chartDescription, setChartDescription,
  categoryId, setCategoryId,
  categories,
  sortOrder, setSortOrder,
  editingChart,
  // 描述配置
  showDescription, setShowDescription,
  descPosition, setDescPosition,
  descAlign, setDescAlign,
  descFontSize, setDescFontSize,
  descFontFamily, setDescFontFamily,
  descFontColor, setDescFontColor,
  descBold, setDescBold,
  descItalic, setDescItalic,
  descBgColor, setDescBgColor,
  descBorderColor, setDescBorderColor,
  descLineHeight, setDescLineHeight,
  // 数据权限
  dataPermission, setDataPermission,
  matchField, setMatchField,
  departmentField, setDepartmentField,
  // 字段列表
  visibleFields,
  // 工具函数
  buildTreeSelectData,
}) => {
  return (
    <Form layout="vertical">
      <Row gutter={16}>
        <Col span={6}>
          <Form.Item label={<LabelWithTip label="图表标识" tip="图表的唯一英文标识符，用于系统内部引用，创建后不可修改" />} required>
            <Input
              value={chartId}
              onChange={(e) => setChartId(e.target.value)}
              placeholder="唯一标识，如：sales_report"
              disabled={!!editingChart}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="图表名称" required>
            <Input
              value={chartName}
              onChange={(e) => setChartName(e.target.value)}
              placeholder="请输入图表名称"
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label={<LabelWithTip label="所属目录" tip="选择图表所属的分类目录，便于在首页和侧边栏中按分类展示" />}>
            <TreeSelect
              value={categoryId}
              onChange={setCategoryId}
              placeholder="选择所属目录（可选）"
              allowClear
              treeDefaultExpandAll
              treeData={categories.map(cat => buildTreeSelectData(cat))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item label="排序号">
            <InputNumber
              value={sortOrder}
              onChange={setSortOrder}
              min={0}
              style={{ width: '100%' }}
              placeholder="排序号"
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={24}>
          <div className="chart-desc-section-title"><FileTextOutlined /> 图表描述与备注</div>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="显示描述">
            <Switch
              checked={showDescription}
              onChange={setShowDescription}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </Form.Item>
        </Col>
        {showDescription && (
          <>
            <Col span={8}>
              <Form.Item label="描述位置">
                <Select
                  value={descPosition}
                  onChange={setDescPosition}
                  style={{ width: '100%' }}
                  options={[
                    { label: '图表上方', value: 'top' },
                    { label: '图表下方', value: 'bottom' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="文字对齐">
                <Select
                  value={descAlign}
                  onChange={setDescAlign}
                  style={{ width: '100%' }}
                  options={[
                    { label: '左对齐', value: 'left' },
                    { label: '居中', value: 'center' },
                    { label: '右对齐', value: 'right' },
                  ]}
                />
              </Form.Item>
            </Col>
          </>
        )}
      </Row>
      {showDescription && (
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label="字号">
              <Select
                value={descFontSize}
                onChange={setDescFontSize}
                style={{ width: '100%' }}
                options={[
                  { label: '12px', value: 12 },
                  { label: '13px', value: 13 },
                  { label: '14px', value: 14 },
                  { label: '16px', value: 16 },
                  { label: '18px', value: 18 },
                  { label: '20px', value: 20 },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="字体">
              <Select
                value={descFontFamily}
                onChange={setDescFontFamily}
                style={{ width: '100%' }}
                options={[
                  { label: '默认', value: '' },
                  { label: '宋体', value: 'SimSun, serif' },
                  { label: '黑体', value: 'SimHei, sans-serif' },
                  { label: '楷体', value: 'KaiTi, serif' },
                  { label: '微软雅黑', value: 'Microsoft YaHei, sans-serif' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="字体颜色">
              <Input
                type="color"
                value={descFontColor}
                onChange={(e) => setDescFontColor(e.target.value)}
                style={{ width: '100%', height: 32, padding: 2, cursor: 'pointer' }}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="行高">
              <Select
                value={descLineHeight}
                onChange={setDescLineHeight}
                style={{ width: '100%' }}
                options={[
                  { label: '紧凑(1.4)', value: 1.4 },
                  { label: '默认(1.6)', value: 1.6 },
                  { label: '宽松(1.8)', value: 1.8 },
                  { label: '超宽松(2.0)', value: 2.0 },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
      {showDescription && (
        <Row gutter={16}>
          <Col span={4}>
            <Form.Item label="加粗">
              <Switch
                checked={descBold}
                onChange={setDescBold}
                checkedChildren="是"
                unCheckedChildren="否"
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="斜体">
              <Switch
                checked={descItalic}
                onChange={setDescItalic}
                checkedChildren="是"
                unCheckedChildren="否"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="背景色">
              <Input
                type="color"
                value={descBgColor}
                onChange={(e) => setDescBgColor(e.target.value)}
                style={{ width: '100%', height: 32, padding: 2, cursor: 'pointer' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="左边框颜色">
              <Input
                type="color"
                value={descBorderColor}
                onChange={(e) => setDescBorderColor(e.target.value)}
                style={{ width: '100%', height: 32, padding: 2, cursor: 'pointer' }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
      {showDescription && (
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="描述内容">
              <ReactQuill
                value={chartDescription || ''}
                onChange={(val) => setChartDescription(val)}
                placeholder="请输入图表备注、描述或图表介绍信息，方便其他用户了解该图表的用途和数据来源。支持换行输入。"
                style={{ height: 150, marginBottom: 40 }}
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                  ]
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      )}

      <CollapsibleSection title="数据权限配置">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label={<LabelWithTip label="启用数据权限" tip="开启后，图表数据将按用户角色自动过滤：管理员查看全部，部门领导查看本部门，普通用户只看自己" />}>
              <Switch
                checked={dataPermission}
                onChange={setDataPermission}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="姓名匹配字段">
              <Select
                placeholder="选择匹配字段"
                value={matchField}
                onChange={setMatchField}
                allowClear
                disabled={!dataPermission}
                options={visibleFields.map((f) => ({
                  label: f.label || f.name,
                  value: f.name,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="部门匹配字段">
              <Select
                placeholder="选择部门字段"
                value={departmentField}
                onChange={setDepartmentField}
                allowClear
                disabled={!dataPermission}
                options={visibleFields.map((f) => ({
                  label: f.label || f.name,
                  value: f.name,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
      </CollapsibleSection>
    </Form>
  );
};

export default ChartBasicConfig;
