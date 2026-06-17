import React from 'react';
import { Form, Select, Switch, Row, Col, Input, Alert, Collapse, Space } from 'antd';
import dayjs from 'dayjs';
import DatePicker from 'antd/es/date-picker';
import CollapsibleSection from '../../components/Common/CollapsibleSection';
import { LabelWithTip } from './chartUtils';

/**
 * 数据下钻与超链接配置子组件
 * 包含数据下钻、字段超链接、日期联动三个折叠面板
 */
const ChartDrilldownConfig = ({
  // 下钻配置
  drilldownEnabled,
  drilldownTargetChartId,
  drilldownFields,
  drilldownFieldMappings,
  charts,
  visibleFields,
  onDrilldownEnabledChange,
  onDrilldownTargetChartIdChange,
  onDrilldownFieldsChange,
  onDrilldownFieldMappingsChange,
  // 字段超链接配置
  fieldLinks,
  onFieldLinksChange,
  // 日期联动配置
  dateLinkageEnabled,
  dateLinkageField,
  dateLinkageRange,
  dateLinkageStartDate,
  dateLinkageEndDate,
  fields,
  onDateLinkageEnabledChange,
  onDateLinkageFieldChange,
  onDateLinkageRangeChange,
  onDateLinkageStartDateChange,
  onDateLinkageEndDateChange,
}) => {
  return (
    <>
      {/* 数据下钻 */}
      <CollapsibleSection title="数据下钻">
        <div style={{ marginBottom: 12 }}>
          <Alert message="启用数据下钻后，点击图表数据点或表格单元格可跳转到目标图表查看明细数据" type="info" showIcon style={{ marginBottom: 12 }} />
          <Row gutter={16} align="middle">
            <Col span={6}>
              <Form.Item label="数据下钻">
                <Switch
                  checked={drilldownEnabled}
                  onChange={onDrilldownEnabledChange}
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                />
              </Form.Item>
            </Col>
            {drilldownEnabled && (
              <>
                <Col span={6}>
                  <Form.Item label="目标图表">
                    <Select
                      value={drilldownTargetChartId}
                      onChange={onDrilldownTargetChartIdChange}
                      placeholder="选择目标图表"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={charts.map(c => ({
                        label: `${c.name} (${c.chart_id})`,
                        value: c.chart_id,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<LabelWithTip label="可下钻字段" tip="选择点击后可触发下钻的字段，支持多选" />}>
                    <Select
                      mode="multiple"
                      value={drilldownFields}
                      onChange={(selectedFields) => {
                        onDrilldownFieldsChange(selectedFields);
                        // 清理已移除字段的映射
                        const newMappings = {};
                        selectedFields.forEach(f => {
                          if (drilldownFieldMappings[f] !== undefined) {
                            newMappings[f] = drilldownFieldMappings[f];
                          }
                        });
                        onDrilldownFieldMappingsChange(newMappings);
                      }}
                      placeholder="选择可下钻字段"
                      options={visibleFields.map((f) => ({
                        label: f.label || f.name,
                        value: f.name,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
          {drilldownEnabled && drilldownFields.length > 0 && (
            <Collapse
              ghost
              size="small"
              items={[{
                key: 'mappings',
                label: '高级配置（字段映射）',
                children: (
                  <div style={{ paddingLeft: 8 }}>
                    <div style={{ marginBottom: 8, color: '#888', fontSize: 12 }}>
                      当源字段与目标图表的筛选字段名不同时，可在此配置映射。目标字段名为空时默认与源字段同名。
                    </div>
                    {drilldownFields.map(field => (
                      <Row key={field} gutter={8} align="middle" style={{ marginBottom: 6 }}>
                        <Col span={8} style={{ textAlign: 'right', lineHeight: '32px' }}>
                          <span style={{ color: '#1890ff' }}>{field}</span>
                        </Col>
                        <Col span={2} style={{ textAlign: 'center', lineHeight: '32px' }}>→</Col>
                        <Col span={14}>
                          <Input
                            placeholder={field}
                            value={drilldownFieldMappings[field] || ''}
                            onChange={(e) => {
                              const newMappings = { ...drilldownFieldMappings };
                              if (e.target.value) {
                                newMappings[field] = e.target.value;
                              } else {
                                delete newMappings[field];
                              }
                              onDrilldownFieldMappingsChange(newMappings);
                            }}
                          />
                        </Col>
                      </Row>
                    ))}
                  </div>
                ),
              }]}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* 字段超链接 */}
      <CollapsibleSection title="字段超链接">
        <div style={{ marginBottom: 12 }}>
          <Alert message="为字段配置超链接后，点击该字段的数据内容可跳转到其他图表" type="info" showIcon style={{ marginBottom: 12 }} />
          {visibleFields.map((f) => {
            const linkConfig = fieldLinks[f.name] || {};
            const enabled = !!fieldLinks[f.name];
            return (
              <Row key={f.name} gutter={8} align="middle" style={{ marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                <Col span={4}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{f.label || f.name}</span>
                </Col>
                <Col span={3}>
                  <Switch
                    checked={enabled}
                    onChange={(val) => {
                      onFieldLinksChange(prev => {
                        const updated = { ...prev };
                        if (val) {
                          updated[f.name] = { targetChartId: '', passFilterValue: false };
                        } else {
                          delete updated[f.name];
                        }
                        return updated;
                      });
                    }}
                    checkedChildren="开启"
                    unCheckedChildren="关闭"
                    size="small"
                  />
                </Col>
                {enabled && (
                  <>
                    <Col span={10}>
                      <Select
                        value={linkConfig.targetChartId || undefined}
                        onChange={(val) => {
                          onFieldLinksChange(prev => ({
                            ...prev,
                            [f.name]: { ...prev[f.name], targetChartId: val },
                          }));
                        }}
                        placeholder="选择目标图表"
                        size="small"
                        style={{ width: '100%' }}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={charts.map(c => ({
                          label: `${c.name} (${c.chart_id})`,
                          value: c.chart_id,
                        }))}
                      />
                    </Col>
                    <Col span={7}>
                      <Space size={4} align="center">
                        <Switch
                          checked={!!linkConfig.passFilterValue}
                          onChange={(val) => {
                            onFieldLinksChange(prev => ({
                              ...prev,
                              [f.name]: { ...prev[f.name], passFilterValue: val },
                            }));
                          }}
                          size="small"
                          checkedChildren="传递筛选值"
                          unCheckedChildren="不传递"
                        />
                      </Space>
                    </Col>
                  </>
                )}
              </Row>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* 日期联动 */}
      <CollapsibleSection title="日期联动">
        <div style={{ marginBottom: 12 }}>
          <Alert message="开启日期联动后，图表展示时将自动按选定日期字段和时间范围筛选数据" type="info" showIcon style={{ marginBottom: 12 }} />
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="日期联动">
                <Switch checked={dateLinkageEnabled} onChange={onDateLinkageEnabledChange} />
              </Form.Item>
            </Col>
            {dateLinkageEnabled && (
              <>
                <Col span={8}>
                  <Form.Item label="日期字段">
                    <Select value={dateLinkageField} onChange={onDateLinkageFieldChange} style={{ width: '100%' }} placeholder="选择日期字段" allowClear>
                      {fields.filter(f => f.visible && (f.type === 'date' || f.type === 'dimension' || /日期|时间|date|time/i.test(f.name))).map(f => (
                        <Select.Option key={f.name} value={f.name}>{f.label || f.name}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="时间范围">
                    <Select value={dateLinkageRange} onChange={onDateLinkageRangeChange} style={{ width: '100%' }}>
                      <Select.Option value="today">当日</Select.Option>
                      <Select.Option value="yesterday">前1天</Select.Option>
                      <Select.Option value="dayBeforeYesterday">前2天</Select.Option>
                      <Select.Option value="week">本周</Select.Option>
                      <Select.Option value="month">本月</Select.Option>
                      <Select.Option value="custom">自定义</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                {dateLinkageRange === 'custom' && (
                  <>
                    <Col span={8}>
                      <Form.Item label="开始日期">
                        <DatePicker value={dateLinkageStartDate ? dayjs(dateLinkageStartDate) : null} onChange={(date) => onDateLinkageStartDateChange(date ? date.format('YYYY-MM-DD') : undefined)} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="结束日期">
                        <DatePicker value={dateLinkageEndDate ? dayjs(dateLinkageEndDate) : null} onChange={(date) => onDateLinkageEndDateChange(date ? date.format('YYYY-MM-DD') : undefined)} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </>
                )}
              </>
            )}
          </Row>
        </div>
      </CollapsibleSection>
    </>
  );
};

export default ChartDrilldownConfig;
