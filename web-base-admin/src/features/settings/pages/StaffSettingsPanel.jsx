// src/components/settings/StaffSettingsPanel.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Card, Button, Space, Input, Select, Modal, Tag, message, Row, Col, Alert,
    Form, Switch, InputNumber, Collapse, Spin, Divider, Table, Tooltip, Typography,
    DatePicker, Popconfirm, Empty, Badge
} from 'antd';
import {
    SaveOutlined, ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
    TeamOutlined, DollarOutlined, ClockCircleOutlined, CalendarOutlined,
    FieldTimeOutlined, IdcardOutlined, ApartmentOutlined, SafetyCertificateOutlined,
    BookOutlined, CalculatorOutlined, CheckCircleOutlined, CloseCircleOutlined,
    MinusCircleOutlined
} from '@ant-design/icons';
import {
    useStaffSnapshot,
    useUpdateStaffGroup,
} from '../../../hooks/useSettingsQueries';
import {
    salaryGradeAPI,
    departmentAPI,
    positionAPI,
} from '../../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

/* ============================================================
 *  Small wrapper so we can reuse the Collapse/SettingsPanel pattern
 * ============================================================ */
const SettingsPanel = ({ children }) => children;

/* ============================================================
 *  Reusable group editor shell
 * ============================================================ */
const StaffGroupShell = ({ title, icon, description, onSave, saving, children }) => (
    <Card variant="borderless">
        <div className="settings-section-header">
            <div>
                <div className="settings-section-title">{icon} {title}</div>
                {description && <div className="settings-section-count">{description}</div>}
            </div>
            <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={onSave}
            >
                Save
            </Button>
        </div>
        {children}
    </Card>
);

/* ============================================================
 *  1. SALARY GRADES  — existing salary_grades API
 * ============================================================ */
const SalaryGradesTab = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const load = async () => {
        setLoading(true);
        try {
            const res = await salaryGradeAPI.getAll({ all: true });
            setItems(res?.data?.data || []);
        } catch (e) {
            message.error('Failed to load salary grades');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return items;
        return items.filter((r) =>
            (r.grade_name || '').toLowerCase().includes(q) ||
            (r.grade_code || '').toLowerCase().includes(q)
        );
    }, [items, search]);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            min_hourly_rate: 0,
            max_hourly_rate: 0,
            default_hourly_rate: 0,
            is_active: true,
        });
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        form.setFieldsValue({
            grade_name: row.grade_name,
            grade_code: row.grade_code,
            min_hourly_rate: row.min_hourly_rate,
            max_hourly_rate: row.max_hourly_rate,
            default_hourly_rate: row.default_hourly_rate,
            description: row.description,
            is_active: row.is_active,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            if (editing) {
                await salaryGradeAPI.update(editing.salary_grade_id, values);
                message.success('Salary grade updated');
            } else {
                await salaryGradeAPI.create(values);
                message.success('Salary grade created');
            }
            setModalOpen(false);
            load();
        } catch (e) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || 'Failed to save salary grade');
        }
    };

    const handleDelete = async (row) => {
        try {
            await salaryGradeAPI.delete(row.salary_grade_id);
            message.success('Salary grade deleted');
            load();
        } catch (e) {
            message.error(e?.response?.data?.message || 'Failed to delete');
        }
    };

    const columns = [
        { title: 'Code', dataIndex: 'grade_code', key: 'grade_code', width: 140 },
        { title: 'Name', dataIndex: 'grade_name', key: 'grade_name', width: 220 },
        {
            title: 'Hourly Rate', dataIndex: 'default_hourly_rate', key: 'default_hourly_rate', width: 140,
            render: (v) => `₱${Number(v || 0).toFixed(2)}`,
        },
        {
            title: 'Min / Max', key: 'range', width: 200,
            render: (_, r) =>
                `₱${Number(r.min_hourly_rate || 0).toFixed(2)} – ₱${Number(r.max_hourly_rate || 0).toFixed(2)}`,
        },
        { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
        {
            title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 120, align: 'center',
            render: (v) => v
                ? <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
                : <Tag color="red" icon={<CloseCircleOutlined />}>Inactive</Tag>,
        },
        {
            title: 'Actions', key: 'actions', width: 130, fixed: 'right', align: 'center',
            render: (_, row) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                    </Tooltip>
                    <Popconfirm
                        title={`Delete salary grade "${row.grade_name}"?`}
                        okType="danger"
                        onConfirm={() => handleDelete(row)}
                    >
                        <Tooltip title="Delete">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card variant="borderless">
            <div className="settings-section-header">
                <div>
                    <div className="settings-section-title"><DollarOutlined /> Salary Grades</div>
                    <div className="settings-section-count">{items.length} grade(s) configured</div>
                </div>
                <Space>
                    <Input.Search
                        placeholder="Search by name or code"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 260 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Salary Grade</Button>
                </Space>
            </div>

            <Alert
                message="Hourly rates are the source of truth for payroll."
                description="Daily rate and monthly salary can be derived from the hourly rate (8 hours/day, 22 working days/month)."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Table
                rowKey="salary_grade_id"
                columns={columns}
                dataSource={filtered}
                loading={loading}
                scroll={{ x: 1200 }}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                locale={{
                    emptyText: <Empty description="No salary grades yet" />
                }}
            />

            <Modal
                title={editing ? 'Edit Salary Grade' : 'New Salary Grade'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText="Save"
                destroyOnHidden
                width={640}
            >
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="grade_code"
                                label="Grade Code"
                                rules={[{ required: true, message: 'Code is required' }]}
                            >
                                <Input placeholder="e.g., GRADE-A" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="grade_name"
                                label="Grade Name"
                                rules={[{ required: true, message: 'Name is required' }]}
                            >
                                <Input placeholder="e.g., Grade A" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="min_hourly_rate" label="Min Hourly Rate (₱)">
                                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="default_hourly_rate" label="Hourly Rate (₱)">
                                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="max_hourly_rate" label="Max Hourly Rate (₱)">
                                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="is_active" label="Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

/* ============================================================
 *  2. DEPARTMENTS  — existing departments API
 * ============================================================ */
const DepartmentsTab = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const load = async () => {
        setLoading(true);
        try {
            const res = await departmentAPI.getAll({ all: true });
            setItems(res?.data?.data || []);
        } catch (e) {
            message.error('Failed to load departments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return items;
        return items.filter((r) =>
            (r.name || '').toLowerCase().includes(q) ||
            (r.code || '').toLowerCase().includes(q)
        );
    }, [items, search]);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ status: 'active' });
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        form.setFieldsValue({
            name: row.name,
            code: row.code,
            description: row.description,
            status: row.is_active ? 'active' : 'inactive',
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            if (editing) {
                await departmentAPI.update(editing.department_id, values);
                message.success('Department updated');
            } else {
                await departmentAPI.create(values);
                message.success('Department created');
            }
            setModalOpen(false);
            load();
        } catch (e) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || 'Failed to save department');
        }
    };

    const handleDelete = async (row) => {
        try {
            await departmentAPI.delete(row.department_id);
            message.success('Department deleted');
            load();
        } catch (e) {
            message.error(e?.response?.data?.message || 'Failed to delete');
        }
    };

    const columns = [
        { title: 'Code', dataIndex: 'code', key: 'code', width: 140 },
        { title: 'Name', dataIndex: 'name', key: 'name', width: 220 },
        { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
        {
            title: 'Employees', dataIndex: 'employees_count', key: 'employees_count', width: 120, align: 'center',
            render: (v) => v ?? 0,
        },
        {
            title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 120, align: 'center',
            render: (v) => v
                ? <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
                : <Tag color="red" icon={<CloseCircleOutlined />}>Inactive</Tag>,
        },
        {
            title: 'Actions', key: 'actions', width: 130, fixed: 'right', align: 'center',
            render: (_, row) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                    </Tooltip>
                    <Popconfirm
                        title={`Delete department "${row.name}"?`}
                        okType="danger"
                        onConfirm={() => handleDelete(row)}
                    >
                        <Tooltip title="Delete">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card variant="borderless">
            <div className="settings-section-header">
                <div>
                    <div className="settings-section-title"><ApartmentOutlined /> Departments</div>
                    <div className="settings-section-count">{items.length} department(s)</div>
                </div>
                <Space>
                    <Input.Search
                        placeholder="Search by name or code"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 260 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Department</Button>
                </Space>
            </div>

            <Table
                rowKey="department_id"
                columns={columns}
                dataSource={filtered}
                loading={loading}
                scroll={{ x: 1000 }}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                locale={{ emptyText: <Empty description="No departments yet" /> }}
            />

            <Modal
                title={editing ? 'Edit Department' : 'New Department'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText="Save"
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="name"
                        label="Department Name"
                        rules={[{ required: true, message: 'Name is required' }]}
                    >
                        <Input placeholder="e.g., Kitchen" />
                    </Form.Item>
                    <Form.Item name="code" label="Department Code">
                        <Input placeholder="e.g., KIT" />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="status" label="Status">
                        <Select>
                            <Option value="active">Active</Option>
                            <Option value="inactive">Inactive</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

/* ============================================================
 *  3. POSITIONS  — existing positions API
 * ============================================================ */
const PositionsTab = () => {
    const [items, setItems] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [salaryGrades, setSalaryGrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();

    const load = async () => {
        setLoading(true);
        try {
            const [pos, deps, grades] = await Promise.all([
                positionAPI.getAll({ all: true }),
                departmentAPI.getAll({ all: true }),
                salaryGradeAPI.getAll({ all: true }),
            ]);
            setItems(pos?.data?.data || []);
            setDepartments(deps?.data?.data || []);
            setSalaryGrades(grades?.data?.data || []);
        } catch (e) {
            message.error('Failed to load positions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return items;
        return items.filter((r) =>
            (r.title || '').toLowerCase().includes(q) ||
            (r.code || '').toLowerCase().includes(q)
        );
    }, [items, search]);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ status: 'active' });
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        form.setFieldsValue({
            title: row.title,
            code: row.code,
            department_id: row.department_id,
            salary_grade_id: row.salary_grade_id,
            description: row.description,
            status: row.is_active ? 'active' : 'inactive',
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            if (editing) {
                await positionAPI.update(editing.position_id, values);
                message.success('Position updated');
            } else {
                await positionAPI.create(values);
                message.success('Position created');
            }
            setModalOpen(false);
            load();
        } catch (e) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || 'Failed to save position');
        }
    };

    const handleDelete = async (row) => {
        try {
            await positionAPI.delete(row.position_id);
            message.success('Position deleted');
            load();
        } catch (e) {
            message.error(e?.response?.data?.message || 'Failed to delete');
        }
    };

    const columns = [
        { title: 'Code', dataIndex: 'code', key: 'code', width: 140 },
        { title: 'Position', dataIndex: 'title', key: 'title', width: 220 },
        {
            title: 'Department', key: 'department', width: 180,
            render: (_, r) => r.department?.name || '—',
        },
        {
            title: 'Salary Grade', key: 'salary_grade', width: 160,
            render: (_, r) => r.salary_grade?.grade_name || '—',
        },
        {
            title: 'Hourly Rate', key: 'hourly', width: 130,
            render: (_, r) => `₱${Number(r.salary_grade?.default_hourly_rate || 0).toFixed(2)}`,
        },
        {
            title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 120, align: 'center',
            render: (v) => v
                ? <Tag color="green">Active</Tag>
                : <Tag color="red">Inactive</Tag>,
        },
        {
            title: 'Actions', key: 'actions', width: 130, fixed: 'right', align: 'center',
            render: (_, row) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                    </Tooltip>
                    <Popconfirm
                        title={`Delete position "${row.title}"?`}
                        okType="danger"
                        onConfirm={() => handleDelete(row)}
                    >
                        <Tooltip title="Delete">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card variant="borderless">
            <div className="settings-section-header">
                <div>
                    <div className="settings-section-title"><IdcardOutlined /> Positions</div>
                    <div className="settings-section-count">{items.length} position(s)</div>
                </div>
                <Space>
                    <Input.Search
                        placeholder="Search by title or code"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 260 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Position</Button>
                </Space>
            </div>

            <Table
                rowKey="position_id"
                columns={columns}
                dataSource={filtered}
                loading={loading}
                scroll={{ x: 1100 }}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                locale={{ emptyText: <Empty description="No positions yet" /> }}
            />

            <Modal
                title={editing ? 'Edit Position' : 'New Position'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText="Save"
                destroyOnHidden
                width={640}
            >
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="title"
                                label="Position Title"
                                rules={[{ required: true, message: 'Title is required' }]}
                            >
                                <Input placeholder="e.g., Chef" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="code" label="Position Code">
                                <Input placeholder="e.g., CHEF" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="department_id"
                                label="Department"
                                rules={[{ required: true, message: 'Department is required' }]}
                            >
                                <Select placeholder="Select department">
                                    {departments.map((d) => (
                                        <Option key={d.department_id} value={d.department_id}>{d.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="salary_grade_id"
                                label="Salary Grade"
                                rules={[{ required: true, message: 'Salary grade is required' }]}
                            >
                                <Select placeholder="Select salary grade">
                                    {salaryGrades.map((g) => (
                                        <Option key={g.salary_grade_id} value={g.salary_grade_id}>
                                            {g.grade_name} (₱{Number(g.default_hourly_rate || 0).toFixed(2)}/hr)
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="status" label="Status">
                        <Select>
                            <Option value="active">Active</Option>
                            <Option value="inactive">Inactive</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

/* ============================================================
 *  4. SALARY TYPES  (settings group staff_salary_types)
 * ============================================================ */
const SalaryTypesTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);

    const update = (key, field, value) => {
        setLocal((prev) => ({
            ...prev,
            [key]: { ...(prev[key] || {}), [field]: value },
        }));
    };

    const updateRule = (key, ruleName, value) => {
        setLocal((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                rules: { ...(prev[key]?.rules || {}), [ruleName]: value },
            },
        }));
    };

    return (
        <StaffGroupShell
            title="Salary Types"
            icon={<DollarOutlined />}
            description="Fixed vs. Hourly — controls whether OT / undertime / late auto-adjust payroll."
            onSave={() => onSave('staff_salary_types', local)}
            saving={saving}
        >
            <Alert
                message="Fixed Salary Rule"
                description="For Fixed Salary employees, overtime / undertime / late are recorded for monitoring but do NOT modify the base salary. Hourly / Computed employees have pay derived from actual hours."
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Row gutter={[16, 16]}>
                {Object.keys(local).map((key) => {
                    const item = local[key] || {};
                    return (
                        <Col xs={24} lg={12} key={key}>
                            <Card
                                size="small"
                                title={
                                    <Space>
                                        {item.name || key}
                                        {item.is_active
                                            ? <Tag color="green">Active</Tag>
                                            : <Tag>Inactive</Tag>}
                                    </Space>
                                }
                            >
                                <Form layout="vertical">
                                    <Form.Item label="Name">
                                        <Input
                                            value={item.name}
                                            onChange={(e) => update(key, 'name', e.target.value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Description">
                                        <Input.TextArea
                                            rows={2}
                                            value={item.description}
                                            onChange={(e) => update(key, 'description', e.target.value)}
                                        />
                                    </Form.Item>
                                    <Divider style={{ margin: '12px 0' }}>Payroll Adjustment Rules</Divider>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <div>
                                            <Switch
                                                checked={!!item.rules?.auto_adjust_overtime}
                                                onChange={(v) => updateRule(key, 'auto_adjust_overtime', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Auto-adjust for approved overtime</span>
                                        </div>
                                        <div>
                                            <Switch
                                                checked={!!item.rules?.auto_adjust_undertime}
                                                onChange={(v) => updateRule(key, 'auto_adjust_undertime', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Auto-adjust for undertime</span>
                                        </div>
                                        <div>
                                            <Switch
                                                checked={!!item.rules?.auto_adjust_late}
                                                onChange={(v) => updateRule(key, 'auto_adjust_late', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Auto-adjust for late</span>
                                        </div>
                                        <div>
                                            <Switch
                                                checked={!!item.rules?.require_time_in_out}
                                                onChange={(v) => updateRule(key, 'require_time_in_out', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Require Time In / Time Out</span>
                                        </div>
                                        <div>
                                            <Switch
                                                checked={!!item.is_active}
                                                onChange={(v) => update(key, 'is_active', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Active</span>
                                        </div>
                                    </Space>
                                </Form>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 *  5. EMPLOYEE TYPES  (staff_employee_types)
 * ============================================================ */
const EmployeeTypesTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);

    const update = (key, field, value) =>
        setLocal((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));

    const addType = () => {
        const code = `type_${Date.now()}`;
        setLocal((prev) => ({
            ...prev,
            [code]: { code, name: 'New Type', description: '', is_active: true },
        }));
    };

    const removeType = (key) => {
        setLocal((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    return (
        <StaffGroupShell
            title="Employee Types"
            icon={<TeamOutlined />}
            description="Regular, Probationary, On-Call, Contract."
            onSave={() => onSave('staff_employee_types', local)}
            saving={saving}
        >
            <div style={{ marginBottom: 16 }}>
                <Button icon={<PlusOutlined />} onClick={addType}>Add Employee Type</Button>
            </div>

            <Row gutter={[16, 16]}>
                {Object.keys(local).map((key) => {
                    const item = local[key] || {};
                    return (
                        <Col xs={24} lg={12} key={key}>
                            <Card
                                size="small"
                                title={
                                    <Space>
                                        {item.name || key}
                                        {item.is_active
                                            ? <Tag color="green">Active</Tag>
                                            : <Tag>Inactive</Tag>}
                                    </Space>
                                }
                                extra={
                                    <Popconfirm
                                        title="Remove this employee type?"
                                        okType="danger"
                                        onConfirm={() => removeType(key)}
                                    >
                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                }
                            >
                                <Form layout="vertical">
                                    <Form.Item label="Code">
                                        <Input
                                            value={item.code}
                                            onChange={(e) => update(key, 'code', e.target.value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Name">
                                        <Input
                                            value={item.name}
                                            onChange={(e) => update(key, 'name', e.target.value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Description">
                                        <Input.TextArea
                                            rows={2}
                                            value={item.description}
                                            onChange={(e) => update(key, 'description', e.target.value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Active" valuePropName="checked">
                                        <Switch
                                            checked={!!item.is_active}
                                            onChange={(v) => update(key, 'is_active', v)}
                                        />
                                    </Form.Item>
                                </Form>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 *  6. WORKING HOURS
 * ============================================================ */
const WorkingHoursTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);

    const setField = (key, value) => setLocal((prev) => ({ ...prev, [key]: value }));

    const fields = [
        { key: 'standard_hours_per_day', label: 'Standard Hours Per Day', suffix: 'hrs', min: 1, max: 24, step: 0.5 },
        { key: 'standard_working_days', label: 'Standard Working Days / Month', suffix: 'days', min: 1, max: 31, step: 1 },
        { key: 'break_minutes', label: 'Break Duration', suffix: 'min', min: 0, max: 240, step: 5 },
        { key: 'grace_period_minutes', label: 'Grace Period', suffix: 'min', min: 0, max: 60, step: 1 },
        { key: 'min_working_hours', label: 'Minimum Working Hours', suffix: 'hrs', min: 0, max: 24, step: 0.5 },
        { key: 'max_working_hours', label: 'Maximum Working Hours', suffix: 'hrs', min: 1, max: 24, step: 0.5 },
    ];

    return (
        <StaffGroupShell
            title="Working Hours"
            icon={<ClockCircleOutlined />}
            description="Standard day / week structure used by scheduling and payroll."
            onSave={() => onSave('staff_working_hours', local)}
            saving={saving}
        >
            <Row gutter={[16, 16]}>
                {fields.map((f) => (
                    <Col xs={24} sm={12} lg={8} key={f.key}>
                        <div className="settings-config-card">
                            <div className="settings-config-label">{f.label}</div>
                            <InputNumber
                                min={f.min}
                                max={f.max}
                                step={f.step}
                                style={{ width: '100%', marginTop: 8 }}
                                addonAfter={f.suffix}
                                value={local[f.key]}
                                onChange={(v) => setField(f.key, v)}
                            />
                        </div>
                    </Col>
                ))}
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 *  7. OVERTIME SETTINGS
 * ============================================================ */
const OvertimeTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);

    const setField = (key, value) => setLocal((prev) => ({ ...prev, [key]: value }));

    return (
        <StaffGroupShell
            title="Overtime Settings"
            icon={<FieldTimeOutlined />}
            description="Effective-dated overtime rates. Historical payroll is preserved."
            onSave={() => onSave('staff_overtime', local)}
            saving={saving}
        >
            <Alert
                message="Effective-Date Rule"
                description="Saving a new Effective From will automatically close the previous rate. Historical payroll keeps the rate that was effective on the cutoff end date."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Regular Working Day OT Rate</div>
                        <InputNumber
                            min={1} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.regular_day_rate}
                            onChange={(v) => setField('regular_day_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Rest Day OT Rate</div>
                        <InputNumber
                            min={1} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.rest_day_rate}
                            onChange={(v) => setField('rest_day_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Special Holiday OT Rate</div>
                        <InputNumber
                            min={1} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.special_holiday_rate}
                            onChange={(v) => setField('special_holiday_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Regular Holiday OT Rate</div>
                        <InputNumber
                            min={1} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.regular_holiday_rate}
                            onChange={(v) => setField('regular_holiday_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Minimum OT</div>
                        <InputNumber
                            min={0} step={5} suffix="min"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.min_minutes}
                            onChange={(v) => setField('min_minutes', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Maximum OT</div>
                        <InputNumber
                            min={0} step={0.5} suffix="hrs"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.max_hours}
                            onChange={(v) => setField('max_hours', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Requires Approval</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.requires_approval}
                            onChange={(v) => setField('requires_approval', v)}
                            checkedChildren="Yes" unCheckedChildren="No"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Effective From</div>
                        <DatePicker
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.effective_from ? dayjs(local.effective_from) : null}
                            onChange={(d) => setField('effective_from', d ? d.format('YYYY-MM-DD') : null)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Effective Until</div>
                        <DatePicker
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.effective_until ? dayjs(local.effective_until) : null}
                            onChange={(d) => setField('effective_until', d ? d.format('YYYY-MM-DD') : null)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Active</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.is_active}
                            onChange={(v) => setField('is_active', v)}
                            checkedChildren="Active" unCheckedChildren="Inactive"
                        />
                    </div>
                </Col>
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 *  8. UNDERTIME SETTINGS
 * ============================================================ */
const UndertimeTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);
    const setField = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

    return (
        <StaffGroupShell
            title="Undertime Settings"
            icon={<ClockCircleOutlined />}
            description="Controls whether undertime affects payroll. Disabled for Fixed Salary employees."
            onSave={() => onSave('staff_undertime', local)}
            saving={saving}
        >
            <Alert
                message="Fixed Salary Protection"
                description="When 'Disabled for Fixed Salary' is ON, undertime is still recorded but never deducted from a Fixed Salary employee's pay."
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
            />
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Undertime Enabled</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.enabled}
                            onChange={(v) => setField('enabled', v)}
                            checkedChildren="Yes" unCheckedChildren="No"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Deduction Rate</div>
                        <InputNumber
                            min={0} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.deduction_rate}
                            onChange={(v) => setField('deduction_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Minimum Undertime</div>
                        <InputNumber
                            min={0} step={5} suffix="min"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.min_minutes}
                            onChange={(v) => setField('min_minutes', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Requires Approval</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.requires_approval}
                            onChange={(v) => setField('requires_approval', v)}
                            checkedChildren="Yes" unCheckedChildren="No"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Disabled for Fixed Salary</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.disabled_for_fixed_salary}
                            onChange={(v) => setField('disabled_for_fixed_salary', v)}
                            checkedChildren="Yes" unCheckedChildren="No"
                        />
                    </div>
                </Col>
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 *  9. LATE ATTENDANCE SETTINGS
 * ============================================================ */
const LateAttendanceTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);
    const setField = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

    return (
        <StaffGroupShell
            title="Late Attendance Settings"
            icon={<ClockCircleOutlined />}
            description="Late is always recorded. Deduction is disabled for Fixed Salary employees."
            onSave={() => onSave('staff_late_attendance', local)}
            saving={saving}
        >
            <Alert
                message="Fixed Salary Protection"
                description="When 'Disabled for Fixed Salary' is ON, late attendance is still visible in reports but never deducted from a Fixed Salary employee's pay."
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
            />
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Grace Period</div>
                        <InputNumber
                            min={0} max={120} suffix="min"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.grace_period_minutes}
                            onChange={(v) => setField('grace_period_minutes', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Late Threshold</div>
                        <InputNumber
                            min={1} suffix="min"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.late_threshold_minutes}
                            onChange={(v) => setField('late_threshold_minutes', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Late Deduction Enabled</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.deduction_enabled}
                            onChange={(v) => setField('deduction_enabled', v)}
                            checkedChildren="Yes" unCheckedChildren="No"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Minimum Late</div>
                        <InputNumber
                            min={1} suffix="min"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.min_late_minutes}
                            onChange={(v) => setField('min_late_minutes', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Requires Approval</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.requires_approval}
                            onChange={(v) => setField('requires_approval', v)}
                            checkedChildren="Yes" unCheckedChildren="No"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Disabled for Fixed Salary</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.disabled_for_fixed_salary}
                            onChange={(v) => setField('disabled_for_fixed_salary', v)}
                            checkedChildren="Yes" unCheckedChildren="No"
                        />
                    </div>
                </Col>
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 * 10. HOLIDAY & REST DAY RATES
 * ============================================================ */
const HolidayRatesTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);
    const setField = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

    return (
        <StaffGroupShell
            title="Holiday & Rest Day Rates"
            icon={<CalendarOutlined />}
            description="Effective-dated multipliers used when a schedule lands on a rest day or holiday."
            onSave={() => onSave('staff_holiday_rates', local)}
            saving={saving}
        >
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Special Holiday Rate</div>
                        <InputNumber
                            min={1} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.special_holiday_rate}
                            onChange={(v) => setField('special_holiday_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Regular Holiday Rate</div>
                        <InputNumber
                            min={1} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.regular_holiday_rate}
                            onChange={(v) => setField('regular_holiday_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Rest Day Rate</div>
                        <InputNumber
                            min={1} step={0.05} suffix="x"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.rest_day_rate}
                            onChange={(v) => setField('rest_day_rate', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Effective From</div>
                        <DatePicker
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.effective_from ? dayjs(local.effective_from) : null}
                            onChange={(d) => setField('effective_from', d ? d.format('YYYY-MM-DD') : null)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Active</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.is_active}
                            onChange={(v) => setField('is_active', v)}
                            checkedChildren="Active" unCheckedChildren="Inactive"
                        />
                    </div>
                </Col>
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 * 11. LEAVE TYPES
 * ============================================================ */
const LeaveTypesTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);

    const update = (key, field, value) =>
        setLocal((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));

    const addType = () => {
        const code = `leave_${Date.now()}`;
        setLocal((prev) => ({
            ...prev,
            [code]: {
                code,
                name: 'New Leave Type',
                max_days_per_year: 0,
                requires_approval: true,
                is_paid: false,
                is_active: true,
            },
        }));
    };

    const removeType = (key) => {
        setLocal((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    return (
        <StaffGroupShell
            title="Leave Types"
            icon={<BookOutlined />}
            description="Configure vacation, sick, emergency, and custom leave types."
            onSave={() => onSave('staff_leave_types', local)}
            saving={saving}
        >
            <div style={{ marginBottom: 16 }}>
                <Button icon={<PlusOutlined />} onClick={addType}>Add Leave Type</Button>
            </div>

            <Row gutter={[16, 16]}>
                {Object.keys(local).map((key) => {
                    const item = local[key] || {};
                    return (
                        <Col xs={24} lg={12} key={key}>
                            <Card
                                size="small"
                                title={
                                    <Space>
                                        {item.name || key}
                                        {item.is_paid ? <Tag color="gold">Paid</Tag> : <Tag>Unpaid</Tag>}
                                        {item.is_active ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>}
                                    </Space>
                                }
                                extra={
                                    <Popconfirm
                                        title="Remove this leave type?"
                                        okType="danger"
                                        onConfirm={() => removeType(key)}
                                    >
                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                }
                            >
                                <Form layout="vertical">
                                    <Form.Item label="Code">
                                        <Input
                                            value={item.code}
                                            onChange={(e) => update(key, 'code', e.target.value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Name">
                                        <Input
                                            value={item.name}
                                            onChange={(e) => update(key, 'name', e.target.value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Maximum Days Per Year">
                                        <InputNumber
                                            min={0}
                                            max={365}
                                            style={{ width: '100%' }}
                                            value={item.max_days_per_year}
                                            onChange={(v) => update(key, 'max_days_per_year', v)}
                                        />
                                    </Form.Item>
                                    <Space size="large">
                                        <div>
                                            <Switch
                                                checked={!!item.requires_approval}
                                                onChange={(v) => update(key, 'requires_approval', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Requires Approval</span>
                                        </div>
                                        <div>
                                            <Switch
                                                checked={!!item.is_paid}
                                                onChange={(v) => update(key, 'is_paid', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Paid</span>
                                        </div>
                                        <div>
                                            <Switch
                                                checked={!!item.is_active}
                                                onChange={(v) => update(key, 'is_active', v)}
                                            />
                                            <span style={{ marginLeft: 8 }}>Active</span>
                                        </div>
                                    </Space>
                                </Form>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 * 12. SCHEDULE SETTINGS
 * ============================================================ */
const ScheduleRulesTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);
    const setField = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

    return (
        <StaffGroupShell
            title="Schedule Settings"
            icon={<CalendarOutlined />}
            description="Warnings & checks used when creating or editing schedules."
            onSave={() => onSave('staff_schedule_rules', local)}
            saving={saving}
        >
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Max Working Hours / Day</div>
                        <InputNumber
                            min={1} max={24} step={0.5} suffix="hrs"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.max_working_hours_per_day}
                            onChange={(v) => setField('max_working_hours_per_day', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Max Working Days / Week</div>
                        <InputNumber
                            min={1} max={7} suffix="days"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.max_working_days_per_week}
                            onChange={(v) => setField('max_working_days_per_week', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Minimum Rest Period</div>
                        <InputNumber
                            min={0} max={72} suffix="hrs"
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.minimum_rest_hours}
                            onChange={(v) => setField('minimum_rest_hours', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Schedule Conflict Checking</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.check_schedule_conflict}
                            onChange={(v) => setField('check_schedule_conflict', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Leave Conflict Checking</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.check_leave_conflict}
                            onChange={(v) => setField('check_leave_conflict', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Existing Schedule Checking</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.check_existing_schedule}
                            onChange={(v) => setField('check_existing_schedule', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Overtime Schedule Checking</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.check_overtime_conflict}
                            onChange={(v) => setField('check_overtime_conflict', v)}
                        />
                    </div>
                </Col>
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 * 13. PAYROLL CUTOFF
 * ============================================================ */
const PayrollCutoffTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);
    const setField = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

    return (
        <StaffGroupShell
            title="Payroll Cutoff"
            icon={<CalculatorOutlined />}
            description="Defines the two payroll periods used by attendance and payroll processing."
            onSave={() => onSave('staff_payroll_cutoff', local)}
            saving={saving}
        >
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">First Cutoff Start Day</div>
                        <InputNumber
                            min={1} max={31}
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.first_cutoff_start}
                            onChange={(v) => setField('first_cutoff_start', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">First Cutoff End Day</div>
                        <InputNumber
                            min={1} max={31}
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.first_cutoff_end}
                            onChange={(v) => setField('first_cutoff_end', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Second Cutoff Start Day</div>
                        <InputNumber
                            min={1} max={31}
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.second_cutoff_start}
                            onChange={(v) => setField('second_cutoff_start', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Second Cutoff End</div>
                        <Input
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.second_cutoff_end}
                            onChange={(e) => setField('second_cutoff_end', e.target.value)}
                            placeholder="end_of_month"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Auto-lock After Generate</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.auto_lock_after_generate}
                            onChange={(v) => setField('auto_lock_after_generate', v)}
                        />
                    </div>
                </Col>
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 * 14. GOVERNMENT CONTRIBUTIONS
 * ============================================================ */
const GovernmentContributionsTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);

    const update = (bracket, field, value) =>
        setLocal((prev) => ({ ...prev, [bracket]: { ...(prev[bracket] || {}), [field]: value } }));

    const renderBracket = (bracketKey, label) => {
        const b = local[bracketKey] || {};
        return (
            <Col xs={24} lg={8} key={bracketKey}>
                <Card size="small" title={label}>
                    <Form layout="vertical">
                        <Form.Item label="Employee Rate">
                            <InputNumber
                                min={0} step={0.001} suffix="×"
                                style={{ width: '100%' }}
                                value={b.employee_rate}
                                onChange={(v) => update(bracketKey, 'employee_rate', v)}
                            />
                        </Form.Item>
                        <Form.Item label="Employer Rate">
                            <InputNumber
                                min={0} step={0.001} suffix="×"
                                style={{ width: '100%' }}
                                value={b.employer_rate}
                                onChange={(v) => update(bracketKey, 'employer_rate', v)}
                            />
                        </Form.Item>
                        <Form.Item label="Cutoff Cap (₱)">
                            <InputNumber
                                min={0} step={1}
                                style={{ width: '100%' }}
                                value={b.cutoff_cap}
                                onChange={(v) => update(bracketKey, 'cutoff_cap', v)}
                            />
                        </Form.Item>
                        <Form.Item label="Eligible Employee Types">
                            <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                value={b.eligible_types || []}
                                onChange={(v) => update(bracketKey, 'eligible_types', v)}
                                placeholder="Select employee types"
                            >
                                {Object.keys(local.__availableEmployeeTypes || {}).length > 0 ? (
                                    Object.keys(local.__availableEmployeeTypes).map((code) => (
                                        <Option key={code} value={code}>{code}</Option>
                                    ))
                                ) : (
                                    ['regular', 'probationary', 'contract'].map((code) => (
                                        <Option key={code} value={code}>{code}</Option>
                                    ))
                                )}
                            </Select>
                        </Form.Item>
                    </Form>
                </Card>
            </Col>
        );
    };

    return (
        <StaffGroupShell
            title="Government Contributions"
            icon={<SafetyCertificateOutlined />}
            description="SSS, PhilHealth, Pag-IBIG. Rates drive payroll deductions."
            onSave={() => onSave('staff_government_contributions', local)}
            saving={saving}
        >
            <Row gutter={[16, 16]}>
                {renderBracket('sss', 'SSS')}
                {renderBracket('philhealth', 'PhilHealth')}
                {renderBracket('pagibig', 'Pag-IBIG')}
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 * 15. EMPLOYEE ID SETTINGS
 * ============================================================ */
const EmployeeIdTab = ({ data, onSave, saving }) => {
    const [local, setLocal] = useState(data || {});
    useEffect(() => setLocal(data || {}), [data]);
    const setField = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

    const preview = useMemo(() => {
        const prefix = local.prefix || 'EMP-';
        const digits = Math.max(1, Number(local.digits || 4));
        const start = Math.max(1, Number(local.starting_number || 1));
        const pad = String(start).padStart(digits, '0');
        return `${prefix}${pad}`;
    }, [local.prefix, local.digits, local.starting_number]);

    return (
        <StaffGroupShell
            title="Employee ID Settings"
            icon={<IdcardOutlined />}
            description="Controls how employee codes are generated."
            onSave={() => onSave('staff_employee_id', local)}
            saving={saving}
        >
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Employee ID Prefix</div>
                        <Input
                            style={{ marginTop: 8 }}
                            value={local.prefix}
                            onChange={(e) => setField('prefix', e.target.value)}
                            placeholder="EMP-"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Starting Number</div>
                        <InputNumber
                            min={1}
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.starting_number}
                            onChange={(v) => setField('starting_number', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Number of Digits</div>
                        <InputNumber
                            min={1} max={10}
                            style={{ width: '100%', marginTop: 8 }}
                            value={local.digits}
                            onChange={(v) => setField('digits', v)}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Automatic ID Generation</div>
                        <Switch
                            style={{ marginTop: 8 }}
                            checked={!!local.auto_generate}
                            onChange={(v) => setField('auto_generate', v)}
                            checkedChildren="Enabled" unCheckedChildren="Disabled"
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <div className="settings-config-card">
                        <div className="settings-config-label">Preview</div>
                        <Tag color="blue" style={{ marginTop: 8, fontSize: 16, padding: '6px 12px' }}>
                            {preview}
                        </Tag>
                    </div>
                </Col>
            </Row>
        </StaffGroupShell>
    );
};

/* ============================================================
 *  MAIN STAFF SETTINGS PANEL
 * ============================================================ */
const StaffSettingsPanel = () => {
    const { data: snapshot, isLoading, refetch } = useStaffSnapshot();
    const updateGroup = useUpdateStaffGroup();

    const [activeTab, setActiveTab] = useState('salary-grades');

    const handleSave = async (group, data) => {
        try {
            await updateGroup.mutateAsync({ group, data });
            refetch();
        } catch (e) {
            // hook already displays error
        }
    };

    const tabItems = [
        {
            key: 'salary-grades',
            label: <span><DollarOutlined /> Salary Grades</span>,
            children: <SalaryGradesTab />,
        },
        {
            key: 'departments',
            label: <span><ApartmentOutlined /> Departments</span>,
            children: <DepartmentsTab />,
        },
        {
            key: 'positions',
            label: <span><IdcardOutlined /> Positions</span>,
            children: <PositionsTab />,
        },
        {
            key: 'salary-types',
            label: <span><DollarOutlined /> Salary Types</span>,
            children: (
                <SalaryTypesTab
                    data={snapshot?.staff_salary_types}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'employee-types',
            label: <span><TeamOutlined /> Employee Types</span>,
            children: (
                <EmployeeTypesTab
                    data={snapshot?.staff_employee_types}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'working-hours',
            label: <span><ClockCircleOutlined /> Working Hours</span>,
            children: (
                <WorkingHoursTab
                    data={snapshot?.staff_working_hours}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'overtime',
            label: <span><FieldTimeOutlined /> Overtime</span>,
            children: (
                <OvertimeTab
                    data={snapshot?.staff_overtime}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'undertime',
            label: <span><ClockCircleOutlined /> Undertime</span>,
            children: (
                <UndertimeTab
                    data={snapshot?.staff_undertime}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'late',
            label: <span><ClockCircleOutlined /> Late Attendance</span>,
            children: (
                <LateAttendanceTab
                    data={snapshot?.staff_late_attendance}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'holiday-rates',
            label: <span><CalendarOutlined /> Holiday & Rest Day</span>,
            children: (
                <HolidayRatesTab
                    data={snapshot?.staff_holiday_rates}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'leave-types',
            label: <span><BookOutlined /> Leave Types</span>,
            children: (
                <LeaveTypesTab
                    data={snapshot?.staff_leave_types}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'schedule-rules',
            label: <span><CalendarOutlined /> Schedule Rules</span>,
            children: (
                <ScheduleRulesTab
                    data={snapshot?.staff_schedule_rules}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'payroll-cutoff',
            label: <span><CalculatorOutlined /> Payroll Cutoff</span>,
            children: (
                <PayrollCutoffTab
                    data={snapshot?.staff_payroll_cutoff}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'government-contributions',
            label: <span><SafetyCertificateOutlined /> Government Contributions</span>,
            children: (
                <GovernmentContributionsTab
                    data={snapshot?.staff_government_contributions}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
        {
            key: 'employee-id',
            label: <span><IdcardOutlined /> Employee ID</span>,
            children: (
                <EmployeeIdTab
                    data={snapshot?.staff_employee_id}
                    onSave={handleSave}
                    saving={updateGroup.isPending}
                />
            ),
        },
    ];

    if (isLoading) {
        return (
            <Card variant="borderless" style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" tip="Loading staff settings..." />
            </Card>
        );
    }

    return (
        <div>
            <Alert
                message="Staff Management Settings"
                description="Centralized configuration for salary grades, departments, positions, working hours, overtime, undertime, late rules, leave types, schedule conflicts, payroll cutoff, government contributions, and employee ID formatting."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <Button icon={<ReloadOutlined />} onClick={refetch}>Refresh Staff Settings</Button>
            </div>

            <Collapse
                accordion={false}
                defaultActiveKey={['salary-grades']}
                items={tabItems.map((item) => ({
                    key: item.key,
                    label: item.label,
                    children: item.children,
                }))}
                style={{ background: 'transparent' }}
            />
        </div>
    );
};

export default StaffSettingsPanel;