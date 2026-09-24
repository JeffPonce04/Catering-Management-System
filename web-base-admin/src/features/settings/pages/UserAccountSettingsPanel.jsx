import React, { useEffect } from 'react';
import { Alert, Card, Divider, Form, InputNumber, Space, Switch, Button } from 'antd';
import { SaveOutlined, UserOutlined, SafetyOutlined } from '@ant-design/icons';
import {
  useUserAccountSettings,
  useUpdateUserAccountSettings,
} from '../../../hooks/useSettingsQueries';

const UserAccountSettingsPanel = () => {
  const [form] = Form.useForm();
  const { data, isLoading } = useUserAccountSettings();
  const update = useUpdateUserAccountSettings();

  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        customer: data.customer || {},
        admin: data.admin || {},
      });
    }
  }, [data, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await update.mutateAsync(values);
    } catch (err) {
      // handled by hook
    }
  };

  return (
    <Card
      variant="borderless"
      title={<Space><UserOutlined /> User Account Settings</Space>}
      extra={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={update.isPending}
          disabled={isLoading}
        >
          Save Settings
        </Button>
      }
    >
      <Alert
        message="Account policies for customers and administrators"
        description="Control how customer and admin accounts are created, verified, and secured."
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />

      <Form form={form} layout="vertical">
        {/* ==================== CUSTOMER ACCOUNTS ==================== */}
        <Divider orientation="left">
          <Space><UserOutlined /> Customer Accounts</Space>
        </Divider>

        <Form.Item
          name={['customer', 'require_email_verification']}
          label="Require Email Verification"
          valuePropName="checked"
        >
          <Switch checkedChildren="Required" unCheckedChildren="Optional" />
        </Form.Item>

        <Form.Item
          name={['customer', 'require_phone_verification']}
          label="Require Phone Verification"
          valuePropName="checked"
        >
          <Switch checkedChildren="Required" unCheckedChildren="Optional" />
        </Form.Item>

        <Form.Item
          name={['customer', 'allow_social_login']}
          label="Allow Social Login"
          valuePropName="checked"
        >
          <Switch checkedChildren="Allowed" unCheckedChildren="Disabled" />
        </Form.Item>

        <Form.Item
          name={['customer', 'password_expiration_days']}
          label="Password Expiration (days, 0 = never)"
        >
          <InputNumber min={0} max={3650} style={{ maxWidth: 240 }} />
        </Form.Item>

        <Form.Item
          name={['customer', 'account_inactivity_days']}
          label="Account Inactivity Period (days, 0 = never)"
        >
          <InputNumber min={0} max={3650} style={{ maxWidth: 240 }} />
        </Form.Item>

        {/* ==================== ADMIN ACCOUNTS ==================== */}
        <Divider orientation="left" style={{ marginTop: 32 }}>
          <Space><SafetyOutlined /> Admin Accounts</Space>
        </Divider>

        <Form.Item
          name={['admin', 'require_strong_password']}
          label="Require Strong Password"
          valuePropName="checked"
        >
          <Switch checkedChildren="Required" unCheckedChildren="Optional" />
        </Form.Item>

        <Form.Item
          name={['admin', 'password_expiration_days']}
          label="Password Expiration (days, 0 = never)"
        >
          <InputNumber min={0} max={3650} style={{ maxWidth: 240 }} />
        </Form.Item>

        <Form.Item
          name={['admin', 'max_failed_attempts']}
          label="Maximum Failed Attempts"
        >
          <InputNumber min={1} max={20} style={{ maxWidth: 240 }} />
        </Form.Item>

        <Form.Item
          name={['admin', 'account_lock_minutes']}
          label="Account Lock Duration (minutes)"
        >
          <InputNumber min={1} max={1440} style={{ maxWidth: 240 }} />
        </Form.Item>

        <Form.Item
          name={['admin', 'session_timeout_minutes']}
          label="Session Timeout (minutes)"
        >
          <InputNumber min={1} max={1440} style={{ maxWidth: 240 }} />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default UserAccountSettingsPanel;