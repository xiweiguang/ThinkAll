/**
 * 公共表格列定义构建函数
 * 从 ChartPreview.jsx 中提取的样式应用逻辑，供 DataTable 和 ChartPreview 共用
 * 确保预览和正式渲染的样式一致
 */
import { getConditionalStyle, hasNestedFields, collectGroupedFields, getRootGroups, getMaxDepth, buildGroupedColumns } from '../pages/chart-designer/chartUtils';

/**
 * 计算合并单元格的 rowSpan 信息
 * @param {string} mergeField - 需要合并的字段名
 * @param {Array} dataSource - 数据源
 * @returns {Object} 行索引到 rowSpan 的映射
 */
export function computeMergeSpans(mergeField, dataSource) {
  if (!mergeField || !dataSource || !dataSource.length) return {};
  const spans = {};
  let start = 0;
  for (let i = 1; i <= dataSource.length; i++) {
    if (i === dataSource.length || dataSource[i][mergeField] !== dataSource[start][mergeField]) {
      const span = i - start;
      for (let j = start; j < i; j++) {
        spans[j] = j === start ? span : 0;
      }
      start = i;
    }
  }
  return spans;
}

/**
 * 公共表格列定义构建函数
 * 统一处理表头样式、单元格样式、列宽、固定列、合并单元格、条件格式、列顺序、表头分组、下钻字段标记等
 *
 * @param {Array} columns - 原始列配置数组
 * @param {Object} styleConfig - 样式配置对象
 * @param {Array} dataSource - 数据源（用于计算合并等）
 * @param {Object} options - 其他选项
 * @param {boolean} options.isPreview - 是否预览模式
 * @param {Array} options.drilldownFields - 下钻字段列表（下钻字段列会标记 isDrilldownField）
 * @param {function} options.onDrilldown - 下钻点击回调函数，接收 record 参数
 * @returns {Array} 构建好的 Ant Design Table 列定义数组
 */
export function buildTableColumnDefs(columns, styleConfig, dataSource, options = {}) {
  if (!columns || !columns.length) return [];

  const {
    headerAlign, cellAlign, conditionalFormats,
    mergeField, mergeBgColor, columnWidths, columnOrder,
    fixedLeftColumns, fixedRightColumns,
    headerFontSize, headerBold, headerItalic, headerFontColor, headerBgColor,
    cellFontSize, cellFontColor, cellBgColor,
    headerAutoWrap, cellAutoWrap,
    headerGroups,
    stripeRow, oddRowBgColor, evenRowBgColor,
  } = styleConfig || {};

  // 下钻字段和回调（从 options 中解构）
  const { drilldownFields, onDrilldown } = options;

  // 1. 列顺序重排
  let orderedCols = [...columns];
  if (columnOrder && columnOrder.length > 0) {
    const colMap = {};
    orderedCols.forEach(c => { colMap[c.dataIndex] = c; });
    const reordered = columnOrder
      .filter(name => colMap[name])
      .map(name => colMap[name]);
    const remaining = orderedCols.filter(c => !columnOrder.includes(c.dataIndex));
    orderedCols = [...reordered, ...remaining];
  }

  // 2. 计算合并信息
  const mergeSpans = computeMergeSpans(mergeField, dataSource);

  // 3. 构建列定义
  const cols = orderedCols.map((col) => {
    const dataIndex = col.dataIndex || col.key;
    const def = { ...col };

    // 对齐方式：优先使用 cellAlign，否则数字类型右对齐
    def.align = cellAlign || (col.type === 'number' ? 'right' : 'left');

    // 自动换行控制（下钻字段列禁用 ellipsis，确保标靶图标完整显示）
    def.ellipsis = (cellAutoWrap || (drilldownFields && drilldownFields.includes(dataIndex))) ? false : true;

    // onHeaderCell - 表头样式
    def.onHeaderCell = () => {
      const style = {
        textAlign: headerAlign || 'center',
      };
      if (headerFontSize) style.fontSize = headerFontSize;
      if (headerBold !== undefined) style.fontWeight = headerBold === false ? 'normal' : 'bold';
      if (headerItalic) style.fontStyle = 'italic';
      if (headerFontColor) style.color = headerFontColor;
      if (headerBgColor) {
        style.backgroundColor = headerBgColor;
        style.backgroundImage = 'none'; // 隐藏默认渐变
      }
      if (headerAutoWrap) {
        style.whiteSpace = 'normal';
        style.wordBreak = 'break-word';
      }
      return { style };
    };

    // onCell - 单元格样式
    def.onCell = (record, index) => {
      const cellStyle = {
        textAlign: cellAlign || 'left',
      };
      if (cellFontSize) cellStyle.fontSize = cellFontSize;
      if (cellFontColor) cellStyle.color = cellFontColor;
      // 单元格底色不再在此处直接设置，改为在隔行变色逻辑中按优先级处理
      if (cellAutoWrap) {
        cellStyle.whiteSpace = 'normal';
        cellStyle.wordBreak = 'break-word';
      }

      // 条件格式
      let condBgApplied = false;
      if (conditionalFormats && conditionalFormats.length > 0) {
        const fmt = getConditionalStyle(record[dataIndex], conditionalFormats, dataIndex);
        if (fmt) {
          if (fmt.fontColor) cellStyle.color = fmt.fontColor;
          if (fmt.bgColor) {
            cellStyle.backgroundColor = fmt.bgColor;
            condBgApplied = true;
          }
        }
      }

      // 合并列的特殊处理：通过 CSS 变量设置合并底色（优先级低于 !important 的 hover 规则）
      const isMergeColumn = mergeField && dataIndex === mergeField;
      if (isMergeColumn && mergeBgColor) {
        cellStyle['--merge-bg-color'] = mergeBgColor;  // CSS 变量
        delete cellStyle.backgroundColor;  // 移除内联背景色，改用 CSS 变量控制
      }
      // 条件格式背景色优先级最高，隔行变色和单元格底色均不能覆盖
      if (isMergeColumn) {
        // 合并列不应用隔行变色
      } else if (condBgApplied) {
        // 条件格式已设置背景色，优先级最高，不覆盖
      } else if (stripeRow || evenRowBgColor) {
        if (index % 2 !== 0) {
          cellStyle.backgroundColor = evenRowBgColor || '#fafafa';
        } else if (oddRowBgColor) {
          cellStyle.backgroundColor = oddRowBgColor;
        } else if (cellBgColor) {
          cellStyle.backgroundColor = cellBgColor;
        }
      } else if (cellBgColor) {
        cellStyle.backgroundColor = cellBgColor;
      }

      return { style: cellStyle };
    };

    // 列宽
    if (columnWidths && columnWidths[dataIndex]) {
      def.width = columnWidths[dataIndex];
    }

    // 合并单元格
    if (mergeField && dataIndex === mergeField && dataSource && dataSource.length > 0) {
      const originalRender = def.render;
      def.render = (val, record, index) => {
        const rowSpan = mergeSpans[index] !== undefined ? mergeSpans[index] : 1;
        const content = originalRender ? originalRender(val, record, index) : val;
        if (rowSpan === 0) return { children: content, props: { rowSpan: 0 } };
        return { children: content, props: { rowSpan } };
      };
    }

    // 标记下钻字段列（供 DataTable 组件在类型渲染后添加下钻图标和点击事件）
    if (drilldownFields && drilldownFields.includes(dataIndex)) {
      def.isDrilldownField = true;
    }

    return def;
  });

  // 4. 固定列（支持数字和数组两种格式）
  if (fixedLeftColumns) {
    if (typeof fixedLeftColumns === 'number') {
      cols.slice(0, Math.min(fixedLeftColumns, cols.length)).forEach(c => { c.fixed = 'left'; });
    } else if (Array.isArray(fixedLeftColumns)) {
      cols.forEach(c => {
        if (fixedLeftColumns.includes(c.dataIndex || c.key)) c.fixed = 'left';
      });
    }
  }
  if (fixedRightColumns) {
    if (typeof fixedRightColumns === 'number') {
      cols.slice(-Math.min(fixedRightColumns, cols.length)).forEach(c => { c.fixed = 'right'; });
    } else if (Array.isArray(fixedRightColumns)) {
      cols.forEach(c => {
        if (fixedRightColumns.includes(c.dataIndex || c.key)) c.fixed = 'right';
      });
    }
  }

  // 5. 合并表头
  if (headerGroups && headerGroups.length > 0 && hasNestedFields(headerGroups)) {
    const groupedFieldSet = new Set();
    collectGroupedFields(headerGroups, groupedFieldSet);
    const rootGroups = getRootGroups(headerGroups);
    const maxDepth = getMaxDepth(headerGroups);
    // 构建表头样式配置对象，用于父级表头的样式控制
    const headerStyle = {
      hFontSize: headerFontSize,
      hBold: headerBold,
      hItalic: headerItalic,
      hAlign: headerAlign,
      hFontColor: headerFontColor,
      hBgColor: headerBgColor,
    };
    const groupedColumns = buildGroupedColumns(rootGroups, cols, headerGroups, headerStyle);

    // 按原始列顺序交替插入分组列和未分组列，保持列的正确顺序
    // 构建每个根分组的首个字段索引映射，用于确定分组在原始列顺序中的位置
    const groupFirstFieldIndex = new Map();
    rootGroups.forEach(g => {
      // 收集分组下的叶子字段
      const leafFields = [];
      const collectLeaves = (group) => {
        if (group.fields && group.fields.length > 0) {
          group.fields.forEach(f => {
            if (!f.startsWith('__group__:')) {
              leafFields.push(f);
            }
          });
        }
        if (group.children && group.children.length > 0) {
          group.children.forEach(child => collectLeaves(child));
        }
      };
      collectLeaves(g);
      let minIdx = Infinity;
      for (const f of leafFields) {
        const idx = cols.findIndex(c => c.dataIndex === f);
        if (idx !== -1 && idx < minIdx) minIdx = idx;
      }
      if (minIdx !== Infinity) groupFirstFieldIndex.set(g.name, minIdx);
    });

    // 为每个分组列设置排序索引
    const groupSortIndices = new Map();
    groupedColumns.forEach(gc => {
      const idx = groupFirstFieldIndex.get(gc.title);
      groupSortIndices.set(gc, idx !== undefined ? idx : Infinity);
    });

    // 为未分组列设置排序索引和 rowSpan
    const ungroupedCols = cols.filter(c => !groupedFieldSet.has(c.dataIndex)).map(c => {
      const originalOnHeaderCell = c.onHeaderCell;
      const sortIdx = cols.indexOf(c);
      const wrapped = {
        ...c,
        onHeaderCell: () => {
          const cellProps = originalOnHeaderCell ? originalOnHeaderCell() : {};
          return { ...cellProps, rowSpan: maxDepth };
        },
        _sortIdx: sortIdx,
      };
      return wrapped;
    });

    // 合并分组列和未分组列，按原始列顺序排列
    const allColumns = [
      ...groupedColumns.map(gc => ({ column: gc, sortIdx: groupSortIndices.get(gc) })),
      ...ungroupedCols.map(uc => ({ column: uc, sortIdx: uc._sortIdx })),
    ];
    allColumns.sort((a, b) => a.sortIdx - b.sortIdx);
    return allColumns.map(item => {
      // 清理临时的 _sortIdx 属性
      const { _sortIdx, ...cleanCol } = item.column;
      return _sortIdx !== undefined ? cleanCol : item.column;
    });
  }

  return cols;
}
