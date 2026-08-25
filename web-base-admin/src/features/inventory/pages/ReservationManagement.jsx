// src/components/EquipmentReservation.jsx - FIXED DROPDOWN

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, DatePicker, Descriptions, Empty, Form,
  Input, InputNumber, Modal, Row, Select, Space, Spin, Statistic, Table, Tag,
  Tooltip, Typography, theme as antdTheme, Badge, Divider, Dropdown, message
} from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, EditOutlined, EyeOutlined, PlusOutlined,
  ReloadOutlined, RollbackOutlined, DeleteOutlined, MoreOutlined, SearchOutlined,
  FilterOutlined, LeftOutlined, RightOutlined, PrinterOutlined, ExportOutlined,
  SaveOutlined, RiseOutlined, FallOutlined, WarningOutlined, CloseOutlined,
  BoxPlotOutlined, DollarOutlined, EnvironmentOutlined, UserOutlined, ClockCircleOutlined,
  StopOutlined, CheckOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useCreateEquipmentReservation, useEquipment, useEquipmentReservations,
  useReturnEquipmentReservation, useUpdateEquipmentReservation,
} from '../../../hooks/useInventoryQueries';
import '../styles/EquipmentReservation.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const getStatusConfig = (status) => {
  const config = {
    reserved: { color: '#f59e0b', bg: '#fffbeb', text: 'Reserved', icon: <ClockCircleOutlined /> },
    checked_out: { color: '#1a7ab5', bg: '#e6f0fa', text: 'Checked Out', icon: <CheckCircleOutlined /> },
    returned: { color: '#10b981', bg: '#ecfdf5', text: 'Returned', icon: <CheckOutlined /> },
    cancelled: { color: '#ef4444', bg: '#fef2f2', text: 'Cancelled', icon: <CloseOutlined /> },
  };
  return config[status] || { color: '#6b7280', bg: '#f3f4f6', text: 'Unknown', icon: <MoreOutlined /> };
};

// ============================================================
// PAGINATION HELPERS
// ============================================================
const renderPaginationItem = (_, type, originalElement) => {
  if (type === 'prev') {
    return (
      <Button className="reservation-pagination-nav" size="small" icon={<LeftOutlined />}>
        Previous
      </Button>
    );
  }
  if (type === 'next') {
    return (
      <Button className="reservation-pagination-nav" size="small">
        Next <RightOutlined />
      </Button>
    );
  }
  return originalElement;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const ReservationManagement = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  const reservationsQuery = useEquipmentReservations({ per_page: 500 });
  const equipmentQuery = useEquipment({ per_page: 500, active: 1 });
  const createReservation = useCreateEquipmentReservation();
  const updateReservation = useUpdateEquipmentReservation();
  const returnReservation = useReturnEquipmentReservation();

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => reservationsQuery.data?.data || [], [reservationsQuery.data]);
  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [row.equipment_name, row.booking_no, row.customer_name, row.event_name]
      .some((value) => String(value || '').toLowerCase().includes(term));
    return matches && (filterStatus === 'all' || row.status === filterStatus);
  }), [rows, search, filterStatus]);

  const equipment = equipmentQuery.data?.data || [];

  const submitCreate = async (values) => {
    try {
      await createReservation.mutateAsync({
        booking_id: values.booking_id,
        equipment_id: values.equipment_id,
        quantity_reserved: Number(values.quantity),
        rental_start_date: values.event_date ? values.event_date.format('YYYY-MM-DD') : undefined,
      });
      createForm.resetFields();
      setCreateOpen(false);
      await reservationsQuery.refetch();
      await equipmentQuery.refetch();
      message.success('Equipment reserved successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to reserve equipment');
    }
  };

  const openEdit = (row) => {
    setSelected(row);
    editForm.setFieldsValue({
      quantity_reserved: row.quantity_reserved,
      rental_end_date: row.rental_end_date ? dayjs(row.rental_end_date) : null,
      notes: row.notes,
    });
    setEditOpen(true);
  };

  const submitEdit = async (values) => {
    try {
      await updateReservation.mutateAsync({
        id: selected.id,
        data: {
          quantity_reserved: Number(values.quantity_reserved),
          rental_end_date: values.rental_end_date ? values.rental_end_date.format('YYYY-MM-DD') : undefined,
          notes: values.notes?.trim() || null,
        },
      });
      editForm.resetFields();
      setEditOpen(false);
      await reservationsQuery.refetch();
      await equipmentQuery.refetch();
      message.success('Reservation updated successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to update reservation');
    }
  };

  const openReturn = (row) => {
    setSelected(row);
    returnForm.setFieldsValue({ 
      quantity_used: row.quantity_reserved, 
      quantity_damaged: 0, 
      quantity_missing: 0, 
      notes: '' 
    });
    setReturnOpen(true);
  };

  const submitReturn = async (values) => {
    try {
      await returnReservation.mutateAsync({
        id: selected.id,
        data: {
          quantity_used: Number(values.quantity_used || 0),
          quantity_damaged: Number(values.quantity_damaged || 0),
          quantity_missing: Number(values.quantity_missing || 0),
          condition_notes_in: values.condition_notes_in?.trim() || null,
          notes: values.notes?.trim() || null,
        },
      });
      returnForm.resetFields();
      setReturnOpen(false);
      await reservationsQuery.refetch();
      await equipmentQuery.refetch();
      message.success('Equipment returned successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to return equipment');
    }
  };

  const handleDelete = (row) => {
    Modal.confirm({
      title: 'Delete Reservation',
      content: `Are you sure you want to delete this reservation? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        message.success('Reservation deleted successfully');
      }
    });
  };

  // ==================== STATISTICS ====================
  const totalReservations = rows.length;
  const reservedCount = rows.filter((row) => row.status === 'reserved').length;
  const checkedOutCount = rows.filter((row) => row.status === 'checked_out').length;
  const returnedCount = rows.filter((row) => row.status === 'returned').length;
  const reservedQty = rows.reduce((sum, row) => sum + Number(row.quantity_reserved || 0), 0);

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'RESERVATION ID',
      key: 'id',
      width: 130,
      fixed: 'left',
      render: (_, row) => <span className="reservation-id-text">{`RES-${String(row.id).padStart(4, '0')}`}</span>
    },
    {
      title: 'EQUIPMENT',
      key: 'equipment',
      width: 200,
      render: (_, row) => (
        <div className="reservation-equipment-cell">
          <div className="reservation-equipment-name">{row.equipment_name}</div>
          <div className="reservation-equipment-meta">
            <span className="reservation-equipment-qty">{row.quantity_reserved} pcs reserved</span>
          </div>
        </div>
      )
    },
    {
      title: 'EVENT DETAILS',
      key: 'event',
      width: 200,
      render: (_, row) => (
        <div className="reservation-event-cell">
          <div className="reservation-event-name">{row.event_name || '—'}</div>
          <div className="reservation-event-meta">
            <span className="reservation-event-booking">{row.booking_no || `Booking #${row.booking_id}`}</span>
            <span className="reservation-event-customer"><UserOutlined /> {row.customer_name || '—'}</span>
          </div>
        </div>
      )
    },
    {
      title: 'EVENT DATE',
      key: 'date',
      width: 130,
      render: (_, row) => (
        <div className="reservation-date-cell">
          <div className="reservation-date-main">{dayjs(row.event_date || row.rental_start_date).format('MMM D, YYYY')}</div>
        </div>
      )
    },
    {
      title: 'EXPECTED RETURN',
      key: 'return',
      width: 130,
      render: (_, row) => (
        <div className="reservation-return-cell">
          <div className="reservation-return-date">{row.rental_end_date ? dayjs(row.rental_end_date).format('MMM D, YYYY') : '—'}</div>
        </div>
      )
    },
    {
      title: 'STATUS',
      key: 'status',
      width: 140,
      align: 'center',
      render: (_, row) => {
        const config = getStatusConfig(row.status);
        return (
          <span className="reservation-status-badge" style={{ color: config.color, background: config.bg }}>
            {config.icon} {config.text}
          </span>
        );
      }
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, row) => {
        const items = [
          {
            key: 'delete',
            label: 'Delete',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDelete(row)
          }
        ];

        return (
          <div className="reservation-action-group">
            <Tooltip title="View Details">
              <button className="reservation-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
                <EyeOutlined />
              </button>
            </Tooltip>
            <Tooltip title="Edit">
              <button className="reservation-action-icon edit" onClick={() => openEdit(row)}>
                <EditOutlined />
              </button>
            </Tooltip>
            {row.status !== 'returned' && row.status !== 'cancelled' && (
              <Tooltip title="Return Equipment">
                <button className="reservation-action-icon return" onClick={() => openReturn(row)}>
                  <RollbackOutlined />
                </button>
              </Tooltip>
            )}
            <Dropdown
              menu={{ items }}
              placement="bottomRight"
              trigger={['click']}
            >
              <button className="reservation-action-icon more">
                <MoreOutlined />
              </button>
            </Dropdown>
          </div>
        );
      }
    }
  ];

  // ==================== CSS CLASSES ====================
  const containerClass = `reservation-container ${isDarkMode ? 'reservation-dark-mode' : ''}`;
  const headerClass = `reservation-header ${isDarkMode ? 'reservation-header-dark' : ''}`;
  const statsClass = `reservation-stats-grid ${isDarkMode ? 'reservation-stats-dark' : ''}`;
  const filtersClass = `reservation-filters ${isDarkMode ? 'reservation-filters-dark' : ''}`;
  const tableClass = `reservation-table ${isDarkMode ? 'reservation-table-dark' : ''}`;
  const modalClass = `reservation-modal-clean ${isDarkMode ? 'reservation-modal-dark' : ''}`;

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1a7ab5',
          colorBgContainer: isDarkMode ? '#0f1424' : '#ffffff',
          colorBorderSecondary: isDarkMode ? '#1a1f35' : '#eef2f8',
          colorText: isDarkMode ? '#e2e8f0' : '#1a2c3e',
          colorTextSecondary: isDarkMode ? '#8b93a8' : '#5a6e7c',
          borderRadius: 12,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Table: {
            headerBg: isDarkMode ? '#0a0e1a' : '#f8fafc',
            headerColor: isDarkMode ? '#cbd5e1' : '#1a2c3e',
            headerBorderRadius: 0,
          },
          Card: {
            borderRadiusLG: 16,
          },
          Modal: {
            borderRadiusLG: 20,
          },
          Button: {
            borderRadius: 10,
          },
          Input: {
            borderRadius: 10,
          },
          Select: {
            borderRadius: 10,
          },
        }
      }}
    >
      <div className={containerClass}>
        {/* ==================== HEADER ==================== */}
        <div className={headerClass}>
          <div className="reservation-header-left">
            <Tooltip title="Equipment Reservations">
              <div className="reservation-logo-icon"><CalendarOutlined /></div>
            </Tooltip>
            <div className="reservation-header-info">
              <h1>Equipment Reservations</h1>
              <span>INVENTORY MANAGEMENT</span>
            </div>
          </div>
          <div className="reservation-header-right">
            <div className="reservation-date-display">
              <CalendarOutlined />
              <span>{formattedDate}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={reservationsQuery.isFetching}
                onClick={() => { reservationsQuery.refetch(); equipmentQuery.refetch(); }}
              >
                Refresh
              </Button>
            </Tooltip>
            <Tooltip title="Export to Excel">
              <Button icon={<ExportOutlined />}>Export</Button>
            </Tooltip>
            <Tooltip title="Print current view">
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
            </Tooltip>
            <Tooltip title="Reserve Equipment">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({ quantity: 1 });
                  setCreateOpen(true);
                }}
              >
                Reserve Equipment
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="reservation-stat-card">
            <div className="reservation-stat-icon blue"><CalendarOutlined /></div>
            <div className="reservation-stat-info">
              <div className="reservation-stat-value">{totalReservations}</div>
              <div className="reservation-stat-label">Total Reservations</div>
            </div>
            <div className="reservation-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="reservation-stat-card">
            <div className="reservation-stat-icon yellow"><ClockCircleOutlined /></div>
            <div className="reservation-stat-info">
              <div className="reservation-stat-value">{reservedCount}</div>
              <div className="reservation-stat-label">Reserved</div>
            </div>
            <div className="reservation-stat-trend warning">Pending</div>
          </div>
          <div className="reservation-stat-card">
            <div className="reservation-stat-icon purple"><CheckCircleOutlined /></div>
            <div className="reservation-stat-info">
              <div className="reservation-stat-value">{checkedOutCount}</div>
              <div className="reservation-stat-label">Checked Out</div>
            </div>
            <div className="reservation-stat-trend up">In Progress</div>
          </div>
          <div className="reservation-stat-card">
            <div className="reservation-stat-icon green"><CheckOutlined /></div>
            <div className="reservation-stat-info">
              <div className="reservation-stat-value">{returnedCount}</div>
              <div className="reservation-stat-label">Returned</div>
            </div>
            <div className="reservation-stat-trend up">Completed</div>
          </div>
          <div className="reservation-stat-card">
            <div className="reservation-stat-icon orange"><BoxPlotOutlined /></div>
            <div className="reservation-stat-info">
              <div className="reservation-stat-value">{reservedQty}</div>
              <div className="reservation-stat-label">Reserved Units</div>
            </div>
            <div className="reservation-stat-trend up"><RiseOutlined /> +8%</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="reservation-main-card" variant="borderless">
          <div className="reservation-table-container">
            {/* Filters */}
            <div className={filtersClass}>
              <div className="reservation-filter-group reservation-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search equipment, booking, or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="reservation-search-input"
                />
              </div>
              <div className="reservation-filter-group">
                <FilterOutlined />
                <Select
                  value={filterStatus}
                  style={{ width: 160 }}
                  onChange={setFilterStatus}
                  className="reservation-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Status</Option>
                  <Option value="reserved">Reserved</Option>
                  <Option value="checked_out">Checked Out</Option>
                  <Option value="returned">Returned</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
            <div className="reservation-table-wrapper">
              <Spin spinning={reservationsQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey="id"
                  className={tableClass}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} reservations`,
                    itemRender: renderPaginationItem,
                    pageSizeOptions: ['5', '10', '20', '50']
                  }}
                  scroll={{ x: 1300, y: 'calc(100vh - 460px)' }}
                  locale={{
                    emptyText: (
                      <div className="reservation-empty-state">
                        <CalendarOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {reservationsQuery.isError ? 'Unable to load reservation data' : 'No equipment reservations found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {reservationsQuery.isError ? 'Please try refreshing the page' : 'Reservations will appear here once created'}
                        </p>
                      </div>
                    )
                  }}
                />
              </Spin>
            </div>
          </div>
        </Card>

        {/* ==================== VIEW MODAL ==================== */}
        <Modal
          title={
            <div className="reservation-modal-header-clean">
              <div className="reservation-modal-title-icon"><EyeOutlined /></div>
              <div className="reservation-modal-title-text">Reservation Details</div>
              <div className="reservation-modal-badge">{selected ? `RES-${String(selected.id).padStart(4, '0')}` : ''}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={760}
          className={modalClass}
          footer={
            <div className="reservation-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="reservation-modal-clean-content">
              {/* Header */}
              <div className="reservation-view-header">
                <div className="reservation-view-icon">
                  <CalendarOutlined style={{ fontSize: 28, color: '#1a7ab5' }} />
                </div>
                <div className="reservation-view-header-info">
                  <div className="reservation-view-equipment">{selected.equipment_name}</div>
                  <div className="reservation-view-meta">
                    <Tag>{selected.quantity_reserved} pcs</Tag>
                    <span className="reservation-view-status" style={{ 
                      color: getStatusConfig(selected.status).color, 
                      background: getStatusConfig(selected.status).bg 
                    }}>
                      {getStatusConfig(selected.status).icon} {getStatusConfig(selected.status).text}
                    </span>
                  </div>
                </div>
              </div>

              <Divider className="reservation-modal-divider" />

              {/* Grid */}
              <div className="reservation-view-grid">
                <div className="reservation-view-section">
                  <div className="reservation-view-label">Booking</div>
                  <div className="reservation-view-value">{selected.booking_no || `Booking #${selected.booking_id}`}</div>
                </div>
                <div className="reservation-view-section">
                  <div className="reservation-view-label">Event</div>
                  <div className="reservation-view-value">{selected.event_name || '—'}</div>
                </div>
                <div className="reservation-view-section">
                  <div className="reservation-view-label">Customer</div>
                  <div className="reservation-view-value"><UserOutlined /> {selected.customer_name || '—'}</div>
                </div>
                <div className="reservation-view-section">
                  <div className="reservation-view-label">Event Date</div>
                  <div className="reservation-view-value">{selected.event_date ? dayjs(selected.event_date).format('MMM D, YYYY') : '—'}</div>
                </div>
                <div className="reservation-view-section">
                  <div className="reservation-view-label">Expected Return</div>
                  <div className="reservation-view-value">{selected.rental_end_date ? dayjs(selected.rental_end_date).format('MMM D, YYYY') : '—'}</div>
                </div>
                <div className="reservation-view-section">
                  <div className="reservation-view-label">Checked Out</div>
                  <div className="reservation-view-value">{selected.checked_out_date ? dayjs(selected.checked_out_date).format('MMM D, YYYY h:mm A') : '—'}</div>
                </div>
              </div>

              {selected.notes && (
                <>
                  <Divider className="reservation-modal-divider" />
                  <div className="reservation-view-notes">
                    <div className="reservation-view-label" style={{ marginBottom: 4 }}>Notes</div>
                    <div className="reservation-view-value" style={{ fontWeight: 400 }}>{selected.notes}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* ==================== CREATE MODAL ==================== */}
        <Modal
          title={
            <div className="reservation-modal-header-clean">
              <div className="reservation-modal-title-icon"><PlusOutlined /></div>
              <div className="reservation-modal-title-text">Reserve Equipment</div>
              <div className="reservation-modal-badge">New</div>
            </div>
          }
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          width={680}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="reservation-modal-clean-content">
            <Form form={createForm} layout="vertical" onFinish={submitCreate} className="reservation-form">
              <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
                <Select 
                  showSearch 
                  optionFilterProp="label" 
                  size="large"
                  placeholder="Select equipment"
                  className="reservation-select-modern"
                  options={equipment.map((row) => ({ 
                    value: row.id, 
                    label: `${row.equipment_name || row.name} — ${row.available ?? row.available_quantity ?? 0} available` 
                  }))} 
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="booking_id" label="Booking ID" rules={[{ required: true }]}>
                    <InputNumber 
                      min={1} 
                      style={{ width: '100%' }} 
                      size="large"
                      placeholder="Enter booking ID"
                      className="reservation-input-modern"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="quantity" label="Quantity" rules={[{ required: true }, { type: 'number', min: 1 }]}>
                    <InputNumber 
                      min={1} 
                      style={{ width: '100%' }} 
                      size="large"
                      placeholder="1"
                      className="reservation-input-modern"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="event_date" label="Event Date">
                <DatePicker style={{ width: '100%' }} size="large" className="reservation-input-modern" />
              </Form.Item>

              <div className="reservation-modal-footer-enhanced">
                <Button onClick={() => setCreateOpen(false)} className="reservation-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={createReservation.isPending} className="reservation-btn-primary">
                  <SaveOutlined /> Create Reservation
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== EDIT MODAL ==================== */}
        <Modal
          title={
            <div className="reservation-modal-header-clean">
              <div className="reservation-modal-title-icon"><EditOutlined /></div>
              <div className="reservation-modal-title-text">Edit Reservation</div>
              <div className="reservation-modal-badge">{selected ? `RES-${String(selected.id).padStart(4, '0')}` : ''}</div>
            </div>
          }
          open={editOpen}
          onCancel={() => setEditOpen(false)}
          width={680}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="reservation-modal-clean-content">
            <Form form={editForm} layout="vertical" onFinish={submitEdit} className="reservation-form">
              <Form.Item name="quantity_reserved" label="Reserved Quantity" rules={[{ required: true }, { type: 'number', min: 1 }]}>
                <InputNumber min={1} style={{ width: '100%' }} size="large" className="reservation-input-modern" />
              </Form.Item>

              <Form.Item name="rental_end_date" label="Expected Return">
                <DatePicker style={{ width: '100%' }} size="large" className="reservation-input-modern" />
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes..." className="reservation-textarea-modern" />
              </Form.Item>

              <div className="reservation-modal-footer-enhanced">
                <Button onClick={() => setEditOpen(false)} className="reservation-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={updateReservation.isPending} className="reservation-btn-primary">
                  <SaveOutlined /> Update Reservation
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== RETURN MODAL ==================== */}
        <Modal
          title={
            <div className="reservation-modal-header-clean">
              <div className="reservation-modal-title-icon"><RollbackOutlined /></div>
              <div className="reservation-modal-title-text">Return Equipment</div>
              <div className="reservation-modal-badge">{selected?.equipment_name || 'Equipment'}</div>
            </div>
          }
          open={returnOpen}
          onCancel={() => setReturnOpen(false)}
          width={680}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="reservation-modal-clean-content">
            <div className="reservation-return-current">
              <div className="reservation-return-current-label">Current Reservation</div>
              <div className="reservation-return-current-value">
                <span className="reservation-return-current-number">{selected?.quantity_reserved || 0}</span>
                <span className="reservation-return-current-unit">pcs</span>
              </div>
            </div>

            <Divider className="reservation-modal-divider" />

            <Form form={returnForm} layout="vertical" onFinish={submitReturn} className="reservation-form">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="quantity_used" label="Returned / Used">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" className="reservation-input-modern" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="quantity_damaged" label="Damaged">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" className="reservation-input-modern" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="quantity_missing" label="Missing">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" className="reservation-input-modern" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="condition_notes_in" label="Condition on Return">
                <TextArea rows={2} placeholder="Describe the condition of returned equipment..." className="reservation-textarea-modern" />
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Additional notes..." className="reservation-textarea-modern" />
              </Form.Item>

              <div className="reservation-modal-footer-enhanced">
                <Button onClick={() => setReturnOpen(false)} className="reservation-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={returnReservation.isPending} className="reservation-btn-primary">
                  <SaveOutlined /> Complete Return
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const ReservationManagementWithApp = () => <App><ReservationManagement /></App>;
export default ReservationManagementWithApp;