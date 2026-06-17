import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';

const ChartTabContext = createContext(null);

export function ChartTabProvider({ children }) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const contentRef = useRef(null);
  const tabIdRef = useRef(0);

  const openTab = useCallback((chartId, filterParams = {}, title = '') => {
    setTabs(prev => {
      const exists = prev.find(t => t.chartId === chartId && _shallowEqual(t.filterParams, filterParams));
      if (exists) {
        setActiveTabId(exists.tabId);
        return prev;
      }
      tabIdRef.current += 1;
      const newTabId = `tab-${tabIdRef.current}`;
      setActiveTabId(newTabId);
      return [...prev, { tabId: newTabId, chartId, filterParams, title: title || chartId }];
    });
  }, []);

  const switchTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback((tabId) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.tabId === tabId);
      const newTabs = prev.filter(t => t.tabId !== tabId);
      setActiveTabId(currentActive => {
        if (currentActive !== tabId) return currentActive;
        if (newTabs.length === 0) return null;
        const newIdx = Math.min(idx, newTabs.length - 1);
        return newTabs[newIdx].tabId;
      });
      return newTabs;
    });
  }, []);

  const updateTabTitle = useCallback((tabId, title) => {
    setTabs(prev => prev.map(t => t.tabId === tabId ? { ...t, title } : t));
  }, []);

  const updateTabTitleByChartId = useCallback((chartId, title) => {
    setTabs(prev => prev.map(t => t.chartId === chartId ? { ...t, title } : t));
  }, []);

  const deactivateTab = useCallback(() => {
    setActiveTabId(null);
  }, []);

  // 全屏切换函数
  const toggleFullscreen = useCallback(() => {
    if (!contentRef.current) return;
    if (!document.fullscreenElement) {
      contentRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const contextValue = useMemo(() => ({
    tabs, activeTabId, openTab, switchTab, closeTab, deactivateTab,
    updateTabTitle, updateTabTitleByChartId, isFullscreen, toggleFullscreen, contentRef,
  }), [tabs, activeTabId, openTab, switchTab, closeTab, deactivateTab,
    updateTabTitle, updateTabTitleByChartId, isFullscreen, toggleFullscreen]);

  return (
    <ChartTabContext.Provider value={contextValue}>
      {children}
    </ChartTabContext.Provider>
  );
}

function _shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => a[key] === b[key]);
}

export function useChartTab() {
  const ctx = useContext(ChartTabContext);
  if (!ctx) throw new Error('useChartTab must be used within ChartTabProvider');
  return ctx;
}
