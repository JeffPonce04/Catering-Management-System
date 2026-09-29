// src/components/StockMovement.jsx - SCROLLABLE TABLE (NO PAGINATION)

import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Col, ConfigProvider, DatePicker, Descriptions, Empty, Input,
  Modal, Row, Segmented, Select, Space, Spin, Statistic, Table, Tag, Typography,
  theme as antdTheme, Badge, Divider, Tooltip, message
} from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, EyeOutlined, ReloadOutlined, SwapOutlined,
  UserOutlined, WarningOutlined, SearchOutlined, FilterOutlined, LeftOutlined,
  RightOutlined, CalendarOutlined, PrinterOutlined, ExportOutlined, RiseOutlined,
  FallOutlined, ClockCircleOutlined, BoxPlotOutlined, DollarOutlined,
  CheckCircleOutlined, CloseCircleOutlined, MoreOutlined, ClearOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useInventoryMovements } from '../../../hooks/useInventoryQueries';
import '../styles/StockMovement.css';

const { Text } = Typography;
const { Option } = Select;

const TYPE_LABELS = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  manual_adjustment: 'Manual Adjustment',
  waste: 'Waste',
  reservation: 'Reservation',
  return: 'Return',
};

const TYPE_COLORS = {
  stock_in: { color: '#10b981', bg: '#ecfdf5', icon: <ArrowUpOutlined /> },
  stock_out: { color: '#ef4444', bg: '#fef2f2', icon: <ArrowDownOutlined /> },
  manual_adjustment: { color: '#8b5cf6', bg: '#f5f3ff', icon: <SwapOutlined /> },
  waste: { color: '#f59e0b', bg: '#fffbeb', icon: <WarningOutlined /> },
  reservation: { color: '#1a7ab5', bg: '#e6f0fa', icon: <ClockCircleOutlined /> },
  return: { color: '#06b6d4', bg: '#ecfdf5', icon: <SwapOutlined /> },
};

const currency = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

// ============================================================
// MAIN COMPONENT
// ============================================================
const Movements = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // ⭐ Date filter state — defaults to "all" so nothing is hidden on first load.
  const [period, setPeriod] = useState('all');           // all | daily | weekly | monthly
  const [referenceDate, setReferenceDate] = useState(dayjs());

  // ⭐ Compute the actual [date_from, date_to] from period + referenceDate.
  const dateRange = useMemo(() => {
    if (period === 'all') return { date_from: undefined, date_to: undefined };

    const base = referenceDate || dayjs();

    if (period === 'daily') {
      return {
        date_from: base.startOf('day').format('YYYY-MM-DD'),
        date_to: base.endOf('day').format('YYYY-MM-DD'),
      };
    }

    if (period === 'weekly') {
      return {
        date_from: base.startOf('week').format('YYYY-MM-DD'),
        date_to: base.endOf('week').format('YYYY-MM-DD'),
      };
    }

    // monthly
    return {
      date_from: base.startOf('month').format('YYYY-MM-DD'),
      date_to: base.endOf('month').format('YYYY-MM-DD'),
    };
  }, [period, referenceDate]);

  const movementsQuery = useInventoryMovements({
    per_page: 500,
    date_from: dateRange.date_from,
    date_to: dateRange.date_to,
  });

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => movementsQuery.data?.data || [], [movementsQuery.data]);
  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [row.item_name, row.product_name, row.reference, row.reason, row.updated_by]
      .some((value) => String(value || '').toLowerCase().includes(term));
    return matches && (type === 'all' || row.movement_type === type);
  }), [rows, search, type]);

  const counts = useMemo(() => Object.keys(TYPE_LABELS).reduce((acc, key) => ({ ...acc, [key]: rows.filter((row) => row.movement_type === key).length }), {}), [rows]);

  // ⭐ Human-readable label for the active period.
  const periodLabel = useMemo(() => {
    if (period === 'all') return 'All Time';
    const base = referenceDate || dayjs();
    if (period === 'daily')   return base.format('MMMM D, YYYY');
    if (period === 'weekly')  return `${base.startOf('week').format('MMM D')} – ${base.endOf('week').format('MMM D, YYYY')}`;
    return base.format('MMMM YYYY');
  }, [period, referenceDate]);
  // ==================== STATISTICS ====================
  const totalMovements = rows.length;
  const stockInCount = counts.stock_in || 0;
  const stockOutCount = counts.stock_out || 0;
  const wasteCount = counts.waste || 0;
  const returnCount = counts.return || 0;

  // ==================== TABLE COLUMNS ====================
  const columns = [
    {
      title: 'DATE & TIME',
      key: 'date',
      width: 180,
      fixed: 'left',
      render: (_, row) => (
        <div className="sm-date-cell">
          <div className="sm-date-main">{dayjs(row.movement_at || row.created_at).format('MMM D, YYYY')}</div>
          <div className="sm-date-time">{dayjs(row.movement_at || row.created_at).format('h:mm A')}</div>
        </div>
      )
    },
    {
      title: 'ITEM',
      key: 'item',
      width: 210,
      render: (_, row) => (
        <div className="sm-item-cell">
          <div className="sm-item-name">{row.item_name || row.product_name}</div>
          <div className="sm-item-meta">
            <span className="sm-item-type">{row.item_type || 'ingredient'}</span>
            {row.unit && <span className="sm-item-unit">{row.unit}</span>}
          </div>
        </div>
      )
    },
    {
      title: 'MOVEMENT TYPE',
      key: 'type',
      width: 160,
      render: (_, row) => {
        const config = TYPE_COLORS[row.movement_type] || TYPE_COLORS.manual_adjustment;
        return (
          <span className="sm-movement-badge" style={{ color: config.color, background: config.bg }}>
            {config.icon} {TYPE_LABELS[row.movement_type] || row.movement_type}
          </span>
        );
      }
    },
    {
      title: 'QUANTITY',
      key: 'quantity',
      width: 140,
      align: 'right',
      render: (_, row) => {
        const change = Number(row.quantity_change ?? row.quantity ?? 0);
        const positive = change > 0;
        return (
          <div className="sm-quantity-cell">
            <div className={`sm-quantity ${positive ? 'sm-quantity-positive' : 'sm-quantity-negative'}`}>
              {positive ? '+' : ''}{change.toLocaleString()}
            </div>
            <div className="sm-quantity-range">
              <span className="sm-quantity-before">{row.quantity_before ?? '—'}</span>
              <span className="sm-quantity-arrow">→</span>
              <span className="sm-quantity-after">{row.quantity_after ?? '—'}</span>
            </div>
          </div>
        );
      }
    },
    {
      title: 'SOURCE',
      dataIndex: 'source',
      key: 'source',
      width: 160,
      render: (value) => {
        const colorMap = {
          'Purchase': '#10b981',
          'Order': '#1a7ab5',
          'Waste Management': '#f59e0b',
          'Ingredients Management': '#8b5cf6',
          'Return': '#06b6d4',
          'Auto Reorder': '#6b7280',
        };
        return (
          <span style={{
            padding: '2px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: colorMap[value] || '#6b7280',
            background: (colorMap[value] || '#6b7280') + '15',
          }}>
            {value || '—'}
          </span>
        );
      }
    },
    {
      title: 'REFERENCE',
      key: 'reference',
      width: 160,
      render: (_, row) => (
        <div className="sm-reference-cell">
          <div className="sm-reference">{row.reference || '—'}</div>
          {row.booking_no && <div className="sm-reference-booking">{row.booking_no}</div>}
        </div>
      )
    },
    {
      title: 'UPDATED BY',
      key: 'updated_by',
      width: 160,
      render: (_, row) => (
        <div className="sm-updated-cell">
          <UserOutlined /> <span className="sm-updated-name">{row.updated_by || 'System'}</span>
        </div>
      )
    },
    {
      title: 'REASON',
      key: 'reason',
      width: 180,
      render: (_, row) => (
        <Tooltip title={row.reason}>
          <span className="sm-reason">{row.reason?.substring(0, 50) || '—'}{row.reason?.length > 50 ? '...' : ''}</span>
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
        <Tooltip title="View Details">
          <button className="sm-action-icon view" onClick={() => { setSelected(row); setDetailsOpen(true); }}>
            <EyeOutlined />
          </button>
        </Tooltip>
      )
    }
  ];

  // ==================== CSS CLASSES ====================
  const containerClass = `sm-container ${isDarkMode ? 'sm-dark-mode' : ''}`;
  const headerClass = `sm-header ${isDarkMode ? 'sm-header-dark' : ''}`;
  const statsClass = `sm-stats-grid ${isDarkMode ? 'sm-stats-dark' : ''}`;
  const filtersClass = `sm-filters ${isDarkMode ? 'sm-filters-dark' : ''}`;
  const tableClass = `sm-table ${isDarkMode ? 'sm-table-dark' : ''}`;
  const modalClass = `sm-modal-clean ${isDarkMode ? 'sm-modal-dark' : ''}`;

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
          <div className="sm-header-left">
            <Tooltip title="Inventory Movements">
              <div className="sm-logo-icon"><BoxPlotOutlined /></div>
            </Tooltip>
            <div className="sm-header-info">
              <h1>Inventory Movements</h1>
              <span>TRACKING & AUDIT</span>
            </div>
          </div>
          <div className="sm-header-right">
                       <div className="sm-date-display">
              <CalendarOutlined />
              <span>{period === 'all' ? formattedDate : `${periodLabel} • ${rows.length} movement${rows.length !== 1 ? 's' : ''}`}</span>
            </div>
            <Divider type="vertical" style={{ height: 28 }} />
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined />}
                loading={movementsQuery.isFetching}
                onClick={() => movementsQuery.refetch()}
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
          <div className="sm-stat-card">
            <div className="sm-stat-icon blue"><SwapOutlined /></div>
            <div className="sm-stat-info">
              <div className="sm-stat-value">{totalMovements}</div>
              <div className="sm-stat-label">Total Movements</div>
            </div>
            <div className="sm-stat-trend up"><RiseOutlined /> +12%</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-icon green"><ArrowUpOutlined /></div>
            <div className="sm-stat-info">
              <div className="sm-stat-value">{stockInCount}</div>
              <div className="sm-stat-label">Stock In</div>
            </div>
            <div className="sm-stat-trend up"><RiseOutlined /> +8%</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-icon red"><ArrowDownOutlined /></div>
            <div className="sm-stat-info">
              <div className="sm-stat-value">{stockOutCount}</div>
              <div className="sm-stat-label">Stock Out</div>
            </div>
            <div className="sm-stat-trend down"><FallOutlined /> -3%</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-icon orange"><WarningOutlined /></div>
            <div className="sm-stat-info">
              <div className="sm-stat-value">{wasteCount}</div>
              <div className="sm-stat-label">Waste</div>
            </div>
            <div className="sm-stat-trend warning">Needs attention</div>
          </div>
          <div className="sm-stat-card">
            <div className="sm-stat-icon cyan"><SwapOutlined /></div>
            <div className="sm-stat-info">
              <div className="sm-stat-value">{returnCount}</div>
              <div className="sm-stat-label">Returns</div>
            </div>
            <div className="sm-stat-trend up"><RiseOutlined /> +5%</div>
          </div>
        </div>

        {/* ==================== MAIN CARD ==================== */}
        <Card className="sm-main-card" variant="borderless">
          <div className="sm-table-container">
              {/* Filters */}
            <div className={filtersClass}>
              <div className="sm-filter-group sm-search-group">
                <SearchOutlined />
                <Input
                  placeholder="Search by item, reference, user, or reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                  className="sm-search-input"
                />
              </div>
              <div className="sm-filter-group">
                <FilterOutlined />
                <Select
                  value={type}
                  style={{ width: 190 }}
                  onChange={setType}
                  className="sm-filter-select"
                  placeholder="Movement Type"
                >
                  <Option value="all">All Types</Option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <Option key={value} value={value}>{label}</Option>
                  ))}
                </Select>
              </div>

              {/* ⭐ Period indicator — Daily / Weekly / Monthly / All */}
              <div className="sm-filter-group">
                <CalendarOutlined />
                <Segmented
                  value={period}
                  onChange={(value) => setPeriod(value)}
                  options={[
                    { label: 'All',     value: 'all' },
                    { label: 'Daily',   value: 'daily' },
                    { label: 'Weekly',  value: 'weekly' },
                    { label: 'Monthly', value: 'monthly' },
                  ]}
                  className="sm-period-segmented"
                />
              </div>

              {/* ⭐ Reference date picker — only shown when a period is active */}
              {period !== 'all' && (
                <div className="sm-filter-group">
                  <DatePicker
                    value={referenceDate}
                    onChange={(value) => setReferenceDate(value || dayjs())}
                    picker={period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'date'}
                    allowClear={false}
                    className="sm-period-picker"
                  />
                </div>
              )}

              {/* ⭐ Active range chip + clear button */}
              {period !== 'all' && (
                <div className="sm-filter-group sm-period-chip">
                  <span className="sm-period-chip-label">
                    <CalendarOutlined /> {periodLabel}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={<ClearOutlined />}
                    onClick={() => { setPeriod('all'); setReferenceDate(dayjs()); }}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Table - Scrollable Body Only (No Pagination) */}
            <div className="sm-table-wrapper">
              <Spin spinning={movementsQuery.isLoading}>
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey="id"
                  className={tableClass}
                  pagination={false}
                  scroll={{ x: 1300, y: 'calc(100vh - 320px)' }}
                  locale={{
                    emptyText: (
                      <div className="sm-empty-state">
                        <SwapOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                          {movementsQuery.isError ? 'Unable to load movement data' : 'No inventory movements found'}
                        </p>
                        <p style={{ fontSize: 14, color: '#999' }}>
                          {movementsQuery.isError ? 'Please try refreshing the page' : 'Movements will appear here once recorded'}
                        </p>
                      </div>
                    )
                  }}
                />
              </Spin>
            </div>
          </div>
        </Card>

        {/* ==================== DETAILS MODAL ==================== */}
        <Modal
          title={
            <div className="sm-modal-header-clean">
              <div className="sm-modal-title-icon"><EyeOutlined /></div>
              <div className="sm-modal-title-text">Movement Details</div>
              <div className="sm-modal-badge">#{selected?.id}</div>
            </div>
          }
          open={detailsOpen}
          onCancel={() => setDetailsOpen(false)}
          width={760}
          className={modalClass}
          footer={
            <div className="sm-modal-footer-simple">
              <Button type="primary" onClick={() => setDetailsOpen(false)}>Close</Button>
            </div>
          }
          styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
          {selected && (
            <div className="sm-modal-clean-content">
              {/* Header */}
              <div className="sm-view-header">
                <div className="sm-view-icon">
                  <SwapOutlined style={{ fontSize: 28, color: '#1a7ab5' }} />
                </div>
                <div className="sm-view-header-info">
                  <div className="sm-view-name">{selected.item_name || selected.product_name}</div>
                  <div className="sm-view-meta">
                    <span className="sm-view-type" style={{ 
                      color: TYPE_COLORS[selected.movement_type]?.color, 
                      background: TYPE_COLORS[selected.movement_type]?.bg 
                    }}>
                      {TYPE_COLORS[selected.movement_type]?.icon} {TYPE_LABELS[selected.movement_type] || selected.movement_type}
                    </span>
                    <span className="sm-view-date">
                      <CalendarOutlined /> {dayjs(selected.movement_at || selected.created_at).format('MMM D, YYYY h:mm A')}
                    </span>
                  </div>
                </div>
              </div>

              <Divider className="sm-modal-divider" />

              {/* Stats Grid */}
              <div className="sm-view-grid">
                <div className="sm-view-section highlight">
                  <div className="sm-view-label">Quantity Change</div>
                  <div className="sm-view-value" style={{ 
                    color: Number(selected.quantity_change ?? selected.quantity ?? 0) > 0 ? '#10b981' : '#ef4444',
                    fontSize: 24,
                    fontWeight: 700
                  }}>
                    {Number(selected.quantity_change ?? selected.quantity ?? 0) > 0 ? '+' : ''}
                    {selected.quantity_change ?? selected.quantity} {selected.unit}
                  </div>
                </div>
                <div className="sm-view-section">
                  <div className="sm-view-label">Before</div>
                  <div className="sm-view-value">{selected.quantity_before ?? 0} {selected.unit}</div>
                </div>
                <div className="sm-view-section">
                  <div className="sm-view-label">After</div>
                  <div className="sm-view-value" style={{ color: '#10b981' }}>{selected.quantity_after ?? 0} {selected.unit}</div>
                </div>
                <div className="sm-view-section">
                  <div className="sm-view-label">Reference</div>
                  <div className="sm-view-value">{selected.reference || (selected.reference_id ? `${selected.reference_type || 'Ref'} #${selected.reference_id}` : '—')}</div>
                </div>
                <div className="sm-view-section">
                  <div className="sm-view-label">Updated By</div>
                  <div className="sm-view-value"><UserOutlined /> {selected.updated_by || 'System'}</div>
                </div>
                <div className="sm-view-section">
                  <div className="sm-view-label">Item Type</div>
                  <div className="sm-view-value">{selected.item_type || 'ingredient'}</div>
                </div>
              </div>

              {selected.reason && (
                <>
                  <Divider className="sm-modal-divider" />
                  <div className="sm-view-notes">
                    <div className="sm-view-label" style={{ marginBottom: 4 }}>Reason / Notes</div>
                    <div className="sm-view-value" style={{ fontWeight: 400 }}>{selected.reason}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const MovementsWithApp = () => <App><Movements /></App>;
export default MovementsWithApp;