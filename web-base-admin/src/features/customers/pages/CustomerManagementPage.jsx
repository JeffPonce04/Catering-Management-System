// src/components/CustomerManagement.jsx - ENHANCED MESSENGER WITH CLICKABLE HEADER

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Card, Table, Button, Space, Input, Select, Modal, Tabs, Tag, message, Divider, Tooltip, Typography, Row, Col,
    Descriptions, Alert, DatePicker, Popconfirm, Badge, Empty, Form, Dropdown, Progress, Statistic, InputNumber,
    Avatar, Rate, List, Drawer, ConfigProvider, theme as antdTheme, Skeleton, Switch
} from 'antd';
import {
    UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, ReloadOutlined,
    PrinterOutlined, ExportOutlined, FilterOutlined, CalendarOutlined, StarOutlined, StarFilled, MessageOutlined,
    PhoneOutlined, MailOutlined, EnvironmentOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
    SmileOutlined, FrownOutlined, MehOutlined, TeamOutlined, WalletOutlined, FileTextOutlined, 
    SendOutlined, MoreOutlined, ArrowLeftOutlined, PaperClipOutlined, CameraOutlined, SaveOutlined,
    CheckCircleFilled, ClockCircleFilled, RiseOutlined, TrophyOutlined, LeftOutlined, RightOutlined,
    CrownOutlined, FireOutlined, GiftOutlined, DollarOutlined, VideoCameraOutlined, PictureOutlined,
    SmileFilled, CustomerServiceOutlined, NotificationOutlined, SoundOutlined, 
    CheckOutlined, CloseOutlined, EllipsisOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, useCustomerBookings,
     useCustomerFeedback, useCustomerReviews, useCustomerMessages, useSendCustomerMessage, 
     useRespondToFeedback, useApproveReview, useHideReview, useFeatureReview } from '../../../hooks/useCustomerQueries';
import { format, formatDistanceToNow } from 'date-fns';
import { formatDate, formatDateTime, isValidDate } from '../../../utils/dateUtils';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, hasAllowedRole } from '../../../utils/roleRoutes';
import '../styles/CustomerManagement.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const CustomerManagement = () => {
    const { user } = useAuth();
    const canManageCustomerModeration = hasAllowedRole(user, ADMIN_ROLES);

    // ==================== STATE MANAGEMENT ====================
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterTier, setFilterTier] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [activeMainTab, setActiveMainTab] = useState('directory');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });
    const [isMessageViewOpen, setIsMessageViewOpen] = useState(false);
    const [selectedChatCustomer, setSelectedChatCustomer] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [messageSearchTerm, setMessageSearchTerm] = useState('');
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatContainerRef = useRef(null);
    
    const [customerModalVisible, setCustomerModalVisible] = useState(false);
    const [customerDetailsVisible, setCustomerDetailsVisible] = useState(false);
    const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
    const [messageModalVisible, setMessageModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    
    const [customerForm] = Form.useForm();
    const [feedbackForm] = Form.useForm();
    const [messageForm] = Form.useForm();

    // ==================== REACT QUERY HOOKS ====================
    const { data: customersData, isLoading: customersLoading, refetch: refetchCustomers } = useCustomers({
        page: currentPage,
        per_page: pageSize,
        search: searchText,
        is_active: filterStatus !== 'all' ? (filterStatus === 'active') : undefined,
        tier: filterTier !== 'all' ? filterTier : undefined,
    });

    const createCustomer = useCreateCustomer();
    const updateCustomer = useUpdateCustomer();
    const deleteCustomer = useDeleteCustomer();
    const sendMessage = useSendCustomerMessage();
    const respondToFeedback = useRespondToFeedback();
    const approveReview = useApproveReview();
    const hideReview = useHideReview();
    const featureReview = useFeatureReview();

    const { data: customerBookings = [], refetch: refetchBookings } = useCustomerBookings(selectedCustomer?.customer_id);
    const { data: feedbacks = [], refetch: refetchFeedbacks } = useCustomerFeedback({}, { enabled: canManageCustomerModeration });
    const { data: reviews = [], refetch: refetchReviews } = useCustomerReviews({}, { enabled: canManageCustomerModeration });
    const { data: messages = [], refetch: refetchMessages } = useCustomerMessages();

    // ==================== DATA TRANSFORMATIONS ====================
    const customers = customersData?.data || [];
    const totalCustomers = customersData?.total || 0;
    const activeCustomers = customers.filter(c => c.is_active !== false).length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    const avgRating = feedbacks.length > 0 
        ? (feedbacks.reduce((sum, f) => sum + (f.overall_rating || 0), 0) / feedbacks.length).toFixed(1) 
        : '0';
    const positiveSentiment = feedbacks.filter(f => f.sentiment === 'positive').length;
    const pendingReviews = reviews.filter(r => !r.is_approved).length;

    // ==================== TIER CALCULATION ====================
    const getCustomerTier = (customerOrTier) => {
        const tier = String(
            typeof customerOrTier === 'object' ? customerOrTier?.tier : customerOrTier,
        ).toLowerCase();
        const tiers = {
            platinum: { tier: 'platinum', icon: <CrownOutlined />, color: '#8b5cf6', bg: '#f5f3ff' },
            gold: { tier: 'gold', icon: <StarFilled />, color: '#f59e0b', bg: '#fffbeb' },
            silver: { tier: 'silver', icon: <StarOutlined />, color: '#94a3b8', bg: '#f1f5f9' },
            bronze: { tier: 'bronze', icon: <FireOutlined />, color: '#d97706', bg: '#fffbeb' },
        };
        return tiers[tier] || { tier: 'not recorded', icon: <InfoCircleOutlined />, color: '#64748b', bg: '#f1f5f9' };
    };

    const getLoyaltyPoints = (customer) => Number(customer?.loyalty_points ?? 0);

    // ==================== THEME DETECTION ====================
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        setIsDarkMode(savedTheme === 'dark' || (savedTheme !== 'light' && document.body.classList.contains('dark-mode')));
        
        const observer = new MutationObserver(() => {
            setIsDarkMode(document.body.classList.contains('dark-mode'));
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // ==================== CHAT FUNCTIONS ====================
    const getCustomerMessages = useCallback((customer) => {
        if (!customer) return [];
        return messages
            .filter(m => String(m.customer_id) === String(customer.customer_id))
            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }, [messages]);

    const openMessageView = (customer) => {
        setSelectedChatCustomer(customer);
        setChatMessages(getCustomerMessages(customer));
        setIsMessageViewOpen(true);
        setIsTyping(false);
    };

    const closeMessageView = () => {
        setIsMessageViewOpen(false);
        setSelectedChatCustomer(null);
        setChatMessages([]);
        setNewMessage('');
    };

    const handleSendMessage = async (values = null) => {
        const targetCustomer = values?.customer_id
            ? customers.find(c => String(c.customer_id) === String(values.customer_id))
            : selectedChatCustomer;
        const messageContent = (values?.message ?? newMessage).trim();
        if (!messageContent || !targetCustomer) return;
        
        setNewMessage('');
        
        const tempMessage = {
            id: `temp-${Date.now()}`,
            customer_id: targetCustomer.customer_id,
            message: messageContent,
            sender_name: 'You',
            sender_type: 'admin',
            isAdmin: true,
            created_at: new Date().toISOString(),
            read_at: null,
        };
        setChatMessages(prev => [...prev, tempMessage]);
        setSelectedChatCustomer(targetCustomer);
        setIsTyping(true);
        
        try {
            await sendMessage.mutateAsync({
                customer_id: targetCustomer.customer_id,
                message: messageContent,
            });
            
            setIsTyping(false);
            await refetchMessages();

            if (values?.customer_id) {
                setMessageModalVisible(false);
                messageForm.resetFields();
                setIsMessageViewOpen(true);
            }
        } catch (error) {
            setIsTyping(false);
            message.error('Failed to send message');
            setChatMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    useEffect(() => {
        if (selectedChatCustomer) {
            setChatMessages(getCustomerMessages(selectedChatCustomer));
        }
    }, [messages, selectedChatCustomer, getCustomerMessages]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    // ==================== CUSTOMER FUNCTIONS ====================
    const handleAddCustomer = () => {
        customerForm.resetFields();
        setSelectedItem(null);
        setCustomerModalVisible(true);
    };

    const handleEditCustomer = (record) => {
        setSelectedItem(record);
        customerForm.setFieldsValue({
            first_name: record.person?.first_name,
            last_name: record.person?.last_name,
            email: record.person?.email,
            phone: record.person?.phone,
            address: record.person?.address_line_1,
            tier: record.tier,
            dietary_restrictions: record.dietary_restrictions,
            notes: record.notes,
        });
        setCustomerModalVisible(true);
    };

    const handleViewCustomerDetails = async (record) => {
        setSelectedCustomer(record);
        setCustomerDetailsVisible(true);
        await refetchBookings();
    };

    const handleDeleteCustomer = (record) => {
        Modal.confirm({
            title: 'Delete Customer',
            content: `Are you sure you want to delete ${record.person?.first_name} ${record.person?.last_name}?`,
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteCustomer.mutateAsync(record.customer_id);
                    message.success('Customer deleted successfully');
                    refetchCustomers();
                } catch (error) {
                    message.error(error.response?.data?.message || 'Failed to delete customer');
                }
            }
        });
    };

    const handleSaveCustomer = async (values) => {
        try {
            const customerData = {
                first_name: values.first_name,
                last_name: values.last_name,
                email: values.email,
                phone: values.phone,
                address_line_1: values.address,
                tier: values.tier || 'bronze',
                dietary_restrictions: values.dietary_restrictions,
                notes: values.notes,
            };
            
            if (selectedItem) {
                await updateCustomer.mutateAsync({ id: selectedItem.customer_id, data: customerData });
                message.success('Customer updated successfully');
            } else {
                await createCustomer.mutateAsync(customerData);
                message.success('Customer created successfully');
            }
            setCustomerModalVisible(false);
            customerForm.resetFields();
            refetchCustomers();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to save customer');
        }
    };

    const handleRespondToFeedback = async (values) => {
        try {
            await respondToFeedback.mutateAsync({ id: selectedItem.review_id, response: values.response });
            message.success('Response sent to customer');
            setFeedbackModalVisible(false);
            refetchFeedbacks();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to send response');
        }
    };

    const handleApproveReview = async (record) => {
        try {
            await approveReview.mutateAsync(record.review_id);
            message.success('Review approved and published');
            refetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to approve review');
        }
    };

    const handleHideReview = async (record) => {
        try {
            await hideReview.mutateAsync(record.review_id);
            message.success('Review hidden');
            refetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to hide review');
        }
    };

    const handleFeatureReview = async (record) => {
        try {
            await featureReview.mutateAsync({ id: record.review_id, featured: !record.is_featured });
            message.success(record.is_featured ? 'Removed from featured' : 'Added to featured');
            refetchReviews();
        } catch (error) {
            message.error(error.response?.data?.message || 'Failed to update featured status');
        }
    };

    const getSentimentIcon = (sentiment) => {
        if (sentiment === 'positive') return <SmileOutlined style={{ color: '#10b981' }} />;
        if (sentiment === 'negative') return <FrownOutlined style={{ color: '#ef4444' }} />;
        return <MehOutlined style={{ color: '#f59e0b' }} />;
    };

    const getUnreadCount = (customerId) => {
        return messages.filter(m => 
            String(m.customer_id) === String(customerId) && 
            !m.read_at && 
            m.sender_type === 'customer'
        ).length;
    };

    const chatCustomers = customers.filter(c => 
        messages.some(m => String(m.customer_id) === String(c.customer_id)) || 
        c.person?.first_name?.toLowerCase().includes(messageSearchTerm.toLowerCase()) ||
        c.person?.last_name?.toLowerCase().includes(messageSearchTerm.toLowerCase()) ||
        c.person?.email?.toLowerCase().includes(messageSearchTerm.toLowerCase())
    );

    // ==================== TABLE COLUMNS ====================
    const customerColumns = [
        { 
            title: 'CUSTOMER ID', 
            dataIndex: 'customer_code', 
            key: 'code', 
            width: 120, 
            render: (text) => <span className="cm-id-text">{text || 'N/A'}</span> 
        },
        { 
            title: 'CUSTOMER NAME', 
            key: 'name', 
            width: 200, 
            render: (_, r) => (
                <div className="cm-customer-cell">
                    <div className="cm-customer-name">{r.person?.first_name || ''} {r.person?.last_name || ''}</div>
                    <div className="cm-customer-contact"><MailOutlined /> {r.person?.email || 'N/A'}</div>
                </div>
            )
        },
        { 
            title: 'CONTACT', 
            key: 'phone', 
            width: 140, 
            render: (_, r) => <div className="cm-contact-info"><PhoneOutlined /> {r.person?.phone || 'N/A'}</div> 
        },
        { 
            title: 'BOOKINGS', 
            key: 'bookings', 
            width: 90, 
            align: 'center', 
            render: (_, r) => {
                const count = r.total_bookings || 0;
                return <Badge count={count} showZero style={{ backgroundColor: count > 0 ? '#3b82f6' : '#94a3b8' }} />;
            } 
        },
        { 
            title: 'TOTAL SPENT', 
            key: 'spent', 
            width: 140, 
            align: 'right', 
            render: (_, r) => {
                const amount = r.total_spent || 0;
                return <span className="cm-amount" style={{ fontWeight: amount > 0 ? 'bold' : 'normal' }}>
                    ₱{amount.toLocaleString()}
                </span>;
            } 
        },
        { 
            title: 'LOYALTY PTS', 
            key: 'loyalty', 
            width: 100, 
            align: 'center',
            render: (_, r) => {
                const points = getLoyaltyPoints(r);
                return <span className="cm-loyalty-points"><GiftOutlined /> {points}</span>;
            }
        },
        { 
            title: 'TIER', 
            key: 'tier', 
            width: 100, 
            align: 'center', 
            render: (_, r) => {
                const tierInfo = getCustomerTier(r);
                return (
                    <span className="cm-tier" style={{ color: tierInfo.color, background: tierInfo.bg }}>
                        {tierInfo.icon} {tierInfo.tier}
                    </span>
                );
            } 
        },
        { 
            title: 'STATUS', 
            dataIndex: 'is_active', 
            key: 'status', 
            width: 100, 
            align: 'center', 
            render: (s) => <span className={`cm-status ${s !== false ? 'active' : 'inactive'}`}>
                {s !== false ? 'Active' : 'Inactive'}
            </span> 
        },
        { 
            title: 'ACTIONS', 
            key: 'actions', 
            width: 200, 
            fixed: 'right',
            render: (_, record) => (
                <div className="cm-action-group">
                    <Tooltip title="View Details">
                        <button className="cm-action-icon view" onClick={() => handleViewCustomerDetails(record)}>
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Edit Customer">
                        <button className="cm-action-icon edit" onClick={() => handleEditCustomer(record)}>
                            <EditOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Chat">
                        <button className="cm-action-icon chat" onClick={() => openMessageView(record)}>
                            <MessageOutlined />
                        </button>
                    </Tooltip>
                    {canManageCustomerModeration && (
                        <Dropdown menu={{ 
                            items: [
                                { 
                                    key: 'delete', 
                                    label: 'Delete Customer', 
                                    icon: <DeleteOutlined />, 
                                    danger: true, 
                                    onClick: () => handleDeleteCustomer(record) 
                                }
                            ] 
                        }} placement="bottomRight">
                            <button className="cm-action-icon more">
                                <MoreOutlined />
                            </button>
                        </Dropdown>
                    )}
                </div>
            )
        }
    ];

    const bookingColumns = [
        { 
            title: 'BOOKING ID', 
            dataIndex: 'booking_no', 
            key: 'id', 
            width: 120, 
            render: (text) => <span className="cm-id-text">{text || 'N/A'}</span> 
        },
        { 
            title: 'EVENT TYPE', 
            dataIndex: ['service_event', 'event_type', 'name'], 
            key: 'type', 
            width: 130,
            render: (text) => text || 'N/A'
        },
        { 
            title: 'EVENT DATE', 
            dataIndex: ['service_event', 'event_date'], 
            key: 'date', 
            width: 120, 
            render: (text) => text ? formatDate(text, 'MMM dd, yyyy') : 'N/A' 
        },
        { 
            title: 'VENUE', 
            dataIndex: ['service_event', 'venue'], 
            key: 'venue', 
            width: 180, 
            ellipsis: true,
            render: (text) => text || 'N/A'
        },
        { 
            title: 'PAX', 
            dataIndex: ['service_event', 'guests_count'], 
            key: 'pax', 
            width: 80, 
            align: 'center', 
            render: (v) => <span className="cm-pax">{v || 0}</span> 
        },
        { 
            title: 'AMOUNT', 
            dataIndex: ['quotation', 'total_amount'], 
            key: 'amount', 
            width: 130, 
            align: 'right', 
            render: (v) => <span className="cm-amount">₱{(v || 0).toLocaleString()}</span> 
        },
        { 
            title: 'STATUS', 
            dataIndex: 'booking_status', 
            key: 'status', 
            width: 110, 
            align: 'center', 
            render: (s) => {
                const config = {
                    confirmed: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', text: 'Confirmed' },
                    completed: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', text: 'Completed' },
                    pending: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', text: 'Pending' },
                    pending_approval: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', text: 'Pending Approval' },
                    cancelled: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'Cancelled' },
                    rejected: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'Rejected' }
                };
                const c = config[s] || config.pending;
                return <span className="cm-status-badge" style={{ color: c.color, background: c.bg }}>{c.text}</span>;
            } 
        },
    ];

    const feedbackColumns = [
        { 
            title: 'CUSTOMER', 
            key: 'customer', 
            width: 150, 
            render: (_, r) => {
                const customer = customers.find(c => String(c.customer_id) === String(r.customer_id));
                return customer ? (
                    <Button type="link" onClick={() => handleViewCustomerDetails(customer)} style={{ padding: 0 }}>
                        {r.customer_name || `${customer.person?.first_name || ''} ${customer.person?.last_name || ''}`.trim() || 'Customer'}
                    </Button>
                ) : (
                    <span className="cm-customer-name">{r.customer_name || 'Customer'}</span>
                );
            }
        },
        { 
            title: 'FOOD', 
            dataIndex: 'food_rating', 
            key: 'food', 
            width: 100, 
            align: 'center', 
            render: (v) => <Rate disabled defaultValue={v || 0} style={{ fontSize: 12 }} /> 
        },
        { 
            title: 'SERVICE', 
            dataIndex: 'service_rating', 
            key: 'service', 
            width: 100, 
            align: 'center', 
            render: (v) => <Rate disabled defaultValue={v || 0} style={{ fontSize: 12 }} /> 
        },
        { 
            title: 'OVERALL', 
            dataIndex: 'overall_rating', 
            key: 'overall', 
            width: 120, 
            align: 'center', 
            render: (v) => <Rate disabled defaultValue={v || 0} style={{ fontSize: 14 }} allowHalf /> 
        },
        { 
            title: 'SENTIMENT', 
            key: 'sentiment', 
            width: 120, 
            align: 'center', 
            render: (_, r) => <div className="cm-sentiment">{getSentimentIcon(r.sentiment)} {r.sentiment || 'neutral'}</div> 
        },
        { 
            title: 'DATE', 
            dataIndex: 'created_at', 
            key: 'date', 
            width: 120, 
            render: (v) => v ? formatDate(v, 'MMM dd, yyyy') : 'N/A' 
        },
        { 
            title: 'ACTIONS', 
            key: 'actions', 
            width: 100, 
            render: (_, r) => <button className="cm-action-icon view" onClick={() => { setSelectedItem(r); setFeedbackModalVisible(true); }}><EyeOutlined /></button> 
        }
    ];

    const reviewColumns = [
        { 
            title: 'CUSTOMER', 
            key: 'customer', 
            width: 150, 
            render: (_, r) => {
                const customer = customers.find(c => String(c.customer_id) === String(r.customer_id));
                return customer ? (
                    <Button type="link" onClick={() => handleViewCustomerDetails(customer)} style={{ padding: 0 }}>
                        {r.customer_name || `${customer.person?.first_name || ''} ${customer.person?.last_name || ''}`.trim() || 'Customer'}
                    </Button>
                ) : (
                    <span className="cm-customer-name">{r.customer_name || 'Customer'}</span>
                );
            }
        },
        { 
            title: 'REVIEW', 
            dataIndex: 'comment', 
            key: 'review', 
            width: 250, 
            ellipsis: true,
            render: (text) => text || 'No comment'
        },
        { 
            title: 'RATING', 
            dataIndex: 'overall_rating', 
            key: 'rating', 
            width: 120, 
            align: 'center', 
            render: (v) => <Rate disabled defaultValue={v || 0} style={{ fontSize: 14 }} /> 
        },
        { 
            title: 'STATUS', 
            dataIndex: 'is_approved', 
            key: 'status', 
            width: 110, 
            align: 'center', 
            render: (v) => <span className={`cm-status-badge ${v ? 'approved' : 'pending'}`}>{v ? 'Approved' : 'Pending'}</span> 
        },
        { 
            title: 'FEATURED', 
            dataIndex: 'is_featured', 
            key: 'featured', 
            width: 90, 
            align: 'center', 
            render: (v) => v ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined style={{ color: '#94a3b8' }} /> 
        },
        { 
            title: 'ACTIONS', 
            key: 'actions', 
            width: 200,
            render: (_, record) => (
                <div className="cm-action-group">
                    {!record.is_approved && (
                        <button className="cm-action-icon approve" onClick={() => handleApproveReview(record)}>
                            <CheckCircleOutlined />
                        </button>
                    )}
                    <button className="cm-action-icon feature" onClick={() => handleFeatureReview(record)}>
                        {record.is_featured ? <StarFilled /> : <StarOutlined />}
                    </button>
                    <Popconfirm title="Hide this review?" onConfirm={() => handleHideReview(record)}>
                        <button className="cm-action-icon delete"><DeleteOutlined /></button>
                    </Popconfirm>
                </div>
            )
        }
    ];

    // ==================== PAGINATION HELPERS ====================
    const renderPaginationItem = (_, type, originalElement) => {
        if (type === 'prev') {
            return (
                <Button className="cm-pagination-navigation-button" size="small" icon={<LeftOutlined />}>
                    Previous
                </Button>
            );
        }
        if (type === 'next') {
            return (
                <Button className="cm-pagination-navigation-button" size="small">
                    Next <RightOutlined />
                </Button>
            );
        }
        return originalElement;
    };

    const renderEmptyPaginationFooter = (label) => {
        return (
            <div className="cm-empty-pagination-footer">
                <span className="cm-empty-pagination-total">Total 0 {label}</span>
                <div className="cm-empty-pagination-controls">
                    <Button className="cm-pagination-navigation-button" size="small" icon={<LeftOutlined />} disabled>
                        Previous
                    </Button>
                    <button type="button" className="cm-empty-pagination-current-page" disabled>1</button>
                    <Button className="cm-pagination-navigation-button" size="small" disabled>
                        Next <RightOutlined />
                    </Button>
                </div>
            </div>
        );
    };

    // ==================== CSS CLASSES ====================
    const containerClass = `cm-customer-container ${isDarkMode ? 'cm-dark-mode' : ''}`;
    const headerClass = `cm-header ${isDarkMode ? 'cm-header-dark' : ''}`;
    const dateDisplayClass = `cm-date-display ${isDarkMode ? 'cm-date-display-dark' : ''}`;
    const mainCardClass = `cm-main-card ${isDarkMode ? 'cm-main-card-dark' : ''}`;
    const filtersClass = `cm-filters ${isDarkMode ? 'cm-filters-dark' : ''}`;
    const filterGroupClass = `cm-filter-group ${isDarkMode ? 'cm-filter-group-dark' : ''}`;
    const tableClass = `cm-table ${isDarkMode ? 'cm-table-dark' : ''}`;
    const kpiCardClass = `cm-kpi-card ${isDarkMode ? 'cm-kpi-card-dark' : ''}`;
    const modalClass = `cm-modal-clean ${isDarkMode ? 'cm-modal-dark' : ''}`;
    const drawerClass = `cm-drawer ${isDarkMode ? 'cm-drawer-dark' : ''}`;
    const tabContentClass = `cm-tab-content ${isDarkMode ? 'cm-tab-content-dark' : ''}`;
    const alertClass = isDarkMode ? 'cm-alert-dark' : '';
    const messengerClass = `cm-messenger-container ${isDarkMode ? 'cm-messenger-dark' : ''}`;
    const isLoading = customersLoading;

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
                    <div className="cm-header-left">
                        <Tooltip title="Customer Management System">
                            <div className="cm-logo-icon"><UserOutlined /></div>
                        </Tooltip>
                        <div className="cm-header-info">
                            <h1>Customer Management</h1>
                            <span>Complete Customer Relationship Management</span>
                        </div>
                    </div>
                    <div className="cm-header-right">
                        <div className={dateDisplayClass}>
                            <CalendarOutlined />
                            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <Divider type="vertical" style={{ height: 28 }} />
                        <Tooltip title="Refresh all data">
                            <Button icon={<ReloadOutlined />} onClick={() => {
                                refetchCustomers();
                                refetchBookings();
                                refetchFeedbacks();
                                refetchReviews();
                                refetchMessages();
                                message.success('Data refreshed');
                            }} loading={customersLoading}>Refresh</Button>
                        </Tooltip>
                        <Tooltip title="Export to Excel">
                            <Button icon={<ExportOutlined />}>Export</Button>
                        </Tooltip>
                        <Tooltip title="Print current view">
                            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                        </Tooltip>
                        <Tooltip title="Add new customer">
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustomer}>
                                Add Customer
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* ==================== KPI CARDS ==================== */}
                <div className="cm-kpi-grid">
                    <div className={kpiCardClass}>
                        <div className="cm-kpi-icon blue"><UserOutlined /></div>
                        <div className="cm-kpi-stats">
                            <div className="cm-kpi-value">{totalCustomers}</div>
                            <div className="cm-kpi-label">Total Customers</div>
                        </div>
                        <div className="cm-kpi-trend up"><RiseOutlined /> {customersData?.growth || 0}%</div>
                    </div>
                    <div className={kpiCardClass}>
                        <div className="cm-kpi-icon green"><TeamOutlined /></div>
                        <div className="cm-kpi-stats">
                            <div className="cm-kpi-value">{activeCustomers}</div>
                            <div className="cm-kpi-label">Active Customers</div>
                        </div>
                        <div className="cm-kpi-trend up"><RiseOutlined /> {customersData?.active_growth || 0}%</div>
                    </div>
                    <div className={kpiCardClass}>
                        <div className="cm-kpi-icon cyan"><WalletOutlined /></div>
                        <div className="cm-kpi-stats">
                            <div className="cm-kpi-value">₱{totalRevenue.toLocaleString()}</div>
                            <div className="cm-kpi-label">Total Revenue</div>
                        </div>
                        <div className="cm-kpi-trend up"><RiseOutlined /> +{customersData?.revenue_growth || 0}%</div>
                    </div>
                    <div className={kpiCardClass}>
                        <div className="cm-kpi-icon orange"><StarOutlined /></div>
                        <div className="cm-kpi-stats">
                            <div className="cm-kpi-value">{avgRating}</div>
                            <div className="cm-kpi-label">Avg Rating</div>
                        </div>
                        <div className="cm-kpi-trend up"><SmileOutlined /> {positiveSentiment} Positive</div>
                    </div>
                </div>

                {/* ==================== MAIN CARD ==================== */}
                <Card className={mainCardClass} variant="borderless">
                    <Tabs 
                        activeKey={activeMainTab} 
                        onChange={setActiveMainTab} 
                        className="cm-tabs"
                        destroyInactiveTabPane={true}
                        items={[
                            {
                                key: 'directory',
                                label: <span><UserOutlined /> Customer Directory</span>,
                                children: (
                                    <div className="cm-tab-content">
                                        <div className={filtersClass}>
                                            <div className={filterGroupClass}>
                                                <FilterOutlined />
                                                <Select value={filterTier} onChange={setFilterTier} className="cm-filter-select" style={{ width: 150 }}>
                                                    <Option value="all">All Tiers</Option>
                                                    <Option value="platinum">Platinum</Option>
                                                    <Option value="gold">Gold</Option>
                                                    <Option value="silver">Silver</Option>
                                                    <Option value="bronze">Bronze</Option>
                                                </Select>
                                            </div>
                                            <div className={filterGroupClass}>
                                                <UserOutlined />
                                                <Select value={filterStatus} onChange={setFilterStatus} className="cm-filter-select" style={{ width: 140 }}>
                                                    <Option value="all">All Status</Option>
                                                    <Option value="active">Active</Option>
                                                    <Option value="inactive">Inactive</Option>
                                                </Select>
                                            </div>
                                            <div className={`${filterGroupClass} cm-search`}>
                                                <SearchOutlined />
                                                <Input 
                                                    placeholder="Search by name or email..." 
                                                    value={searchText} 
                                                    onChange={(e) => setSearchText(e.target.value)} 
                                                    allowClear 
                                                    className="cm-search-input"
                                                />
                                            </div>
                                        </div>

                                        <div className="cm-table-container">
                                            <Table 
                                                columns={customerColumns} 
                                                dataSource={customers} 
                                                rowKey="customer_id" 
                                                loading={isLoading} 
                                                className={tableClass}
                                                scroll={{ x: 1500 }}
                                                locale={{
                                                    emptyText: (
                                                        <div className="cm-empty-state">
                                                            <UserOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                            <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                                                                No customers yet
                                                            </p>
                                                            <p style={{ fontSize: 14, color: '#999' }}>
                                                                Customers will appear here once they have approved bookings.
                                                            </p>
                                                            <Button 
                                                                type="primary" 
                                                                icon={<PlusOutlined />} 
                                                                onClick={handleAddCustomer}
                                                                style={{ marginTop: 12 }}
                                                            >
                                                                Add First Customer
                                                            </Button>
                                                        </div>
                                                    )
                                                }}
                                                footer={
                                                    customers.length === 0
                                                        ? () => null
                                                        : undefined
                                                }
                                                pagination={
                                                    customers.length > 0 ? {
                                                        current: currentPage,
                                                        pageSize: 5,
                                                        total: totalCustomers,
                                                        showSizeChanger: true,
                                                        showTotal: (total) => `Total ${total} customers`,
                                                        itemRender: renderPaginationItem,
                                                        onChange: (page, size) => { setCurrentPage(page); if (size) setPageSize(size); },
                                                        pageSizeOptions: ['5', '10', '20', '50']
                                                    } : false
                                                }
                                            />
                                        </div>
                                    </div>
                                )
                            },
                            {
                                key: 'bookings',
                                label: <span><CalendarOutlined /> Bookings</span>,
                                children: (
                                    <div className={tabContentClass}>
                                        <Alert 
                                            message="Booking History" 
                                            description="Track all customer bookings across all events" 
                                            type="info" 
                                            showIcon 
                                            style={{ marginBottom: 20 }}
                                            className={alertClass}
                                        />
                                        <div className="cm-table-container">
                                            <Table 
                                                columns={bookingColumns} 
                                                dataSource={customerBookings} 
                                                rowKey="booking_id" 
                                                className={tableClass}
                                                scroll={{ x: 1200 }}
                                                locale={{
                                                    emptyText: (
                                                        <div className="cm-empty-state">
                                                            <CalendarOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                            <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                                                                No bookings yet
                                                            </p>
                                                            <p style={{ fontSize: 14, color: '#999' }}>
                                                                Bookings will appear here once the customer has approved events.
                                                            </p>
                                                        </div>
                                                    )
                                                }}
                                                footer={
                                                    customerBookings.length === 0
                                                        ? () => null
                                                        : undefined
                                                }
                                                pagination={
                                                    customerBookings.length > 0 ? {
                                                        pageSize: 5,
                                                        showSizeChanger: true,
                                                        showTotal: (total) => `Total ${total} bookings`,
                                                        itemRender: renderPaginationItem,
                                                        pageSizeOptions: ['5', '10', '20', '50']
                                                    } : false
                                                }
                                            />
                                        </div>
                                    </div>
                                )
                            },
                            ...(canManageCustomerModeration ? [{
                                key: 'feedback',
                                label: <span><StarOutlined /> Feedback</span>,
                                children: (
                                    <div className={tabContentClass}>
                                        <Alert 
                                            message="Customer Satisfaction Monitoring" 
                                            description="Monitor food, service, and overall ratings" 
                                            type="info" 
                                            showIcon 
                                            style={{ marginBottom: 20 }}
                                            className={alertClass}
                                        />
                                        <div className="cm-table-container">
                                            <Table 
                                                columns={feedbackColumns} 
                                                dataSource={feedbacks} 
                                                rowKey="review_id" 
                                                className={tableClass}
                                                scroll={{ x: 1100 }}
                                                locale={{
                                                    emptyText: (
                                                        <div className="cm-empty-state">
                                                            <StarOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                            <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                                                                No feedback yet
                                                            </p>
                                                            <p style={{ fontSize: 14, color: '#999' }}>
                                                                Customer feedback will appear here once reviews are submitted.
                                                            </p>
                                                        </div>
                                                    )
                                                }}
                                                footer={
                                                    feedbacks.length === 0
                                                        ? () => null
                                                        : undefined
                                                }
                                                pagination={
                                                    feedbacks.length > 0 ? {
                                                        pageSize: 5,
                                                        showSizeChanger: true,
                                                        showTotal: (total) => `Total ${total} feedback`,
                                                        itemRender: renderPaginationItem,
                                                        pageSizeOptions: ['5', '10', '20', '50']
                                                    } : false
                                                }
                                            />
                                        </div>
                                    </div>
                                )
                            },
                            {
                                key: 'reviews',
                                label: <span><FileTextOutlined /> Reviews</span>,
                                children: (
                                    <div className={tabContentClass}>
                                        <Alert 
                                            message="Review Management" 
                                            description="Approve, hide, or feature customer reviews" 
                                            type="info" 
                                            showIcon 
                                            style={{ marginBottom: 20 }}
                                            className={alertClass}
                                        />
                                        <div style={{ marginBottom: 16 }}>
                                            <Badge count={pendingReviews} style={{ backgroundColor: '#f59e0b' }}>
                                                <Tag color="orange">Pending Approval: {pendingReviews}</Tag>
                                            </Badge>
                                        </div>
                                        <div className="cm-table-container">
                                            <Table 
                                                columns={reviewColumns} 
                                                dataSource={reviews} 
                                                rowKey="review_id" 
                                                className={tableClass}
                                                scroll={{ x: 1200 }}
                                                locale={{
                                                    emptyText: (
                                                        <div className="cm-empty-state">
                                                            <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                            <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                                                                No reviews yet
                                                            </p>
                                                            <p style={{ fontSize: 14, color: '#999' }}>
                                                                Customer reviews will appear here once submitted.
                                                            </p>
                                                        </div>
                                                    )
                                                }}
                                                footer={
                                                    reviews.length === 0
                                                        ? () => null
                                                        : undefined
                                                }
                                                pagination={
                                                    reviews.length > 0 ? {
                                                        pageSize: 5,
                                                        showSizeChanger: true,
                                                        showTotal: (total) => `Total ${total} reviews`,
                                                        itemRender: renderPaginationItem,
                                                        pageSizeOptions: ['5', '10', '20', '50']
                                                    } : false
                                                }
                                            />
                                        </div>
                                    </div>
                                )
                            }] : []),
                            {
                                key: 'messages',
                                label: <span><MessageOutlined /> Messages</span>,
                                children: (
                                    <div className={tabContentClass}>
                                        <Alert 
                                            message="Customer Communication Center" 
                                            description="Real-time messaging with your customers. Stay connected and respond instantly." 
                                            type="info" 
                                            showIcon 
                                            style={{ marginBottom: 20 }}
                                            className={alertClass}
                                        />
                                        
                                        {/* ==================== ENHANCED PREMIUM MESSENGER ==================== */}
                                        <div className={messengerClass}>
                                            {/* Sidebar */}
                                            <div className="cm-messenger-sidebar">
                                                <div className="cm-messenger-sidebar-header">
                                                    <div className="cm-messenger-title">
                                                        <span>Chat</span>
                                                        <Badge 
                                                            count={messages.filter(m => !m.read_at && m.sender_type === 'customer').length} 
                                                            style={{ backgroundColor: '#ef4444' }}
                                                        />
                                                    </div>
                                                    <div className="cm-messenger-search">
                                                        <Input 
                                                            placeholder="Search Anything..." 
                                                            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                                                            value={messageSearchTerm}
                                                            onChange={(e) => setMessageSearchTerm(e.target.value)}
                                                            className="cm-messenger-search-input"
                                                        />
                                                    </div>
                                                    <div className="cm-messenger-filter-tabs">
                                                        <Button type="text" className="cm-filter-tab active">All</Button>
                                                        <Button type="text" className="cm-filter-tab">Unread</Button>
                                                        <Button type="text" className="cm-filter-tab">Starred</Button>
                                                    </div>
                                                </div>
                                                <div className="cm-messenger-contact-list">
                                                    {chatCustomers.length === 0 ? (
                                                        <div className="cm-messenger-empty-state">
                                                            <MessageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                            <p>No conversations yet</p>
                                                            <span>Messages will appear here once customers start communicating.</span>
                                                        </div>
                                                    ) : (
                                                        chatCustomers.map(customer => {
                                                            const unreadCount = getUnreadCount(customer.customer_id);
                                                            const lastMessage = messages
                                                                .filter(m => String(m.customer_id) === String(customer.customer_id))
                                                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                                                            const isActive = String(selectedChatCustomer?.customer_id) === String(customer.customer_id);
                                                            
                                                            return (
                                                                <div 
                                                                    key={customer.customer_id}
                                                                    className={`cm-messenger-contact ${isActive ? 'cm-messenger-contact-active' : ''}`}
                                                                    onClick={() => {
                                                                        if (String(selectedChatCustomer?.customer_id) === String(customer.customer_id)) return;
                                                                        openMessageView(customer);
                                                                    }}
                                                                >
                                                                    <Avatar 
                                                                        size={44} 
                                                                        icon={<UserOutlined />} 
                                                                        className="cm-messenger-contact-avatar"
                                                                        style={{ 
                                                                            backgroundColor: isActive ? '#1a7ab5' : '#64748b'
                                                                        }}
                                                                    />
                                                                    <div className="cm-messenger-contact-info">
                                                                        <div className="cm-messenger-contact-name">
                                                                            <span className="cm-messenger-contact-fullname">
                                                                                {customer.person?.first_name || ''} {customer.person?.last_name || ''}
                                                                            </span>
                                                                            {unreadCount > 0 && (
                                                                                <Badge count={unreadCount} style={{ backgroundColor: '#ef4444' }} />
                                                                            )}
                                                                        </div>
                                                                        <div className="cm-messenger-contact-last">
                                                                            <span className="cm-messenger-contact-last-message">
                                                                                {lastMessage ? (
                                                                                    <>
                                                                                        {lastMessage.sender_type === 'admin' && <span className="cm-messenger-sender-label">You: </span>}
                                                                                        {lastMessage.message?.substring(0, 40) || ''}
                                                                                        {lastMessage.message?.length > 40 ? '...' : ''}
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="cm-messenger-no-message">No messages yet</span>
                                                                                )}
                                                                            </span>
                                                                            <span className="cm-messenger-contact-time">
                                                                                {lastMessage?.created_at ? formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true }) : ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            {/* Chat Area */}
                                            <div className="cm-messenger-chat">
                                                {selectedChatCustomer ? (
                                                    <div className="cm-messenger-chat-panel">
                                                        {/* Chat Header - CLICKABLE CUSTOMER NAME */}
                                                        <div className="cm-messenger-chat-header">
                                                            <div className="cm-messenger-chat-header-left">
                                                                <Button 
                                                                    icon={<ArrowLeftOutlined />} 
                                                                    className="cm-messenger-back-btn"
                                                                    onClick={closeMessageView}
                                                                />
                                                                <Avatar 
                                                                    size={40} 
                                                                    icon={<UserOutlined />} 
                                                                    style={{ backgroundColor: '#1a7ab5' }}
                                                                />
                                                                <div className="cm-messenger-chat-header-info">
                                                                    <div 
                                                                        className="cm-messenger-chat-name-wrapper"
                                                                        onClick={() => handleViewCustomerDetails(selectedChatCustomer)}
                                                                        style={{ cursor: 'pointer' }}
                                                                    >
                                                                        <span className="cm-messenger-chat-name">
                                                                            {selectedChatCustomer.person?.first_name || ''} {selectedChatCustomer.person?.last_name || ''}
                                                                        </span>
                                                                        <InfoCircleOutlined className="cm-messenger-chat-info-icon" />
                                                                    </div>
                                                                    <div className="cm-messenger-chat-status">
                                                                        <span className="cm-messenger-status-dot online"></span>
                                                                        <span className="cm-messenger-status-text">Online</span>
                                                                        <span className="cm-messenger-status-separator">•</span>
                                                                        <span className="cm-messenger-chat-tier" style={{ 
                                                                            color: getCustomerTier(selectedChatCustomer).color 
                                                                        }}>
                                                                            {getCustomerTier(selectedChatCustomer).icon} 
                                                                            {getCustomerTier(selectedChatCustomer).tier}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="cm-messenger-chat-header-actions">
                                                                <Tooltip title="Phone">
                                                                    <Button icon={<PhoneOutlined />} className="cm-messenger-header-action" />
                                                                </Tooltip>
                                                                <Tooltip title="Video Call">
                                                                    <Button icon={<VideoCameraOutlined />} className="cm-messenger-header-action" />
                                                                </Tooltip>
                                                                <Tooltip title="Customer Profile">
                                                                    <Button 
                                                                        icon={<UserOutlined />} 
                                                                        className="cm-messenger-header-action"
                                                                        onClick={() => handleViewCustomerDetails(selectedChatCustomer)}
                                                                    />
                                                                </Tooltip>
                                                                <Tooltip title="More options">
                                                                    <Button icon={<EllipsisOutlined />} className="cm-messenger-header-action" />
                                                                </Tooltip>
                                                            </div>
                                                        </div>

                                                        {/* Messages */}
                                                        <div className="cm-messenger-chat-messages" ref={chatContainerRef}>
                                                            {chatMessages.length === 0 ? (
                                                                <div className="cm-messenger-chat-empty-state">
                                                                    <MessageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                                    <p>No messages yet</p>
                                                                    <span>Send the first message to start the conversation</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="cm-messenger-date-divider">
                                                                        <span className="cm-messenger-date-label">Today</span>
                                                                    </div>
                                                                    {chatMessages.map((msg, index) => {
                                                                        const isAdmin = msg.isAdmin || msg.sender_type === 'admin';
                                                                        const showAvatar = !isAdmin && (index === 0 || 
                                                                            chatMessages[index - 1]?.sender_type !== 'customer');
                                                                        
                                                                        return (
                                                                            <div
                                                                                key={`${msg.id || msg.message_id || 'msg'}-${msg.created_at || index}`}
                                                                                className={`cm-message-wrapper ${isAdmin ? 'cm-message-admin' : 'cm-message-customer'}`}
                                                                            >
                                                                                {!isAdmin && showAvatar && (
                                                                                    <div className="cm-message-sender">
                                                                                        <Avatar size={24} icon={<UserOutlined />} style={{ backgroundColor: '#64748b', marginRight: 6 }} />
                                                                                        {msg.sender_name || 'Customer'}
                                                                                    </div>
                                                                                )}
                                                                                <div className={`cm-message-bubble-wrapper ${isAdmin ? 'cm-message-admin' : 'cm-message-customer'}`}>
                                                                                    <div className={`cm-message-bubble ${isAdmin ? 'cm-message-bubble-admin' : 'cm-message-bubble-customer'}`}>
                                                                                        <div className="cm-message-text">{msg.message}</div>
                                                                                        <div className="cm-message-meta">
                                                                                            <span className="cm-message-time">
                                                                                                {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                                                                                            </span>
                                                                                            {isAdmin && (
                                                                                                <span className="cm-message-status">
                                                                                                    <CheckCircleOutlined />
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {isTyping && (
                                                                        <div className="cm-message-typing">
                                                                            <div className="cm-typing-indicator">
                                                                                <span></span>
                                                                                <span></span>
                                                                                <span></span>
                                                                            </div>
                                                                            <span className="cm-typing-text">Admin is typing...</span>
                                                                        </div>
                                                                    )}
                                                                    <div ref={messagesEndRef} />
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Chat Input */}
                                                        <div className="cm-messenger-chat-input">
                                                            <Button 
                                                                icon={<PaperClipOutlined />} 
                                                                className="cm-chat-attach-btn"
                                                                onClick={() => fileInputRef.current?.click()}
                                                            />
                                                            <TextArea
                                                                value={newMessage}
                                                                onChange={(e) => setNewMessage(e.target.value)}
                                                                onKeyDown={handleKeyPress}
                                                                placeholder="Write a message..."
                                                                className="cm-chat-textarea"
                                                                autoSize={{ minRows: 1, maxRows: 3 }}
                                                            />
                                                            <Button
                                                                type="primary"
                                                                icon={<SendOutlined />}
                                                                className="cm-chat-send-btn"
                                                                onClick={() => handleSendMessage()}
                                                                loading={sendMessage.isPending}
                                                                disabled={!newMessage.trim()}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="cm-messenger-chat-empty">
                                                        <div className="cm-messenger-chat-empty-content">
                                                            <MessageOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
                                                            <h3>Select a conversation</h3>
                                                            <p>Choose a customer from the sidebar to start chatting</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            style={{ display: 'none' }} 
                                            accept="image/*,.pdf,.doc,.docx"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    message.info(`File "${file.name}" would be attached (feature coming soon)`);
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                    </div>
                                )
                            }
                        ]}
                    />
                </Card>

                {/* ==================== MODALS ==================== */}

                {/* ==================== CUSTOMER MODAL ==================== */}
                <Modal
                    title={
                        <div className="cm-modal-header-clean">
                            <div className="cm-modal-title-icon">{selectedItem ? <EditOutlined /> : <PlusOutlined />}</div>
                            <div className="cm-modal-title-text">{selectedItem ? 'Edit Customer' : 'Add New Customer'}</div>
                            <div className="cm-modal-badge">{selectedItem ? `ID: ${selectedItem.customer_code}` : 'New'}</div>
                        </div>
                    }
                    open={customerModalVisible}
                    onCancel={() => { setCustomerModalVisible(false); customerForm.resetFields(); }}
                    width={700}
                    className={modalClass}
                    footer={null}
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="cm-modal-clean-content">
                        <Form form={customerForm} layout="vertical" onFinish={handleSaveCustomer}>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
                                        <Input placeholder="Enter first name" className="cm-input-enhanced" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
                                        <Input placeholder="Enter last name" className="cm-input-enhanced" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                                        <Input placeholder="email@example.com" className="cm-input-enhanced" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="phone" label="Phone">
                                        <Input placeholder="Contact number" className="cm-input-enhanced" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="address" label="Address">
                                <Input placeholder="Address" className="cm-input-enhanced" />
                            </Form.Item>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="tier" label="Tier">
                                        <Select className="cm-select-enhanced">
                                            <Option value="bronze">Bronze</Option>
                                            <Option value="silver">Silver</Option>
                                            <Option value="gold">Gold</Option>
                                            <Option value="platinum">Platinum</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="dietary_restrictions" label="Dietary Restrictions">
                                        <Input placeholder="Any dietary restrictions?" className="cm-input-enhanced" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="notes" label="Notes">
                                <TextArea rows={2} placeholder="Additional notes about customer" className="cm-textarea-enhanced" />
                            </Form.Item>
                            <div className="cm-modal-footer-enhanced">
                                <Button onClick={() => { setCustomerModalVisible(false); customerForm.resetFields(); }} className="cm-btn-cancel">Cancel</Button>
                                <Button type="primary" htmlType="submit" loading={createCustomer.isPending || updateCustomer.isPending} className="cm-btn-primary">
                                    <SaveOutlined /> {selectedItem ? 'Update Customer' : 'Add Customer'}
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>

                {/* ==================== CUSTOMER DETAILS DRAWER ==================== */}
                <Drawer
                    title={
                        <div className="cm-drawer-header-clean">
                            <UserOutlined style={{ color: '#1a7ab5' }} />
                            <span>Customer Details</span>
                        </div>
                    }
                    open={customerDetailsVisible}
                    onClose={() => setCustomerDetailsVisible(false)}
                    width={650}
                    className={drawerClass}
                    placement="right"
                >
                    {selectedCustomer ? (
                        <div className="cm-drawer-content">
                            <div className="cm-customer-profile">
                                <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1a7ab5' }} />
                                <div className="cm-profile-info">
                                    <Title level={4}>{selectedCustomer.person?.first_name || ''} {selectedCustomer.person?.last_name || ''}</Title>
                                    <div><MailOutlined /> {selectedCustomer.person?.email || 'N/A'}</div>
                                    <div><PhoneOutlined /> {selectedCustomer.person?.phone || 'N/A'}</div>
                                </div>
                            </div>
                            
                            <Divider className="cm-drawer-divider" />
                            
                            <Title level={5}>Statistics</Title>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <div className="cm-stat-box">
                                        <Text type="secondary">Total Bookings</Text>
                                        <div className="cm-stat-num">{selectedCustomer.total_bookings || 0}</div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div className="cm-stat-box">
                                        <Text type="secondary">Total Spent</Text>
                                        <div className="cm-stat-num">₱{(selectedCustomer.total_spent || 0).toLocaleString()}</div>
                                    </div>
                                </Col>
                            </Row>
                            
                            <Divider className="cm-drawer-divider" />
                            
                            <Title level={5}>Loyalty & Tier</Title>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <div className="cm-stat-box">
                                        <Text type="secondary">Loyalty Points</Text>
                                        <div className="cm-stat-num">
                                            <GiftOutlined /> {getLoyaltyPoints(selectedCustomer)}
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <div className="cm-stat-box">
                                        <Text type="secondary">Tier</Text>
                                        <div className="cm-stat-num">
                                            {(() => {
                                                const tierInfo = getCustomerTier(selectedCustomer);
                                                return <span style={{ color: tierInfo.color }}>{tierInfo.icon} {tierInfo.tier.toUpperCase()}</span>;
                                            })()}
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                            
                            <Divider className="cm-drawer-divider" />
                            
                            <Title level={5}>Preferences</Title>
                            <Descriptions column={1} size="small" className="cm-descriptions-drawer">
                                <Descriptions.Item label="Dietary Restrictions">{selectedCustomer.dietary_restrictions || 'None'}</Descriptions.Item>
                                <Descriptions.Item label="Notes">{selectedCustomer.notes || 'No notes'}</Descriptions.Item>
                            </Descriptions>
                            
                            <Divider className="cm-drawer-divider" />
                            
                            <Title level={5}>Booking History</Title>
                            <Table 
                                dataSource={customerBookings} 
                                columns={bookingColumns.slice(0, 5)} 
                                pagination={false} 
                                size="small" 
                                className={tableClass}
                                rowKey="booking_id"
                                locale={{
                                    emptyText: (
                                        <div className="cm-empty-state">
                                            <CalendarOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
                                            <p style={{ marginTop: 12, color: '#999' }}>No bookings yet</p>
                                        </div>
                                    )
                                }}
                            />
                        </div>
                    ) : (
                        <div className="cm-drawer-loading">
                            <Skeleton active avatar paragraph={{ rows: 4 }} />
                        </div>
                    )}
                </Drawer>

                {/* ==================== FEEDBACK MODAL ==================== */}
                <Modal
                    title={
                        <div className="cm-modal-header-clean">
                            <div className="cm-modal-title-icon"><StarOutlined /></div>
                            <div className="cm-modal-title-text">Feedback Details</div>
                            <div className="cm-modal-badge">{selectedItem?.customer_name || 'Customer'}</div>
                        </div>
                    }
                    open={feedbackModalVisible}
                    onCancel={() => { setFeedbackModalVisible(false); feedbackForm.resetFields(); }}
                    width={600}
                    className={modalClass}
                    footer={null}
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedItem ? (
                        <div className="cm-modal-clean-content">
                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Customer">{selectedItem.customer_name || 'Customer'}</Descriptions.Item>
                                <Descriptions.Item label="Rating"><Rate disabled allowHalf value={selectedItem.overall_rating || 0} /></Descriptions.Item>
                                <Descriptions.Item label="Food"><Rate disabled value={selectedItem.food_rating || 0} /></Descriptions.Item>
                                <Descriptions.Item label="Service"><Rate disabled value={selectedItem.service_rating || 0} /></Descriptions.Item>
                                <Descriptions.Item label="Comment">{selectedItem.comment || 'No comment provided'}</Descriptions.Item>
                                <Descriptions.Item label="Date">{selectedItem.created_at ? formatDateTime(selectedItem.created_at) : 'N/A'}</Descriptions.Item>
                            </Descriptions>

                            <Divider />
                            <Form form={feedbackForm} layout="vertical" onFinish={handleRespondToFeedback}>
                                <Form.Item name="response" label="Admin response" rules={[{ required: true, message: 'Please enter your response' }]}>
                                    <TextArea rows={4} placeholder="Write a reply to this customer feedback..." />
                                </Form.Item>
                                <div className="cm-modal-footer-enhanced">
                                    <Button onClick={() => { setFeedbackModalVisible(false); feedbackForm.resetFields(); }} className="cm-btn-cancel">Cancel</Button>
                                    <Button type="primary" htmlType="submit" loading={respondToFeedback.isPending} className="cm-btn-primary">
                                        <SendOutlined /> Send Response
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    ) : (
                        <div className="cm-modal-loading"><Skeleton active paragraph={{ rows: 4 }} /></div>
                    )}
                </Modal>

                {/* ==================== SEND MESSAGE MODAL ==================== */}
                <Modal
                    title={
                        <div className="cm-modal-header-clean">
                            <div className="cm-modal-title-icon"><MessageOutlined /></div>
                            <div className="cm-modal-title-text">Send Message</div>
                            <div className="cm-modal-badge">New Message</div>
                        </div>
                    }
                    open={messageModalVisible}
                    onCancel={() => { setMessageModalVisible(false); messageForm.resetFields(); }}
                    width={500}
                    className={modalClass}
                    footer={null}
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="cm-modal-clean-content">
                        <Form form={messageForm} layout="vertical" onFinish={handleSendMessage}>
                            <Form.Item name="customer_id" label="To" rules={[{ required: true }]}>
                                <Select 
                                    placeholder="Select customer" 
                                    showSearch 
                                    optionFilterProp="children"
                                    className="cm-select-enhanced"
                                >
                                    {customers.map(c => (
                                        <Option key={c.customer_id} value={c.customer_id}>
                                            {c.person?.first_name || ''} {c.person?.last_name || ''} - {c.person?.email || ''}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item name="message" label="Message" rules={[{ required: true }]}>
                                <TextArea rows={5} placeholder="Type your message here..." className="cm-textarea-enhanced" />
                            </Form.Item>
                            <div className="cm-modal-footer-enhanced">
                                <Button onClick={() => { setMessageModalVisible(false); messageForm.resetFields(); }} className="cm-btn-cancel">Cancel</Button>
                                <Button type="primary" htmlType="submit" loading={sendMessage.isPending} className="cm-btn-primary">
                                    <SendOutlined /> Send Message
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>
            </div>
        </ConfigProvider>
    );
};

export default CustomerManagement;