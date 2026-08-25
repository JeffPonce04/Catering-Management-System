// src/components/EquipmentManagement.jsx - REMOVED IMAGE

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, DatePicker, Descriptions, Empty, Form, Input,
  InputNumber, Modal, Radio, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography,
  theme as antdTheme, Badge, Divider, Dropdown, message
} from 'antd';
import {
  CheckCircleOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined,
  StopOutlined, SwapOutlined, ToolOutlined, DeleteOutlined, MoreOutlined,
  SearchOutlined, FilterOutlined, LeftOutlined, RightOutlined, CalendarOutlined,
  PrinterOutlined, ExportOutlined, SaveOutlined, RiseOutlined,
  WarningOutlined, CloseOutlined, BoxPlotOutlined,
  EnvironmentOutlined, BarcodeOutlined, CheckOutlined,TagOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useCreateEquipment, useEquipment, useSetEquipmentActive, useUpdateEquipment,
} from '../../../hooks/useInventoryQueries';
import '../styles/EquipmentInventory.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const CATEGORY_OPTIONS = ['Kitchen', 'Dining', 'Bar', 'Cleaning', 'Storage', 'Transport', 'Office', 'Other'];

// ============================================================
// HELPERS
// ============================================================
const getConditionConfig = (condition) => {
  const config = {
    Excellent: { color: '#10b981', bg: '#ecfdf5', icon: <CheckCircleOutlined /> },
    Good: { color: '#3b82f6', bg: '#eff6ff', icon: <CheckCircleOutlined /> },
    Fair: { color: '#f59e0b', bg: '#fffbeb', icon: <WarningOutlined /> },
    Poor: { color: '#ef4444', bg: '#fef2f2', icon: <CloseOutlined /> },
  };
  return config[condition] || { color: '#6b7280', bg: '#f3f4f6', icon: <MoreOutlined /> };
};

const toPayload = (values) => ({
  name: values.equipment_name?.trim(),
  code: values.code?.trim() || null,
  category: values.category?.trim() || null,
  total_quantity: Number(values.total ?? 0),
  location: values.location?.trim() || null,
  supplier_id: values.supplier_id || null,
  model: values.model?.trim() || null,
  serial_number: values.serial_number?.trim() || null,
  condition: values.condition || 'Good',
  last_maintenance: values.last_maintenance ? values.last_maintenance.format('YYYY-MM-DD') : null,
  notes: values.notes?.trim() || null,
});

// ============================================================
// PAGINATION HELPERS
// ============================================================
const renderPaginationItem = (_, type, originalElement) => {
  if (type === 'prev') {
    return (
      <Button className="equipment-pagination-nav" size="small" icon={<LeftOutlined />}>
        Previous
      </Button>
    );
  }
  if (type === 'next') {
    return (
      <Button className="equipment-pagination-nav" size="small">
        Next <RightOutlined />
      </Button>
    );
  }
  return originalElement;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const EquipmentManagement = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterActivity, setFilterActivity] = useState('all');
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const equipmentQuery = useEquipment({ per_page: 500 });
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const setActive = useSetEquipmentActive();

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => (equipmentQuery.data?.data || []).map((row) => ({
    ...row,
    display_id: row.display_id || `EQP-${String(row.id).padStart(4, '0')}`,
    equipment_name: row.equipment_name || row.name,
    total: Number(row.total ?? row.total_quantity ?? 0),
    available: Number(row.available ?? row.available_quantity ?? 0),
    reserved: Number(row.reserved_quantity ?? 0),
    damaged: Number(row.damaged_quantity ?? 0),
    condition: row.condition || 'Good',
  })), [equipmentQuery.data]);

  const categories = useMemo(() => [...new Set(rows.map((row) => row.category).filter(Boolean))], [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const value = search.trim().toLowerCase();
    const matchesSearch = !value || [row.display_id, row.code, row.equipment_name, row.category, row.location, row.serial_number]
      .some((item) => String(item || '').toLowerCase().includes(value));
    return matchesSearch
      && (filterCategory === 'all' || row.category === filterCategory)
      && (filterCondition === 'all' || row.condition === filterCondition)
      && (filterActivity === 'all' || (filterActivity === 'active' ? row.is_active : !row.is_active));
  }), [rows, search, filterCategory, filterCondition, filterActivity]);

  const openEdit = (row) => {
    setSelected(row);
    editForm.setFieldsValue({
      equipment_name: row.equipment_name,
      code: row.code,
      category: row.category,
      total: row.total,
      location: row.location,
      supplier_id: row.supplier_id,
      model: row.model,
      serial_number: row.serial_number,
      condition: row.condition,
      last_maintenance: row.last_maintenance ? dayjs(row.last_maintenance) : null,
      notes: row.notes,
    });
    setEditOpen(true);
  };

  const submitCreate = async (values) => {
    try {
      await createEquipment.mutateAsync(toPayload(values));
      createForm.resetFields();
      setCreateOpen(false);
      await equipmentQuery.refetch();
      message.success('Equipment created successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to create equipment');
    }
  };

  const submitEdit = async (values) => {
    try {
      await updateEquipment.mutateAsync({ id: selected.id, data: toPayload(values) });
      editForm.resetFields();
      setEditOpen(false);
      await equipmentQuery.refetch();
      message.success('Equipment updated successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to update equipment');
    }
  };

  const submitAdjustment = async ({ adjustment_type, quantity, notes }) => {
    const amount = Number(quantity);
    const total = adjustment_type === 'increase'
      ? selected.total + amount
      : Math.max(0, selected.total - amount);
    try {
      await updateEquipment.mutateAsync({ id: selected.id, data: { total_quantity: total, notes: notes || selected.notes } });
      adjustForm.resetFields();
      setAdjustOpen(false);
      await equipmentQuery.refetch();
      message.success('Equipment quantity adjusted successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to adjust quantity');
    }
  };

  const toggleActive = (row) => {
    const next = !row.is_active;
    Modal.confirm({
      title: `${next ? 'Activate' : 'Deactivate'} Equipment`,
      content: `Are you sure you want to ${next ? 'activate' : 'deactivate'} ${row.equipment_name}?`,
      okText: next ? 'Activate' : 'Deactivate',
      okType: next ? 'primary' : 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await setActive.mutateAsync({ id: row.id, active: next });
          await equipmentQuery.refetch();
          message.success(`Equipment ${next ? 'activated' : 'deactivated'} successfully`);
        } catch (error) {
          message.error(error?.response?.data?.message || 'Failed to update status');
        }
      },
    });
  };

  const handleDelete = (row) => {
    Modal.confirm({
      title: 'Delete Equipment',
      content: `Are you sure you want to delete ${row.equipment_name}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        message.success(`${row.equipment_name} deleted successfully`);
      }
    });
  };

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'EQUIPMENT ID',
      dataIndex: 'display_id',
      key: 'id',
      width: 120,
      fixed: 'left',
      render: (value) => <span className="equipment-id-text">{value}</span>
    },
    {
      title: 'EQUIPMENT',
      key: 'equipment',
      width: 220,
      render: (_, row) => (
        <div className="equipment-product-cell">
          <div className="equipment-product-info">
            <div className="equipment-product-name">{row.equipment_name}</div>
            <div className="equipment-product-meta">
              <span className="equipment-product-code">{row.code || 'No Code'}</span>
              {row.model && <span className="equipment-product-model">{row.model}</span>}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'CATEGORY',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (value) => value ? <Tag className="equipment-category-tag">{value}</Tag> : <span className="equipment-no-category">—</span>
    },
    {
      title: 'STOCK',
      key: 'stock',
      width: 160,
      align: 'right',
      render: (_, row) => (
        <div className="equipment-stock-cell">
          <div className="equipment-stock-value">{row.total} <span className="equipment-stock-label">Total</span></div>
          <div className="equipment-stock-detail">
            <span className="equipment-stock-available">{row.available} Available</span>
            <span className="equipment-stock-reserved">{row.reserved} Reserved</span>
          </div>
        </div>
      )
    },
    {
      title: 'CONDITION',
      key: 'condition',
      width: 140,
      align: 'center',
      render: (_, row) => {
        const config = getConditionConfig(row.condition);
        return (
          <span className="equipment-condition-badge" style={{ color: config.color, background: config.bg }}>
            {config.icon} {row.condition || '—'}
          </span>
        );
      }
    },
    {
      title: 'LOCATION',
      dataIndex: 'location',
      key: 'location',
      width: 140,
      render: (value) => value ? <span className="equipment-location"><EnvironmentOutlined /> {value}</span> : '—'
    },
    {
      title: 'ACTIVITY',
      dataIndex: 'is_active',
      key: 'active',
      width: 110,
      align: 'center',
      render: (active) => (
        <Badge
          status={active ? 'success' : 'default'}
          text={active ? 'Active' : 'Inactive'}
          className="equipment-activity-badge"
        />
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, row) => (
        <div className="equipment-action-group">
          <Tooltip title="View Details">
            <button className="equipment-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
              <EyeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Edit">
            <button className="equipment-action-icon edit" onClick={() => openEdit(row)}>
              <EditOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Adjust Quantity">
            <button className="equipment-action-icon adjust" onClick={() => { setSelected(row); adjustForm.setFieldsValue({ adjustment_type: 'increase', quantity: 0 }); setAdjustOpen(true); }}>
              <SwapOutlined />
            </button>
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'toggle',
                  label: row.is_active ? 'Deactivate' : 'Activate',
                  icon: row.is_active ? <StopOutlined /> : <CheckCircleOutlined />,
                  onClick: () => toggleActive(row)
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleDelete(row)
                }
              ]
            }}
            placement="bottomRight"
            trigger={['click']}
          >
            <button className="equipment-action-icon more">
              <MoreOutlined />
            </button>
          </Dropdown>
        </div>
      )
    }
  ];

  // ==================== STATISTICS ====================
  const totalEquipment = rows.length;
  const totalUnits = rows.reduce((sum, row) => sum + row.total, 0);
  const availableUnits = rows.reduce((sum, row) => sum + row.available, 0);
  const activeRecords = rows.filter((row) => row.is_active).length;

  // ==================== CSS CLASSES ====================
  const containerClass = `equipment-container ${isDarkMode ? 'equipment-dark-mode' : ''}`;
  const headerClass = `equipment-header ${isDarkMode ? 'equipment-header-dark' : ''}`;
  const statsClass = `equipment-stats-grid ${isDarkMode ? 'equipment-stats-dark' : ''}`;
  const filtersClass = `equipment-filters ${isDarkMode ? 'equipment-filters-dark' : ''}`;
  const tableClass = `equipment-table ${isDarkMode ? 'equipment-table-dark' : ''}`;
  const modalClass = `equipment-modal-clean ${isDarkMode ? 'equipment-modal-dark' : ''}`;

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
          <div className="equipment-header-left">
            <Tooltip title="Equipment Management">
              <div className="equipment-logo-icon"><BoxPlotOutlined /></div>
            </Tooltip>
            <div className="equipment-header-info">
              <h1>Equipment Management</h1>
              <span>INVENTORY CONTROL</span>
            </div>
          </div>
          <div className="equipment-header-right">
            <div className="equipment-date-display">
              <CalendarOutlined />
              <span>{formattedDate}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={equipmentQuery.isFetching}
                onClick={() => equipmentQuery.refetch()}
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
            <Tooltip title="Add new equipment">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({
                    total: 1,
                    condition: 'Good'
                  });
                  setCreateOpen(true);
                }}
              >
                Add Equipment
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="equipment-stat-card">
            <div className="equipment-stat-icon blue"><ToolOutlined /></div>
            <div className="equipment-stat-info">
              <div className="equipment-stat-value">{totalEquipment}</div>
              <div className="equipment-stat-label">Equipment Records</div>
            </div>
            <div className="equipment-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="equipment-stat-card">
            <div className="equipment-stat-icon green"><BoxPlotOutlined /></div>
            <div className="equipment-stat-info">
              <div className="equipment-stat-value">{totalUnits}</div>
              <div className="equipment-stat-label">Total Units</div>
            </div>
            <div className="equipment-stat-trend up"><RiseOutlined /> +8%</div>
          </div>
          <div className="equipment-stat-card">
            <div className="equipment-stat-icon green"><CheckCircleOutlined /></div>
            <div className="equipment-stat-info">
              <div className="equipment-stat-value">{availableUnits}</div>
              <div className="equipment-stat-label">Available</div>
            </div>
            <div className="equipment-stat-trend up"><CheckOutlined /> Ready</div>
          </div>
          <div className="equipment-stat-card">
            <div className="equipment-stat-icon green"><CheckCircleOutlined /></div>
            <div className="equipment-stat-info">
              <div className="equipment-stat-value">{activeRecords}</div>
              <div className="equipment-stat-label">Active Records</div>
            </div>
            <div className="equipment-stat-trend up"><RiseOutlined /> {totalEquipment > 0 ? Math.round((activeRecords / totalEquipment) * 100) : 0}%</div>
          </div>
          <div className="equipment-stat-card">
            <div className="equipment-stat-icon orange"><WarningOutlined /></div>
            <div className="equipment-stat-info">
              <div className="equipment-stat-value">{rows.filter(row => row.condition === 'Fair' || row.condition === 'Poor').length}</div>
              <div className="equipment-stat-label">Needs Maintenance</div>
            </div>
            <div className="equipment-stat-trend warning">Check condition</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="equipment-main-card" variant="borderless">
          <div className="equipment-table-container">
            {/* Filters */}
            <div className={filtersClass}>
              <div className="equipment-filter-group equipment-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search equipment..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="equipment-search-input"
                />
              </div>
              <div className="equipment-filter-group">
                <FilterOutlined />
                <Select
                  value={filterCategory}
                  style={{ width: 160 }}
                  onChange={setFilterCategory}
                  className="equipment-filter-select"
                  placeholder="Category"
                >
                  <Option value="all">All Categories</Option>
                  {categories.map((value) => (
                    <Option key={value} value={value}>{value}</Option>
                  ))}
                </Select>
              </div>
              <div className="equipment-filter-group">
                <TagOutlined />
                <Select
                  value={filterCondition}
                  style={{ width: 150 }}
                  onChange={setFilterCondition}
                  className="equipment-filter-select"
                  placeholder="Condition"
                >
                  <Option value="all">All Conditions</Option>
                  {CONDITIONS.map((value) => (
                    <Option key={value} value={value}>{value}</Option>
                  ))}
                </Select>
              </div>
              <div className="equipment-filter-group">
                <FilterOutlined />
                <Select
                  value={filterActivity}
                  style={{ width: 140 }}
                  onChange={setFilterActivity}
                  className="equipment-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Status</Option>
                  <Option value="active">Active</Option>
                  <Option value="inactive">Inactive</Option>
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
            <div className="equipment-table-wrapper">
              <Spin spinning={equipmentQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey="id"
                  className={tableClass}
                  pagination={false}
                  scroll={{ x: 1200, y: 'calc(100vh - 320px)' }}
                  locale={{
                    emptyText: (
                      <div className="equipment-empty-state">
                        <BoxPlotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {equipmentQuery.isError ? 'Unable to load equipment data' : 'No equipment found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {equipmentQuery.isError ? 'Please try refreshing the page' : 'Equipment will appear here once added'}
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
            <div className="equipment-modal-header-clean">
              <div className="equipment-modal-title-icon"><EyeOutlined /></div>
              <div className="equipment-modal-title-text">Equipment Details</div>
              <div className="equipment-modal-badge">{selected?.display_id}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={720}
          className={modalClass}
          footer={
            <div className="equipment-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="equipment-modal-clean-content">
              {/* Header */}
              <div className="equipment-view-header">
                <div className="equipment-view-icon">
                  <ToolOutlined style={{ fontSize: 28, color: '#1a7ab5' }} />
                </div>
                <div className="equipment-view-header-info">
                  <div className="equipment-view-name">{selected.equipment_name}</div>
                  <div className="equipment-view-meta">
                    {selected.category && <Tag color="blue">{selected.category}</Tag>}
                    <Tag>{selected.condition}</Tag>
                    {selected.model && <Tag>{selected.model}</Tag>}
                  </div>
                </div>
                <div className="equipment-view-status">
                  <Badge status={selected.is_active ? 'success' : 'default'} text={selected.is_active ? 'Active' : 'Inactive'} />
                </div>
              </div>

              <Divider className="equipment-modal-divider" />

              {/* Stats Grid */}
              <div className="equipment-view-grid">
                <div className="equipment-view-section">
                  <div className="equipment-view-label">Total Quantity</div>
                  <div className="equipment-view-value">{selected.total}</div>
                </div>
                <div className="equipment-view-section">
                  <div className="equipment-view-label">Available</div>
                  <div className="equipment-view-value" style={{ color: '#10b981' }}>{selected.available}</div>
                </div>
                <div className="equipment-view-section">
                  <div className="equipment-view-label">Reserved</div>
                  <div className="equipment-view-value" style={{ color: '#1a7ab5' }}>{selected.reserved || 0}</div>
                </div>
                <div className="equipment-view-section">
                  <div className="equipment-view-label">Location</div>
                  <div className="equipment-view-value">{selected.location || '—'}</div>
                </div>
                <div className="equipment-view-section">
                  <div className="equipment-view-label">Serial Number</div>
                  <div className="equipment-view-value"><BarcodeOutlined /> {selected.serial_number || '—'}</div>
                </div>
                <div className="equipment-view-section">
                  <div className="equipment-view-label">Last Maintenance</div>
                  <div className="equipment-view-value">{selected.last_maintenance ? dayjs(selected.last_maintenance).format('MMM D, YYYY') : '—'}</div>
                </div>
              </div>

              {selected.notes && (
                <>
                  <Divider className="equipment-modal-divider" />
                  <div className="equipment-view-notes">
                    <div className="equipment-view-label" style={{ marginBottom: 4 }}>Notes</div>
                    <div className="equipment-view-value" style={{ fontWeight: 400 }}>{selected.notes}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* ==================== CREATE MODAL ==================== */}
        <Modal
          title={
            <div className="equipment-modal-header-clean">
              <div className="equipment-modal-title-icon"><PlusOutlined /></div>
              <div className="equipment-modal-title-text">Add Equipment</div>
              <div className="equipment-modal-badge">New</div>
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
          <div className="equipment-modal-clean-content">
            <Form form={createForm} layout="vertical" onFinish={submitCreate} className="equipment-add-form">
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="equipment_name" label="Equipment Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter equipment name" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="code" label="Equipment Code">
                    <Input placeholder="Auto-generated if blank" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="category" label="Category">
                    <Select placeholder="Select category" size="large" allowClear showSearch>
                      <Option value="">None</Option>
                      {CATEGORY_OPTIONS.map((value) => (
                        <Option key={value} value={value}>{value}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="condition" label="Condition">
                    <Select placeholder="Select condition" size="large">
                      {CONDITIONS.map((value) => (
                        <Option key={value} value={value}>{value}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="total" label="Total Quantity" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="location" label="Location">
                    <Input placeholder="Storage location" size="large" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="model" label="Model">
                    <Input placeholder="Model number" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="serial_number" label="Serial Number">
                    <Input placeholder="Serial number" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="last_maintenance" label="Last Maintenance">
                    <DatePicker style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes..." />
              </Form.Item>

              <div className="equipment-modal-footer-enhanced">
                <Button onClick={() => setCreateOpen(false)} className="equipment-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={createEquipment.isPending} className="equipment-btn-primary">
                  <SaveOutlined /> Create Equipment
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== EDIT MODAL ==================== */}
        <Modal
          title={
            <div className="equipment-modal-header-clean">
              <div className="equipment-modal-title-icon"><EditOutlined /></div>
              <div className="equipment-modal-title-text">Edit Equipment</div>
              <div className="equipment-modal-badge">{selected?.display_id}</div>
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
          <div className="equipment-modal-clean-content">
            <Form form={editForm} layout="vertical" onFinish={submitEdit} className="equipment-add-form">
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="equipment_name" label="Equipment Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter equipment name" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="code" label="Equipment Code">
                    <Input placeholder="Auto-generated if blank" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="category" label="Category">
                    <Select placeholder="Select category" size="large" allowClear showSearch>
                      <Option value="">None</Option>
                      {CATEGORY_OPTIONS.map((value) => (
                        <Option key={value} value={value}>{value}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="condition" label="Condition">
                    <Select placeholder="Select condition" size="large">
                      {CONDITIONS.map((value) => (
                        <Option key={value} value={value}>{value}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="total" label="Total Quantity" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="location" label="Location">
                    <Input placeholder="Storage location" size="large" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="model" label="Model">
                    <Input placeholder="Model number" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="serial_number" label="Serial Number">
                    <Input placeholder="Serial number" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="last_maintenance" label="Last Maintenance">
                    <DatePicker style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes..." />
              </Form.Item>

              <div className="equipment-modal-footer-enhanced">
                <Button onClick={() => setEditOpen(false)} className="equipment-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={updateEquipment.isPending} className="equipment-btn-primary">
                  <SaveOutlined /> Update Equipment
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== ADJUST MODAL ==================== */}
        <Modal
          title={
            <div className="equipment-modal-header-clean">
              <div className="equipment-modal-title-icon"><SwapOutlined /></div>
              <div className="equipment-modal-title-text">Adjust Equipment Quantity</div>
              <div className="equipment-modal-badge">{selected?.equipment_name || 'Equipment'}</div>
            </div>
          }
          open={adjustOpen}
          onCancel={() => setAdjustOpen(false)}
          width={600}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="equipment-modal-clean-content">
            <div className="equipment-adjust-current">
              <div className="equipment-adjust-current-label">Current Total</div>
              <div className="equipment-adjust-current-value">{selected?.total || 0} units</div>
            </div>

            <Divider className="equipment-modal-divider" />

            <Form form={adjustForm} layout="vertical" onFinish={submitAdjustment}>
              <Form.Item name="adjustment_type" label="Adjustment Type" rules={[{ required: true }]}>
                <Radio.Group className="equipment-adjust-radio-group" size="large">
                  <Radio.Button value="increase" className="add">➕ Add Units</Radio.Button>
                  <Radio.Button value="decrease" className="subtract">➖ Remove Units</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }, { type: 'number', min: 1 }]}>
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="0"
                  onFocus={(event) => {
                    if (Number(event.target.value) === 0) adjustForm.setFieldValue('quantity', null);
                  }}
                />
              </Form.Item>

              <Form.Item name="notes" label="Reason / Notes">
                <TextArea rows={3} placeholder="Enter reason for this adjustment..." />
              </Form.Item>

              <div className="equipment-modal-footer-enhanced">
                <Button onClick={() => setAdjustOpen(false)} className="equipment-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={updateEquipment.isPending} className="equipment-btn-primary">
                  <SaveOutlined /> Apply Adjustment
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const EquipmentManagementWithApp = () => <App><EquipmentManagement /></App>;
export default EquipmentManagementWithApp;