// Dashboard.jsx - Enhanced Professional Dashboard with Real Backend Data
import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  ComposedChart, Line,
} from 'recharts';
import {
  LayoutDashboard, Calendar, Users, DollarSign,
  ShoppingBag, CheckCircle,
  Package, TrendingUp, Truck,
  CreditCard, ArrowUp, ArrowDown, RefreshCw,
  PieChart as PieChartIcon,
  Zap, Award, Target, BarChart3, Activity,
  TrendingDown, CircleDollarSign,
  Clock, FileText, ChartBar, Crown, Utensils, User,
  Sparkles, Rocket, Flame, Star, AlertCircle,
  Wallet, ClipboardList, CalendarCheck, CalendarX, Printer
} from 'lucide-react';
import { useDashboardData, EMPTY_DASHBOARD_DATA } from '../../../hooks/useDashboardQueries';
import { useAuth } from '../../../contexts/AuthContext';
import {
  ADMIN_ROLES, CASHIER_ROLES, INVENTORY_MANAGER_ROLES, STAFF_MANAGER_ROLES, hasAllowedRole,
} from '../../../utils/roleRoutes';
import RoleFocusedDashboard from './RoleFocusedDashboard';
import '../../dashboard/styles/Dashboard.css';

const COLORS = ['#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', '#f8961e', '#f9c74f', '#90be6d'];
const PIE_COLORS = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e', '#1e293b', '#6b7280'];

const GRADIENTS = {
  blue: ['#4361ee', '#3a0ca3'],
  green: ['#10b981', '#059669'],
  purple: ['#8b5cf6', '#6d28d9'],
  orange: ['#f59e0b', '#d97706'],
  red: ['#ef4444', '#dc2626'],
  teal: ['#14b8a6', '#0d9488'],
  indigo: ['#6366f1', '#4f46e5'],
  gray: ['#64748b', '#475569'],
  pink: ['#ec4899', '#be185d'],
  amber: ['#f59e0b', '#b45309']
};

const safeArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const formatNumber = (value) => toNumber(value).toLocaleString();
const formatCurrency = (value) => `₱${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const formatPercent = (value) => `${toNumber(value).toFixed(1)}%`;

const calculateChange = (current, previous) => {
  const curr = toNumber(current);
  const prev = toNumber(previous);
  if (prev === 0) return curr > 0 ? '+100%' : '0%';
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};

const formatCompact = (value) => {
  const num = toNumber(value);
  if (num >= 1000000) return `₱${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `₱${(num / 1000).toFixed(1)}K`;
  return formatCurrency(num);
};

const EmptyState = ({ message = 'No data available' }) => (
  <div className="dash-empty-state">
    <Package className="dash-icon-md" />
    <span>{message}</span>
  </div>
);

function AdminDashboard() {
  const [animate, setAnimate] = useState(false);

  const {
    data: dashboardData = EMPTY_DASHBOARD_DATA,
    isLoading,
    isFetching,
    error: dashboardError,
    refetch,
  } = useDashboardData('month');

  const loading = isLoading;
  const refreshing = isFetching && !isLoading;
  const error = dashboardError?.message || dashboardData.warning || '';
  
  // EXTRACT REAL DATA FROM BACKEND RESPONSES
  const stats = dashboardData.stats || {};
  const charts = dashboardData.charts || {};
  const inventoryReport = dashboardData.inventoryReport || {};
  const inventoryDashboard = dashboardData.inventoryDashboard || {};
  const financial = dashboardData.financial || {};
  const payroll = dashboardData.payroll || {};
  const events = dashboardData.events || {};
  const reports = dashboardData.reports || {};

  useEffect(() => {
    setAnimate(true);
  }, []);

  // ============================================================
  // KPI DATA - All from REAL Backend Data
  // ============================================================
  const kpiData = useMemo(() => {
    // Get real data from backend responses
    const salesSummary = reports.sales?.summary || stats || {};
    const financialSummary = financial.summary || {};
    
    // Monthly revenue from real data
    const monthlyData = safeArray(financial.monthly || reports.financial?.monthly || []);
    const currentMonthRevenue = monthlyData.length > 0 ? toNumber(monthlyData[monthlyData.length - 1]?.revenue) : toNumber(stats.total_revenue || 0);
    const previousMonthRevenue = monthlyData.length > 1 ? toNumber(monthlyData[monthlyData.length - 2]?.revenue) : null;
    const revenueChange = previousMonthRevenue === null ? `${toNumber(stats.revenue_growth).toFixed(1)}%` : calculateChange(currentMonthRevenue, previousMonthRevenue);
    
    // Real booking trends
    const bookingTrends = safeArray(events.trends || reports.events?.trends || []);
    const currentBookings = bookingTrends.length > 0 ? toNumber(bookingTrends[bookingTrends.length - 1]?.bookings || 0) : toNumber(stats.total_bookings || 0);
    const previousBookings = bookingTrends.length > 1 ? toNumber(bookingTrends[bookingTrends.length - 2]?.bookings || 0) : null;
    const bookingChange = previousBookings === null ? `${toNumber(stats.booking_growth).toFixed(1)}%` : calculateChange(currentBookings, previousBookings);
    
    // Real financial metrics from backend
    const totalSales = toNumber(salesSummary.total_sales || stats.total_revenue || 0);
    const totalRevenue = toNumber(financial.total_revenue || stats.total_revenue || 0);
    const totalExpenses = toNumber(financial.total_expenses || salesSummary.total_expenses || 0);
    const totalProfit = toNumber(financial.total_profit || (totalRevenue - totalExpenses) || 0);
    const outstandingBalance = toNumber(stats.outstanding_balance || financialSummary.outstanding_balance || 0);
    const totalBookings = toNumber(events.total_bookings || stats.total_bookings || 0);
    const completedEvents = toNumber(events.completed_events || stats.completed_events || 0);
    const activeStaff = toNumber(payroll.active_staff || stats.active_staff || 0);
    
    const completionRate = totalBookings > 0 ? (completedEvents / totalBookings) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return [
      {
        label: 'Total Sales',
        value: formatCurrency(totalSales),
        icon: ShoppingBag,
        bgColor: '#eef2ff',
        color: '#4361ee',
        change: revenueChange,
        changeType: toNumber(revenueChange.replace(/[%+]/g, '')) >= 0 ? 'positive' : 'negative'
      },
      {
        label: 'Total Revenue',
        value: formatCurrency(totalRevenue),
        icon: DollarSign,
        bgColor: '#d1fae5',
        color: '#10b981',
        change: revenueChange,
        changeType: toNumber(revenueChange.replace(/[%+]/g, '')) >= 0 ? 'positive' : 'negative'
      },
      {
        label: 'Total Expenses',
        value: formatCurrency(totalExpenses),
        icon: TrendingDown,
        bgColor: '#fef2f2',
        color: '#ef4444',
        change: 'N/A',
        changeType: 'neutral'
      },
      {
        label: 'Total Profit',
        value: formatCurrency(totalProfit),
        icon: CircleDollarSign,
        bgColor: '#ede9fe',
        color: '#8b5cf6',
        change: 'N/A',
        changeType: 'neutral'
      },
      {
        label: 'Outstanding Balance',
        value: formatCurrency(outstandingBalance),
        icon: CreditCard,
        bgColor: '#fef3c7',
        color: '#f59e0b',
        change: 'N/A',
        changeType: 'neutral'
      },
      {
        label: 'Total Bookings',
        value: formatNumber(totalBookings),
        icon: Calendar,
        bgColor: '#e0f2fe',
        color: '#0ea5e9',
        change: bookingChange,
        changeType: toNumber(bookingChange.replace(/[%+]/g, '')) >= 0 ? 'positive' : 'negative'
      },
      {
        label: 'Completed Events',
        value: formatNumber(completedEvents),
        icon: CheckCircle,
        bgColor: '#dcfce7',
        color: '#22c55e',
        change: 'N/A',
        changeType: 'neutral'
      },
      {
        label: 'Active Staff',
        value: formatNumber(activeStaff),
        icon: Users,
        bgColor: '#f3f4f6',
        color: '#6b7280',
        change: 'N/A',
        changeType: 'neutral'
      },
    ];
  }, [stats, financial, events, payroll, reports]);

  // ============================================================
  // CHART DATA - All from REAL Backend Data
  // ============================================================
  
  const revenueExpenseData = useMemo(() => {
    // Try to get from financial monthly data first
    const monthly = safeArray(financial.monthly || reports.financial?.monthly || []);
    if (monthly.length > 0) {
      return monthly.slice(-12).map((item) => ({
        month: item.month || item.period || 'N/A',
        revenue: toNumber(item.revenue || 0),
        expenses: toNumber(item.expenses || 0),
        profit: toNumber(item.profit || 0),
      }));
    }
    // Fallback to sales daily data
    const revenueData = safeArray(charts.revenue_data || reports.sales?.daily || []);
    return revenueData.slice(-12).map((item) => ({
      month: item.period || item.date || 'N/A',
      revenue: toNumber(item.revenue || 0),
      expenses: item.expenses == null ? null : toNumber(item.expenses),
      profit: item.profit == null ? null : toNumber(item.profit),
    }));
  }, [financial.monthly, reports.financial, charts.revenue_data, reports.sales]);

  const bookingTrendData = useMemo(() => {
    const trends = safeArray(events.trends || reports.events?.trends || []);
    if (trends.length > 0) {
      return trends.slice(-12).map((item) => ({
        month: item.period || item.month || 'N/A',
        completed: toNumber(item.completed || item.confirmed || item.bookings || item.events || 0),
        cancelled: toNumber(item.cancelled || 0),
      }));
    }
    return [];
  }, [events.trends, reports.events]);

  const stockMovementData = useMemo(() => {
    const data = safeArray(inventoryReport.movements || inventoryDashboard.movements || []);
    if (data.length > 0) {
      return data.slice(-12).map((item) => ({
        period: item.period || item.date || 'N/A',
        incoming: toNumber(item.incoming || item.stock_in || 0),
        outgoing: toNumber(item.outgoing || item.stock_out || 0),
        wastage: toNumber(item.wastage || 0),
      }));
    }
    return [];
  }, [inventoryReport.movements, inventoryDashboard.movements]);

  const revenueByEventData = useMemo(() => {
    const data = safeArray(events.event_types || reports.events?.event_types || []);
    if (data.length > 0) {
      return data.map((item, index) => ({
        name: item.name || item.type || 'Unknown',
        value: toNumber(item.value || item.revenue || 0),
        color: PIE_COLORS[index % PIE_COLORS.length],
      })).filter(item => item.value > 0);
    }
    return [];
  }, [events.event_types, reports.events]);

  const monthlyExpenseData = useMemo(() => {
    const monthly = safeArray(financial.monthly || reports.financial?.monthly || []);
    if (monthly.length > 0) {
      return monthly.slice(-12).map((item) => ({
        month: item.month || item.period || 'N/A',
        expenses: toNumber(item.expenses || 0),
        profit: toNumber(item.profit || 0),
      }));
    }
    return [];
  }, [financial.monthly, reports.financial]);

  const inventoryDistributionData = useMemo(() => {
    const data = safeArray(charts.inventory_distribution || inventoryDashboard.distribution || []);
    if (data.length > 0) {
      return data.map((item, index) => ({
        name: item.name || 'Uncategorized',
        value: toNumber(item.value || item.stock || item.current_quantity || 0),
        color: COLORS[index % COLORS.length],
      })).filter((item) => item.value > 0);
    }
    // Use real inventory dashboard stats
    const products = inventoryDashboard.products || {};
    const totalQty = toNumber(products.total_quantity || 0);
    const reservedQty = toNumber(products.reserved || 0);
    if (totalQty > 0) {
      return [
        { name: 'In Stock', value: totalQty, color: COLORS[0] },
        { name: 'Reserved', value: reservedQty, color: COLORS[1] },
        { name: 'Available', value: Math.max(0, totalQty - reservedQty), color: COLORS[2] },
      ].filter(item => item.value > 0);
    }
    return [];
  }, [charts.inventory_distribution, inventoryDashboard.distribution, inventoryDashboard]);

  const weeklyPerformanceData = useMemo(() => {
    const data = safeArray(charts.revenue_data || reports.sales?.weekly || []);
    if (data.length > 0) {
      return data.slice(-8).map((item) => ({
        period: item.period || item.date || 'N/A',
        revenue: toNumber(item.revenue || 0),
        orders: toNumber(item.orders || 0),
      }));
    }
    // Fallback to revenue expense data
    return revenueExpenseData.slice(-8).map((item) => ({
      period: item.month,
      revenue: item.revenue,
      orders: toNumber(item.orders || 0),
    }));
  }, [charts.revenue_data, reports.sales, revenueExpenseData]);

  const menuPerformanceData = useMemo(() => {
    const data = safeArray(inventoryReport.menu_performance || reports.inventory?.menu_performance || []);
    if (data.length > 0) {
      return data.slice(0, 8).map((item) => ({
        name: item.name || 'Unnamed Item',
        popularity: toNumber(item.popularity || item.used_quantity || 0),
        revenue: toNumber(item.revenue || 0),
      }));
    }
    return [];
  }, [inventoryReport.menu_performance, reports.inventory]);

  const eventTypeData = useMemo(() => {
    const data = safeArray(events.event_types || reports.events?.event_types || []);
    if (data.length > 0) {
      return data.slice(0, 6).map((item, index) => ({
        name: item.name || item.type || 'Unknown',
        value: toNumber(item.value || item.count || item.bookings || 0),
        color: COLORS[index % COLORS.length],
      })).filter((item) => item.value > 0);
    }
    return [];
  }, [events.event_types, reports.events]);

  // ============================================================
  // TABLE DATA - All from REAL Backend Data
  // ============================================================

  const upcomingEvents = useMemo(() => {
    const eventsData = safeArray(events.upcoming_events_data || reports.events?.upcoming_events || []);
    return eventsData.length > 0 ? eventsData : [];
  }, [events, reports]);

  const outstandingInvoices = useMemo(() => {
    const invoices = safeArray(reports.financial?.outstanding || financial.outstanding || []);
    return invoices.length > 0 ? invoices : [];
  }, [reports, financial]);

  const eventProfitability = useMemo(() => {
    const data = safeArray(events.profitability || reports.events?.profitability || []);
    return data.length > 0 ? data : [];
  }, [events, reports]);

  const topPackages = useMemo(() => {
    const data = safeArray(reports.sales?.top_packages || stats.top_packages || []);
    return data.length > 0 ? data : [];
  }, [reports, stats]);

  const topMenuItems = useMemo(() => {
    const data = safeArray(inventoryReport.menu_performance || reports.inventory?.menu_performance || []);
    return data.slice(0, 5);
  }, [inventoryReport, reports]);

  const payrollByEmployee = useMemo(() => {
    const data = safeArray(reports.payroll?.summary || payroll.summary || []);
    return data.length > 0 ? data : [];
  }, [reports, payroll]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="dash-tooltip">
          <p className="dash-tooltip-label">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="dash-tooltip-value" style={{ color: p.color || p.fill }}>
              {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dash-container">
      <div className="dash-inner">
        {/* ===== HEADER ===== */}
        <header className={`dash-header ${animate ? 'dash-animate-header' : ''}`}>
          <div className="dash-header-left">
            <div className="dash-header-brand">
              <LayoutDashboard className="dash-header-icon" />
              <div>
                <h1>Dashboard Overview</h1>
                <p>Real-time business performance metrics</p>
              </div>
            </div>
          </div>
          <div className="dash-header-right">
            <div className="dash-status-badge">
              <span className="dash-status-dot"></span>
              {loading ? 'Loading' : refreshing ? 'Refreshing' : 'Live'}
            </div>
            <button className="dash-refresh-btn" onClick={() => refetch()}>
              <RefreshCw className={`dash-icon-sm ${isFetching ? 'dash-spin' : ''}`} />
            </button>
            <button className="dash-print-btn">
              <Printer size={16} />
            </button>
          </div>
        </header>

        {error && <div className="dash-alert">{error}</div>}

        {/* ===== 8 INSIGHT CARDS ===== */}
        <div className="dash-kpi-grid">
          {kpiData.map((item, idx) => (
            <div 
              key={item.label} 
              className={`dash-kpi-card ${animate ? 'dash-animate-card' : ''}`} 
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div className="dash-kpi-left">
                <div 
                  className="dash-kpi-icon" 
                  style={{ 
                    backgroundColor: item.bgColor,
                    color: item.color
                  }}
                >
                  <item.icon className="dash-icon-sm" />
                </div>
                <div className="dash-kpi-info">
                  <span className="dash-kpi-label">{item.label}</span>
                  <span className="dash-kpi-value">{item.value}</span>
                  <div className="dash-kpi-footer">
                    <span className={`dash-kpi-change dash-kpi-${item.changeType}`}>
                      {item.changeType === 'positive' && <ArrowUp className="dash-icon-xs" />}
                      {item.changeType === 'negative' && <ArrowDown className="dash-icon-xs" />}
                      {item.change}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== REVENUE CHART ===== */}
        <div className="dash-section">
          <div className="dash-chart-card-wide">
            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.10s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <TrendingUp className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Revenue vs Expenses</h3>
                    <p className="dash-chart-subtitle">Monthly trend analysis</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-medium">
                {revenueExpenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueExpenseData}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4361ee" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4361ee" stopOpacity={0.02}/>
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                        </linearGradient>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#4361ee" strokeWidth={2.5} fill="url(#revenueGrad)" name="Revenue" />
                      <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#expenseGrad)" name="Expenses" />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitGrad)" name="Profit" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No revenue data available" />}
              </div>
            </div>
          </div>
        </div>

        {/* ===== TABLES SECTION ===== */}
        <div className="dash-section">
          <div className="dash-tables-row">
            <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.20s' }}>
              <div className="dash-table-header">
                <div className="dash-table-title-group">
                  <Clock className="dash-table-icon" />
                  <div>
                    <h3 className="dash-table-title">Upcoming Events</h3>
                    <p className="dash-table-subtitle">Scheduled events this month</p>
                  </div>
                </div>
                <span className="dash-table-badge">{upcomingEvents.length} events</span>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Venue</th>
                      <th>Guests</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEvents.length > 0 ? (
                      upcomingEvents.slice(0, 4).map((event, index) => (
                        <tr key={event.id || event.booking_id || `upcoming-${index}`}>
                          <td className="dash-table-event">{event.event || event.name || 'Event'}</td>
                          <td>{event.date || event.event_date}</td>
                          <td>{event.venue}</td>
                          <td>{event.guests || event.guests_count}</td>
                          <td>
                            <span className={`dash-status-badge-table dash-status-${(event.status || 'pending').toLowerCase()}`}>
                              {event.status || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="dash-table-empty">No upcoming events</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.25s' }}>
              <div className="dash-table-header">
                <div className="dash-table-title-group">
                  <FileText className="dash-table-icon" />
                  <div>
                    <h3 className="dash-table-title">Outstanding Invoices</h3>
                    <p className="dash-table-subtitle">Unpaid and overdue invoices</p>
                  </div>
                </div>
                <span className="dash-table-badge dash-table-badge-warning">{outstandingInvoices.length} outstanding</span>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingInvoices.length > 0 ? (
                      outstandingInvoices.slice(0, 4).map((invoice, index) => (
                        <tr key={invoice.id || invoice.invoice_id || `invoice-${index}`}>
                          <td className="dash-table-invoice">{invoice.invoice_number || invoice.invoice_no}</td>
                          <td>{invoice.customer_name || invoice.customer}</td>
                          <td className="dash-table-amount">{formatCurrency(invoice.total_amount || invoice.amount || 0)}</td>
                          <td>{invoice.due_date}</td>
                          <td>
                            <span className={`dash-status-badge-table dash-status-${(invoice.status || 'unpaid').toLowerCase().replace(' ', '-')}`}>
                              {invoice.status || 'Unpaid'}
                              {invoice.days_overdue > 0 && ` (${invoice.days_overdue}d)`}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="dash-table-empty">No outstanding invoices</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ===== PERFORMANCE METRICS CHARTS ===== */}
        <div className="dash-section">
          <div className="dash-charts-row-3">
            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.30s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <Calendar className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Booking Trend</h3>
                    <p className="dash-chart-subtitle">Completed vs Cancelled</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-small">
                {bookingTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bookingTrendData}>
                      <defs>
                        <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02}/>
                        </linearGradient>
                        <linearGradient id="cancelledGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '6px' }} />
                      <Area type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} fill="url(#completedGrad)" name="Completed" />
                      <Area type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} fill="url(#cancelledGrad)" name="Cancelled" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No booking data" />}
              </div>
            </div>

            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.35s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <Truck className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Stock Movement</h3>
                    <p className="dash-chart-subtitle">Incoming / Outgoing / Wastage</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-small">
                {stockMovementData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockMovementData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', paddingBottom: '4px' }} />
                      <Bar dataKey="incoming" fill="#3b82f6" name="Incoming" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="outgoing" fill="#f59e0b" name="Outgoing" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="wastage" fill="#ef4444" name="Wastage" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No stock data" />}
              </div>
            </div>

            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.40s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <BarChart3 className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Weekly Performance</h3>
                    <p className="dash-chart-subtitle">Revenue & Orders</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-small">
                {weeklyPerformanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weeklyPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', paddingBottom: '4px' }} />
                      <Bar yAxisId="left" dataKey="orders" fill="#f59e0b" name="Orders" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#4361ee" strokeWidth={2} name="Revenue" dot={{ r: 3, fill: '#4361ee' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No performance data" />}
              </div>
            </div>
          </div>
        </div>

        {/* ===== TOP PERFORMERS TABLES ===== */}
        <div className="dash-section">
          <div className="dash-tables-row">
            <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.45s' }}>
              <div className="dash-table-header">
                <div className="dash-table-title-group">
                  <ChartBar className="dash-table-icon" />
                  <div>
                    <h3 className="dash-table-title">Event Profitability</h3>
                    <p className="dash-table-subtitle">Revenue, cost and profit analysis</p>
                  </div>
                </div>
                <span className="dash-table-badge dash-table-badge-success">Profit</span>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Revenue</th>
                      <th>Cost</th>
                      <th>Profit</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventProfitability.length > 0 ? (
                      eventProfitability.map((item, index) => (
                        <tr key={item.id || item.event_id || `profit-${index}`}>
                          <td className="dash-table-event">{item.event || item.name || 'Event'}</td>
                          <td className="dash-table-amount">{formatCurrency(item.revenue)}</td>
                          <td className="dash-table-amount">{formatCurrency(item.cost)}</td>
                          <td className={`dash-table-amount ${item.profit > 0 ? 'dash-text-positive' : 'dash-text-negative'}`}>
                            {formatCurrency(item.profit)}
                          </td>
                          <td>
                            <span className={`dash-margin-badge ${item.margin >= 35 ? 'dash-margin-high' : item.margin >= 25 ? 'dash-margin-medium' : 'dash-margin-low'}`}>
                              {item.margin}%
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="dash-table-empty">No profitability data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.50s' }}>
              <div className="dash-table-header">
                <div className="dash-table-title-group">
                  <Crown className="dash-table-icon" />
                  <div>
                    <h3 className="dash-table-title">Top-Selling Packages</h3>
                    <p className="dash-table-subtitle">Most popular packages by revenue</p>
                  </div>
                </div>
                <span className="dash-table-badge dash-table-badge-gold">Top</span>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Package Name</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Avg. Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPackages.length > 0 ? (
                      topPackages.map((pkg, index) => (
                        <tr key={pkg.id || pkg.package_id || `package-${index}`}>
                          <td className="dash-table-package">{pkg.name}</td>
                          <td>{pkg.orders || pkg.count || 0}</td>
                          <td className="dash-table-amount">{formatCurrency(pkg.revenue || pkg.total || 0)}</td>
                          <td className="dash-table-amount">{formatCurrency((pkg.revenue || 0) / Math.max(1, pkg.orders || 1))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="4" className="dash-table-empty">No package data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ===== DISTRIBUTION CHARTS ===== */}
        <div className="dash-section">
          <div className="dash-charts-row-3">
            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.55s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <Target className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Revenue by Event</h3>
                    <p className="dash-chart-subtitle">Revenue distribution</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-pie-small">
                {revenueByEventData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revenueByEventData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2} dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        fontSize={9}
                      >
                        {revenueByEventData.map((entry, index) => (
                          <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No revenue data" />}
              </div>
            </div>

            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.60s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <Package className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Inventory Distribution</h3>
                    <p className="dash-chart-subtitle">Stock breakdown</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-pie-small">
                {inventoryDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={inventoryDistributionData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        fontSize={9}
                      >
                        {inventoryDistributionData.map((entry, index) => (
                          <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No inventory data" />}
              </div>
            </div>

            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.65s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <PieChartIcon className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Event Type Summary</h3>
                    <p className="dash-chart-subtitle">Distribution by type</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-pie-small">
                {eventTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={eventTypeData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        fontSize={9}
                      >
                        {eventTypeData.map((entry, index) => (
                          <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No event type data" />}
              </div>
            </div>
          </div>
        </div>

        {/* ===== OPERATIONS DETAILS TABLES ===== */}
        <div className="dash-section">
          <div className="dash-tables-row">
            <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.70s' }}>
              <div className="dash-table-header">
                <div className="dash-table-title-group">
                  <Utensils className="dash-table-icon" />
                  <div>
                    <h3 className="dash-table-title">Top-Selling Menu</h3>
                    <p className="dash-table-subtitle">Most popular menu items</p>
                  </div>
                </div>
                <span className="dash-table-badge dash-table-badge-gold">Popular</span>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Menu Item</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Popularity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMenuItems.length > 0 ? (
                      topMenuItems.map((item, index) => (
                        <tr key={item.id || item.menu_item_id || `menu-${index}`}>
                          <td className="dash-table-menu">{item.name}</td>
                          <td>{item.orders || item.popularity || 0}</td>
                          <td className="dash-table-amount">{formatCurrency(item.revenue || 0)}</td>
                          <td>
                            <div className="dash-popularity-bar">
                              <div 
                                className="dash-popularity-fill" 
                                style={{ width: `${Math.min((item.orders || item.popularity || 0) / Math.max(...topMenuItems.map(i => i.orders || i.popularity || 1)) * 100, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="4" className="dash-table-empty">No menu data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`dash-table-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.75s' }}>
              <div className="dash-table-header">
                <div className="dash-table-title-group">
                  <User className="dash-table-icon" />
                  <div>
                    <h3 className="dash-table-title">Payroll by Employee</h3>
                    <p className="dash-table-subtitle">Current payroll summary</p>
                  </div>
                </div>
                <span className="dash-table-badge dash-table-badge-blue">Payroll</span>
              </div>
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Position</th>
                      <th>Gross</th>
                      <th>Deductions</th>
                      <th>Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollByEmployee.length > 0 ? (
                      payrollByEmployee.map((item, index) => (
                        <tr key={item.id || item.employee_id || `payroll-${index}`}>
                          <td className="dash-table-employee">{item.employee_name || item.name}</td>
                          <td>{item.position}</td>
                          <td className="dash-table-amount">{formatCurrency(item.gross_pay || item.gross || 0)}</td>
                          <td className="dash-table-amount dash-text-negative">{formatCurrency(item.deductions || 0)}</td>
                          <td className="dash-table-amount dash-text-positive">{formatCurrency(item.net_pay || item.net || 0)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="dash-table-empty">No payroll data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ===== TRENDING CHARTS ===== */}
        <div className="dash-section">
          <div className="dash-charts-row-2">
            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.80s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <Activity className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Expenses vs Profit</h3>
                    <p className="dash-chart-subtitle">Monthly expense & profit trends</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-small">
                {monthlyExpenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyExpenseData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', paddingBottom: '6px' }} />
                      <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" fill="#22c55e" name="Profit" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No expense data" />}
              </div>
            </div>

            <div className={`dash-chart-card ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.85s' }}>
              <div className="dash-chart-header">
                <div className="dash-chart-title-group">
                  <Award className="dash-chart-icon" />
                  <div>
                    <h3 className="dash-chart-title">Menu Performance</h3>
                    <p className="dash-chart-subtitle">Popularity ranking</p>
                  </div>
                </div>
              </div>
              <div className="dash-chart-body dash-chart-small">
                {menuPerformanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={menuPerformanceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={80} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="popularity" fill="#8b5cf6" name="Popularity" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No menu data" />}
              </div>
            </div>
          </div>
        </div>

        {/* ===== QUICK INSIGHTS ===== */}
        <div className={`dash-insights ${animate ? 'dash-animate-slide-up' : ''}`} style={{ animationDelay: '0.90s' }}>
          <div className="dash-insight dash-insight-glow">
            <Zap className="dash-insight-icon" />
            <div>
              <span className="dash-insight-label">Fastest Moving</span>
              <strong>{menuPerformanceData.length > 0 ? menuPerformanceData[0].name : 'N/A'}</strong>
            </div>
          </div>
          <div className="dash-insight dash-insight-glow">
            <Award className="dash-insight-icon" />
            <div>
              <span className="dash-insight-label">Top Event Type</span>
              <strong>{eventTypeData.length > 0 ? eventTypeData[0].name : 'N/A'}</strong>
            </div>
          </div>
          <div className="dash-insight dash-insight-glow">
            <Target className="dash-insight-icon" />
            <div>
              <span className="dash-insight-label">Highest Revenue</span>
              <strong>{revenueByEventData.length > 0 ? revenueByEventData[0].name : 'N/A'}</strong>
            </div>
          </div>
          <div className="dash-insight dash-insight-glow">
            <Users className="dash-insight-icon" />
            <div>
              <span className="dash-insight-label">Active Staff</span>
              <strong>{formatNumber(payroll.active_staff || stats.active_staff || 0)}</strong>
            </div>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <footer className={`dash-footer ${animate ? 'dash-animate-footer' : ''}`}>
          <span>© 2026 Dashboard · Real-time business insights</span>
          <span className="dash-footer-status">
            <span className="dash-status-dot"></span>
            {isFetching ? 'Refreshing' : 'Operational'}
          </span>
        </footer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (hasAllowedRole(user, ADMIN_ROLES)) return <AdminDashboard />;
  if (hasAllowedRole(user, INVENTORY_MANAGER_ROLES)) return <RoleFocusedDashboard role="inventory" />;
  if (hasAllowedRole(user, STAFF_MANAGER_ROLES)) return <RoleFocusedDashboard role="staff" />;
  if (hasAllowedRole(user, CASHIER_ROLES)) return <RoleFocusedDashboard role="cashier" />;

  return <AdminDashboard />;
}
