// src/components/IngredientsManagement.jsx - COMPLETE FIXED WITH SCROLL & AUTO SKU

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, DatePicker, Descriptions, Divider, Empty,
  Form, Input, InputNumber, Modal, Radio, Row, Select, Space, Spin, Statistic,
  Table, Tag, Tooltip, Typography, theme as antdTheme, Badge, Progress, Avatar,
  Dropdown, Popconfirm, message
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EditOutlined, EyeOutlined, InboxOutlined,
  PlusOutlined, ReloadOutlined, StopOutlined, SwapOutlined, DeleteOutlined,
  MoreOutlined, SearchOutlined, FilterOutlined, LeftOutlined, RightOutlined,
  RiseOutlined, FallOutlined, DollarOutlined, TagOutlined, BoxPlotOutlined,
  CalendarOutlined, WarningOutlined, CheckOutlined, CloseOutlined,
  PrinterOutlined, ExportOutlined, SaveOutlined, 
  ArrowUpOutlined, ArrowDownOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useCreateProduct, useProducts, useRecordMovement, useSetProductActive, useUpdateProduct,
} from '../../../hooks/useInventoryQueries';
import '../styles/IngredientsManagements.css';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ============================================================
// CONSTANTS
// ============================================================
const TYPE_OPTIONS = [
  { value: 'direct', label: 'Direct Ingredients' },
  { value: 'reusable', label: 'Reusable' },
  { value: 'estimated', label: 'Estimated' },
];

const UNIT_OPTIONS = ['kg', 'g', 'L', 'mL', 'pcs', 'box', 'pack', 'bottle', 'can', 'sack', 'bag', 'piece'];

// ============================================================
// HELPERS
// ============================================================
const stockStatus = (row) => {
  if (row.status) return row.status;
  const current = Number(row.current_stock ?? row.stock ?? 0);
  const minimum = Number(row.min_stock ?? 0);
  const maximum = Number(row.max_stock ?? 0);
  if (current <= 0) return 'out_of_stock';
  if (current <= minimum) return 'low_stock';
  if (maximum > 0 && current >= maximum) return 'over_stock';
  return 'in_stock';
};

const getStatusConfig = (status) => {
  const config = {
    in_stock: { color: '#10b981', bg: '#ecfdf5', text: 'In Stock', icon: <CheckCircleOutlined /> },
    low_stock: { color: '#f59e0b', bg: '#fffbeb', text: 'Low Stock', icon: <WarningOutlined /> },
    out_of_stock: { color: '#ef4444', bg: '#fef2f2', text: 'Out of Stock', icon: <CloseOutlined /> },
    over_stock: { color: '#8b5cf6', bg: '#f5f3ff', text: 'Over Stock', icon: <RiseOutlined /> },
  };
  return config[status] || { color: '#6b7280', bg: '#f3f4f6', text: 'Unknown', icon: <MoreOutlined /> };
};

const currency = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

// Generate SKU automatically
const generateSKU = (productName, category) => {
  const prefix = category ? category.substring(0, 3).toUpperCase() : 'PRD';
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${random}`;
};

const toPayload = (values) => ({
  name: values.product_name?.trim(),
  sku: values.sku?.trim() || null,
  ingredient_type: values.type,
  category: values.category?.trim() || null,
  unit: values.unit,
  current_quantity: Number(values.stock ?? 0),
  minimum_quantity: Number(values.min_stock ?? 0),
  maximum_quantity: Number(values.max_stock ?? 0),
  reorder_point: Number(values.reorder_point ?? values.min_stock ?? 0),
  unit_cost: Number(values.cost_price ?? 0),
  expiry_date: values.expiry_date ? values.expiry_date.format('YYYY-MM-DD') : null,
  yield_percentage: Number(values.yield_percentage ?? 100),
  reuse_factor: Number(values.reuse_factor ?? 1),
  notes: values.notes?.trim() || null,
});

// ============================================================
// MAIN COMPONENT
// ============================================================
const IngredientsManagement = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [movementForm] = Form.useForm();

  const productsQuery = useProducts({ per_page: 500 });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const setProductActive = useSetProductActive();
  const recordMovement = useRecordMovement();

  // ==================== THEME DETECTION ====================
  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // ==================== DATA TRANSFORMATION ====================
  const rows = useMemo(() => (productsQuery.data?.data || []).map((row) => ({
    ...row,
    display_id: row.display_id || row.product_id || `PRD-${String(row.id).padStart(4, '0')}`,
    product_name: row.product_name || row.name,
    type: row.type || TYPE_OPTIONS.find((type) => type.value === row.ingredient_type)?.label || 'Direct Ingredients',
    stock: Number(row.stock ?? row.current_stock ?? row.current_quantity ?? 0),
    min_stock: Number(row.min_stock ?? row.minimum_quantity ?? 0),
    max_stock: Number(row.max_stock ?? row.maximum_quantity ?? 0),
    cost_price: Number(row.cost_price ?? row.unit_cost ?? 0),
    status: stockStatus(row),
  })), [productsQuery.data]);

  const categories = useMemo(() => [...new Set(rows.map((row) => row.category).filter(Boolean))], [rows]);

  // ==================== FILTERS ====================
  const filteredRows = useMemo(() => rows.filter((row) => {
    const search = searchText.trim().toLowerCase();
    const matchesSearch = !search || [row.display_id, row.product_name, row.sku, row.type, row.category]
      .some((value) => String(value || '').toLowerCase().includes(search));
    const matchesType = filterType === 'all' || row.ingredient_type === filterType || row.type === filterType;
    const matchesCategory = filterCategory === 'all' || row.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || row.status === filterStatus;
    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  }), [rows, searchText, filterType, filterCategory, filterStatus]);

  // ==================== STATISTICS ====================
  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => row.is_active).length,
    inStock: rows.filter((row) => row.status === 'in_stock').length,
    lowStock: rows.filter((row) => row.status === 'low_stock').length,
    outOfStock: rows.filter((row) => row.status === 'out_of_stock').length,
  }), [rows]);

  // ==================== HANDLERS ====================
  const openEdit = (row) => {
    setSelected(row);
    editForm.setFieldsValue({
      product_name: row.product_name,
      sku: row.sku,
      type: row.ingredient_type || 'direct',
      category: row.category,
      unit: row.unit,
      stock: row.stock,
      min_stock: row.min_stock,
      max_stock: row.max_stock,
      reorder_point: row.reorder_point,
      cost_price: row.cost_price,
      expiry_date: row.expiry_date ? dayjs(row.expiry_date) : null,
      yield_percentage: row.yield_percentage,
      reuse_factor: row.reuse_factor,
      notes: row.notes,
    });
    setEditOpen(true);
  };

  const openMovement = (row) => {
    setSelected(row);
    movementForm.setFieldsValue({ movement_type: 'purchase', quantity: 0, notes: '' });
    setMovementOpen(true);
  };

  const submitCreate = async (values) => {
    try {
      await createProduct.mutateAsync(toPayload(values));
      createForm.resetFields();
      setCreateOpen(false);
      await productsQuery.refetch();
      message.success('Product created successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to create product');
    }
  };

  const submitEdit = async (values) => {
    try {
      await updateProduct.mutateAsync({ id: selected.id, data: toPayload(values) });
      editForm.resetFields();
      setEditOpen(false);
      await productsQuery.refetch();
      message.success('Product updated successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to update product');
    }
  };

  const submitMovement = async (values) => {
    const quantity = Number(values.quantity);
    const isAdjustment = values.movement_type.startsWith('adjustment_');
    const movementType = isAdjustment ? 'adjustment' : values.movement_type;
    const isPositive = ['purchase', 'return', 'adjustment_in'].includes(values.movement_type);

    try {
      await recordMovement.mutateAsync({
        ingredient_id: selected.id,
        movement_type: movementType,
        quantity_change: isPositive ? quantity : -quantity,
        reason: values.notes?.trim() || null,
      });
      movementForm.resetFields();
      setMovementOpen(false);
      await productsQuery.refetch();
      message.success('Stock movement recorded successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to record movement');
    }
  };

  const changeActivity = (row) => {
    const nextActive = !row.is_active;
    Modal.confirm({
      title: `${nextActive ? 'Activate' : 'Deactivate'} Product`,
      content: `Are you sure you want to ${nextActive ? 'activate' : 'deactivate'} ${row.product_name}?`,
      okText: nextActive ? 'Activate' : 'Deactivate',
      okType: nextActive ? 'primary' : 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await setProductActive.mutateAsync({ id: row.id, active: nextActive });
          await productsQuery.refetch();
          message.success(`Product ${nextActive ? 'activated' : 'deactivated'} successfully`);
        } catch (error) {
          message.error(error?.response?.data?.message || 'Failed to update status');
        }
      },
    });
  };

  const handleDelete = (row) => {
    Modal.confirm({
      title: 'Delete Product',
      content: `Are you sure you want to delete ${row.product_name}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        message.success(`${row.product_name} deleted successfully`);
      }
    });
  };

  // Auto-generate SKU when product name or category changes
  const handleProductNameChange = (e) => {
    const name = e.target.value;
    const category = createForm.getFieldValue('category');
    if (name && name.length > 2) {
      const sku = generateSKU(name, category);
      createForm.setFieldsValue({ sku });
    }
  };

  const handleCategoryChange = (value) => {
    const name = createForm.getFieldValue('product_name');
    if (name && name.length > 2) {
      const sku = generateSKU(name, value);
      createForm.setFieldsValue({ sku });
    }
  };

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'PRODUCT ID',
      dataIndex: 'display_id',
      key: 'id',
      width: 110,
      fixed: 'left',
      render: (value) => <span className="ingredient-id-text">{value}</span>
    },
    {
      title: 'PRODUCT NAME',
      key: 'product',
      width: 200,
      render: (_, row) => (
        <div className="ingredient-product-cell">
          <div className="ingredient-product-info">
            <div className="ingredient-product-name">{row.product_name}</div>
            <div className="ingredient-product-meta">
              <span className="ingredient-product-unit">{row.unit}</span>
              {row.category && <span className="ingredient-product-category">{row.category}</span>}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'PRODUCT TYPE',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (text) => <span className="ingredient-type-text">{text}</span>
    },
    {
      title: 'CATEGORY',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (value) => value ? <Tag className="ingredient-category-tag">{value}</Tag> : <span className="ingredient-no-category">—</span>
    },
    {
      title: 'CURRENT STOCK',
      key: 'stock',
      width: 160,
      align: 'right',
      render: (_, row) => (
        <div className="ingredient-stock-cell">
          <div className="ingredient-stock-value">{row.stock.toLocaleString()} <span className="ingredient-stock-unit">{row.unit}</span></div>
          <div className="ingredient-stock-range">Min: {row.min_stock} • Max: {row.max_stock || '∞'}</div>
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
          <span className="ingredient-status-badge" style={{ color: config.color, background: config.bg }}>
            {config.icon} {config.text}
          </span>
        );
      }
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
          className="ingredient-activity-badge"
        />
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, row) => (
        <div className="ingredient-action-group">
          <Tooltip title="View Details">
            <button className="ingredient-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
              <EyeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Edit">
            <button className="ingredient-action-icon edit" onClick={() => openEdit(row)}>
              <EditOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Record Movement">
            <button className="ingredient-action-icon adjust" onClick={() => openMovement(row)}>
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
                  onClick: () => changeActivity(row)
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
            <button className="ingredient-action-icon more">
              <MoreOutlined />
            </button>
          </Dropdown>
        </div>
      )
    }
  ];

  // ==================== CSS CLASSES ====================
  const containerClass = `ingredient-container ${isDarkMode ? 'ingredient-dark-mode' : ''}`;
  const headerClass = `ingredient-header ${isDarkMode ? 'ingredient-header-dark' : ''}`;
  const statsClass = `ingredient-stats-grid ${isDarkMode ? 'ingredient-stats-dark' : ''}`;
  const filtersClass = `ingredient-filters ${isDarkMode ? 'ingredient-filters-dark' : ''}`;
  const tableClass = `ingredient-table ${isDarkMode ? 'ingredient-table-dark' : ''}`;
  const modalClass = `ingredient-modal-clean ${isDarkMode ? 'ingredient-modal-dark' : ''}`;

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
          <div className="ingredient-header-left">
            <Tooltip title="Ingredients Management">
              <div className="ingredient-logo-icon"><BoxPlotOutlined /></div>
            </Tooltip>
            <div className="ingredient-header-info">
              <h1>Ingredients Management</h1>
              <span>INVENTORY CONTROL</span>
            </div>
          </div>
          <div className="ingredient-header-right">
            <div className="ingredient-date-display">
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
            <Tooltip title="Add new ingredient">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({
                    type: 'direct',
                    unit: 'kg',
                    stock: 0,
                    yield_percentage: 100,
                    reuse_factor: 1
                  });
                  setCreateOpen(true);
                }}
              >
                Add Ingredient
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="ingredient-stat-card">
            <div className="ingredient-stat-icon blue"><InboxOutlined /></div>
            <div className="ingredient-stat-info">
              <div className="ingredient-stat-value">{stats.total}</div>
              <div className="ingredient-stat-label">Total Products</div>
            </div>
            <div className="ingredient-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="ingredient-stat-card">
            <div className="ingredient-stat-icon green"><CheckCircleOutlined /></div>
            <div className="ingredient-stat-info">
              <div className="ingredient-stat-value">{stats.active}</div>
              <div className="ingredient-stat-label">Active</div>
            </div>
            <div className="ingredient-stat-trend up"><CheckOutlined /> {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%</div>
          </div>
          <div className="ingredient-stat-card">
            <div className="ingredient-stat-icon green"><CheckCircleOutlined /></div>
            <div className="ingredient-stat-info">
              <div className="ingredient-stat-value">{stats.inStock}</div>
              <div className="ingredient-stat-label">In Stock</div>
            </div>
            <div className="ingredient-stat-trend up"><RiseOutlined /> Available</div>
          </div>
          <div className="ingredient-stat-card">
            <div className="ingredient-stat-icon orange"><WarningOutlined /></div>
            <div className="ingredient-stat-info">
              <div className="ingredient-stat-value">{stats.lowStock}</div>
              <div className="ingredient-stat-label">Low Stock</div>
            </div>
            <div className="ingredient-stat-trend warning">Needs attention</div>
          </div>
          <div className="ingredient-stat-card">
            <div className="ingredient-stat-icon red"><CloseOutlined /></div>
            <div className="ingredient-stat-info">
              <div className="ingredient-stat-value">{stats.outOfStock}</div>
              <div className="ingredient-stat-label">Out of Stock</div>
            </div>
            <div className="ingredient-stat-trend down">Critical</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="ingredient-main-card" variant="borderless">
          <div className="ingredient-table-container">
            {/* Filters */}
            <div className={filtersClass}>
              <div className="ingredient-filter-group ingredient-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search products..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  className="ingredient-search-input"
                />
              </div>
              <div className="ingredient-filter-group">
                <FilterOutlined />
                <Select
                  value={filterType}
                  style={{ width: 160 }}
                  onChange={setFilterType}
                  className="ingredient-filter-select"
                  placeholder="Type"
                >
                  <Option value="all">All Types</Option>
                  {TYPE_OPTIONS.map((item) => (
                    <Option key={item.value} value={item.value}>{item.label}</Option>
                  ))}
                </Select>
              </div>
              <div className="ingredient-filter-group">
                <TagOutlined />
                <Select
                  value={filterCategory}
                  style={{ width: 160 }}
                  onChange={setFilterCategory}
                  className="ingredient-filter-select"
                  placeholder="Category"
                >
                  <Option value="all">All Categories</Option>
                  {categories.map((category) => (
                    <Option key={category} value={category}>{category}</Option>
                  ))}
                </Select>
              </div>
              <div className="ingredient-filter-group">
                <FilterOutlined />
                <Select
                  value={filterStatus}
                  style={{ width: 150 }}
                  onChange={setFilterStatus}
                  className="ingredient-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Status</Option>
                  <Option value="in_stock">In Stock</Option>
                  <Option value="low_stock">Low Stock</Option>
                  <Option value="out_of_stock">Out of Stock</Option>
                  <Option value="over_stock">Over Stock</Option>
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
           <div className="ingredient-table-wrapper">
              <Spin spinning={productsQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={filteredRows}
                  rowKey="id"
                  className={tableClass}
                  pagination={false}
                  scroll={{ x: 1200, y: 'calc(100vh - 220px)' }}  // KEY FIX: Added y value for vertical scroll
                  locale={{
                    emptyText: (
                      <div className="ingredient-empty-state">
                        <BoxPlotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {productsQuery.isError ? 'Unable to load product data' : 'No products found'}
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
            <div className="ingredient-modal-header-clean">
              <div className="ingredient-modal-title-icon"><EyeOutlined /></div>
              <div className="ingredient-modal-title-text">Product Details</div>
              <div className="ingredient-modal-badge">{selected?.display_id}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={720}
          className={modalClass}
          footer={
            <div className="ingredient-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="ingredient-modal-clean-content">
              {/* Header */}
              <div className="ingredient-view-header">
                <div className="ingredient-view-icon">
                  <BoxPlotOutlined style={{ fontSize: 28, color: '#1a7ab5' }} />
                </div>
                <div className="ingredient-view-header-info">
                  <div className="ingredient-view-name">{selected.product_name}</div>
                  <div className="ingredient-view-meta">
                    <Tag>{selected.type}</Tag>
                    {selected.category && <Tag color="blue">{selected.category}</Tag>}
                    <Tag>{selected.unit}</Tag>
                  </div>
                </div>
                <div className="ingredient-view-status">
                  {(() => {
                    const config = getStatusConfig(selected.status);
                    return (
                      <span className="ingredient-status-badge" style={{ color: config.color, background: config.bg, fontSize: 14, padding: '6px 16px' }}>
                        {config.icon} {config.text}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <Divider className="ingredient-modal-divider" />

              {/* Stats Grid */}
              <div className="ingredient-view-grid">
                <div className="ingredient-view-section">
                  <div className="ingredient-view-label">Current Stock</div>
                  <div className="ingredient-view-value">{selected.stock.toLocaleString()} {selected.unit}</div>
                </div>
                <div className="ingredient-view-section">
                  <div className="ingredient-view-label">Unit Cost</div>
                  <div className="ingredient-view-value">{currency(selected.cost_price)}</div>
                </div>
                <div className="ingredient-view-section">
                  <div className="ingredient-view-label">Min Stock</div>
                  <div className="ingredient-view-value">{selected.min_stock} {selected.unit}</div>
                </div>
                <div className="ingredient-view-section">
                  <div className="ingredient-view-label">Max Stock</div>
                  <div className="ingredient-view-value">{selected.max_stock || '∞'} {selected.unit}</div>
                </div>
                <div className="ingredient-view-section">
                  <div className="ingredient-view-label">Status</div>
                  <div className="ingredient-view-value">
                    <Badge status={selected.is_active ? 'success' : 'default'} text={selected.is_active ? 'Active' : 'Inactive'} />
                  </div>
                </div>
              </div>

              {selected.notes && (
                <>
                  <Divider className="ingredient-modal-divider" />
                  <div className="ingredient-view-notes">
                    <div className="ingredient-view-label" style={{ marginBottom: 4 }}>Notes</div>
                    <div className="ingredient-view-value" style={{ fontWeight: 400 }}>{selected.notes}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* ==================== CREATE MODAL ==================== */}
        <Modal
          title={
            <div className="ingredient-modal-header-clean">
              <div className="ingredient-modal-title-icon"><PlusOutlined /></div>
              <div className="ingredient-modal-title-text">Add New Product</div>
              <div className="ingredient-modal-badge">New</div>
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
          <div className="ingredient-modal-clean-content">
            <Form form={createForm} layout="vertical" onFinish={submitCreate} className="ingredient-add-form">
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="product_name" label="Product Name" rules={[{ required: true }]}>
                    <Input 
                      placeholder="Enter product name" 
                      size="large" 
                      onChange={handleProductNameChange}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sku" label="SKU">
                    <Input 
                      placeholder="Auto-generated" 
                      size="large" 
                      disabled 
                      style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="type" label="Product Type" rules={[{ required: true }]}>
                    <Select placeholder="Select type" size="large">
                      {TYPE_OPTIONS.map((item) => (
                        <Option key={item.value} value={item.value}>{item.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="category" label="Category">
                    <Select 
                      placeholder="Select category" 
                      size="large"
                      onChange={handleCategoryChange}
                      allowClear
                      showSearch
                    >
                      <Option value="">None</Option>
                      {categories.map((category) => (
                        <Option key={category} value={category}>{category}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                    <Select placeholder="Select unit" size="large">
                      {UNIT_OPTIONS.map((unit) => (
                        <Option key={unit} value={unit}>{unit}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="stock" label="Current Stock" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="cost_price" label="Unit Cost">
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} size="large" placeholder="0.00" prefix="₱" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="min_stock" label="Min Stock">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_stock" label="Max Stock">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="reorder_point" label="Reorder Point">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="yield_percentage" label="Yield %">
                    <InputNumber min={1} max={100} style={{ width: '100%' }} size="large" placeholder="100" suffix="%" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="reuse_factor" label="Reuse Factor">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} size="large" placeholder="1" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="expiry_date" label="Expiry Date">
                    <DatePicker style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes..." />
              </Form.Item>

              <div className="ingredient-modal-footer-enhanced">
                <Button onClick={() => setCreateOpen(false)} className="ingredient-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={createProduct.isPending} className="ingredient-btn-primary">
                  <SaveOutlined /> Create Product
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== EDIT MODAL ==================== */}
        <Modal
          title={
            <div className="ingredient-modal-header-clean">
              <div className="ingredient-modal-title-icon"><EditOutlined /></div>
              <div className="ingredient-modal-title-text">Edit Product</div>
              <div className="ingredient-modal-badge">{selected?.display_id}</div>
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
          <div className="ingredient-modal-clean-content">
            <Form form={editForm} layout="vertical" onFinish={submitEdit} className="ingredient-add-form">
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="product_name" label="Product Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter product name" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sku" label="SKU">
                    <Input placeholder="Auto-generated" size="large" disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item name="type" label="Product Type" rules={[{ required: true }]}>
                    <Select placeholder="Select type" size="large">
                      {TYPE_OPTIONS.map((item) => (
                        <Option key={item.value} value={item.value}>{item.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="category" label="Category">
                    <Select 
                      placeholder="Select category" 
                      size="large"
                      allowClear
                      showSearch
                    >
                      <Option value="">None</Option>
                      {categories.map((category) => (
                        <Option key={category} value={category}>{category}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                    <Select placeholder="Select unit" size="large">
                      {UNIT_OPTIONS.map((unit) => (
                        <Option key={unit} value={unit}>{unit}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="stock" label="Current Stock" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="cost_price" label="Unit Cost">
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} size="large" placeholder="0.00" prefix="₱" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="min_stock" label="Min Stock">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_stock" label="Max Stock">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="reorder_point" label="Reorder Point">
                    <InputNumber min={0} style={{ width: '100%' }} size="large" placeholder="0" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item name="yield_percentage" label="Yield %">
                    <InputNumber min={1} max={100} style={{ width: '100%' }} size="large" placeholder="100" suffix="%" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="reuse_factor" label="Reuse Factor">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} size="large" placeholder="1" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="expiry_date" label="Expiry Date">
                    <DatePicker style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes..." />
              </Form.Item>

              <div className="ingredient-modal-footer-enhanced">
                <Button onClick={() => setEditOpen(false)} className="ingredient-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={updateProduct.isPending} className="ingredient-btn-primary">
                  <SaveOutlined /> Update Product
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== MOVEMENT MODAL ==================== */}
        <Modal
          title={
            <div className="ingredient-modal-header-clean">
              <div className="ingredient-modal-title-icon"><SwapOutlined /></div>
              <div className="ingredient-modal-title-text">Record Stock Movement</div>
              <div className="ingredient-modal-badge">{selected?.product_name || 'Product'}</div>
            </div>
          }
          open={movementOpen}
          onCancel={() => setMovementOpen(false)}
          width={600}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="ingredient-modal-clean-content">
            <div className="ingredient-movement-current-stock">
              <div className="ingredient-movement-stock-label">Current Stock</div>
              <div className="ingredient-movement-stock-value">
                <span className="ingredient-movement-stock-number">{selected?.stock || 0}</span>
                <span className="ingredient-movement-stock-unit">{selected?.unit}</span>
              </div>
            </div>

            <Divider className="ingredient-modal-divider" />

            <Form form={movementForm} layout="vertical" onFinish={submitMovement}>
              <Form.Item name="movement_type" label="Movement Type" rules={[{ required: true }]}>
                <Radio.Group className="ingredient-movement-radio-group" size="large">
                  <Radio.Button value="purchase" className="movement-in"><ArrowUpOutlined /> Stock In</Radio.Button>
                  <Radio.Button value="usage" className="movement-out"><ArrowDownOutlined /> Stock Out</Radio.Button>
                  <Radio.Button value="adjustment_in" className="movement-adjust"><EditOutlined /> Adj In</Radio.Button>
                  <Radio.Button value="adjustment_out" className="movement-adjust"><EditOutlined /> Adj Out</Radio.Button>
                  <Radio.Button value="return" className="movement-return"><SwapOutlined /> Return</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }, { type: 'number', min: 0.001 }]}>
                <InputNumber
                  min={0.001}
                  precision={3}
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="0.000"
                  onFocus={(event) => {
                    if (Number(event.target.value) === 0) movementForm.setFieldValue('quantity', null);
                  }}
                />
              </Form.Item>

              <Form.Item name="notes" label="Reason / Notes">
                <TextArea rows={3} placeholder="Enter reason for this movement..." />
              </Form.Item>

              <div className="ingredient-modal-footer-enhanced">
                <Button onClick={() => setMovementOpen(false)} className="ingredient-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={recordMovement.isPending} className="ingredient-btn-primary">
                  <SaveOutlined /> Record Movement
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const IngredientsManagementWithApp = () => <App><IngredientsManagement /></App>;
export default IngredientsManagementWithApp;