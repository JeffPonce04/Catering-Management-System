import React, { useEffect } from 'react';
import {
  Alert, Button, Card, Form, InputNumber, Select, Space, Switch, Table, Tag,
} from 'antd';
import { SaveOutlined, DatabaseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useBackupConfig,
  useUpdateBackupConfig,
  useBackups,
  useCreateBackup,
  useRestoreBackup,
  useDeleteBackup,
  useDownloadBackup,
} from '../../../hooks/useSettingsQueries';

const FREQUENCY_OPTIONS = [
  { value: 'manual', label: 'Manual only' },
  { value: 'daily', label: 'Daily (2:00 AM)' },
  { value: 'weekly', label: 'Weekly (Sunday 2:00 AM)' },
  { value: 'monthly', label: 'Monthly (1st, 2:00 AM)' },
];

const humanFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const pow = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** pow)).toFixed(2)} ${units[pow]}`;
};

const BackupConfigPanel = () => {
  const [form] = Form.useForm();

  const { data: config, isLoading: configLoading, refetch: refetchConfig } = useBackupConfig();
  const { data: backups = [], isLoading: backupsLoading, refetch: refetchBackups } = useBackups();
  const updateConfig = useUpdateBackupConfig();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();
  const downloadBackup = useDownloadBackup();

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        frequency: config.frequency ?? 'manual',
        retention: config.retention ?? 7,
        auto_backup_enabled: config.auto_backup_enabled ?? false,
      });
    }
  }, [config, form]);

  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      await updateConfig.mutateAsync(values);
      refetchConfig();
    } catch (err) {
      // handled by hook
    }
  };

  const handleCreateBackup = async () => {
    await createBackup.mutateAsync();
    refetchBackups();
    refetchConfig();
  };

  const handleRestore = (filename) => {
    ModalConfirmRestore(filename, () => restoreBackup.mutateAsync({ filename, confirm: 'RESTORE' }));
  };

  const handleDelete = (filename) => {
    ModalConfirmDelete(filename, () => deleteBackup.mutateAsync(filename));
  };

  const backupColumns = [
    { title: 'BACKUP ID', dataIndex: 'filename', key: 'filename', render: (v) => <code>{v}</code> },
    { title: 'SIZE', dataIndex: 'size', key: 'size', width: 120, render: (v) => humanFileSize(v) },
    {
      title: 'CREATED',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (v) => (v ? dayjs(v).format('MMM DD, YYYY HH:mm:ss') : '—'),
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 260,
      align: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            onClick={() => downloadBackup.mutateAsync(r.filename)}
          >
            Download
          </Button>
          <Button size="small" type="link" onClick={() => handleRestore(r.filename)}>
            Restore
          </Button>
          <Button size="small" type="link" danger onClick={() => handleDelete(r.filename)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      variant="borderless"
      title={<Space><DatabaseOutlined /> Backup &amp; Restore</Space>}
      extra={
        <Button
          type="primary"
          onClick={handleCreateBackup}
          loading={createBackup.isPending}
        >
          Create Backup Now
        </Button>
      }
    >
      <Alert
        message="Database Backup Management"
        description="Create manual backups, schedule automatic backups, and restore from a previous snapshot. All backup and restore actions are recorded in the audit log."
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical" style={{ marginBottom: 24 }}>
        <Space size="large" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Form.Item name="frequency" label="Backup Frequency" style={{ minWidth: 220, marginBottom: 0 }}>
            <Select options={FREQUENCY_OPTIONS} />
          </Form.Item>

          <Form.Item name="retention" label="Retention (backups kept)" style={{ minWidth: 200, marginBottom: 0 }}>
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="auto_backup_enabled"
            label="Automatic Backup"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveConfig}
              loading={updateConfig.isPending}
            >
              Save Configuration
            </Button>
          </Form.Item>
        </Space>
      </Form>

      {config?.last_backup_at && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Last backup: ${dayjs(config.last_backup_at).format('MMM DD, YYYY HH:mm:ss')}`}
        />
      )}

      <div style={{ marginBottom: 8, fontWeight: 600 }}>Backup History</div>

      <Table
        rowKey="filename"
        columns={backupColumns}
        dataSource={backups}
        loading={backupsLoading || configLoading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{ emptyText: 'No backups yet. Create one to get started.' }}
      />
    </Card>
  );
};

/**
 * Confirmation helpers for destructive actions.
 */
function ModalConfirmRestore(filename, onConfirm) {
  const { Modal, Input } = require('antd');
  let typed = '';
  const modal = Modal.confirm({
    title: 'Restore Database',
    okText: 'Restore',
    okType: 'danger',
    content: (
      <div>
        <p>
          This will replace the current database with the contents of{' '}
          <code>{filename}</code>. This cannot be undone.
        </p>
        <p>
          Type <strong>RESTORE</strong> to confirm:
        </p>
        <Input onChange={(e) => { typed = e.target.value; }} />
      </div>
    ),
    onOk: () => {
      if (typed !== 'RESTORE') {
        return Promise.reject(new Error('Type RESTORE to confirm'));
      }
      return onConfirm();
    },
  });
  return modal;
}

function ModalConfirmDelete(filename, onConfirm) {
  const { Modal } = require('antd');
  return Modal.confirm({
    title: 'Delete Backup',
    content: `Delete backup file "${filename}"? This cannot be undone.`,
    okText: 'Delete',
    okType: 'danger',
    onOk: onConfirm,
  });
}

export default BackupConfigPanel;