import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Switch, Table, Tag,
} from 'antd';
import { SaveOutlined, SafetyCertificateOutlined, PlusOutlined } from '@ant-design/icons';
import {
  useRoles,
  useRoleRestrictions,
  useUpdateRoleRestrictions,
} from '../../../hooks/useSettingsQueries';

const PERMISSIONS = [
  { key: 'view',     label: 'View' },
  { key: 'create',   label: 'Create' },
  { key: 'edit',     label: 'Edit' },
  { key: 'delete',   label: 'Delete' },
  { key: 'approve',  label: 'Approve' },
  { key: 'reject',   label: 'Reject' },
  { key: 'export',   label: 'Export' },
  { key: 'settings', label: 'Manage Settings' },
];

const PermissionsGridPanel = () => {
  const [selectedRole, setSelectedRole] = useState('cashier');
  const [editingRoles, setEditingRoles] = useState([]);
  const [form] = Form.useForm();

  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: restrictions, isLoading } = useRoleRestrictions(selectedRole);
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

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.slug, label: r.name || r.slug })),
    [roles]
  );

  return (
    <Card
      variant="borderless"
      title={<Space><SafetyCertificateOutlined /> Role & Permissions</Space>}
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={updateRestrictions.isPending}
          disabled={!selectedRole || selectedRole === 'super-admin'}
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
        style={{ marginBottom: 20 }}
      />

      <Space size="middle" style={{ marginBottom: 20 }}>
        <span style={{ fontWeight: 600 }}>Select Role:</span>
        <Select
          value={selectedRole}
          onChange={setSelectedRole}
          style={{ minWidth: 220 }}
          loading={rolesLoading}
          options={roleOptions}
        />
        {selectedRole === 'super-admin' && (
          <Tag color="purple">Super Admin has unrestricted access</Tag>
        )}
      </Space>

      {selectedRole === 'super-admin' ? (
        <Alert
          message="Super Admin access cannot be restricted"
          type="info"
          showIcon
        />
      ) : isLoading ? (
        <p>Loading restrictions...</p>
      ) : (
        <Form form={form} layout="vertical">
          <Table
            rowKey="key"
            pagination={false}
            dataSource={PERMISSIONS}
            columns={[
              { title: 'PERMISSION', dataIndex: 'label', key: 'label' },
              {
                title: 'ALLOWED',
                key: 'allowed',
                width: 200,
                align: 'center',
                render: (_, record) => (
                  <Form.Item
                    name={record.key}
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch checkedChildren="Allowed" unCheckedChildren="Blocked" />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      )}
    </Card>
  );
};

export default PermissionsGridPanel;