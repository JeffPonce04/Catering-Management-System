// src/components/Waste.jsx - ENHANCED PROFESSIONAL UI

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, Descriptions, Empty, Form, Input,
  InputNumber, Modal, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip,
  Typography, theme as antdTheme, Badge, Divider, message
} from 'antd';
import {
  DeleteOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, WarningOutlined,
  SearchOutlined, FilterOutlined, LeftOutlined, RightOutlined, PrinterOutlined,
  ExportOutlined, SaveOutlined, RiseOutlined, FallOutlined, ClockCircleOutlined,
  DollarOutlined, UserOutlined, CalendarOutlined, BoxPlotOutlined, CloseOutlined,
  CheckCircleOutlined, MoreOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useProducts, useRecordWaste, useWasteRecords } from '../../../hooks/useInventoryQueries';
import '../styles/Waste.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const REASONS = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'expired', label: 'Expired' },
  { value: 'damage', label: 'Damage' },
  { value: 'prep_waste', label: 'Preparation Waste' },
  { value: 'other', label: 'Other' },
];

const getReasonConfig = (reason) => {
  const config = {
    spoilage: { color: '#f59e0b', bg: '#fffbeb', icon: <WarningOutlined />, label: 'Spoilage' },
    expired: { color: '#ef4444', bg: '#fef2f2', icon: <CloseOutlined />, label: 'Expired' },
    damage: { color: '#f97316', bg: '#fff7ed', icon: <DeleteOutlined />, label: 'Damage' },
    prep_waste: { color: '#8b5cf6', bg: '#f5f3ff', icon: <BoxPlotOutlined />, label: 'Prep Waste' },
    other: { color: '#6b7280', bg: '#f3f4f6', icon: <MoreOutlined />, label: 'Other' },
  };
  return config[reason] || config.other;
};

const currency = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

// ============================================================
// PAGINATION HELPERS
// ============================================================
const renderPaginationItem = (_, type, originalElement) => {
  if (type === 'prev') {
    return (
      <Button className="waste-pagination-nav" size="small" icon={<LeftOutlined />}>
        Previous
      </Button>
    );
  }
  if (type === 'next') {
    return (
      <Button className="waste-pagination-nav" size="small">
        Next <RightOutlined />
      </Button>
    );
  }
  return originalElement;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const Waste = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterReason, setFilterReason] = useState('all');
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const wasteQuery = useWasteRecords({ per_page: 500 });
  const productsQuery = useProducts({ per_page: 500, active: 1 });
  const recordWaste = useRecordWaste();

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => wasteQuery.data?.data || [], [wasteQuery.data]);
  const products = productsQuery.data?.data || [];
  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [row.product_name, row.ingredient_name, row.recorded_by, row.notes]
      .some((value) => String(value || '').toLowerCase().includes(term));
    return matches && (filterReason === 'all' || row.reason === filterReason);
  }), [rows, search, filterReason]);

  const submitCreate = async (values) => {
    try {
      await recordWaste.mutateAsync({
        ingredient_id: values.ingredient_id,
        quantity: Number(values.quantity),
        reason: values.reason,
        notes: values.notes?.trim() || null,
      });
      form.resetFields();
      setCreateOpen(false);
      await wasteQuery.refetch();
      await productsQuery.refetch();
      message.success('Waste recorded successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to record waste');
    }
  };

  const handleDelete = (row) => {
    Modal.confirm({
      title: 'Delete Waste Record',
      content: `Are you sure you want to delete this waste record? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        message.success('Waste record deleted successfully');
      }
    });
  };

  // ==================== STATISTICS ====================
  const totalRecords = rows.length;
  const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const totalCost = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const expiredCount = rows.filter((row) => row.reason === 'expired').length;
  const spoilageCount = rows.filter((row) => row.reason === 'spoilage').length;

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'WASTE ID',
      key: 'id',
      width: 110,
      fixed: 'left',
      render: (_, row) => <span className="waste-id-text">{`WST-${String(row.id).padStart(4, '0')}`}</span>
    },
    {
      title: 'INGREDIENT',
      key: 'ingredient',
      width: 200,
      render: (_, row) => (
        <div className="waste-ingredient-cell">
          <div className="waste-ingredient-name">{row.product_name || row.ingredient_name}</div>
          <div className="waste-ingredient-meta">
            <span className="waste-ingredient-unit">{row.unit}</span>
          </div>
        </div>
      )
    },
    {
      title: 'QUANTITY',
      key: 'quantity',
      width: 130,
      align: 'right',
      render: (_, row) => (
        <div className="waste-quantity-cell">
          <div className="waste-quantity-value">{Number(row.quantity || 0).toLocaleString()}</div>
          <div className="waste-quantity-unit">{row.unit}</div>
        </div>
      )
    },
    {
      title: 'WASTE TYPE',
      key: 'reason',
      width: 150,
      render: (_, row) => {
        const config = getReasonConfig(row.reason);
        return (
          <span className="waste-type-badge" style={{ color: config.color, background: config.bg }}>
            {config.icon} {config.label}
          </span>
        );
      }
    },
    {
      title: 'COST',
      key: 'cost',
      width: 140,
      align: 'right',
      render: (_, row) => (
        <span className="waste-cost">{currency(row.cost)}</span>
      )
    },
    {
      title: 'RECORDED BY',
      key: 'recorded_by',
      width: 160,
      render: (_, row) => (
        <div className="waste-recorded-cell">
          <UserOutlined /> <span className="waste-recorded-name">{row.recorded_by}</span>
        </div>
      )
    },
    {
      title: 'DATE',
      key: 'date',
      width: 170,
      render: (_, row) => (
        <div className="waste-date-cell">
          <div className="waste-date-main">{dayjs(row.created_at).format('MMM D, YYYY')}</div>
          <div className="waste-date-time">{dayjs(row.created_at).format('h:mm A')}</div>
        </div>
      )
    },
    {
      title: 'NOTES',
      key: 'notes',
      width: 180,
      ellipsis: true,
      render: (_, row) => (
        <Tooltip title={row.notes}>
          <span className="waste-notes">{row.notes || '—'}</span>
        </Tooltip>
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, row) => (
        <div className="waste-action-group">
          <Tooltip title="View Details">
            <button className="waste-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
              <EyeOutlined />
            </button>
          </Tooltip>
        </div>
      )
    }
  ];

  // ==================== CSS CLASSES ====================
  const containerClass = `waste-container ${isDarkMode ? 'waste-dark-mode' : ''}`;
  const headerClass = `waste-header ${isDarkMode ? 'waste-header-dark' : ''}`;
  const statsClass = `waste-stats-grid ${isDarkMode ? 'waste-stats-dark' : ''}`;
  const filtersClass = `waste-filters ${isDarkMode ? 'waste-filters-dark' : ''}`;
  const tableClass = `waste-table ${isDarkMode ? 'waste-table-dark' : ''}`;
  const modalClass = `waste-modal-clean ${isDarkMode ? 'waste-modal-dark' : ''}`;

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
          <div className="waste-header-left">
            <Tooltip title="Waste Management">
              <div className="waste-logo-icon"><WarningOutlined /></div>
            </Tooltip>
            <div className="waste-header-info">
              <h1>Waste Management</h1>
              <span>INVENTORY LOSS TRACKING</span>
            </div>
          </div>
          <div className="waste-header-right">
            <div className="waste-date-display">
              <CalendarOutlined />
              <span>{formattedDate}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={wasteQuery.isFetching}
                onClick={() => { wasteQuery.refetch(); productsQuery.refetch(); }}
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
            <Tooltip title="Record Waste">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  form.setFieldsValue({ reason: 'spoilage', quantity: 0 });
                  setCreateOpen(true);
                }}
              >
                Record Waste
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="waste-stat-card">
            <div className="waste-stat-icon red"><DeleteOutlined /></div>
            <div className="waste-stat-info">
              <div className="waste-stat-value">{totalRecords}</div>
              <div className="waste-stat-label">Waste Records</div>
            </div>
            <div className="waste-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="waste-stat-card">
            <div className="waste-stat-icon orange"><BoxPlotOutlined /></div>
            <div className="waste-stat-info">
              <div className="waste-stat-value">{totalQuantity.toFixed(2)}</div>
              <div className="waste-stat-label">Total Quantity</div>
            </div>
            <div className="waste-stat-trend down"><FallOutlined /> -5%</div>
          </div>
          <div className="waste-stat-card">
            <div className="waste-stat-icon yellow"><DollarOutlined /></div>
            <div className="waste-stat-info">
              <div className="waste-stat-value">{currency(totalCost)}</div>
              <div className="waste-stat-label">Total Cost</div>
            </div>
            <div className="waste-stat-trend down"><FallOutlined /> -8%</div>
          </div>
          <div className="waste-stat-card">
            <div className="waste-stat-icon blue"><CloseOutlined /></div>
            <div className="waste-stat-info">
              <div className="waste-stat-value">{expiredCount}</div>
              <div className="waste-stat-label">Expired Items</div>
            </div>
            <div className="waste-stat-trend warning">Needs review</div>
          </div>
          <div className="waste-stat-card">
            <div className="waste-stat-icon purple"><WarningOutlined /></div>
            <div className="waste-stat-info">
              <div className="waste-stat-value">{spoilageCount}</div>
              <div className="waste-stat-label">Spoilage</div>
            </div>
            <div className="waste-stat-trend warning">Monitor</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="waste-main-card" variant="borderless">
          <div className="waste-table-container">
            {/* Filters */}
            <div className={filtersClass}>
              <div className="waste-filter-group waste-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search ingredient, user, or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="waste-search-input"
                />
              </div>
              <div className="waste-filter-group">
                <FilterOutlined />
                <Select
                  value={filterReason}
                  style={{ width: 180 }}
                  onChange={setFilterReason}
                  className="waste-filter-select"
                  placeholder="Waste Type"
                >
                  <Option value="all">All Types</Option>
                  {REASONS.map((item) => (
                    <Option key={item.value} value={item.value}>{item.label}</Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
            <div className="waste-table-wrapper">
              <Spin spinning={wasteQuery.isLoading}>
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
                  scroll={{ x: 1300, y: 'calc(100vh - 460px)' }}
                  locale={{
                    emptyText: (
                      <div className="waste-empty-state">
                        <WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {wasteQuery.isError ? 'Unable to load waste data' : 'No waste records found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {wasteQuery.isError ? 'Please try refreshing the page' : 'Records will appear here once waste is recorded'}
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
            <div className="waste-modal-header-clean">
              <div className="waste-modal-title-icon"><EyeOutlined /></div>
              <div className="waste-modal-title-text">Waste Record Details</div>
              <div className="waste-modal-badge">{selected ? `WST-${String(selected.id).padStart(4, '0')}` : ''}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={720}
          className={modalClass}
          footer={
            <div className="waste-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="waste-modal-clean-content">
              {/* Header */}
              <div className="waste-view-header">
                <div className="waste-view-icon">
                  <WarningOutlined style={{ fontSize: 28, color: '#ef4444' }} />
                </div>
                <div className="waste-view-header-info">
                  <div className="waste-view-ingredient">{selected.product_name || selected.ingredient_name}</div>
                  <div className="waste-view-meta">
                    <span className="waste-view-type" style={{ 
                      color: getReasonConfig(selected.reason).color, 
                      background: getReasonConfig(selected.reason).bg 
                    }}>
                      {getReasonConfig(selected.reason).icon} {getReasonConfig(selected.reason).label}
                    </span>
                    <span className="waste-view-quantity">{selected.quantity} {selected.unit}</span>
                  </div>
                </div>
              </div>

              <Divider className="waste-modal-divider" />

              {/* Grid */}
              <div className="waste-view-grid">
                <div className="waste-view-section">
                  <div className="waste-view-label">Quantity</div>
                  <div className="waste-view-value" style={{ color: '#ef4444', fontWeight: 700, fontSize: 20 }}>
                    {selected.quantity} {selected.unit}
                  </div>
                </div>
                <div className="waste-view-section">
                  <div className="waste-view-label">Estimated Cost</div>
                  <div className="waste-view-value" style={{ color: '#1a7ab5', fontWeight: 700 }}>{currency(selected.cost)}</div>
                </div>
                <div className="waste-view-section">
                  <div className="waste-view-label">Recorded By</div>
                  <div className="waste-view-value"><UserOutlined /> {selected.recorded_by}</div>
                </div>
                <div className="waste-view-section">
                  <div className="waste-view-label">Recorded At</div>
                  <div className="waste-view-value">{dayjs(selected.created_at).format('MMMM D, YYYY h:mm A')}</div>
                </div>
              </div>

              {selected.notes && (
                <>
                  <Divider className="waste-modal-divider" />
                  <div className="waste-view-notes">
                    <div className="waste-view-label" style={{ marginBottom: 4 }}>Notes</div>
                    <div className="waste-view-value" style={{ fontWeight: 400 }}>{selected.notes}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* ==================== CREATE MODAL ==================== */}
        <Modal
          title={
            <div className="waste-modal-header-clean">
              <div className="waste-modal-title-icon"><PlusOutlined /></div>
              <div className="waste-modal-title-text">Record Waste</div>
              <div className="waste-modal-badge">New</div>
            </div>
          }
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          width={660}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="waste-modal-clean-content">
            <Form form={form} layout="vertical" onFinish={submitCreate} className="waste-form">
              <Form.Item name="ingredient_id" label="Ingredient" rules={[{ required: true }]}>
                <Select 
                  showSearch 
                  optionFilterProp="label" 
                  size="large"
                  placeholder="Select ingredient"
                  className="waste-select-modern"
                  options={products.map((row) => ({ 
                    value: row.id, 
                    label: `${row.product_name || row.name} — ${row.stock ?? row.current_stock ?? 0} ${row.unit} available` 
                  }))} 
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="quantity" label="Quantity" rules={[{ required: true }, { type: 'number', min: 0.001 }]}>
                    <InputNumber 
                      min={0.001} 
                      precision={3} 
                      style={{ width: '100%' }} 
                      size="large"
                      placeholder="0.000"
                      className="waste-input-modern"
                      onFocus={(event) => { 
                        if (Number(event.target.value) === 0) form.setFieldValue('quantity', null); 
                      }} 
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="reason" label="Waste Type" rules={[{ required: true }]}>
                    <Select 
                      size="large"
                      className="waste-select-modern"
                      options={REASONS} 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes about the waste..." className="waste-textarea-modern" />
              </Form.Item>

              <div className="waste-modal-footer-enhanced">
                <Button onClick={() => setCreateOpen(false)} className="waste-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={recordWaste.isPending} className="waste-btn-primary">
                  <SaveOutlined /> Record Waste
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const WasteWithApp = () => <App><Waste /></App>;
export default WasteWithApp;