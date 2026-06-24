import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Modal,
  Form,
  Switch,
  Steps,
  Popconfirm,
  message,
  Tooltip,
  Row,
  Col,
  Empty,
  Divider,
  Alert,
  TreeSelect,
  Tree,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  SearchOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined,
  LineChartOutlined,
  BarChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  RadarChartOutlined,
  AreaChartOutlined,
  SaveOutlined,
  EyeOutlined,
  CalculatorOutlined,
  TableOutlined,
  EnvironmentOutlined,
  QuestionCircleOutlined,
  ColumnWidthOutlined,
  ApartmentOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import * as chartDesignerService from '../services/chartDesignerService';
import * as dataSourceService from '../services/dataSourceService';
import * as chartCategoryService from '../services/chartCategoryService';
import { formatDate } from '../utils';
import { COLOR_MAP, COLOR_SCHEME_NAMES } from '../utils/colorSchemes';
import safeEval from '../utils/safeEval';
import './ChartDesignerPage.css';
// 子组件导入
import ChartFieldConfig from './chart-designer/ChartFieldConfig';
import ChartStyleConfig from './chart-designer/ChartStyleConfig';
import ChartDrilldownConfig from './chart-designer/ChartDrilldownConfig';
import ChartAnalysisConfig from './chart-designer/ChartAnalysisConfig';
import ChartPreview from './chart-designer/ChartPreview';
import ChartBasicConfig from './chart-designer/ChartBasicConfig';
// 共享工具函数导入
import { LabelWithTip, migrateHeaderGroups } from './chart-designer/chartUtils';

const CHART_TYPES = [
  { value: 'line', label: '折线图', icon: <LineChartOutlined /> },
  { value: 'bar', label: '柱状图', icon: <BarChartOutlined /> },
  { value: 'pie', label: '饼图', icon: <PieChartOutlined /> },
  { value: 'scatter', label: '散点图', icon: <DotChartOutlined /> },
  { value: 'radar', label: '雷达图', icon: <RadarChartOutlined /> },
  { value: 'area', label: '面积图', icon: <AreaChartOutlined /> },
  { value: 'table', label: '表格', icon: <TableOutlined /> },
  { value: 'double_line', label: '双折线图', icon: <LineChartOutlined /> },
  { value: 'double_pie', label: '双饼图', icon: <PieChartOutlined /> },
  { value: 'multi_bar', label: '多柱图', icon: <BarChartOutlined /> },
  { value: 'stacked_bar', label: '堆叠柱状图', icon: <BarChartOutlined /> },
  { value: 'rich_text', label: '富文本', icon: <EditOutlined /> },
  { value: 'map', label: '地图（即将推出）', icon: <EnvironmentOutlined />, disabled: true },
];

// 配色方案常量（供子组件使用）
const COLOR_SCHEMES = [
  { value: 'default', label: '默认配色' },
  { value: 'warm', label: '暖色调' },
  { value: 'cool', label: '冷色调' },
  { value: 'fresh', label: '清新' },
  { value: 'dark', label: '深色' },
  { value: 'tech', label: '科技蓝' },
  { value: 'night', label: '暗夜' },
];

// 图例位置常量（供子组件使用）
const LEGEND_POSITIONS = [
  { value: 'top', label: '顶部' },
  { value: 'bottom', label: '底部' },
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
  { value: 'hidden', label: '隐藏' },
];

export default function ChartDesignerPage() {
  const { hasPermission } = useAuth();

  // 将分类树转换为 TreeSelect 数据格式
  const buildTreeSelectData = (cat) => ({
    title: cat.name,
    value: cat.id,
    key: cat.id,
    children: (cat.children || []).map(child => buildTreeSelectData(child)),
  });

  // 将分类树转换为 Tree 数据格式
  const buildTreeData = (cats) => cats.map(cat => ({
    title: (
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span>{cat.name}</span>
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setEditingCategoryId(cat.id);
              setCategoryName(cat.name);
              setCategoryParentId(cat.parentId || undefined);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteCategory(cat);
            }}
          >
            删除
          </Button>
        </Space>
      </span>
    ),
    key: cat.id,
    // 存储分类原始数据，供右键菜单使用
    name: cat.name,
    parentId: cat.parentId,
    catData: cat,
    children: cat.children && cat.children.length > 0 ? buildTreeData(cat.children) : [],
  }));

  const previewChartRef = useRef(null);
  const quillRef = useRef(null);

  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [wizardMode, setWizardMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [editingChart, setEditingChart] = useState(null);

  const [dataSources, setDataSources] = useState([]);
  const [selectedDsId, setSelectedDsId] = useState(undefined);
  const [dsTables, setDsTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(undefined);
  const [dsColumns, setDsColumns] = useState([]);

  const [querySql, setQuerySql] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [fields, setFields] = useState([]);
  const [calcFieldModalVisible, setCalcFieldModalVisible] = useState(false);
  const [calcFieldName, setCalcFieldName] = useState('');
  const [calcFieldExpr, setCalcFieldExpr] = useState('');
  const [editingCalcFieldIndex, setEditingCalcFieldIndex] = useState(-1);

  const [chartType, setChartType] = useState('bar');
  const [xField, setXField] = useState(undefined);
  const [yFields, setYFields] = useState([]);
  const [groupField, setGroupField] = useState(undefined);
  const [chartTitle, setChartTitle] = useState('');
  const [showTitle, setShowTitle] = useState(true);
  const [colorScheme, setColorScheme] = useState('default');
  const [legendPosition, setLegendPosition] = useState('top');
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [chartBgColor, setChartBgColor] = useState(undefined);
  const [titleColor, setTitleColor] = useState('rgba(24,144,255,1)');
  const [titleAlign, setTitleAlign] = useState('left');
  const [showGridLine, setShowGridLine] = useState(true);
  const [gridLineColor, setGridLineColor] = useState('rgba(200,200,200,0.3)');
  const [axisLabelColor, setAxisLabelColor] = useState('rgba(89,89,89,1)');
  const [axisLabelFontSize, setAxisLabelFontSize] = useState(12);
  const [legendFontSize, setLegendFontSize] = useState(12);

  const [headerAlign, setHeaderAlign] = useState('center');
  const [headerFontSize, setHeaderFontSize] = useState(14);
  const [headerBold, setHeaderBold] = useState(true);
  const [headerItalic, setHeaderItalic] = useState(false);
  const [cellAlign, setCellAlign] = useState('left');
  const [cellFontSize, setCellFontSize] = useState(13);
  const [titleFontSize, setTitleFontSize] = useState(16);
  const [titleBold, setTitleBold] = useState(true);
  const [defaultSortField, setDefaultSortField] = useState(undefined);
  const [defaultSortOrder, setDefaultSortOrder] = useState('none');
  const [conditionalFormats, setConditionalFormats] = useState([]);
  const [fixedLeftColumns, setFixedLeftColumns] = useState(0);
  const [fixedRightColumns, setFixedRightColumns] = useState(0);
  const [headerAutoWrap, setHeaderAutoWrap] = useState(false);
  const [columnWidths, setColumnWidths] = useState({});
  const [headerFontColor, setHeaderFontColor] = useState(undefined);
  const [cellFontColor, setCellFontColor] = useState(undefined);
  const [showOuterBorder, setShowOuterBorder] = useState(true);
  const [showInnerBorder, setShowInnerBorder] = useState(true);
  const [borderColor, setBorderColor] = useState('#e8e8e8');
  const [borderStyle, setBorderStyle] = useState('solid');
  const [outerBorderWidth, setOuterBorderWidth] = useState('1px');
  const [innerBorderWidth, setInnerBorderWidth] = useState('1px');
  const [innerBorderColor, setInnerBorderColor] = useState(undefined);
  const [innerBorderStyle, setInnerBorderStyle] = useState('solid');
  const [headerBgColor, setHeaderBgColor] = useState(undefined);
  const [cellBgColor, setCellBgColor] = useState(undefined);
  const [stripeRow, setStripeRow] = useState(false);
  const [oddRowBgColor, setOddRowBgColor] = useState('#ffffff');
  const [evenRowBgColor, setEvenRowBgColor] = useState('#fafafa');
  const [headerGroups, setHeaderGroups] = useState([]);
  const [fixedHeader, setFixedHeader] = useState(true);
  const [cellAutoWrap, setCellAutoWrap] = useState(false);
  const [mergeField, setMergeField] = useState(undefined);
  const [mergeBgColor, setMergeBgColor] = useState('#e6f7ff');
  const [columnOrder, setColumnOrder] = useState([]);
  const [summaryRowCustomStyle, setSummaryRowCustomStyle] = useState(false);
  const [summaryFontColor, setSummaryFontColor] = useState('#1890ff');
  const [summaryBgColor, setSummaryBgColor] = useState('#fafafa');
  const [summaryBold, setSummaryBold] = useState(true);
  const [summaryAlign, setSummaryAlign] = useState('left');
  const [summaryFontSize, setSummaryFontSize] = useState(14);
  const [summaryItalic, setSummaryItalic] = useState(false);
  const [summaryFixed, setSummaryFixed] = useState(false);
  const [dateLinkageEnabled, setDateLinkageEnabled] = useState(false);
  const [dateLinkageField, setDateLinkageField] = useState(undefined);
  const [dateLinkageRange, setDateLinkageRange] = useState('today');
  const [dateLinkageStartDate, setDateLinkageStartDate] = useState(undefined);
  const [dateLinkageEndDate, setDateLinkageEndDate] = useState(undefined);
  const [drilldownEnabled, setDrilldownEnabled] = useState(false);
  const [drilldownTargetChartId, setDrilldownTargetChartId] = useState(undefined);
  const [drilldownFields, setDrilldownFields] = useState([]);
  const [drilldownFieldMappings, setDrilldownFieldMappings] = useState({});
  const [fieldLinks, setFieldLinks] = useState({});
  const [analysisTemplate, setAnalysisTemplate] = useState('');
  const [analysisConfig, setAnalysisConfig] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  // 富文本相关状态
  const [richTextContent, setRichTextContent] = useState('');
  const [richTextBgColor, setRichTextBgColor] = useState(undefined);
  const [richTextPadding, setRichTextPadding] = useState(16);
  const [richTextFontSize, setRichTextFontSize] = useState(14);
  const [richTextAlign, setRichTextAlign] = useState('left');
  const [richTextFontColor, setRichTextFontColor] = useState('rgba(51,51,51,1)');
  const [richTextLineHeight, setRichTextLineHeight] = useState(1.8);
  const [richTextBorderRadius, setRichTextBorderRadius] = useState(8);

  const [chartId, setChartId] = useState('');
  const [chartName, setChartName] = useState('');
  const [chartDescription, setChartDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [descPosition, setDescPosition] = useState('bottom'); // 'top' 或 'bottom'
  const [descAlign, setDescAlign] = useState('left'); // 'left', 'center', 'right'
  const [descFontSize, setDescFontSize] = useState(13);
  const [descFontFamily, setDescFontFamily] = useState('');
  const [descFontColor, setDescFontColor] = useState('#333333');
  const [descBold, setDescBold] = useState(false);
  const [descItalic, setDescItalic] = useState(false);
  const [descBgColor, setDescBgColor] = useState('#f0f5ff');
  const [descBorderColor, setDescBorderColor] = useState('#1890ff');
  const [descLineHeight, setDescLineHeight] = useState(1.6);
  const [dataPermission, setDataPermission] = useState(false);
  const [matchField, setMatchField] = useState(undefined);
  const [departmentField, setDepartmentField] = useState(undefined);
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState(undefined);
  const [categories, setCategories] = useState([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryParentId, setCategoryParentId] = useState(undefined);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  // 右键菜单相关状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState(null);

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chartDesignerService.getCharts();
      const data = res.data || res;
      const list = Array.isArray(data) ? data : (data?.list || []);
      setCharts(list);
    } catch (error) {
      message.error('获取图表列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDataSources = useCallback(async () => {
    try {
      const res = await dataSourceService.getDataSources();
      const data = res.data || res;
      const list = Array.isArray(data) ? data : (data?.list || []);
      setDataSources(list);
    } catch (error) {
      message.error('获取数据源列表失败');
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await chartCategoryService.getCategories();
      const data = res.data || res;
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchCharts();
    fetchDataSources();
    fetchCategories();
  }, [fetchCharts, fetchDataSources, fetchCategories]);

  const filteredCharts = useMemo(() => {
    if (!searchText.trim()) return charts;
    const keyword = searchText.trim().toLowerCase();
    return charts.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(keyword)) ||
        (item.chart_id && item.chart_id.toLowerCase().includes(keyword))
    );
  }, [searchText, charts]);

  const resetWizard = () => {
    setCurrentStep(0);
    setEditingChart(null);
    setSelectedDsId(undefined);
    setDsTables([]);
    setSelectedTable(undefined);
    setDsColumns([]);
    setQuerySql('');
    setPreviewData([]);
    setPreviewColumns([]);
    setFields([]);
    setCalcFieldModalVisible(false);
    setCalcFieldName('');
    setCalcFieldExpr('');
    setEditingCalcFieldIndex(-1);
    setChartType('bar');
    setXField(undefined);
    setYFields([]);
    setGroupField(undefined);
    setChartTitle('');
    setShowTitle(true);
    setColorScheme('default');
    setLegendPosition('top');
    setShowDataLabels(false);
    setChartBgColor(undefined);
    setTitleColor('rgba(24,144,255,1)');
    setTitleAlign('left');
    setShowGridLine(true);
    setGridLineColor('rgba(200,200,200,0.3)');
    setAxisLabelColor('rgba(89,89,89,1)');
    setAxisLabelFontSize(12);
    setLegendFontSize(12);
    setHeaderAlign('center');
    setHeaderFontSize(14);
    setHeaderBold(true);
    setHeaderItalic(false);
    setCellAlign('left');
    setCellFontSize(13);
    setTitleFontSize(16);
    setTitleBold(true);
    setDefaultSortField(undefined);
    setDefaultSortOrder('none');
    setConditionalFormats([]);
    setFixedLeftColumns(0);
    setFixedRightColumns(0);
    setHeaderAutoWrap(false);
    setColumnWidths({});
    setHeaderFontColor(undefined);
    setCellFontColor(undefined);
    setShowOuterBorder(true);
    setShowInnerBorder(true);
    setBorderColor('#e8e8e8');
    setBorderStyle('solid');
    setOuterBorderWidth('1px');
    setInnerBorderWidth('1px');
    setInnerBorderColor(undefined);
    setInnerBorderStyle('solid');
    setHeaderBgColor(undefined);
    setCellBgColor(undefined);
    setStripeRow(false);
    setOddRowBgColor('#ffffff');
    setEvenRowBgColor('#fafafa');
    setHeaderGroups([]);
    setFixedHeader(true);
    setCellAutoWrap(false);
    setMergeField(undefined);
    setMergeBgColor('#e6f7ff');
    setColumnOrder([]);
    setFieldLinks({});
    setChartId('');
    setChartName('');
    setChartDescription('');
    setShowDescription(false);
    setDescPosition('bottom');
    setDescAlign('left');
    setDescFontSize(13);
    setDescFontFamily('');
    setDescFontColor('#333333');
    setDescBold(false);
    setDescItalic(false);
    setDescBgColor('#f0f5ff');
    setDescBorderColor('#1890ff');
    setDescLineHeight(1.6);
    setDataPermission(false);
    setMatchField(undefined);
    setDepartmentField(undefined);
    setSortOrder(0);
    setSaving(false);
    setCategoryId(undefined);
    setDrilldownEnabled(false);
    setDrilldownTargetChartId(undefined);
    setDrilldownFields([]);
    setDrilldownFieldMappings({});
    setAnalysisTemplate('');
    setAnalysisConfig(null);
    setShowAnalysis(false);
    // 重置富文本配置
    setRichTextContent('');
    setRichTextBgColor(undefined);
    setRichTextPadding(16);
    setRichTextFontSize(14);
    setRichTextAlign('left');
    setRichTextFontColor('rgba(51,51,51,1)');
    setRichTextLineHeight(1.8);
    setRichTextBorderRadius(8);
    // 重置合计行样式
    setSummaryRowCustomStyle(false);
    setSummaryFontColor('#1890ff');
    setSummaryBgColor('#fafafa');
    setSummaryBold(true);
    setSummaryAlign('left');
    setSummaryFontSize(14);
    setSummaryItalic(false);
    setSummaryFixed(false);
    // 重置分类相关
    setCategoryParentId(undefined);
    setEditingCategoryId(null);
  };

  const handleNewChart = () => {
    resetWizard();
    setWizardMode(true);
  };

  const handleEditChart = async (record) => {
    resetWizard();
    setEditingChart(record);

    const dsId = record.data_source_id;
    setSelectedDsId(dsId);
    setQuerySql(record.query_sql || '');
    setChartType(record.chart_type || 'bar');
    setChartId(record.chart_id || '');
    setChartName(record.name || '');
    setChartDescription(record.description || '');
    // 先获取 styleConfig，如果是字符串则解析为对象
    let styleConfig = record.styleConfig || record.style_config || {};
    if (typeof styleConfig === 'string') {
      try { styleConfig = JSON.parse(styleConfig); } catch { styleConfig = {}; }
    }
    setShowDescription(styleConfig.showDescription || false);
    setDescPosition(styleConfig.descPosition || 'bottom');
    setDescAlign(styleConfig.descAlign || 'left');
    setDescFontSize(styleConfig.descFontSize || 13);
    setDescFontFamily(styleConfig.descFontFamily || '');
    setDescFontColor(styleConfig.descFontColor || '#333333');
    setDescBold(styleConfig.descBold || false);
    setDescItalic(styleConfig.descItalic || false);
    setDescBgColor(styleConfig.descBgColor || '#f0f5ff');
    setDescBorderColor(styleConfig.descBorderColor || '#1890ff');
    setDescLineHeight(styleConfig.descLineHeight || 1.6);
    setDataPermission(!!record.data_permission);
    setMatchField(record.match_field || undefined);
    setDepartmentField(record.department_field || undefined);
    setSortOrder(record.sort_order || 0);
    setCategoryId(record.category_id || undefined);

    let fieldsConfig = record.fields_config;
    if (typeof fieldsConfig === 'string') {
      try { fieldsConfig = JSON.parse(fieldsConfig); } catch { fieldsConfig = []; }
    }

    // styleConfig 已在上方解析，无需重复声明

    const summaryFieldsList = styleConfig?.summaryFields || [];

    if (Array.isArray(fieldsConfig)) {
      setFields(fieldsConfig.map(f => ({
        ...f,
        summary: f.summary !== undefined ? f.summary : summaryFieldsList.includes(f.name),
      })));
    }
    if (styleConfig) {
      setChartTitle(styleConfig.title || '');
      setShowTitle(styleConfig.showTitle !== undefined ? styleConfig.showTitle : true);
      setColorScheme(styleConfig.colorScheme || 'default');
      setLegendPosition(styleConfig.legendPosition || 'top');
      setShowDataLabels(!!styleConfig.showDataLabels);
      setChartBgColor(styleConfig.chartBgColor || undefined);
      setTitleColor(styleConfig.titleColor || 'rgba(24,144,255,1)');
      setTitleAlign(styleConfig.titleAlign || 'left');
      setShowGridLine(styleConfig.showGridLine !== undefined ? styleConfig.showGridLine : true);
      setGridLineColor(styleConfig.gridLineColor || 'rgba(200,200,200,0.3)');
      setAxisLabelColor(styleConfig.axisLabelColor || 'rgba(89,89,89,1)');
      setAxisLabelFontSize(styleConfig.axisLabelFontSize || 12);
      setLegendFontSize(styleConfig.legendFontSize || 12);
      setXField(styleConfig.xField || undefined);
      setYFields(styleConfig.yFields || []);
      setGroupField(styleConfig.groupField || undefined);
      setHeaderAlign(styleConfig.headerAlign || 'center');
      setHeaderFontSize(styleConfig.headerFontSize || 14);
      setHeaderBold(styleConfig.headerBold !== undefined ? styleConfig.headerBold : true);
      setHeaderItalic(styleConfig.headerItalic || false);
      setCellAlign(styleConfig.cellAlign || 'left');
      setCellFontSize(styleConfig.cellFontSize || 13);
      setTitleFontSize(styleConfig.titleFontSize || 16);
      setTitleBold(styleConfig.titleBold !== undefined ? styleConfig.titleBold : true);
      setDefaultSortField(styleConfig.defaultSortField || undefined);
      setDefaultSortOrder(styleConfig.defaultSortOrder || 'none');
      setConditionalFormats(styleConfig.conditionalFormats || []);
      setFixedLeftColumns(styleConfig.fixedLeftColumns || 0);
      setFixedRightColumns(styleConfig.fixedRightColumns || 0);
      setHeaderAutoWrap(!!styleConfig.headerAutoWrap);
      setColumnWidths(styleConfig.columnWidths || {});
      setHeaderFontColor(styleConfig.headerFontColor || undefined);
      setCellFontColor(styleConfig.cellFontColor || undefined);
      if (styleConfig.showOuterBorder !== undefined) {
        setShowOuterBorder(styleConfig.showOuterBorder);
      } else if (styleConfig.showBorder !== undefined) {
        setShowOuterBorder(styleConfig.showBorder);
      } else {
        setShowOuterBorder(true);
      }
      if (styleConfig.showInnerBorder !== undefined) {
        setShowInnerBorder(styleConfig.showInnerBorder);
      } else if (styleConfig.showBorder !== undefined) {
        setShowInnerBorder(styleConfig.showBorder);
      } else {
        setShowInnerBorder(true);
      }
      setBorderColor(styleConfig.borderColor || '#e8e8e8');
      setBorderStyle(styleConfig.borderStyle || 'solid');
      setOuterBorderWidth(styleConfig.outerBorderWidth || '1px');
      setInnerBorderWidth(styleConfig.innerBorderWidth || '1px');
      setInnerBorderColor(styleConfig.innerBorderColor || undefined);
      setInnerBorderStyle(styleConfig.innerBorderStyle || 'solid');
      setHeaderBgColor(styleConfig.headerBgColor || undefined);
      setCellBgColor(styleConfig.cellBgColor || undefined);
      setStripeRow(!!styleConfig.stripeRow);
      setOddRowBgColor(styleConfig.oddRowBgColor || '#ffffff');
      setEvenRowBgColor(styleConfig.evenRowBgColor || '#fafafa');
      setHeaderGroups(migrateHeaderGroups(styleConfig.headerGroups || []));
      setFixedHeader(styleConfig.fixedHeader !== false);
      setCellAutoWrap(!!styleConfig.cellAutoWrap);
      if (styleConfig.mergeField !== undefined) {
        setMergeField(styleConfig.mergeField);
      } else if (styleConfig.cellMergeFields && styleConfig.cellMergeFields.length > 0) {
        setMergeField(styleConfig.cellMergeFields[0]);
      } else {
        setMergeField(undefined);
      }
      setMergeBgColor(styleConfig.mergeBgColor || '#e6f7ff');
      setColumnOrder(styleConfig.columnOrder || []);
      setFieldLinks(styleConfig.fieldLinks || {});
      setSummaryRowCustomStyle(!!styleConfig.summaryRowCustomStyle);
      setSummaryFontColor(styleConfig.summaryFontColor || '#1890ff');
      setSummaryBgColor(styleConfig.summaryBgColor || '#fafafa');
      setSummaryBold(styleConfig.summaryBold !== undefined ? styleConfig.summaryBold : true);
      setSummaryAlign(styleConfig.summaryAlign || 'left');
      setSummaryFontSize(styleConfig.summaryFontSize || 14);
      setSummaryItalic(!!styleConfig.summaryItalic);
      setSummaryFixed(!!styleConfig.summaryFixed);
      setDateLinkageEnabled(!!styleConfig.dateLinkageEnabled);
      setDateLinkageField(styleConfig.dateLinkageField || undefined);
      setDateLinkageRange(styleConfig.dateLinkageRange || 'today');
      setDateLinkageStartDate(styleConfig.dateLinkageStartDate || undefined);
      setDateLinkageEndDate(styleConfig.dateLinkageEndDate || undefined);
      const dd = styleConfig.drilldown || {};
      setDrilldownEnabled(!!dd.enabled);
      setDrilldownTargetChartId(dd.targetChartId || undefined);
      // 兼容旧的 sourceField/targetField/dimensionField 格式
      setDrilldownFields(dd.drilldownFields || (dd.sourceField ? [dd.sourceField] : (dd.dimensionField ? [dd.dimensionField] : [])));
      setDrilldownFieldMappings(dd.fieldMappings || (dd.sourceField && dd.targetField && dd.sourceField !== dd.targetField ? { [dd.sourceField]: dd.targetField } : {}));
      setAnalysisTemplate(styleConfig.analysisTemplate || record.analysis_template || '');
      setAnalysisConfig(styleConfig.analysisConfig || record.analysis_config || null);
      setShowAnalysis(styleConfig.showAnalysis || false);
      // 读取富文本配置
      setRichTextContent(styleConfig.richTextContent || '');
      setRichTextBgColor(styleConfig.richTextBgColor || undefined);
      setRichTextPadding(styleConfig.richTextPadding || 16);
      setRichTextFontSize(styleConfig.richTextFontSize || 14);
      setRichTextAlign(styleConfig.richTextAlign || 'left');
      setRichTextFontColor(styleConfig.richTextFontColor || 'rgba(51,51,51,1)');
      setRichTextLineHeight(styleConfig.richTextLineHeight || 1.8);
      setRichTextBorderRadius(styleConfig.richTextBorderRadius || 8);
    }

    if (dsId) {
      try {
        const tablesRes = await chartDesignerService.getDsTables(dsId);
        const tablesData = tablesRes.data || tablesRes;
        setDsTables(Array.isArray(tablesData) ? tablesData : []);

        // 从 query_sql 中解析表名并回填 selectedTable
        const sqlStr = record.query_sql || '';
        const fromMatch = sqlStr.match(/FROM\s+(\w+)/i);
        if (fromMatch && fromMatch[1]) {
          const tableName = fromMatch[1];
          setSelectedTable(tableName);
          // 加载字段列表
          try {
            const colsRes = await chartDesignerService.getDsColumns(dsId, tableName);
            const colsData = colsRes.data || colsRes;
            const cols = Array.isArray(colsData) ? colsData : [];
            setDsColumns(cols);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    try {
      const previewRes = await chartDesignerService.previewChartData({
        data_source_id: dsId,
        query_sql: record.query_sql,
      });
      const pData = previewRes.data || previewRes;
      if (Array.isArray(pData) && pData.length > 0) {
        setPreviewData(pData);
        const cols = Object.keys(pData[0]).map((key) => ({
          title: key,
          dataIndex: key,
          key,
          ellipsis: true,
        }));
        setPreviewColumns(cols);
      }
    } catch { /* ignore */ }

    setWizardMode(true);
    setCurrentStep(0);
  };

  const handleDeleteChart = async (record) => {
    try {
      await chartDesignerService.deleteChart(record.id);
      message.success('删除图表成功');
      fetchCharts();
    } catch (error) {
      message.error('删除图表失败');
    }
  };

  // 处理图表上移/下移
  const handleMoveChart = async (chart, direction, index) => {
    try {
      // 获取当前过滤后的图表列表
      const siblings = filteredCharts;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) {
        message.warning(direction === 'up' ? '已是第一个' : '已是最后一个');
        return;
      }
      const targetChart = siblings[targetIndex];
      // 使用 chart_id（字符串标识）和索引值排序
      const items = [
        { chart_id: chart.chart_id, sort_order: targetIndex },
        { chart_id: targetChart.chart_id, sort_order: index },
      ];
      await chartDesignerService.updateSortOrder(items);
      message.success('排序已更新');
      // 刷新图表列表
      fetchCharts();
    } catch (err) {
      message.error('排序失败');
    }
  };

  // 复制图表
  const handleCopyChart = async (chartId) => {
    try {
      await chartDesignerService.copyChart(chartId);
      message.success('图表复制成功');
      fetchCharts();
    } catch (error) {
      message.error('图表复制失败');
    }
  };

  // 分类管理：检查分类是否有子分类或关联图表
  const hasCategoryChildren = (cat) => {
    if (cat.children && cat.children.length > 0) return true;
    return charts.some(c => c.category_id === cat.id);
  };

  // 递归检查分类及其子分类是否有关联图表
  const hasCategoryCharts = (cat) => {
    if (charts.some(c => c.category_id === cat.id)) return true;
    if (cat.children && cat.children.length > 0) {
      return cat.children.some(child => hasCategoryCharts(child));
    }
    return false;
  };

  const handleDeleteCategory = async (cat) => {
    if (hasCategoryCharts(cat)) {
      message.warning('该分类下有关联图表，无法删除');
      return;
    }
    if (cat.children && cat.children.length > 0) {
      message.warning('该分类下有子分类，无法删除');
      return;
    }
    try {
      await chartCategoryService.deleteCategory(cat.id);
      message.success('分类删除成功');
      fetchCategories();
    } catch {
      message.error('删除分类失败');
    }
  };

  // 在分类管理弹窗中处理分类上移/下移
  const handleMoveCategoryInModal = async (category, direction) => {
    try {
      // 找到同级分类列表
      const findSiblings = (cats, parentId) => {
        if (parentId === null || parentId === undefined) {
          return cats.filter(c => !c.parentId);
        }
        for (const cat of cats) {
          if (cat.id === parentId) return cat.children || [];
          if (cat.children) {
            const found = findSiblings(cat.children, parentId);
            if (found.length > 0) return found;
          }
        }
        return [];
      };
      const siblings = findSiblings(categories, category.parentId);
      const currentIndex = siblings.findIndex(c => c.id === category.id);
      if (currentIndex === -1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) {
        message.warning(direction === 'up' ? '已是第一个' : '已是最后一个');
        return;
      }

      const targetCategory = siblings[targetIndex];
      const items = [
        { id: category.id, sort_order: targetCategory.sortOrder },
        { id: targetCategory.id, sort_order: category.sortOrder },
      ];
      await chartCategoryService.updateSortOrder(items);
      message.success('排序已更新');
      // 刷新分类数据
      fetchCategories();
    } catch (err) {
      message.error('排序失败');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      message.warning('请输入分类名称');
      return;
    }
    try {
      if (editingCategoryId) {
        await chartCategoryService.updateCategory(editingCategoryId, {
          name: categoryName.trim(),
          parent_id: categoryParentId || null,
        });
        message.success('分类更新成功');
      } else {
        await chartCategoryService.createCategory({
          name: categoryName.trim(),
          parent_id: categoryParentId || null,
        });
        message.success('分类创建成功');
      }
      setCategoryName('');
      setCategoryParentId(undefined);
      setEditingCategoryId(null);
      fetchCategories();
    } catch {
      message.error('保存分类失败');
    }
  };

  const handleDsChange = async (dsId) => {
    setSelectedDsId(dsId);
    setSelectedTable(undefined);
    setDsTables([]);
    setDsColumns([]);

    if (!editingChart) {
      setQuerySql('');
      setPreviewData([]);
      setPreviewColumns([]);
      setFields([]);
    }

    if (!dsId) return;

    try {
      const res = await chartDesignerService.getDsTables(dsId);
      const data = res.data || res;
      setDsTables(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error('获取数据源表列表失败');
    }
  };

  const handleTableChange = async (tableName) => {
    setSelectedTable(tableName);

    if (!editingChart) {
      setPreviewData([]);
      setPreviewColumns([]);
      setFields([]);
    }

    if (!tableName || !selectedDsId) {
      if (!editingChart) {
        setQuerySql('');
      }
      return;
    }

    const autoSql = `SELECT * FROM ${tableName}`;
    if (!editingChart) {
      setQuerySql(autoSql);
    }

    try {
      const res = await chartDesignerService.getDsColumns(selectedDsId, tableName);
      const data = res.data || res;
      const cols = Array.isArray(data) ? data : [];
      setDsColumns(cols);
      if (!editingChart) {
        setFields(
          cols.map((col) => {
            const colName = col.name || col.column_name || col.field || col;
            const colType = col.type || '';
            const isDateByType = /date|datetime|timestamp/i.test(colType);
            const isDateByName = /日期|date|time|时间/i.test(colName) || colName.toLowerCase().endsWith('_at') || colName.toLowerCase().endsWith('_time') || colName.toLowerCase().endsWith('_date');
            return {
              name: colName,
              label: colName,
              type: isDateByType || isDateByName ? 'date' : 'dimension',
              visible: true,
              filterable: true,
              isComputed: false,
              summary: false,
            };
          })
        );
      }
    } catch (error) {
      message.error('获取表字段列表失败');
    }
  };

  const handleFetchSqlColumns = async () => {
    if (!selectedDsId || !querySql.trim()) {
      message.warning('请先选择数据源并输入SQL语句');
      return;
    }
    try {
      const res = await chartDesignerService.getSqlColumns(selectedDsId, querySql.trim());
      const data = res.data || res;
      const cols = Array.isArray(data) ? data : [];
      setDsColumns(cols);
      const sqlFieldNames = cols.map((col) => col.name || col.column_name || col.field || col);
      const existingFieldMap = {};
      fields.forEach(f => { existingFieldMap[f.name] = f; });
      const computedFields = fields.filter(f => f.isComputed);
      setFields([
        ...sqlFieldNames.map((colName) => {
          if (existingFieldMap[colName]) {
            return existingFieldMap[colName];
          }
          const colType = (cols.find(c => (c.name || c.column_name || c.field || c) === colName) || {}).type || '';
          const isDateByType = /date|datetime|timestamp/i.test(colType);
          const isDateByName = /日期|date|time|时间/i.test(colName) || colName.toLowerCase().endsWith('_at') || colName.toLowerCase().endsWith('_time') || colName.toLowerCase().endsWith('_date');
          return {
            name: colName,
            label: colName,
            type: isDateByType || isDateByName ? 'date' : 'dimension',
            visible: true,
            filterable: true,
            isComputed: false,
            summary: false,
          };
        }),
        ...computedFields,
      ]);
      message.success(`已获取 ${cols.length} 个字段`);
    } catch (error) {
      message.error('获取SQL字段列表失败，请检查SQL语句');
    }
  };

  const handlePreviewData = async () => {
    if (!selectedDsId || !querySql.trim()) {
      message.warning('请先选择数据源并输入查询SQL');
      return;
    }
    setPreviewLoading(true);
    setPreviewData([]);
    setPreviewColumns([]);
    try {
      const res = await chartDesignerService.previewChartData({
        data_source_id: selectedDsId,
        query_sql: querySql,
      });
      const data = res.data || res;
      if (Array.isArray(data) && data.length > 0) {
        const computedFields = fields.filter(f => f.isComputed && f.expression);
        let processedData = data;
        if (computedFields.length > 0) {
          processedData = data.map(row => {
            const newRow = { ...row };
            computedFields.forEach(cf => {
              try {
                const context = {};
                Object.keys(row).forEach(key => {
                  const val = row[key];
                  if (typeof val === 'number') {
                    context[key] = val;
                  } else if (val !== null && val !== undefined) {
                    const num = Number(val);
                    context[key] = isNaN(num) ? 0 : num;
                  } else {
                    context[key] = 0;
                  }
                });
                newRow[cf.name] = safeEval(cf.expression, context);
              } catch (e) {
                newRow[cf.name] = null;
              }
            });
            return newRow;
          });
        }
        setPreviewData(processedData);
        const cols = Object.keys(processedData[0]).map((key) => ({
          title: key,
          dataIndex: key,
          key,
          ellipsis: true,
        }));
        setPreviewColumns(cols);

        const sqlFieldNames = Object.keys(processedData[0]);
        const existingFieldMap = {};
        fields.forEach(f => { existingFieldMap[f.name] = f; });
        const datePattern = /^\d{4}-\d{2}-\d{2}/;
        setFields(
          sqlFieldNames.map((key) => {
            if (existingFieldMap[key]) {
              return existingFieldMap[key];
            }
            const sampleValues = processedData.slice(0, 10);
            const isDateByName = /日期|date|time|时间/i.test(key) || key.toLowerCase().endsWith('_at') || key.toLowerCase().endsWith('_time') || key.toLowerCase().endsWith('_date');
            const nonEmptyValues = sampleValues.map(row => String(row[key] || '')).filter(v => v.trim() !== '');
            const isDateByValue = nonEmptyValues.length > 0 && nonEmptyValues.filter(v => datePattern.test(v)).length / nonEmptyValues.length > 0.5;
            return {
              name: key,
              label: key,
              type: isDateByName || isDateByValue ? 'date' : 'dimension',
              visible: true,
              filterable: true,
              isComputed: false,
              summary: false,
            };
          })
        );
      } else {
        setPreviewData([]);
        setPreviewColumns([]);
        message.info('查询结果为空');
      }
    } catch (error) {
      message.error('预览数据失败，请检查SQL语句');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFieldChange = (index, key, value) => {
    setFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const handleRemoveField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCalcField = () => {
    setCalcFieldName('');
    setCalcFieldExpr('');
    setEditingCalcFieldIndex(-1);
    setCalcFieldModalVisible(true);
  };

  const handleEditCalcField = (index) => {
    const field = fields[index];
    setCalcFieldName(field.name);
    setCalcFieldExpr(field.expression || '');
    setEditingCalcFieldIndex(index);
    setCalcFieldModalVisible(true);
  };

  const handleCalcFieldOk = () => {
    if (!calcFieldName.trim()) {
      message.warning('请输入字段名称');
      return;
    }
    if (!calcFieldExpr.trim()) {
      message.warning('请输入计算表达式');
      return;
    }

    const newField = {
      name: calcFieldName.trim(),
      label: calcFieldName.trim(),
      type: 'measure',
      visible: true,
      isComputed: true,
      expression: calcFieldExpr.trim(),
    };

    if (editingCalcFieldIndex >= 0) {
      setFields((prev) => {
        const updated = [...prev];
        updated[editingCalcFieldIndex] = newField;
        return updated;
      });
    } else {
      setFields((prev) => [...prev, newField]);
    }

    setCalcFieldModalVisible(false);
    setCalcFieldName('');
    setCalcFieldExpr('');
    setEditingCalcFieldIndex(-1);
  };

  const getEchartsOption = useCallback(() => {
    if (chartType === 'rich_text') return {};
    if (!previewData.length || !xField) return {};

    const colors = COLOR_MAP[colorScheme] || COLOR_MAP.default;
    const xData = previewData.map((row) => row[xField]);

    if (chartType === 'table') {
      return {};
    }

    if (chartType === 'pie') {
      const yField = yFields[0];
      if (!yField) return {};
      const pieData = previewData.map((row) => ({
        name: row[xField],
        value: row[yField],
      }));
      return {
        backgroundColor: chartBgColor || 'transparent',
        color: colors,
        title: { show: showTitle, text: chartTitle, left: titleAlign, textStyle: { fontSize: titleFontSize || 16, fontWeight: titleBold !== false ? 'bold' : 'normal', color: titleColor } },
        tooltip: { trigger: 'item' },
        legend: legendPosition === 'hidden' ? { show: false } : {
          orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
          [legendPosition]: legendPosition === 'top' || legendPosition === 'bottom' ? 30 : 'center',
          left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
          textStyle: { fontSize: legendFontSize },
        },
        series: [{
          type: 'pie',
          radius: '60%',
          data: pieData,
          label: { show: showDataLabels },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
          },
        }],
      };
    }

    if (chartType === 'double_pie') {
      if (yFields.length < 2) return {};
      const innerData = previewData.map((row) => ({
        name: row[xField],
        value: row[yFields[0]],
      }));
      const outerData = previewData.map((row) => ({
        name: row[xField],
        value: row[yFields[1]],
      }));
      return {
        backgroundColor: chartBgColor || 'transparent',
        color: colors,
        title: { show: showTitle, text: chartTitle, left: titleAlign, textStyle: { fontSize: titleFontSize || 16, fontWeight: titleBold !== false ? 'bold' : 'normal', color: titleColor } },
        tooltip: { trigger: 'item' },
        legend: legendPosition === 'hidden' ? { show: false } : {
          orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
          [legendPosition]: legendPosition === 'top' || legendPosition === 'bottom' ? 30 : 'center',
          left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
          textStyle: { fontSize: legendFontSize },
        },
        series: [
          {
            type: 'pie',
            radius: ['0%', '40%'],
            data: innerData,
            label: { show: showDataLabels, position: 'inside' },
            name: yFields[0],
          },
          {
            type: 'pie',
            radius: ['50%', '70%'],
            data: outerData,
            label: { show: showDataLabels },
            name: yFields[1],
          },
        ],
      };
    }

    if (chartType === 'radar') {
      const indicator = xData.map((name) => ({ name, max: undefined }));
      const seriesData = yFields.map((yf) => {
        const values = previewData.map((row) => {
          const v = Number(row[yf]);
          return isNaN(v) ? 0 : v;
        });
        return { value: values, name: yf };
      });
      return {
        backgroundColor: chartBgColor || 'transparent',
        color: colors,
        title: { show: showTitle, text: chartTitle, left: titleAlign, textStyle: { fontSize: titleFontSize || 16, fontWeight: titleBold !== false ? 'bold' : 'normal', color: titleColor } },
        tooltip: {},
        legend: legendPosition === 'hidden' ? { show: false } : {
          orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
          [legendPosition]: legendPosition === 'top' || legendPosition === 'bottom' ? 30 : 'center',
          left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
          textStyle: { fontSize: legendFontSize },
        },
        radar: {
          indicator,
          splitLine: { show: showGridLine, lineStyle: { color: gridLineColor } },
          axisLine: { lineStyle: { color: gridLineColor } },
          axisName: { color: axisLabelColor, fontSize: axisLabelFontSize },
        },
        series: [{ type: 'radar', data: seriesData }],
      };
    }

    const isArea = chartType === 'area';
    const isStacked = chartType === 'stacked_bar';
    const isDoubleLine = chartType === 'double_line';

    const series = yFields.map((yf) => {
      const yData = previewData.map((row) => {
        const v = Number(row[yf]);
        return isNaN(v) ? 0 : v;
      });
      const baseType = (chartType === 'multi_bar' || chartType === 'stacked_bar') ? 'bar'
        : (isArea || isDoubleLine) ? 'line' : chartType;
      return {
        name: yf,
        type: baseType,
        data: yData,
        areaStyle: isArea ? {} : undefined,
        stack: isStacked ? 'total' : undefined,
        label: { show: showDataLabels },
      };
    });

    return {
      backgroundColor: chartBgColor,
      color: colors,
      title: { show: showTitle, text: chartTitle, left: titleAlign, textStyle: { fontSize: titleFontSize || 16, fontWeight: titleBold !== false ? 'bold' : 'normal', color: titleColor } },
      tooltip: { trigger: 'axis' },
      legend: legendPosition === 'hidden' ? { show: false } : {
        orient: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
        [legendPosition]: legendPosition === 'top' || legendPosition === 'bottom' ? 30 : 'center',
        left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
        textStyle: { fontSize: legendFontSize },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xData,
        boundaryGap: chartType === 'bar' || chartType === 'multi_bar' || chartType === 'stacked_bar',
        axisLabel: { color: axisLabelColor, fontSize: axisLabelFontSize },
        splitLine: { show: showGridLine, lineStyle: { color: gridLineColor } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: axisLabelColor, fontSize: axisLabelFontSize },
        splitLine: { show: showGridLine, lineStyle: { color: gridLineColor } },
      },
      series,
    };
  }, [previewData, xField, yFields, chartType, chartTitle, showTitle, colorScheme, legendPosition, showDataLabels, titleFontSize, titleBold, chartBgColor, titleColor, titleAlign, showGridLine, gridLineColor, axisLabelColor, axisLabelFontSize, legendFontSize]);

  const handleSave = async () => {
    if (!chartId.trim()) {
      message.warning('请输入图表标识');
      return;
    }
    if (!chartName.trim()) {
      message.warning('请输入图表名称');
      return;
    }
    // 富文本类型豁免数据源和SQL校验
    if (chartType !== 'rich_text') {
      if (!selectedDsId) {
        message.warning('请选择数据源');
        return;
      }
      if (!querySql.trim()) {
        message.warning('请输入查询SQL');
        return;
      }
    }

    setSaving(true);
    try {
      const submitData = {
        chart_id: chartId.trim(),
        name: chartName.trim(),
        description: chartDescription === '<p><br></p>' ? '' : chartDescription,
        icon: (() => {
          const ct = CHART_TYPES.find((t) => t.value === chartType);
          if (!ct) return 'BarChartOutlined';
          const iconMap = {
            line: 'LineChartOutlined',
            bar: 'BarChartOutlined',
            pie: 'PieChartOutlined',
            scatter: 'DotChartOutlined',
            radar: 'RadarChartOutlined',
            area: 'AreaChartOutlined',
            table: 'TableOutlined',
            double_line: 'LineChartOutlined',
            double_pie: 'PieChartOutlined',
            multi_bar: 'BarChartOutlined',
            stacked_bar: 'BarChartOutlined',
            rich_text: 'EditOutlined',
            map: 'EnvironmentOutlined',
          };
          return iconMap[chartType] || 'BarChartOutlined';
        })(),
        data_source_id: selectedDsId,
        query_sql: querySql,
        fields_config: fields,  // 保存全部字段（含不可见字段），不可见字段由后端过滤
        chart_type: chartType,
        style_config: {
          title: chartTitle,
          showTitle,
          colorScheme,
          legendPosition,
          showDataLabels,
          chartBgColor: chartBgColor || 'transparent',
          titleColor,
          titleAlign,
          showGridLine,
          gridLineColor,
          axisLabelColor,
          axisLabelFontSize,
          legendFontSize,
          xField,
          yFields,
          groupField,
          headerAlign,
          headerFontSize,
          headerBold,
          headerItalic,
          cellAlign,
          cellFontSize,
          titleFontSize,
          titleBold,
          defaultSortField,
          defaultSortOrder,
          conditionalFormats,
          fixedLeftColumns,
          fixedRightColumns,
          headerAutoWrap,
          columnWidths,
          headerFontColor,
          cellFontColor,
          showOuterBorder,
          showInnerBorder,
          borderColor,
          borderStyle,
          outerBorderWidth,
          innerBorderWidth,
          innerBorderColor: innerBorderColor || undefined,
          innerBorderStyle,
          headerBgColor,
          cellBgColor,
          stripeRow,
          oddRowBgColor,
          evenRowBgColor,
          headerGroups,
          fixedHeader,
          cellAutoWrap,
          mergeField,
          mergeBgColor,
          columnOrder,
          fieldLinks,
          summaryFields: fields.filter((f) => f.summary && f.visible).map((f) => f.name),
          summaryRowCustomStyle,
          summaryFontColor,
          summaryBgColor,
          summaryBold,
          summaryAlign,
          summaryFontSize,
          summaryItalic,
          summaryFixed,
          dateLinkageEnabled,
          dateLinkageField,
          dateLinkageRange,
          dateLinkageStartDate,
          dateLinkageEndDate,
          drilldown: {
            enabled: drilldownEnabled,
            targetChartId: drilldownTargetChartId,
            drilldownFields: drilldownFields,
            fieldMappings: drilldownFieldMappings,
          },
          showDescription: showDescription,
          descPosition: descPosition,
          descAlign: descAlign,
          descFontSize: descFontSize,
          descFontFamily: descFontFamily,
          descFontColor: descFontColor,
          descBold: descBold,
          descItalic: descItalic,
          descBgColor: descBgColor,
          descBorderColor: descBorderColor,
          descLineHeight: descLineHeight,
          analysisTemplate: analysisTemplate === '<p><br></p>' ? '' : analysisTemplate,
          analysisConfig: analysisConfig || undefined,
          showAnalysis,
          // 富文本配置
          richTextContent,
          richTextBgColor: richTextBgColor || 'transparent',
          richTextPadding,
          richTextFontSize,
          richTextAlign,
          richTextFontColor,
          richTextLineHeight,
          richTextBorderRadius,
        },
        analysis_template: (analysisTemplate === '<p><br></p>' ? '' : analysisTemplate) || null,
        analysis_config: analysisConfig || null,
        data_permission: dataPermission ? 1 : 0,
        match_field: matchField || null,
        department_field: departmentField || null,
        sort_order: sortOrder,
        status: 1,
        category_id: categoryId || null,
      };

      if (editingChart) {
        await chartDesignerService.updateChart(editingChart.id, submitData);
        message.success('更新图表成功');
      } else {
        await chartDesignerService.createChart(submitData);
        message.success('创建图表成功');
      }

      setWizardMode(false);
      resetWizard();
      fetchCharts();
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || '保存失败';
      message.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 0:
        // 富文本类型不需要数据源
        if (chartType === 'rich_text') return true;
        return !!selectedDsId;
      case 1:
        // 富文本类型不需要SQL
        if (chartType === 'rich_text') return true;
        return !!querySql.trim();
      case 2:
        return fields.length > 0;
      case 3:
        if (chartType === 'table' || chartType === 'rich_text') return !!chartType;
        return !!chartType && !!xField && yFields.length > 0;
      case 4:
        return !!chartId.trim() && !!chartName.trim();
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && previewData.length === 0 && chartType !== 'rich_text') {
      message.warning('请先预览数据');
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const visibleFields = useMemo(() => fields.filter((f) => f.visible), [fields]);

  const renderStep0 = () => (
    <div className="chart-step-content">
      <Alert
        message="选择数据源"
        description="请选择一个已配置的数据源。可选择数据表快速生成SQL，或跳过直接在下一步手写SQL（支持多表JOIN查询）。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <Form layout="vertical">
        <Form.Item label="数据源" required>
          <Select
            placeholder="请选择数据源"
            value={selectedDsId}
            onChange={handleDsChange}
            options={dataSources.map((ds) => ({
              label: `${ds.name} (${ds.type})`,
              value: ds.id,
            }))}
            style={{ width: '100%' }}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item label="数据表（可选）" extra="选择数据表将自动生成SQL，不选则可在下一步手写SQL">
          <Select
            placeholder={selectedDsId ? '可选择数据表快速生成SQL' : '请先选择数据源'}
            value={selectedTable}
            onChange={handleTableChange}
            options={dsTables.map((t) => {
              const name = typeof t === 'string' ? t : (t.table_name || t.name || t);
              return { label: name, value: name };
            })}
            style={{ width: '100%' }}
            disabled={!selectedDsId}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
      </Form>
    </div>
  );

  const renderStep1 = () => (
    <div className="chart-step-content">
      <Alert
        message="配置查询SQL"
        description={selectedTable ? '系统已根据所选表自动生成SQL，您可以根据需要修改SQL语句。' : '请在下方输入SQL查询语句，支持多表JOIN查询。输入完成后点击「获取字段」解析字段列表，再点击「预览数据」验证查询结果。'}
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <Form layout="vertical">
        <Form.Item label="查询SQL" required>
          <Input.TextArea
            value={querySql}
            onChange={(e) => setQuerySql(e.target.value)}
            rows={6}
            placeholder="请输入SQL查询语句，如：SELECT * FROM table_name 或 SELECT a.*, b.name FROM table_a a JOIN table_b b ON a.id = b.a_id"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              type="default"
              icon={<ColumnWidthOutlined />}
              onClick={handleFetchSqlColumns}
              disabled={!selectedDsId || !querySql.trim()}
            >
              获取字段
            </Button>
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={handlePreviewData}
              loading={previewLoading}
            >
              预览数据
            </Button>
          </Space>
        </Form.Item>
      </Form>
      {previewData.length > 0 && (
        <div className="chart-preview-table">
          <Divider orientation="left">预览结果（前20条）</Divider>
          <Table
            columns={previewColumns.filter(c => !fields.some(f => f.name === c.dataIndex && f.isComputed))}
            dataSource={previewData.slice(0, 20)}
            rowKey={(record) => record.id || JSON.stringify(record)}
            size="small"
            scroll={{ x: 'max-content' }}
            pagination={false}
          />
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="chart-step-content">
      <Alert
        message="字段管理"
        description="管理查询结果中的字段。可以重命名字段、设置字段类型（维度/度量）、控制字段是否可见、是否可筛选。还可以添加计算字段。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="dashed"
            icon={<CalculatorOutlined />}
            onClick={handleAddCalcField}
          >
            添加计算字段
          </Button>
          <Tooltip title="计算字段是通过表达式对已有字段进行运算生成的新字段，如 price * quantity">
            <QuestionCircleOutlined style={{ color: '#999', cursor: 'help' }} />
          </Tooltip>
        </Space>
      </div>
      <Table
        columns={[
          {
            title: '字段名',
            dataIndex: 'name',
            key: 'name',
            width: 180,
            render: (text, record, index) =>
              record.isComputed ? (
                <Space>
                  <Tag color="orange">计算</Tag>
                  <span>{text}</span>
                </Space>
              ) : (
                text
              ),
          },
          {
            title: '显示名称',
            dataIndex: 'label',
            key: 'label',
            width: 180,
            render: (text, record, index) => (
              <Input
                value={text}
                onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                size="small"
              />
            ),
          },
          {
            title: <LabelWithTip label="字段类型" tip="维度用于分类和分组（如部门），度量用于数值计算（如金额），日期用于时间字段" />,
            dataIndex: 'type',
            key: 'type',
            width: 140,
            render: (text, record, index) => (
              <Select
                value={text}
                onChange={(val) => handleFieldChange(index, 'type', val)}
                size="small"
                style={{ width: 120 }}
                options={[
                  { label: '维度', value: 'dimension' },
                  { label: '度量', value: 'measure' },
                  { label: '日期', value: 'date' },
                ]}
              />
            ),
          },
          {
            title: '可见',
            dataIndex: 'visible',
            key: 'visible',
            width: 80,
            render: (text, record, index) => (
              <Switch
                checked={text}
                onChange={(val) => handleFieldChange(index, 'visible', val)}
                size="small"
              />
            ),
          },
          {
            title: <LabelWithTip label="可筛选" tip="勾选后该字段在图表查看页显示筛选条件，取消则不显示" />,
            dataIndex: 'filterable',
            key: 'filterable',
            width: 80,
            render: (text, record, index) => (
              <Switch
                checked={text !== false}
                onChange={(val) => handleFieldChange(index, 'filterable', val)}
                size="small"
              />
            ),
          },
          {
            title: <LabelWithTip label="汇总" tip="开启后，表格最后一行显示该字段的合计值（仅数值类型有效）" />,
            dataIndex: 'summary',
            key: 'summary',
            width: 80,
            render: (text, record, index) => (
              <Switch
                checked={!!text}
                onChange={(val) => handleFieldChange(index, 'summary', val)}
                size="small"
              />
            ),
          },
          ...(fields.some(f => f.isComputed) ? [{
            title: '操作',
            key: 'action',
            width: 120,
            render: (_, record, index) => (
              <Space size="small">
                {record.isComputed && (
                  <Tooltip title="编辑计算字段">
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditCalcField(index)}
                    />
                  </Tooltip>
                )}
                {record.isComputed && (
                  <Tooltip title="删除字段">
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveField(index)}
                    />
                  </Tooltip>
                )}
              </Space>
            ),
          }] : []),
        ]}
        dataSource={fields}
        rowKey={(record) => record.name || record.key || JSON.stringify(record)}
        size="small"
        pagination={false}
      />

      <Modal
        title={editingCalcFieldIndex >= 0 ? '编辑计算字段' : '添加计算字段'}
        open={calcFieldModalVisible}
        onOk={handleCalcFieldOk}
        onCancel={() => setCalcFieldModalVisible(false)}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="字段名称" required>
            <Input
              value={calcFieldName}
              onChange={(e) => setCalcFieldName(e.target.value)}
              placeholder="请输入计算字段名称"
            />
          </Form.Item>
          <Form.Item label="计算表达式" required>
            <Input.TextArea
              value={calcFieldExpr}
              onChange={(e) => setCalcFieldExpr(e.target.value)}
              rows={4}
              placeholder="请输入计算表达式，如：price * quantity"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const renderStep3 = () => (
    <div className="chart-step-content">
      <Alert
        message="图表配置"
        description="选择图表类型，配置X轴、Y轴字段和样式选项。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <div className="chart-type-selector">
        <div className="chart-type-label">图表类型</div>
        <Row gutter={[12, 12]}>
          {CHART_TYPES.map((ct) => (
            <Col key={ct.value} xs={8} sm={4}>
              <Tooltip title={ct.disabled ? '即将推出，敬请期待' : ct.label}>
                <div
                  className={`chart-type-card ${chartType === ct.value ? 'active' : ''} ${ct.disabled ? 'disabled' : ''}`}
                  onClick={() => !ct.disabled && setChartType(ct.value)}
                  style={ct.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                >
                  <div className="chart-type-icon">{ct.icon}</div>
                  <div className="chart-type-name">{ct.label}</div>
                </div>
              </Tooltip>
            </Col>
          ))}
        </Row>
      </div>

      <Divider />

      <Form layout="vertical">
        {chartType !== 'table' && chartType !== 'rich_text' && (
          <ChartFieldConfig
            chartType={chartType}
            xField={xField}
            yFields={yFields}
            groupField={groupField}
            visibleFields={visibleFields}
            onXFieldChange={setXField}
            onYFieldsChange={setYFields}
            onGroupFieldChange={setGroupField}
          />
        )}
        {chartType === 'table' && (
          <Alert
            message="表格类型无需配置X/Y轴字段"
            description="表格类型将以数据列表形式展示所有字段，直接进入下一步即可。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <ChartStyleConfig
          chartType={chartType}
          visibleFields={visibleFields}
          fields={fields}
          chartTitle={chartTitle} setChartTitle={setChartTitle}
          showTitle={showTitle} setShowTitle={setShowTitle}
          colorScheme={colorScheme} setColorScheme={setColorScheme}
          legendPosition={legendPosition} setLegendPosition={setLegendPosition}
          showDataLabels={showDataLabels} setShowDataLabels={setShowDataLabels}
          chartBgColor={chartBgColor} setChartBgColor={setChartBgColor}
          titleColor={titleColor} setTitleColor={setTitleColor}
          titleAlign={titleAlign} setTitleAlign={setTitleAlign}
          titleFontSize={titleFontSize} setTitleFontSize={setTitleFontSize}
          titleBold={titleBold} setTitleBold={setTitleBold}
          showGridLine={showGridLine} setShowGridLine={setShowGridLine}
          gridLineColor={gridLineColor} setGridLineColor={setGridLineColor}
          axisLabelColor={axisLabelColor} setAxisLabelColor={setAxisLabelColor}
          axisLabelFontSize={axisLabelFontSize} setAxisLabelFontSize={setAxisLabelFontSize}
          legendFontSize={legendFontSize} setLegendFontSize={setLegendFontSize}
          headerAlign={headerAlign} setHeaderAlign={setHeaderAlign}
          headerFontSize={headerFontSize} setHeaderFontSize={setHeaderFontSize}
          headerBold={headerBold} setHeaderBold={setHeaderBold}
          headerItalic={headerItalic} setHeaderItalic={setHeaderItalic}
          cellAlign={cellAlign} setCellAlign={setCellAlign}
          cellFontSize={cellFontSize} setCellFontSize={setCellFontSize}
          defaultSortField={defaultSortField} setDefaultSortField={setDefaultSortField}
          defaultSortOrder={defaultSortOrder} setDefaultSortOrder={setDefaultSortOrder}
          showOuterBorder={showOuterBorder} setShowOuterBorder={setShowOuterBorder}
          showInnerBorder={showInnerBorder} setShowInnerBorder={setShowInnerBorder}
          borderColor={borderColor} setBorderColor={setBorderColor}
          borderStyle={borderStyle} setBorderStyle={setBorderStyle}
          outerBorderWidth={outerBorderWidth} setOuterBorderWidth={setOuterBorderWidth}
          innerBorderWidth={innerBorderWidth} setInnerBorderWidth={setInnerBorderWidth}
          innerBorderColor={innerBorderColor} setInnerBorderColor={setInnerBorderColor}
          innerBorderStyle={innerBorderStyle} setInnerBorderStyle={setInnerBorderStyle}
          stripeRow={stripeRow} setStripeRow={setStripeRow}
          oddRowBgColor={oddRowBgColor} setOddRowBgColor={setOddRowBgColor}
          evenRowBgColor={evenRowBgColor} setEvenRowBgColor={setEvenRowBgColor}
          fixedLeftColumns={fixedLeftColumns} setFixedLeftColumns={setFixedLeftColumns}
          fixedRightColumns={fixedRightColumns} setFixedRightColumns={setFixedRightColumns}
          fixedHeader={fixedHeader} setFixedHeader={setFixedHeader}
          headerAutoWrap={headerAutoWrap} setHeaderAutoWrap={setHeaderAutoWrap}
          cellAutoWrap={cellAutoWrap} setCellAutoWrap={setCellAutoWrap}
          columnWidths={columnWidths} setColumnWidths={setColumnWidths}
          columnOrder={columnOrder} setColumnOrder={setColumnOrder}
          fieldsState={fields} setFields={setFields}
          headerFontColor={headerFontColor} setHeaderFontColor={setHeaderFontColor}
          cellFontColor={cellFontColor} setCellFontColor={setCellFontColor}
          headerBgColor={headerBgColor} setHeaderBgColor={setHeaderBgColor}
          cellBgColor={cellBgColor} setCellBgColor={setCellBgColor}
          conditionalFormats={conditionalFormats} setConditionalFormats={setConditionalFormats}
          headerGroups={headerGroups} setHeaderGroups={setHeaderGroups}
          mergeField={mergeField} setMergeField={setMergeField}
          mergeBgColor={mergeBgColor} setMergeBgColor={setMergeBgColor}
          summaryRowCustomStyle={summaryRowCustomStyle} setSummaryRowCustomStyle={setSummaryRowCustomStyle}
          summaryFontColor={summaryFontColor} setSummaryFontColor={setSummaryFontColor}
          summaryBgColor={summaryBgColor} setSummaryBgColor={setSummaryBgColor}
          summaryBold={summaryBold} setSummaryBold={setSummaryBold}
          summaryAlign={summaryAlign} setSummaryAlign={setSummaryAlign}
          summaryFontSize={summaryFontSize} setSummaryFontSize={setSummaryFontSize}
          summaryItalic={summaryItalic} setSummaryItalic={setSummaryItalic}
          summaryFixed={summaryFixed} setSummaryFixed={setSummaryFixed}
          richTextContent={richTextContent} setRichTextContent={setRichTextContent}
          richTextBgColor={richTextBgColor} setRichTextBgColor={setRichTextBgColor}
          richTextPadding={richTextPadding} setRichTextPadding={setRichTextPadding}
          richTextFontSize={richTextFontSize} setRichTextFontSize={setRichTextFontSize}
          richTextAlign={richTextAlign} setRichTextAlign={setRichTextAlign}
          richTextFontColor={richTextFontColor} setRichTextFontColor={setRichTextFontColor}
          richTextLineHeight={richTextLineHeight} setRichTextLineHeight={setRichTextLineHeight}
          richTextBorderRadius={richTextBorderRadius} setRichTextBorderRadius={setRichTextBorderRadius}
          colorSchemes={COLOR_SCHEMES}
          legendPositions={LEGEND_POSITIONS}
        />

        <ChartDrilldownConfig
          drilldownEnabled={drilldownEnabled}
          drilldownTargetChartId={drilldownTargetChartId}
          drilldownFields={drilldownFields}
          drilldownFieldMappings={drilldownFieldMappings}
          charts={charts}
          visibleFields={visibleFields}
          onDrilldownEnabledChange={setDrilldownEnabled}
          onDrilldownTargetChartIdChange={setDrilldownTargetChartId}
          onDrilldownFieldsChange={(fields) => {
            setDrilldownFields(fields);
            // 清理已移除字段的映射
            const newMappings = {};
            fields.forEach(f => {
              if (drilldownFieldMappings[f] !== undefined) {
                newMappings[f] = drilldownFieldMappings[f];
              }
            });
            setDrilldownFieldMappings(newMappings);
          }}
          onDrilldownFieldMappingsChange={setDrilldownFieldMappings}
          fieldLinks={fieldLinks}
          onFieldLinksChange={setFieldLinks}
          dateLinkageEnabled={dateLinkageEnabled}
          dateLinkageField={dateLinkageField}
          dateLinkageRange={dateLinkageRange}
          dateLinkageStartDate={dateLinkageStartDate}
          dateLinkageEndDate={dateLinkageEndDate}
          fields={fields}
          onDateLinkageEnabledChange={setDateLinkageEnabled}
          onDateLinkageFieldChange={setDateLinkageField}
          onDateLinkageRangeChange={setDateLinkageRange}
          onDateLinkageStartDateChange={setDateLinkageStartDate}
          onDateLinkageEndDateChange={setDateLinkageEndDate}
        />

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Switch
              checked={showAnalysis}
              onChange={setShowAnalysis}
              size="small"
              style={{ marginRight: 8 }}
            />
            <span style={{ fontWeight: 500 }}>总结</span>
            <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>开启后可配置动态总结内容</span>
          </div>
        </div>
        {showAnalysis && (
          <ChartAnalysisConfig
            value={analysisConfig}
            onChange={setAnalysisConfig}
            fieldsConfig={visibleFields}
          />
        )}
      </Form>
    </div>
  );

  const renderStep4 = () => (
    <div className="chart-step-content">
      <Alert
        message="预览与保存"
        description="预览图表效果，填写图表基本信息后保存。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <ChartPreview
        chartType={chartType}
        previewData={previewData}
        previewColumns={previewColumns}
        previewChartRef={previewChartRef}
        getEchartsOption={getEchartsOption}
        chartName={chartName}
        richTextContent={richTextContent}
        richTextBgColor={richTextBgColor}
        richTextPadding={richTextPadding}
        richTextFontSize={richTextFontSize}
        richTextFontColor={richTextFontColor}
        richTextAlign={richTextAlign}
        richTextLineHeight={richTextLineHeight}
        richTextBorderRadius={richTextBorderRadius}
        cellAlign={cellAlign}
        cellFontSize={cellFontSize}
        cellAutoWrap={cellAutoWrap}
        cellFontColor={cellFontColor}
        cellBgColor={cellBgColor}
        headerFontSize={headerFontSize}
        headerBold={headerBold}
        headerItalic={headerItalic}
        headerAlign={headerAlign}
        headerAutoWrap={headerAutoWrap}
        headerFontColor={headerFontColor}
        headerBgColor={headerBgColor}
        columnWidths={columnWidths}
        columnOrder={columnOrder}
        fixedLeftColumns={fixedLeftColumns}
        fixedRightColumns={fixedRightColumns}
        headerGroups={headerGroups}
        conditionalFormats={conditionalFormats}
        defaultSortField={defaultSortField}
        defaultSortOrder={defaultSortOrder}
        showInnerBorder={showInnerBorder}
        stripeRow={stripeRow}
        showOuterBorder={showOuterBorder}
        outerBorderWidth={outerBorderWidth}
        borderStyle={borderStyle}
        borderColor={borderColor}
        innerBorderColor={innerBorderColor}
        innerBorderStyle={innerBorderStyle}
        innerBorderWidth={innerBorderWidth}
        mergeField={mergeField}
        mergeBgColor={mergeBgColor}
        oddRowBgColor={oddRowBgColor}
        evenRowBgColor={evenRowBgColor}
        fixedHeader={fixedHeader}
        colorScheme={colorScheme}
        analysisTemplate={analysisTemplate}
        analysisConfig={analysisConfig}
        drilldownFields={drilldownFields}
      />

      <Divider />

      <ChartBasicConfig
        chartId={chartId} setChartId={setChartId}
        chartName={chartName} setChartName={setChartName}
        chartDescription={chartDescription} setChartDescription={setChartDescription}
        categoryId={categoryId} setCategoryId={setCategoryId}
        categories={categories}
        sortOrder={sortOrder} setSortOrder={setSortOrder}
        editingChart={editingChart}
        showDescription={showDescription} setShowDescription={setShowDescription}
        descPosition={descPosition} setDescPosition={setDescPosition}
        descAlign={descAlign} setDescAlign={setDescAlign}
        descFontSize={descFontSize} setDescFontSize={setDescFontSize}
        descFontFamily={descFontFamily} setDescFontFamily={setDescFontFamily}
        descFontColor={descFontColor} setDescFontColor={setDescFontColor}
        descBold={descBold} setDescBold={setDescBold}
        descItalic={descItalic} setDescItalic={setDescItalic}
        descBgColor={descBgColor} setDescBgColor={setDescBgColor}
        descBorderColor={descBorderColor} setDescBorderColor={setDescBorderColor}
        descLineHeight={descLineHeight} setDescLineHeight={setDescLineHeight}
        dataPermission={dataPermission} setDataPermission={setDataPermission}
        matchField={matchField} setMatchField={setMatchField}
        departmentField={departmentField} setDepartmentField={setDepartmentField}
        visibleFields={visibleFields}
        buildTreeSelectData={buildTreeSelectData}
      />
    </div>
  );

  const renderWizard = () => (
    <div className="chart-wizard">
      <div className="chart-wizard-header">
        <Button
          icon={<LeftOutlined />}
          onClick={() => {
            setWizardMode(false);
            resetWizard();
          }}
        >
          返回列表
        </Button>
        <span className="chart-wizard-title">
          {editingChart ? '编辑图表' : '新建图表'}
        </span>
      </div>

      <Steps
        current={currentStep}
        className="chart-wizard-steps"
        items={[
          { title: '选择数据源' },
          { title: '配置查询' },
          { title: '字段管理' },
          { title: '图表配置' },
          { title: '预览保存' },
        ]}
      />

      <Card className="chart-wizard-card">
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </Card>

      <div className="chart-wizard-actions">
        <Button
          icon={<LeftOutlined />}
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          上一步
        </Button>
        <div className="chart-wizard-actions-right">
          {currentStep < 4 && (
            <Button
              type="primary"
              icon={<RightOutlined />}
              onClick={handleNext}
              disabled={!canGoNext()}
            >
              下一步
            </Button>
          )}
          {currentStep === 4 && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              保存图表
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="chart-designer-page">
      <Card className="chart-designer-page-card">
        <Row gutter={[16, 16]} className="chart-filter-row" align="middle">
          <Col flex="auto">
            <Space wrap size="middle" className="chart-filter-controls">
              <Input.Search
                placeholder="搜索图表名称/标识"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="chart-search-input"
                prefix={<SearchOutlined />}
                enterButton="搜索"
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => { setSearchText(''); fetchCharts(); }}
              >
                重置
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              {hasPermission('system:chart-designer:create') && (
                <Button
                  icon={<ApartmentOutlined />}
                  onClick={() => {
                    setCategoryModalVisible(true);
                    setCategoryName('');
                    setCategoryParentId(undefined);
                    setEditingCategoryId(null);
                  }}
                >
                  分类管理
                </Button>
              )}
              {hasPermission('system:chart-designer:create') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleNewChart}
                  block={window.innerWidth < 768}
                >
                  新建图表
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        <Table
          className="chart-table"
          columns={[
            {
              title: '图表标识',
              dataIndex: 'chart_id',
              key: 'chart_id',
              width: 160,
              ellipsis: true,
            },
            {
              title: '名称',
              dataIndex: 'name',
              key: 'name',
              width: 160,
              ellipsis: true,
            },
            {
              title: '描述',
              dataIndex: 'description',
              key: 'description',
              width: 200,
              ellipsis: { showTitle: true },
              render: (text) => text || '-',
            },
            {
              title: '图表类型',
              dataIndex: 'chart_type',
              key: 'chart_type',
              width: 100,
              render: (type) => {
                const ct = CHART_TYPES.find((t) => t.value === type);
                return ct ? <Tag color="blue">{ct.label}</Tag> : type || '-';
              },
            },
            {
              title: '数据权限',
              dataIndex: 'data_permission',
              key: 'data_permission',
              width: 100,
              render: (val) =>
                val ? (
                  <Tag color="green">已开启</Tag>
                ) : (
                  <Tag color="default">未开启</Tag>
                ),
            },
            {
              title: '所属分类',
              dataIndex: 'category_id',
              key: 'category_id',
              width: 120,
              render: (val) => {
                if (!val) return <Tag color="default">未分类</Tag>;
                const findName = (cats, id) => {
                  for (const cat of cats) {
                    if (cat.id === id) return cat.name;
                    if (cat.children && cat.children.length > 0) {
                      const found = findName(cat.children, id);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                const name = findName(categories, val);
                return name ? <Tag color="blue">{name}</Tag> : <Tag color="default">未分类</Tag>;
              },
            },
            {
              title: '排序',
              dataIndex: 'sort_order',
              key: 'sort_order',
              width: 80,
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 80,
              render: (status) =>
                status === 1 ? (
                  <Tag color="green">启用</Tag>
                ) : (
                  <Tag color="red">禁用</Tag>
                ),
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 170,
              render: (text) => (text ? formatDate(text, 'YYYY-MM-DD HH:mm:ss') : '-'),
            },
            {
              title: '操作',
              key: 'action',
              width: 320,
              fixed: 'right',
              render: (_, record, index) => (
                <Space size="small">
                  {hasPermission('system:chart-designer:update') && (
                    <>
                      <Tooltip title="上移">
                        <Button
                          type="link"
                          size="small"
                          icon={<ArrowUpOutlined />}
                          disabled={index === 0}
                          onClick={() => handleMoveChart(record, 'up', index)}
                        />
                      </Tooltip>
                      <Tooltip title="下移">
                        <Button
                          type="link"
                          size="small"
                          icon={<ArrowDownOutlined />}
                          disabled={index === filteredCharts.length - 1}
                          onClick={() => handleMoveChart(record, 'down', index)}
                        />
                      </Tooltip>
                    </>
                  )}
                  {hasPermission('system:chart-designer:update') && (
                    <Tooltip title="编辑">
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditChart(record)}
                      >
                        编辑
                      </Button>
                    </Tooltip>
                  )}
                  {hasPermission('system:chart-designer:create') && (
                    <Tooltip title="复制">
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopyChart(record.id)}
                      >
                        复制
                      </Button>
                    </Tooltip>
                  )}
                  {hasPermission('system:chart-designer:delete') && (
                    <Popconfirm
                      title="确定删除该图表吗？删除后不可恢复。"
                      onConfirm={() => handleDeleteChart(record)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
          dataSource={filteredCharts}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>
    </div>
  );

  const renderListWithCategoryModal = () => (
    <>
      {renderList()}
      <Modal
        title="分类管理"
        open={categoryModalVisible}
        onCancel={() => {
          setCategoryModalVisible(false);
          setCategoryName('');
          setCategoryParentId(undefined);
          setEditingCategoryId(null);
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <div style={{ marginBottom: 16 }}>
          <Row gutter={8} align="middle">
            <Col span={8}>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="分类名称"
                onPressEnter={handleSaveCategory}
              />
            </Col>
            <Col span={8}>
              <TreeSelect
                value={categoryParentId}
                onChange={setCategoryParentId}
                placeholder="父级分类（可选）"
                allowClear
                treeDefaultExpandAll
                treeData={categories.map(cat => buildTreeSelectData(cat))}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={4}>
              <Button type="primary" onClick={handleSaveCategory} block>
                {editingCategoryId ? '更新' : '添加'}
              </Button>
            </Col>
            <Col span={4}>
              {editingCategoryId && (
                <Button
                  onClick={() => {
                    setCategoryName('');
                    setCategoryParentId(undefined);
                    setEditingCategoryId(null);
                  }}
                  block
                >
                  取消
                </Button>
              )}
            </Col>
          </Row>
        </div>
        <Divider style={{ margin: '12px 0' }} />
        {categories.length > 0 ? (
          <Dropdown
            menu={{
              items: contextMenuNode ? [
                {
                  key: 'move-up',
                  icon: <ArrowUpOutlined />,
                  label: '上移',
                  onClick: () => {
                    if (contextMenuNode.catData) {
                      handleMoveCategoryInModal(contextMenuNode.catData, 'up');
                    }
                    setContextMenuVisible(false);
                    setContextMenuNode(null);
                  },
                },
                {
                  key: 'move-down',
                  icon: <ArrowDownOutlined />,
                  label: '下移',
                  onClick: () => {
                    if (contextMenuNode.catData) {
                      handleMoveCategoryInModal(contextMenuNode.catData, 'down');
                    }
                    setContextMenuVisible(false);
                    setContextMenuNode(null);
                  },
                },
                {
                  key: 'edit',
                  icon: <EditOutlined />,
                  label: '编辑',
                  onClick: () => {
                    setEditingCategoryId(contextMenuNode.key);
                    setCategoryName(contextMenuNode.name || '');
                    setCategoryParentId(contextMenuNode.parentId || undefined);
                    setContextMenuVisible(false);
                    setContextMenuNode(null);
                  },
                },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                  onClick: () => {
                    if (contextMenuNode.catData) {
                      handleDeleteCategory(contextMenuNode.catData);
                    }
                    setContextMenuVisible(false);
                    setContextMenuNode(null);
                  },
                },
              ] : [],
            }}
            open={contextMenuVisible && !!contextMenuNode}
            onOpenChange={(visible) => {
              if (!visible) {
                setContextMenuVisible(false);
                setContextMenuNode(null);
              }
            }}
          >
            <div
              onContextMenu={(e) => {
                e.preventDefault();
              }}
            >
              <Tree
                defaultExpandAll
                treeData={buildTreeData(categories)}
                showLine={{ showLeafIcon: false }}
                onRightClick={({ node }) => {
                  setContextMenuNode(node);
                  setContextMenuVisible(true);
                }}
              />
            </div>
          </Dropdown>
        ) : (
          <Empty description="暂无分类，请添加" style={{ padding: '24px 0' }} />
        )}
      </Modal>
    </>
  );

  return wizardMode ? renderWizard() : renderListWithCategoryModal();
}
