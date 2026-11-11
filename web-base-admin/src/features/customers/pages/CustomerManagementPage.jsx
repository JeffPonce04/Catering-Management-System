// src/components/CustomerManagement.jsx - ENHANCED MESSENGER + CLEAN DIRECTORY

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card, Table, Button, Space, Input, Select, Modal, Tabs, Tag, Divider, Tooltip, Typography, Row, Col,
    Descriptions, Alert, DatePicker, Popconfirm, Badge, Empty, Form, Dropdown, Progress, Statistic, InputNumber,
    Avatar, Rate, List, Drawer, ConfigProvider, theme as antdTheme, Skeleton, Switch, App
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
       CheckOutlined, CloseOutlined, EllipsisOutlined, InfoCircleOutlined,
         PushpinOutlined, StopOutlined, InboxOutlined, LikeFilled, RollbackOutlined
} from '@ant-design/icons';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, useCustomerBookings,
     useCustomerFeedback, useCustomerReviews, useCustomerMessages, useSendCustomerMessage,
     useRespondToFeedback, useApproveReview, useHideReview, useFeatureReview,
     useMarkMessageRead } from '../../../hooks/useCustomerQueries';
import { format } from 'date-fns';import { formatDate, formatDateTime, isValidDate } from '../../../utils/dateUtils';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, hasAllowedRole, BOOKING_QUOTATION_PATH } from '../../../utils/roleRoutes';import '../styles/CustomerManagement.css';

const { Title, Text, Paragraph } = Typography;

// ⭐ Data for Emoji and Sticker pickers
const EMOJI_LIST = ['😊', '😂', '❤️', '👍', '🔥', '😍', '🙏', '👏', '😭', '😎', '🎉', '😡', '🤔', '😅', '😇'];
const STICKER_LIST = ['👍', '❤️', '😂', '😮', '😢', '😡', '👋', '🎉', '🔥', '⭐', '💯', '🙌'];const { Option } = Select;
const { TextArea } = Input;

// ============================================================
// HELPERS (outside component so they don't get re-created)
// ============================================================
const getInitials = (customer) => {
    const first = customer?.person?.first_name?.[0] || '';
    const last = customer?.person?.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
};

// ⭐ Compact relative time — replaces formatDistanceToNow which lacks a suffix.
const formatRelativeTime = (value) => {
    if (!value) return '';
    try {
        const diff = Date.now() - new Date(value).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        return format(new Date(value), 'MMM d');
    } catch {
        return '';
    }
};

const safeMessages = (list) => (Array.isArray(list) ? list : []);

const groupMessagesByDate = (list) => {
    const groups = [];
    let current = null;
    safeMessages(list).forEach((msg) => {
        const d = msg.created_at ? new Date(msg.created_at) : new Date();
        const dayKey = d.toDateString();
        if (!current || current.key !== dayKey) {
            current = { key: dayKey, date: d, messages: [] };
            groups.push(current);
        }
        current.messages.push(msg);
    });
    return groups;
};

// ⭐ Removed the 50-word limit to match the wide box in the reference image.
const splitMessageIntoWrappedLines = (text) => {
    const raw = String(text ?? '');
    if (!raw) return [];
    // Just return the whole text as a single line; CSS will handle the wrapping.
    return [raw];
};
// ⭐ REQUEST 2.10 — MIME + size validation, mirroring the backend rules.
const ALLOWED_ATTACHMENT_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    file: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
    ],
};

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

const classifyAttachment = (mime = '') => {
    if (ALLOWED_ATTACHMENT_TYPES.image.includes(mime)) return 'image';
    if (ALLOWED_ATTACHMENT_TYPES.video.includes(mime)) return 'video';
    if (ALLOWED_ATTACHMENT_TYPES.file.includes(mime)) return 'file';
    return null;
};

const validateAttachment = (file) => {
    if (!file) return 'No file selected.';
    const kind = classifyAttachment(file.type);
    if (!kind) return `Unsupported file type: ${file.type || 'unknown'}.`;
    if (file.size > MAX_ATTACHMENT_BYTES) {
        return `File is too large. Max ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`;
    }
    return null;
};
const CustomerManagement = () => {
    const { user } = useAuth();
    const navigate = useNavigate(); // ⭐ Add this
    const canManageCustomerModeration = hasAllowedRole(user, ADMIN_ROLES);
    // ⭐ Use App.useApp() for both `modal` and `message` so all toast
    //    notifications inherit the current theme. This also silences the
    //    "Static function can not consume context" warning.
    const { modal, message } = App.useApp();
    // ==================== STATE MANAGEMENT ====================
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterTier, setFilterTier] = useState('all');
      const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(11);
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

    // ⭐ REQUEST 2.4 — Inbox view: 'inbox' | 'archived'
    const [inboxView, setInboxView] = useState('inbox');

    // ⭐ REQUEST 2.8 — Pinned message id + pinned customer ids (per admin).
    const [pinnedMessageId, setPinnedMessageId] = useState(null);
    const [pinnedCustomerIds, setPinnedCustomerIds] = useState(() => {
        try {
            const raw = localStorage.getItem('pinned_customer_ids');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch { return []; }
    });

    // ⭐ REQUEST 2.4 — Blocked customer ids (server-persisted via API).
    const [blockedCustomerIds, setBlockedCustomerIds] = useState([]);

    // ⭐ REQUEST 2.5 + 2.9 — Messages being deleted (animate out first).
    const [deletingMessageIds, setDeletingMessageIds] = useState([]);
    const [conversationRemoving, setConversationRemoving] = useState(false);

    // ⭐ REQUEST 2.10 — Attachment state.
       const [pendingAttachments, setPendingAttachments] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    // ⭐ State for the message being replied to
    const [replyingTo, setReplyingTo] = useState(null);
    const [customerForm] = Form.useForm();
    const [feedbackForm] = Form.useForm();
    const [messageForm] = Form.useForm();

    // ⭐ REQUEST 2.8 — Persist pinned customers locally.
    useEffect(() => {
        try {
            localStorage.setItem('pinned_customer_ids', JSON.stringify(pinnedCustomerIds));
        } catch { /* ignore */ }
    }, [pinnedCustomerIds]);

    // ⭐ REQUEST 2.4 — Load blocked customer ids from the backend.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/customer-messages/blocked');
                const rows = res?.data?.data || res?.data || [];
                if (!cancelled) {
                    setBlockedCustomerIds(
                        (Array.isArray(rows) ? rows : []).map((r) => String(r.customer_id))
                    );
                }
            } catch (e) {
                // Endpoint may not exist yet — treat as empty, not fatal.
            }
        })();
        return () => { cancelled = true; };
    }, []);
        // ==================== DEBOUNCED SEARCH ====================
    // ⭐ Prevents a fetch on every keystroke.
    const [debouncedSearchText, setDebouncedSearchText] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearchText(searchText), 350);
        return () => clearTimeout(t);
    }, [searchText]);

    // Stable filter object so React Query doesn't refetch on identity churn.
    const customerFilters = useMemo(() => ({
        page: currentPage,
        per_page: pageSize,
        search: debouncedSearchText || undefined,
        is_active: filterStatus !== 'all' ? (filterStatus === 'active') : undefined,
        tier: filterTier !== 'all' ? filterTier : undefined,
    }), [currentPage, pageSize, debouncedSearchText, filterStatus, filterTier]);

    // ==================== REACT QUERY HOOKS ====================
    const { data: customersData, isLoading: customersLoading, refetch: refetchCustomers } = useCustomers(customerFilters);

    // ⭐ MESSENGER LIST — a separate, unpaginated fetch so the Messenger
    //    sidebar can show ALL customers, not just the current Directory
    //    page. The Directory tab keeps its own paginated query above.
    const {
        data: messengerCustomersData,
        isLoading: messengerCustomersLoading,
        refetch: refetchMessengerCustomers,
    } = useCustomers({ per_page: 1000 });
    const messengerCustomers = messengerCustomersData?.data || [];
    const createCustomer = useCreateCustomer();
    const updateCustomer = useUpdateCustomer();
    const deleteCustomer = useDeleteCustomer();
    const sendMessage = useSendCustomerMessage();
    // ⭐ Marks a customer message as read on the server so the unread
    //    badge clears when the conversation is opened.
    const markMessageRead = useMarkMessageRead();
    const respondToFeedback = useRespondToFeedback();
    const approveReview = useApproveReview();
    const hideReview = useHideReview();
    const featureReview = useFeatureReview();

       const {
           data: customerBookings = [],
           isLoading: customerBookingsLoading,
           isError: customerBookingsError,
           error: customerBookingsErrorObj,
           refetch: refetchBookings,
       } = useCustomerBookings(selectedCustomer?.customer_id);    const { data: feedbacks = [], refetch: refetchFeedbacks } = useCustomerFeedback({}, { enabled: canManageCustomerModeration });
    const { data: reviews = [], refetch: refetchReviews } = useCustomerReviews({}, { enabled: canManageCustomerModeration });

    // ⭐ The backend returns a *paginated list of ChatThreads*, each with a
    //    nested `messages` array. Flatten to a plain message array so every
    //    downstream `messages.filter(...)` and unread badge stays correct.
       const { data: rawMessageThreads, refetch: refetchMessages } = useCustomerMessages();

    // ⭐ REQUEST 2.1 / 2.7 — Flatten whatever shape `useCustomerMessages`
    //    returns into a stable, sorted message array. Because the cache is
    //    patched by useSendCustomerMessage using the same deep-walk that
    //    handles { data: { data: [...] } } AND { data: [...] } AND
    //    [...threads], both directions stay in sync and switching customers
    //    never loses a just-sent bubble.
    const messages = useMemo(() => {
        const findThreadsArray = (node, depth = 0) => {
            if (depth > 6 || node == null) return null;
            if (Array.isArray(node)) return node;
            if (typeof node !== 'object') return null;
            if (Array.isArray(node.data)) return node.data;
            if (node.data && typeof node.data === 'object') {
                const found = findThreadsArray(node.data, depth + 1);
                if (found) return found;
            }
            return null;
        };

        const threads = findThreadsArray(rawMessageThreads) || [];

        return threads
            .flatMap((thread) =>
                (thread.messages || []).map((msg) => ({
                    ...msg,
                    id: msg.message_id || msg.id,
                    message_id: msg.message_id || msg.id,
                    thread_id: thread.thread_id,
                    customer_id: thread.customer_id,
                    customer: thread.customer,
                    delivery_status: msg.delivery_status || 'sent',
                    sender_type: msg.sender_user_id ? 'admin' : 'customer',
                    isAdmin: !!msg.sender_user_id,
                    sender_name: msg.sender?.person?.first_name
                        ? `${msg.sender.person.first_name} ${msg.sender.person.last_name || ''}`.trim()
                        : (msg.sender_user_id ? 'Admin' : 'Customer'),
                }))
            )
            .sort((a, b) => {
                const da = new Date(a.created_at || 0).getTime();
                const db = new Date(b.created_at || 0).getTime();
                if (da !== db) return da - db;
                return String(a.id || '').localeCompare(String(b.id || ''));
            });
    }, [rawMessageThreads]);
    // ==================== GLOBAL STATS (KPI CARDS) ====================
    // ⭐ The table only paginates `customers`. KPI cards must show global
    //    totals, so pull them from /customers/stats once.
    const [customerStats, setCustomerStats] = useState({
        total_customers: 0,
        active_customers: 0,
        new_this_month: 0,
        avg_rating: 0,
        total_reviews: 0,
        loyal_customers: 0,
    });
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/customers/stats');
                const payload = res?.data?.data || res?.data || {};
                if (!cancelled) setCustomerStats(payload);
            } catch (err) {
                console.warn('Failed to load customer stats:', err);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // ==================== DATA TRANSFORMATIONS ====================
    const customers = customersData?.data || [];
    const totalCustomers = customerStats.total_customers || customersData?.total || 0;
    const activeCustomers = customerStats.active_customers || customers.filter(c => c.is_active !== false).length;

    // ⭐ Revenue falls back to the current page sum if the API omits it.
    const totalRevenue = safeNumber(customerStats.total_revenue)
        || customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);

    const avgRating = customerStats.avg_rating
        ? Number(customerStats.avg_rating).toFixed(1)
        : (feedbacks.length > 0
            ? (feedbacks.reduce((sum, f) => sum + (f.overall_rating || 0), 0) / feedbacks.length).toFixed(1)
            : '0');

    const positiveSentiment = feedbacks.filter(f => f.sentiment === 'positive').length;
    const pendingReviews = reviews.filter(r => !r.is_approved).length;
    // ⭐ Derive unread count from the local chat-state as well as the cache,
    //    so the badge reacts immediately when a conversation is opened.
    const unreadMessageCount = useMemo(() => {
        const locallyReadIds = new Set(
            chatMessages
                .filter((m) => m.read_at && m.sender_type === 'customer')
                .map((m) => String(m.message_id || m.id))
        );
        return messages.filter((m) => {
            if (m.read_at) return false;
            if (m.sender_type !== 'customer') return false;
            return !locallyReadIds.has(String(m.message_id || m.id));
        }).length;
    }, [messages, chatMessages]);
    // ⭐ Small numeric guard used by the revenue fallback above.
    function safeNumber(v, fallback = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    }
    // ==================== TIER CALCULATION ====================
    // ⭐ REQUEST 1.3 — Tiers are based on TOTAL ELIGIBLE BOOKINGS
    //    (cancelled/rejected excluded, handled by the backend).
    //    Bronze 1–2 · Silver 3–5 · Gold 6–10 · Platinum 11–20 · Diamond 21+
    const getCustomerTier = (customerOrTier) => {
        const tier = String(
            typeof customerOrTier === 'object' ? customerOrTier?.tier : customerOrTier,
        ).toLowerCase();
        const tiers = {
            diamond: { tier: 'diamond', icon: <TrophyOutlined />, color: '#0891b2', bg: '#cffafe' },
            platinum: { tier: 'platinum', icon: <CrownOutlined />, color: '#8b5cf6', bg: '#f5f3ff' },
            gold: { tier: 'gold', icon: <StarFilled />, color: '#f59e0b', bg: '#fffbeb' },
            silver: { tier: 'silver', icon: <StarOutlined />, color: '#94a3b8', bg: '#f1f5f9' },
            bronze: { tier: 'bronze', icon: <FireOutlined />, color: '#d97706', bg: '#fffbeb' },
        };
        return tiers[tier] || { tier: 'not recorded', icon: <InfoCircleOutlined />, color: '#64748b', bg: '#f1f5f9' };
    };

    const getLoyaltyPoints = (customer) => Number(customer?.loyalty_points ?? 0);

      // ⭐ Reset to page 1 whenever filters change so the user isn't stranded
    //    on an empty page after narrowing the result set.
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchText, filterStatus, filterTier, pageSize]);

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
            .sort((a, b) => {
                const da = new Date(a.created_at || 0).getTime();
                const db = new Date(b.created_at || 0).getTime();
                if (da !== db) return da - db;
                // ⭐ Tie-break by ID so identical-second messages stay stable.
                return String(a.message_id || a.id || '').localeCompare(
                    String(b.message_id || b.id || '')
                );
            });
    }, [messages]);

       useEffect(() => {
        if (!selectedChatCustomer) return;

        const next = getCustomerMessages(selectedChatCustomer);

        setChatMessages((prev) => {
            // ⭐ REQUEST 2.1 / 2.7 — Merge, don't replace. If any message in
            //    `prev` is missing from `next` AND it's a still-recent
            //    message we sent, keep it. This covers the case where the
            //    refetch arrives before the server returns the new row.
            const nextIds = new Set(next.map((n) => String(n.id)));
            const localOnly = prev.filter((p) => {
                if (nextIds.has(String(p.id))) return false;
                const ageMs = Date.now() - new Date(p.created_at || 0).getTime();
                const recent = ageMs < 60_000;
                const stillMine =
                    p.sender_type === 'admin' || p.isAdmin === true;
                return stillMine && recent;
            });

            if (localOnly.length === 0) {
                const sameLength = prev.length === next.length;
                const sameIds =
                    sameLength &&
                    prev.every((p, i) => String(p.id) === String(next[i]?.id));
                return sameIds ? prev : next;
            }

            // Merge: server list wins on conflicts, local-only kept.
            const byId = new Map();
            next.forEach((n) => byId.set(String(n.id), n));
            localOnly.forEach((p) => {
                if (!byId.has(String(p.id))) byId.set(String(p.id), p);
            });

            const merged = Array.from(byId.values()).sort((a, b) => {
                const da = new Date(a.created_at || 0).getTime();
                const db = new Date(b.created_at || 0).getTime();
                if (da !== db) return da - db;
                return String(a.id || '').localeCompare(String(b.id || ''));
            });
            return merged;
        });
    }, [selectedChatCustomer, getCustomerMessages]);
     // ⭐ Marks every unread customer-side message in this conversation as
    //    read — locally (instant badge drop) AND on the server (persisted).
    //    Also referenced by the Tabs onChange handler so switching back to
    //    the Messenger tab re-clears the badge for the current chat.
    const markConversationAsRead = useCallback(
        (customer) => {
            if (!customer?.customer_id) return;

            const unreadForThisCustomer = messages.filter(
                (m) =>
                    String(m.customer_id) === String(customer.customer_id) &&
                    !m.read_at &&
                    m.sender_type === 'customer'
            );

            if (unreadForThisCustomer.length === 0) return;

            const nowIso = new Date().toISOString();

            // Optimistic local update → tab badge + sidebar badge clear
            // immediately, before any network round-trip.
            setChatMessages((prev) =>
                prev.map((m) =>
                    String(m.customer_id) === String(customer.customer_id) &&
                    !m.read_at &&
                    m.sender_type === 'customer'
                        ? { ...m, read_at: nowIso }
                        : m
                )
            );

            // Persist the read state on the server (one call per message).
            unreadForThisCustomer.forEach((m) => {
                const id = m.message_id || m.id;
                if (!id) return;
                markMessageRead.mutateAsync(id).catch(() => {
                    /* Silent — next poll reconciles. */
                });
            });
        },
        [messages, markMessageRead]
    );

    // ⭐ Wire the read-clear into opening a chat so the badge drops the
    //    instant you click the customer in the sidebar.
    const openMessageViewWithRead = useCallback(
        (customer) => {
            if (!customer) return;
            setSelectedChatCustomer(customer);
            setChatMessages(getCustomerMessages(customer));
            setIsMessageViewOpen(true);
            setIsTyping(false);
            markConversationAsRead(customer);
        },
        [getCustomerMessages, markConversationAsRead]
    );

     const closeMessageView = () => {
        setIsMessageViewOpen(false);
        setSelectedChatCustomer(null);
        setChatMessages([]);
        setNewMessage('');
    };



    // ⭐ REQUEST 2.4 — Archive conversation (non-destructive).
    const handleArchiveConversation = async (customer) => {
        if (!customer?.customer_id) return;
        try {
            await api.post(`/customer-messages/${customer.customer_id}/archive`);
            message.success('Conversation archived. You can restore it from the Archived view.');
            await refetchMessages();
        } catch (e) {
            message.error(e?.response?.data?.message || 'Failed to archive conversation');
        }
    };

    const handleRestoreConversation = async (customer) => {
        if (!customer?.customer_id) return;
        try {
            await api.post(`/customer-messages/${customer.customer_id}/unarchive`);
            message.success('Conversation restored.');
            await refetchMessages();
        } catch (e) {
            message.error(e?.response?.data?.message || 'Failed to restore conversation');
        }
    };

    // ⭐ REQUEST 2.4 — Block / Unblock (history preserved).
    const handleToggleBlock = (customer) => {
        if (!customer?.customer_id) return;
        const isBlocked = blockedCustomerIds.includes(String(customer.customer_id));
        modal.confirm({
            title: isBlocked ? 'Unblock this customer?' : 'Block this customer?',
            content: isBlocked
                ? 'The customer will be able to send messages again. History is preserved.'
                : 'The customer will no longer be able to send messages. History and account are preserved.',
            okText: isBlocked ? 'Unblock' : 'Block',
            okButtonProps: { danger: !isBlocked },
            onOk: async () => {
                try {
                    const endpoint = isBlocked ? 'unblock' : 'block';
                    await api.post(`/customer-messages/${customer.customer_id}/${endpoint}`);
                    setBlockedCustomerIds((prev) =>
                        isBlocked
                            ? prev.filter((id) => id !== String(customer.customer_id))
                            : [...prev, String(customer.customer_id)]
                    );
                    message.success(isBlocked ? 'Customer unblocked.' : 'Customer blocked.');
                } catch (e) {
                    message.error(e?.response?.data?.message || 'Failed to update block state');
                }
            },
        });
    };

    // ⭐ REQUEST 2.4 + 2.9 — Delete conversation (for everyone).
    const handleDeleteConversation = (customer) => {
        if (!customer?.customer_id) return;
        modal.confirm({
            title: 'Delete this conversation?',
            content:
                'This removes the conversation and ALL its messages from BOTH admin and customer views. ' +
                'This cannot be undone.',
            okText: 'Delete conversation',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    // ⭐ Fade the whole conversation out first, then persist.
                    setConversationRemoving(true);
                    await api.delete(`/customer-messages/${customer.customer_id}/conversation`);

                    setTimeout(() => {
                        setConversationRemoving(false);
                        if (String(selectedChatCustomer?.customer_id) === String(customer.customer_id)) {
                            closeMessageView();
                        }
                    }, 240);

                    message.success('Conversation deleted for everyone.');
                    await refetchMessages();
                } catch (e) {
                    setConversationRemoving(false);
                    message.error(e?.response?.data?.message || 'Failed to delete conversation');
                }
            },
        });
    };

        const handleSendMessage = async (values = null) => {
        const targetCustomer = values?.customer_id
            ? customers.find(c => String(c.customer_id) === String(values.customer_id))
            : selectedChatCustomer;
        const messageContent = (values?.message ?? newMessage).trim();

        if (!messageContent && pendingAttachments.length === 0) {
            message.warning('Message or attachment is required.');
            return;
        }
        if (!targetCustomer) {
            message.warning('Please select a customer first.');
            return;
        }
        if (blockedCustomerIds.includes(String(targetCustomer.customer_id))) {
            message.warning('This customer is blocked. Unblock them to send messages.');
            return;
        }

            setNewMessage('');
        setReplyingTo(null); // ⭐ Clear reply state after sending

        // ⭐ REQUEST 2.10 — Optimistic bubble shows attachment previews.
        const localId = `temp-${Date.now()}`;
          const tempMessage = {
            id: localId,
            client_id: localId,
            customer_id: targetCustomer.customer_id,
            message: messageContent,
            sender_name: 'You',
            sender_type: 'admin',
            isAdmin: true,
            // Fresh timestamp ensures this bubble sorts last and never
            // gets dropped by the "recent local send" guard above.
            created_at: new Date().toISOString(),
            read_at: null,
            delivery_status: 'sending',
            attachments: pendingAttachments.map((a) => ({
                clientId: a.clientId,
                name: a.file.name,
                kind: a.kind,
                previewUrl: a.previewUrl,
                size: a.file.size,
            })),
        };
          setChatMessages(prev => [...prev, tempMessage]);
        setSelectedChatCustomer(targetCustomer);
        // ⭐ Removed setIsTyping(true) so the "Admin is typing..." indicator doesn't flash when you send a message.

        try {
            let response;

            // ⭐ REQUEST 2.10 — Multipart when attachments exist.
            if (pendingAttachments.length > 0) {
                const formData = new FormData();
                formData.append('customer_id', String(targetCustomer.customer_id));
                formData.append('message', messageContent || '');
                pendingAttachments.forEach((att, i) => {
                    formData.append(`attachments[${i}]`, att.file, att.file.name);
                });

                response = await api.post('/customer-messages', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (evt) => {
                        if (!evt.total) return;
                        const pct = Math.round((evt.loaded / evt.total) * 100);
                        const next = {};
                        pendingAttachments.forEach((att) => {
                            next[att.clientId] = pct;
                        });
                        setUploadProgress(next);
                    },
                });

                pendingAttachments.forEach((att) => {
                    if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                });
               } else {
                response = await sendMessage.mutateAsync({
                    customer_id: targetCustomer.customer_id,
                    message: messageContent,
                    reply_to_id: replyingTo ? replyingTo.id : null, // ⭐ Pass reply ID
                });
            }

            // ⭐ Confirm the bubble in place using the response payload.
            const raw = response?.data ?? {};
            const confirmed =
                raw?.data?.data ||
                raw?.data ||
                raw?.message ||
                raw ||
                {};            const confirmedId = String(
                confirmed?.message_id ||
                confirmed?.id ||
                confirmed?.data?.message_id ||
                localId
            );

            setChatMessages(prev =>
                prev.map((m) =>
                    m.id === localId
                        ? {
                              ...m,
                              ...(confirmed || {}),
                              id: confirmedId,
                              delivery_status: confirmed?.delivery_status || 'sent',
                          }
                        : m
                )
            );

            setIsTyping(false);
            setPendingAttachments([]);
            setUploadProgress({});

            // ⭐ Request 2.1 / 2.7 — Wait for the backend to actually
            //    return the message before we overwrite chatMessages.
            //    Without this guard, the very next render from useMemo
            //    would reset chatMessages to the stale list and the
            //    bubble would vanish.
            if (selectedChatCustomer) {
                const targetCustomerId = selectedChatCustomer.customer_id;
                let attempts = 0;
                const maxAttempts = 6;
                while (attempts < maxAttempts) {
                    const fresh = await refetchMessages();
                    const threadsPayload =
                        fresh?.data?.data?.data ??
                        fresh?.data?.data ??
                        [];
                    const threads = Array.isArray(threadsPayload) ? threadsPayload : [];
                    const matchedThread = threads.find(
                        (t) => String(t.customer_id) === String(targetCustomerId)
                    );
                    const hasMessage =
                        matchedThread?.messages?.some(
                            (mm) => String(mm.message_id || mm.id) === confirmedId
                        ) || false;
                    if (hasMessage) break;
                    attempts += 1;
                    await new Promise((r) => setTimeout(r, 250));
                }
            }

            if (values?.customer_id) {
                setMessageModalVisible(false);
                messageForm.resetFields();
                setIsMessageViewOpen(true);
            }
        } catch (error) {
            setIsTyping(false);
            message.error(
                error?.response?.data?.message ||
                error?.message ||
                'Failed to send message'
            );
            setChatMessages(prev =>
                prev.map((m) =>
                    m.id === localId ? { ...m, delivery_status: 'failed' } : m
                )
            );
        }
    };
      const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // ⭐ REQUEST 2.5 + 2.9 — Animate out, then persist the deletion.
    //    Animation runs FIRST visually, but the API call is fired in
    //    parallel so it never delays the server-side update.
    const removeMessageWithAnimation = (messageId) => {
        setDeletingMessageIds((prev) => [...prev, messageId]);
        // Remove from visible list after the fade/shrink completes.
        setTimeout(() => {
            setChatMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
            setDeletingMessageIds((prev) => prev.filter((id) => id !== messageId));
        }, 220);
    };

    const handleDeleteMessageForMe = async (msg) => {
        if (!msg?.id) return;
        modal.confirm({
            title: 'Delete for me?',
            content: 'This message will be hidden only from your view. The customer still sees it.',
            okText: 'Delete for me',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    removeMessageWithAnimation(msg.id);
                    await api.delete(`/customer-messages/${msg.id}?scope=me`);
                    // Persisted server-side → hide after refresh too.
                } catch (e) {
                    message.error(e?.response?.data?.message || 'Failed to delete message');
                    await refetchMessages();
                }
            },
        });
    };

    const handleDeleteMessageForEveryone = async (msg) => {
        if (!msg?.id) return;
        modal.confirm({
            title: 'Delete for everyone?',
            content: 'This message will be removed from BOTH admin and customer views and cannot be undone.',
            okText: 'Delete for everyone',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    // ⭐ Animate immediately, but do NOT wait for the API to
                    //    finish before removing the bubble from this view.
                    removeMessageWithAnimation(msg.id);
                    await api.delete(`/customer-messages/${msg.id}?scope=everyone`);
                    // Reverb broadcasts the deletion to the customer app.
                } catch (e) {
                    message.error(e?.response?.data?.message || 'Failed to delete for everyone');
                    await refetchMessages();
                }
            },
        });
    };

        useEffect(() => {
        if (!selectedChatCustomer) return;

        const next = getCustomerMessages(selectedChatCustomer);

        setChatMessages((prev) => {
            // ⭐ Guard: if the incoming `next` list has fewer messages than
            //    the current local state AND one of the local messages is
            //    still marked sending/sent-by-us, treat the refetch as
            //    stale and keep the local state. This is what prevents the
            //    "message disappears after sending" bug when React Query
            //    returns an older snapshot before the server catches up.
            if (next.length < prev.length) {
                const knownIds = new Set(next.map((n) => String(n.id)));
                const droppedLocallySent = prev.some((p) => {
                    if (knownIds.has(String(p.id))) return false;
                    const stillMine =
                        p.sender_type === 'admin' ||
                        p.isAdmin === true;
                    const notFailed = p.delivery_status !== 'failed';
                    const recent =
                        Date.now() - new Date(p.created_at || 0).getTime() < 15000;
                    return stillMine && notFailed && recent;
                });
                if (droppedLocallySent) {
                    // Merge: keep the older local bubbles that the server
                    // hasn't returned yet, in their original positions.
                    const merged = [...prev];
                    next.forEach((n) => {
                        const idx = merged.findIndex(
                            (m) => String(m.id) === String(n.id)
                        );
                        if (idx >= 0) merged[idx] = { ...merged[idx], ...n };
                        else merged.push(n);
                    });
                    // Re-sort by created_at then id for stable ordering.
                    merged.sort((a, b) => {
                        const da = new Date(a.created_at || 0).getTime();
                        const db = new Date(b.created_at || 0).getTime();
                        if (da !== db) return da - db;
                        return String(a.id || '').localeCompare(String(b.id || ''));
                    });
                    return merged;
                }
            }

            const sameLength = prev.length === next.length;
            const sameIds =
                sameLength &&
                prev.every((p, i) => String(p.id) === String(next[i]?.id));
            if (sameIds) return prev;
            return next;
        });
    }, [selectedChatCustomer, getCustomerMessages]);
         // ⭐ REQUEST 2.3 / 2.7 — Only auto-scroll when the user is ALREADY at
    //    the bottom. If they scrolled up to read older messages, leave them
    //    where they are. Also skip while a message is being deleted, so the
    //    animation doesn't cause a jump.
    useEffect(() => {
        if (!isMessageViewOpen) return;
        if (deletingMessageIds.length > 0) return;

        const container = chatContainerRef.current;
        if (!container) return;

        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;

        // Only auto-scroll if within 120px of the bottom.
        if (distanceFromBottom < 120 && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [chatMessages, isMessageViewOpen, deletingMessageIds]);
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

       const handleViewCustomerDetails = (record) => {
        setSelectedCustomer(record);
        setCustomerDetailsVisible(true);
        // ⭐ React Query auto-refetches when `customer_id` changes — no
        //    manual `refetchBookings()` needed here.
    };

    const handleCloseCustomerDetails = () => {
        setCustomerDetailsVisible(false);
        // ⭐ Clear the selection so the bookings query doesn't keep fetching.
        setSelectedCustomer(null);
    };

    /**
     * ⭐ REQUEST #2.3 — Rebook a customer from the Customer Directory.
     *
     * Finds the customer's latest booking, then hands off to the existing
     * booking page with `?rebook=<bookingId>` so the booking modal opens
     * with only the customer + address prefilled.
     */
       const handleRebookCustomer = (record) => {
        if (!record?.customer_id) {
            message.error('Invalid customer record.');
            return;
        }

            // ⭐ No more `GET /customers/:id/bookings`. We just hand off the
        //    customer_id to the Booking page — it will fetch the customer,
        //    prefill the name + address, and open the Create Booking modal
        //    on Step 1. Works even for first-time customers with zero
        //    previous bookings, and never times out.
      navigate(`/booking?rebook_customer=${record.customer_id}`);
        };

    const handleDeleteCustomer = (record) => {        modal.confirm({
            title: 'Delete Customer',
            content: `Are you sure you want to delete ${record.person?.first_name} ${record.person?.last_name}?`,
            okText: 'Delete',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            maskClosable: false,
            keyboard: false,
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
        const locallyReadIds = new Set(
            chatMessages
                .filter((m) => m.read_at && m.sender_type === 'customer')
                .map((m) => String(m.message_id || m.id))
        );
        return messages.filter((m) =>
            String(m.customer_id) === String(customerId) &&
            !m.read_at &&
            m.sender_type === 'customer' &&
            !locallyReadIds.has(String(m.message_id || m.id))
        ).length;
    };
    // ⭐ REQUEST 2.8 — Pin/unpin a message inside a conversation.
    const handleTogglePinMessage = async (msg) => {
        if (!msg?.id) return;
        const isPinned = String(pinnedMessageId) === String(msg.id);
        try {
            const endpoint = isPinned ? 'unpin' : 'pin';
            await api.post(`/customer-messages/${msg.id}/${endpoint}`);
            setPinnedMessageId(isPinned ? null : String(msg.id));
            message.success(isPinned ? 'Message unpinned.' : 'Message pinned.');
        } catch (e) {
            message.error(e?.response?.data?.message || 'Failed to update pin');
        }
    };

    // ⭐ REQUEST 2.8 — Selecting a pinned message scrolls to + highlights it.
    const scrollToPinnedMessage = (messageId) => {
        if (!messageId) return;
        const el = document.getElementById(`cm-msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('cm-message-highlight');
            setTimeout(() => el.classList.remove('cm-message-highlight'), 1600);
        }
    };

    // ⭐ REQUEST 2.8 — Pin/unpin a customer conversation (per admin).
    const handleTogglePinCustomer = (customerId) => {
        if (!customerId) return;
        const id = String(customerId);
        setPinnedCustomerIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    // ⭐ MESSENGER SIDEBAR — show ALL customers, sorted so that
    //    conversations with recent messages float to the top.
    const chatCustomers = useMemo(() => {
        const source = safeMessages(messengerCustomers);

        // Build a lookup of the most-recent message per customer.
        const lastMessageByCustomer = new Map();
        safeMessages(messages).forEach((m) => {
            const key = String(m.customer_id);
            const prev = lastMessageByCustomer.get(key);
            const ts = new Date(m.created_at || 0).getTime();
            if (!prev || ts > prev.ts) {
                lastMessageByCustomer.set(key, { ts, message: m });
            }
        });

        const term = (messageSearchTerm || '').trim().toLowerCase();

               return source
            .filter((c) => {
                // ⭐ REQUEST 2.4 — Respect inbox vs archived view.
                const isArchived = !!c.is_archived;
                if (inboxView === 'archived' && !isArchived) return false;
                if (inboxView === 'inbox' && isArchived) return false;

                if (!term) return true;
                return (
                    `${c.person?.first_name || ''} ${c.person?.last_name || ''}`
                        .toLowerCase()
                        .includes(term) ||
                    (c.person?.email || '').toLowerCase().includes(term)
                );
            })
            .map((c) => ({
                ...c,
                __lastMessageTs: lastMessageByCustomer.get(String(c.customer_id))?.ts || 0,
            }))
                      // ⭐ REQUEST 2.8 — Pinned customers float to the very top,
            //    then recent messages, then alphabetical.
            .sort((a, b) => {
                const aPinned = pinnedCustomerIds.includes(String(a.customer_id));
                const bPinned = pinnedCustomerIds.includes(String(b.customer_id));
                if (aPinned !== bPinned) return bPinned ? 1 : -1;

                if (b.__lastMessageTs !== a.__lastMessageTs) {
                    return b.__lastMessageTs - a.__lastMessageTs;
                }
                const an = `${a.person?.first_name || ''} ${a.person?.last_name || ''}`.trim();
                const bn = `${b.person?.first_name || ''} ${b.person?.last_name || ''}`.trim();
                return an.localeCompare(bn);
            });
    }, [messengerCustomers, messages, messageSearchTerm, pinnedCustomerIds, inboxView]);
     // ==================== TABLE COLUMNS ====================
    
    // ⭐ Calculate the Top 5 customers overall based on total bookings.
    // We only look at the customers in the current view.
    const topCustomersByBookings = [...customers]
        .sort((a, b) => (b.total_bookings || 0) - (a.total_bookings || 0))
        .slice(0, 5)
        .reduce((acc, c, index) => {
            // Only assign a top rank if they have at least 1 booking
            if ((c.total_bookings || 0) > 0) {
                acc[c.customer_id] = index + 1; // 1 for 1st, 2 for 2nd, etc.
            }
            return acc;
        }, {});

    const customerColumns = [
        {
            title: 'CUSTOMER ID',
            dataIndex: 'customer_code',
            key: 'code',
            width: 120,
            render: (text) => <span className="cm-id-text">{text || 'N/A'}</span>
        },
           {
            title: 'CUSTOMER',
            key: 'name',
            width: 260,
            render: (_, r) => {
                const rankNumber = topCustomersByBookings[r.customer_id];
                const rankBadge = (() => {
                    if (!rankNumber) return null;
                    const ranks = {
                        1: { label: '1st', color: '#b45309', bg: '#fef3c7' },
                        2: { label: '2nd', color: '#6b7280', bg: '#f1f5f9' },
                        3: { label: '3rd', color: '#b45309', bg: '#fde68a' },
                        4: { label: '4th', color: '#0369a1', bg: '#e0f2fe' },
                        5: { label: '5th', color: '#7c3aed', bg: '#ede9fe' },
                    };
                    const meta = ranks[rankNumber];
                    if (!meta) return null;
                    return (
                        <span
                            title={`Top ${rankNumber} Customer Overall`}
                            style={{
                                display: 'inline-block',
                                marginLeft: 8,
                                padding: '1px 7px',
                                borderRadius: 8,
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: 0.3,
                                color: meta.color,
                                background: meta.bg,
                                verticalAlign: 'middle'
                            }}
                        >
                            {meta.label}
                        </span>
                    );
                })();

                return (
                    <div className="cm-customer-cell">
                        <Avatar
                            size={38}
                            className="cm-table-avatar"
                            style={{ backgroundColor: getCustomerTier(r).color }}
                        >
                            {getInitials(r)}
                        </Avatar>
                        <div className="cm-customer-cell-text">
                            <div className="cm-customer-name">
                                {r.person?.first_name || ''} {r.person?.last_name || ''}
                                {rankBadge}
                            </div>
                            <div className="cm-customer-contact"><MailOutlined /> {r.person?.email || 'N/A'}</div>
                        </div>
                    </div>
                );
            }
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
            width: 120,
            align: 'center',
            render: (_, r) => {
                const count = r.total_bookings || 0;

                return (
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <Badge
                            count={count}
                            showZero
                            style={{ backgroundColor: count > 0 ? '#3b82f6' : '#94a3b8' }}
                        />
                    </span>
                );
            }
        },
          {
            title: 'TOTAL SPENT',
            key: 'spent',
            width: 140,
            align: 'right',
            render: (_, r) => {
                const amount = r.total_spent || 0;
                // ⭐ REQUEST 1.5 — Loyalty points shown under total spent.
                const points = Number(r.loyalty_points ?? 0);
                return (
                    <div>
                        <div className="cm-amount" style={{ fontWeight: amount > 0 ? 'bold' : 'normal' }}>
                            ₱{amount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 2 }}>
                            <GiftOutlined /> {points.toLocaleString()} pts
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'TIER',
            key: 'tier',
            width: 110,
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
                                              <button
                            className="cm-action-icon chat"
                            onClick={() => {
                                setActiveMainTab('messages');
                                openMessageViewWithRead(record);
                            }}
                        >
                            <MessageOutlined />
                        </button>
                    </Tooltip>
                    {/* ⭐ REQUEST #2.3 — Rebook jumps to the latest booking
                        of this customer and starts the rebook flow. */}
                    <Tooltip title="Rebook this customer">
                        <button
                            className="cm-action-icon rebook"
                            style={{ color: '#8b5cf6' }}
                            onClick={() => handleRebookCustomer(record)}
                        >
                            <ReloadOutlined />
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
            title: 'SOURCE',
            key: 'source',
            width: 100,
            align: 'center',
            // ⭐ Shows whether the booking came from Walk-In, Mobile, Web, Phone.
            render: (_, r) => {
                const source = String(r.booking_source || 'walk_in').toLowerCase();
                const meta = {
                    mobile:  { label: 'APP',     color: '#DB2777', bg: '#FCE7F3' },
                    web:     { label: 'WEB',     color: '#0891B2', bg: '#CFFAFE' },
                    phone:   { label: 'PHONE',   color: '#7C3AED', bg: '#EDE9FE' },
                    walk_in: { label: 'WALK-IN', color: '#1D4ED8', bg: '#DBEAFE' },
                }[source] || { label: 'WALK-IN', color: '#1D4ED8', bg: '#DBEAFE' };

                return (
                    <span
                        style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: 0.3,
                            color: meta.color,
                            background: meta.bg,
                        }}
                    >
                        {meta.label}
                    </span>
                );
            },
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
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,                token: {
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
                    Card: { borderRadiusLG: 16 },
                    Modal: { borderRadiusLG: 20 },
                    Button: { borderRadius: 10 },
                    Input: { borderRadius: 10 },
                    Select: { borderRadius: 10 },
                }
            }}
        >
                     <App>
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
                        onChange={(key) => {
                            setActiveMainTab(key);
                            // ⭐ Clear unread for whichever conversation is open.
                            if (key === 'messages' && selectedChatCustomer) {
                                markConversationAsRead(selectedChatCustomer);
                            }
                        }}
                        className="cm-tabs"
                        destroyOnHidden={true}
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
                                                    <Option value="diamond">Diamond</Option>
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
                                                loading={customersLoading}
                                                className={tableClass}
                                                scroll={{ x: 1400 }}
                                                locale={{
                                                    emptyText: customersLoading ? null : (
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
                                                                                              footer={() => null}
                                                pagination={{
                                                    current: currentPage,
                                                    pageSize: pageSize,
                                                    total: totalCustomers,
                                                    showSizeChanger: true,
                                                    showTotal: (total) => `Total ${total} customers`,
                                                    itemRender: renderPaginationItem,
                                                    onChange: (page, size) => {
                                                        setCurrentPage(page);
                                                        if (size) setPageSize(size);
                                                    },
                                                    pageSizeOptions: [ '11', '20', '50']
                                                }}
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

                                        {customerBookingsError && (
                                            <Alert
                                                type="error"
                                                showIcon
                                                style={{ marginBottom: 16 }}
                                                message="Could not load bookings"
                                                description={
                                                    <span>
                                                        {customerBookingsErrorObj?.response?.data?.message ||
                                                            customerBookingsErrorObj?.message ||
                                                            'The server returned an error while loading this customer’s bookings.'}
                                                        {selectedCustomer?.customer_id ? (
                                                            <> Customer ID: <strong>{selectedCustomer.customer_id}</strong>.</>
                                                        ) : null}
                                                    </span>
                                                }
                                                action={
                                                    <Button
                                                        size="small"
                                                        onClick={() => refetchBookings()}
                                                    >
                                                        Retry
                                                    </Button>
                                                }
                                            />
                                        )}

                                        <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                                            <Text strong>View bookings for:</Text>
                                                                                       <Select
                                                showSearch
                                                placeholder="Select a customer..."
                                                value={selectedCustomer?.customer_id}
                                                onChange={(customerId) => {
                                                    const found = customers.find(
                                                        (c) => String(c.customer_id) === String(customerId)
                                                    );
                                                    if (found) setSelectedCustomer(found);
                                                }}
                                                style={{ minWidth: 320 }}
                                                optionFilterProp="label"
                                                allowClear
                                                onClear={() => setSelectedCustomer(null)}
                                                options={customers.map((c) => ({
                                                    value: c.customer_id,
                                                    label: `${`${c.person?.first_name || ''} ${c.person?.last_name || ''}`.trim()}${c.person?.email ? ` — ${c.person.email}` : ''}`,
                                                }))}
                                            />
                                            {selectedCustomer && (
                                                <Button
                                                    size="small"
                                                    onClick={() => setSelectedCustomer(null)}
                                                >
                                                    Clear
                                                </Button>
                                            )}
                                        </div>
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
                                                            {selectedCustomer ? (
                                                                <>
                                                                    <InfoCircleOutlined style={{ fontSize: 48, color: '#f59e0b' }} />
                                                                    <p style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: '#d97706' }}>
                                                                        No Booking History Found
                                                                    </p>
                                                                    <p style={{ fontSize: 14, color: '#999' }}>
                                                                        This customer has not made any bookings yet. You can click <strong>Rebook</strong> in the Directory tab to create their first booking.
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CalendarOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                                                    <p style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
                                                                        Select a customer
                                                                    </p>
                                                                    <p style={{ fontSize: 14, color: '#999' }}>
                                                                        Choose a customer above (or click a row in the Directory tab) to view their booking history.
                                                                    </p>
                                                                </>
                                                            )}
                                                        </div>
                                                    )
                                                }}
                                                                                              footer={() => null}
                                                pagination={{
                                                    pageSize:11,
                                                    showSizeChanger: true,
                                                    showTotal: (total) => `Total ${total} bookings`,
                                                    itemRender: renderPaginationItem,
                                                    pageSizeOptions: ['12', '20', '50']
                                                }}
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
                                                                                                footer={() => null}
                                                pagination={{
                                                    pageSize: 11,
                                                    showSizeChanger: true,
                                                    showTotal: (total) => `Total ${total} feedback`,
                                                    itemRender: renderPaginationItem,
                                                    pageSizeOptions: [ '11', '20', '50']
                                                }}
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
                                                                                               footer={() => null}
                                                pagination={{
                                                    pageSize:11,
                                                    showSizeChanger: true,
                                                    showTotal: (total) => `Total ${total} reviews`,
                                                    itemRender: renderPaginationItem,
                                                    pageSizeOptions: [ '11', '20', '50']
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            }] : []),
                            {
                                key: 'messages',
                                label: (
                                    <span>
                                        <MessageOutlined /> Messenger
                                        {unreadMessageCount > 0 && (
                                            <Badge
                                                count={unreadMessageCount}
                                                size="small"
                                                style={{ marginLeft: 6, backgroundColor: '#ef4444' }}
                                            />
                                        )}
                                    </span>
                                ),
                                                          children: (
                                    <div className="cm-tab-content cm-messenger-tab">
                                        <div className={messengerClass}>
                                            {/* ============ SIDEBAR ============ */}
                                            <div className="cm-messenger-sidebar">
                                                <div className="cm-messenger-sidebar-header">
                                                                                                      <div className="cm-messenger-title">
                                                        <div className="cm-messenger-title-left">
                                                            <MessageOutlined className="cm-messenger-title-icon" />
                                                            <span>Messages</span>
                                                        </div>
                                                        <span className="cm-messenger-title-count">
                                                            {chatCustomers.length} conversation{chatCustomers.length === 1 ? '' : 's'}
                                                        </span>
                                                    </div>

                                                    {/* ⭐ REQUEST 2.4 — Inbox / Archived toggle. */}
                                                    <div className="cm-messenger-view-toggle">
                                                        <button
                                                            type="button"
                                                            className={inboxView === 'inbox' ? 'active' : ''}
                                                            onClick={() => setInboxView('inbox')}
                                                        >
                                                            <InboxOutlined /> Inbox
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={inboxView === 'archived' ? 'active' : ''}
                                                            onClick={() => setInboxView('archived')}
                                                        >
                                                            <DeleteOutlined /> Archived
                                                        </button>
                                                    </div>
                                                    <div className="cm-messenger-search">
                                                        <Input
                                                            placeholder="Search customers..."
                                                            prefix={<SearchOutlined />}
                                                            value={messageSearchTerm}
                                                            onChange={(e) => setMessageSearchTerm(e.target.value)}
                                                            className="cm-messenger-search-input"
                                                            allowClear
                                                        />
                                                    </div>
                                                </div>
                                                <div className="cm-messenger-contact-list">
                                                    {chatCustomers.length === 0 ? (
                                                        <div className="cm-messenger-empty-state">
                                                            <MessageOutlined style={{ fontSize: 42 }} />
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
                                                            const tierInfo = getCustomerTier(customer);

                                                            return (




                                                                                                                              <div
                                                                    key={customer.customer_id}
                                                                    className={
                                                                        `cm-messenger-contact ${isActive ? 'cm-messenger-contact-active' : ''}` +
                                                                        (pinnedCustomerIds.includes(String(customer.customer_id)) ? ' cm-messenger-contact-pinned' : '') +
                                                                        (blockedCustomerIds.includes(String(customer.customer_id)) ? ' cm-messenger-contact-blocked' : '')
                                                                    }
                                                                    onClick={() => openMessageViewWithRead(customer)}                                                                >

                                                                        
                                                                    <Avatar
                                                                        size={44}
                                                                        className="cm-messenger-contact-avatar"
                                                                        style={{ backgroundColor: tierInfo.color }}
                                                                    >
                                                                        {getInitials(customer)}
                                                                    </Avatar>
                                                                    <div className="cm-messenger-contact-info">
                                                                        <div className="cm-messenger-contact-name">
                                                                            <span className="cm-messenger-contact-fullname">
                                                                                {pinnedCustomerIds.includes(String(customer.customer_id)) && (
                                                                                    <PushpinOutlined style={{ marginRight: 4, color: '#f59e0b' }} />
                                                                                )}
                                                                                {blockedCustomerIds.includes(String(customer.customer_id)) && (
                                                                                    <StopOutlined style={{ marginRight: 4, color: '#ef4444' }} />
                                                                                )}
                                                                                {customer.person?.first_name || ''} {customer.person?.last_name || ''}
                                                                            </span>
                                                                                                                                                       {lastMessage?.created_at && (
                                                                                <span className="cm-messenger-contact-time">
                                                                                    {formatRelativeTime(lastMessage.created_at)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                                                                                               <div className="cm-messenger-contact-last">
                                                                            <span className="cm-messenger-contact-last-message">
                                                                                {lastMessage ? (
                                                                                    <>
                                                                                        {lastMessage.sender_type === 'admin' && <span className="cm-messenger-sender-label">You: </span>}
                                                                                        {lastMessage.message?.substring(0, 50) || ''}
                                                                                        {lastMessage.message?.length > 50 ? '…' : ''}
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="cm-messenger-no-message">No messages yet</span>
                                                                                )}
                                                                            </span>
                                                                            {unreadCount > 0 && (
                                                                                <span className="cm-messenger-unread-badge">{unreadCount}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* ⭐ REQUEST 2.4 + 2.8 — Per-conversation menu. */}
                                                                    <Dropdown
                                                                        trigger={['click']}
                                                                        menu={{
                                                                            items: [
                                                                                {
                                                                                    key: 'pin',
                                                                                    icon: <PushpinOutlined />,
                                                                                    label: pinnedCustomerIds.includes(String(customer.customer_id))
                                                                                        ? 'Unpin conversation'
                                                                                        : 'Pin conversation',
                                                                                    onClick: ({ domEvent }) => {
                                                                                        domEvent.stopPropagation();
                                                                                        handleTogglePinCustomer(customer.customer_id);
                                                                                    },
                                                                                },
                                                                                {
                                                                                    key: 'archive',
                                                                                    icon: <InboxOutlined />,
                                                                                    label: 'Archive conversation',
                                                                                    onClick: ({ domEvent }) => {
                                                                                        domEvent.stopPropagation();
                                                                                        handleArchiveConversation(customer);
                                                                                    },
                                                                                },
                                                                                {
                                                                                    key: 'block',
                                                                                    icon: <StopOutlined />,
                                                                                    danger: !blockedCustomerIds.includes(String(customer.customer_id)),
                                                                                    label: blockedCustomerIds.includes(String(customer.customer_id))
                                                                                        ? 'Unblock customer'
                                                                                        : 'Block customer',
                                                                                    onClick: ({ domEvent }) => {
                                                                                        domEvent.stopPropagation();
                                                                                        handleToggleBlock(customer);
                                                                                    },
                                                                                },
                                                                                { type: 'divider' },
                                                                                {
                                                                                    key: 'delete',
                                                                                    icon: <DeleteOutlined />,
                                                                                    danger: true,
                                                                                    label: 'Delete conversation',
                                                                                    onClick: ({ domEvent }) => {
                                                                                        domEvent.stopPropagation();
                                                                                        handleDeleteConversation(customer);
                                                                                    },
                                                                                },
                                                                            ],
                                                                        }}
                                                                    >
                                                                        {/* ⭐ Updated to use the large circular button style */}
                                                                                                                                           <button
                                                                            type="button"
                                                                            className="cm-message-more"
                                                                            style={{ 
                                                                                background: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                                                                                color: isDarkMode ? '#fff' : '#333',
                                                                                width: 36, height: 36, borderRadius: '50%',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                border: 'none', cursor: 'pointer', marginLeft: 8
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation(); 
                                                                            }}
                                                                            aria-label="Conversation actions"
                                                                        >
                                                                            <EllipsisOutlined style={{ fontSize: 20 }} />
                                                                        </button>
                                                                    </Dropdown>


                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            {/* ============ CHAT AREA ============ */}
                                                                                        <div className="cm-messenger-chat">
                                                {selectedChatCustomer ? (
                                                    <div
                                                        className={
                                                            'cm-messenger-chat-panel' +
                                                            (conversationRemoving ? ' cm-conversation-removing' : '')
                                                        }
                                                    >
                                                        {/* Chat Header */}
                                                        <div className="cm-messenger-chat-header">
                                                            <div className="cm-messenger-chat-header-left">
                                                                <Avatar
                                                                    size={44}
                                                                    className="cm-messenger-chat-avatar"
                                                                    style={{ backgroundColor: getCustomerTier(selectedChatCustomer).color }}
                                                                >
                                                                    {getInitials(selectedChatCustomer)}
                                                                </Avatar>
                                                                <div className="cm-messenger-chat-header-info">
                                                                    <div
                                                                        className="cm-messenger-chat-name-wrapper"
                                                                        onClick={() => handleViewCustomerDetails(selectedChatCustomer)}
                                                                    >
                                                                        <span className="cm-messenger-chat-name">
                                                                            {selectedChatCustomer.person?.first_name || ''} {selectedChatCustomer.person?.last_name || ''}
                                                                        </span>
                                                                        <InfoCircleOutlined className="cm-messenger-chat-info-icon" />
                                                                    </div>
                                                                                                                                        {/* ⭐ REQUEST 2.6 — Online/offline is derived from
                                                                        Reverb presence, NOT from account existence or old
                                                                        messages. The `isOnline` flag is populated by the
                                                                        presence channel subscription below. */}
                                                                                                                                     <div className="cm-messenger-chat-status">
                                                                        <span className={`cm-messenger-status-dot ${selectedChatCustomer?.isOnline ? 'online' : 'offline'}`}></span>
                                                                        <span className="cm-messenger-status-text">
                                                                            {selectedChatCustomer?.isOnline 
                                                                                ? `Active ${(() => {
                                                                                    const lastCustMsg = messages
                                                                                        .filter(m => String(m.customer_id) === String(selectedChatCustomer.customer_id) && m.sender_type === 'customer')
                                                                                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                                                                                    if (!lastCustMsg) return 'just now';
                                                                                    return formatRelativeTime(lastCustMsg.created_at) + ' ago';
                                                                                })()}` 
                                                                                : 'Not Active'}
                                                                        </span>
                                                                        <span className="cm-messenger-status-separator">·</span>
                                                                        <span
                                                                            className="cm-messenger-chat-tier"
                                                                            style={{ color: getCustomerTier(selectedChatCustomer).color }}
                                                                        >
                                                                            {getCustomerTier(selectedChatCustomer).icon}
                                                                            {getCustomerTier(selectedChatCustomer).tier}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="cm-messenger-chat-header-actions">
                                                                                                                            <Tooltip title="View profile">
                                                                    <Button
                                                                        icon={<UserOutlined />}
                                                                        className="cm-messenger-header-action"
                                                                        onClick={() => handleViewCustomerDetails(selectedChatCustomer)}
                                                                    />
                                                                </Tooltip>

                                                                {/* ⭐ REQUEST 2.4 — Restore archived conversation. */}
                                                                {selectedChatCustomer?.is_archived && (
                                                                    <Tooltip title="Restore conversation">
                                                                        <Button
                                                                            icon={<InboxOutlined />}
                                                                            className="cm-messenger-header-action"
                                                                            onClick={() => handleRestoreConversation(selectedChatCustomer)}
                                                                        />
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                        </div>

                                                                                                                {/* ⭐ REQUEST 2.8 — Pinned-message banner. Clicking it
                                                            scrolls to and highlights the pinned message. */}
                                                        {pinnedMessageId && chatMessages.some((m) => String(m.id) === String(pinnedMessageId)) && (
                                                            <div className="cm-pinned-banner" onClick={() => scrollToPinnedMessage(pinnedMessageId)}>
                                                                <PushpinOutlined />
                                                                <span className="cm-pinned-banner-text">
                                                                    {(() => {
                                                                        const pinned = chatMessages.find((m) => String(m.id) === String(pinnedMessageId));
                                                                        const preview = String(pinned?.message || 'Attachment').slice(0, 80);
                                                                        return preview + (String(pinned?.message || '').length > 80 ? '…' : '');
                                                                    })()}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="cm-pinned-banner-close"
                                                                    onClick={(e) => { e.stopPropagation(); setPinnedMessageId(null); }}
                                                                    aria-label="Unpin"
                                                                >
                                                                    <CloseOutlined />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Messages */}
                                                        <div className="cm-messenger-chat-messages" ref={chatContainerRef}>
                                                            {chatMessages.length === 0 ? (
                                                                <div className="cm-messenger-chat-empty-state">
                                                                    <MessageOutlined style={{ fontSize: 42 }} />
                                                                    <p>No messages yet</p>
                                                                    <span>Send the first message to start the conversation</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {groupMessagesByDate(chatMessages).map((group) => (
                                                                        <div key={group.key} className="cm-message-day-group">
                                                                            <div className="cm-messenger-date-divider">
                                                                                <span className="cm-messenger-date-label">
                                                                                    {format(group.date, 'EEEE, MMM d')}
                                                                                </span>
                                                                            </div>
                                                                            {group.messages.map((msg, index) => {
                                                                                const isAdmin = msg.isAdmin || msg.sender_type === 'admin';
                                                                                const showAvatar = !isAdmin && (
                                                                                    index === 0 ||
                                                                                    group.messages[index - 1]?.sender_type !== 'customer'
                                                                                );
                                                                                                                                                                const msgId = String(msg.id || msg.message_id || '');
                                                                                const isDeleting = deletingMessageIds.includes(msgId);
                                                                                const isPinnedMsg = String(pinnedMessageId) === msgId;
                                                                                const wrappedLines = splitMessageIntoWrappedLines(msg.message);

                                                                                return (
                                                                                                                                                                        <div
                                                                                        id={`cm-msg-${msgId}`}
                                                                                        key={`${msgId || 'msg'}-${msg.created_at || index}`}
                                                                                        className={
                                                                                            `cm-message-wrapper ${isAdmin ? 'cm-message-admin' : 'cm-message-customer'} cm-message-row` +
                                                                                            (isDeleting ? ' cm-message-deleting' : '') +
                                                                                            (isPinnedMsg ? ' cm-message-pinned' : '')
                                                                                        }
                                                                                        style={{ position: 'relative' }}
                                                                                                                                                               
                                                                                                                                                               
                                                                                                                                                               

                                                                                    >
                                                                                        <div className={`cm-message-bubble-wrapper ${isAdmin ? 'cm-message-admin' : 'cm-message-customer'}`}>
                                                                                            
                                                                                            {/* ⭐ Customer Name at the top of the message */}
                                                                                            {!isAdmin && showAvatar && (
                                                                                                <div className="cm-message-sender" style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, marginLeft: 4 }}>
                                                                                                    {msg.sender_name && msg.sender_name !== 'Customer' 
                                                                                                        ? msg.sender_name 
                                                                                                        : `${selectedChatCustomer?.person?.first_name || ''} ${selectedChatCustomer?.person?.last_name || ''}`.trim() || 'Customer'}
                                                                                                </div>
                                                                                            )}






                                                                                            {/* ⭐ Row for the Bubble and Buttons */}
                                                                                            <div style={{ display: 'flex', alignItems: 'flex-end', flexDirection: 'row', gap: 8, width: 'fit-content', marginLeft: isAdmin ? 'auto' : '0' }}>
                                                                                                
                                                                                                {/* ⭐ Customer Avatar (Only for Customer messages, appears on the far left) */}
                                                                                                {!isAdmin && (
                                                                                                    <Avatar
                                                                                                        size={32}
                                                                                                        className="cm-message-avatar"
                                                                                                        style={{ backgroundColor: getCustomerTier(selectedChatCustomer).color, flexShrink: 0, marginBottom: 4 }}
                                                                                                    >
                                                                                                        {getInitials(selectedChatCustomer)}
                                                                                                    </Avatar>
                                                                                                )}






                                                                                                                                                                                               {/* Action Buttons removed to match single ... layout */}



                                                                                                {/* Message Bubble */}
                                                                                                <Dropdown
                                                                                                    trigger={['contextMenu']}
                                                                                                    menu={{
                                                                                                        items: [
                                                                                                            { key: 'pin', icon: <PushpinOutlined />, label: isPinnedMsg ? 'Unpin message' : 'Pin message', onClick: () => handleTogglePinMessage(msg) },
                                                                                                            { type: 'divider' },
                                                                                                            { key: 'delete-me', icon: <DeleteOutlined />, label: 'Delete for me', onClick: () => handleDeleteMessageForMe(msg) },
                                                                                                            ...(isAdmin ? [{ key: 'delete-everyone', icon: <DeleteOutlined />, danger: true, label: 'Delete for everyone', onClick: () => handleDeleteMessageForEveryone(msg) }] : []),
                                                                                                        ],
                                                                                                    }}
                                                                                                >
                                                                                                    <div 
                                                                                                        className={`cm-message-bubble ${isAdmin ? 'cm-message-bubble-admin' : 'cm-message-bubble-customer'}`} 
                                                                                                        style={{ 
                                                                                                            background: isAdmin ? '#0084ff' : (isDarkMode ? '#242538' : '#f0f2f5'), 
                                                                                                            color: isAdmin ? '#fff' : (isDarkMode ? '#fff' : '#1a2c3e'),
                                                                                                            padding: '8px 12px',
                                                                                                            position: 'relative',
                                                                                                            display: 'flex',
                                                                                                            flexDirection: 'column',
                                                                                                            gap: 4
                                                                                                        }}
                                                                                                    >                                                                                                    
                                                                                                        {/* Attachments */}
                                                                                                        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                                                                                            <div className="cm-message-attachments">
                                                                                                                {msg.attachments.map((att) => (
                                                                                                                    <div key={att.clientId || att.attachment_id || att.name} className="cm-message-attachment">
                                                                                                                        {att.kind === 'image' && (att.previewUrl || att.url) ? (
                                                                                                                            <a href={att.url || att.previewUrl} target="_blank" rel="noreferrer">
                                                                                                                                <img src={att.previewUrl || att.url} alt={att.name} className="cm-message-attachment-image" />
                                                                                                                            </a>
                                                                                                                        ) : att.kind === 'video' && att.url ? (
                                                                                                                            <video controls src={att.url} className="cm-message-attachment-video" />
                                                                                                                        ) : (
                                                                                                                            <a href={att.url} target="_blank" rel="noreferrer" className="cm-message-attachment-file">
                                                                                                                                <FileTextOutlined /> {att.name}
                                                                                                                            </a>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        )}

                                                                                                                                                                                                              {/* Replied Message Quote */}
                                                                                                        {msg.reply_to && (
                                                                                                            <div style={{ background: isAdmin ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: 6, fontSize: 12, marginBottom: 4, borderLeft: `3px solid ${isAdmin ? '#fff' : '#0084ff'}` }}>
                                                                                                                <div style={{ fontWeight: 600, color: isAdmin ? '#fff' : '#0084ff', fontSize: 11 }}>
                                                                                                                    {msg.reply_to.isAdmin ? 'You' : msg.reply_to.sender_name}
                                                                                                                </div>
                                                                                                                <div style={{ opacity: 0.8 }}>{msg.reply_to.message}</div>
                                                                                                            </div>
                                                                                                        )}





                                                                                                                                                                                                      {/* Message Text */}
                                                                                                        {wrappedLines.length > 0 && (
                                                                                                            <div className="cm-message-text" style={{ paddingBottom: 2 }}>
                                                                                                                {wrappedLines.join('')}
                                                                                                            </div>
                                                                                                        )}
                                                                                                        
                                                                                                        {/* Timestamp & Status (Sits inside the bubble bottom right) */}
                                                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontSize: 11, opacity: 0.7, marginTop: 2, marginLeft: 'auto' }}>
                                                                                                            <span className="cm-message-time">
                                                                                                                {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                                                                                                            </span>
                                                                                                            {isAdmin && msg.delivery_status === 'sent' && (
                                                                                                                <span style={{ display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                                                                                                                    <CheckCircleFilled style={{ fontSize: 11 }} />
                                                                                                                    <CheckCircleFilled style={{ fontSize: 11, marginLeft: -6 }} />
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </Dropdown>





                                                                                                                                                                                               {/* ⭐ Floating Action Menu (Reply, React, ...) */}
                                                                                                <div style={{ order: isAdmin ? -1 : 1, marginBottom: 2, marginRight: isAdmin ? 0 : 8, marginLeft: isAdmin ? 8 : 0, display: 'flex', gap: 4, alignItems: 'center' }} className="cm-message-actions-hover">
                                                                                                    
                                                                                                    {/* React Button */}
                                                                                                    <Dropdown
                                                                                                        trigger={['click']}
                                                                                                        menu={{
                                                                                                            items: EMOJI_LIST.map(e => ({ key: e, label: <span style={{ fontSize: 20 }}>{e}</span> })),
                                                                                                            onClick: ({ key }) => message.success(`Reacted with ${key}`)
                                                                                                        }}
                                                                                                    >
                                                                                                        <button type="button" className="cm-message-more" style={{ background: 'transparent', boxShadow: 'none' }}>
                                                                                                            <SmileOutlined style={{ fontSize: 18 }} />
                                                                                                        </button>
                                                                                                    </Dropdown>

                                                                                                    {/* Reply Button */}
                                                                                                    <button 
                                                                                                        type="button" 
                                                                                                        className="cm-message-more" 
                                                                                                        style={{ background: 'transparent', boxShadow: 'none' }}
                                                                                                        onClick={() => setReplyingTo(msg)}
                                                                                                    >
                                                                                                        <RollbackOutlined style={{ fontSize: 18 }} />
                                                                                                    </button>

                                                                                                    {/* The `...` Menu */}
                                                                                                    <Dropdown
                                                                                                        trigger={['click']}
                                                                                                        menu={{
                                                                                                            items: [
                                                                                                                { key: 'pin', icon: <PushpinOutlined />, label: isPinnedMsg ? 'Unpin' : 'Pin', onClick: () => handleTogglePinMessage(msg) },
                                                                                                                { key: 'delete-me', icon: <DeleteOutlined />, label: 'Delete for me', onClick: () => handleDeleteMessageForMe(msg) },
                                                                                                                ...(isAdmin ? [{ key: 'delete-everyone', icon: <DeleteOutlined />, danger: true, label: 'Delete for everyone', onClick: () => handleDeleteMessageForEveryone(msg) }] : []),
                                                                                                            ],
                                                                                                        }}
                                                                                                    >
                                                                                                        <button type="button" className="cm-message-more" aria-label="More options">
                                                                                                            <EllipsisOutlined style={{ fontSize: 20 }} />
                                                                                                        </button>
                                                                                                    </Dropdown>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );







                                                                            })}
                                                                        </div>
                                                                    ))}
                                                                                                                                      {/* ⭐ Removed the "Admin is typing..." indicator from the admin view. */}
                                                                    <div ref={messagesEndRef} />
                                                                </>
                                                            )}
                                                        </div>
                                                                                                              {/* ⭐ Reply Banner */}
                                                        {replyingTo && (
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: isDarkMode ? '#1a1f38' : '#f1f5f9', borderTop: '1px solid #eef2f8', borderBottom: '1px solid #eef2f8' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '3px solid #0084ff', paddingLeft: 8 }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0084ff' }}>
                                                                        Replying to {replyingTo.isAdmin ? 'yourself' : replyingTo.sender_name}
                                                                    </span>
                                                                    <span style={{ fontSize: 13, color: isDarkMode ? '#aaa' : '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                                                                        {replyingTo.message}
                                                                    </span>
                                                                </div>
                                                                <Button type="text" icon={<CloseOutlined />} onClick={() => setReplyingTo(null)} />
                                                            </div>
                                                        )}

                                                        {/* ⭐ REQUEST 2.10 — Attachment preview tray. */}
                                                        {pendingAttachments.length > 0 && (
                                                            <div className="cm-attachment-tray">
                                                                {pendingAttachments.map((att) => (
                                                                    <div key={att.clientId} className="cm-attachment-chip">
                                                                        {att.kind === 'image' && att.previewUrl ? (
                                                                            <img
                                                                                src={att.previewUrl}
                                                                                alt={att.file.name}
                                                                                className="cm-attachment-thumb"
                                                                            />
                                                                        ) : att.kind === 'video' ? (
                                                                            <VideoCameraOutlined style={{ fontSize: 18 }} />
                                                                        ) : (
                                                                            <FileTextOutlined style={{ fontSize: 18 }} />
                                                                        )}
                                                                        <span className="cm-attachment-name" title={att.file.name}>
                                                                            {att.file.name}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            className="cm-attachment-remove"
                                                                            onClick={() => {
                                                                                if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                                                                                setPendingAttachments((prev) =>
                                                                                    prev.filter((a) => a.clientId !== att.clientId)
                                                                                );
                                                                            }}
                                                                            aria-label="Remove attachment"
                                                                        >
                                                                            <CloseOutlined />
                                                                        </button>
                                                                        {uploadProgress[att.clientId] != null && (
                                                                            <Progress
                                                                                percent={uploadProgress[att.clientId]}
                                                                                size="small"
                                                                                style={{ width: '100%', marginTop: 2 }}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                                                                               {/* Input (Messenger Style) */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isDarkMode ? '#181926' : '#ffffff', borderTop: `1px solid ${isDarkMode ? '#2d2d3d' : '#eef2f8'}` }}>
                                                            
                                                            {/* Left Icons: +, Image, Sticker */}
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                                                                          <Dropdown
                                                                    trigger={['click']}
                                                                    menu={{
                                                                        items: [
                                                                            { key: 'file', icon: <FileTextOutlined />, label: 'Document / File', onClick: () => fileInputRef.current?.click() },
                                                                            { key: 'location', icon: <EnvironmentOutlined />, label: 'Location (Coming Soon)', onClick: () => message.info('Location sharing coming soon') },
                                                                        ],
                                                                    }}
                                                                >
                                                                    <Button type="text" icon={<PlusOutlined style={{ color: '#0084ff', fontSize: 20 }} />} style={{ background: 'transparent', border: 'none' }} />
                                                                </Dropdown>
                                                                <Tooltip title="Attach Image/Video">
                                                                    <Button type="text" icon={<PictureOutlined style={{ color: '#0084ff', fontSize: 20 }} />} style={{ background: 'transparent', border: 'none' }} onClick={() => fileInputRef.current?.click()} />
                                                                </Tooltip>
                                                                <Dropdown
                                                                    trigger={['click']}
                                                                    menu={{
                                                                        items: STICKER_LIST.map(s => ({ key: s, label: <span style={{ fontSize: 28 }}>{s}</span> })),
                                                                        onClick: ({ key }) => {
                                                                            setNewMessage(prev => prev + key);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Button type="text" icon={<SmileOutlined style={{ color: '#0084ff', fontSize: 20 }} />} style={{ background: 'transparent', border: 'none' }} />
                                                                </Dropdown>
                                                            </div>

                                                            {/* Message Input Area */}
                                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: isDarkMode ? '#242538' : '#f0f2f5', borderRadius: 20, padding: '4px 12px' }}>
                                                                <input
                                                                    value={newMessage}
                                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                                    onKeyDown={handleKeyPress}
                                                                    placeholder="Aa"
                                                                    style={{ 
                                                                        flex: 1, 
                                                                        background: 'transparent', 
                                                                        border: 'none', 
                                                                        outline: 'none', 
                                                                        color: isDarkMode ? '#fff' : '#1a2c3e', 
                                                                        fontSize: 15,
                                                                        padding: '4px 0'
                                                                    }}
                                                                />
                                                                                                                          <Dropdown
                                                                    trigger={['click']}
                                                                    menu={{
                                                                        items: EMOJI_LIST.map(e => ({ key: e, label: <span style={{ fontSize: 24 }}>{e}</span> })),
                                                                        onClick: ({ key }) => {
                                                                            setNewMessage(prev => prev + key);
                                                                        }
                                                                    }}
                                                                >
                                                                    {/* ⭐ FIX: Wrapped in a single Button to satisfy React.Children.only */}
                                                                    <Button type="text" icon={<SmileOutlined style={{ color: '#0084ff', fontSize: 20 }} />} style={{ background: 'transparent', padding: 0, marginLeft: 8, border: 'none' }} />
                                                                </Dropdown>
                                                            </div>

                                                            {/* Right Icon: Send or Like */}
                                                            <Tooltip title={newMessage.trim() ? 'Send Message' : 'Send a Like'}>
                                                                <Button 
                                                                    type="text" 
                                                                    icon={newMessage.trim() ? <SendOutlined style={{ color: '#0084ff', fontSize: 22 }} /> : <LikeFilled style={{ color: '#0084ff', fontSize: 22 }} />} 
                                                                    style={{ background: 'transparent' }} 
                                                                    onClick={() => {
                                                                        if (newMessage.trim()) {
                                                                            handleSendMessage();
                                                                        } else {
                                                                            setNewMessage('👍');
                                                                            setTimeout(() => {
                                                                                handleSendMessage();
                                                                                setNewMessage('');
                                                                            }, 100);
                                                                        }
                                                                    }}
                                                                    loading={sendMessage.isPending}
                                                                />
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="cm-messenger-chat-empty">
                                                        <div className="cm-messenger-chat-empty-content">
                                                            <div className="cm-messenger-empty-illustration">
                                                                <MessageOutlined />
                                                            </div>
                                                            <h3>Select a conversation</h3>
                                                            <p>Choose a customer from the sidebar to start chatting</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                                                              {/* ⭐ REQUEST 2.10 — Multi-file picker with
                                            client-side MIME + size validation.
                                            Images/videos get a previewUrl; files do not. */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                            multiple
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                const accepted = [];
                                                files.forEach((file) => {
                                                    const err = validateAttachment(file);
                                                    if (err) {
                                                        message.error(`${file.name}: ${err}`);
                                                        return;
                                                    }
                                                    const kind = classifyAttachment(file.type);
                                                    accepted.push({
                                                        clientId: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                                        file,
                                                        kind,
                                                        previewUrl:
                                                            kind === 'image'
                                                                ? URL.createObjectURL(file)
                                                                : null,
                                                    });
                                                });
                                                if (accepted.length) {
                                                    setPendingAttachments((prev) => [...prev, ...accepted]);
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
                                            <Option value="diamond">Diamond</Option>
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
                    onClose={handleCloseCustomerDetails}
                    width={650}
                    className={drawerClass}
                    placement="right"
                >
                    {selectedCustomer ? (
                        <div className="cm-drawer-content">
                            <div className="cm-customer-profile">
                                <Avatar
                                    size={80}
                                    className="cm-drawer-avatar"
                                    style={{ backgroundColor: getCustomerTier(selectedCustomer).color }}
                                >
                                    {getInitials(selectedCustomer)}
                                </Avatar>
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
                            {/* ⭐ REQUEST 1.4 — Horizontal scroll so wide tables
                                never break the drawer layout on small screens. */}
                            <div style={{ overflowX: 'auto', width: '100%' }}>
                                <Table
                                    dataSource={customerBookings}
                                    columns={bookingColumns.slice(0, 5)}
                                    pagination={false}
                                    size="small"
                                    className={tableClass}
                                    rowKey="booking_id"
                                    scroll={{ x: 900 }}
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
            </App>
        </ConfigProvider>
    );
};

export default CustomerManagement;