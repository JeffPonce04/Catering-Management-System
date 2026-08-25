// src/components/StockLevels.jsx - ENHANCED PROFESSIONAL UI

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, Empty, Form, Input, InputNumber, Modal,
  Radio, Row, Select, Space, Spin, Statistic, Table, Tag, Typography, theme as antdTheme,
  Badge, Divider, Tooltip, Dropdown, message
} from 'antd';
import {
  AlertOutlined, InboxOutlined, ReloadOutlined, SwapOutlined, SearchOutlined,
  FilterOutlined, LeftOutlined, RightOutlined, CalendarOutlined, PrinterOutlined,
  ExportOutlined, RiseOutlined, FallOutlined, WarningOutlined, CheckCircleOutlined,
  CloseOutlined, BoxPlotOutlined, DollarOutlined, EnvironmentOutlined, MoreOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, StopOutlined,SaveOutlined 
} from '@ant-design/icons';
import {
  useProducts, useRecordMovement,
} from '../../../hooks/useInventoryQueries';
import '../styles/StockLevels.css';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const levelStatus = (row) => {
  const current = Number(row.current_stock ?? row.stock ?? 0);
  const reorder = Number(row.reorder_point ?? row.min_stock ?? 0);
  if (current <= 0) return 'out_of_stock';
  if (current <= reorder) return 'low_stock';
  return 'in_stock';
};

const getStatusConfig = (status) => {
  const config = {
    in_stock: { color: '#10b981', bg: '#ecfdf5', text: 'In Stock', icon: <CheckCircleOutlined /> },
    low_stock: { color: '#f59e0b', bg: '#fffbeb', text: 'Low Stock', icon: <WarningOutlined /> },
    out_of_stock: { color: '#ef4444', bg: '#fef2f2', text: 'Out of Stock', icon: <CloseOutlined /> },
  };
  return config[status] || { color: '#6b7280', bg: '#f3f4f6', text: 'Unknown', icon: <MoreOutlined /> };
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
      <Button className="slm-pagination-nav" size="small" icon={<LeftOutlined />}>
        Previous
      </Button>
    );
  }
  if (type === 'next') {
    return (
      <Button className="slm-pagination-nav" size="small">
        Next <RightOutlined />
      </Button>
    );
  }
  return originalElement;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const StockLevels = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [form] = Form.useForm();
  const productsQuery = useProducts({ per_page: 500 });
  const recordMovement = useRecordMovement();

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => (productsQuery.data?.data || []).map((row) => ({
    ...row,
    display_id: row.display_id || row.product_id || `PRD-${String(row.id).padStart(4, '0')}`,
    product_name: row.product_name || row.name,
    current_stock: Number(row.current_stock ?? row.stock ?? row.current_quantity ?? 0),
    reserved_quantity: Number(row.reserved_quantity ?? 0),
    available_quantity: Number(row.available_quantity ?? 0),
    min_stock: Number(row.min_stock ?? row.minimum_quantity ?? 0),
    max_stock: Number(row.max_stock ?? row.maximum_quantity ?? 0),
    reorder_point: Number(row.reorder_point ?? row.min_stock ?? 0),
    level_status: levelStatus(row),
    total_value: (Number(row.current_stock ?? row.stock ?? 0) * Number(row.unit_cost ?? 0)),
  })), [productsQuery.data]);

  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [row.display_id, row.product_name, row.sku, row.category, row.location]
      .some((value) => String(value || '').toLowerCase().includes(term));
    return matches && (filterStatus === 'all' || row.level_status === filterStatus);
  }), [rows, search, filterStatus]);

  const submitAdjustment = async (values) => {
    const quantity = Number(values.quantity);
    const isAdjustment = values.adjustment_type.startsWith('adjustment_');
    const movementType = isAdjustment ? 'adjustment' : values.adjustment_type;
    const isPositive = ['purchase', 'adjustment_in'].includes(values.adjustment_type);

    try {
      await recordMovement.mutateAsync({
        ingredient_id: selected.id,
        movement_type: movementType,
        quantity_change: isPositive ? quantity : -quantity,
        reason: values.reason?.trim() || 'Manual stock-level adjustment',
      });
      form.resetFields();
      setAdjustOpen(false);
      await productsQuery.refetch();
      message.success('Stock adjusted successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to adjust stock');
    }
  };

  // ==================== STATISTICS ====================
  const totalProducts = rows.length;
  const totalQuantity = rows.reduce((sum, row) => sum + row.current_stock, 0);
  const lowStock = rows.filter((row) => row.level_status === 'low_stock').length;
  const outStock = rows.filter((row) => row.level_status === 'out_of_stock').length;
  const inStock = rows.filter((row) => row.level_status === 'in_stock').length;
  const totalValue = rows.reduce((sum, row) => sum + row.total_value, 0);

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'PRODUCT ID',
      dataIndex: 'display_id',
      key: 'id',
      width: 120,
      fixed: 'left',
      render: (value) => <span className="slm-id-text">{value}</span>
    },
    {
      title: 'PRODUCT NAME',
      key: 'product',
      width: 220,
      render: (_, row) => (
        <div className="slm-product-cell">
          <div className="slm-product-info">
            <div className="slm-product-name">{row.product_name}</div>
            <div className="slm-product-meta">
              <span className="slm-product-unit">{row.unit}</span>
              {row.category && <span className="slm-product-category">{row.category}</span>}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'UNIT',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center',
      render: (value) => <span className="slm-unit-text">{value || '—'}</span>
    },
    {
      title: 'CURRENT STOCK',
      key: 'stock',
      width: 140,
      align: 'right',
      render: (_, row) => (
        <div className="slm-stock-cell">
          <div className="slm-stock-value">{row.current_stock.toLocaleString()}</div>
          <div className="slm-stock-detail">
            <span className="slm-stock-available">{row.available_quantity} Available</span>
            <span className="slm-stock-reserved">{row.reserved_quantity} Reserved</span>
          </div>
        </div>
      )
    },
    {
      title: 'MIN / MAX',
      key: 'limits',
      width: 130,
      align: 'center',
      render: (_, row) => (
        <div className="slm-limits-cell">
          <span className="slm-min">{row.min_stock}</span>
          <span className="slm-separator">/</span>
          <span className="slm-max">{row.max_stock || '∞'}</span>
        </div>
      )
    },
    {
      title: 'REORDER POINT',
      dataIndex: 'reorder_point',
      key: 'reorder',
      width: 120,
      align: 'right',
      render: (value) => <span className="slm-reorder">{value}</span>
    },
    {
      title: 'LOCATION',
      dataIndex: 'location',
      key: 'location',
      width: 140,
      render: (value) => value ? <span className="slm-location"><EnvironmentOutlined /> {value}</span> : '—'
    },
    {
      title: 'STATUS',
      key: 'status',
      width: 140,
      align: 'center',
      render: (_, row) => {
        const config = getStatusConfig(row.level_status);
        return (
          <span className="slm-status-badge" style={{ color: config.color, background: config.bg }}>
            {config.icon} {config.text}
          </span>
        );
      }
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, row) => (
        <div className="slm-action-group">
          <Tooltip title="View Details">
            <button className="slm-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
              <EyeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Adjust Stock">
            <button className="slm-action-icon adjust" onClick={() => { setSelected(row); form.setFieldsValue({ adjustment_type: 'purchase', quantity: 0 }); setAdjustOpen(true); }}>
              <SwapOutlined />
            </button>
          </Tooltip>
        </div>
      )
    }
  ];

  // ==================== CSS CLASSES ====================
  const containerClass = `slm-container ${isDarkMode ? 'slm-dark-mode' : ''}`;
  const headerClass = `slm-header ${isDarkMode ? 'slm-header-dark' : ''}`;
  const statsClass = `slm-stats-grid ${isDarkMode ? 'slm-stats-dark' : ''}`;
  const filtersClass = `slm-filters ${isDarkMode ? 'slm-filters-dark' : ''}`;
  const tableClass = `slm-table ${isDarkMode ? 'slm-table-dark' : ''}`;
  const modalClass = `slm-modal-clean ${isDarkMode ? 'slm-modal-dark' : ''}`;

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
          <div className="slm-header-left">
            <Tooltip title="Stock Levels">
              <div className="slm-logo-icon"><BoxPlotOutlined /></div>
            </Tooltip>
            <div className="slm-header-info">
              <h1>Stock Levels</h1>
              <span>INVENTORY MONITORING</span>
            </div>
          </div>
          <div className="slm-header-right">
            <div className="slm-date-display">
              <CalendarOutlined />
              <span>{formattedDate}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={productsQuery.isFetching}
                onClick={() => productsQuery.refetch()}
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
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="slm-stat-card">
            <div className="slm-stat-icon blue"><InboxOutlined /></div>
            <div className="slm-stat-info">
              <div className="slm-stat-value">{totalProducts}</div>
              <div className="slm-stat-label">Total Products</div>
            </div>
            <div className="slm-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="slm-stat-card">
            <div className="slm-stat-icon green"><BoxPlotOutlined /></div>
            <div className="slm-stat-info">
              <div className="slm-stat-value">{totalQuantity.toLocaleString()}</div>
              <div className="slm-stat-label">Total Quantity</div>
            </div>
            <div className="slm-stat-trend up"><RiseOutlined /> +8%</div>
          </div>
          <div className="slm-stat-card">
            <div className="slm-stat-icon orange"><AlertOutlined /></div>
            <div className="slm-stat-info">
              <div className="slm-stat-value">{lowStock}</div>
              <div className="slm-stat-label">Low Stock</div>
            </div>
            <div className="slm-stat-trend warning">Needs attention</div>
          </div>
          <div className="slm-stat-card">
            <div className="slm-stat-icon red"><CloseOutlined /></div>
            <div className="slm-stat-info">
              <div className="slm-stat-value">{outStock}</div>
              <div className="slm-stat-label">Out of Stock</div>
            </div>
            <div className="slm-stat-trend down">Critical</div>
          </div>
          <div className="slm-stat-card">
            <div className="slm-stat-icon green"><CheckCircleOutlined /></div>
            <div className="slm-stat-info">
              <div className="slm-stat-value">{inStock}</div>
              <div className="slm-stat-label">In Stock</div>
            </div>
            <div className="slm-stat-trend up">Available</div>
          </div>
          <div className="slm-stat-card">
            <div className="slm-stat-icon purple"><DollarOutlined /></div>
            <div className="slm-stat-info">
              <div className="slm-stat-value">{currency(totalValue)}</div>
              <div className="slm-stat-label">Total Value</div>
            </div>
            <div className="slm-stat-trend up"><RiseOutlined /> +5%</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="slm-main-card" variant="borderless">
          <div className="slm-table-container">
            {/* Filters */}
            <div className={filtersClass}>
              <div className="slm-filter-group slm-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="slm-search-input"
                />
              </div>
              <div className="slm-filter-group">
                <FilterOutlined />
                <Select
                  value={filterStatus}
                  style={{ width: 160 }}
                  onChange={setFilterStatus}
                  className="slm-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Statuses</Option>
                  <Option value="in_stock">In Stock</Option>
                  <Option value="low_stock">Low Stock</Option>
                  <Option value="out_of_stock">Out of Stock</Option>
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
            <div className="slm-table-wrapper">
              <Spin spinning={productsQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey="id"
                  className={tableClass}
                  pagination={false}
                  scroll={{ x: 1300, y: 'calc(100vh - 320px)' }}
                  locale={{
                    emptyText: (
                      <div className="slm-empty-state">
                        <BoxPlotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {productsQuery.isError ? 'Unable to load stock data' : 'No stock records found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {productsQuery.isError ? 'Please try refreshing the page' : 'Products will appear here once added'}
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
            <div className="slm-modal-header-clean">
              <div className="slm-modal-title-icon"><EyeOutlined /></div>
              <div className="slm-modal-title-text">Stock Details</div>
              <div className="slm-modal-badge">{selected?.display_id}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={700}
          className={modalClass}
          footer={
            <div className="slm-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="slm-modal-clean-content">
              {/* Header */}
              <div className="slm-view-header">
                <div className="slm-view-icon">
                  <BoxPlotOutlined style={{ fontSize: 28, color: '#1a7ab5' }} />
                </div>
                <div className="slm-view-header-info">
                  <div className="slm-view-name">{selected.product_name}</div>
                  <div className="slm-view-meta">
                    <Tag>{selected.unit}</Tag>
                    {selected.category && <Tag color="blue">{selected.category}</Tag>}
                    <span className="slm-view-status" style={{ 
                      color: getStatusConfig(selected.level_status).color, 
                      background: getStatusConfig(selected.level_status).bg 
                    }}>
                      {getStatusConfig(selected.level_status).icon} {getStatusConfig(selected.level_status).text}
                    </span>
                  </div>
                </div>
              </div>

              <Divider className="slm-modal-divider" />

              {/* Stats Grid */}
              <div className="slm-view-grid">
                <div className="slm-view-section">
                  <div className="slm-view-label">Current Stock</div>
                  <div className="slm-view-value slm-highlight">{selected.current_stock.toLocaleString()} {selected.unit}</div>
                </div>
                <div className="slm-view-section">
                  <div className="slm-view-label">Available</div>
                  <div className="slm-view-value" style={{ color: '#10b981' }}>{selected.available_quantity.toLocaleString()} {selected.unit}</div>
                </div>
                <div className="slm-view-section">
                  <div className="slm-view-label">Reserved</div>
                  <div className="slm-view-value" style={{ color: '#1a7ab5' }}>{selected.reserved_quantity.toLocaleString()} {selected.unit}</div>
                </div>
                <div className="slm-view-section">
                  <div className="slm-view-label">Min Stock</div>
                  <div className="slm-view-value">{selected.min_stock} {selected.unit}</div>
                </div>
                <div className="slm-view-section">
                  <div className="slm-view-label">Max Stock</div>
                  <div className="slm-view-value">{selected.max_stock || '∞'} {selected.unit}</div>
                </div>
                <div className="slm-view-section">
                  <div className="slm-view-label">Reorder Point</div>
                  <div className="slm-view-value">{selected.reorder_point} {selected.unit}</div>
                </div>
                <div className="slm-view-section">
                  <div className="slm-view-label">Location</div>
                  <div className="slm-view-value">{selected.location || '—'}</div>
                </div>
                <div className="slm-view-section">
                  <div className="slm-view-label">Total Value</div>
                  <div className="slm-view-value" style={{ color: '#8b5cf6' }}>{currency(selected.total_value)}</div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* ==================== ADJUST MODAL ==================== */}
        <Modal
          title={
            <div className="slm-modal-header-clean">
              <div className="slm-modal-title-icon"><SwapOutlined /></div>
              <div className="slm-modal-title-text">Adjust Stock</div>
              <div className="slm-modal-badge">{selected?.product_name || 'Product'}</div>
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
          <div className="slm-modal-clean-content">
            <div className="slm-adjust-current">
              <div className="slm-adjust-current-label">Current Stock</div>
              <div className="slm-adjust-current-value">
                <span className="slm-adjust-current-number">{selected?.current_stock || 0}</span>
                <span className="slm-adjust-current-unit">{selected?.unit}</span>
              </div>
            </div>

            <Divider className="slm-modal-divider" />

            <Form form={form} layout="vertical" onFinish={submitAdjustment}>
              <Form.Item name="adjustment_type" label="Adjustment Type" rules={[{ required: true }]}>
                <Radio.Group className="slm-adjust-radio-group" size="large">
                  <Radio.Button value="purchase" className="adjust-in">📥 Stock In</Radio.Button>
                  <Radio.Button value="usage" className="adjust-out">📤 Stock Out</Radio.Button>
                  <Radio.Button value="adjustment_in" className="adjust-adj">⚖️ Adj In</Radio.Button>
                  <Radio.Button value="adjustment_out" className="adjust-adj">⚖️ Adj Out</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }, { type: 'number', min: 0.001 }]}>
                <InputNumber
                  min={0.001}
                  precision={3}
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="0.000"
                  className="slm-input-modern"
                  onFocus={(event) => {
                    if (Number(event.target.value) === 0) form.setFieldValue('quantity', null);
                  }}
                />
              </Form.Item>

              <Form.Item name="reason" label="Reason / Notes">
                <TextArea rows={3} placeholder="Enter reason for this adjustment..." className="slm-textarea-modern" />
              </Form.Item>

              <div className="slm-modal-footer-enhanced">
                <Button onClick={() => setAdjustOpen(false)} className="slm-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={recordMovement.isPending} className="slm-btn-primary">
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

const StockLevelsWithApp = () => <App><StockLevels /></App>;
export default StockLevelsWithApp;