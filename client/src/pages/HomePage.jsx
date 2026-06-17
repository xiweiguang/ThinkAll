import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Input, Typography, Empty, Spin } from 'antd';
import { SearchOutlined, FolderOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined, TableOutlined, DatabaseOutlined, AppstoreOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { getTableIcon } from '../config/tables';
import { getTableConfig } from '../services/tableService';
import * as chartCategoryService from '../services/chartCategoryService';
import { useChartTab } from '../contexts/ChartTabContext';
import './HomePage.css';

const { Title, Paragraph, Text } = Typography;

const CHART_TYPE_LABELS = {
  bar: '柱状图', line: '折线图', pie: '饼图', scatter: '散点图',
  radar: '雷达图', area: '面积图', table: '数据表格',
};

/** 根据图表类型返回对应图标 */
const getChartIcon = (chartType) => {
  switch (chartType) {
    case 'bar': return <BarChartOutlined />;
    case 'line': return <LineChartOutlined />;
    case 'pie': return <PieChartOutlined />;
    case 'table': return <TableOutlined />;
    default: return <BarChartOutlined />;
  }
};

function flattenCategories(tree, map = {}) {
  for (const cat of tree) {
    map[cat.id] = cat.name;
    if (cat.children && cat.children.length > 0) {
      flattenCategories(cat.children, map);
    }
  }
  return map;
}

function collectChartsForCategory(categoryId, categoryTree, tables) {
  const result = [];
  result.push(...tables.filter(t => t.categoryId === categoryId));
  const findChildren = (nodes) => {
    for (const node of nodes) {
      if (node.id === categoryId && node.children) {
        for (const child of node.children) {
          result.push(...tables.filter(t => t.categoryId === child.id));
          if (child.children && child.children.length > 0) {
            collectFromNodes(child.children, tables, result);
          }
        }
        return;
      }
      if (node.children) {
        findChildren(node.children);
      }
    }
  };
  const collectFromNodes = (nodes, tbls, res) => {
    for (const node of nodes) {
      res.push(...tbls.filter(t => t.categoryId === node.id));
      if (node.children && node.children.length > 0) {
        collectFromNodes(node.children, tbls, res);
      }
    }
  };
  findChildren(categoryTree);
  return result;
}

/** 获取分类下的图表总数（包含子分类） */
function getChartCount(cat, tables) {
  return collectChartsForCategory(cat.id, [cat], tables).length;
}

/** 渲染子分类列表 */
function renderSubCategories(cat, tables, handleCardClick, expandedCategories, toggleCategoryExpand) {
  if (!cat.children || cat.children.length === 0) return null;
  return (
    <div className="home-category-sub-list">
      {cat.children.map(child => {
        const childCharts = tables.filter(t => t.categoryId === child.id);
        const isExpanded = expandedCategories.includes(child.id);
        return (
          <div key={child.id} className="home-category-sub-item">
            <div
              className="home-category-sub-header"
              onClick={(e) => {
                e.stopPropagation();
                toggleCategoryExpand(child.id);
              }}
            >
              <span className="home-category-sub-arrow">
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
              </span>
              <FolderOutlined style={{ color: '#faad14', fontSize: 13 }} />
              <span className="home-category-sub-name">{child.name}</span>
              <span className="home-category-sub-count">{childCharts.length}个图表</span>
            </div>
            {isExpanded && childCharts.length > 0 && (
              <div className="home-category-sub-charts">
                <div className="home-chart-list">
                  {childCharts.map(chart => (
                    <div
                      key={chart.id}
                      className="home-chart-list-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(chart.id);
                      }}
                    >
                      <div className="home-chart-list-icon">
                        {getChartIcon(chart.chartType)}
                      </div>
                      <div className="home-chart-list-name">{chart.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 子分类的子分类递归 */}
            {isExpanded && child.children && child.children.length > 0 && (
              <div style={{ marginLeft: 16 }}>
                {renderSubCategories(child, tables, handleCardClick, expandedCategories, toggleCategoryExpand)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 渲染分类下的图表列表 */
function renderCategoryCharts(cat, tables, handleCardClick) {
  const catCharts = tables.filter(t => t.categoryId === cat.id);
  if (catCharts.length === 0) return null;
  return (
    <div className="home-chart-list">
      {catCharts.map(chart => (
        <div
          key={chart.id}
          className="home-chart-list-item"
          onClick={() => handleCardClick(chart.id)}
        >
          <div className="home-chart-list-icon">
            {getChartIcon(chart.chartType)}
          </div>
          <div className="home-chart-list-name">{chart.name}</div>
        </div>
      ))}
    </div>
  );
}

function renderChartCard(table, handleCardClick) {
  const IconComponent = getTableIcon(table.icon);
  const typeLabel = CHART_TYPE_LABELS[table.chartType] || '图表';
  return (
    <Col key={table.id} xs={24} sm={12} md={8} lg={4}>
      <Card
        hoverable
        className="home-chart-card"
        onClick={() => handleCardClick(table.id)}
        styles={{
          body: {
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          },
        }}
      >
        <div className="home-chart-icon-wrap">
          <IconComponent style={{ fontSize: 20, color: '#fff' }} />
        </div>
        <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>
          {table.name}
        </Text>
        <span className="home-chart-type-tag">{typeLabel}</span>
        {table.description && (
          <Paragraph
            type="secondary"
            style={{ fontSize: 12, marginBottom: 0, lineHeight: 1.5, marginTop: 6 }}
            ellipsis={{ rows: 2 }}
          >
            {table.description}
          </Paragraph>
        )}
      </Card>
    </Col>
  );
}

export default function HomePage() {
  const [searchText, setSearchText] = useState('');
  const [visibleTables, setVisibleTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState([]);
  const { openTab } = useChartTab();

  /** 切换分类卡片展开/收起 */
  const toggleCategoryExpand = (catId) => {
    setExpandedCategories(prev =>
      prev.includes(catId)
        ? prev.filter(id => id !== catId)
        : [...prev, catId]
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tableRes, catRes] = await Promise.all([
          getTableConfig(),
          chartCategoryService.getCategories(),
        ]);
        if (tableRes && tableRes.code === 200) {
          setVisibleTables(tableRes.data || []);
        } else {
          setVisibleTables([]);
        }
        const catData = catRes.data || catRes;
        setCategories(Array.isArray(catData) ? catData : []);
      } catch {
        setVisibleTables([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredTables = useMemo(() => {
    if (!searchText.trim()) return visibleTables;
    const keyword = searchText.trim().toLowerCase();
    return visibleTables.filter(
      (table) =>
        table.name.toLowerCase().includes(keyword) ||
        (table.description && table.description.toLowerCase().includes(keyword))
    );
  }, [searchText, visibleTables]);

  const isSearchMode = searchText.trim().length > 0;

  const { categorizedTables, uncategorizedTables } = useMemo(() => {
    const categorized = {};
    const uncategorized = [];
    for (const table of visibleTables) {
      if (table.categoryId) {
        if (!categorized[table.categoryId]) {
          categorized[table.categoryId] = [];
        }
        categorized[table.categoryId].push(table);
      } else {
        uncategorized.push(table);
      }
    }
    return { categorizedTables: categorized, uncategorizedTables: uncategorized };
  }, [visibleTables]);

  const totalCategories = useMemo(() => {
    const count = (nodes) => {
      let n = 0;
      for (const node of nodes) {
        n += 1;
        if (node.children) n += count(node.children);
      }
      return n;
    };
    return count(categories);
  }, [categories]);

  const handleCardClick = (tableId) => {
    const table = visibleTables.find(t => t.id === tableId);
    openTab(tableId, {}, table?.name || '');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-welcome">
        <Title level={3} className="home-welcome-title" style={{ marginBottom: 4 }}>
          想集 · 智能OA
        </Title>
        <p className="home-welcome-subtitle">
          集所想，办所事
        </p>

        <Row gutter={[16, 16]} className="home-stats-row">
          <Col xs={8} sm={8}>
            <Card className="home-stat-card" styles={{ body: { padding: '16px 20px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="home-stat-icon">
                  <BarChartOutlined />
                </div>
                <div>
                  <div className="home-stat-value">{visibleTables.length}</div>
                  <div className="home-stat-label">数据图表</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={8} sm={8}>
            <Card className="home-stat-card stat-green" styles={{ body: { padding: '16px 20px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="home-stat-icon icon-green">
                  <AppstoreOutlined />
                </div>
                <div>
                  <div className="home-stat-value">{totalCategories}</div>
                  <div className="home-stat-label">数据分类</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={8} sm={8}>
            <Card className="home-stat-card stat-purple" styles={{ body: { padding: '16px 20px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="home-stat-icon icon-purple">
                  <DatabaseOutlined />
                </div>
                <div>
                  <div className="home-stat-value">{isSearchMode ? filteredTables.length : visibleTables.length}</div>
                  <div className="home-stat-label">{isSearchMode ? '搜索结果' : '可用数据'}</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Input
            placeholder="搜索图表名称..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            size="large"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 400 }}
            className="home-search-input"
          />
        </div>
      </div>

      {isSearchMode ? (
        filteredTables.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filteredTables.map((table) => renderChartCard(table, handleCardClick))}
          </Row>
        ) : (
          <Empty description="未找到匹配的图表" style={{ marginTop: 60 }} />
        )
      ) : (
        <>
          {categories.length > 0 ? (
            <div style={{ padding: '0 24px' }}>
              <Row gutter={[16, 16]}>
                {categories.map(cat => (
                  <Col xs={24} sm={12} md={8} lg={8} key={cat.id}>
                    <Card
                      className={`home-category-card ${expandedCategories.includes(cat.id) ? 'home-category-card-expanded' : ''}`}
                      hoverable
                      onClick={() => toggleCategoryExpand(cat.id)}
                    >
                      <div className="home-category-card-header">
                        <div className="home-category-icon">
                          <FolderOutlined />
                        </div>
                        <div className="home-category-info">
                          <div className="home-category-name">{cat.name}</div>
                          <div className="home-category-count">
                            {cat.children?.length || 0}个子分类 · {getChartCount(cat, visibleTables)}个图表
                          </div>
                        </div>
                        <div className="home-category-expand-icon">
                          {expandedCategories.includes(cat.id) ? <DownOutlined /> : <RightOutlined />}
                        </div>
                      </div>
                      {/* 展开时显示子分类和图表 */}
                      {expandedCategories.includes(cat.id) && (
                        <div className="home-category-card-content">
                          {renderSubCategories(cat, visibleTables, handleCardClick, expandedCategories, toggleCategoryExpand)}
                          {renderCategoryCharts(cat, visibleTables, handleCardClick)}
                        </div>
                      )}
                    </Card>
                  </Col>
                ))}
                {/* 未分类图表，纳入同一行 */}
                {uncategorizedTables.length > 0 && (
                  <Col xs={24} sm={12} md={8} lg={8} key="uncategorized">
                    <Card
                      className={`home-category-card ${expandedCategories.includes('uncategorized') ? 'home-category-card-expanded' : ''}`}
                      hoverable
                      onClick={() => toggleCategoryExpand('uncategorized')}
                    >
                      <div className="home-category-card-header">
                        <div className="home-category-icon icon-yellow">
                          <FolderOutlined />
                        </div>
                        <div className="home-category-info">
                          <div className="home-category-name">未分类</div>
                          <div className="home-category-count">
                            {uncategorizedTables.length}个图表
                          </div>
                        </div>
                        <div className="home-category-expand-icon">
                          {expandedCategories.includes('uncategorized') ? <DownOutlined /> : <RightOutlined />}
                        </div>
                      </div>
                      {expandedCategories.includes('uncategorized') && (
                        <div className="home-category-card-content">
                          <div className="home-chart-list">
                            {uncategorizedTables.map(chart => (
                              <div
                                key={chart.id}
                                className="home-chart-list-item"
                                onClick={() => handleCardClick(chart.id)}
                              >
                                <div className="home-chart-list-icon">
                                  {getChartIcon(chart.chartType)}
                                </div>
                                <div className="home-chart-list-name">{chart.name}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  </Col>
                )}
              </Row>
            </div>
          ) : (
            visibleTables.length > 0 ? (
              <Row gutter={[16, 16]}>
                {visibleTables.map((table) => renderChartCard(table, handleCardClick))}
              </Row>
            ) : (
              <Empty description="暂无可用图表" style={{ marginTop: 60 }} />
            )
          )}
        </>
      )}
    </div>
  );
}
