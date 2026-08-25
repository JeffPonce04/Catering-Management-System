import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  LayoutDashboard, RefreshCw, Printer, Package, Boxes, AlertTriangle,
  CircleOff, CalendarClock, Wrench, ClipboardList, ArrowRightLeft,
  Users, UserCheck, UserMinus, Clock3, CalendarDays, FileClock,
  WalletCards, BadgeCheck, BookOpenCheck, ReceiptText, FileText,
  CalendarCheck2, CircleDollarSign, UserRound, Quote,
} from 'lucide-react';
import { useRoleDashboardData } from '../../../hooks/useRoleDashboardQueries';
import '../../dashboard/styles/Dashboard.css';

const PIE_COLORS = ['#4361ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];
const safeArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const formatNumber = (value) => toNumber(value).toLocaleString();
const formatCurrency = (value) => `₱${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const unwrapList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.data)) return value.data.data;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
};

const getStatus = (row) => String(
  row?.status || row?.booking_status || row?.approval_status || row?.payment_status || 'pending'
).toLowerCase();

const getPersonName = (row) => {
  const person = row?.employee?.person || row?.person || row?.customer?.person;
  return row?.employee_name || row?.customer_name || row?.name ||
    `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || '—';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const EmptyRows = ({ columns, message }) => (
  <tr><td colSpan={columns} className="dash-table-empty">{message}</td></tr>
);

const DashboardHeader = ({ title, subtitle, loading, refreshing, onRefresh }) => (
  <header className="dash-header dash-animate-header">
    <div className="dash-header-left">
      <div className="dash-header-brand">
        <LayoutDashboard className="dash-header-icon" />
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
    </div>
    <div className="dash-header-right">
      <div className="dash-status-badge">
        <span className="dash-status-dot" />
        {loading ? 'Loading' : refreshing ? 'Refreshing' : 'Live'}
      </div>
      <button className="dash-refresh-btn" onClick={onRefresh} aria-label="Refresh dashboard">
        <RefreshCw className={`dash-icon-sm ${refreshing ? 'dash-spin' : ''}`} />
      </button>
      <button className="dash-print-btn" onClick={() => window.print()} aria-label="Print dashboard">
        <Printer size={16} />
      </button>
    </div>
  </header>
);

const KpiGrid = ({ items, animate }) => (
  <div className="dash-kpi-grid">
    {items.map((item, index) => (
      <div
        key={item.label}
        className={`dash-kpi-card ${animate ? 'dash-animate-card' : ''}`}
        style={{ animationDelay: `${index * 0.04}s` }}
      >
        <div className="dash-kpi-left">
          <div className="dash-kpi-icon" style={{ backgroundColor: item.bgColor, color: item.color }}>
            <item.icon className="dash-icon-sm" />
          </div>
          <div className="dash-kpi-info">
            <span className="dash-kpi-label">{item.label}</span>
            <span className="dash-kpi-value">{item.value}</span>
            <div className="dash-kpi-footer">
              <span className="dash-kpi-change dash-kpi-neutral">{item.note || 'Backend record'}</span>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SimpleTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      {label && <p className="dash-tooltip-label">{label}</p>}
      {payload.map((item, index) => (
        <p key={`${item.name}-${index}`} className="dash-tooltip-value" style={{ color: item.color || item.fill }}>
          {item.name}: {toNumber(item.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const ChartCard = ({ icon: Icon, title, subtitle, children, delay = '0.15s' }) => (
  <div className="dash-chart-card dash-animate-slide-up" style={{ animationDelay: delay }}>
    <div className="dash-chart-header">
      <div className="dash-chart-title-group">
        <Icon className="dash-chart-icon" />
        <div>
          <h3 className="dash-chart-title">{title}</h3>
          <p className="dash-chart-subtitle">{subtitle}</p>
        </div>
      </div>
    </div>
    <div className="dash-chart-body dash-chart-small">{children}</div>
  </div>
);

const InventoryDashboard = ({ data, animate }) => {
  const inventory = data.inventory || {};
  const products = inventory.products || {};
  const equipment = inventory.equipment || {};
  const movements = unwrapList(data.movements);
  const requests = unwrapList(data.purchaseRequests);
  const reservations = unwrapList(data.reservations);
  const waste = unwrapList(data.waste);

  const kpis = [
    { label: 'Active Ingredients', value: formatNumber(products.total_items), icon: Package, bgColor: '#eef2ff', color: '#4361ee' },
    { label: 'Total Stock Quantity', value: formatNumber(products.total_quantity), icon: Boxes, bgColor: '#d1fae5', color: '#10b981' },
    { label: 'Low Stock Items', value: formatNumber(products.low_stock), icon: AlertTriangle, bgColor: '#fef3c7', color: '#d97706' },
    { label: 'Out of Stock', value: formatNumber(products.out_of_stock), icon: CircleOff, bgColor: '#fef2f2', color: '#ef4444' },
    { label: 'Expiring Soon', value: formatNumber(products.expiring_soon), icon: CalendarClock, bgColor: '#ede9fe', color: '#8b5cf6' },
    { label: 'Equipment Available', value: formatNumber(equipment.available), icon: Wrench, bgColor: '#e0f2fe', color: '#0ea5e9' },
    { label: 'Reserved Equipment', value: formatNumber(equipment.reserved), icon: ArrowRightLeft, bgColor: '#fce7f3', color: '#ec4899' },
    { label: 'Pending Purchase Requests', value: formatNumber(inventory.purchase_requests), icon: ClipboardList, bgColor: '#f3f4f6', color: '#6b7280' },
  ];

  const stockStatus = [
    { name: 'Healthy', value: Math.max(0, toNumber(products.total_items) - toNumber(products.low_stock) - toNumber(products.out_of_stock)) },
    { name: 'Low Stock', value: toNumber(products.low_stock) },
    { name: 'Out of Stock', value: toNumber(products.out_of_stock) },
    { name: 'Expiring', value: toNumber(products.expiring_soon) },
  ].filter((item) => item.value > 0);

  const equipmentStatus = [
    { status: 'Available', count: toNumber(equipment.available) },
    { status: 'Reserved', count: toNumber(equipment.reserved) },
    { status: 'In Use', count: toNumber(equipment.in_use) },
    { status: 'Damaged', count: toNumber(equipment.damaged) },
    { status: 'Missing', count: toNumber(equipment.missing) },
  ];

  return (
    <>
      <KpiGrid items={kpis} animate={animate} />
      <div className="dash-section">
        <div className="dash-charts-row-3">
          <ChartCard icon={Package} title="Inventory Status" subtitle="Current ingredient stock condition">
            {stockStatus.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stockStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                    {stockStatus.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<SimpleTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="dash-empty-state"><Package className="dash-icon-md" /><span>No inventory data</span></div>}
          </ChartCard>
          <ChartCard icon={Wrench} title="Equipment Availability" subtitle="Available, reserved and in-use equipment" delay="0.20s">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equipmentStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<SimpleTooltip />} />
                <Bar dataKey="count" name="Equipment" fill="#4361ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard icon={ArrowRightLeft} title="Operational Records" subtitle="Backend-connected inventory activity" delay="0.25s">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { label: 'Movements', count: movements.length },
                { label: 'Requests', count: requests.length },
                { label: 'Reservations', count: reservations.length },
                { label: 'Waste', count: waste.length },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<SimpleTooltip />} />
                <Bar dataKey="count" name="Records" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
      <div className="dash-section">
        <div className="dash-tables-row">
          <div className="dash-table-card dash-animate-slide-up">
            <div className="dash-table-header"><div className="dash-table-title-group"><ArrowRightLeft className="dash-table-icon" /><div><h3 className="dash-table-title">Recent Stock Movements</h3><p className="dash-table-subtitle">Latest ingredient and equipment activity</p></div></div><span className="dash-table-badge">{movements.length} records</span></div>
            <div className="dash-table-wrapper"><table className="dash-table"><thead><tr><th>Item</th><th>Type</th><th>Quantity</th><th>Date</th></tr></thead><tbody>
              {movements.length ? movements.slice(0, 6).map((row, index) => <tr key={row.movement_id || row.id || index}><td>{row.ingredient_name || row.equipment_name || row.item_name || row.name || 'Inventory item'}</td><td><span className={`dash-status-badge-table dash-status-${getStatus(row)}`}>{row.movement_type || row.type || row.status || 'Movement'}</span></td><td>{formatNumber(row.quantity_change ?? row.quantity ?? row.quantity_reserved)}</td><td>{formatDate(row.movement_at || row.created_at || row.updated_at)}</td></tr>) : <EmptyRows columns={4} message="No recent stock movements" />}
            </tbody></table></div>
          </div>
          <div className="dash-table-card dash-animate-slide-up" style={{ animationDelay: '0.08s' }}>
            <div className="dash-table-header"><div className="dash-table-title-group"><ClipboardList className="dash-table-icon" /><div><h3 className="dash-table-title">Purchase Requests</h3><p className="dash-table-subtitle">Requests prepared for Admin review</p></div></div><span className="dash-table-badge">{requests.length} records</span></div>
            <div className="dash-table-wrapper"><table className="dash-table"><thead><tr><th>Request</th><th>Supplier</th><th>Status</th><th>Date</th></tr></thead><tbody>
              {requests.length ? requests.slice(0, 6).map((row, index) => <tr key={row.purchase_request_id || row.id || index}><td>{row.request_no || row.reference_number || `PR-${row.purchase_request_id || index + 1}`}</td><td>{row.supplier?.name || row.supplier_name || '—'}</td><td><span className={`dash-status-badge-table dash-status-${getStatus(row)}`}>{row.status || 'Pending'}</span></td><td>{formatDate(row.request_date || row.created_at)}</td></tr>) : <EmptyRows columns={4} message="No purchase requests" />}
            </tbody></table></div>
          </div>
        </div>
      </div>
    </>
  );
};

const StaffDashboard = ({ data, animate }) => {
  const employees = data.employees || {};
  const attendance = data.attendanceSummary || {};
  const attendanceStats = data.attendanceStatistics || {};
  const schedules = data.scheduleStats || {};
  const payroll = data.payrollStats?.statistics || data.payrollStats || {};
  const leaveRequests = unwrapList(data.leaveRequests);
  const todayAttendance = unwrapList(data.attendanceToday);

  const kpis = [
    { label: 'Total Employees', value: formatNumber(employees.total), icon: Users, bgColor: '#eef2ff', color: '#4361ee' },
    { label: 'Active Employees', value: formatNumber(employees.active), icon: UserCheck, bgColor: '#d1fae5', color: '#10b981' },
    { label: 'Employees on Leave', value: formatNumber(employees.onleave), icon: UserMinus, bgColor: '#fef3c7', color: '#d97706' },
    { label: 'Present Today', value: formatNumber(attendance.present), icon: BadgeCheck, bgColor: '#dcfce7', color: '#22c55e' },
    { label: 'Late Today', value: formatNumber(attendance.late), icon: Clock3, bgColor: '#fef2f2', color: '#ef4444' },
    { label: 'Pending Attendance', value: formatNumber(attendance.pending_approval_count ?? attendance.pending), icon: FileClock, bgColor: '#ede9fe', color: '#8b5cf6' },
    { label: 'Pending Leave Requests', value: formatNumber(leaveRequests.length), icon: CalendarDays, bgColor: '#e0f2fe', color: '#0ea5e9' },
    { label: 'Payroll for Preparation', value: formatNumber(payroll.pending_count), icon: WalletCards, bgColor: '#f3f4f6', color: '#6b7280' },
  ];

  const attendanceChart = [
    { status: 'Approved', count: toNumber(attendanceStats.approved) },
    { status: 'Pending', count: toNumber(attendanceStats.pending) },
    { status: 'Rejected', count: toNumber(attendanceStats.rejected) },
  ];
  const scheduleChart = [
    { status: 'Scheduled', count: toNumber(schedules.scheduled) },
    { status: 'In Progress', count: toNumber(schedules.in_progress) },
    { status: 'Completed', count: toNumber(schedules.completed) },
    { status: 'Absent', count: toNumber(schedules.absent) },
    { status: 'Cancelled', count: toNumber(schedules.cancelled) },
  ];
  const employeeChart = [
    { name: 'Active', value: toNumber(employees.active) },
    { name: 'On Leave', value: toNumber(employees.onleave) },
    { name: 'Inactive', value: toNumber(employees.inactive) },
    { name: 'Terminated', value: toNumber(employees.terminated) },
  ].filter((item) => item.value > 0);

  return (
    <>
      <KpiGrid items={kpis} animate={animate} />
      <div className="dash-section"><div className="dash-charts-row-3">
        <ChartCard icon={UserRound} title="Employee Status" subtitle="Current workforce distribution">
          {employeeChart.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={employeeChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>{employeeChart.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip content={<SimpleTooltip />} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <div className="dash-empty-state"><Users className="dash-icon-md" /><span>No employee data</span></div>}
        </ChartCard>
        <ChartCard icon={BadgeCheck} title="Attendance Decisions" subtitle="Approved, pending and rejected records" delay="0.20s">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={attendanceChart}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="status" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<SimpleTooltip />} /><Bar dataKey="count" name="Attendance" fill="#4361ee" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard icon={CalendarDays} title="Work Schedule Status" subtitle="Live schedule records from the backend" delay="0.25s">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={scheduleChart}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="status" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<SimpleTooltip />} /><Bar dataKey="count" name="Schedules" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div></div>
      <div className="dash-section"><div className="dash-tables-row">
        <div className="dash-table-card dash-animate-slide-up"><div className="dash-table-header"><div className="dash-table-title-group"><CalendarDays className="dash-table-icon" /><div><h3 className="dash-table-title">Pending Leave Requests</h3><p className="dash-table-subtitle">Requests requiring staff-manager action</p></div></div><span className="dash-table-badge">{leaveRequests.length} pending</span></div><div className="dash-table-wrapper"><table className="dash-table"><thead><tr><th>Employee</th><th>Request</th><th>Period</th><th>Status</th></tr></thead><tbody>
          {leaveRequests.length ? leaveRequests.slice(0, 6).map((row, index) => <tr key={row.leave_request_id || row.id || index}><td>{getPersonName(row)}</td><td>{String(row.request_type || row.leave_type || 'Leave').replaceAll('_', ' ')}</td><td>{formatDate(row.start_date)} – {formatDate(row.end_date)}</td><td><span className={`dash-status-badge-table dash-status-${getStatus(row)}`}>{row.status || 'Pending'}</span></td></tr>) : <EmptyRows columns={4} message="No pending leave requests" />}
        </tbody></table></div></div>
        <div className="dash-table-card dash-animate-slide-up" style={{ animationDelay: '0.08s' }}><div className="dash-table-header"><div className="dash-table-title-group"><Clock3 className="dash-table-icon" /><div><h3 className="dash-table-title">Today's Attendance</h3><p className="dash-table-subtitle">Latest attendance records</p></div></div><span className="dash-table-badge">{todayAttendance.length} records</span></div><div className="dash-table-wrapper"><table className="dash-table"><thead><tr><th>Employee</th><th>Time In</th><th>Time Out</th><th>Status</th></tr></thead><tbody>
          {todayAttendance.length ? todayAttendance.slice(0, 6).map((row, index) => <tr key={row.attendance_id || row.id || index}><td>{getPersonName(row)}</td><td>{row.time_in ? new Date(row.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td>{row.time_out ? new Date(row.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td><span className={`dash-status-badge-table dash-status-${getStatus(row)}`}>{row.status || row.approval_status || 'Pending'}</span></td></tr>) : <EmptyRows columns={4} message="No attendance records today" />}
        </tbody></table></div></div>
      </div></div>
    </>
  );
};

const CashierDashboard = ({ data, animate }) => {
  const stats = data.bookingStats || {};
  const bookings = unwrapList(data.bookings);
  const quotations = unwrapList(data.quotations);
  const paymentPayload = data.payments || {};
  const payments = unwrapList(paymentPayload.data || paymentPayload);
  const paymentSummary = paymentPayload.summary || {};
  const invoices = unwrapList(data.invoices);
  const customerStats = data.customers || {};

  const pendingQuotations = quotations.filter((row) => ['pending', 'sent', 'draft'].includes(getStatus(row))).length;
  const pendingPayments = toNumber(paymentSummary.pending_count, payments.filter((row) => getStatus(row) === 'pending').length);
  const completedPayments = toNumber(paymentSummary.completed_count, payments.filter((row) => getStatus(row) === 'completed').length);
  const outstandingBalance = invoices.reduce((sum, row) => sum + toNumber(row.balance ?? row.balance_due ?? (toNumber(row.total_amount) - toNumber(row.paid_amount))), 0);

  const kpis = [
    { label: 'Total Booking Records', value: formatNumber(stats.total_bookings), icon: BookOpenCheck, bgColor: '#eef2ff', color: '#4361ee' },
    { label: 'Pending Booking Requests', value: formatNumber(stats.pending_approvals), icon: CalendarClock, bgColor: '#fef3c7', color: '#d97706' },
    { label: 'Confirmed Bookings', value: formatNumber(stats.confirmed_bookings), icon: CalendarCheck2, bgColor: '#d1fae5', color: '#10b981' },
    { label: 'Pending Quotations', value: formatNumber(pendingQuotations), icon: Quote, bgColor: '#ede9fe', color: '#8b5cf6' },
    { label: 'Payment Records', value: formatNumber(paymentSummary.total_count ?? payments.length), icon: WalletCards, bgColor: '#e0f2fe', color: '#0ea5e9' },
    { label: 'Pending Payments', value: formatNumber(pendingPayments), icon: FileClock, bgColor: '#fef2f2', color: '#ef4444' },
    { label: 'Outstanding Invoices', value: formatNumber(invoices.length), icon: ReceiptText, bgColor: '#fce7f3', color: '#ec4899' },
    { label: 'Registered Customers', value: formatNumber(customerStats.total_customers ?? customerStats.total), icon: UserRound, bgColor: '#f3f4f6', color: '#6b7280' },
  ];

  const bookingStatus = [
    { name: 'Pending', value: toNumber(stats.pending_approvals) },
    { name: 'Confirmed', value: toNumber(stats.confirmed_bookings) },
    { name: 'Completed', value: toNumber(stats.completed_bookings) },
  ].filter((item) => item.value > 0);
  const paymentStatus = [
    { status: 'Completed', count: completedPayments },
    { status: 'Pending', count: pendingPayments },
    { status: 'Failed', count: toNumber(paymentSummary.failed_count, payments.filter((row) => getStatus(row) === 'failed').length) },
  ];
  const workflowCounts = [
    { label: 'Bookings', count: bookings.length },
    { label: 'Quotations', count: quotations.length },
    { label: 'Payments', count: payments.length },
    { label: 'Invoices', count: invoices.length },
  ];

  return (
    <>
      <KpiGrid items={kpis} animate={animate} />
      <div className="dash-section"><div className="dash-charts-row-3">
        <ChartCard icon={BookOpenCheck} title="Booking Status" subtitle="Operational booking records only">
          {bookingStatus.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={bookingStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>{bookingStatus.map((entry, index) => <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip content={<SimpleTooltip />} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer> : <div className="dash-empty-state"><BookOpenCheck className="dash-icon-md" /><span>No booking data</span></div>}
        </ChartCard>
        <ChartCard icon={WalletCards} title="Payment Status" subtitle="Payment-processing records, not sales analytics" delay="0.20s">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={paymentStatus}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="status" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<SimpleTooltip />} /><Bar dataKey="count" name="Payments" fill="#4361ee" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard icon={ClipboardList} title="Cashier Work Queue" subtitle="Records currently available for processing" delay="0.25s">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={workflowCounts}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip content={<SimpleTooltip />} /><Bar dataKey="count" name="Records" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div></div>
      <div className="dash-section"><div className="dash-tables-row">
        <div className="dash-table-card dash-animate-slide-up"><div className="dash-table-header"><div className="dash-table-title-group"><BookOpenCheck className="dash-table-icon" /><div><h3 className="dash-table-title">Recent Booking Requests</h3><p className="dash-table-subtitle">Customer bookings for cashier processing</p></div></div><span className="dash-table-badge">{bookings.length} records</span></div><div className="dash-table-wrapper"><table className="dash-table"><thead><tr><th>Booking</th><th>Customer</th><th>Event Date</th><th>Status</th></tr></thead><tbody>
          {bookings.length ? bookings.slice(0, 6).map((row, index) => <tr key={row.booking_id || row.id || index}><td>{row.booking_no || row.reference_number || `Booking ${index + 1}`}</td><td>{row.customer_name || row.service_event?.customer_name || getPersonName(row)}</td><td>{formatDate(row.event_date || row.service_event?.event_date || row.created_at)}</td><td><span className={`dash-status-badge-table dash-status-${getStatus(row)}`}>{row.booking_status || row.status || 'Pending'}</span></td></tr>) : <EmptyRows columns={4} message="No recent booking requests" />}
        </tbody></table></div></div>
        <div className="dash-table-card dash-animate-slide-up" style={{ animationDelay: '0.08s' }}><div className="dash-table-header"><div className="dash-table-title-group"><ReceiptText className="dash-table-icon" /><div><h3 className="dash-table-title">Outstanding Invoices</h3><p className="dash-table-subtitle">Balances requiring payment follow-up</p></div></div><span className="dash-table-badge">{formatCurrency(outstandingBalance)}</span></div><div className="dash-table-wrapper"><table className="dash-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Balance</th><th>Status</th></tr></thead><tbody>
          {invoices.length ? invoices.slice(0, 6).map((row, index) => { const balance = row.balance ?? row.balance_due ?? (toNumber(row.total_amount) - toNumber(row.paid_amount)); return <tr key={row.invoice_id || row.id || index}><td>{row.invoice_number || row.invoice_no || `INV-${index + 1}`}</td><td>{row.customer_name || getPersonName(row)}</td><td className="dash-table-amount">{formatCurrency(balance)}</td><td><span className={`dash-status-badge-table dash-status-${getStatus(row)}`}>{row.status || 'Pending'}</span></td></tr>; }) : <EmptyRows columns={4} message="No outstanding invoices" />}
        </tbody></table></div></div>
      </div></div>
    </>
  );
};

export default function RoleFocusedDashboard({ role }) {
  const [animate, setAnimate] = useState(false);
  const { data = {}, isLoading, isFetching, error, refetch } = useRoleDashboardData(role);

  useEffect(() => setAnimate(true), []);

  const metadata = useMemo(() => {
    if (role === 'inventory') return { title: 'Inventory Dashboard', subtitle: 'Real-time stock, equipment and purchase-request operations' };
    if (role === 'staff') return { title: 'People & Staff Dashboard', subtitle: 'Employee, attendance, scheduling and payroll-preparation overview' };
    return { title: 'Cashier Dashboard', subtitle: 'Booking, quotation, invoice and payment-processing overview' };
  }, [role]);

  return (
    <div className="dash-container">
      <div className="dash-inner">
        <DashboardHeader
          {...metadata}
          loading={isLoading}
          refreshing={isFetching && !isLoading}
          onRefresh={() => refetch()}
        />
        {(error?.message || data.warning) && <div className="dash-alert">{error?.message || data.warning}</div>}
        {role === 'inventory' && <InventoryDashboard data={data} animate={animate} />}
        {role === 'staff' && <StaffDashboard data={data} animate={animate} />}
        {role === 'cashier' && <CashierDashboard data={data} animate={animate} />}
      </div>
    </div>
  );
}
