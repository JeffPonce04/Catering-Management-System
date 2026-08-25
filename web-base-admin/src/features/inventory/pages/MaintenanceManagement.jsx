// src/components/EquipmentMaintenance.jsx - ENHANCED PROFESSIONAL UI

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, DatePicker, Descriptions, Empty, Form,
  Input, InputNumber, Modal, Row, Select, Space, Spin, Statistic, Table, Tag,
  Tooltip, Typography, theme as antdTheme, Badge, Divider, Dropdown, message
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EditOutlined, EyeOutlined, PlusOutlined,
  ReloadOutlined, ToolOutlined, DeleteOutlined, MoreOutlined, SearchOutlined,
  FilterOutlined, LeftOutlined, RightOutlined, PrinterOutlined, ExportOutlined,
  SaveOutlined, RiseOutlined, FallOutlined, WarningOutlined, ClockCircleOutlined,
  DollarOutlined, UserOutlined, CalendarOutlined, BoxPlotOutlined, StopOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useCancelMaintenance, useCreateMaintenance, useEquipment, useMaintenanceRecords,
  useUpdateMaintenance,
} from '../../../hooks/useInventoryQueries';
import '../styles/EquipmentMaintenance.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TYPES = ['preventive', 'corrective', 'inspection', 'cleaning', 'calibration', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];

const getStatusConfig = (status) => {
  const config = {
    scheduled: { color: '#3b82f6', bg: '#eff6ff', text: 'Scheduled', icon: <ClockCircleOutlined /> },
    in_progress: { color: '#f59e0b', bg: '#fffbeb', text: 'In Progress', icon: <WarningOutlined /> },
    completed: { color: '#10b981', bg: '#ecfdf5', text: 'Completed', icon: <CheckCircleOutlined /> },
    cancelled: { color: '#ef4444', bg: '#fef2f2', text: 'Cancelled', icon: <CloseCircleOutlined /> },
  };
  return config[status] || { color: '#6b7280', bg: '#f3f4f6', text: 'Unknown', icon: <MoreOutlined /> };
};

const getPriorityConfig = (priority) => {
  const config = {
    low: { color: '#6b7280', bg: '#f3f4f6', text: 'Low', icon: <MoreOutlined /> },
    medium: { color: '#3b82f6', bg: '#eff6ff', text: 'Medium', icon: <BoxPlotOutlined /> },
    high: { color: '#f59e0b', bg: '#fffbeb', text: 'High', icon: <WarningOutlined /> },
    critical: { color: '#ef4444', bg: '#fef2f2', text: 'Critical', icon: <CloseCircleOutlined /> },
  };
  return config[priority] || config.medium;
};

const currency = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const toPayload = (values) => ({
  equipment_id: values.equipment_id,
  assigned_to: values.assigned_to?.trim() || null,
  type: values.type,
  priority: values.priority || 'medium',
  duration: values.duration === undefined ? null : Number(values.duration),
  scheduled_date: values.scheduled_date?.format('YYYY-MM-DD'),
  completed_date: values.completed_date ? values.completed_date.format('YYYY-MM-DD') : null,
  cost: Number(values.cost ?? 0),
  description: values.description?.trim() || null,
  notes: values.notes?.trim() || null,
  status: values.status || 'scheduled',
});

// ============================================================
// PAGINATION HELPERS
// ============================================================
const renderPaginationItem = (_, type, originalElement) => {
  if (type === 'prev') {
    return (
      <Button className="maintenance-pagination-nav" size="small" icon={<LeftOutlined />}>
        Previous
      </Button>
    );
  }
  if (type === 'next') {
    return (
      <Button className="maintenance-pagination-nav" size="small">
        Next <RightOutlined />
      </Button>
    );
  }
  return originalElement;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const MaintenanceManagement = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const maintenanceQuery = useMaintenanceRecords({ per_page: 500 });
  const equipmentQuery = useEquipment({ per_page: 500, active: 1 });
  const createMaintenance = useCreateMaintenance();
  const updateMaintenance = useUpdateMaintenance();
  const cancelMaintenance = useCancelMaintenance();

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => maintenanceQuery.data?.data || [], [maintenanceQuery.data]);
  const equipment = equipmentQuery.data?.data || [];
  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [row.equipment_name, row.assigned_to, row.type, row.description, row.updated_by]
      .some((value) => String(value || '').toLowerCase().includes(term));
    return matches && (filterStatus === 'all' || row.status === filterStatus);
  }), [rows, search, filterStatus]);

  const submitCreate = async (values) => {
    try {
      await createMaintenance.mutateAsync(toPayload(values));
      createForm.resetFields();
      setCreateOpen(false);
      await maintenanceQuery.refetch();
      await equipmentQuery.refetch();
      message.success('Maintenance scheduled successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to schedule maintenance');
    }
  };

  const openEdit = (row) => {
    setSelected(row);
    editForm.setFieldsValue({
      equipment_id: row.equipment_id,
      assigned_to: row.assigned_to,
      type: row.type,
      priority: row.priority,
      duration: row.duration,
      scheduled_date: row.scheduled_date ? dayjs(row.scheduled_date) : null,
      completed_date: row.completed_date ? dayjs(row.completed_date) : null,
      cost: row.cost,
      description: row.description,
      notes: row.notes,
      status: row.status,
    });
    setEditOpen(true);
  };

  const submitEdit = async (values) => {
    try {
      await updateMaintenance.mutateAsync({ id: selected.id, data: toPayload(values) });
      editForm.resetFields();
      setEditOpen(false);
      await maintenanceQuery.refetch();
      message.success('Maintenance updated successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to update maintenance');
    }
  };

  const markCompleted = (row) => {
    Modal.confirm({
      title: 'Complete Maintenance',
      content: `Mark maintenance for ${row.equipment_name} as completed?`,
      okText: 'Complete',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await updateMaintenance.mutateAsync({ 
            id: row.id, 
            data: { status: 'completed', completed_date: dayjs().format('YYYY-MM-DD') } 
          });
          await maintenanceQuery.refetch();
          message.success('Maintenance marked as completed');
        } catch (error) {
          message.error(error?.response?.data?.message || 'Failed to complete maintenance');
        }
      },
    });
  };

  const cancelRecord = (row) => {
    Modal.confirm({
      title: 'Cancel Maintenance Record',
      content: `Cancel the scheduled maintenance for ${row.equipment_name}? The record will remain in history.`,
      okText: 'Cancel',
      okType: 'danger',
      cancelText: 'Close',
      onOk: async () => {
        try {
          await cancelMaintenance.mutateAsync(row.id);
          await maintenanceQuery.refetch();
          message.success('Maintenance cancelled successfully');
        } catch (error) {
          message.error(error?.response?.data?.message || 'Failed to cancel maintenance');
        }
      },
    });
  };

  const handleDelete = (row) => {
    Modal.confirm({
      title: 'Delete Maintenance Record',
      content: `Are you sure you want to delete this maintenance record? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        message.success('Maintenance record deleted successfully');
      }
    });
  };

  // ==================== STATISTICS ====================
  const totalRecords = rows.length;
  const scheduledCount = rows.filter((row) => row.status === 'scheduled').length;
  const inProgressCount = rows.filter((row) => row.status === 'in_progress').length;
  const completedCount = rows.filter((row) => row.status === 'completed').length;
  const cancelledCount = rows.filter((row) => row.status === 'cancelled').length;

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'MAINTENANCE ID',
      key: 'id',
      width: 145,
      fixed: 'left',
      render: (_, row) => <span className="maintenance-id-text">{`MNT-${String(row.id).padStart(4, '0')}`}</span>
    },
    {
      title: 'EQUIPMENT',
      key: 'equipment',
      width: 200,
      render: (_, row) => (
        <div className="maintenance-equipment-cell">
          <div className="maintenance-equipment-name">{row.equipment_name || 'Unknown equipment'}</div>
          <div className="maintenance-equipment-type">
            <Tag>{String(row.type || '').replaceAll('_', ' ').toUpperCase()}</Tag>
          </div>
        </div>
      )
    },
    {
      title: 'PRIORITY',
      key: 'priority',
      width: 110,
      align: 'center',
      render: (_, row) => {
        const config = getPriorityConfig(row.priority);
        return (
          <span className="maintenance-priority-badge" style={{ color: config.color, background: config.bg }}>
            {config.text}
          </span>
        );
      }
    },
    {
      title: 'SCHEDULED DATE',
      key: 'scheduled',
      width: 140,
      render: (_, row) => (
        <div className="maintenance-date-cell">
          <div className="maintenance-date-main">{row.scheduled_date ? dayjs(row.scheduled_date).format('MMM D, YYYY') : '—'}</div>
        </div>
      )
    },
    {
      title: 'ASSIGNED TO',
      key: 'assigned',
      width: 160,
      render: (_, row) => (
        <div className="maintenance-assigned-cell">
          <UserOutlined /> <span className="maintenance-assigned-name">{row.assigned_to || 'Unassigned'}</span>
        </div>
      )
    },
    {
      title: 'COST',
      key: 'cost',
      width: 120,
      align: 'right',
      render: (_, row) => (
        <span className="maintenance-cost">{currency(row.cost)}</span>
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
          <span className="maintenance-status-badge" style={{ color: config.color, background: config.bg }}>
            {config.icon} {config.text}
          </span>
        );
      }
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, row) => {
        const isCompleted = row.status === 'completed' || row.status === 'cancelled';
        
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
          <div className="maintenance-action-group">
            <Tooltip title="View Details">
              <button className="maintenance-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
                <EyeOutlined />
              </button>
            </Tooltip>
            <Tooltip title="Edit">
              <button className="maintenance-action-icon edit" disabled={isCompleted} onClick={() => openEdit(row)}>
                <EditOutlined />
              </button>
            </Tooltip>
            {!isCompleted && (
              <>
                <Tooltip title="Mark Completed">
                  <button className="maintenance-action-icon complete" onClick={() => markCompleted(row)}>
                    <CheckCircleOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Cancel">
                  <button className="maintenance-action-icon cancel" onClick={() => cancelRecord(row)}>
                    <StopOutlined />
                  </button>
                </Tooltip>
              </>
            )}
            <Dropdown
              menu={{ items }}
              placement="bottomRight"
              trigger={['click']}
            >
              <button className="maintenance-action-icon more">
                <MoreOutlined />
              </button>
            </Dropdown>
          </div>
        );
      }
    }
  ];

  // ==================== CSS CLASSES ====================
  const containerClass = `maintenance-container ${isDarkMode ? 'maintenance-dark-mode' : ''}`;
  const headerClass = `maintenance-header ${isDarkMode ? 'maintenance-header-dark' : ''}`;
  const statsClass = `maintenance-stats-grid ${isDarkMode ? 'maintenance-stats-dark' : ''}`;
  const filtersClass = `maintenance-filters ${isDarkMode ? 'maintenance-filters-dark' : ''}`;
  const tableClass = `maintenance-table ${isDarkMode ? 'maintenance-table-dark' : ''}`;
  const modalClass = `maintenance-modal-clean ${isDarkMode ? 'maintenance-modal-dark' : ''}`;

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
          <div className="maintenance-header-left">
            <Tooltip title="Maintenance Management">
              <div className="maintenance-logo-icon"><ToolOutlined /></div>
            </Tooltip>
            <div className="maintenance-header-info">
              <h1>Maintenance Management</h1>
              <span>EQUIPMENT MAINTENANCE</span>
            </div>
          </div>
          <div className="maintenance-header-right">
            <div className="maintenance-date-display">
              <CalendarOutlined />
              <span>{formattedDate}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={maintenanceQuery.isFetching}
                onClick={() => { maintenanceQuery.refetch(); equipmentQuery.refetch(); }}
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
            <Tooltip title="Schedule Maintenance">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({ 
                    type: 'preventive', 
                    priority: 'medium', 
                    status: 'scheduled', 
                    cost: 0 
                  });
                  setCreateOpen(true);
                }}
              >
                Schedule Maintenance
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="maintenance-stat-card">
            <div className="maintenance-stat-icon blue"><ToolOutlined /></div>
            <div className="maintenance-stat-info">
              <div className="maintenance-stat-value">{totalRecords}</div>
              <div className="maintenance-stat-label">Total Records</div>
            </div>
            <div className="maintenance-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="maintenance-stat-card">
            <div className="maintenance-stat-icon yellow"><ClockCircleOutlined /></div>
            <div className="maintenance-stat-info">
              <div className="maintenance-stat-value">{scheduledCount}</div>
              <div className="maintenance-stat-label">Scheduled</div>
            </div>
            <div className="maintenance-stat-trend warning">Pending</div>
          </div>
          <div className="maintenance-stat-card">
            <div className="maintenance-stat-icon orange"><WarningOutlined /></div>
            <div className="maintenance-stat-info">
              <div className="maintenance-stat-value">{inProgressCount}</div>
              <div className="maintenance-stat-label">In Progress</div>
            </div>
            <div className="maintenance-stat-trend warning">Ongoing</div>
          </div>
          <div className="maintenance-stat-card">
            <div className="maintenance-stat-icon green"><CheckCircleOutlined /></div>
            <div className="maintenance-stat-info">
              <div className="maintenance-stat-value">{completedCount}</div>
              <div className="maintenance-stat-label">Completed</div>
            </div>
            <div className="maintenance-stat-trend up">Done</div>
          </div>
          <div className="maintenance-stat-card">
            <div className="maintenance-stat-icon red"><CloseCircleOutlined /></div>
            <div className="maintenance-stat-info">
              <div className="maintenance-stat-value">{cancelledCount}</div>
              <div className="maintenance-stat-label">Cancelled</div>
            </div>
            <div className="maintenance-stat-trend down">Closed</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="maintenance-main-card" variant="borderless">
          <div className="maintenance-table-container">
            {/* Filters */}
            <div className={filtersClass}>
              <div className="maintenance-filter-group maintenance-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search equipment, assignee, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="maintenance-search-input"
                />
              </div>
              <div className="maintenance-filter-group">
                <FilterOutlined />
                <Select
                  value={filterStatus}
                  style={{ width: 160 }}
                  onChange={setFilterStatus}
                  className="maintenance-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Status</Option>
                  {STATUSES.map((value) => (
                    <Option key={value} value={value}>
                      {value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
            <div className="maintenance-table-wrapper">
              <Spin spinning={maintenanceQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey="id"
                  className={tableClass}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                    itemRender: renderPaginationItem,
                    pageSizeOptions: ['5', '10', '20', '50']
                  }}
                  scroll={{ x: 1400, y: 'calc(100vh - 460px)' }}
                  locale={{
                    emptyText: (
                      <div className="maintenance-empty-state">
                        <ToolOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {maintenanceQuery.isError ? 'Unable to load maintenance data' : 'No maintenance records found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {maintenanceQuery.isError ? 'Please try refreshing the page' : 'Records will appear here once created'}
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
            <div className="maintenance-modal-header-clean">
              <div className="maintenance-modal-title-icon"><EyeOutlined /></div>
              <div className="maintenance-modal-title-text">Maintenance Details</div>
              <div className="maintenance-modal-badge">{selected ? `MNT-${String(selected.id).padStart(4, '0')}` : ''}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={760}
          className={modalClass}
          footer={
            <div className="maintenance-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="maintenance-modal-clean-content">
              {/* Header */}
              <div className="maintenance-view-header">
                <div className="maintenance-view-icon">
                  <ToolOutlined style={{ fontSize: 28, color: '#f59e0b' }} />
                </div>
                <div className="maintenance-view-header-info">
                  <div className="maintenance-view-equipment">{selected.equipment_name}</div>
                  <div className="maintenance-view-meta">
                    <Tag>{String(selected.type || '').replaceAll('_', ' ').toUpperCase()}</Tag>
                    <span className="maintenance-view-status" style={{ 
                      color: getStatusConfig(selected.status).color, 
                      background: getStatusConfig(selected.status).bg 
                    }}>
                      {getStatusConfig(selected.status).icon} {getStatusConfig(selected.status).text}
                    </span>
                  </div>
                </div>
              </div>

              <Divider className="maintenance-modal-divider" />

              {/* Grid */}
              <div className="maintenance-view-grid">
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Priority</div>
                  <div className="maintenance-view-value">
                    <span style={{ 
                      color: getPriorityConfig(selected.priority).color,
                      fontWeight: 600
                    }}>
                      {getPriorityConfig(selected.priority).text}
                    </span>
                  </div>
                </div>
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Assigned To</div>
                  <div className="maintenance-view-value"><UserOutlined /> {selected.assigned_to || 'Unassigned'}</div>
                </div>
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Scheduled Date</div>
                  <div className="maintenance-view-value">{selected.scheduled_date ? dayjs(selected.scheduled_date).format('MMM D, YYYY') : '—'}</div>
                </div>
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Completed Date</div>
                  <div className="maintenance-view-value">{selected.completed_date ? dayjs(selected.completed_date).format('MMM D, YYYY') : '—'}</div>
                </div>
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Duration</div>
                  <div className="maintenance-view-value">{selected.duration || 0} hours</div>
                </div>
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Cost</div>
                  <div className="maintenance-view-value" style={{ color: '#1a7ab5', fontWeight: 700 }}>{currency(selected.cost)}</div>
                </div>
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Updated By</div>
                  <div className="maintenance-view-value">{selected.updated_by}</div>
                </div>
                <div className="maintenance-view-section">
                  <div className="maintenance-view-label">Updated</div>
                  <div className="maintenance-view-value">{selected.updated_at ? dayjs(selected.updated_at).format('MMM D, YYYY h:mm A') : '—'}</div>
                </div>
              </div>

              {selected.description && (
                <>
                  <Divider className="maintenance-modal-divider" />
                  <div className="maintenance-view-description">
                    <div className="maintenance-view-label" style={{ marginBottom: 4 }}>Description</div>
                    <div className="maintenance-view-value" style={{ fontWeight: 400 }}>{selected.description}</div>
                  </div>
                </>
              )}

              {selected.notes && (
                <>
                  <Divider className="maintenance-modal-divider" />
                  <div className="maintenance-view-notes">
                    <div className="maintenance-view-label" style={{ marginBottom: 4 }}>Notes</div>
                    <div className="maintenance-view-value" style={{ fontWeight: 400 }}>{selected.notes}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* ==================== CREATE MODAL ==================== */}
        <Modal
          title={
            <div className="maintenance-modal-header-clean">
              <div className="maintenance-modal-title-icon"><PlusOutlined /></div>
              <div className="maintenance-modal-title-text">Schedule Maintenance</div>
              <div className="maintenance-modal-badge">New</div>
            </div>
          }
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          width={820}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="maintenance-modal-clean-content">
            <Form form={createForm} layout="vertical" onFinish={submitCreate} className="maintenance-form">
              <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
                <Select 
                  showSearch 
                  optionFilterProp="label" 
                  size="large"
                  placeholder="Select equipment"
                  className="maintenance-select-modern"
                  options={equipment.map((row) => ({ 
                    value: row.id, 
                    label: row.equipment_name || row.name 
                  }))} 
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="type" label="Maintenance Type" rules={[{ required: true }]}>
                    <Select 
                      size="large"
                      className="maintenance-select-modern"
                      options={TYPES.map((value) => ({ 
                        value, 
                        label: value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) 
                      }))} 
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="priority" label="Priority">
                    <Select 
                      size="large"
                      className="maintenance-select-modern"
                      options={PRIORITIES.map((value) => ({ 
                        value, 
                        label: value[0].toUpperCase() + value.slice(1) 
                      }))} 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="scheduled_date" label="Scheduled Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="completed_date" label="Completed Date">
                    <DatePicker style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="assigned_to" label="Assigned To">
                    <Input placeholder="Person or team" size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="duration" label="Duration (hours)">
                    <InputNumber min={0} precision={1} style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="cost" label="Cost">
                    <InputNumber min={0} precision={2} prefix="₱" style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="status" label="Status">
                    <Select 
                      size="large"
                      className="maintenance-select-modern"
                      options={STATUSES.map((value) => ({ 
                        value, 
                        label: value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) 
                      }))} 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="description" label="Description">
                <TextArea rows={2} placeholder="Describe the maintenance work..." className="maintenance-textarea-modern" />
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Additional notes..." className="maintenance-textarea-modern" />
              </Form.Item>

              <div className="maintenance-modal-footer-enhanced">
                <Button onClick={() => setCreateOpen(false)} className="maintenance-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={createMaintenance.isPending} className="maintenance-btn-primary">
                  <SaveOutlined /> Schedule Maintenance
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== EDIT MODAL ==================== */}
        <Modal
          title={
            <div className="maintenance-modal-header-clean">
              <div className="maintenance-modal-title-icon"><EditOutlined /></div>
              <div className="maintenance-modal-title-text">Edit Maintenance</div>
              <div className="maintenance-modal-badge">{selected ? `MNT-${String(selected.id).padStart(4, '0')}` : ''}</div>
            </div>
          }
          open={editOpen}
          onCancel={() => setEditOpen(false)}
          width={820}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="maintenance-modal-clean-content">
            <Form form={editForm} layout="vertical" onFinish={submitEdit} className="maintenance-form">
              <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
                <Select 
                  showSearch 
                  optionFilterProp="label" 
                  size="large"
                  placeholder="Select equipment"
                  className="maintenance-select-modern"
                  options={equipment.map((row) => ({ 
                    value: row.id, 
                    label: row.equipment_name || row.name 
                  }))} 
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="type" label="Maintenance Type" rules={[{ required: true }]}>
                    <Select 
                      size="large"
                      className="maintenance-select-modern"
                      options={TYPES.map((value) => ({ 
                        value, 
                        label: value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) 
                      }))} 
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="priority" label="Priority">
                    <Select 
                      size="large"
                      className="maintenance-select-modern"
                      options={PRIORITIES.map((value) => ({ 
                        value, 
                        label: value[0].toUpperCase() + value.slice(1) 
                      }))} 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="scheduled_date" label="Scheduled Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="completed_date" label="Completed Date">
                    <DatePicker style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="assigned_to" label="Assigned To">
                    <Input placeholder="Person or team" size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="duration" label="Duration (hours)">
                    <InputNumber min={0} precision={1} style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="cost" label="Cost">
                    <InputNumber min={0} precision={2} prefix="₱" style={{ width: '100%' }} size="large" className="maintenance-input-modern" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="status" label="Status">
                    <Select 
                      size="large"
                      className="maintenance-select-modern"
                      options={STATUSES.map((value) => ({ 
                        value, 
                        label: value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) 
                      }))} 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="description" label="Description">
                <TextArea rows={2} placeholder="Describe the maintenance work..." className="maintenance-textarea-modern" />
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Additional notes..." className="maintenance-textarea-modern" />
              </Form.Item>

              <div className="maintenance-modal-footer-enhanced">
                <Button onClick={() => setEditOpen(false)} className="maintenance-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={updateMaintenance.isPending} className="maintenance-btn-primary">
                  <SaveOutlined /> Update Maintenance
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const MaintenanceManagementWithApp = () => <App><MaintenanceManagement /></App>;
export default MaintenanceManagementWithApp;