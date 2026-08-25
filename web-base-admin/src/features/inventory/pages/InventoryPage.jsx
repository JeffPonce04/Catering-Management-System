import React, { useMemo } from 'react';
import { Alert, Button, Card, Col, Empty, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import {
  AlertOutlined, AppstoreOutlined, BuildOutlined, CalendarOutlined, DatabaseOutlined,
  InboxOutlined, ReloadOutlined, ShopOutlined, ShoppingCartOutlined, SwapOutlined,
  ToolOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  useEquipment, useEquipmentReservations, useInventoryDashboardStats,
  useInventoryMovements, useMaintenanceRecords, useProducts, usePurchaseRequests,
  useSuppliers, useWasteRecords,
} from '../../../hooks/useInventoryQueries';
import '../styles/Inventory.css';

const { Text, Title } = Typography;

const MODULES = [
  { title: 'Ingredients', description: 'Products, types, status, and stock movements', icon: <InboxOutlined />, path: '/ingredientsManagement' },
  { title: 'Equipment', description: 'Equipment quantity, availability, and status', icon: <ToolOutlined />, path: '/equipmentManagement' },
  { title: 'Stock Levels', description: 'Live stock balances and reorder conditions', icon: <DatabaseOutlined />, path: '/stocklevels' },
  { title: 'Movements', description: 'Stock in, stock out, waste, reservations, and returns', icon: <SwapOutlined />, path: '/movements' },
  { title: 'Purchase Requests', description: 'Confirmed-order shortages and approval workflow', icon: <ShoppingCartOutlined />, path: '/purchaseRequests' },
  { title: 'Suppliers', description: 'Supplier details and activation status', icon: <ShopOutlined />, path: '/supplierManagement' },
  { title: 'Reservations', description: 'Currently reserved and checked-out equipment', icon: <CalendarOutlined />, path: '/reservationManagement' },
  { title: 'Maintenance', description: 'Live equipment maintenance records', icon: <BuildOutlined />, path: '/maintenanceManagement' },
  { title: 'Waste', description: 'Waste records synchronized with inventory movements', icon: <WarningOutlined />, path: '/wasteManagement' },
];

const InventoryPage = () => {
  const navigate = useNavigate();
  const dashboardQuery = useInventoryDashboardStats();
  const productsQuery = useProducts({ per_page: 500 });
  const equipmentQuery = useEquipment({ per_page: 500 });
  const movementsQuery = useInventoryMovements({ per_page: 12 });
  const requestsQuery = usePurchaseRequests({ per_page: 100 });
  const suppliersQuery = useSuppliers({ per_page: 500 });
  const reservationsQuery = useEquipmentReservations({ per_page: 500 });
  const maintenanceQuery = useMaintenanceRecords({ per_page: 100 });
  const wasteQuery = useWasteRecords({ per_page: 100 });

  const loading = dashboardQuery.isLoading || productsQuery.isLoading || equipmentQuery.isLoading;
  const hasError = [dashboardQuery, productsQuery, equipmentQuery, movementsQuery, requestsQuery, suppliersQuery, reservationsQuery, maintenanceQuery, wasteQuery].some((query) => query.isError);

  const products = productsQuery.data?.data || [];
  const equipment = equipmentQuery.data?.data || [];
  const movements = movementsQuery.data?.data || [];
  const requests = requestsQuery.data?.data || [];
  const reservations = reservationsQuery.data?.data || [];
  const maintenance = maintenanceQuery.data?.data || [];
  const waste = wasteQuery.data?.data || [];
  const dashboard = dashboardQuery.data || {};

  const lowStockRows = useMemo(() => products.filter((row) => {
    const current = Number(row.stock ?? row.current_stock ?? row.current_quantity ?? 0);
    const reorder = Number(row.reorder_point ?? row.min_stock ?? 0);
    return current <= reorder;
  }).slice(0, 8), [products]);

  const refreshAll = () => {
    dashboardQuery.refetch();
    productsQuery.refetch();
    equipmentQuery.refetch();
    movementsQuery.refetch();
    requestsQuery.refetch();
    suppliersQuery.refetch();
    reservationsQuery.refetch();
    maintenanceQuery.refetch();
    wasteQuery.refetch();
  };

  return <div className="inventory-container" style={{ overflowY: 'auto' }}>
    <div className="inventory-header">
      <div className="inventory-header-left">
        <div className="inventory-header-icon"><AppstoreOutlined /></div>
        <div className="inventory-header-title"><h1>Inventory Management</h1><p>Live operational overview</p></div>
      </div>
      <div className="inventory-header-actions"><Button icon={<ReloadOutlined />} loading={loading} onClick={refreshAll}>Refresh All</Button></div>
    </div>

    {hasError && <Alert type="warning" showIcon message="Some inventory data could not be loaded" description="The dashboard does not substitute mock records. Open the affected module or retry after confirming the Laravel API is running." style={{ marginBottom: 16 }} />}

    <Spin spinning={loading}>
      <Row gutter={[16, 16]} className="inventory-stats-grid" style={{ marginBottom: 20 }}>
        <Col xs={12} lg={6}><Card><Statistic title="Active Products" value={dashboard.products?.total_items ?? products.filter((row) => row.is_active).length} prefix={<InboxOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Low / Out of Stock" value={(dashboard.products?.low_stock || 0) + (dashboard.products?.out_of_stock || 0)} prefix={<AlertOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Equipment Available" value={dashboard.equipment?.available ?? equipment.reduce((sum, row) => sum + Number(row.available || row.available_quantity || 0), 0)} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Pending Purchase Requests" value={dashboard.purchase_requests ?? requests.filter((row) => row.status === 'pending').length} prefix={<ShoppingCartOutlined />} /></Card></Col>
      </Row>

      <Title level={4}>Inventory Modules</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {MODULES.map((module) => <Col xs={24} sm={12} lg={8} key={module.path}>
          <Card hoverable onClick={() => navigate(module.path)} style={{ height: '100%' }}>
            <Space align="start" size="middle"><span style={{ fontSize: 24 }}>{module.icon}</span><div><Text strong>{module.title}</Text><br /><Text type="secondary">{module.description}</Text></div></Space>
          </Card>
        </Col>)}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Low-Stock Products" extra={<Button type="link" onClick={() => navigate('/stocklevels')}>Open Stock Levels</Button>}>
            <Table size="small" pagination={false} rowKey="id" dataSource={lowStockRows} locale={{ emptyText: <Empty description="No low-stock products" /> }} columns={[
              { title: 'Product ID', render: (_, row) => row.display_id || row.product_id || `PRD-${String(row.id).padStart(3, '0')}` },
              { title: 'Product', render: (_, row) => row.product_name || row.name },
              { title: 'Stock', render: (_, row) => `${row.stock ?? row.current_stock ?? row.current_quantity ?? 0} ${row.unit || ''}` },
              { title: 'Status', render: (_, row) => <Tag color={Number(row.stock ?? row.current_stock ?? 0) <= 0 ? 'error' : 'warning'}>{Number(row.stock ?? row.current_stock ?? 0) <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'}</Tag> },
            ]} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Recent Movements" extra={<Button type="link" onClick={() => navigate('/movements')}>Open Movements</Button>}>
            <Table size="small" pagination={false} rowKey="id" dataSource={movements.slice(0, 8)} locale={{ emptyText: <Empty description="No movements recorded" /> }} columns={[
              { title: 'Item', dataIndex: 'item_name' },
              { title: 'Type', dataIndex: 'movement_type', render: (value) => <Tag>{String(value || '').replaceAll('_', ' ').toUpperCase()}</Tag> },
              { title: 'Quantity', render: (_, row) => `${row.quantity_change ?? row.quantity ?? 0} ${row.unit || ''}` },
              { title: 'Updated By', dataIndex: 'updated_by' },
            ]} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Active Suppliers" value={(suppliersQuery.data?.data || []).filter((row) => row.active).length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Current Reservations" value={reservations.length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Open Maintenance" value={maintenance.filter((row) => !['completed', 'cancelled'].includes(row.status)).length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Waste Records" value={wasteQuery.data?.total ?? waste.length} /></Card></Col>
      </Row>
    </Spin>
  </div>;
};

export default InventoryPage;
