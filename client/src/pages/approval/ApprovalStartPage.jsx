import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Form, Input, InputNumber, Select, Button, message, Upload, DatePicker,
  Radio, Checkbox, Alert, Typography, Row, Col, Empty, Spin, Tag,
} from 'antd';
import {
  SendOutlined, ArrowLeftOutlined, PaperClipOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as approvalService from '../../services/approvalService';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 字段类型标签映射
const fieldTypeLabelMap = {
  input: '单行文本',
  textarea: '多行文本',
  number: '数字',
  radio: '单选',
  checkbox: '多选',
  date: '日期',
  daterange: '日期范围',
  money: '金额',
  file: '附件',
  description: '说明文字',
};

export default function ApprovalStartPage() {
  const navigate = useNavigate();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [formConfig, setFormConfig] = useState([]);
  const [form] = Form.useForm();

  // 获取已启用的流程列表
  const fetchFlows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await approvalService.getEnabledFlows();
      const data = res.data || res;
      const list = Array.isArray(data) ? data : (data.list || data.records || []);
      setFlows(list);
    } catch (err) {
      // 错误信息已由 axios 拦截器统一提示
      setFlows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // 选择流程
  const handleSelectFlow = (flow) => {
    setSelectedFlow(flow);
    // 解析 form_config
    let config = flow.form_config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = [];
      }
    }
    setFormConfig(Array.isArray(config) ? config : []);
    form.resetFields();
  };

  // 取消选择
  const handleCancelSelect = () => {
    setSelectedFlow(null);
    setFormConfig([]);
    form.resetFields();
  };

  // 提交审批
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // 处理日期类型字段，转换为字符串
      const formData = { ...values };
      for (const field of formConfig) {
        if (formData[field.fieldKey] !== undefined && formData[field.fieldKey] !== null) {
          if (field.type === 'date' && dayjs.isDayjs(formData[field.fieldKey])) {
            formData[field.fieldKey] = formData[field.fieldKey].format('YYYY-MM-DD');
          } else if (field.type === 'daterange' && Array.isArray(formData[field.fieldKey])) {
            formData[field.fieldKey] = formData[field.fieldKey].map(d => dayjs.isDayjs(d) ? d.format('YYYY-MM-DD') : d);
          } else if (field.type === 'file') {
            // 附件处理：提取文件名和URL
            const fileList = formData[field.fieldKey];
            if (Array.isArray(fileList)) {
              formData[field.fieldKey] = fileList.map(f => ({
                name: f.name,
                url: f.response?.url || f.url || '',
                uid: f.uid,
              }));
            }
          }
        }
      }
      await approvalService.createInstance({
        flowId: selectedFlow.id,
        form_data: formData,
      });
      message.success('审批提交成功');
      navigate('/approval/todo');
    } catch (err) {
      if (err.errorFields) return;
      // 错误信息已由 axios 拦截器统一提示
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染单个表单字段
  const renderFormField = (field) => {
    const rules = [];
    if (field.required && field.type !== 'description') {
      rules.push({ required: true, message: `请输入${field.label}` });
    }

    switch (field.type) {
      case 'input':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <Input placeholder={field.placeholder || `请输入${field.label}`} maxLength={200} />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <TextArea rows={4} placeholder={field.placeholder || `请输入${field.label}`} maxLength={1000} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <InputNumber placeholder={field.placeholder || `请输入${field.label}`} style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'radio':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <Radio.Group>
              {(field.options || []).map((opt, idx) => (
                <Radio key={idx} value={opt}>{opt}</Radio>
              ))}
            </Radio.Group>
          </Form.Item>
        );
      case 'checkbox':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <Checkbox.Group>
              {(field.options || []).map((opt, idx) => (
                <Checkbox key={idx} value={opt} style={{ marginRight: 8 }}>{opt}</Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
        );
      case 'date':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <DatePicker style={{ width: '100%' }} placeholder={field.placeholder || '请选择日期'} />
          </Form.Item>
        );
      case 'daterange':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'money':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <InputNumber
              prefix="¥"
              placeholder={field.placeholder || `请输入${field.label}`}
              style={{ width: '100%' }}
              min={0}
              precision={2}
            />
          </Form.Item>
        );
      case 'file':
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules} valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList}>
            <Upload
              action="/api/upload"
              multiple
              headers={{
                Authorization: `Bearer ${localStorage.getItem('data_vis_token') || localStorage.getItem('token') || ''}`,
              }}
            >
              <Button icon={<PaperClipOutlined />}>点击上传</Button>
            </Upload>
          </Form.Item>
        );
      case 'description':
        return (
          <Form.Item key={field.fieldKey} label={field.label}>
            <Alert type="info" message={field.placeholder || field.label} showIcon />
          </Form.Item>
        );
      default:
        return (
          <Form.Item key={field.fieldKey} name={field.fieldKey} label={field.label} rules={rules}>
            <Input placeholder={field.placeholder || `请输入${field.label}`} />
          </Form.Item>
        );
    }
  };

  return (
    <div className="approval-start-page" style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>发起审批</Title>
        <span style={{ color: '#888' }}>选择审批流程并填写表单</span>
      </div>

      <Spin spinning={loading}>
        {!selectedFlow ? (
          // 流程模板选择区
          <Card title="选择审批流程" variant="borderless">
            {flows.length === 0 ? (
              <Empty description="暂无可用的审批流程" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Row gutter={[16, 16]}>
                {flows.map((flow) => (
                  <Col key={flow.id} xs={24} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      size="small"
                      onClick={() => handleSelectFlow(flow)}
                      style={{ height: '100%' }}
                      bodyStyle={{ padding: 16 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>{flow.icon || '📝'}</span>
                        <Text strong style={{ fontSize: 15 }}>{flow.name}</Text>
                      </div>
                      <div style={{ color: '#888', fontSize: 12, minHeight: 32, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {flow.description || '暂无描述'}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        ) : (
          // 表单填写区
          <div>
            <Card
              size="small"
              style={{ marginBottom: 16 }}
              variant="borderless"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>{selectedFlow.icon || '📝'}</span>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>{selectedFlow.name}</Text>
                    {selectedFlow.description && (
                      <div style={{ color: '#888', fontSize: 12 }}>{selectedFlow.description}</div>
                    )}
                  </div>
                </div>
                <Button icon={<ArrowLeftOutlined />} onClick={handleCancelSelect}>重新选择</Button>
              </div>
            </Card>

            <Card title="填写表单" variant="borderless">
              {formConfig.length === 0 ? (
                <Empty description="此流程未配置表单字段" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Form
                  form={form}
                  layout="vertical"
                  style={{ maxWidth: 800 }}
                >
                  {formConfig.map((field) => renderFormField(field))}
                  <Form.Item>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={submitting}
                      onClick={handleSubmit}
                      size="large"
                    >
                      提交审批
                    </Button>
                  </Form.Item>
                </Form>
              )}
            </Card>
          </div>
        )}
      </Spin>
    </div>
  );
}
