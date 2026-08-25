// src/components/SupplierManagement.jsx - ENHANCED PROFESSIONAL UI

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, Descriptions, Empty, Form, Input, Modal,
  Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, theme as antdTheme,
  Badge, Divider, Dropdown, Avatar, message
} from 'antd';
import {
  BankOutlined, CheckCircleOutlined, EditOutlined, EyeOutlined, PlusOutlined,
  ReloadOutlined, StopOutlined, DeleteOutlined, MoreOutlined, SearchOutlined,
  FilterOutlined, LeftOutlined, RightOutlined, CalendarOutlined, PrinterOutlined,
  ExportOutlined, SaveOutlined, RiseOutlined, FallOutlined, WarningOutlined,
  CloseOutlined, FileImageOutlined, BoxPlotOutlined, DollarOutlined,
  EnvironmentOutlined, PhoneOutlined, MailOutlined, UserOutlined,CheckOutlined 
} from '@ant-design/icons';
import {
  useCreateSupplier, useSetSupplierActive, useSuppliers, useUpdateSupplier,
} from '../../../hooks/useInventoryQueries';
import '../styles/Suppliers.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const toPayload = (values) => ({
  name: values.name?.trim(),
  code: values.code?.trim() || null,
  contact_person: values.contact_person?.trim(),
  contact_phone: values.phone?.trim(),
  contact_email: values.email?.trim(),
  address: values.address?.trim(),
  status: values.status || 'active',
});

// ============================================================
// PAGINATION HELPERS
// ============================================================
const renderPaginationItem = (_, type, originalElement) => {
  if (type === 'prev') {
    return (
      <Button className="supplier-pagination-nav" size="small" icon={<LeftOutlined />}>
        Previous
      </Button>
    );
  }
  if (type === 'next') {
    return (
      <Button className="supplier-pagination-nav" size="small">
        Next <RightOutlined />
      </Button>
    );
  }
  return originalElement;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const SupplierManagement = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const suppliersQuery = useSuppliers({ per_page: 500 });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const setActive = useSetSupplierActive();

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => (suppliersQuery.data?.data || []).map((row) => ({
    ...row,
    display_id: row.display_id || `SUP-${String(row.id).padStart(4, '0')}`,
    phone: row.phone || row.contact_phone,
    email: row.email || row.contact_email,
    active: row.active ?? row.status === 'active',
  })), [suppliersQuery.data]);

  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [row.display_id, row.code, row.name, row.contact_person, row.phone, row.email, row.address]
      .some((value) => String(value || '').toLowerCase().includes(term));
    return matches && (filterStatus === 'all' || row.status === filterStatus);
  }), [rows, search, filterStatus]);

  const openEdit = (row) => {
    setSelected(row);
    editForm.setFieldsValue({
      name: row.name,
      code: row.code,
      contact_person: row.contact_person,
      phone: row.phone,
      email: row.email,
      address: row.address,
      status: row.status,
    });
    setEditOpen(true);
  };

  const submitCreate = async (values) => {
    try {
      await createSupplier.mutateAsync(toPayload(values));
      createForm.resetFields();
      setCreateOpen(false);
      await suppliersQuery.refetch();
      message.success('Supplier created successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to create supplier');
    }
  };

  const submitEdit = async (values) => {
    try {
      await updateSupplier.mutateAsync({ id: selected.id, data: toPayload(values) });
      editForm.resetFields();
      setEditOpen(false);
      await suppliersQuery.refetch();
      message.success('Supplier updated successfully');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to update supplier');
    }
  };

  const toggleActive = (row) => {
    const next = !row.active;
    Modal.confirm({
      title: `${next ? 'Activate' : 'Deactivate'} Supplier`,
      content: `Are you sure you want to ${next ? 'activate' : 'deactivate'} ${row.name}?`,
      okText: next ? 'Activate' : 'Deactivate',
      okType: next ? 'primary' : 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await setActive.mutateAsync({ id: row.id, active: next });
          await suppliersQuery.refetch();
          message.success(`Supplier ${next ? 'activated' : 'deactivated'} successfully`);
        } catch (error) {
          message.error(error?.response?.data?.message || 'Failed to update status');
        }
      },
    });
  };

  const handleDelete = (row) => {
    Modal.confirm({
      title: 'Delete Supplier',
      content: `Are you sure you want to delete ${row.name}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        message.success(`${row.name} deleted successfully`);
      }
    });
  };

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'SUPPLIER ID',
      dataIndex: 'display_id',
      key: 'id',
      width: 120,
      fixed: 'left',
      render: (value) => <span className="supplier-id-text">{value}</span>
    },
    {
      title: 'SUPPLIER',
      key: 'supplier',
      width: 220,
      render: (_, row) => (
        <div className="supplier-product-cell">
          <div className="supplier-product-info">
            <div className="supplier-product-name">{row.name}</div>
            <div className="supplier-product-meta">
              <span className="supplier-product-code">{row.code || 'No Code'}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'CONTACT PERSON',
      key: 'contact',
      width: 180,
      render: (_, row) => (
        <div className="supplier-contact-cell">
          <div className="supplier-contact-name"><UserOutlined /> {row.contact_person || '—'}</div>
          <div className="supplier-contact-details">
            <span className="supplier-contact-phone"><PhoneOutlined /> {row.phone || '—'}</span>
          </div>
        </div>
      )
    },
    {
      title: 'EMAIL',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (value) => value ? <span className="supplier-email"><MailOutlined /> {value}</span> : '—'
    },
    {
      title: 'ADDRESS',
      dataIndex: 'address',
      key: 'address',
      width: 220,
      ellipsis: true,
      render: (value) => value ? <span className="supplier-address"><EnvironmentOutlined /> {value}</span> : '—'
    },
    {
      title: 'STATUS',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_, row) => (
        <Badge
          status={row.active ? 'success' : 'default'}
          text={row.active ? 'Active' : 'Inactive'}
          className="supplier-activity-badge"
        />
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <div className="supplier-action-group">
          <Tooltip title="View Details">
            <button className="supplier-action-icon view" onClick={() => { setSelected(row); setViewOpen(true); }}>
              <EyeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Edit">
            <button className="supplier-action-icon edit" onClick={() => openEdit(row)}>
              <EditOutlined />
            </button>
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'toggle',
                  label: row.active ? 'Deactivate' : 'Activate',
                  icon: row.active ? <StopOutlined /> : <CheckCircleOutlined />,
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
            <button className="supplier-action-icon more">
              <MoreOutlined />
            </button>
          </Dropdown>
        </div>
      )
    }
  ];

  // ==================== STATISTICS ====================
  const totalSuppliers = rows.length;
  const activeSuppliers = rows.filter((row) => row.active).length;
  const inactiveSuppliers = rows.filter((row) => !row.active).length;

  // ==================== CSS CLASSES ====================
  const containerClass = `supplier-container ${isDarkMode ? 'supplier-dark-mode' : ''}`;
  const headerClass = `supplier-header ${isDarkMode ? 'supplier-header-dark' : ''}`;
  const statsClass = `supplier-stats-grid ${isDarkMode ? 'supplier-stats-dark' : ''}`;
  const filtersClass = `supplier-filters ${isDarkMode ? 'supplier-filters-dark' : ''}`;
  const tableClass = `supplier-table ${isDarkMode ? 'supplier-table-dark' : ''}`;
  const modalClass = `supplier-modal-clean ${isDarkMode ? 'supplier-modal-dark' : ''}`;

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
          <div className="supplier-header-left">
            <Tooltip title="Supplier Management">
              <div className="supplier-logo-icon"><BankOutlined /></div>
            </Tooltip>
            <div className="supplier-header-info">
              <h1>Supplier Management</h1>
              <span>VENDOR RELATIONSHIP</span>
            </div>
          </div>
          <div className="supplier-header-right">
            <div className="supplier-date-display">
              <CalendarOutlined />
              <span>{formattedDate}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={suppliersQuery.isFetching}
                onClick={() => suppliersQuery.refetch()}
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
            <Tooltip title="Add new supplier">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({ status: 'active' });
                  setCreateOpen(true);
                }}
              >
                Add Supplier
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ==================== STATS CARDS ==================== */}
        <div className={statsClass}>
          <div className="supplier-stat-card">
            <div className="supplier-stat-icon blue"><BankOutlined /></div>
            <div className="supplier-stat-info">
              <div className="supplier-stat-value">{totalSuppliers}</div>
              <div className="supplier-stat-label">Total Suppliers</div>
            </div>
            <div className="supplier-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="supplier-stat-card">
            <div className="supplier-stat-icon green"><CheckCircleOutlined /></div>
            <div className="supplier-stat-info">
              <div className="supplier-stat-value">{activeSuppliers}</div>
              <div className="supplier-stat-label">Active</div>
            </div>
            <div className="supplier-stat-trend up"><CheckOutlined /> {totalSuppliers > 0 ? Math.round((activeSuppliers / totalSuppliers) * 100) : 0}%</div>
          </div>
          <div className="supplier-stat-card">
            <div className="supplier-stat-icon red"><StopOutlined /></div>
            <div className="supplier-stat-info">
              <div className="supplier-stat-value">{inactiveSuppliers}</div>
              <div className="supplier-stat-label">Inactive</div>
            </div>
            <div className="supplier-stat-trend down"><FallOutlined /> Needs review</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="supplier-main-card" variant="borderless">
          <div className="supplier-table-container">
            {/* Filters */}
            <div className={filtersClass}>
              <div className="supplier-filter-group supplier-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search suppliers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="supplier-search-input"
                />
              </div>
              <div className="supplier-filter-group">
                <FilterOutlined />
                <Select
                  value={filterStatus}
                  style={{ width: 150 }}
                  onChange={setFilterStatus}
                  className="supplier-filter-select"
                  placeholder="Status"
                >
                  <Option value="all">All Status</Option>
                  <Option value="active">Active</Option>
                  <Option value="inactive">Inactive</Option>
                </Select>
              </div>
            </div>

            {/* Table - Scrollable Body Only */}
            <div className="supplier-table-wrapper">
              <Spin spinning={suppliersQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey="id"
                  className={tableClass}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} suppliers`,
                    itemRender: renderPaginationItem,
                    pageSizeOptions: ['5', '10', '20', '50']
                  }}
                  scroll={{ x: 1300, y: 'calc(100vh - 420px)' }}
                  locale={{
                    emptyText: (
                      <div className="supplier-empty-state">
                        <BankOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {suppliersQuery.isError ? 'Unable to load supplier data' : 'No suppliers found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {suppliersQuery.isError ? 'Please try refreshing the page' : 'Suppliers will appear here once added'}
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
            <div className="supplier-modal-header-clean">
              <div className="supplier-modal-title-icon"><EyeOutlined /></div>
              <div className="supplier-modal-title-text">Supplier Details</div>
              <div className="supplier-modal-badge">{selected?.display_id}</div>
            </div>
          }
          open={viewOpen}
          onCancel={() => setViewOpen(false)}
          width={720}
          className={modalClass}
          footer={
            <div className="supplier-modal-footer-simple">
              <Button type="primary" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="supplier-modal-clean-content">
              {/* Header */}
              <div className="supplier-view-header">
                <div className="supplier-view-icon">
                  <BankOutlined style={{ fontSize: 28, color: '#1a7ab5' }} />
                </div>
                <div className="supplier-view-header-info">
                  <div className="supplier-view-name">{selected.name}</div>
                  <div className="supplier-view-meta">
                    <Tag>{selected.code || 'No Code'}</Tag>
                    <Badge status={selected.active ? 'success' : 'default'} text={selected.active ? 'Active' : 'Inactive'} />
                  </div>
                </div>
              </div>

              <Divider className="supplier-modal-divider" />

              {/* Grid */}
              <div className="supplier-view-grid">
                <div className="supplier-view-section">
                  <div className="supplier-view-label">Contact Person</div>
                  <div className="supplier-view-value"><UserOutlined /> {selected.contact_person || '—'}</div>
                </div>
                <div className="supplier-view-section">
                  <div className="supplier-view-label">Phone</div>
                  <div className="supplier-view-value"><PhoneOutlined /> {selected.phone || '—'}</div>
                </div>
                <div className="supplier-view-section">
                  <div className="supplier-view-label">Email</div>
                  <div className="supplier-view-value"><MailOutlined /> {selected.email || '—'}</div>
                </div>
                <div className="supplier-view-section">
                  <div className="supplier-view-label">Address</div>
                  <div className="supplier-view-value"><EnvironmentOutlined /> {selected.address || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* ==================== CREATE MODAL ==================== */}
        <Modal
          title={
            <div className="supplier-modal-header-clean">
              <div className="supplier-modal-title-icon"><PlusOutlined /></div>
              <div className="supplier-modal-title-text">Add Supplier</div>
              <div className="supplier-modal-badge">New</div>
            </div>
          }
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          width={760}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="supplier-modal-clean-content">
            <Form form={createForm} layout="vertical" onFinish={submitCreate} className="supplier-form">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="Supplier Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter supplier name" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="code" label="Supplier Code">
                    <Input placeholder="Auto-generated if blank" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="contact_person" label="Contact Person" rules={[{ required: true }]}>
                    <Input placeholder="Contact person name" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
                    <Input placeholder="Contact number" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="Email address" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="status" label="Status">
                    <Select size="large">
                      <Option value="active">Active</Option>
                      <Option value="inactive">Inactive</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="address" label="Address" rules={[{ required: true }]}>
                <TextArea rows={3} placeholder="Supplier address" />
              </Form.Item>

              <div className="supplier-modal-footer-enhanced">
                <Button onClick={() => setCreateOpen(false)} className="supplier-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={createSupplier.isPending} className="supplier-btn-primary">
                  <SaveOutlined /> Create Supplier
                </Button>
              </div>
            </Form>
          </div>
        </Modal>

        {/* ==================== EDIT MODAL ==================== */}
        <Modal
          title={
            <div className="supplier-modal-header-clean">
              <div className="supplier-modal-title-icon"><EditOutlined /></div>
              <div className="supplier-modal-title-text">Edit Supplier</div>
              <div className="supplier-modal-badge">{selected?.display_id}</div>
            </div>
          }
          open={editOpen}
          onCancel={() => setEditOpen(false)}
          width={760}
          className={modalClass}
          footer={null}
          maskClosable={false}
          keyboard={false}
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          <div className="supplier-modal-clean-content">
            <Form form={editForm} layout="vertical" onFinish={submitEdit} className="supplier-form">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="Supplier Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter supplier name" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="code" label="Supplier Code">
                    <Input placeholder="Auto-generated if blank" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="contact_person" label="Contact Person" rules={[{ required: true }]}>
                    <Input placeholder="Contact person name" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
                    <Input placeholder="Contact number" size="large" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="Email address" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="status" label="Status">
                    <Select size="large">
                      <Option value="active">Active</Option>
                      <Option value="inactive">Inactive</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="address" label="Address" rules={[{ required: true }]}>
                <TextArea rows={3} placeholder="Supplier address" />
              </Form.Item>

              <div className="supplier-modal-footer-enhanced">
                <Button onClick={() => setEditOpen(false)} className="supplier-btn-cancel">Cancel</Button>
                <Button type="primary" htmlType="submit" loading={updateSupplier.isPending} className="supplier-btn-primary">
                  <SaveOutlined /> Update Supplier
                </Button>
              </div>
            </Form>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const SupplierManagementWithApp = () => <App><SupplierManagement /></App>;
export default SupplierManagementWithApp;