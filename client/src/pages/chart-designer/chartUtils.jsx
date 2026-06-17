/**
 * 图表设计器共享工具函数
 * 包含表头分组、条件格式等纯工具函数，供主组件和子组件共用
 */
import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

/**
 * 带提示的标签组件（供子组件共用）
 */
export const LabelWithTip = ({ label, tip }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {label}
    <Tooltip title={tip}>
      <QuestionCircleOutlined style={{ color: '#999', fontSize: 12, cursor: 'help' }} />
    </Tooltip>
  </span>
);

/**
 * 判断分组是否有嵌套字段
 */
export const hasNestedFields = (groups) => {
  if (!Array.isArray(groups)) return false;
  return groups.some(g => g.fields && g.fields.length > 0);
};

/**
 * 递归收集分组中的所有叶子字段
 */
export const collectGroupedFields = (groups, fieldSet) => {
  if (!Array.isArray(groups)) return;
  const resolveFields = (group, visited) => {
    if (!group.name || visited.has(group.name)) return;
    visited.add(group.name);
    (group.fields || []).forEach(f => {
      if (f.startsWith('__group__:')) {
        const refName = f.replace('__group__:', '');
        const refGroup = groups.find(g => g.name === refName);
        if (refGroup) resolveFields(refGroup, visited);
      } else {
        fieldSet.add(f);
      }
    });
  };
  groups.forEach(g => resolveFields(g, new Set()));
};

/**
 * 获取根级分组（不被其他分组引用的分组）
 */
export const getRootGroups = (groups) => {
  if (!Array.isArray(groups)) return [];
  const referencedGroupNames = new Set();
  groups.forEach(g => {
    (g.fields || []).forEach(f => {
      if (f.startsWith('__group__:')) {
        referencedGroupNames.add(f.replace('__group__:', ''));
      }
    });
  });
  return groups.filter(g => !referencedGroupNames.has(g.name));
};

/**
 * 计算表头分组的最大嵌套深度
 * 用于未分组列的 rowSpan 对齐（多级表头时，未分组的列需要设置 rowSpan = maxDepth）
 */
export const getMaxDepth = (groups) => {
  if (!Array.isArray(groups) || groups.length === 0) return 0;
  const rootGroups = getRootGroups(groups);
  let maxDepth = 0;
  const calcDepth = (group, visited) => {
    if (visited.has(group.name)) return 1;
    visited.add(group.name);
    let maxChildDepth = 0;
    let hasRawFields = false;
    (group.fields || []).forEach(f => {
      if (f.startsWith('__group__:')) {
        const refName = f.replace('__group__:', '');
        const refGroup = groups.find(g => g.name === refName);
        if (refGroup) {
          const childDepth = calcDepth(refGroup, new Set(visited));
          maxChildDepth = Math.max(maxChildDepth, childDepth);
        }
      } else {
        hasRawFields = true;
      }
    });
    if (hasRawFields) {
      maxChildDepth = Math.max(maxChildDepth, 1);
    }
    return 1 + maxChildDepth;
  };
  rootGroups.forEach(g => {
    maxDepth = Math.max(maxDepth, calcDepth(g, new Set()));
  });
  return maxDepth;
};

/**
 * 递归构建分组的子列
 * @param {Object} group - 当前分组
 * @param {Array} cols - 列定义数组
 * @param {Array} allGroups - 所有分组
 * @param {Set} visited - 已访问的分组名称集合
 * @param {Object} headerStyle - 表头样式配置（可选）
 */
export const buildGroupChildren = (group, cols, allGroups, visited, headerStyle) => {
  const children = [];
  (group.fields || []).forEach(f => {
    if (f.startsWith('__group__:')) {
      const refName = f.replace('__group__:', '');
      if (visited.has(refName)) return;
      visited.add(refName);
      const refGroup = allGroups.find(rg => rg.name === refName);
      if (refGroup) {
        const refChildren = buildGroupChildren(refGroup, cols, allGroups, visited, headerStyle);
        if (refChildren.length > 0) {
          // 构建父级表头的 onHeaderCell 回调，支持字体样式和颜色控制
          const headerCellStyle = () => {
            const style = {
              fontSize: headerStyle?.hFontSize ? `${headerStyle.hFontSize}px` : undefined,
              fontWeight: headerStyle?.hBold ? 'bold' : undefined,
              fontStyle: headerStyle?.hItalic ? 'italic' : undefined,
              textAlign: headerStyle?.hAlign || 'center',
            };
            if (headerStyle?.hFontColor) style.color = headerStyle.hFontColor;
            if (headerStyle?.hBgColor) style.backgroundColor = headerStyle.hBgColor;
            return { style };
          };
          children.push({ title: refGroup.name || '', onHeaderCell: headerCellStyle, children: refChildren });
        }
      }
    } else {
      const col = cols.find(c => c.dataIndex === f);
      if (col) children.push(col);
    }
  });
  return children;
};

/**
 * 根据根分组构建嵌套列结构
 * @param {Array} rootGroups - 根级分组数组
 * @param {Array} cols - 列定义数组
 * @param {Array} allGroups - 所有分组
 * @param {Object} headerStyle - 表头样式配置（可选）
 */
export const buildGroupedColumns = (rootGroups, cols, allGroups, headerStyle) => {
  if (!Array.isArray(rootGroups)) return [];
  const result = [];
  rootGroups.forEach(g => {
    const children = buildGroupChildren(g, cols, allGroups, new Set(), headerStyle);
    if (children.length > 0) {
      // 构建父级表头的 onHeaderCell 回调，支持字体样式和颜色控制
      const headerCellStyle = () => {
        const style = {
          fontSize: headerStyle?.hFontSize ? `${headerStyle.hFontSize}px` : undefined,
          fontWeight: headerStyle?.hBold ? 'bold' : undefined,
          fontStyle: headerStyle?.hItalic ? 'italic' : undefined,
          textAlign: headerStyle?.hAlign || 'center',
        };
        if (headerStyle?.hFontColor) style.color = headerStyle.hFontColor;
        if (headerStyle?.hBgColor) style.backgroundColor = headerStyle.hBgColor;
        return { style };
      };
      // groupFixed：将子列的 fixed 属性传播到父级分组表头
      const groupFixed = children.every(c => c.fixed === 'left')
        ? 'left'
        : children.every(c => c.fixed === 'right') ? 'right' : undefined;
      result.push({ title: g.name || '', fixed: groupFixed, onHeaderCell: headerCellStyle, children });
    }
  });
  return result;
};

/**
 * 迁移旧版表头分组格式
 */
export const migrateHeaderGroups = (groups) => {
  if (!Array.isArray(groups)) return [];
  const result = [];
  const collectLeafFields = (g, fieldList) => {
    if (g.fields && g.fields.length > 0) {
      fieldList.push(...g.fields);
    }
    if (g.children && g.children.length > 0) {
      g.children.forEach(c => collectLeafFields(c, fieldList));
    }
  };
  const processGroup = (g) => {
    if (!g.children || g.children.length === 0) {
      if (g.fields && g.fields.length > 0) {
        result.push({ name: g.name || '', fields: [...g.fields] });
      }
      return;
    }
    const fields = [];
    g.children.forEach(c => {
      if (c.name && ((c.children && c.children.length > 0) || (c.fields && c.fields.length > 0))) {
        processGroup(c);
        fields.push(`__group__:${c.name}`);
      } else if (!c.name && c.fields && c.fields.length > 0) {
        fields.push(...c.fields);
      } else if (c.children && c.children.length > 0) {
        const subFields = [];
        collectLeafFields(c, subFields);
        fields.push(...subFields);
      }
    });
    if (fields.length > 0) {
      result.push({ name: g.name || '', fields });
    }
  };
  groups.forEach(g => processGroup(g));
  return result;
};

/**
 * 获取条件格式样式
 * 根据条件格式规则判断单元格应应用的字体颜色和背景颜色
 */
export const getConditionalStyle = (value, formats, fieldName) => {
  if (!formats || !Array.isArray(formats)) return null;
  const numVal = Number(value);
  for (const fmt of formats) {
    if (fmt.field !== fieldName) continue;
    let match = false;
    switch (fmt.condition) {
      case 'gt': match = numVal > Number(fmt.value); break;
      case 'lt': match = numVal < Number(fmt.value); break;
      case 'eq': match = numVal === Number(fmt.value); break;
      case 'neq': match = numVal !== Number(fmt.value); break;
      case 'between': match = numVal >= Number(fmt.value) && numVal <= Number(fmt.valueEnd); break;
    }
    if (match) return { fontColor: fmt.fontColor, bgColor: fmt.bgColor };
  }
  return null;
};
