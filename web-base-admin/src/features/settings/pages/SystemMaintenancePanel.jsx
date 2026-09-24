import React, { useEffect } from 'react';
import {
  Alert, Button, Card, Descriptions, Form, Input, Space, Switch, Tag, Divider, Popconfirm,
} from 'antd';
import {
  SaveOutlined, ToolOutlined, ClearOutlined, DatabaseOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useMaintenanceConfig,
  useUpdateMaintenanceConfig,
  useClearTempFiles,
  useRunDatabaseMaintenance,
  useClearSystemCache,
  useSystemStatus,
} from '../../../hooks/useSettingsQueries';

const SystemMaintenancePanel = () => {
  const [form] = Form.useForm();
  const { data: config, isLoading: configLoading } = useMaintenanceConfig();
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useSystemStatus();

  const updateConfig = useUpdateMaintenanceConfig();
  const clearTemp = useClearTempFiles();
  const runDb = useRunDatabaseMaintenance();
  const clearCache = useClearSystemCache();

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        maintenance_mode: config.maintenance_mode ?? false,
        maintenance_message: config.maintenance_message ?? '',
      });
    }
  }, [config, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await updateConfig.mutateAsync(values);
    } catch (err) {
      // handled by hook
    }
  };

  return (
    <div>
      <Card
        variant="borderless"
        title={<Space><ToolOutlined /> System Maintenance</Space>}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={updateConfig.isPending}
            disabled={configLoading}
          >
            Save Configuration
          </Button>
        }
        style={{ marginBottom: 20 }}
      >
        <Alert
          message="Maintenance Mode disables the API for all users except Super Admin."
          description="Health check, authentication, and announcements endpoints remain accessible. Customers and staff will see your maintenance message."
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Form form={form} layout="vertical">
          <Form.Item name="maintenance_mode" label="Maintenance Mode" valuePropName="checked">
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
          </Form.Item>

          <Form.Item name="maintenance_message" label="Maintenance Message">
            <Input.TextArea
              rows={3}
              maxLength={2000}
              showCount
              placeholder="We are performing scheduled maintenance. Please try again shortly."
            />
          </Form.Item>
        </Form>

        <Divider />

        <Space wrap>
          <Popconfirm title="Clear application cache?" onConfirm={() => clearCache.mutate()}>
            <Button icon={<ClearOutlined />} loading={clearCache.isPending}>
              Clear Application Cache
            </Button>
          </Popconfirm>

          <Popconfirm title="Delete temp and log files?" onConfirm={() => clearTemp.mutate()}>
            <Button icon={<ClearOutlined />} loading={clearTemp.isPending}>
              Clear Temporary Files
            </Button>
          </Popconfirm>

          <Popconfirm title="Run database OPTIMIZE / VACUUM?" onConfirm={() => runDb.mutate()}>
            <Button icon={<DatabaseOutlined />} loading={runDb.isPending}>
              Run Database Maintenance
            </Button>
          </Popconfirm>
        </Space>

        {(config?.last_cache_cleared || config?.last_temp_cleared || config?.last_db_maintenance) && (
          <Descriptions column={1} size="small" bordered style={{ marginTop: 16 }}>
            {config.last_cache_cleared && (
              <Descriptions.Item label="Last cache cleared">
                {dayjs(config.last_cache_cleared).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
            )}
            {config.last_temp_cleared && (
              <Descriptions.Item label="Last temp files cleared">
                {dayjs(config.last_temp_cleared).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
            )}
            {config.last_db_maintenance && (
              <Descriptions.Item label="Last database maintenance">
                {dayjs(config.last_db_maintenance).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Card>

      <Card
        variant="borderless"
        title={<Space><CheckCircleOutlined /> System Health</Space>}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetchStatus()} loading={statusLoading}>
            Refresh
          </Button>
        }
      >
        {statusLoading ? (
          <p>Loading system status...</p>
        ) : (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Environment">{status?.environment || '—'}</Descriptions.Item>
            <Descriptions.Item label="Debug Mode">
              {status?.debug_mode ? <Tag color="red">ON</Tag> : <Tag color="green">OFF</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="PHP Version">{status?.php_version || '—'}</Descriptions.Item>
            <Descriptions.Item label="Laravel">{status?.laravel || '—'}</Descriptions.Item>
            <Descriptions.Item label="Database Connection">
              {status?.database_ok ? <Tag color="green">OK</Tag> : <Tag color="red">FAILED</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Storage Writable">
              {status?.storage_writable ? <Tag color="green">OK</Tag> : <Tag color="red">NOT WRITABLE</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Queue Connection">{status?.queue_connection || '—'}</Descriptions.Item>
            <Descriptions.Item label="Cache Driver">{status?.cache_driver || '—'}</Descriptions.Item>
            <Descriptions.Item label="Server Time">{status?.server_time || '—'}</Descriptions.Item>
            <Descriptions.Item label="Timezone">{status?.timezone || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </div>
  );
};

export default SystemMaintenancePanel;