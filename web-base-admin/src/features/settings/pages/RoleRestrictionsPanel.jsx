import React, { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Empty, Form, Select, Space, Spin, Switch, Tag,
} from 'antd';
import { SafetyCertificateOutlined, SaveOutlined } from '@ant-design/icons';
import {
  useRoles,
  useRoleRestrictions,
  useUpdateRoleRestrictions,
} from '../../../hooks/useSettingsQueries';

const PERMISSION_KEYS = [
  { key: 'view',     label: 'View' },
  { key: 'create',   label: 'Create' },
  { key: 'edit',     label: 'Edit' },
  { key: 'delete',   label: 'Delete' },
  { key: 'approve',  label: 'Approve' },
  { key: 'reject',   label: 'Reject' },
  { key: 'export',   label: 'Export' },
  { key: 'settings', label: 'Manage Settings' },
];

const RoleRestrictionsPanel = () => {
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const [selectedRole, setSelectedRole] = useState('cashier');
  const [form] = Form.useForm();

  const { data: restrictions, isLoading: restrictionsLoading } =
    useRoleRestrictions(selectedRole);

  const updateRestrictions = useUpdateRoleRestrictions();

  useEffect(() => {
    if (restrictions) {
      form.setFieldsValue(restrictions);
    }
  }, [restrictions, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateRestrictions.mutateAsync({ roleSlug: selectedRole, data: values });
    } catch (err) {
      // handled by hook
    }
  };

  return (
    <Card
      variant="borderless"
      title={<Space><SafetyCertificateOutlined /> Role &amp; Permission Restrictions</Space>}
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={updateRestrictions.isPending}
          disabled={!selectedRole}
        >
          Save Restrictions
        </Button>
      }
    >
      <Alert
        message="Configure per-role access to sensitive modules and actions"
        description="Restrictions are enforced on the backend. Super Admin always retains full access."
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space size="middle" style={{ marginBottom: 20 }}>
        <span style={{ fontWeight: 600 }}>Select Role:</span>
        <Select
          value={selectedRole}
          onChange={setSelectedRole}
          style={{ minWidth: 220 }}
          loading={rolesLoading}
          options={roles.map((r) => ({ value: r.slug, label: r.name || r.slug }))}
        />
        {selectedRole === 'super-admin' && (
          <Tag color="purple">Super Admin has unrestricted access</Tag>
        )}
      </Space>

      {restrictionsLoading ? (
        <Spin />
      ) : (
        <Form
          form={form}
          layout="vertical"
          disabled={selectedRole === 'super-admin'}
        >
          {PERMISSION_KEYS.map(({ key, label }) => (
            <Form.Item
              key={key}
              name={key}
              label={label}
              valuePropName="checked"
              style={{ marginBottom: 12 }}
            >
              <Switch checkedChildren="Allowed" unCheckedChildren="Blocked" />
            </Form.Item>
          ))}
        </Form>
      )}
    </Card>
  );
};

export default RoleRestrictionsPanel;