import React from 'react';
import { Modal, Form, Input, Switch } from 'antd';

/**
 * 角色编辑表单组件
 * 用于新增和编辑角色信息
 */
function RoleForm({
  visible,
  title,
  editingRole,
  form,
  submitting,
  onSubmit,
  onCancel,
  afterOpenChange,
}) {
  return (
    <Modal
      title={title}
      open={visible}
      onOk={onSubmit}
      onCancel={onCancel}
      confirmLoading={submitting}
      okText="确定"
      cancelText="取消"
      destroyOnHidden
      afterOpenChange={afterOpenChange}
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label="角色名称"
          name="role_name"
          rules={[{ required: true, message: '请输入角色名称' }]}
        >
          <Input placeholder="请输入角色名称" maxLength={50} />
        </Form.Item>
        <Form.Item
          label="角色编码"
          name="role_code"
          rules={[
            { required: true, message: '请输入角色编码' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '角色编码只能包含字母、数字、下划线' }
          ]}
        >
          <Input placeholder="请输入角色编码（如: manager）" maxLength={50} disabled={!!editingRole} />
        </Form.Item>
        <Form.Item
          label="描述"
          name="description"
        >
          <Input.TextArea placeholder="请输入角色描述" rows={3} maxLength={200} showCount />
        </Form.Item>
        <Form.Item
          label="状态"
          name="status"
          valuePropName="checked"
        >
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default RoleForm;
