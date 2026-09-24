import React, { useState } from 'react';
import {
  Alert, Button, Card, Form, Input, InputNumber, Modal, Space, Switch, Table, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, TruckOutlined,
} from '@ant-design/icons';
import {
  useDeliveryZones,
  useCreateDeliveryZone,
  useUpdateDeliveryZone,
  useDeleteDeliveryZone,
  useToggleDeliveryZone,
} from '../../../hooks/useSettingsQueries';

const DeliverySettingsPanel = () => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const { data: zones = [], isLoading } = useDeliveryZones({ search, all: true });
  const createZone = useCreateDeliveryZone();
  const updateZone = useUpdateDeliveryZone();
  const deleteZone = useDeleteDeliveryZone();
  const toggleZone = useToggleDeliveryZone();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, delivery_fee: 0 });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      delivery_fee: Number(record.delivery_fee ?? record.fee ?? 0),
      description: record.description ?? record.remarks ?? '',
      is_active: record.is_active ?? true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateZone.mutateAsync({ id: editing.delivery_zone_id, data: values });
      } else {
        await createZone.mutateAsync(values);
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
      title: 'Deactivate Delivery Location',
      content: `Deactivate "${record.name}"? Existing bookings keep their original delivery fee.`,
      okText: 'Deactivate',
      okType: 'danger',
      onOk: () => deleteZone.mutateAsync(record.delivery_zone_id),
    });
  };

  const columns = [
    { title: 'LOCATION', dataIndex: 'name', key: 'name', width: 220 },
    {
      title: 'DELIVERY FEE',
      key: 'fee',
      width: 160,
      render: (_, r) => (
        <strong>₱{Number(r.delivery_fee ?? r.fee ?? 0).toFixed(2)}</strong>
      ),
    },
    {
      title: 'DESCRIPTION',
      key: 'description',
      render: (_, r) => r.description || r.remarks || '—',
    },
    {
      title: 'STATUS',
      dataIndex: 'is_active',
      key: 'status',
      width: 130,
      render: (v) => (v ? <Tag color="green">Active</Tag> : <Tag color="orange">Inactive</Tag>),
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 220,
      align: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={r.is_active ? 'Deactivate' : 'Activate'}>
            <Switch
              size="small"
              checked={!!r.is_active}
              onChange={() => toggleZone.mutateAsync(r.delivery_zone_id)}
            />
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
      title={<Space><TruckOutlined /> Delivery Settings</Space>}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Delivery Location
        </Button>
      }
    >
      <Alert
        message="Delivery fees are applied to bookings automatically"
        description="When a customer selects a delivery location during booking, the corresponding fee is added to the booking total."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Input
        placeholder="Search location..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ maxWidth: 340, marginBottom: 16 }}
      />

      <Table
        rowKey="delivery_zone_id"
        columns={columns}
        dataSource={zones}
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title={editing ? 'Edit Delivery Location' : 'Add Delivery Location'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={createZone.isPending || updateZone.isPending}
        destroyOnHidden
        okText={editing ? 'Save Changes' : 'Create Location'}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="Location Name"
            rules={[{ required: true, message: 'Please enter a location name' }]}
          >
            <Input placeholder="e.g., Poblacion" />
          </Form.Item>

          <Form.Item
            name="delivery_fee"
            label="Delivery Fee (₱)"
            rules={[{ required: true, message: 'Please enter a delivery fee' }]}
          >
            <InputNumber
              min={0}
              step={1}
              precision={2}
              style={{ width: '100%' }}
              prefix="₱"
              placeholder="e.g., 56.00"
            />
          </Form.Item>

          <Form.Item name="description" label="Description / Remarks">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>

          <Form.Item name="is_active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DeliverySettingsPanel;