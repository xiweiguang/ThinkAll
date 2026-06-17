import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input, Button, Space, Empty, Select, Tooltip, Tag, message } from 'antd';
import { DeleteOutlined, PlusOutlined, FieldNumberOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import CollapsibleSection from '../../components/Common/CollapsibleSection';
import './ChartAnalysisConfig.css';
const { Option } = Select;

/**
 * 总结配置组件（简单文本 + 字段按钮模式）
 *
 * 交互方式：
 * 1. 在文本框中输入模板文字
 * 2. 将光标放在要插入数据的位置
 * 3. 点击字段按钮插入引用占位符 {{ref_N}}
 * 4. 在右侧引用列表中配置引用属性
 *
 * 数据格式与后端 compute_analysis_v2 完全兼容：
 * { template: "{{ref_1}}文字{{ref_2}}", refs: { ref_1: {...}, ref_2: {...} } }
 */
const ChartAnalysisConfig = ({
  value,
  onChange,
  fieldsConfig,
}) => {
  const quillRef = useRef(null);
  const refCounter = useRef(0);

  // ========== 状态 ==========

  const parseValue = useCallback((val) => {
    if (!val) return { template: '', refs: {} };
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      return { template: parsed.template || '', refs: parsed.refs || {} };
    } catch {
      return { template: '', refs: {} };
    }
  }, []);

  const [template, setTemplate] = useState(() => parseValue(value).template);
  const [refs, setRefs] = useState(() => parseValue(value).refs);
  // 记录当前展开配置的引用ID
  const [expandedRef, setExpandedRef] = useState(null);

  // ========== 字段选项 ==========

  const fieldOptions = (fieldsConfig || []).map((f) => ({
    label: f.label || f.name,
    value: f.name,
  }));

  const statMethodOptions = [
    { label: '求和', value: 'sum' },
    { label: '平均', value: 'avg' },
    { label: '计数', value: 'count' },
    { label: '最大', value: 'max' },
    { label: '最小', value: 'min' },
  ];

  const displayTypeOptions = [
    { label: '字段值', value: 'direct_value', desc: '显示当前值' },
    { label: '求和', value: 'single_stat_sum', desc: '所有数据求和' },
    { label: '平均', value: 'single_stat_avg', desc: '所有数据平均值' },
    { label: '计数', value: 'single_stat_count', desc: '数据条数' },
    { label: '最大', value: 'single_stat_max', desc: '最大值' },
    { label: '最小', value: 'single_stat_min', desc: '最小值' },
    { label: '分组统计', value: 'group_stat', desc: '按分组字段显示' },
    { label: '关联统计', value: 'associated_stat', desc: '统计值对应的关联字段' },
  ];

  const formatPresets = [
    { label: '默认（两列）', value: '' },
    { label: '句子描述', value: '{group_label}，经过此次考核，得到总分{stat_value}' },
    { label: '冒号分隔', value: '{group_label}：{stat_value}' },
    { label: '得分描述', value: '{group_label}得分为{stat_value}分' },
  ];

  // ========== 加载外部 value ==========

  useEffect(() => {
    if (value) {
      const parsed = parseValue(value);
      setTemplate(parsed.template);
      setRefs(parsed.refs);
    } else {
      setTemplate('');
      setRefs({});
    }
  }, [value]);

  // ========== 通知外部变更 ==========

  const notifyChange = useCallback((newTemplate, newRefs) => {
    setTemplate(newTemplate);
    setRefs(newRefs);
    if (onChange) {
      onChange(JSON.stringify({ template: newTemplate, refs: newRefs }));
    }
  }, [onChange]);

  // ========== 生成唯一引用ID ==========

  const generateRefId = () => {
    refCounter.current += 1;
    let tryId = `ref_${refCounter.current}`;
    let counter = refCounter.current;
    while (refs[tryId]) {
      counter += 1;
      tryId = `ref_${counter}`;
    }
    refCounter.current = counter;
    return tryId;
  };

  // ========== 插入字段引用 ==========

  const handleInsertField = (fieldName) => {
    const refId = generateRefId();

    // 使用 Quill API 在光标位置插入文本
    const editor = quillRef?.current?.getEditor();
    if (editor) {
      editor.focus();
      const range = editor.getSelection();
      const index = range ? range.index : editor.getLength();
      editor.insertText(index, `{{${refId}}}`);
      editor.setSelection(index + `{{${refId}}}`.length, 0);
    }

    // 默认创建为直接值引用
    const newRefs = {
      ...refs,
      [refId]: { type: 'direct_value', field: fieldName },
    };

    // 获取编辑器内容作为新模板
    const newTemplate = editor ? editor.root.innerHTML : template;
    notifyChange(newTemplate, newRefs);
    setExpandedRef(refId);
  };

  // ========== 更新引用属性 ==========

  const handleUpdateRef = (refId, updates) => {
    const newRefs = { ...refs };
    newRefs[refId] = { ...newRefs[refId], ...updates };
    notifyChange(template, newRefs);
  };

  // ========== 删除引用 ==========

  const handleDeleteRef = (refId) => {
    const newRefs = { ...refs };
    delete newRefs[refId];
    const newTemplate = template.replace(new RegExp(`\\{\\{${refId}\\}\\}`, 'g'), '');
    notifyChange(newTemplate, newRefs);
    if (expandedRef === refId) {
      setExpandedRef(null);
    }
  };

  // ========== 模板文本变更 ==========

  const handleEditorChange = (content) => {
    // ReactQuill onChange 直接传 HTML 字符串
    notifyChange(content, refs);
  };

  // ========== 获取引用显示标签 ==========

  const getRefLabel = (ref) => {
    const fieldLabel = fieldOptions.find(f => f.value === ref.field)?.label || ref.field;
    switch (ref.type) {
      case 'group_stat': {
        const groupLabel = fieldOptions.find(f => f.value === ref.groupBy)?.label || ref.groupBy;
        const methodLabel = statMethodOptions.find(s => s.value === ref.method)?.label || ref.method;
        return `${groupLabel}|${fieldLabel}|${methodLabel}`;
      }
      case 'associated_stat': {
        const methodLabel = statMethodOptions.find(s => s.value === ref.method)?.label || ref.method;
        const assocLabel = fieldOptions.find(f => f.value === ref.associatedField)?.label || ref.associatedField;
        return `${assocLabel}|${fieldLabel}|${methodLabel}`;
      }
      case 'single_stat': {
        const methodLabel = statMethodOptions.find(s => s.value === ref.method)?.label || ref.method;
        return `${fieldLabel}|${methodLabel}`;
      }
      case 'direct_value':
      default:
        return fieldLabel;
    }
  };

  // ========== 获取引用类型标签 ==========

  const getRefTypeTag = (ref) => {
    switch (ref.type) {
      case 'group_stat': return { text: '分组', color: 'blue' };
      case 'associated_stat': return { text: '关联', color: 'orange' };
      case 'single_stat': return { text: '统计', color: 'green' };
      case 'direct_value': default: return { text: '值', color: 'default' };
    }
  };

  // ========== 渲染引用配置面板 ==========

  const renderRefConfig = (refId) => {
    const ref = refs[refId];
    if (!ref) return null;

    const currentDisplayType = ref.type === 'group_stat' ? 'group_stat'
      : ref.type === 'single_stat' ? `single_stat_${ref.method}`
      : ref.type === 'associated_stat' ? 'associated_stat'
      : 'direct_value';

    return (
      <div className="ref-config-panel">
        {/* 显示方式选择 */}
        <div className="ref-config-row">
          <span className="ref-config-label">显示方式</span>
          <Select
            value={currentDisplayType}
            onChange={(val) => {
              if (val === 'direct_value') {
                handleUpdateRef(refId, { type: 'direct_value' });
              } else if (val === 'group_stat') {
                handleUpdateRef(refId, {
                  type: 'group_stat',
                  groupBy: ref.field,
                  method: 'sum',
                  formatTemplate: '',
                });
              } else if (val === 'associated_stat') {
                handleUpdateRef(refId, {
                  type: 'associated_stat',
                  method: 'max',
                  associatedField: ref.field,
                });
              } else {
                // single_stat_XXX
                const method = val.replace('single_stat_', '');
                handleUpdateRef(refId, { type: 'single_stat', method });
              }
            }}
            size="small"
            style={{ width: '100%' }}
          >
            {displayTypeOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
        </div>

        {/* 分组统计额外配置 */}
        {ref.type === 'group_stat' && (
          <>
            <div className="ref-config-row">
              <span className="ref-config-label">分组字段</span>
              <Select
                value={ref.groupBy || ref.field}
                onChange={(val) => handleUpdateRef(refId, { groupBy: val })}
                size="small"
                style={{ width: '100%' }}
              >
                {fieldOptions.map(f => (
                  <Option key={f.value} value={f.value}>{f.label}</Option>
                ))}
              </Select>
            </div>
            <div className="ref-config-row">
              <span className="ref-config-label">计算字段</span>
              <Select
                value={ref.field}
                onChange={(val) => handleUpdateRef(refId, { field: val })}
                size="small"
                style={{ width: '100%' }}
              >
                {fieldOptions.map(f => (
                  <Option key={f.value} value={f.value}>{f.label}</Option>
                ))}
              </Select>
            </div>
            <div className="ref-config-row">
              <span className="ref-config-label">统计方式</span>
              <Select
                value={ref.method || 'sum'}
                onChange={(val) => handleUpdateRef(refId, { method: val })}
                size="small"
                style={{ width: '100%' }}
              >
                {statMethodOptions.map(m => (
                  <Option key={m.value} value={m.value}>{m.label}</Option>
                ))}
              </Select>
            </div>
            <div className="ref-config-row">
              <span className="ref-config-label">行格式</span>
              <Select
                value={ref.formatTemplate || ''}
                onChange={(val) => handleUpdateRef(refId, { formatTemplate: val })}
                size="small"
                style={{ width: '100%' }}
              >
                {formatPresets.map(p => (
                  <Option key={p.value} value={p.value}>{p.label}</Option>
                ))}
              </Select>
            </div>
            <div className="ref-config-row">
              <Input
                placeholder="自定义格式，如：{group_label}得分为{stat_value}分"
                value={ref.formatTemplate || ''}
                onChange={(e) => handleUpdateRef(refId, { formatTemplate: e.target.value })}
                size="small"
              />
            </div>
            <div className="ref-config-hint">
              <code>{'{group_label}'}</code> 为分组名，<code>{'{stat_value}'}</code> 为统计值
            </div>
          </>
        )}

        {/* 关联统计额外配置 */}
        {ref.type === 'associated_stat' && (
          <>
            <div className="ref-config-row">
              <span className="ref-config-label">统计字段</span>
              <Select
                value={ref.field}
                onChange={(val) => handleUpdateRef(refId, { field: val })}
                size="small"
                style={{ width: '100%' }}
              >
                {fieldOptions.map(f => (
                  <Option key={f.value} value={f.value}>{f.label}</Option>
                ))}
              </Select>
            </div>
            <div className="ref-config-row">
              <span className="ref-config-label">统计方式</span>
              <Select
                value={ref.method || 'max'}
                onChange={(val) => handleUpdateRef(refId, { method: val })}
                size="small"
                style={{ width: '100%' }}
              >
                {statMethodOptions.map(m => (
                  <Option key={m.value} value={m.value}>{m.label}</Option>
                ))}
              </Select>
            </div>
            <div className="ref-config-row">
              <span className="ref-config-label">关联字段</span>
              <Select
                value={ref.associatedField || ref.field}
                onChange={(val) => handleUpdateRef(refId, { associatedField: val })}
                size="small"
                style={{ width: '100%' }}
              >
                {fieldOptions.map(f => (
                  <Option key={f.value} value={f.value}>{f.label}</Option>
                ))}
              </Select>
            </div>
            <div className="ref-config-hint">
              显示统计值所在行的关联字段值，如最高分对应的人名
            </div>
          </>
        )}
      </div>
    );
  };

  // ========== 渲染 ==========

  const refIds = Object.keys(refs);

  // 在模板中高亮显示引用占位符
  const renderTemplatePreview = () => {
    if (!template) return null;
    let result = template;
    // 将 {{ref_N}} 替换为可读的标签
    for (const [refId, ref] of Object.entries(refs)) {
      const label = getRefLabel(ref);
      result = result.replace(new RegExp(`\\{\\{${refId}\\}\\}`, 'g'), `[${label}]`);
    }
    return result;
  };

  return (
    <CollapsibleSection title="总结">
      <div className="analysis-config-v3">
        {/* 模板编辑区 */}
        <div className="analysis-template-area">
          <div className="analysis-template-label">模板内容</div>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={template}
            onChange={handleEditorChange}
            placeholder="输入总结内容，点击下方字段按钮插入数据引用..."
            style={{ marginBottom: 8, height: 150 }}
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ color: [] }, { background: [] }],
                ['clean'],
              ],
            }}
          />

          {/* 字段按钮区 */}
          <div className="analysis-field-buttons">
            <span className="analysis-field-buttons-label">插入字段：</span>
            {fieldOptions.length === 0 ? (
              <span style={{ color: '#999', fontSize: 12 }}>请先配置图表字段</span>
            ) : (
              <div className="analysis-field-btns">
                {fieldOptions.map(f => (
                  <Button
                    key={f.value}
                    size="small"
                    icon={<FieldNumberOutlined />}
                    onClick={() => handleInsertField(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* 预览 */}
          {template && (
            <div className="analysis-template-preview">
              <span className="analysis-preview-label">预览：</span>
              <span className="analysis-preview-text" dangerouslySetInnerHTML={{ __html: renderTemplatePreview() }} />
            </div>
          )}
        </div>

        {/* 引用列表 */}
        <div className="analysis-refs-area">
          <div className="analysis-refs-label">引用配置</div>
          {refIds.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="点击字段按钮添加引用"
              style={{ margin: '12px 0' }}
            />
          ) : (
            <div className="analysis-refs-list-v3">
              {refIds.map(refId => {
                const ref = refs[refId];
                const label = getRefLabel(ref);
                const typeTag = getRefTypeTag(ref);
                const isExpanded = expandedRef === refId;

                return (
                  <div key={refId} className="analysis-ref-card">
                    <div
                      className="analysis-ref-card-header"
                      onClick={() => setExpandedRef(isExpanded ? null : refId)}
                    >
                      <Tag color={typeTag.color} style={{ marginRight: 4 }}>{typeTag.text}</Tag>
                      <span className="analysis-ref-card-label">[{label}]</span>
                      <span className="analysis-ref-card-id">{'{{'}{refId}{'}}'}</span>
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleDeleteRef(refId); }}
                        style={{ marginLeft: 'auto' }}
                      />
                    </div>
                    {isExpanded && renderRefConfig(refId)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default ChartAnalysisConfig;
