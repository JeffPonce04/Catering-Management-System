// src/components/PurchaseRequests.jsx - FIXED (Missing semicolon)

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  App, Alert, Button, Card, Col, ConfigProvider, Descriptions, Empty, Form, Input,
  InputNumber, Modal, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography,
  theme as antdTheme, Badge, Divider, Dropdown, message
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, PlusOutlined, ReloadOutlined,
  ShoppingCartOutlined, DeleteOutlined, MoreOutlined, SearchOutlined, FilterOutlined,
  LeftOutlined, RightOutlined, CalendarOutlined, PrinterOutlined, ExportOutlined,
  SaveOutlined, RiseOutlined, WarningOutlined, TagOutlined, UserOutlined,
  ClockCircleOutlined, DollarOutlined, BoxPlotOutlined,CheckOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, hasAllowedRole } from '../../../utils/roleRoutes';
import {
  useCreatePurchaseRequest, useProducts, usePurchaseRequests, usePurchaseSuggestions,
  useSuppliers, useUpdatePurchaseRequest,
} from '../../../hooks/useInventoryQueries';
import '../styles/PurchaseRequest.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const statusColor = (status) => ({ 
  pending: { color: '#f59e0b', bg: '#fffbeb', text: 'Pending' },
  approved: { color: '#10b981', bg: '#ecfdf5', text: 'Approved' },
  ordered: { color: '#8b5cf6', bg: '#f5f3ff', text: 'Ordered' },
  received: { color: '#06b6d4', bg: '#ecfdf5', text: 'Received' },
  cancelled: { color: '#ef4444', bg: '#fef2f2', text: 'Cancelled' }
}); // <-- SEMICOLON ADDED HERE

const urgencyColor = (urgency) => ({ 
  normal: { color: '#3b82f6', bg: '#eff6ff', text: 'Normal' },
  urgent: { color: '#f59e0b', bg: '#fffbeb', text: 'Urgent' },
  critical: { color: '#ef4444', bg: '#fef2f2', text: 'Critical' }
});

// ============================================================
// PAGINATION HELPERS
// ============================================================
const renderPaginationItem = (_, type, originalElement) => {
  if (type === 'prev') {
    return (
      <Button className="pr-pagination-nav" size="small" icon={<LeftOutlined />}>
        Previous
      </Button>
    );
  }
  if (type === 'next') {
    return (
      <Button className="pr-pagination-nav" size="small">
        Next <RightOutlined />
      </Button>
    );
  }
  return originalElement;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const PurchaseRequests = () => {
  const { user } = useAuth();
  const isAdmin = hasAllowedRole(user, ADMIN_ROLES);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const deferredSearch = useDeferredValue(search.trim());

  const requestsQuery = usePurchaseRequests({
    per_page: pageSize,
    page,
    status: status === 'all' ? undefined : status,
    search: deferredSearch || undefined,
  });
  const suggestionsQuery = usePurchaseSuggestions({ days: 30 });
  const productsQuery = useProducts({ per_page: 500, active: 1 });
  const suppliersQuery = useSuppliers({ per_page: 500, active: 1 });
  const createRequest = useCreatePurchaseRequest();
  const updateRequest = useUpdatePurchaseRequest();

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const requests = useMemo(() => requestsQuery.data?.data || [], [requestsQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [status, deferredSearch]);

  const products = productsQuery.data?.data || [];
  const suppliers = suppliersQuery.data?.data || [];

  const submitCreate = async (values) => {
    try {
      await createRequest.mutateAsync({
        ingredient_id: values.ingredient_id,
        supplier_id: values.supplier_id || null,
        booking_id: values.booking_id || null,
        quantity: Number(values.quantity),
        urgency: values.urgency || 'normal',
        notes: values.notes?.trim() || null,
      });
      form.resetFields();
      setCreateOpen(false);
      await requestsQuery.refetch();
      await suggestionsQuery.refetch();
      message.success('Purchase request created successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to create purchase request');
    }
  };

  const changeStatus = (row, nextStatus, title) => {
    Modal.confirm({
      title,
      content: `Update ${row.pr_number} to ${nextStatus.replace('_', ' ')}?`,
      okText: 'Confirm',
      onOk: async () => {
        try {
          await updateRequest.mutateAsync({ id: row.id, data: { status: nextStatus } });
          await requestsQuery.refetch();
          message.success(`Status updated to ${nextStatus} successfully`);
        } catch (error) {
          message.error(error?.response?.data?.message || 'Failed to update status');
        }
      },
    });
  };

  const createFromSuggestion = (suggestion) => {
    form.setFieldsValue({
      ingredient_id: suggestion.ingredient_id,
      booking_id: suggestion.booking_id,
      quantity: suggestion.suggestedQuantity || suggestion.shortage,
      urgency: suggestion.urgency || 'normal',
      notes: `Shortage for ${suggestion.event_name || 'confirmed event'} (${suggestion.booking_no || 'booking'}).`,
    });
    setCreateOpen(true);
  };

  // ==================== STATISTICS ====================
  const totalRequests = requests.length;
  const pendingCount = requests.filter((row) => row.status === 'pending').length;
  const approvedCount = requests.filter((row) => row.status === 'approved').length;
  const orderedCount = requests.filter((row) => row.status === 'ordered').length;
  const receivedCount = requests.filter((row) => row.status === 'received').length;
  const suggestionCount = (suggestionsQuery.data || []).filter((row) => !row.existing_purchase_request_id).length;

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'REQUEST ID',
      dataIndex: 'pr_number',
      key: 'id',
      width: 160,
      fixed: 'left',
      render: (value) => <span className="pr-request-id">{value}</span>
    },
    {
      title: 'INGREDIENT',
      key: 'ingredient',
      width: 180,
      render: (_, row) => (
        <div className="pr-ingredient-cell">
          <div className="pr-ingredient-name">{row.ingredient_name}</div>
          <div className="pr-ingredient-meta">
            <span className="pr-ingredient-unit">{row.unit}</span>
          </div>
        </div>
      )
    },
    {
      title: 'QUANTITY',
      key: 'quantity',
      width: 120,
      align: 'right',
      render: (_, row) => (
        <div className="pr-quantity-cell">
          <div className="pr-quantity">{Number(row.quantity || 0).toLocaleString()} <span className="pr-quantity-unit">{row.unit}</span></div>
        </div>
      )
    },
    {
      title: 'ORDER / EVENT',
      key: 'booking',
      width: 190,
      render: (_, row) => (
        <div className="pr-booking-cell">
          <div className="pr-booking-id">{row.booking_no || 'Manual Request'}</div>
          <div className="pr-booking-event">{row.event_name || '—'}</div>
        </div>
      )
    },
    {
      title: 'SUPPLIER',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
      render: (value) => <span className="pr-supplier">{value || 'Not assigned'}</span>
    },
    {
      title: 'URGENCY',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 110,
      align: 'center',
      render: (value) => {
        const config = urgencyColor(value) || urgencyColor.normal;
        return (
          <span className="pr-urgency-badge" style={{ color: config.color, background: config.bg }}>
            {config.text}
          </span>
        );
      }
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (value) => {
        const config = statusColor(value) || statusColor.pending;
        return (
          <span className="pr-status-badge" style={{ color: config.color, background: config.bg }}>
            {config.text}
          </span>
        );
      }
    },
    {
      title: 'REQUESTED BY',
      dataIndex: 'requested_by',
      key: 'requested_by',
      width: 150,
      render: (value) => <span className="pr-requested-by"><UserOutlined /> {value}</span>
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, row) => (
        <div className="pr-action-group">
          <Tooltip title="View Details">
            <button className="pr-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
              <EyeOutlined />
            </button>
          </Tooltip>
          {row.status === 'pending' && (
            <Tooltip title={isAdmin ? 'Approve request' : 'Only Admin users can approve'}>
              <button 
                className="pr-action-icon approve" 
                disabled={!isAdmin} 
                onClick={() => changeStatus(row, 'approved', 'Approve Purchase Request')}
              >
                <CheckCircleOutlined />
              </button>
            </Tooltip>
          )}
          {row.status === 'approved' && (
            <Tooltip title="Mark as Ordered">
              <button className="pr-action-icon order" onClick={() => changeStatus(row, 'ordered', 'Mark as Ordered')}>
                <DollarOutlined />
              </button>
            </Tooltip>
          )}
          {row.status === 'ordered' && (
            <Tooltip title="Mark as Received">
              <button className="pr-action-icon receive" onClick={() => changeStatus(row, 'received', 'Mark as Received')}>
                <CheckCircleOutlined />
              </button>
            </Tooltip>
          )}
          {!['received', 'cancelled'].includes(row.status) && (
            <Tooltip title="Cancel">
              <button className="pr-action-icon cancel" onClick={() => changeStatus(row, 'cancelled', 'Cancel Purchase Request')}>
                <CloseCircleOutlined />
              </button>
            </Tooltip>
          )}
        </div>
      )
    }
  ];

  // ==================== CSS CLASSES ====================
  const containerClass = `pr-container ${isDarkMode ? 'pr-dark-mode' : ''}`;
  const headerClass = `pr-header ${isDarkMode ? 'pr-header-dark' : ''}`;
  const statsClass = `pr-stats-grid ${isDarkMode ? 'pr-stats-dark' : ''}`;
  const filtersClass = `pr-filters ${isDarkMode ? 'pr-filters-dark' : ''}`;
  const tableClass = `pr-table ${isDarkMode ? 'pr-table-dark' : ''}`;
  const modalClass = `pr-modal-clean ${isDarkMode ? 'pr-modal-dark' : ''}`;

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
          <div className="pr-header-left">
            <Tooltip title="Purchase Requests">
              <div className="pr-logo-icon"><ShoppingCartOutlined /></div>
            </Tooltip>
            <div className="pr-header-info">
              <h1>Purchase Requests</h1>
              <span>INVENTORY PROCUREMENT</span>
            </div>
          </div>
          <div className="pr-header-right">
            <div className="pr-date-display">
              <CalendarOutlined />
              <span>{formattedDate}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={requestsQuery.isFetching}
                onClick={() => { requestsQuery.refetch(); suggestionsQuery.refetch(); }}
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
            <Tooltip title="Create new request">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  form.setFieldsValue({ urgency: 'normal' });
                  setCreateOpen(true);
                }}
              >
                New Request
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="pr-stat-card">
            <div className="pr-stat-icon blue"><ShoppingCartOutlined /></div>
            <div className="pr-stat-info">
              <div className="pr-stat-value">{totalRequests}</div>
              <div className="pr-stat-label">Total Requests</div>
            </div>
            <div className="pr-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="pr-stat-card">
            <div className="pr-stat-icon orange"><ClockCircleOutlined /></div>
            <div className="pr-stat-info">
              <div className="pr-stat-value">{pendingCount}</div>
              <div className="pr-stat-label">Pending</div>
            </div>
            <div className="pr-stat-trend warning">Needs attention</div>
          </div>
          <div className="pr-stat-card">
            <div className="pr-stat-icon green"><CheckCircleOutlined /></div>
            <div className="pr-stat-info">
              <div className="pr-stat-value">{approvedCount}</div>
              <div className="pr-stat-label">Approved</div>
            </div>
            <div className="pr-stat-trend up"><CheckOutlined /> Ready</div>
          </div>
          <div className="pr-stat-card">
            <div className="pr-stat-icon purple"><DollarOutlined /></div>
            <div className="pr-stat-info">
              <div className="pr-stat-value">{orderedCount}</div>
              <div className="pr-stat-label">Ordered</div>
            </div>
            <div className="pr-stat-trend up">In progress</div>
          </div>
          <div className="pr-stat-card">
            <div className="pr-stat-icon red"><WarningOutlined /></div>
            <div className="pr-stat-info">
              <div className="pr-stat-value">{suggestionCount}</div>
              <div className="pr-stat-label">Unconverted Suggestions</div>
            </div>
            <div className="pr-stat-trend warning">Action needed</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="pr-main-card" variant="borderless">
          <div className="pr-table-container">
            {/* Alert for non-admin users */}
            {!isAdmin && (
              <Alert
                message="Approval is restricted to Admin users"
                description="Inventory Managers can view and prepare purchase requests but cannot approve them."
                type="info"
                showIcon
                className="pr-info-alert"
              />
            )}

            {/* Suggestions Section */}
            {suggestionCount > 0 && (
              <div className="pr-suggestions-section">
                <div className="pr-suggestions-header">
                  <div className="pr-suggestions-title">
                    <WarningOutlined /> Confirmed Order Shortages
                    <Badge count={suggestionCount} className="pr-suggestions-badge" />
                  </div>
                </div>
                <div className="pr-suggestions-list">
                  {(suggestionsQuery.data || [])
                    .filter((row) => !row.existing_purchase_request_id)
                    .slice(0, 3)
                    .map((suggestion) => (
                      <div key={suggestion.id} className="pr-suggestion-item">
                        <div className="pr-suggestion-main">
                          <div className="pr-suggestion-ingredient">
                            <span className="pr-suggestion-name">{suggestion.name}</span>
                            <span className="pr-suggestion-detail">
                              Shortage: <strong>{suggestion.shortage}</strong> {suggestion.unit}
                            </span>
                            <Tag className="pr-suggestion-tag" color={urgencyColor(suggestion.urgency || 'normal').color}>
                              {urgencyColor(suggestion.urgency || 'normal').text}
                            </Tag>
                          </div>
                          <div className="pr-suggestion-event">
                            <span className="pr-suggestion-event-type">{suggestion.event_name || 'Event'}</span>
                            <span className="pr-suggestion-booking">{suggestion.booking_no}</span>
                            <span className="pr-suggestion-date">
                              <CalendarOutlined /> {suggestion.event_date ? dayjs(suggestion.event_date).format('MMM D, YYYY') : '—'}
                            </span>
                          </div>
                          <div className="pr-suggestion-buy">
                            <span className="pr-suggestion-need">
                              Need to purchase: <strong>{suggestion.shortage}</strong> {suggestion.unit}
                            </span>
                            <Button
                              size="small"
                              type="primary"
                              icon={<PlusOutlined />}
                              className="pr-suggestion-btn"
                              onClick={() => createFromSuggestion(suggestion)}
                            >
                              Create Request
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {suggestionCount > 3 && (
                    <div className="pr-suggestions-more">
                      <Text type="secondary">+ {suggestionCount - 3} more suggestions</Text>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className={filtersClass}>
              <div className="pr-filter-group pr-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search requests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="pr-search-input"
                />
              </div>
              <div className="pr-filter-group">
                <FilterOutlined />
                <Select
                  value={status}
                  style={{ width: 160 }}
                  onChange={setStatus}
                  className="pr-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Statuses</Option>
                  {['pending', 'approved', 'ordered', 'received', 'cancelled'].map((value) => (
                    <Option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
            <div className="pr-table-wrapper">
              <Spin spinning={requestsQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={requests}
                  rowKey="id"
                  className={tableClass}
                  pagination={{
                    current: requestsQuery.data?.current_page || page,
                    pageSize: pageSize,
                    total: requestsQuery.data?.total || 0,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} requests`,
                    itemRender: renderPaginationItem,
                    onChange: (nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); },
                    pageSizeOptions: ['5', '10', '20', '50']
                  }}
                  scroll={{ x: 1400 }}
                  locale={{
                    emptyText: (
                      <div className="pr-empty-state">
                        <ShoppingCartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {requestsQuery.isError ? 'Unable to load purchase requests' : 'No purchase requests found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {requestsQuery.isError ? 'Please try refreshing the page' : 'Requests will appear here once created'}
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
            <div className="pr-modal-header-clean">
              <div className="pr-modal-title-icon"><EyeOutlined /></div>
              <div className="pr-modal-title-text">Purchase Request Details</div>
              <div className="pr-modal-badge">{selected?.pr_number}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={760}
          className={modalClass}
          footer={
            <div className="pr-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="pr-modal-clean-content">
              {/* Header */}
              <div className="pr-view-header">
                <div className="pr-view-icon">
                  <ShoppingCartOutlined style={{ fontSize: 28, color: '#1a7ab5' }} />
                </div>
                <div className="pr-view-header-info">
                  <div className="pr-view-name">{selected.pr_number}</div>
                  <div className="pr-view-meta">
                    <span className="pr-view-status" style={{ color: statusColor(selected.status).color, background: statusColor(selected.status).bg }}>
                      {statusColor(selected.status).text}
                    </span>
                    <span className="pr-view-urgency" style={{ color: urgencyColor(selected.urgency).color, background: urgencyColor(selected.urgency).bg }}>
                      {urgencyColor(selected.urgency).text}
                    </span>
                  </div>
                </div>
              </div>

              <Divider className="pr-modal-divider" />

              {/* Grid */}
              <div className="pr-view-grid">
                <div className="pr-view-section">
                  <div className="pr-view-label">Ingredient</div>
                  <div className="pr-view-value">{selected.ingredient_name}</div>
                </div>
                <div className="pr-view-section">
                  <div className="pr-view-label">Quantity</div>
                  <div className="pr-view-value">{selected.quantity} {selected.unit}</div>
                </div>
                <div className="pr-view-section">
                  <div className="pr-view-label">Booking</div>
                  <div className="pr-view-value">{selected.booking_no || 'Manual'}</div>
                </div>
                <div className="pr-view-section">
                  <div className="pr-view-label">Event</div>
                  <div className="pr-view-value">{selected.event_name || '—'}</div>
                </div>
                <div className="pr-view-section">
                  <div className="pr-view-label">Event Date</div>
                  <div className="pr-view-value">{selected.event_date ? dayjs(selected.event_date).format('MMM D, YYYY') : '—'}</div>
                </div>
                <div className="pr-view-section">
                  <div className="pr-view-label">Supplier</div>
                  <div className="pr-view-value">{selected.supplier || 'Not assigned'}</div>
                </div>
                <div className="pr-view-section">
                  <div className="pr-view-label">Requested By</div>
                  <div className="pr-view-value"><UserOutlined /> {selected.requested_by}</div>
                </div>
                <div className="pr-view-section">
                  <div className="pr-view-label">Created</div>
                  <div className="pr-view-value">{selected.created_at ? dayjs(selected.created_at).format('MMM D, YYYY h:mm A') : '—'}</div>
                </div>
              </div>

              {selected.notes && (
                <>
                  <Divider className="pr-modal-divider" />
                  <div className="pr-view-notes">
                    <div className="pr-view-label" style={{ marginBottom: 4 }}>Notes</div>
                    <div className="pr-view-value" style={{ fontWeight: 400 }}>{selected.notes}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>

        {/* ==================== CREATE MODAL ==================== */}
        <Modal
          title={
            <div className="pr-modal-header-clean">
              <div className="pr-modal-title-icon"><PlusOutlined /></div>
              <div className="pr-modal-title-text">Create Purchase Request</div>
              <div className="pr-modal-badge">New</div>
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
          <div className="pr-modal-clean-content">
            <Form form={form} layout="vertical" onFinish={submitCreate} className="pr-form">
              <Form.Item name="ingredient_id" label="Ingredient" rules={[{ required: true }]}>
                <Select 
                  showSearch 
                  optionFilterProp="label" 
                  size="large"
                  placeholder="Select ingredient"
                  className="pr-select-modern"
                  options={products.map((row) => ({ 
                    value: row.id, 
                    label: `${row.product_name || row.name} (${row.unit})` 
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
                      className="pr-input-modern"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="urgency" label="Urgency">
                    <Select 
                      size="large"
                      className="pr-select-modern"
                      options={['normal', 'urgent', 'critical'].map((value) => ({ 
                        value, 
                        label: value[0].toUpperCase() + value.slice(1) 
                      }))} 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="supplier_id" label="Supplier">
                <Select 
                  allowClear 
                  showSearch 
                  optionFilterProp="label" 
                  size="large"
                  placeholder="Select supplier"
                  className="pr-select-modern"
                  options={suppliers.map((row) => ({ value: row.id, label: row.name }))} 
                />
              </Form.Item>

              <Form.Item name="booking_id" label="Booking ID">
                <InputNumber 
                  min={1} 
                  style={{ width: '100%' }} 
                  size="large"
                  placeholder="Enter booking ID"
                  className="pr-input-modern"
                />
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <TextArea 
                  rows={3} 
                  placeholder="Additional notes..." 
                  className="pr-textarea-modern"
                />
              </Form.Item>

              <div className="pr-modal-footer-enhanced">
                <Button onClick={() => setCreateOpen(false)} className="pr-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={createRequest.isPending} className="pr-btn-primary">
                  <SaveOutlined /> Create Request
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const PurchaseRequestsWithApp = () => <App><PurchaseRequests /></App>;
export default PurchaseRequestsWithApp;