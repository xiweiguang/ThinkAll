import React from 'react';
import { Input, Space } from 'antd';
import { SearchOutlined, ReloadOutlined, BankOutlined } from '@ant-design/icons';

/**
 * 通讯录搜索栏组件
 * 包含搜索输入框和刷新按钮
 */
function SearchBar({ searchValue, onSearch, onRefresh }) {
  return (
    <Space>
      <Input
        placeholder="搜索人员"
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={onSearch}
        allowClear
        style={{ width: 140 }}
        size="small"
      />
      <ReloadOutlined onClick={onRefresh} style={{ cursor: 'pointer', color: '#1890ff' }} />
    </Space>
  );
}

export default SearchBar;
