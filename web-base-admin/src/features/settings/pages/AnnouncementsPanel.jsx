import React, { useState } from 'react';
import {
  Alert, Button, Card, DatePicker, Form, Input, Modal, Select, Space, Switch, Table, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MailOutlined, NotificationOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '../../../hooks/useSettingsQueries';

const { TextArea } = Input;

const PRIORITY_COLORS = {
  low: 'blue',
  normal: 'cyan',
  high: 'orange',
  critical: 'red',
};

const TARGET_LABELS = {
  all: 'All Users',
  customers: 'Customers',
  admins: 'Admins',
  staff: 'Staff',
};

const AnnouncementsPanel = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const { data: announcements = [], isLoading } = useAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      is_active: true,
      priority: 'normal',
      target_users: 'all',
    });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      title: record.title,
      message: record.message,
      target_users: record.target_users ?? 'all',
      priority: record.priority ?? 'normal',
      is_active: record.is_active ?? true,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        title: values.title,
        message: values.message,
        target_users: values.target_users,
        priority: values.priority,
        is_active: values.is_active,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      };

      if (editing) {
        await updateAnnouncement.mutateAsync({ id: editing.id, data: payload });
      } else {
        await createAnnouncement.mutateAsync(payload);
      }

      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    } catch (err) {
      // Validation error already surfaced by AntD
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Announcement',
      content: `Delete "${record.title}"? This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => deleteAnnouncement.mutateAsync(record.id),
    });
  };

  const columns = [
    {
      title: 'TITLE',
      dataIndex: 'title',
      key: 'title',
      width: 240,
      render: (v) => <strong>{v}</strong>,
    },
    {
      title: 'PRIORITY',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (v) => <Tag color={PRIORITY_COLORS[v] || 'default'}>{(v || 'normal').toUpperCase()}</Tag>,
    },
    {
      title: 'TARGET',
      dataIndex: 'target_users',
      key: 'target_users',
      width: 140,
      render: (v) => TARGET_LABELS[v] || 'All Users',
    },
    {
      title: 'SCHEDULE',
      key: 'schedule',
      width: 240,
      render: (_, r) => {
        if (!r.start_date && !r.end_date) return <span>Always active</span>;
        return (
          <span>
            {r.start_date ? dayjs(r.start_date).format('MMM DD, YYYY') : '—'}
            {' → '}
            {r.end_date ? dayjs(r.end_date).format('MMM DD, YYYY') : 'No end'}
          </span>
        );
      },
    },
    {
      title: 'STATUS',
      dataIndex: 'is_active',
      key: 'status',
      width: 120,
      render: (v) => (v ? <Tag color="green">Active</Tag> : <Tag color="orange">Inactive</Tag>),
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      variant="borderless"
      title={<Space><NotificationOutlined /> System Announcements</Space>}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Create Announcement
        </Button>
      }
    >
      <Alert
        message="Broadcast messages to selected audiences"
        description="Announcements appear to matching users inside the app (and mobile, if supported). Target them by role, priority, and time window."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        rowKey="id"
        columns={columns}
        dataSource={announcements}
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title={editing ? 'Edit Announcement' : 'Create Announcement'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={createAnnouncement.isPending || updateAnnouncement.isPending}
        destroyOnHidden
        width={640}
        okText={editing ? 'Save Changes' : 'Create Announcement'}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="e.g., System Maintenance" maxLength={150} />
          </Form.Item>

          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Please enter a message' }]}
          >
            <TextArea
              rows={4}
              maxLength={5000}
              showCount
              placeholder="e.g., The system will be unavailable on September 20, 2026 from 10:00 PM to 11:00 PM."
            />
          </Form.Item>

          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="priority" label="Priority" style={{ minWidth: 160 }}>
              <Select
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
            </Form.Item>

            <Form.Item name="target_users" label="Target Users" style={{ minWidth: 180 }}>
              <Select
                options={[
                  { value: 'all', label: 'All Users' },
                  { value: 'customers', label: 'Customers' },
                  { value: 'admins', label: 'Admins' },
                  { value: 'staff', label: 'Staff' },
                ]}
              />
            </Form.Item>
          </Space>

          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="start_date" label="Start Date">
              <DatePicker style={{ width: 180 }} />
            </Form.Item>

            <Form.Item name="end_date" label="End Date">
              <DatePicker style={{ width: 180 }} />
            </Form.Item>
          </Space>

          <Form.Item name="is_active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AnnouncementsPanel;