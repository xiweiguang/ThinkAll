import React from 'react';
import { Modal, Input, message } from 'antd';

/**
 * 分类管理弹窗子组件
 * 包含新建目录和删除目录两个弹窗
 */
export default function CategoryModal({
  categoryModalVisible,
  newCategoryName,
  deleteCategoryModalVisible,
  categoryToDelete,
  onCreateCategory,
  onCancelCreate,
  onNewCategoryNameChange,
  onConfirmDelete,
  onCancelDelete,
}) {
  return (
    <>
      {/* 新建目录对话框 */}
      <Modal
        title="新建目录"
        open={categoryModalVisible}
        onOk={onCreateCategory}
        onCancel={onCancelCreate}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <div style={{ marginTop: 16 }}>
          <Input
            placeholder="请输入目录名称"
            value={newCategoryName}
            onChange={(e) => onNewCategoryNameChange(e.target.value)}
            maxLength={50}
            allowClear
            onPressEnter={onCreateCategory}
          />
        </div>
      </Modal>

      {/* 删除目录对话框 */}
      <Modal
        title="删除目录"
        open={deleteCategoryModalVisible}
        onOk={onConfirmDelete}
        onCancel={onCancelDelete}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除目录 <strong>{categoryToDelete?.name}</strong> 吗？</p>
        <p style={{ color: '#999', fontSize: 12 }}>该目录下的图表将变为未分类状态，不会被删除。</p>
      </Modal>
    </>
  );
}
