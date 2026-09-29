// src/features/inventory/pages/ApprovedRequests.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, ConfigProvider, Empty, Input, Modal, Spin, Tag, Typography,
  theme as antdTheme, message,
} from 'antd';
import {
  EditOutlined, FileTextOutlined, LeftOutlined, PrinterOutlined, RightOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePurchaseRequests } from '../../../hooks/useInventoryQueries';

const { Title, Text } = Typography;

const STORAGE_KEY = 'inventory.approvedRequestFileNames';

const readFileNames = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeFileNames = (map) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

// ============================================================
// PRINT HELPER
// ============================================================
const printRequestFile = (file) => {
  const rows = file.requests.map((r) => `
    <div class="req">
      <h3>Request ID: ${r.pr_number}</h3>
      <p><strong>Requested By:</strong> ${r.requested_by || '—'}</p>
      <p><strong>Date:</strong> ${r.created_at ? dayjs(r.created_at).format('MMMM D, YYYY') : '—'}</p>
      <p><strong>Status:</strong> ${r.status}</p>
      <p><strong>Items:</strong></p>
      <table>
        <tr><th>Item</th><th>Qty</th></tr>
        <tr><td>${r.ingredient_name || '—'}</td><td>${r.quantity} ${r.unit || ''}</td></tr>
      </table>
      ${r.notes ? `<p><em>Notes: ${r.notes}</em></p>` : ''}
    </div>
    <hr/>
  `).join('');

  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <title>${file.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1a2c3e; }
          h1 { text-align: center; margin-bottom: 8px; }
          h2 { text-align: center; color: #1a7ab5; margin-top: 0; }
          .req { margin: 24px 0; }
          table { border-collapse: collapse; margin: 8px 0; }
          td, th { padding: 6px 16px; border-bottom: 1px solid #eee; text-align: left; }
          hr { border: none; border-top: 1px dashed #ccc; margin: 24px 0; }
        </style>
      </head>
      <body>
        <h1>DEAR BAB'S CATERING MANAGEMENT SYSTEM</h1>
        <h2>${file.name.toUpperCase()}</h2>
        <hr/>
        ${rows}
      </body>
    </html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const ApprovedRequests = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [newName, setNewName] = useState('');
  const [customNames, setCustomNames] = useState(readFileNames);
  const [page, setPage] = useState(1);

  const approvedQuery = usePurchaseRequests({
    status: 'approved',
    per_page: 500,
    page,
  });

  useEffect(() => {
    const detect = () => setIsDarkMode(document.body.classList.contains('dark-mode'));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const rows = approvedQuery.data?.data || [];

  // ⭐ Group all approved requests by their created date.
  const files = useMemo(() => {
    const grouped = rows.reduce((acc, row) => {
      const date = row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD') : 'unknown';
      if (!acc[date]) acc[date] = [];
      acc[date].push(row);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([date, requests]) => {
        const defaultName = date === 'unknown'
          ? 'Unknown Date Request'
          : `${dayjs(date).format('MMMM D, YYYY')} Request`;
        return {
          date,
          name: customNames[date] || defaultName,
          requestCount: requests.length,
          totalQuantity: requests.reduce((s, r) => s + Number(r.quantity || 0), 0),
          requests,
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  }, [rows, customNames]);

  const handleRename = () => {
    if (!newName.trim()) {
      message.warning('Please enter a file name');
      return;
    }
    const next = { ...customNames, [editingFile.date]: newName.trim() };
    writeFileNames(next);
    setCustomNames(next);
    message.success('Request file renamed successfully');
    setEditingFile(null);
    setNewName('');
  };

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
      }}
    >
      <div className={`ar-container ${isDarkMode ? 'ar-dark-mode' : ''}`} style={{ padding: 24 }}>
        {/* ==================== HEADER ==================== */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, background: '#e6f0fa',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileTextOutlined style={{ fontSize: 26, color: '#1a7ab5' }} />
          </div>
          <div>
            <Title level={3} style={{ margin: 0 }}>Approved Requests</Title>
            <Text type="secondary">Grouped by date — open, rename, or print any file</Text>
          </div>
        </div>

        <Spin spinning={approvedQuery.isLoading}>
          {files.length === 0 && !approvedQuery.isLoading ? (
            <Card variant="borderless">
              <Empty description="No approved requests yet" />
            </Card>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
            }}>
              {files.map((file) => (
                <Card
                  key={file.date}
                  variant="borderless"
                  hoverable
                  style={{ borderRadius: 16, borderTop: '4px solid #1a7ab5' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <FileTextOutlined style={{ color: '#1a7ab5', fontSize: 20 }} />
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{file.name}</span>
                  </div>

                  <div style={{ color: '#5a6e7c', fontSize: 13, marginBottom: 12 }}>
                    <Tag color="blue">{file.requestCount} request{file.requestCount !== 1 ? 's' : ''}</Tag>
                    <Tag color="green">{file.totalQuantity.toLocaleString()} total qty</Tag>
                  </div>

                  <div style={{
                    maxHeight: 140, overflowY: 'auto',
                    background: '#f8fafc', borderRadius: 8, padding: 8, marginBottom: 12,
                  }}>
                    {file.requests.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '4px 6px', fontSize: 12, borderBottom: '1px solid #eef2f8',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{r.pr_number}</span>
                        <span style={{ color: '#5a6e7c' }}>
                          {r.ingredient_name} · {r.quantity} {r.unit}
                        </span>
                      </div>
                    ))}
                    {file.requests.length > 5 && (
                      <div style={{ fontSize: 12, color: '#8b93a8', textAlign: 'center', padding: 4 }}>
                        + {file.requests.length - 5} more
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => { setEditingFile(file); setNewName(file.name); }}
                      style={{ flex: 1 }}
                    >
                      Rename
                    </Button>
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      onClick={() => printRequestFile(file)}
                      style={{ flex: 1 }}
                    >
                      Print
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Spin>

        {/* ==================== RENAME MODAL ==================== */}
        <Modal
          title="Rename Request File"
          open={!!editingFile}
          onCancel={() => { setEditingFile(null); setNewName(''); }}
          onOk={handleRename}
          okText="Save Name"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. September 26, 2026 Purchase Request"
            size="large"
          />
        </Modal>
      </div>
    </ConfigProvider>
  );
};

const ApprovedRequestsWithApp = () => <App><ApprovedRequests /></App>;
export default ApprovedRequestsWithApp;