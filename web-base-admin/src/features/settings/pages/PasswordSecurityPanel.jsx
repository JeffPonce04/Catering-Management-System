import React, { useEffect } from 'react';
import {
  Alert, Button, Card, Divider, Form, Input, InputNumber, Space, Switch, Table, Tag,
} from 'antd';
import {
  SaveOutlined, SafetyOutlined, KeyOutlined, HistoryOutlined, LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useSettingsSection,
  useUpdateSettingsSection,
  useLoginLogs,
  useForceLogoutAll,
} from '../../../hooks/useSettingsQueries';

const PasswordSecurityPanel = () => {
  const [form] = Form.useForm();
  const { data: settings, isLoading } = useSettingsSection('system_security_ext');
  const updateSection = useUpdateSettingsSection();
  const { data: loginLogsData } = useLoginLogs({ per_page: 20 });
  const forceLogoutAll = useForceLogoutAll();

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        max_login_attempts: settings.max_login_attempts ?? 5,
        account_lockout_minutes: settings.account_lockout_minutes ?? 30,
        session_timeout_minutes: settings.session_timeout_minutes ?? 30,
        password_min_length: settings.password_min_length ?? 8,
        password_require_upper: settings.password_require_upper ?? true,
        password_require_number: settings.password_require_number ?? true,
        password_require_symbol: settings.password_require_symbol ?? false,
        auto_logout: settings.auto_logout ?? true,
        two_factor_auth: settings.two_factor_auth ?? false,
        login_notifications: settings.login_notifications ?? true,
        suspicious_login_alerts: settings.suspicious_login_alerts ?? true,
      });
    }
  }, [settings, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateSection.mutateAsync({ section: 'system_security_ext', data: values });
    } catch (err) {
      // handled by hook
    }
  };

  const handleForceLogoutAll = () => {
    forceLogoutAll.mutate({ exclude_self: true });
  };

  const loginLogs = loginLogsData?.data || [];

  const logColumns = [
    {
      title: 'DATE & TIME',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v) => v ? dayjs(v).format('MMM DD, YYYY HH:mm:ss') : '—',
    },
    {
      title: 'USER',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 180,
    },
    {
      title: 'ACTION',
      dataIndex: 'action_label',
      key: 'action_label',
      render: (v, r) => {
        const color = r.action?.includes('failed') ? 'red'
          : r.action?.includes('banned') ? 'volcano'
          : r.action?.includes('logout') ? 'orange'
          : 'green';
        return <Tag color={color}>{v || r.action}</Tag>;
      },
    },
    { title: 'IP', dataIndex: 'ip_address', key: 'ip_address', width: 140 },
  ];

  return (
    <div>
      <Card
        variant="borderless"
        title={<Space><SafetyOutlined /> Password & Security</Space>}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={updateSection.isPending}
            disabled={isLoading}
          >
            Save Security Settings
          </Button>
        }
        style={{ marginBottom: 20 }}
      >
        <Alert
          message="System-wide security policies"
          description="These settings apply to all Web Admin accounts. Changes take effect immediately."
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Form form={form} layout="vertical">
          <Divider orientation="left">
            <Space><KeyOutlined /> Login Security</Space>
          </Divider>

          <Form.Item name="max_login_attempts" label="Maximum Login Attempts">
            <InputNumber min={1} max={20} style={{ maxWidth: 240 }} />
          </Form.Item>

          <Form.Item name="account_lockout_minutes" label="Lockout Duration (minutes)">
            <InputNumber min={1} max={1440} style={{ maxWidth: 240 }} />
          </Form.Item>

          <Form.Item name="session_timeout_minutes" label="Session Timeout (minutes)">
            <InputNumber min={1} max={1440} style={{ maxWidth: 240 }} />
          </Form.Item>

          <Form.Item name="auto_logout" label="Auto Logout on Inactivity" valuePropName="checked">
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
          </Form.Item>

          <Divider orientation="left" style={{ marginTop: 24 }}>
            <Space><LockOutlined /> Password Policy</Space>
          </Divider>

          <Form.Item name="password_min_length" label="Minimum Password Length">
            <InputNumber min={6} max={32} style={{ maxWidth: 240 }} />
          </Form.Item>

          <Form.Item name="password_require_upper" label="Require Uppercase Letter" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="password_require_number" label="Require Number" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="password_require_symbol" label="Require Special Character" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="two_factor_auth" label="Two-Factor Authentication" valuePropName="checked">
            <Switch checkedChildren="Required" unCheckedChildren="Disabled" />
          </Form.Item>

          <Divider orientation="left" style={{ marginTop: 24 }}>
            <Space><SafetyOutlined /> Monitoring</Space>
          </Divider>

          <Form.Item name="login_notifications" label="Login Notifications" valuePropName="checked">
            <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

          <Form.Item name="suspicious_login_alerts" label="Suspicious Login Alerts" valuePropName="checked">
            <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>
        </Form>

        <Divider />

        <Space>
          <Button
            danger
            onClick={handleForceLogoutAll}
            loading={forceLogoutAll.isPending}
          >
            Force Logout All Sessions (except yours)
          </Button>
        </Space>
      </Card>

      <Card
        variant="borderless"
        title={<Space><HistoryOutlined /> Login History</Space>}
      >
        <Table
          rowKey="audit_id"
          columns={logColumns}
          dataSource={loginLogs}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default PasswordSecurityPanel;