import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Input, InputNumber, DatePicker, Button, Tag, Row, Col, Select } from 'antd';
import { SearchOutlined, ReloadOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFieldOptions } from '../../services/tableService';
import './FilterPanel.css';

const { RangePicker } = DatePicker;

/**
 * 筛选面板组件
 * 根据列的 type 和 filterable 属性动态生成筛选项
 * 文本类型：Input 输入框，模糊搜索
 * 数值类型：两个 InputNumber，最小值和最大值
 * 日期类型：DatePicker.RangePicker 日期范围选择
 * 选择类型：Select 下拉选择，支持搜索+清除
 */
export default function FilterPanel({ columns, onFilter, tableId, initialFilters }) {
  const filterableColumns = useMemo(() => columns.filter((col) => col.filterable), [columns]);

  const [filterValues, setFilterValues] = useState(() => {
    const initial = {};
    filterableColumns.forEach((col) => {
      if (col.type === 'number') {
        initial[`${col.dataIndex}_min`] = null;
        initial[`${col.dataIndex}_max`] = null;
      } else if (col.type === 'date') {
        initial[`${col.dataIndex}_range`] = null;
      } else {
        initial[col.dataIndex] = '';
      }
    });
    return initial;
  });

  const [fieldOptions, setFieldOptions] = useState({});

  // 使用 ref 存储 onFilter 回调，避免因父组件未 memoize 导致 useEffect 无限循环
  const onFilterRef = useRef(onFilter);
  onFilterRef.current = onFilter;

  // 使用 ref 存储 filterableColumns，避免其变化导致 useEffect 无限循环
  const filterableColumnsRef = useRef(filterableColumns);
  filterableColumnsRef.current = filterableColumns;

  // 将 initialFilters 序列化为稳定字符串，避免对象引用变化导致 useEffect 无限触发
  const initialFiltersKey = useMemo(() => {
    if (!initialFilters || Object.keys(initialFilters).length === 0) return '';
    return JSON.stringify(initialFilters);
  }, [initialFilters]);

  // 当 initialFilters 变化时，自动应用筛选值
  useEffect(() => {
    if (!initialFiltersKey) return;
    const currentFilterableColumns = filterableColumnsRef.current;
    const newValues = {};
    currentFilterableColumns.forEach((col) => {
      if (col.type === 'number') {
        const minKey = `${col.dataIndex}_min`;
        const maxKey = `${col.dataIndex}_max`;
        if (initialFilters[minKey] !== undefined) newValues[minKey] = initialFilters[minKey];
        if (initialFilters[maxKey] !== undefined) newValues[maxKey] = initialFilters[maxKey];
      } else if (col.type === 'date') {
        const startKey = `${col.dataIndex}_startDate`;
        const endKey = `${col.dataIndex}_endDate`;
        if (initialFilters[startKey] && initialFilters[endKey]) {
          newValues[`${col.dataIndex}_range`] = [dayjs(initialFilters[startKey]), dayjs(initialFilters[endKey])];
        }
      } else {
        if (initialFilters[col.dataIndex] !== undefined) {
          newValues[col.dataIndex] = initialFilters[col.dataIndex];
        }
      }
    });
    if (Object.keys(newValues).length > 0) {
      setFilterValues((prev) => ({ ...prev, ...newValues }));
      // 构建筛选参数并触发筛选
      const params = {};
      currentFilterableColumns.forEach((col) => {
        if (col.type === 'text' || col.type === 'select') {
          const val = newValues[col.dataIndex];
          if (val && String(val).trim()) {
            params[col.dataIndex] = String(val).trim();
          }
        } else if (col.type === 'number') {
          const minVal = newValues[`${col.dataIndex}_min`];
          const maxVal = newValues[`${col.dataIndex}_max`];
          if (minVal !== null && minVal !== undefined) params[`${col.dataIndex}_min`] = minVal;
          if (maxVal !== null && maxVal !== undefined) params[`${col.dataIndex}_max`] = maxVal;
        } else if (col.type === 'date') {
          const range = newValues[`${col.dataIndex}_range`];
          if (range && range.length === 2) {
            params[`${col.dataIndex}_startDate`] = range[0].format('YYYY-MM-DD');
            params[`${col.dataIndex}_endDate`] = range[1].format('YYYY-MM-DD');
          }
        }
      });
      if (onFilterRef.current) {
        onFilterRef.current(params);
      }
    }
  }, [initialFiltersKey]);

  // 计算select字段的稳定key，避免filterableColumns引用变化导致无限循环
  const selectFieldsKey = filterableColumns
    .filter(col => col.type === 'select' && col.fetchOptions)
    .map(col => col.dataIndex)
    .sort()
    .join(',');

  // 将当前筛选值序列化为稳定字符串，用于选项获取的依赖
  const filterValuesKey = useMemo(() => {
    const relevantValues = {};
    for (const [key, val] of Object.entries(filterValues)) {
      if (val !== '' && val !== null && val !== undefined) {
        relevantValues[key] = val;
      }
    }
    return JSON.stringify(relevantValues);
  }, [filterValues]);

  useEffect(() => {
    if (!tableId || !selectFieldsKey) return;
    const fetchOptions = async () => {
      const optionsMap = {};
      const selectCols = filterableColumns.filter(col => col.type === 'select' && col.fetchOptions);
      // 构建当前筛选参数（排除当前字段自身的筛选值）
      for (const col of selectCols) {
        try {
          const currentParams = {};
          for (const fCol of filterableColumns) {
            if (fCol.dataIndex === col.dataIndex) continue; // 排除当前字段自身
            if (fCol.type === 'text' || fCol.type === 'select') {
              const val = filterValues[fCol.dataIndex];
              if (val && String(val).trim()) currentParams[fCol.dataIndex] = String(val).trim();
            } else if (fCol.type === 'number') {
              const minVal = filterValues[`${fCol.dataIndex}_min`];
              const maxVal = filterValues[`${fCol.dataIndex}_max`];
              if (minVal !== null && minVal !== undefined) currentParams[`${fCol.dataIndex}_min`] = minVal;
              if (maxVal !== null && maxVal !== undefined) currentParams[`${fCol.dataIndex}_max`] = maxVal;
            } else if (fCol.type === 'date') {
              const range = filterValues[`${fCol.dataIndex}_range`];
              if (range && range.length === 2) {
                currentParams[`${fCol.dataIndex}_startDate`] = range[0].format('YYYY-MM-DD');
                currentParams[`${fCol.dataIndex}_endDate`] = range[1].format('YYYY-MM-DD');
              }
            }
          }
          const res = await getFieldOptions(tableId, col.dataIndex, currentParams);
          const data = res.data || res || [];
          optionsMap[col.dataIndex] = Array.isArray(data) ? data.map(v => ({ value: v, label: v })) : [];
        } catch {
          optionsMap[col.dataIndex] = [];
        }
      }
      setFieldOptions(optionsMap);
    };
    fetchOptions();
  }, [tableId, selectFieldsKey, filterValuesKey]);

  const handleValueChange = useCallback((key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSearch = useCallback(() => {
    const params = {};
    filterableColumns.forEach((col) => {
      if (col.type === 'text') {
        const val = filterValues[col.dataIndex];
        if (val && val.trim()) {
          params[col.dataIndex] = val.trim();
        }
      } else if (col.type === 'number') {
        const minVal = filterValues[`${col.dataIndex}_min`];
        const maxVal = filterValues[`${col.dataIndex}_max`];
        if (minVal !== null && minVal !== undefined) {
          params[`${col.dataIndex}_min`] = minVal;
        }
        if (maxVal !== null && maxVal !== undefined) {
          params[`${col.dataIndex}_max`] = maxVal;
        }
      } else if (col.type === 'date') {
        const range = filterValues[`${col.dataIndex}_range`];
        if (range && range.length === 2) {
          params[`${col.dataIndex}_startDate`] = range[0].format('YYYY-MM-DD');
          params[`${col.dataIndex}_endDate`] = range[1].format('YYYY-MM-DD');
        }
      } else if (col.type === 'select') {
        const val = filterValues[col.dataIndex];
        if (val !== undefined && val !== '') {
          params[col.dataIndex] = val;
        }
      }
    });
    if (onFilter) {
      onFilter(params);
    }
  }, [filterValues, filterableColumns, onFilter]);

  const handleReset = useCallback(() => {
    const resetValues = {};
    filterableColumns.forEach((col) => {
      if (col.type === 'number') {
        resetValues[`${col.dataIndex}_min`] = null;
        resetValues[`${col.dataIndex}_max`] = null;
      } else if (col.type === 'date') {
        resetValues[`${col.dataIndex}_range`] = null;
      } else {
        resetValues[col.dataIndex] = '';
      }
    });
    setFilterValues(resetValues);
    if (onFilter) {
      onFilter({});
    }
  }, [filterableColumns, onFilter]);

  const getActiveFilterTags = useCallback(() => {
    const tags = [];
    filterableColumns.forEach((col) => {
      if (col.type === 'text' || col.type === 'select') {
        const val = filterValues[col.dataIndex];
        if (val && val.trim && val.trim()) {
          tags.push({
            key: col.dataIndex,
            label: `${col.title}: ${val}`,
            field: col.dataIndex,
          });
        }
      } else if (col.type === 'number') {
        const minVal = filterValues[`${col.dataIndex}_min`];
        const maxVal = filterValues[`${col.dataIndex}_max`];
        if (minVal !== null && minVal !== undefined && maxVal !== null && maxVal !== undefined) {
          tags.push({
            key: `${col.dataIndex}_range`,
            label: `${col.title}: ${minVal} ~ ${maxVal}`,
            field: col.dataIndex,
          });
        } else if (minVal !== null && minVal !== undefined) {
          tags.push({
            key: `${col.dataIndex}_min`,
            label: `${col.title}: ≥ ${minVal}`,
            field: col.dataIndex,
          });
        } else if (maxVal !== null && maxVal !== undefined) {
          tags.push({
            key: `${col.dataIndex}_max`,
            label: `${col.title}: ≤ ${maxVal}`,
            field: col.dataIndex,
          });
        }
      } else if (col.type === 'date') {
        const range = filterValues[`${col.dataIndex}_range`];
        if (range && range.length === 2) {
          tags.push({
            key: `${col.dataIndex}_range`,
            label: `${col.title}: ${range[0].format('YYYY-MM-DD')} ~ ${range[1].format('YYYY-MM-DD')}`,
            field: col.dataIndex,
          });
        }
      }
    });
    return tags;
  }, [filterValues, filterableColumns]);

  const handleTagClose = useCallback((tag) => {
    const col = filterableColumns.find((c) => c.dataIndex === tag.field);
    if (!col) return;
    if (col.type === 'number') {
      setFilterValues((prev) => ({
        ...prev,
        [`${col.dataIndex}_min`]: null,
        [`${col.dataIndex}_max`]: null,
      }));
    } else if (col.type === 'date') {
      setFilterValues((prev) => ({
        ...prev,
        [`${col.dataIndex}_range`]: null,
      }));
    } else {
      setFilterValues((prev) => ({
        ...prev,
        [col.dataIndex]: '',
      }));
    }
  }, [filterableColumns]);

  const handleClearAll = useCallback(() => {
    handleReset();
  }, [handleReset]);

  const renderFilterItem = (col) => {
    if (col.type === 'text') {
      return (
        <Col key={col.dataIndex} span={6}>
          <div className="filter-item">
            <span className="filter-item-label">{col.title}</span>
            <Input
              placeholder={`搜索${col.title}`}
              value={filterValues[col.dataIndex]}
              onChange={(e) => handleValueChange(col.dataIndex, e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </div>
        </Col>
      );
    }

    if (col.type === 'number') {
      return (
        <Col key={col.dataIndex} span={6}>
          <div className="filter-item">
            <span className="filter-item-label">{col.title}</span>
            <div className="filter-number-range">
              <InputNumber
                placeholder="最小值"
                value={filterValues[`${col.dataIndex}_min`]}
                onChange={(val) => handleValueChange(`${col.dataIndex}_min`, val)}
                style={{ width: '100%' }}
              />
              <span>~</span>
              <InputNumber
                placeholder="最大值"
                value={filterValues[`${col.dataIndex}_max`]}
                onChange={(val) => handleValueChange(`${col.dataIndex}_max`, val)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </Col>
      );
    }

    if (col.type === 'date') {
      return (
        <Col key={col.dataIndex} span={6}>
          <div className="filter-item">
            <span className="filter-item-label">{col.title}</span>
            <RangePicker
              value={filterValues[`${col.dataIndex}_range`]}
              onChange={(dates) => handleValueChange(`${col.dataIndex}_range`, dates)}
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
            />
          </div>
        </Col>
      );
    }

    if (col.type === 'select') {
      const options = fieldOptions[col.dataIndex] || [];
      return (
        <Col key={col.dataIndex} span={6}>
          <div className="filter-item">
            <span className="filter-item-label">{col.title}</span>
            <Select
              showSearch
              allowClear
              placeholder={`选择${col.title}`}
              value={filterValues[col.dataIndex] || undefined}
              onChange={(val) => handleValueChange(col.dataIndex, val || '')}
              options={options}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
            />
          </div>
        </Col>
      );
    }

    return null;
  };

  const activeTags = getActiveFilterTags();

  if (filterableColumns.length === 0) {
    return null;
  }

  return (
    <div className="filter-panel">
      <Row gutter={[12, 12]} align="bottom">
        {filterableColumns.map(renderFilterItem)}
        <Col span={6}>
          <div className="filter-actions">
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </div>
        </Col>
      </Row>
      {activeTags.length > 0 && (
        <div className="filter-tags">
          <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>当前筛选：</span>
          {activeTags.map((tag) => (
            <Tag
              key={tag.key}
              closable
              onClose={() => handleTagClose(tag)}
              color="blue"
            >
              {tag.label}
            </Tag>
          ))}
          <Button
            type="link"
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={handleClearAll}
            className="clear-all-btn"
          >
            清除全部
          </Button>
        </div>
      )}
    </div>
  );
}
