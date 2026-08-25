// src/features/reports/pages/ReportsAnalyticsPage.jsx - COMPLETE PREMIUM VERSION

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Menu,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Card,
  Divider,
  Badge,
  theme as antdTheme,
  ConfigProvider,
} from 'antd';
import {
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  CalculatorOutlined,
  CalendarOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloudDownloadOutlined,
  DatabaseOutlined,
  DollarOutlined,
  DownOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FilterOutlined,
  FundOutlined,
  InboxOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
  ExportOutlined,
  SendOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  PieChartOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { useReportsData } from '../../../hooks/useReportQueries';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserRoles } from '../../../utils/roleRoutes';
import '../../reports/styles/Reports.css';

const { RangePicker } = DatePicker;
const { Text, Paragraph } = Typography;

// ============================================================
// CONSTANTS
// ============================================================
const ADMIN_ROLES = new Set([
  'admin',
  'administrator',
  'super_admin',
  'superadmin',
  'owner',
  'manager',
]);

const ACCESS = {
  sales: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'sales', 'cashier', 'finance', 'accountant'],
  events: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'operations', 'operations_staff', 'coordinator', 'staff', 'employee', 'user'],
  kitchen: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'kitchen', 'chef', 'operations', 'operations_staff', 'kitchen_staff', 'staff', 'employee', 'user'],
  inventory: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'inventory', 'warehouse', 'kitchen', 'operations', 'operations_staff', 'inventory_staff', 'staff', 'employee', 'user'],
  purchasing: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'purchasing', 'purchasing_staff', 'procurement', 'inventory', 'inventory_staff', 'finance', 'accountant', 'accounting'],
  financial: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'accountant', 'accounting'],
  customers: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'sales', 'sales_staff', 'customer_service'],
  menu: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'kitchen', 'chef', 'kitchen_staff', 'sales', 'sales_staff', 'staff', 'employee', 'user'],
  labor: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'hr', 'human_resources', 'hr_staff', 'payroll', 'staff', 'employee', 'user'],
  logistics: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'logistics', 'operations', 'operations_staff', 'logistics_staff', 'driver', 'staff', 'employee', 'user'],
  waste: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager', 'kitchen', 'chef', 'inventory', 'warehouse', 'kitchen_staff', 'inventory_staff', 'staff', 'employee', 'user'],
  management: ['admin', 'administrator', 'super_admin', 'superadmin', 'owner', 'manager'],
};

const report = (key, label, fields) => ({ key, label, fields });

export const REPORT_CATEGORIES = [
  {
    key: 'sales', label: 'Sales Reports', icon: DollarOutlined, color: '#4F46E5', gradient: 'linear-gradient(135deg, #4F46E5, #4338CA)',
    reports: [
      report('daily-sales', 'Daily Sales', ['period', 'orders', 'total_sales', 'collected', 'outstanding']),
      report('weekly-sales', 'Weekly Sales', ['period', 'orders', 'total_sales', 'collected', 'outstanding']),
      report('monthly-sales', 'Monthly Sales', ['period', 'orders', 'total_sales', 'collected', 'outstanding']),
      report('annual-sales', 'Annual Sales', ['year', 'orders', 'total_sales', 'collected', 'outstanding']),
      report('sales-by-customer', 'Sales by Customer', ['customer', 'bookings', 'revenue', 'paid_amount', 'outstanding']),
      report('sales-by-event-type', 'Sales by Event Type', ['event', 'bookings', 'revenue', 'average_value']),
      report('sales-by-venue', 'Sales by Venue', ['venue', 'events', 'revenue', 'average_value']),
      report('sales-by-salesperson', 'Sales by Salesperson', ['salesperson', 'bookings', 'revenue', 'average_value']),
      report('sales-by-branch', 'Sales by Branch', ['branch', 'bookings', 'revenue', 'average_value']),
      report('booking-summary', 'Booking Summary', ['reference', 'event', 'customer', 'event_date', 'venue', 'guest_count', 'revenue', 'status']),
      report('quotation-report', 'Quotation Report', ['quotation_no', 'reference', 'customer', 'event', 'event_date', 'quotation_total', 'status']),
      report('quotation-conversion', 'Quotation Conversion Report', ['period', 'quotations', 'converted', 'conversion_rate']),
      report('deposit-collection', 'Deposit Collection Report', ['reference', 'customer', 'event', 'event_date', 'deposit_amount', 'paid_amount', 'balance', 'status']),
      report('outstanding-customer-payments', 'Outstanding Customer Payments', ['invoice_number', 'customer', 'total_amount', 'paid_amount', 'balance', 'due_date', 'status']),
      report('cancelled-events-sales', 'Cancelled Events Report', ['reference', 'customer', 'event', 'event_date', 'venue', 'revenue', 'cancellation_reason', 'status']),
      report('revenue-by-menu-package', 'Revenue by Menu Package', ['package', 'orders', 'revenue', 'average_value']),
    ],
  },
  {
    key: 'events', label: 'Event Reports', icon: CalendarOutlined, color: '#7C3AED', gradient: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
    reports: [
      report('event-schedule', 'Event Schedule', ['reference', 'event_date', 'event', 'customer', 'venue', 'guest_count', 'status']),
      report('upcoming-events', 'Upcoming Events', ['reference', 'event_date', 'event', 'customer', 'venue', 'guest_count', 'status']),
      report('completed-events', 'Completed Events', ['reference', 'event_date', 'event', 'customer', 'venue', 'guest_count', 'revenue', 'status']),
      report('cancelled-events', 'Cancelled Events', ['reference', 'event_date', 'event', 'customer', 'venue', 'cancellation_reason', 'status']),
      report('guest-count-summary', 'Guest Count Summary', ['event', 'events', 'guest_count', 'average_guests']),
      report('event-revenue-analysis', 'Event Revenue Analysis', ['reference', 'event', 'customer', 'event_date', 'revenue', 'status']),
      report('event-cost-analysis', 'Event Cost Analysis', ['reference', 'event', 'customer', 'event_date', 'cost', 'cost_per_guest', 'status']),
      report('event-profitability', 'Event Profitability', ['reference', 'event', 'customer', 'revenue', 'cost', 'profit', 'margin', 'status']),
    ],
  },
  {
    key: 'kitchen', label: 'Kitchen & Production', icon: ShopOutlined, color: '#D97706', gradient: 'linear-gradient(135deg, #D97706, #B45309)',
    reports: [
      report('kitchen-production-sheet', 'Kitchen Production Sheet', ['event_date', 'reference', 'event', 'package', 'guest_count', 'production_status']),
      report('daily-production-report', 'Daily Production Report', ['event_date', 'events', 'guest_count', 'items_required', 'production_status']),
      report('production-schedule', 'Production Schedule', ['event_date', 'reference', 'event', 'package', 'guest_count', 'production_status']),
      report('ingredient-requirements', 'Ingredient Requirements', ['ingredient', 'quantity', 'unit', 'current_quantity', 'shortage', 'status']),
      report('kitchen-recipe-cost-analysis', 'Recipe Cost Analysis', ['menu_item', 'quantity', 'cost', 'revenue', 'profit', 'margin']),
      report('menu-production-summary', 'Menu Production Summary', ['package', 'orders', 'quantity', 'revenue']),
    ],
  },
  {
    key: 'inventory', label: 'Inventory Reports', icon: InboxOutlined, color: '#059669', gradient: 'linear-gradient(135deg, #059669, #047857)',
    reports: [
      report('current-inventory', 'Current Inventory', ['ingredient', 'current_quantity', 'unit', 'minimum_quantity', 'reorder_point', 'unit_cost', 'stock_value', 'status']),
      report('stock-movement', 'Stock Movement', ['period', 'incoming', 'outgoing', 'wastage', 'net_movement']),
      report('inventory-consumption', 'Inventory Consumption', ['ingredient', 'used_quantity', 'unit', 'current_quantity', 'status']),
      report('inventory-valuation', 'Inventory Valuation', ['ingredient', 'current_quantity', 'unit', 'unit_cost', 'stock_value', 'status']),
      report('low-stock', 'Low Stock', ['ingredient', 'current_quantity', 'unit', 'minimum_quantity', 'reorder_point', 'shortage', 'status']),
      report('expiring-items', 'Expiring Items', ['ingredient', 'batch_no', 'expiry_date', 'current_quantity', 'unit', 'days_remaining', 'status']),
      report('stock-adjustments', 'Stock Adjustments', ['period', 'ingredient', 'movement_type', 'quantity', 'reason', 'status']),
      report('physical-inventory-variance', 'Physical Inventory Variance', ['ingredient', 'system_quantity', 'physical_quantity', 'variance', 'unit', 'variance_cost', 'status']),
    ],
  },
  {
    key: 'purchasing', label: 'Purchasing Reports', icon: ShoppingCartOutlined, color: '#DB2777', gradient: 'linear-gradient(135deg, #DB2777, #BE185D)',
    reports: [
      report('purchase-orders', 'Purchase Orders', ['purchase_order_no', 'supplier', 'order_date', 'expected_date', 'total_amount', 'status']),
      report('supplier-purchases', 'Supplier Purchases', ['supplier', 'orders', 'quantity', 'total_amount', 'average_value']),
      report('purchase-history', 'Purchase History', ['period', 'supplier', 'purchase_order_no', 'quantity', 'total_amount', 'status']),
      report('outstanding-purchase-orders', 'Outstanding Purchase Orders', ['purchase_order_no', 'supplier', 'order_date', 'expected_date', 'balance', 'days_overdue', 'status']),
      report('goods-received', 'Goods Received', ['receipt_no', 'purchase_order_no', 'supplier', 'received_date', 'quantity', 'total_amount', 'status']),
      report('supplier-performance', 'Supplier Performance', ['supplier', 'orders', 'on_time_rate', 'quality_rate', 'total_amount', 'status']),
    ],
  },
  {
    key: 'financial', label: 'Financial Reports', icon: BankOutlined, color: '#DC2626', gradient: 'linear-gradient(135deg, #DC2626, #B91C1C)',
    reports: [
      report('profit-and-loss', 'Profit & Loss Statement', ['period', 'revenue', 'expenses', 'profit', 'margin']),
      report('revenue-report', 'Revenue Report', ['period', 'revenue', 'collected', 'outstanding', 'invoice_count']),
      report('expense-report', 'Expense Report', ['period', 'expenses', 'expense_ratio']),
      report('gross-profit-report', 'Gross Profit Report', ['period', 'revenue', 'cost', 'gross_profit', 'margin']),
      report('net-profit-report', 'Net Profit Report', ['period', 'revenue', 'expenses', 'profit', 'margin']),
      report('cash-flow-statement', 'Cash Flow Statement', ['period', 'cash_in', 'cash_out', 'net_cash_flow', 'closing_balance']),
      report('accounts-receivable-aging', 'Accounts Receivable Aging', ['invoice_number', 'customer', 'total_amount', 'paid_amount', 'balance', 'due_date', 'aging_bucket', 'status']),
      report('accounts-payable-aging', 'Accounts Payable Aging', ['reference', 'supplier', 'total_amount', 'paid_amount', 'balance', 'due_date', 'aging_bucket', 'status']),
      report('tax-summary', 'Tax Summary', ['period', 'taxable_sales', 'tax_amount', 'withholding_tax', 'net_tax_due', 'status']),
    ],
  },
  {
    key: 'customers', label: 'Customer Reports', icon: TeamOutlined, color: '#0891B2', gradient: 'linear-gradient(135deg, #0891B2, #0E7490)',
    reports: [
      report('customer-list', 'Customer List', ['customer', 'email', 'phone', 'customer_type', 'bookings', 'revenue', 'status']),
      report('customer-booking-history', 'Customer Booking History', ['customer', 'reference', 'event', 'event_date', 'venue', 'revenue', 'status']),
      report('customer-revenue-analysis', 'Customer Revenue Analysis', ['customer', 'bookings', 'revenue', 'average_value', 'last_booking_date']),
      report('repeat-customers', 'Repeat Customers', ['customer', 'bookings', 'revenue', 'average_value', 'last_booking_date', 'status']),
      report('customer-payment-history', 'Customer Payment History', ['customer', 'invoice_number', 'total_amount', 'paid_amount', 'balance', 'due_date', 'status']),
      report('customer-preferences', 'Customer Preferences', ['customer', 'preferred_event', 'preferred_package', 'dietary_preferences', 'notes', 'status']),
    ],
  },
  {
    key: 'menu', label: 'Menu Reports', icon: BookOutlined, color: '#7C3AED', gradient: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
    reports: [
      report('best-selling-menu-packages', 'Best Selling Menu Packages', ['package', 'orders', 'quantity', 'revenue', 'rank']),
      report('least-selling-menu-packages', 'Least Selling Menu Packages', ['package', 'orders', 'quantity', 'revenue', 'rank']),
      report('menu-profitability', 'Menu Profitability', ['menu_item', 'quantity', 'revenue', 'cost', 'profit', 'margin']),
      report('menu-recipe-cost-analysis', 'Recipe Cost Analysis', ['menu_item', 'cost', 'revenue', 'profit', 'margin']),
      report('food-cost-percentage', 'Food Cost Percentage', ['menu_item', 'revenue', 'cost', 'food_cost_percentage', 'status']),
    ],
  },
  {
    key: 'labor', label: 'Labor Reports', icon: UserOutlined, color: '#EA580C', gradient: 'linear-gradient(135deg, #EA580C, #C2410C)',
    reports: [
      report('staff-attendance', 'Staff Attendance', ['employee', 'department', 'days_present', 'days_absent', 'late_count', 'attendance_rate', 'status']),
      report('staff-schedule', 'Staff Schedule', ['employee', 'department', 'shift_date', 'shift', 'start_time', 'end_time', 'status']),
      report('labor-cost-by-event', 'Labor Cost by Event', ['reference', 'event', 'event_date', 'staff_count', 'labor_hours', 'labor_cost', 'status']),
      report('overtime-report', 'Overtime Report', ['employee', 'department', 'overtime_hours', 'overtime_cost', 'period', 'status']),
      report('staff-productivity', 'Staff Productivity', ['employee', 'department', 'events_assigned', 'labor_hours', 'productivity_rate', 'status']),
    ],
  },
  {
    key: 'logistics', label: 'Logistics Reports', icon: CarOutlined, color: '#0D9488', gradient: 'linear-gradient(135deg, #0D9488, #0F766E)',
    reports: [
      report('delivery-schedule', 'Delivery Schedule', ['delivery_date', 'reference', 'event', 'customer', 'venue', 'vehicle', 'driver', 'status']),
      report('vehicle-assignment', 'Vehicle Assignment', ['delivery_date', 'vehicle', 'driver', 'reference', 'venue', 'status']),
      report('equipment-delivery', 'Equipment Delivery', ['delivery_date', 'reference', 'event', 'equipment', 'quantity', 'venue', 'status']),
      report('equipment-return', 'Equipment Return', ['return_date', 'reference', 'event', 'equipment', 'quantity', 'returned_quantity', 'return_status']),
      report('equipment-damage', 'Equipment Damage', ['reported_date', 'reference', 'event', 'equipment', 'damaged_quantity', 'damage_cost', 'notes', 'status']),
    ],
  },
  {
    key: 'waste', label: 'Waste Reports', icon: WarningOutlined, color: '#DC2626', gradient: 'linear-gradient(135deg, #DC2626, #B91C1C)',
    reports: [
      report('food-waste', 'Food Waste', ['period', 'ingredient', 'quantity', 'unit', 'waste_reason', 'waste_cost', 'status']),
      report('inventory-waste', 'Inventory Waste', ['period', 'ingredient', 'quantity', 'unit', 'waste_cost', 'status']),
      report('spoilage-report', 'Spoilage Report', ['period', 'ingredient', 'quantity', 'unit', 'expiry_date', 'waste_cost', 'status']),
      report('waste-cost-analysis', 'Waste Cost Analysis', ['period', 'wastage', 'waste_cost', 'waste_rate', 'status']),
    ],
  },
  {
    key: 'management', label: 'Management Reports', icon: AuditOutlined, color: '#4F46E5', gradient: 'linear-gradient(135deg, #4F46E5, #4338CA)',
    reports: [
      report('daily-operations', 'Daily Operations', ['period', 'events', 'orders', 'revenue', 'expenses', 'profit', 'status']),
      report('weekly-operations', 'Weekly Operations', ['period', 'events', 'orders', 'revenue', 'expenses', 'profit', 'status']),
      report('monthly-operations', 'Monthly Operations', ['period', 'events', 'orders', 'revenue', 'expenses', 'profit', 'margin']),
      report('annual-operations', 'Annual Operations', ['year', 'events', 'orders', 'revenue', 'expenses', 'profit', 'margin']),
      report('branch-performance', 'Branch Performance', ['branch', 'events', 'orders', 'revenue', 'expenses', 'profit', 'margin']),
      report('department-performance', 'Department Performance', ['department', 'employees', 'events_assigned', 'cost', 'productivity_rate', 'status']),
    ],
  },
];

export const getReportConfig = (categorySlug, reportSlug) => {
  const category = REPORT_CATEGORIES.find((item) => item.key === categorySlug);
  return category?.reports.find((item) => item.key === reportSlug) || null;
};

export const getReportTitle = (categorySlug, reportSlug) => (
  getReportConfig(categorySlug, reportSlug)?.label || 'Report'
);

const COLUMN_META = {
  period: { label: 'Period', width: 130 }, year: { label: 'Year', width: 90, type: 'number' },
  reference: { label: 'Reference No.', width: 145, type: 'reference' }, invoice_number: { label: 'Invoice No.', width: 145, type: 'reference' },
  quotation_no: { label: 'Quotation No.', width: 145, type: 'reference' }, purchase_order_no: { label: 'PO No.', width: 140, type: 'reference' },
  receipt_no: { label: 'Receipt No.', width: 140, type: 'reference' }, customer: { label: 'Customer', width: 210 },
  event: { label: 'Event Type', width: 170 }, package: { label: 'Menu Package', width: 190 }, menu_item: { label: 'Menu Item', width: 190 },
  ingredient: { label: 'Ingredient', width: 190 }, employee: { label: 'Employee', width: 190 }, supplier: { label: 'Supplier', width: 180 },
  venue: { label: 'Venue', width: 180 }, branch: { label: 'Branch', width: 150 }, salesperson: { label: 'Salesperson', width: 180 },
  department: { label: 'Department', width: 170 }, email: { label: 'Email', width: 220 }, phone: { label: 'Phone', width: 135 },
  customer_type: { label: 'Customer Type', width: 130 }, preferred_event: { label: 'Preferred Event', width: 160 },
  preferred_package: { label: 'Preferred Package', width: 190 }, dietary_preferences: { label: 'Dietary Preferences', width: 220 },
  notes: { label: 'Notes', width: 240 }, reason: { label: 'Reason', width: 200 }, cancellation_reason: { label: 'Cancellation Reason', width: 220 },
  waste_reason: { label: 'Waste Reason', width: 190 }, production_status: { label: 'Production Status', width: 150, type: 'status' },
  return_status: { label: 'Return Status', width: 145, type: 'status' }, status: { label: 'Status', width: 125, type: 'status' },
  movement_type: { label: 'Movement Type', width: 145 }, batch_no: { label: 'Batch No.', width: 130 }, equipment: { label: 'Equipment', width: 180 },
  vehicle: { label: 'Vehicle', width: 160 }, driver: { label: 'Driver', width: 170 }, shift: { label: 'Shift', width: 130 },
  start_time: { label: 'Start Time', width: 110 }, end_time: { label: 'End Time', width: 110 }, unit: { label: 'Unit', width: 90 },
  aging_bucket: { label: 'Aging Bucket', width: 130 }, event_date: { label: 'Event Date', width: 125, type: 'date' },
  order_date: { label: 'Order Date', width: 125, type: 'date' }, expected_date: { label: 'Expected Date', width: 125, type: 'date' },
  received_date: { label: 'Received Date', width: 125, type: 'date' }, due_date: { label: 'Due Date', width: 125, type: 'date' },
  expiry_date: { label: 'Expiry Date', width: 125, type: 'date' }, shift_date: { label: 'Shift Date', width: 125, type: 'date' },
  delivery_date: { label: 'Delivery Date', width: 125, type: 'date' }, return_date: { label: 'Return Date', width: 125, type: 'date' },
  reported_date: { label: 'Reported Date', width: 125, type: 'date' }, last_booking_date: { label: 'Last Booking', width: 125, type: 'date' },
  orders: { label: 'Orders', width: 95, type: 'number', total: true }, bookings: { label: 'Bookings', width: 100, type: 'number', total: true },
  events: { label: 'Events', width: 90, type: 'number', total: true }, guest_count: { label: 'Guests', width: 95, type: 'number', total: true },
  average_guests: { label: 'Avg. Guests', width: 110, type: 'number' }, items_required: { label: 'Items Required', width: 120, type: 'number', total: true },
  quantity: { label: 'Quantity', width: 105, type: 'number', total: true }, current_quantity: { label: 'Current Qty.', width: 115, type: 'number', total: true },
  minimum_quantity: { label: 'Minimum Qty.', width: 115, type: 'number' }, reorder_point: { label: 'Reorder Point', width: 115, type: 'number' },
  used_quantity: { label: 'Used Qty.', width: 110, type: 'number', total: true }, shortage: { label: 'Shortage', width: 105, type: 'number', total: true },
  incoming: { label: 'Stock In', width: 105, type: 'number', total: true }, outgoing: { label: 'Stock Out', width: 105, type: 'number', total: true },
  wastage: { label: 'Wastage', width: 105, type: 'number', total: true }, net_movement: { label: 'Net Movement', width: 120, type: 'number', total: true },
  system_quantity: { label: 'System Qty.', width: 110, type: 'number', total: true }, physical_quantity: { label: 'Physical Qty.', width: 115, type: 'number', total: true },
  variance: { label: 'Variance', width: 100, type: 'number', total: true }, quotations: { label: 'Quotations', width: 105, type: 'number', total: true },
  converted: { label: 'Converted', width: 100, type: 'number', total: true }, invoice_count: { label: 'Invoices', width: 95, type: 'number', total: true },
  staff_count: { label: 'Staff', width: 85, type: 'number', total: true }, labor_hours: { label: 'Labor Hours', width: 110, type: 'number', total: true },
  overtime_hours: { label: 'OT Hours', width: 100, type: 'number', total: true }, days_present: { label: 'Present', width: 90, type: 'number', total: true },
  days_absent: { label: 'Absent', width: 90, type: 'number', total: true }, late_count: { label: 'Late', width: 80, type: 'number', total: true },
  events_assigned: { label: 'Events Assigned', width: 125, type: 'number', total: true }, employees: { label: 'Employees', width: 105, type: 'number', total: true },
  returned_quantity: { label: 'Returned Qty.', width: 115, type: 'number', total: true }, damaged_quantity: { label: 'Damaged Qty.', width: 115, type: 'number', total: true },
  days_remaining: { label: 'Days Remaining', width: 120, type: 'number' }, days_overdue: { label: 'Days Overdue', width: 115, type: 'number' },
  rank: { label: 'Rank', width: 75, type: 'number' },
  total_sales: { label: 'Gross Sales', width: 135, type: 'currency', total: true }, collected: { label: 'Collected', width: 130, type: 'currency', total: true },
  revenue: { label: 'Revenue', width: 130, type: 'currency', total: true }, outstanding: { label: 'Outstanding', width: 130, type: 'currency', total: true },
  paid_amount: { label: 'Paid Amount', width: 130, type: 'currency', total: true }, total_amount: { label: 'Total Amount', width: 135, type: 'currency', total: true },
  balance: { label: 'Balance', width: 125, type: 'currency', total: true }, average_value: { label: 'Average Value', width: 130, type: 'currency' },
  quotation_total: { label: 'Quotation Total', width: 140, type: 'currency', total: true }, deposit_amount: { label: 'Required Deposit', width: 140, type: 'currency', total: true },
  cost: { label: 'Cost', width: 120, type: 'currency', total: true }, profit: { label: 'Profit', width: 120, type: 'currency', total: true },
  expenses: { label: 'Expenses', width: 125, type: 'currency', total: true }, gross_profit: { label: 'Gross Profit', width: 130, type: 'currency', total: true },
  cash_in: { label: 'Cash In', width: 120, type: 'currency', total: true }, cash_out: { label: 'Cash Out', width: 120, type: 'currency', total: true },
  net_cash_flow: { label: 'Net Cash Flow', width: 135, type: 'currency', total: true }, closing_balance: { label: 'Closing Balance', width: 140, type: 'currency', total: true },
  taxable_sales: { label: 'Taxable Sales', width: 135, type: 'currency', total: true }, tax_amount: { label: 'Tax Amount', width: 125, type: 'currency', total: true },
  withholding_tax: { label: 'Withholding Tax', width: 135, type: 'currency', total: true }, net_tax_due: { label: 'Net Tax Due', width: 125, type: 'currency', total: true },
  unit_cost: { label: 'Unit Cost', width: 115, type: 'currency' }, stock_value: { label: 'Stock Value', width: 125, type: 'currency', total: true },
  variance_cost: { label: 'Variance Cost', width: 130, type: 'currency', total: true }, labor_cost: { label: 'Labor Cost', width: 125, type: 'currency', total: true },
  overtime_cost: { label: 'OT Cost', width: 115, type: 'currency', total: true }, damage_cost: { label: 'Damage Cost', width: 125, type: 'currency', total: true },
  waste_cost: { label: 'Waste Cost', width: 120, type: 'currency', total: true }, cost_per_guest: { label: 'Cost / Guest', width: 125, type: 'currency' },
  margin: { label: 'Margin', width: 100, type: 'percent' }, conversion_rate: { label: 'Conversion Rate', width: 130, type: 'percent' },
  expense_ratio: { label: 'Expense Ratio', width: 120, type: 'percent' }, food_cost_percentage: { label: 'Food Cost %', width: 115, type: 'percent' },
  attendance_rate: { label: 'Attendance Rate', width: 130, type: 'percent' }, productivity_rate: { label: 'Productivity Rate', width: 135, type: 'percent' },
  on_time_rate: { label: 'On-time Rate', width: 115, type: 'percent' }, quality_rate: { label: 'Quality Rate', width: 110, type: 'percent' },
  waste_rate: { label: 'Waste Rate', width: 105, type: 'percent' },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const personName = (person) => {
  if (!person) return '';
  if (typeof person === 'string') return person;
  const value = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ').trim();
  return value || person.full_name || person.name || '';
};

const displayName = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return personName(value.person) || value.name || value.title || value.label || '';
};

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(safeNumber(value));

const formatNumber = (value) => new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 2,
}).format(safeNumber(value));

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('MMM D, YYYY') : String(value);
};

const humanize = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const statusColor = (status) => {
  const value = String(status || '').toLowerCase();
  if (['completed', 'paid', 'active', 'available', 'healthy', 'received', 'returned', 'confirmed', 'approved', 'on_time'].some((word) => value.includes(word))) return 'success';
  if (['pending', 'partial', 'low', 'warning', 'scheduled', 'in_progress', 'ongoing', 'due'].some((word) => value.includes(word))) return 'warning';
  if (['cancelled', 'failed', 'overdue', 'out_of_stock', 'damaged', 'expired', 'critical', 'inactive'].some((word) => value.includes(word))) return 'error';
  return 'processing';
};

const groupRows = (rows, field, options = {}) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = row[field] || options.fallback || 'Unspecified';
    const current = grouped.get(label) || { [field]: label, records: 0 };
    current.records += 1;
    (options.sum || []).forEach((metric) => {
      current[metric] = safeNumber(current[metric]) + safeNumber(row[metric]);
    });
    if (row.event_date && (!current.last_booking_date || dayjs(row.event_date).isAfter(dayjs(current.last_booking_date)))) {
      current.last_booking_date = row.event_date;
    }
    grouped.set(label, current);
  });
  return Array.from(grouped.values());
};

// ============================================================
// NORMALIZE FUNCTIONS
// ============================================================
const normalizeEvents = (reports) => {
  const profitability = asArray(reports?.events?.profitability);
  const profitMap = new Map();
  profitability.forEach((row) => {
    const key = String(firstValue(row.event_id, row.reference, row.event_name, ''));
    if (key) profitMap.set(key, row);
  });

  const rawEvents = asArray(reports?.events?.events);
  const normalized = rawEvents.map((item, index) => {
    const booking = item.booking || item.bookings?.[0] || {};
    const customer = item.customer || booking.customer || {};
    const invoice = booking.invoice || item.invoice || {};
    const quotation = booking.quotation || item.quotation || {};
    const eventId = firstValue(item.service_event_id, item.event_id, booking.service_event_id, index + 1);
    const profitRow = profitMap.get(String(eventId)) || profitability.find((row) => row.event_name === displayName(item.event_type || item.eventType));
    const revenue = safeNumber(firstValue(profitRow?.revenue, invoice.total_amount, quotation.total_amount, booking.total_amount, item.total_amount));
    const cost = safeNumber(firstValue(profitRow?.cost, booking.total_cost, item.total_cost));
    const guestCount = safeNumber(firstValue(item.guest_count, item.number_of_guests, item.pax_count, booking.guest_count));
    return {
      key: `event-${eventId}-${index}`,
      raw: item,
      event_id: eventId,
      reference: firstValue(booking.booking_no, item.event_code, item.reference_no, `EVT-${eventId}`),
      event: displayName(item.event_type || item.eventType) || firstValue(item.event_name, booking.event_type, 'Unspecified Event'),
      customer: personName(customer.person) || displayName(customer) || firstValue(item.customer_name, booking.customer_name, 'Unknown Customer'),
      event_date: firstValue(item.event_date, item.start_date, booking.event_date),
      venue: firstValue(item.venue_name, item.venue, item.location, booking.venue, 'Unspecified'),
      branch: displayName(item.branch || booking.branch) || firstValue(item.branch_name, booking.branch_name, 'Main Branch'),
      salesperson: personName(booking.salesperson?.person) || displayName(booking.salesperson) || firstValue(item.salesperson_name, booking.salesperson_name, 'Unassigned'),
      supplier: displayName(item.supplier || booking.supplier),
      guest_count: guestCount,
      revenue,
      cost,
      profit: safeNumber(firstValue(profitRow?.profit, revenue - cost)),
      margin: safeNumber(firstValue(profitRow?.margin, revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0)),
      cost_per_guest: guestCount > 0 ? cost / guestCount : 0,
      status: firstValue(booking.booking_status, item.status, 'pending'),
      cancellation_reason: firstValue(booking.cancellation_reason, item.cancellation_reason, item.notes, ''),
      quotation_no: firstValue(quotation.quotation_number, quotation.quotation_no, booking.quotation_no, ''),
      quotation_total: safeNumber(firstValue(quotation.total_amount, booking.quotation_total)),
      deposit_amount: safeNumber(firstValue(booking.required_deposit, booking.deposit_amount, quotation.deposit_amount)),
      paid_amount: safeNumber(firstValue(invoice.paid_amount, booking.paid_amount, booking.deposit_paid)),
      balance: safeNumber(firstValue(invoice.balance, invoice.total_amount !== undefined ? safeNumber(invoice.total_amount) - safeNumber(invoice.paid_amount) : undefined, revenue - safeNumber(booking.paid_amount))),
      package: displayName(item.package || booking.package) || firstValue(item.package_name, booking.package_name, 'Custom Menu'),
      production_status: firstValue(item.production_status, booking.production_status, item.status, 'scheduled'),
      delivery_date: firstValue(item.delivery_date, booking.delivery_date, item.event_date),
      vehicle: displayName(item.vehicle || booking.vehicle) || firstValue(item.vehicle_name, booking.vehicle_name, 'Unassigned'),
      driver: personName(item.driver?.person || booking.driver?.person) || displayName(item.driver || booking.driver) || 'Unassigned',
      equipment: firstValue(item.equipment_name, booking.equipment_name, 'Event Equipment'),
      quantity: safeNumber(firstValue(item.equipment_quantity, booking.equipment_quantity)),
      returned_quantity: safeNumber(firstValue(item.returned_quantity, booking.returned_quantity)),
      return_date: firstValue(item.return_date, booking.return_date),
      return_status: firstValue(item.return_status, booking.return_status, 'pending'),
      reported_date: firstValue(item.damage_reported_at, booking.damage_reported_at),
      damaged_quantity: safeNumber(firstValue(item.damaged_quantity, booking.damaged_quantity)),
      damage_cost: safeNumber(firstValue(item.damage_cost, booking.damage_cost)),
      notes: firstValue(item.notes, booking.notes, ''),
      has_delivery_data: Boolean(item.delivery_date || booking.delivery_date || item.vehicle || booking.vehicle || item.driver || booking.driver),
      has_equipment_data: Boolean(item.equipment_name || booking.equipment_name || item.equipment_quantity || booking.equipment_quantity),
      has_return_data: Boolean(item.return_date || booking.return_date || item.returned_quantity || booking.returned_quantity),
      has_damage_data: Boolean(item.damage_reported_at || booking.damage_reported_at || item.damaged_quantity || booking.damaged_quantity || item.damage_cost || booking.damage_cost),
    };
  });

  if (normalized.length > 0) return normalized;

  return profitability.map((item, index) => ({
    key: `profit-${index}`,
    raw: item,
    event_id: firstValue(item.event_id, index + 1),
    reference: firstValue(item.reference, item.booking_no, `EVT-${index + 1}`),
    event: firstValue(item.event_name, 'Unspecified Event'),
    customer: firstValue(item.customer_name, 'Unknown Customer'),
    revenue: safeNumber(item.revenue),
    cost: safeNumber(item.cost),
    profit: safeNumber(item.profit),
    margin: safeNumber(item.margin),
    status: firstValue(item.status, 'completed'),
  }));
};

const normalizeInventory = (reports) => {
  const usage = asArray(reports?.inventory?.usage);
  const stocks = asArray(reports?.inventory?.stocks);
  const source = usage.length > 0 ? usage : stocks;
  return source.map((item, index) => {
    const ingredient = item.ingredient || {};
    const current = safeNumber(firstValue(item.current_quantity, item.quantity_on_hand, item.quantity));
    const unitCost = safeNumber(firstValue(item.unit_cost, ingredient.unit_cost, item.cost_per_unit));
    const minimum = safeNumber(firstValue(item.minimum_quantity, item.minimum_stock, item.reorder_point));
    return {
      key: `stock-${firstValue(item.ingredient_id, item.inventory_stock_id, index)}`,
      raw: item,
      ingredient: firstValue(item.name, ingredient.name, item.ingredient_name, 'Unknown Ingredient'),
      current_quantity: current,
      used_quantity: safeNumber(firstValue(item.used_quantity, item.consumed_quantity)),
      unit: firstValue(item.unit, ingredient.unit, ''),
      minimum_quantity: minimum,
      reorder_point: safeNumber(firstValue(item.reorder_point, minimum)),
      unit_cost: unitCost,
      stock_value: current * unitCost,
      shortage: Math.max(0, minimum - current),
      status: firstValue(item.status, item.stock_status, current <= 0 ? 'out_of_stock' : current <= minimum ? 'low_stock' : 'healthy'),
      batch_no: firstValue(item.batch_no, item.batch_number, ''),
      expiry_date: firstValue(item.expiry_date, item.expiration_date),
      days_remaining: item.expiry_date ? dayjs(item.expiry_date).diff(dayjs(), 'day') : 0,
      system_quantity: current,
      physical_quantity: safeNumber(firstValue(item.physical_quantity, current)),
      variance: safeNumber(firstValue(item.variance, safeNumber(item.physical_quantity) - current)),
      variance_cost: safeNumber(firstValue(item.variance_cost, (safeNumber(item.physical_quantity) - current) * unitCost)),
    };
  });
};

const normalizeMenu = (reports) => asArray(reports?.inventory?.menu_performance).map((item, index) => {
  const revenue = safeNumber(item.revenue);
  const cost = safeNumber(item.cost);
  const profit = revenue - cost;
  return {
    key: `menu-${firstValue(item.menu_item_id, index)}`,
    raw: item,
    menu_item: firstValue(item.name, item.menu_item_name, 'Unknown Menu Item'),
    package: firstValue(item.name, item.package_name, 'Custom Menu'),
    quantity: safeNumber(firstValue(item.popularity, item.quantity, item.orders)),
    orders: safeNumber(firstValue(item.orders, item.popularity)),
    revenue,
    cost,
    profit,
    margin: safeNumber(firstValue(item.profitability, revenue > 0 ? (profit / revenue) * 100 : 0)),
    food_cost_percentage: revenue > 0 ? (cost / revenue) * 100 : 0,
    status: revenue > 0 && cost / revenue <= 0.35 ? 'healthy' : 'review',
  };
});

const normalizeCustomers = (reports, eventRows) => {
  const revenueByCustomer = groupRows(eventRows, 'customer', { sum: ['revenue'] });
  const revenueMap = new Map(revenueByCustomer.map((row) => [row.customer, row]));
  return asArray(reports?.customers?.customers).map((item, index) => {
    const customerName = personName(item.person) || displayName(item) || firstValue(item.customer_name, `Customer ${index + 1}`);
    const stats = revenueMap.get(customerName) || {};
    return {
      key: `customer-${firstValue(item.customer_id, item.id, index)}`,
      raw: item,
      customer: customerName,
      email: firstValue(item.email, item.person?.email, ''),
      phone: firstValue(item.phone, item.phone_number, item.person?.phone_number, ''),
      customer_type: firstValue(item.customer_type, item.type, 'Regular'),
      bookings: safeNumber(firstValue(item.bookings_count, stats.records)),
      revenue: safeNumber(firstValue(item.total_revenue, stats.revenue)),
      average_value: safeNumber(firstValue(item.average_value, stats.records > 0 ? stats.revenue / stats.records : 0)),
      last_booking_date: firstValue(item.last_booking_date, stats.last_booking_date),
      preferred_event: firstValue(item.preferred_event, item.preferences?.event_type, ''),
      preferred_package: firstValue(item.preferred_package, item.preferences?.package, ''),
      dietary_preferences: firstValue(item.dietary_preferences, item.preferences?.dietary, ''),
      notes: firstValue(item.notes, item.preferences?.notes, ''),
      status: item.is_active === false ? 'inactive' : firstValue(item.status, 'active'),
    };
  });
};

const normalizePayroll = (reports) => asArray(reports?.payroll?.summary).map((item, index) => ({
  key: `payroll-${firstValue(item.employee_id, index)}`,
  raw: item,
  employee: firstValue(item.employee_name, item.name, `Employee ${index + 1}`),
  department: firstValue(item.department, item.department_name, 'Unassigned'),
  labor_cost: safeNumber(firstValue(item.net_pay, item.gross_pay)),
  overtime_cost: safeNumber(firstValue(item.overtime_cost, item.overtime_pay)),
  overtime_hours: safeNumber(firstValue(item.overtime_hours, item.overtime)),
  days_present: safeNumber(firstValue(item.days_present, item.present_days)),
  days_absent: safeNumber(firstValue(item.days_absent, item.absent_days)),
  late_count: safeNumber(firstValue(item.late_count, item.lates)),
  attendance_rate: safeNumber(firstValue(item.attendance_rate, 0)),
  events_assigned: safeNumber(firstValue(item.events_assigned, 0)),
  labor_hours: safeNumber(firstValue(item.labor_hours, item.total_hours)),
  productivity_rate: safeNumber(firstValue(item.productivity_rate, 0)),
  shift_date: firstValue(item.shift_date, item.date),
  shift: firstValue(item.shift, item.shift_name, ''),
  start_time: firstValue(item.start_time, ''),
  end_time: firstValue(item.end_time, ''),
  status: firstValue(item.status, 'active'),
}));

const normalizeFinancial = (reports) => asArray(reports?.financial?.monthly).map((item, index) => {
  const revenue = safeNumber(item.revenue);
  const expenses = safeNumber(item.expenses);
  const profit = safeNumber(firstValue(item.profit, revenue - expenses));
  return {
    key: `financial-${firstValue(item.month_number, index)}`,
    raw: item,
    period: firstValue(item.month, item.period, `Month ${index + 1}`),
    revenue,
    collected: safeNumber(item.collected),
    outstanding: safeNumber(item.outstanding),
    invoice_count: safeNumber(item.invoice_count),
    expenses,
    cost: expenses,
    profit,
    gross_profit: profit,
    margin: safeNumber(firstValue(item.profit_margin, revenue > 0 ? (profit / revenue) * 100 : 0)),
    expense_ratio: revenue > 0 ? (expenses / revenue) * 100 : 0,
    cash_in: safeNumber(item.collected),
    cash_out: expenses,
    net_cash_flow: safeNumber(item.collected) - expenses,
    closing_balance: safeNumber(item.collected) - expenses,
    taxable_sales: revenue,
    tax_amount: safeNumber(firstValue(item.tax_amount, revenue * 0.12)),
    withholding_tax: safeNumber(item.withholding_tax),
    net_tax_due: safeNumber(firstValue(item.net_tax_due, revenue * 0.12 - safeNumber(item.withholding_tax))),
    status: profit >= 0 ? 'profitable' : 'loss',
  };
});

const normalizeOutstanding = (reports) => asArray(reports?.financial?.outstanding).map((item, index) => {
  const dueDate = item.due_date;
  const overdueDays = dueDate ? Math.max(0, dayjs().diff(dayjs(dueDate), 'day')) : 0;
  const bucket = overdueDays <= 0 ? 'Current' : overdueDays <= 30 ? '1–30 Days' : overdueDays <= 60 ? '31–60 Days' : overdueDays <= 90 ? '61–90 Days' : '90+ Days';
  return {
    key: `outstanding-${firstValue(item.invoice_id, index)}`,
    raw: item,
    invoice_number: firstValue(item.invoice_number, item.reference, `INV-${index + 1}`),
    reference: firstValue(item.invoice_number, item.reference, `INV-${index + 1}`),
    customer: firstValue(item.customer_name, item.customer, 'Unknown Customer'),
    supplier: firstValue(item.supplier_name, item.supplier, ''),
    total_amount: safeNumber(item.total_amount),
    paid_amount: safeNumber(item.paid_amount),
    balance: safeNumber(firstValue(item.balance, safeNumber(item.total_amount) - safeNumber(item.paid_amount))),
    due_date: dueDate,
    days_overdue: overdueDays,
    aging_bucket: bucket,
    status: firstValue(item.status, overdueDays > 0 ? 'overdue' : 'outstanding'),
  };
});

// ============================================================
// BUILD REPORT ROWS - MAIN FUNCTION
// ============================================================
const buildReportRows = (reportKey, reports) => {
  const eventRows = normalizeEvents(reports);
  const stockRows = normalizeInventory(reports);
  const menuRows = normalizeMenu(reports);
  const customerRows = normalizeCustomers(reports, eventRows);
  const payrollRows = normalizePayroll(reports);
  const financialRows = normalizeFinancial(reports);
  const outstandingRows = normalizeOutstanding(reports);
  const today = dayjs().startOf('day');

  const salesSeries = (key) => asArray(reports?.sales?.[key]).map((item, index) => ({
    key: `${key}-${index}`,
    raw: item,
    period: firstValue(item.period, item.date, item.week, item.month, 'Unspecified'),
    orders: safeNumber(item.orders),
    total_sales: safeNumber(item.total_sales),
    collected: safeNumber(firstValue(item.revenue, item.collected)),
    outstanding: safeNumber(item.outstanding),
  }));

  const packageRows = asArray(reports?.sales?.top_packages).map((item, index) => ({
    key: `package-${index}`,
    raw: item,
    package: firstValue(item.name, item.package, 'Custom Menu'),
    orders: safeNumber(item.orders),
    quantity: safeNumber(firstValue(item.quantity, item.orders)),
    revenue: safeNumber(firstValue(item.revenue, item.total_sales)),
    average_value: safeNumber(item.orders) > 0 ? safeNumber(firstValue(item.revenue, item.total_sales)) / safeNumber(item.orders) : 0,
  }));

  const eventTypeRows = asArray(reports?.additional?.revenue_by_event_type).map((item, index) => ({
    key: `event-type-${index}`,
    raw: item,
    event: firstValue(item.name, item.event_type, 'Unspecified'),
    bookings: safeNumber(firstValue(item.orders, item.bookings, item.count)),
    revenue: safeNumber(firstValue(item.revenue, item.value)),
    average_value: safeNumber(firstValue(item.orders, item.bookings, item.count)) > 0
      ? safeNumber(firstValue(item.revenue, item.value)) / safeNumber(firstValue(item.orders, item.bookings, item.count)) : 0,
  }));

  const inventoryMovements = asArray(reports?.inventory?.movements).map((item, index) => ({
    key: `movement-${index}`,
    raw: item,
    period: firstValue(item.period, item.date, 'Unspecified'),
    incoming: safeNumber(item.incoming),
    outgoing: safeNumber(item.outgoing),
    wastage: safeNumber(item.wastage),
    net_movement: safeNumber(item.incoming) - safeNumber(item.outgoing) - safeNumber(item.wastage),
    quantity: safeNumber(item.incoming),
    total_amount: safeNumber(firstValue(item.total_amount, item.cost)),
    status: 'recorded',
  }));

  const groupEventRows = (field) => groupRows(eventRows, field, { sum: ['revenue', 'cost', 'profit', 'guest_count'] }).map((item, index) => ({
    ...item,
    key: `${field}-${index}`,
    bookings: item.records,
    events: item.records,
    average_value: item.records > 0 ? item.revenue / item.records : 0,
    average_guests: item.records > 0 ? item.guest_count / item.records : 0,
  }));

  switch (reportKey) {
    case 'daily-sales': return salesSeries('daily');
    case 'weekly-sales': return salesSeries('weekly');
    case 'monthly-sales': return salesSeries('monthly');
    case 'annual-sales': {
      const rows = salesSeries('monthly');
      return [{
        key: `annual-${dayjs().year()}`,
        year: dayjs().year(),
        orders: rows.reduce((sum, row) => sum + row.orders, 0),
        total_sales: rows.reduce((sum, row) => sum + row.total_sales, 0),
        collected: rows.reduce((sum, row) => sum + row.collected, 0),
        outstanding: rows.reduce((sum, row) => sum + row.outstanding, 0),
        raw: reports?.sales?.summary || {},
      }];
    }
    case 'sales-by-customer': return groupEventRows('customer').map((row) => ({ ...row, paid_amount: row.revenue, outstanding: 0 }));
    case 'sales-by-event-type': return eventTypeRows.length > 0 ? eventTypeRows : groupEventRows('event');
    case 'sales-by-venue': return groupEventRows('venue');
    case 'sales-by-salesperson': return groupEventRows('salesperson');
    case 'sales-by-branch': return groupEventRows('branch');
    case 'booking-summary': return eventRows;
    case 'quotation-report': return eventRows.filter((row) => row.quotation_no || row.quotation_total > 0);
    case 'quotation-conversion': {
      const grouped = groupRows(eventRows.map((row) => ({ ...row, period: row.event_date ? dayjs(row.event_date).format('YYYY-MM') : 'Unspecified' })), 'period');
      return grouped.map((row, index) => {
        const sourceRows = eventRows.filter((event) => (event.event_date ? dayjs(event.event_date).format('YYYY-MM') : 'Unspecified') === row.period);
        const converted = sourceRows.filter((event) => ['confirmed', 'completed'].includes(String(event.status).toLowerCase())).length;
        return { key: `conversion-${index}`, period: row.period, quotations: row.records, converted, conversion_rate: row.records > 0 ? (converted / row.records) * 100 : 0, raw: sourceRows };
      });
    }
    case 'deposit-collection': return eventRows.filter((row) => row.deposit_amount > 0 || row.paid_amount > 0);
    case 'outstanding-customer-payments': return outstandingRows;
    case 'cancelled-events-sales': return eventRows.filter((row) => String(row.status).toLowerCase().includes('cancel'));
    case 'revenue-by-menu-package': return packageRows;

    case 'event-schedule': return [...eventRows].sort((a, b) => dayjs(a.event_date).valueOf() - dayjs(b.event_date).valueOf());
    case 'upcoming-events': return eventRows.filter((row) => row.event_date && !dayjs(row.event_date).startOf('day').isBefore(today) && !String(row.status).toLowerCase().includes('cancel'));
    case 'completed-events': return eventRows.filter((row) => String(row.status).toLowerCase().includes('complete'));
    case 'cancelled-events': return eventRows.filter((row) => String(row.status).toLowerCase().includes('cancel'));
    case 'guest-count-summary': return groupEventRows('event');
    case 'event-revenue-analysis': return eventRows;
    case 'event-cost-analysis': return eventRows;
    case 'event-profitability': return eventRows;

    case 'kitchen-production-sheet':
    case 'production-schedule': return eventRows.filter((row) => !String(row.status).toLowerCase().includes('cancel'));
    case 'daily-production-report': return groupRows(eventRows, 'event_date', { sum: ['guest_count'] }).map((row, index) => ({ key: `production-${index}`, event_date: row.event_date, events: row.records, guest_count: row.guest_count, items_required: undefined, production_status: 'scheduled', raw: row }));
    case 'ingredient-requirements': return stockRows.map((row) => ({ ...row, quantity: row.used_quantity, shortage: Math.max(0, row.used_quantity - row.current_quantity) }));
    case 'kitchen-recipe-cost-analysis': return menuRows;
    case 'menu-production-summary': return packageRows;

    case 'current-inventory': return stockRows;
    case 'stock-movement': return inventoryMovements;
    case 'inventory-consumption': return stockRows.filter((row) => row.used_quantity > 0);
    case 'inventory-valuation': return stockRows;
    case 'low-stock': return stockRows.filter((row) => ['low_stock', 'out_of_stock'].includes(String(row.status).toLowerCase()) || row.current_quantity <= row.minimum_quantity);
    case 'expiring-items': return stockRows.filter((row) => row.expiry_date).sort((a, b) => dayjs(a.expiry_date).valueOf() - dayjs(b.expiry_date).valueOf());
    case 'stock-adjustments': return [];
    case 'physical-inventory-variance': return stockRows.filter((row) => row.raw?.physical_quantity !== undefined || row.raw?.variance !== undefined);

    case 'purchase-orders':
    case 'supplier-purchases':
    case 'purchase-history':
    case 'outstanding-purchase-orders':
    case 'goods-received':
    case 'supplier-performance': return [];

    case 'profit-and-loss': return financialRows;
    case 'revenue-report': return financialRows;
    case 'expense-report': return financialRows;
    case 'gross-profit-report': return financialRows;
    case 'net-profit-report': return financialRows;
    case 'cash-flow-statement': return financialRows;
    case 'accounts-receivable-aging': return outstandingRows;
    case 'accounts-payable-aging': return outstandingRows.filter((row) => row.supplier);
    case 'tax-summary': return financialRows;

    case 'customer-list': return customerRows;
    case 'customer-booking-history': return eventRows;
    case 'customer-revenue-analysis': return groupEventRows('customer');
    case 'repeat-customers': return groupEventRows('customer').filter((row) => row.bookings > 1).map((row) => ({ ...row, status: 'repeat' }));
    case 'customer-payment-history': return [];
    case 'customer-preferences': return customerRows;

    case 'best-selling-menu-packages': return [...packageRows].sort((a, b) => b.orders - a.orders).map((row, index) => ({ ...row, rank: index + 1 }));
    case 'least-selling-menu-packages': return [...packageRows].sort((a, b) => a.orders - b.orders).map((row, index) => ({ ...row, rank: index + 1 }));
    case 'menu-profitability': return menuRows;
    case 'menu-recipe-cost-analysis': return menuRows;
    case 'food-cost-percentage': return menuRows;

    case 'staff-attendance': return payrollRows.filter((row) => row.raw?.days_present !== undefined || row.raw?.present_days !== undefined || row.raw?.attendance_rate !== undefined);
    case 'staff-schedule': return payrollRows.filter((row) => row.shift_date || row.shift);
    case 'labor-cost-by-event': return eventRows.filter((row) => row.raw?.staff_count !== undefined || row.raw?.labor_hours !== undefined || row.raw?.labor_cost !== undefined).map((row) => ({ ...row, staff_count: safeNumber(row.raw?.staff_count), labor_hours: safeNumber(row.raw?.labor_hours), labor_cost: safeNumber(row.raw?.labor_cost) }));
    case 'overtime-report': return payrollRows.filter((row) => row.overtime_hours > 0 || row.overtime_cost > 0);
    case 'staff-productivity': return payrollRows.filter((row) => row.raw?.productivity_rate !== undefined || row.raw?.events_assigned !== undefined || row.raw?.labor_hours !== undefined);

    case 'delivery-schedule': return eventRows.filter((row) => row.has_delivery_data);
    case 'vehicle-assignment': return eventRows.filter((row) => row.has_delivery_data);
    case 'equipment-delivery': return eventRows.filter((row) => row.has_equipment_data);
    case 'equipment-return': return eventRows.filter((row) => row.has_return_data);
    case 'equipment-damage': return eventRows.filter((row) => row.has_damage_data);

    case 'food-waste': return inventoryMovements.filter((row) => row.wastage > 0).map((row) => ({ ...row, ingredient: 'Food Inventory', quantity: row.wastage, unit: '', waste_reason: 'Recorded wastage', waste_cost: row.total_amount, status: 'recorded' }));
    case 'inventory-waste': return inventoryMovements.filter((row) => row.wastage > 0).map((row) => ({ ...row, ingredient: 'Inventory Items', quantity: row.wastage, unit: '', waste_cost: row.total_amount, status: 'recorded' }));
    case 'spoilage-report': return stockRows.filter((row) => row.expiry_date && row.days_remaining <= 0).map((row) => ({ ...row, period: row.expiry_date, quantity: row.current_quantity, waste_cost: row.stock_value }));
    case 'waste-cost-analysis': return inventoryMovements.filter((row) => row.wastage > 0).map((row) => ({ ...row, waste_cost: row.total_amount, waste_rate: row.incoming > 0 ? (row.wastage / row.incoming) * 100 : 0 }));

    case 'daily-operations': return salesSeries('daily').map((row) => ({ ...row, events: row.orders, revenue: row.collected, expenses: undefined, profit: undefined, status: 'revenue_data_only' }));
    case 'weekly-operations': return salesSeries('weekly').map((row) => ({ ...row, events: row.orders, revenue: row.collected, expenses: undefined, profit: undefined, status: 'revenue_data_only' }));
    case 'monthly-operations': return financialRows.map((row) => ({ ...row, events: safeNumber(eventRows.filter((event) => event.event_date && dayjs(event.event_date).format('MMM') === row.period).length), orders: row.invoice_count }));
    case 'annual-operations': {
      const annual = financialRows.reduce((acc, row) => ({
        revenue: acc.revenue + row.revenue,
        expenses: acc.expenses + row.expenses,
        profit: acc.profit + row.profit,
        orders: acc.orders + row.invoice_count,
      }), { revenue: 0, expenses: 0, profit: 0, orders: 0 });
      return [{ key: `annual-operations-${dayjs().year()}`, year: dayjs().year(), events: eventRows.length, ...annual, margin: annual.revenue > 0 ? (annual.profit / annual.revenue) * 100 : 0, raw: annual }];
    }
    case 'branch-performance': return groupEventRows('branch').map((row) => ({ ...row, orders: row.bookings, expenses: row.cost, margin: row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0 }));
    case 'department-performance': return asArray(reports?.payroll?.by_department).map((row, index) => ({ key: `department-${index}`, raw: row, department: firstValue(row.name, row.department, 'Unassigned'), employees: safeNumber(row.employees), events_assigned: safeNumber(row.events_assigned), cost: safeNumber(firstValue(row.total, row.value)), productivity_rate: safeNumber(row.productivity_rate), status: 'active' }));
    default: return [];
  }
};

const getFilterOptions = (rows, field) => [...new Set(rows.map((row) => row[field]).filter(Boolean).map(String))]
  .sort((a, b) => a.localeCompare(b))
  .map((value) => ({ label: value, value }));

const rowMatchesDateRange = (row, dateRange) => {
  if (!dateRange?.[0] || !dateRange?.[1]) return true;
  const value = firstValue(row.event_date, row.order_date, row.received_date, row.due_date, row.expiry_date, row.shift_date, row.delivery_date, row.return_date, row.reported_date);
  if (!value || !dayjs(value).isValid()) return true;
  const date = dayjs(value);
  return !date.isBefore(dateRange[0].startOf('day')) && !date.isAfter(dateRange[1].endOf('day'));
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const ReportsAnalyticsPage = () => {
  const { message } = AntdApp.useApp();
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    const detectTheme = () => {
      setIsDarkMode(document.body.classList.contains('dark-mode'));
    };
    detectTheme();
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const userRoles = useMemo(() => getUserRoles(user), [user]);
  const canSeeAll = userRoles.some((role) => ADMIN_ROLES.has(role));

  const visibleCategories = useMemo(() => REPORT_CATEGORIES.filter((category) => (
    canSeeAll || ACCESS[category.key]?.some((role) => userRoles.includes(role))
  )), [canSeeAll, userRoles]);

  const initialCategory = visibleCategories[0] || REPORT_CATEGORIES[0];
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(initialCategory.key);
  const [selectedReportKey, setSelectedReportKey] = useState(initialCategory.reports[0].key);
  const [openKeys, setOpenKeys] = useState([initialCategory.key]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [drawerRecord, setDrawerRecord] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const defaultRange = useMemo(() => [dayjs().startOf('month'), dayjs().endOf('month')], []);
  const emptyFilters = useMemo(() => ({
    dateRange: defaultRange,
    customer: undefined,
    event: undefined,
    venue: undefined,
    branch: undefined,
    salesperson: undefined,
    supplier: undefined,
    status: undefined,
  }), [defaultRange]);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);

  useEffect(() => {
    if (visibleCategories.length === 0) return;
    const categoryStillVisible = visibleCategories.some((category) => category.key === selectedCategoryKey);
    if (!categoryStillVisible) {
      setSelectedCategoryKey(visibleCategories[0].key);
      setSelectedReportKey(visibleCategories[0].reports[0].key);
      setOpenKeys([visibleCategories[0].key]);
    }
  }, [selectedCategoryKey, visibleCategories]);

  const queryParams = useMemo(() => ({
    start_date: appliedFilters.dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: appliedFilters.dateRange?.[1]?.format('YYYY-MM-DD'),
    year: appliedFilters.dateRange?.[0]?.year() || dayjs().year(),
  }), [appliedFilters.dateRange]);

  const {
    data: reports = {},
    isLoading,
    isFetching,
    error,
    refetch,
  } = useReportsData(queryParams, { salesOnly: !canSeeAll });

  const selectedCategory = visibleCategories.find((category) => category.key === selectedCategoryKey) || initialCategory;
  const activeReport = selectedCategory?.reports.find((item) => item.key === selectedReportKey) || selectedCategory?.reports[0];

  const baseRows = useMemo(() => (
    activeReport ? buildReportRows(activeReport.key, reports) : []
  ), [activeReport, reports]);

  const filteredRows = useMemo(() => baseRows.filter((row) => {
    if (!rowMatchesDateRange(row, appliedFilters.dateRange)) return false;
    for (const field of ['customer', 'event', 'venue', 'branch', 'salesperson', 'supplier', 'status']) {
      if (appliedFilters[field] && String(row[field] || '') !== String(appliedFilters[field])) return false;
    }
    if (!searchText.trim()) return true;
    const needle = searchText.trim().toLowerCase();
    return activeReport.fields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle));
  }), [activeReport, appliedFilters, baseRows, searchText]);

  const filterFields = useMemo(() => ['customer', 'event', 'venue', 'branch', 'salesperson', 'supplier', 'status']
    .filter((field) => activeReport?.fields.includes(field)), [activeReport]);

  const selectOptions = useMemo(() => Object.fromEntries(
    ['customer', 'event', 'venue', 'branch', 'salesperson', 'supplier', 'status'].map((field) => [field, getFilterOptions(baseRows, field)]),
  ), [baseRows]);

  const columns = useMemo(() => {
    const reportColumns = (activeReport?.fields || []).map((field) => {
      const meta = COLUMN_META[field] || { label: humanize(field), width: 140 };
      return {
        title: <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#6B7280' }}>{meta.label}</span>,
        dataIndex: field,
        key: field,
        width: meta.width || 140,
        align: ['currency', 'number', 'percent'].includes(meta.type) ? 'right' : 'left',
        sorter: (a, b) => {
          if (['currency', 'number', 'percent'].includes(meta.type)) return safeNumber(a[field]) - safeNumber(b[field]);
          if (meta.type === 'date') return dayjs(a[field]).valueOf() - dayjs(b[field]).valueOf();
          return String(a[field] ?? '').localeCompare(String(b[field] ?? ''));
        },
        render: (value) => {
          if (value === undefined || value === null || value === '') return <span className="rp-empty-value">—</span>;
          if (meta.type === 'currency') return <Text className="rp-number-cell" style={{ fontFamily: 'monospace', fontWeight: 500, color: '#1F2937' }}>{formatCurrency(value)}</Text>;
          if (meta.type === 'number') return <Text className="rp-number-cell" style={{ fontFamily: 'monospace', color: '#374151' }}>{formatNumber(value)}</Text>;
          if (meta.type === 'percent') return <Text className="rp-number-cell" style={{ fontFamily: 'monospace', color: value > 0 ? '#059669' : '#DC2626' }}>{formatNumber(value)}%</Text>;
          if (meta.type === 'date') return <span style={{ color: '#6B7280', fontSize: '13px' }}>{formatDate(value)}</span>;
          if (meta.type === 'status') return value ? <Tag color={statusColor(value)} className="rp-status-tag" style={{ borderRadius: '6px', fontWeight: 500, padding: '2px 12px', fontSize: '12px' }}>{humanize(value)}</Tag> : '—';
          if (meta.type === 'reference') return value ? <Tag color="blue" className="rp-reference-tag" style={{ borderRadius: '6px', background: '#EEF2FF', border: 'none', color: '#4F46E5', fontWeight: 500, padding: '2px 12px' }}>{value}</Tag> : '—';
          return value === undefined || value === null || value === '' ? '—' : <span style={{ color: '#1F2937', fontSize: '13px' }}>{String(value)}</span>;
        },
      };
    });

    reportColumns.push({
      title: <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#6B7280' }}>Actions</span>,
      key: 'details',
      fixed: 'right',
      width: 48,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="View details">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => setDrawerRecord(record)} 
            size="small" 
            className="rp-view-btn"
            style={{ color: '#6B7280' }}
          />
        </Tooltip>
      ),
    });
    return reportColumns;
  }, [activeReport]);

  const menuItems = useMemo(() => visibleCategories.map((category) => ({
    key: category.key,
    icon: React.createElement(category.icon, { 
      style: { 
        color: '#4F46E5', 
        fontSize: '16px' 
      } 
    }),
    label: (
      <span style={{ 
        fontSize: '13px',
        fontWeight: 500,
        color: '#1F2937'
      }}>
        {category.label}
      </span>
    ),
    children: category.reports.map((item) => ({
      key: item.key,
      icon: <FileTextOutlined style={{ fontSize: '12px', color: '#9CA3AF' }} />,
      label: (
        <span style={{ 
          fontSize: '13px', 
          color: '#4B5563',
          fontWeight: 400
        }}>
          {item.label}
        </span>
      ),
    })),
  })), [visibleCategories]);

  const selectReport = (reportKey) => {
    const category = visibleCategories.find((item) => item.reports.some((reportItem) => reportItem.key === reportKey));
    if (!category) return;
    setSelectedCategoryKey(category.key);
    setSelectedReportKey(reportKey);
    setOpenKeys([category.key]);
    setSearchText('');
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const handleGenerate = () => {
    setAppliedFilters({ ...draftFilters });
    message.success({
      content: `${activeReport.label} generated successfully.`,
      duration: 2,
    });
  };

  const handleResetFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setSearchText('');
  };

  const exportPayload = () => filteredRows.map((row) => Object.fromEntries(
    activeReport.fields.map((field) => {
      const meta = COLUMN_META[field] || { label: humanize(field) };
      let value = row[field];
      if (meta.type === 'date') value = value ? dayjs(value).format('YYYY-MM-DD') : '';
      return [meta.label, value ?? ''];
    }),
  ));

  const fileBaseName = () => `${activeReport.label.replace(/[^a-z0-9]+/gi, '_')}_${dayjs().format('YYYY-MM-DD')}`;

  const handleExportExcel = () => {
    if (filteredRows.length === 0) return message.warning('No data to export.');
    const headers = activeReport.fields.map((field) => COLUMN_META[field]?.label || humanize(field));
    const rows = filteredRows.map((row) => activeReport.fields.map((field) => row[field] ?? ''));
    const worksheet = XLSX.utils.aoa_to_sheet([
      [activeReport.label],
      [`Period: ${appliedFilters.dateRange?.[0]?.format('MMM D, YYYY') || 'All'} to ${appliedFilters.dateRange?.[1]?.format('MMM D, YYYY') || 'All'}`],
      [],
      headers,
      ...rows,
    ]);
    worksheet['!cols'] = activeReport.fields.map((field) => ({ wch: Math.max(14, Math.min(28, COLUMN_META[field]?.width ? Math.round(COLUMN_META[field].width / 8) : 18)) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `${fileBaseName()}.xlsx`);
    message.success('Excel report exported successfully.');
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return message.warning('No data to export.');
    const payload = exportPayload();
    const headers = Object.keys(payload[0]);
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(escapeCsv).join(','), ...payload.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileBaseName()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('CSV report exported successfully.');
  };

  const buildPrintableHtml = (mode = 'print') => {
    const headers = activeReport.fields.map((field) => `<th>${escapeHtml(COLUMN_META[field]?.label || humanize(field))}</th>`).join('');
    const rows = filteredRows.map((row) => `<tr>${activeReport.fields.map((field) => {
      const meta = COLUMN_META[field] || {};
      let value = row[field];
      if (value === undefined || value === null || value === '') value = '—';
      else if (meta.type === 'currency') value = formatCurrency(value);
      else if (meta.type === 'number') value = formatNumber(value);
      else if (meta.type === 'percent') value = `${formatNumber(value)}%`;
      else if (meta.type === 'date') value = formatDate(value);
      else if (meta.type === 'status') value = humanize(value);
      return `<td class="${['currency', 'number', 'percent'].includes(meta.type) ? 'number' : ''}">${escapeHtml(value || value === 0 ? value : '—')}</td>`;
    }).join('')}</tr>`).join('');
    const totals = activeReport.fields.map((field, index) => {
      const meta = COLUMN_META[field] || {};
      if (index === 0) return '<td><strong>TOTAL</strong></td>';
      if (!meta.total || !filteredRows.some((row) => row[field] !== undefined && row[field] !== null && row[field] !== '')) return '<td></td>';
      const value = filteredRows.reduce((sum, row) => sum + safeNumber(row[field]), 0);
      return `<td class="number"><strong>${escapeHtml(meta.type === 'currency' ? formatCurrency(value) : formatNumber(value))}</strong></td>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(activeReport.label)}</title><style>
      @page{size:A4 landscape;margin:12mm} body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;font-size:10px}
      .header{text-align:center;border-bottom:2px solid #4F46E5;padding-bottom:10px;margin-bottom:12px}.header h1{font-size:20px;margin:0;color:#4F46E5}.header h2{font-size:15px;margin:5px 0;color:#1e293b}.meta{color:#64748b}
      .summary{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #e2e8f0;margin-bottom:12px}.summary div{padding:8px;border-right:1px solid #e2e8f0}.summary div:last-child{border-right:0}.summary small{display:block;color:#64748b;text-transform:uppercase;font-size:8px}.summary strong{font-size:13px}
      table{width:100%;border-collapse:collapse;table-layout:auto}th{background:#4F46E5;color:white;text-align:left;padding:7px;border:1px solid #4338CA;white-space:nowrap;font-size:8px;text-transform:uppercase;letter-spacing:.05em}td{padding:6px;border:1px solid #e2e8f0;vertical-align:top}tbody tr:nth-child(even){background:#f8fafc}.number{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}tfoot{background:#EEF2FF;font-weight:600}.footer{margin-top:12px;display:flex;justify-content:space-between;color:#64748b;font-size:8px}.no-print{margin:15px 0;text-align:center}
      @media print{.no-print{display:none}}
    </style></head><body>
      <div class="header"><h1>CATERING MANAGEMENT SYSTEM</h1><h2>${escapeHtml(activeReport.label)}</h2><div class="meta">${escapeHtml(selectedCategory.label)} · ${escapeHtml(appliedFilters.dateRange?.[0]?.format('MMM D, YYYY') || 'All Dates')} to ${escapeHtml(appliedFilters.dateRange?.[1]?.format('MMM D, YYYY') || 'All Dates')}</div></div>
      <table><thead><tr>${headers}</tr></thead><tbody>${rows || `<tr><td colspan="${activeReport.fields.length}">No records available.</td></tr>`}</tbody><tfoot><tr>${totals}</tr></tfoot></table>
      <div class="footer"><span>Generated: ${escapeHtml(dayjs().format('MMMM D, YYYY h:mm A'))}</span><span>${escapeHtml(String(filteredRows.length))} record(s)</span></div>
      <div class="no-print"><button onclick="window.print()">${mode === 'pdf' ? 'Save as PDF' : 'Print'}</button><button onclick="window.close()">Close</button></div>
    </body></html>`;
  };

  const openPrintWindow = (mode) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return message.error('Pop-up blocked. Please allow pop-ups for printing.');
    printWindow.document.open();
    printWindow.document.write(buildPrintableHtml(mode));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleEmail = () => {
    if (!emailAddress.trim() || !/^\S+@\S+\.\S+$/.test(emailAddress.trim())) {
      return message.error('Enter a valid recipient email address.');
    }
    const subject = encodeURIComponent(`${activeReport.label} - ${dayjs().format('YYYY-MM-DD')}`);
    const body = encodeURIComponent(`Hello,\n\nPlease review the ${activeReport.label}.\n\nGenerated from the Catering Management System on ${dayjs().format('MMMM D, YYYY h:mm A')}.`);
    window.location.href = `mailto:${encodeURIComponent(emailAddress.trim())}?subject=${subject}&body=${body}`;
    setEmailOpen(false);
    message.success('Email application opened with report summary.');
  };

  const exportMenu = {
    items: [
      { key: 'pdf', label: 'Export PDF', icon: <FilePdfOutlined /> },
      { key: 'excel', label: 'Export Excel', icon: <FileExcelOutlined /> },
      { key: 'csv', label: 'Export CSV', icon: <CloudDownloadOutlined /> },
    ],
    onClick: ({ key }) => {
      if (key === 'pdf') openPrintWindow('pdf');
      if (key === 'excel') handleExportExcel();
      if (key === 'csv') handleExportCsv();
    },
  };

  if (visibleCategories.length === 0) {
    return (
      <div className="rp-premium-page rp-access-page">
        <Card className="rp-access-card">
          <Alert
            type="warning"
            showIcon
            icon={<SafetyCertificateOutlined />}
            message="No authorized reports"
            description={`Your current role (${userRoles.join(', ') || 'unassigned'}) is not authorized to view report categories.`}
          />
        </Card>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#4F46E5',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgContainer: '#FFFFFF',
          colorBgElevated: '#FFFFFF',
          colorText: '#1F2937',
          colorTextSecondary: '#6B7280',
          colorBorder: '#E5E7EB',
        },
        components: {
          Table: {
            headerBg: '#F9FAFB',
            headerColor: '#374151',
            headerBorderRadius: 0,
            cellPaddingBlock: 12,
            cellPaddingInline: 16,
            borderColor: '#F3F4F6',
          },
          Card: {
            borderRadius: 12,
          },
          Button: {
            borderRadius: 8,
          },
          Menu: {
            itemBorderRadius: 8,
          },
        },
      }}
    >
      <div className={`rp-premium-page ${isDarkMode ? 'rp-dark-mode' : ''}`}>
        {/* Premium Header */}
        <header className="rp-premium-header">
          <div className="rp-header-left">
            <div className="rp-header-brand">
              <div className="rp-brand-icon">
                <PieChartOutlined />
              </div>
              <div className="rp-brand-info">
                <div className="rp-eyebrow">
                  <BarChartOutlined /> Analytics Dashboard
                </div>
                <h1 className="rp-header-title">Reports Center</h1>
                <span className="rp-header-subtitle">Comprehensive business intelligence & operational reporting</span>
              </div>
            </div>
          </div>
          <div className="rp-header-right">
            <div className="rp-header-meta">
              <div className="rp-meta-item">
                <SafetyCertificateOutlined />
                <span style={{ fontWeight: 500 }}>{humanize(userRoles[0] || 'Authorized')}</span>
              </div>
              <div className="rp-meta-item">
                <DatabaseOutlined />
                <span className={error ? 'rp-status-error' : 'rp-status-success'}>
                  {error ? 'Connection Issue' : 'Live Data'}
                </span>
              </div>
              <div className="rp-meta-item rp-time">
                <ClockCircleOutlined />
                <span>{dayjs().format('MMM D, YYYY h:mm A')}</span>
              </div>
            </div>
          </div>
        </header>

        <div className={`rp-premium-workspace ${sidebarCollapsed ? 'rp-sidebar-collapsed' : ''}`}>
          {/* Sidebar - Formal & Clean */}
          <aside className="rp-premium-sidebar">
            <div className="rp-sidebar-header">
              {!sidebarCollapsed && (
                <span className="rp-sidebar-label">
                  <DatabaseOutlined style={{ marginRight: '8px', fontSize: '14px' }} />
                  REPORT CATEGORIES
                </span>
              )}
              <Button
                type="text"
                icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="rp-sidebar-toggle"
              />
            </div>
            <Menu
              mode="inline"
              inlineCollapsed={sidebarCollapsed}
              selectedKeys={[selectedReportKey]}
              openKeys={sidebarCollapsed ? undefined : openKeys}
              onOpenChange={(keys) => setOpenKeys(keys.slice(-1))}
              onClick={({ key }) => selectReport(key)}
              items={menuItems}
              className="rp-category-menu"
              style={{
                background: 'transparent',
                borderRight: 'none',
              }}
            />
            {!sidebarCollapsed && (
              <div className="rp-sidebar-footer">
                <SafetyCertificateOutlined />
                <div>
                  <strong>Permission-aware</strong>
                  <span>Role-based report visibility</span>
                </div>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <main className="rp-main-panel">
            {reports.warning && (
              <Alert className="rp-warning" type="warning" showIcon message={reports.warning} />
            )}
            {error && (
              <Alert className="rp-warning" type="error" showIcon message="Unable to load data" description={error.message} />
            )}

            {/* Toolbar */}
            <div className="rp-premium-toolbar">
              <div className="rp-toolbar-left">
                <div className="rp-toolbar-icon" style={{ background: selectedCategory.gradient || selectedCategory.color }}>
                  {React.createElement(selectedCategory.icon)}
                </div>
                <div>
                  <span className="rp-toolbar-category">{selectedCategory.label}</span>
                  <h3 className="rp-toolbar-title">{activeReport.label}</h3>
                </div>
              </div>
              <div className="rp-toolbar-right">
                <Button type="primary" icon={<RocketOutlined />} onClick={handleGenerate} loading={isFetching} className="rp-btn-primary">
                  Generate Report
                </Button>
                <Button icon={<PrinterOutlined />} onClick={() => openPrintWindow('print')} className="rp-btn-outline">
                  Print
                </Button>
                <Dropdown menu={exportMenu} trigger={['click']}>
                  <Button icon={<ExportOutlined />} className="rp-btn-outline">
                    Export <DownOutlined />
                  </Button>
                </Dropdown>
                <Button icon={<SendOutlined />} onClick={() => setEmailOpen(true)} className="rp-btn-outline">
                  Email
                </Button>
                <Tooltip title="Refresh data">
                  <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()} className="rp-btn-icon" />
                </Tooltip>
              </div>
            </div>

            {/* Filters */}
            <div className="rp-premium-filters">
              <div className="rp-filters-header" onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                <FilterOutlined /> 
                <span style={{ fontWeight: 600 }}>Advanced Filters</span>
                <Badge count={filterFields.length + 1} size="small" className="rp-filter-badge" />
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6B7280' }}>
                  {isFilterExpanded ? 'Hide filters' : 'Show filters'}
                </span>
              </div>
              {isFilterExpanded && (
                <div className="rp-filters-grid">
                  <div className="rp-filter-field rp-filter-date">
                    <label>Date Range</label>
                    <RangePicker
                      value={draftFilters.dateRange}
                      onChange={(value) => setDraftFilters({ ...draftFilters, dateRange: value })}
                      allowClear
                      format="MMM D, YYYY"
                      className="rp-filter-input"
                      suffixIcon={<CalendarOutlined />}
                    />
                  </div>
                  {filterFields.map((field) => (
                    <div className="rp-filter-field" key={field}>
                      <label>{COLUMN_META[field]?.label || humanize(field)}</label>
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={`All ${humanize(field)}`}
                        value={draftFilters[field]}
                        options={selectOptions[field]}
                        onChange={(value) => setDraftFilters({ ...draftFilters, [field]: value })}
                        className="rp-filter-input"
                        suffixIcon={<DownOutlined />}
                      />
                    </div>
                  ))}
                  <div className="rp-filter-field rp-filter-search">
                    <label>Quick Search</label>
                    <Input
                      allowClear
                      prefix={<SearchOutlined className="rp-search-icon" />}
                      placeholder="Search all columns..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="rp-filter-input"
                    />
                  </div>
                  <div className="rp-filter-actions">
                    <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate} style={{ width: '100%' }}>
                      Apply Filters
                    </Button>
                    <Button onClick={handleResetFilters} style={{ width: '100%' }}>Reset All</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Report Content - Without Summary Cards */}
            <div className="rp-premium-report">
              <div className="rp-table-wrapper">
                <div className="rp-table-header">
                  <div className="rp-table-title">
                    <FileTextOutlined style={{ color: '#4F46E5' }} />
                    <strong>Detailed Records</strong>
                    <span className="rp-record-count">{filteredRows.length} records</span>
                  </div>
                  <Space>
                    <Text type="secondary" style={{ fontSize: '12px', color: '#9CA3AF' }}>Rows per page</Text>
                    <Select
                      value={pageSize}
                      onChange={setPageSize}
                      options={[10, 20, 50, 100].map((v) => ({ label: v, value: v }))}
                      style={{ width: 72 }}
                      size="small"
                      className="rp-page-size-select"
                    />
                  </Space>
                </div>

                <Spin spinning={isLoading && !reports?.sales} tip="Loading records...">
                  <Table
                    className="rp-premium-table"
                    rowKey={(row) => row.key}
                    columns={columns}
                    dataSource={filteredRows}
                    variant="borderless"
                    size="middle"
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching records found." /> }}
                    pagination={{
                      pageSize,
                      showSizeChanger: false,
                      showQuickJumper: filteredRows.length > pageSize,
                      showTotal: (total, range) => (
                        <span className="rp-pagination-total">
                          {range[0]}–{range[1]} of <strong>{total}</strong> records
                        </span>
                      ),
                      className: 'rp-pagination',
                      itemRender: (current, type, originalElement) => {
                        if (type === 'prev') {
                          return <Button size="small" className="rp-pagination-nav">Previous</Button>;
                        }
                        if (type === 'next') {
                          return <Button size="small" className="rp-pagination-nav">Next</Button>;
                        }
                        return originalElement;
                      },
                    }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row className="rp-total-row">
                          {activeReport.fields.map((field, index) => {
                            const meta = COLUMN_META[field] || {};
                            if (index === 0) return <Table.Summary.Cell key={field} index={index}><strong style={{ color: '#1F2937' }}>TOTAL</strong></Table.Summary.Cell>;
                            if (!meta.total || !filteredRows.some((row) => row[field] !== undefined && row[field] !== null && row[field] !== '')) return <Table.Summary.Cell key={field} index={index} />;
                            const value = filteredRows.reduce((sum, row) => sum + safeNumber(row[field]), 0);
                            return (
                              <Table.Summary.Cell key={field} index={index} align="right">
                                <strong className="rp-total-value">
                                  {meta.type === 'currency' ? formatCurrency(value) : formatNumber(value)}
                                </strong>
                              </Table.Summary.Cell>
                            );
                          })}
                          <Table.Summary.Cell index={activeReport.fields.length} />
                        </Table.Summary.Row>
                      </Table.Summary>
                    )}
                  />
                </Spin>

                <footer className="rp-footer">
                  <span>Generated {dayjs().format('MMMM D, YYYY h:mm A')}</span>
                  <span className="rp-footer-divider">|</span>
                  <span>Source: Database</span>
                  <span className="rp-footer-divider">|</span>
                  <span>{filteredRows.length} record(s)</span>
                </footer>
              </div>
            </div>
          </main>
        </div>

        {/* Drawer */}
        <Drawer
          title={
            <div className="rp-drawer-title">
              <EyeOutlined className="rp-drawer-icon" />
              <span>Transaction Details</span>
            </div>
          }
          width={580}
          open={Boolean(drawerRecord)}
          onClose={() => setDrawerRecord(null)}
          className="rp-premium-drawer"
          closeIcon={<span className="rp-drawer-close">×</span>}
        >
          {drawerRecord && (
            <>
              <Descriptions bordered column={1} size="small" className="rp-drawer-descriptions">
                {activeReport.fields.map((field) => {
                  const meta = COLUMN_META[field] || { label: humanize(field) };
                  const value = drawerRecord[field];
                  let display = value;
                  if (meta.type === 'currency') display = formatCurrency(value);
                  else if (meta.type === 'number') display = formatNumber(value);
                  else if (meta.type === 'percent') display = `${formatNumber(value)}%`;
                  else if (meta.type === 'date') display = formatDate(value);
                  else if (meta.type === 'status') display = <Tag color={statusColor(value)} className="rp-status-tag">{humanize(value)}</Tag>;
                  return (
                    <Descriptions.Item key={field} label={meta.label} className="rp-drawer-item">
                      {display || display === 0 ? display : '—'}
                    </Descriptions.Item>
                  );
                })}
              </Descriptions>
              <Card size="small" className="rp-raw-card">
                <div className="rp-raw-header">
                  <DatabaseOutlined /> Raw Data
                </div>
                <pre className="rp-raw-pre">{JSON.stringify(drawerRecord.raw || drawerRecord, null, 2)}</pre>
              </Card>
            </>
          )}
        </Drawer>

        {/* Email Modal */}
        <Modal
          title={
            <div className="rp-modal-title">
              <SendOutlined className="rp-modal-icon" />
              <span>Email Report</span>
            </div>
          }
          open={emailOpen}
          onOk={handleEmail}
          okText="Send Email"
          onCancel={() => setEmailOpen(false)}
          className="rp-premium-modal"
          okButtonProps={{ className: 'rp-modal-ok-btn' }}
        >
          <Paragraph className="rp-email-help">
            This opens your email application with the report summary included.
          </Paragraph>
          <label className="rp-modal-label">Recipient Email</label>
          <Input
            type="email"
            placeholder="recipient@example.com"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            onPressEnter={handleEmail}
            prefix={<MailOutlined className="rp-email-icon" />}
            className="rp-email-input"
          />
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default ReportsAnalyticsPage;