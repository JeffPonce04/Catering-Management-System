// src/components/MenuManagement.jsx - COMPLETE ENHANCED UI

import React, { useMemo, useState, useEffect } from 'react';
import {
    Card,
    Table,
    Button,
    Space,
    Input,
    Select,
    Modal,
    Tabs,
    Tag,
    message,
    Divider,
    Tooltip,
    Typography,
    Row,
    Col,
    Alert,
    DatePicker,
    Badge,
    Empty,
    Form,
    InputNumber,
    Upload,
    Image,
    ConfigProvider,
    Switch,
    Progress,
    Steps,
    Descriptions,
    Rate,
    Spin,
    Pagination,
    Avatar,
    Statistic,
    List,
    Drawer,
    Grid,
    Flex,
    Popconfirm
} from 'antd';
import {
    FaPizzaSlice,
    FaHamburger,
    FaUtensils,
    FaFish,
    FaIceCream,
    FaCoffee,
    FaBeer,
    FaAppleAlt,
    FaBreadSlice,
    FaCheese,
    FaEgg,
    FaCarrot,
    FaDrumstickBite,
    FaPepperHot,
    FaBirthdayCake,
    FaCookie,
    FaWineGlassAlt,
    FaMugHot,
} from 'react-icons/fa';
import {
    GiNoodles,
    GiChopsticks,
    GiSandwich,
} from 'react-icons/gi';
import {
    MdSoupKitchen,
    MdFastfood,
    MdBreakfastDining,
    MdLocalDrink,
    MdRestaurant,
    MdDinnerDining,
} from 'react-icons/md';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    PrinterOutlined,
    ExportOutlined,
    TagOutlined,
    AppstoreOutlined,
    FireOutlined,
    CheckCircleOutlined,
    MenuOutlined,
    GiftOutlined,
    TeamOutlined,
    CalendarOutlined,
    BoxPlotOutlined,
    SunOutlined,
    MoonOutlined,
    ForkOutlined,
    EyeOutlined,
    InfoCircleOutlined,
    UploadOutlined,
    StarFilled,
    LeftOutlined,
    RightOutlined,
    CloseOutlined,
    SaveOutlined,
    DollarOutlined,
    ClockCircleOutlined,
    BarChartOutlined,
    CopyOutlined,
    PercentageOutlined,
    TagsOutlined,
    FilterOutlined,
    RocketOutlined,
    CloudUploadOutlined,
    FileImageOutlined,
    StarOutlined,
    SearchOutlined,
    DashboardOutlined,
    ShoppingCartOutlined,
    WalletOutlined,
    TrophyOutlined,
    CrownOutlined,
    ThunderboltOutlined,
    HeartOutlined,
    BulbOutlined,
    ExperimentOutlined,
    ScanOutlined,
    QrcodeOutlined,
    LinkOutlined,
    InboxOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
    UnorderedListOutlined,
    AppstoreFilled,
    ShoppingOutlined,
    UserOutlined,
    EnvironmentOutlined,
    ScheduleOutlined,
    PhoneOutlined,
    MailOutlined,
    WalletFilled,
    PictureOutlined
} from '@ant-design/icons';
import {
    useMenuItems,
    useCreateMenuItem,
    useUpdateMenuItem,
    useDeleteMenuItem,
    useCategories,
    useCreateCategory,
    useUpdateCategory,
    useDeleteCategory,
    usePackages,
    useCreatePackage,
    useUpdatePackage,
    useDeletePackage,
    usePromotions,
    useCreatePromotion,
    useUpdatePromotion,
    useDeletePromotion,
    useDuplicatePromotion,
    useTogglePromotionActive,
    usePromotionAnalytics,
    usePromotionRedemptions,
    useIngredients,
    useMenuStatistics,
    useToggleMenuItemAvailability,
    useToggleMenuItemFeatured,
} from '../../../hooks/useMenuQueries';
import dayjs from 'dayjs';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, HEAD_CHEF_ROLES, hasAllowedRole } from '../../../utils/roleRoutes';
import relativeTime from 'dayjs/plugin/relativeTime';
import '../styles/menu.css';

dayjs.extend(relativeTime);

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;
const { Search } = Input;
const { useBreakpoint } = Grid;

// ============================================================
// ICON HELPERS
// ============================================================
const PROFESSIONAL_ICONS = [
    { name: 'Pizza', icon: <FaPizzaSlice size={28} />, value: 'FaPizzaSlice', category: 'Italian', color: '#1a7ab5' },
    { name: 'Burger', icon: <FaHamburger size={28} />, value: 'FaHamburger', category: 'Fast Food', color: '#1a7ab5' },
    { name: 'Noodles', icon: <GiNoodles size={28} />, value: 'GiNoodles', category: 'Asian', color: '#1a7ab5' },
    { name: 'Soup', icon: <MdSoupKitchen size={28} />, value: 'MdSoupKitchen', category: 'Soups', color: '#1a7ab5' },
    { name: 'Pasta', icon: <GiChopsticks size={28} />, value: 'GiChopsticks', category: 'Italian', color: '#1a7ab5' },
    { name: 'Sandwich', icon: <GiSandwich size={28} />, value: 'GiSandwich', category: 'Sandwiches', color: '#1a7ab5' },
    { name: 'Breakfast', icon: <MdBreakfastDining size={28} />, value: 'MdBreakfastDining', category: 'Breakfast', color: '#1a7ab5' },
    { name: 'Chicken', icon: <FaDrumstickBite size={28} />, value: 'FaDrumstickBite', category: 'Poultry', color: '#1a7ab5' },
    { name: 'Fish', icon: <FaFish size={28} />, value: 'FaFish', category: 'Seafood', color: '#1a7ab5' },
    { name: 'Vegetarian', icon: <FaCarrot size={28} />, value: 'FaCarrot', category: 'Vegetarian', color: '#1a7ab5' },
    { name: 'Dessert', icon: <FaBirthdayCake size={28} />, value: 'FaBirthdayCake', category: 'Desserts', color: '#1a7ab5' },
    { name: 'Ice Cream', icon: <FaIceCream size={28} />, value: 'FaIceCream', category: 'Desserts', color: '#1a7ab5' },
    { name: 'Beverage', icon: <MdLocalDrink size={28} />, value: 'MdLocalDrink', category: 'Beverages', color: '#1a7ab5' },
    { name: 'Coffee', icon: <FaCoffee size={28} />, value: 'FaCoffee', category: 'Beverages', color: '#1a7ab5' },
    { name: 'Hot Drink', icon: <FaMugHot size={28} />, value: 'FaMugHot', category: 'Beverages', color: '#1a7ab5' },
    { name: 'Beer', icon: <FaBeer size={28} />, value: 'FaBeer', category: 'Alcoholic', color: '#1a7ab5' },
    { name: 'Wine', icon: <FaWineGlassAlt size={28} />, value: 'FaWineGlassAlt', category: 'Alcoholic', color: '#1a7ab5' },
    { name: 'Spicy', icon: <FaPepperHot size={28} />, value: 'FaPepperHot', category: 'Special', color: '#1a7ab5' },
    { name: 'Cheese', icon: <FaCheese size={28} />, value: 'FaCheese', category: 'Dairy', color: '#1a7ab5' },
    { name: 'Snacks', icon: <MdFastfood size={28} />, value: 'MdFastfood', category: 'Snacks', color: '#1a7ab5' },
    { name: 'Bakery', icon: <FaBreadSlice size={28} />, value: 'FaBreadSlice', category: 'Bakery', color: '#1a7ab5' },
    { name: 'Fruit', icon: <FaAppleAlt size={28} />, value: 'FaAppleAlt', category: 'Healthy', color: '#1a7ab5' },
    { name: 'Eggs', icon: <FaEgg size={28} />, value: 'FaEgg', category: 'Breakfast', color: '#1a7ab5' },
    { name: 'Utensils', icon: <FaUtensils size={28} />, value: 'FaUtensils', category: 'General', color: '#1a7ab5' },
    { name: 'Cookie', icon: <FaCookie size={28} />, value: 'FaCookie', category: 'Desserts', color: '#1a7ab5' },
    { name: 'Restaurant', icon: <MdRestaurant size={28} />, value: 'MdRestaurant', category: 'General', color: '#1a7ab5' },
    { name: 'Dinner', icon: <MdDinnerDining size={28} />, value: 'MdDinnerDining', category: 'Main Course', color: '#1a7ab5' },
];

const renderIcon = (iconValue, size = 24) => {
    if (!iconValue) return <ForkOutlined style={{ fontSize: size }} />;

    const iconMap = {
        FaPizzaSlice: <FaPizzaSlice size={size} />,
        FaHamburger: <FaHamburger size={size} />,
        GiNoodles: <GiNoodles size={size} />,
        MdSoupKitchen: <MdSoupKitchen size={size} />,
        GiChopsticks: <GiChopsticks size={size} />,
        GiSandwich: <GiSandwich size={size} />,
        MdBreakfastDining: <MdBreakfastDining size={size} />,
        FaDrumstickBite: <FaDrumstickBite size={size} />,
        FaFish: <FaFish size={size} />,
        FaCarrot: <FaCarrot size={size} />,
        FaBirthdayCake: <FaBirthdayCake size={size} />,
        FaIceCream: <FaIceCream size={size} />,
        MdLocalDrink: <MdLocalDrink size={size} />,
        FaCoffee: <FaCoffee size={size} />,
        FaMugHot: <FaMugHot size={size} />,
        FaBeer: <FaBeer size={size} />,
        FaWineGlassAlt: <FaWineGlassAlt size={size} />,
        FaPepperHot: <FaPepperHot size={size} />,
        FaCheese: <FaCheese size={size} />,
        MdFastfood: <MdFastfood size={size} />,
        FaBreadSlice: <FaBreadSlice size={size} />,
        FaAppleAlt: <FaAppleAlt size={size} />,
        FaEgg: <FaEgg size={size} />,
        FaUtensils: <FaUtensils size={size} />,
        FaCookie: <FaCookie size={size} />,
        MdRestaurant: <MdRestaurant size={size} />,
        MdDinnerDining: <MdDinnerDining size={size} />,
    };

    return iconMap[iconValue] || <ForkOutlined style={{ fontSize: size }} />;
};

// ============================================================
// HELPERS
// ============================================================
const currency = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

// Promotion Type Map
const PROMO_TYPE_MAP = {
    menu_discount: { label: 'Menu Discount', color: '#1a7ab5', icon: <TagsOutlined /> },
    package_discount: { label: 'Package Discount', color: '#1a7ab5', icon: <AppstoreOutlined /> },
    promo_package: { label: 'Promo Package', color: '#1a7ab5', icon: <GiftOutlined /> },
    promo_code: { label: 'Promo Code', color: '#1a7ab5', icon: <PercentageOutlined /> },
    last_minute: { label: 'Last Minute', color: '#1a7ab5', icon: <ClockCircleOutlined /> },
    value_added: { label: 'Value Added', color: '#1a7ab5', icon: <CheckCircleOutlined /> },
    booking_planning: { label: 'Booking Planning', color: '#1a7ab5', icon: <CalendarOutlined /> },
    package_upgrade: { label: 'Package Upgrade', color: '#1a7ab5', icon: <FireOutlined /> },
    referral_loyalty: { label: 'Referral/Loyalty', color: '#1a7ab5', icon: <TeamOutlined /> },
    event_specific: { label: 'Event Specific', color: '#1a7ab5', icon: <TagOutlined /> },
};

const PROMO_STATUS_MAP = {
    active: { label: 'Active', color: '#10b981' },
    scheduled: { label: 'Scheduled', color: '#1a7ab5' },
    expired: { label: 'Expired', color: '#ef4444' },
    disabled: { label: 'Disabled', color: '#94a3b8' },
};

// ============================================================
// Professional Icon Picker
// ============================================================
const ProfessionalIconPicker = ({ value, onChange }) => {
    const [visible, setVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredIcons = PROFESSIONAL_ICONS.filter((icon) => (
        icon.name.toLowerCase().includes(searchTerm.toLowerCase())
        || icon.category.toLowerCase().includes(searchTerm.toLowerCase())
    ));

    const selectedIcon = PROFESSIONAL_ICONS.find((icon) => icon.value === value);

    return (
        <div>
            <div
                onClick={() => setVisible(true)}
                className="mm-icon-picker-trigger"
            >
                {value && selectedIcon ? (
                    <>
                        <span className="mm-icon-picker-preview" style={{ color: selectedIcon.color }}>{selectedIcon.icon}</span>
                        <span className="mm-icon-picker-name">{selectedIcon.name}</span>
                    </>
                ) : (
                    <span className="mm-icon-picker-placeholder">
                        <PlusOutlined /> Choose icon
                    </span>
                )}
            </div>

            <Modal
                title={<div className="mm-icon-modal-title"><StarOutlined /> Select Category Icon</div>}
                open={visible}
                onCancel={() => setVisible(false)}
                footer={null}
                width={750}
                className="mm-icon-modal"
                maskClosable={false}
            >
                <Input.Search
                    placeholder="Search icons by name or category..."
                    onChange={(event) => setSearchTerm(event.target.value)}
                    style={{ marginBottom: 20 }}
                    allowClear
                    size="large"
                    className="mm-icon-search"
                    prefix={<SearchOutlined />}
                />
                <div className="mm-icon-grid">
                    {filteredIcons.map((icon) => (
                        <div
                            key={icon.value}
                            onClick={() => {
                                onChange?.(icon.value);
                                setVisible(false);
                            }}
                            className={`mm-icon-grid-item ${value === icon.value ? 'selected' : ''}`}
                        >
                            <span className="mm-icon-grid-icon" style={{ color: icon.color }}>{icon.icon}</span>
                            <span className="mm-icon-grid-name">{icon.name}</span>
                            <span className="mm-icon-grid-category">{icon.category}</span>
                        </div>
                    ))}
                </div>
                <div className="mm-icon-modal-footer">
                    <Text type="secondary">{filteredIcons.length} icons available</Text>
                    <Button onClick={() => setVisible(false)}>Close</Button>
                </div>
            </Modal>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const MenuManagement = () => {
    const { user } = useAuth();
    const isHeadChefOnly = hasAllowedRole(user, HEAD_CHEF_ROLES) && !hasAllowedRole(user, ADMIN_ROLES);
    const screens = useBreakpoint();
    const [menuFilters, setMenuFilters] = useState({ search: '', category_id: null });
    const [packageFilters, setPackageFilters] = useState({ search: '', is_active: null });
    const [categoryFilters, setCategoryFilters] = useState({ search: '', is_active: null });
    const [promotionFilters, setPromotionFilters] = useState({ search: '', status: null, promo_type: null });
    const [activeMainTab, setActiveMainTab] = useState('menus');

    // Menu sort state
    const [menuSortField, setMenuSortField] = useState('name');
    const [menuSortOrder, setMenuSortOrder] = useState('asc');

    const [menuModalVisible, setMenuModalVisible] = useState(false);
    const [packageModalVisible, setPackageModalVisible] = useState(false);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [promoModalVisible, setPromoModalVisible] = useState(false);
    const [recipeModalVisible, setRecipeModalVisible] = useState(false);
    const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedPackageItem, setSelectedPackageItem] = useState(null);
    const [selectedMenuItems, setSelectedMenuItems] = useState([]);
    const [recipeIngredients, setRecipeIngredients] = useState([]);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingPromotion, setEditingPromotion] = useState(null);
    const [analyticsPromotion, setAnalyticsPromotion] = useState(null);
    const [modalCurrentStep, setModalCurrentStep] = useState(0);
    const [packageCurrentStep, setPackageCurrentStep] = useState(0);
    const [menuFileList, setMenuFileList] = useState([]);
    const [packageFileList, setPackageFileList] = useState([]);
    const [promoType, setPromoType] = useState('promo_code');
    const [availableDatesList, setAvailableDatesList] = useState([]);
    const [quickViewVisible, setQuickViewVisible] = useState(false);
    const [quickViewItem, setQuickViewItem] = useState(null);
    const [packageViewModalVisible, setPackageViewModalVisible] = useState(false);
    const [viewingPackage, setViewingPackage] = useState(null);

    // Edit modal states
    const [editMenuModalVisible, setEditMenuModalVisible] = useState(false);
    const [editPackageModalVisible, setEditPackageModalVisible] = useState(false);
    const [editCategoryModalVisible, setEditCategoryModalVisible] = useState(false);
    const [editPromoModalVisible, setEditPromoModalVisible] = useState(false);

    useEffect(() => {
        if (isHeadChefOnly && !['menus', 'categories'].includes(activeMainTab)) {
            setActiveMainTab('menus');
        }
    }, [activeMainTab, isHeadChefOnly]);

    const [menuForm] = Form.useForm();
    const [packageForm] = Form.useForm();
    const [categoryForm] = Form.useForm();
    const [promoForm] = Form.useForm();

    // ============================================================
    // QUERIES
    // ============================================================
    const menuQuery = useMenuItems({ page: 1, per_page: 500 });
    const categoryQuery = useCategories({ page: 1, per_page: 500 });
    const packageQuery = usePackages({ page: 1, per_page: 500 });
    const promotionQuery = usePromotions({ page: 1, per_page: 500 });
    const ingredientQuery = useIngredients({ page: 1, per_page: 500 });
    const statisticsQuery = useMenuStatistics();

    // ============================================================
    // MUTATIONS
    // ============================================================
    const createMenuItem = useCreateMenuItem();
    const updateMenuItem = useUpdateMenuItem();
    const deleteMenuItem = useDeleteMenuItem();
    const toggleAvailability = useToggleMenuItemAvailability();
    const toggleFeatured = useToggleMenuItemFeatured();
    const createCategory = useCreateCategory();
    const updateCategory = useUpdateCategory();
    const deleteCategory = useDeleteCategory();
    const createPackage = useCreatePackage();
    const updatePackage = useUpdatePackage();
    const deletePackage = useDeletePackage();
    const createPromotion = useCreatePromotion();
    const updatePromotion = useUpdatePromotion();
    const deletePromotion = useDeletePromotion();
    const duplicatePromotion = useDuplicatePromotion();
    const togglePromotionActive = useTogglePromotionActive();

    // ============================================================
    // DATA FROM CACHE
    // ============================================================
    const menus = menuQuery.data?.data || [];
    const categories = categoryQuery.data?.data || [];
    const packages = packageQuery.data?.data || [];
    const promotions = promotionQuery.data?.data || [];
    const ingredients = ingredientQuery.data?.data || [];

    const ingredientById = useMemo(() => new Map(
        ingredients.map((ingredient) => [Number(ingredient.id), ingredient]),
    ), [ingredients]);

    // ============================================================
    // ANALYTICS QUERY
    // ============================================================
    const analyticsQuery = usePromotionAnalytics(analyticsPromotion?.id, {
        enabled: !!analyticsPromotion?.id && analyticsModalVisible,
    });

    const redemptionsQuery = usePromotionRedemptions(analyticsPromotion?.id, {
        enabled: !!analyticsPromotion?.id && analyticsModalVisible,
        per_page: 10,
    });

    // ============================================================
    // COMPUTED VALUES
    // ============================================================
    const calculateTotalRecipeCost = () => recipeIngredients.reduce((sum, ingredientRow) => {
        const ingredient = ingredientById.get(Number(ingredientRow.ingredient_id));
        return sum + Number(ingredientRow.quantity_per_pax || 0) * Number(ingredient?.unit_cost || 0);
    }, 0);

    const calculateProfitMargin = () => {
        const price = Number(menuForm.getFieldValue('price') || 0);
        const cost = calculateTotalRecipeCost();
        if (price <= 0) return 0;
        return ((price - cost) / price) * 100;
    };

    // ============================================================
    // HANDLERS - CLOSE MODALS
    // ============================================================
    const closeMenuModal = () => {
        setMenuModalVisible(false);
        setEditMenuModalVisible(false);
        setSelectedItem(null);
        setRecipeIngredients([]);
        setMenuFileList([]);
        menuForm.resetFields();
        setModalCurrentStep(0);
    };

    const closePackageModal = () => {
        setPackageModalVisible(false);
        setEditPackageModalVisible(false);
        setSelectedPackageItem(null);
        setSelectedMenuItems([]);
        setPackageFileList([]);
        packageForm.resetFields();
        setPackageCurrentStep(0);
    };

    const closeCategoryModal = () => {
        setCategoryModalVisible(false);
        setEditCategoryModalVisible(false);
        setEditingCategory(null);
        categoryForm.resetFields();
    };

    const closePromoModal = () => {
        setPromoModalVisible(false);
        setEditPromoModalVisible(false);
        setEditingPromotion(null);
        promoForm.resetFields();
    };

    const closeAnalyticsModal = () => {
        setAnalyticsModalVisible(false);
        setAnalyticsPromotion(null);
    };

    const closeQuickView = () => {
        setQuickViewVisible(false);
        setQuickViewItem(null);
    };

    const closePackageView = () => {
        setPackageViewModalVisible(false);
        setViewingPackage(null);
    };

    // ============================================================
    // HANDLERS - REFRESH & EXPORT
    // ============================================================
    const handleRefresh = async () => {
        try {
            await Promise.all([
                menuQuery.refetch(),
                categoryQuery.refetch(),
                packageQuery.refetch(),
                promotionQuery.refetch(),
                ingredientQuery.refetch(),
                statisticsQuery.refetch(),
            ]);
            message.success({
                content: 'All menu data refreshed successfully ✨',
                icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
            });
        } catch {
            message.error('Failed to refresh data');
        }
    };

    // ============================================================
    // HANDLERS - PRINT
    // ============================================================
    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const rows = [
            ['ID', 'Name', 'Category', 'Description', 'Price', 'Preparation Minutes', 'Available', 'Featured'],
            ...menus.map((item) => [
                item.id,
                item.name,
                item.category,
                item.description,
                item.price,
                item.prep_time_minutes,
                item.is_available ? 'Yes' : 'No',
                item.is_popular ? 'Yes' : 'No',
            ]),
        ];
        const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `menu-items-${dayjs().format('YYYY-MM-DD')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        message.success('Export completed successfully 📊');
    };

    // ============================================================
    // HANDLERS - TOGGLE STATUS
    // ============================================================
    const handleToggleFeatured = async (record) => {
        try {
            await toggleFeatured.mutateAsync(record.id);
            message.success(`${record.is_popular ? 'Removed' : 'Added'} ${record.name} from featured ✨`);
        } catch {
            // Error handled by mutation
        }
    };

    const handleToggleMenuAvailability = async (record) => {
        try {
            await toggleAvailability.mutateAsync(record.id);
            message.success(`${record.name} is now ${record.is_available ? 'unavailable' : 'available'} 🔄`);
            menuQuery.refetch();
        } catch {
            // Error handled by mutation
        }
    };

    const handleTogglePackageActive = async (record) => {
        try {
            await updatePackage.mutateAsync({ id: record.id, data: { is_active: !record.is_active } });
            packageQuery.refetch();
            message.success(`Package ${record.is_active ? 'deactivated' : 'activated'} ✅`);
        } catch {
            message.error('Failed to update package status');
        }
    };

    const handleToggleCategoryActive = async (record) => {
        try {
            await updateCategory.mutateAsync({ id: record.id, data: { is_active: !record.is_active } });
            categoryQuery.refetch();
            message.success(`Category ${record.is_active ? 'deactivated' : 'activated'} ✅`);
        } catch {
            message.error('Failed to update category status');
        }
    };

    const handleTogglePromotionActive = async (record) => {
        try {
            await togglePromotionActive.mutateAsync(record.id);
            promotionQuery.refetch();
            message.success(`Promotion ${record.is_active ? 'deactivated' : 'activated'} ✅`);
        } catch {
            message.error('Failed to update promotion status');
        }
    };

    // ============================================================
    // HANDLERS - MENU ITEMS
    // ============================================================
    const handleAddMenu = () => {
        closeMenuModal();
        menuForm.setFieldsValue({
            prep_time_minutes: 15,
            serving_size: 1,
            is_available: true,
            is_popular: false,
            is_vegetarian: false,
            is_vegan: false,
            is_gluten_free: false,
            is_halal: false,
        });
        setMenuModalVisible(true);
    };

    const handleEditMenu = (record) => {
        setSelectedItem(record);
        setRecipeIngredients((record.recipe_ingredients || []).map((row) => ({
            ...row,
            id: row.id || row.recipe_ingredient_id || `${row.ingredient_id}-${Date.now()}`,
            ingredient_id: Number(row.ingredient_id),
            quantity_per_pax: Number(row.quantity_per_pax || 0),
            unit: row.unit || row.ingredient?.unit || 'kg',
        })));
        setMenuFileList(record.image_url ? [{
            uid: 'current-image',
            name: 'Current menu image',
            status: 'done',
            url: record.image_url,
        }] : []);
        setModalCurrentStep(0);
        menuForm.resetFields();
        menuForm.setFieldsValue({
            name: record.name,
            category_id: record.category_id,
            description: record.description || '',
            price: Number(record.price || 0),
            prep_time_minutes: Number(record.prep_time_minutes || 0),
            serving_size: Number(record.serving_size || 1),
            is_available: record.is_available !== false,
            is_popular: Boolean(record.is_popular),
            is_vegetarian: Boolean(record.is_vegetarian),
            is_vegan: Boolean(record.is_vegan),
            is_gluten_free: Boolean(record.is_gluten_free),
            is_halal: Boolean(record.is_halal),
            allergens: record.allergens
                ? String(record.allergens).split(',').map((value) => value.trim()).filter(Boolean)
                : [],
            nutritional_info: record.nutritional_info || '',
            ingredients_list: record.ingredients_list || '',
        });
        setEditMenuModalVisible(true);
    };

    // REMOVED: handleDeleteMenu - Delete button removed

    const handleViewRecipe = (record) => {
        setSelectedItem(record);
        setRecipeModalVisible(true);
    };

    const handleQuickView = (record) => {
        setQuickViewItem(record);
        setQuickViewVisible(true);
    };

    // ============================================================
    // HANDLERS - RECIPE INGREDIENTS
    // ============================================================
    const handleAddRecipeIngredient = () => {
        setRecipeIngredients((rows) => [...rows, {
            id: `new-${Date.now()}`,
            ingredient_id: null,
            quantity_per_pax: 0.001,
            unit: 'kg',
        }]);
    };

    const handleUpdateRecipeIngredient = (id, field, value) => {
        setRecipeIngredients((rows) => rows.map((row) => {
            if (row.id !== id) return row;
            if (field !== 'ingredient_id') return { ...row, [field]: value };
            const ingredient = ingredientById.get(Number(value));
            return {
                ...row,
                ingredient_id: Number(value),
                unit: ingredient?.unit || row.unit || 'kg',
            };
        }));
    };

    const handleRemoveRecipeIngredient = (id) => {
        setRecipeIngredients((rows) => rows.filter((row) => row.id !== id));
    };

    // ============================================================
    // HANDLERS - PACKAGES
    // ============================================================
    const handleAddPackage = () => {
        closePackageModal();
        packageForm.setFieldsValue({
            min_pax: 1,
            max_pax: 100,
            price_per_additional_pax: 0,
            default_duration_hours: 4,
            sort_order: 0,
            is_active: true,
            is_featured: false,
        });
        setPackageModalVisible(true);
    };

    const handleEditPackage = (record) => {
        setSelectedPackageItem(record);
        setSelectedMenuItems((record.menu_items || record.items || []).map((item) => ({
            ...item,
            id: item.id || item.menu_item_id,
            menu_item_id: item.menu_item_id || item.id,
            quantity: Number(item.quantity_per_pax || item.quantity || 1),
            quantity_per_pax: Number(item.quantity_per_pax || item.quantity || 1),
        })));
        setPackageFileList(record.image_url ? [{
            uid: 'current-package-image',
            name: 'Current package image',
            status: 'done',
            url: record.image_url,
        }] : []);
        packageForm.resetFields();
        packageForm.setFieldsValue({
            name: record.name,
            description: record.description || '',
            min_pax: Number(record.min_pax || 1),
            max_pax: Number(record.max_pax || 1),
            base_price_per_pax: Number(record.base_price_per_pax || 0),
            price_per_additional_pax: Number(record.price_per_additional_pax || 0),
            default_duration_hours: Number(record.default_duration_hours || 4),
            is_active: record.is_active !== false,
            is_featured: Boolean(record.is_featured),
            sort_order: Number(record.sort_order || 0),
            inclusions: record.inclusions || [],
            exclusions: record.exclusions || [],
        });
        setPackageCurrentStep(0);
        setEditPackageModalVisible(true);
    };

    // REMOVED: handleDeletePackage - Delete button removed

    const handleViewPackage = (record) => {
        setViewingPackage(record);
        setPackageViewModalVisible(true);
    };

    const handleAddMenuItemToPackage = (record) => {
        if (selectedMenuItems.some((item) => Number(item.menu_item_id || item.id) === Number(record.id))) {
            message.warning('Menu item is already included in this package');
            return;
        }
        setSelectedMenuItems((items) => [...items, {
            ...record,
            id: record.id,
            menu_item_id: record.id,
            quantity: 1,
            quantity_per_pax: 1,
            is_optional: false,
            is_replaceable: false,
            additional_cost: 0,
        }]);
        message.success(`Added ${record.name} to package ✨`);
    };

    const handleRemoveMenuItemFromPackage = (menuId) => {
        setSelectedMenuItems((items) => items.filter((item) => Number(item.menu_item_id || item.id) !== Number(menuId)));
    };

    const handleUpdateMenuItemQuantity = (menuId, quantity) => {
        setSelectedMenuItems((items) => items.map((item) => (
            Number(item.menu_item_id || item.id) === Number(menuId)
                ? { ...item, quantity: Number(quantity || 1), quantity_per_pax: Number(quantity || 1) }
                : item
        )));
    };

    // ============================================================
    // HANDLERS - CATEGORIES
    // ============================================================
    const handleAddCategory = () => {
        setEditingCategory(null);
        categoryForm.resetFields();
        categoryForm.setFieldsValue({ display_order: 0, is_active: true });
        setCategoryModalVisible(true);
    };

    const handleEditCategory = (record) => {
        setEditingCategory(record);
        categoryForm.resetFields();
        categoryForm.setFieldsValue({
            name: record.name,
            description: record.description || '',
            icon: record.icon || null,
            display_order: Number(record.display_order || 0),
            is_active: record.is_active !== false,
        });
        setEditCategoryModalVisible(true);
    };

    // REMOVED: handleDeleteCategory - Delete button removed

    const handleSaveCategory = async (values) => {
        const payload = {
            name: values.name.trim(),
            description: values.description || '',
            icon: values.icon || null,
            display_order: Number(values.display_order || 0),
            is_active: values.is_active !== false,
        };
        try {
            if (editingCategory) {
                await updateCategory.mutateAsync({ id: editingCategory.id, data: payload });
                message.success(`Updated ${values.name} category ✅`);
            } else {
                await createCategory.mutateAsync(payload);
                message.success(`Created ${values.name} category 🎉`);
            }
            closeCategoryModal();
            categoryQuery.refetch();
        } catch {
            // Error handled by mutation
        }
    };

    // ============================================================
    // HANDLERS - PROMOTIONS
    // ============================================================
    const handleAddPromotion = () => {
        setEditingPromotion(null);
        setPromoType('promo_code');
        promoForm.resetFields();
        promoForm.setFieldsValue({
            discount_type: 'percentage',
            is_active: true,
            is_featured: false,
            allow_stacking: false,
            promo_type: 'promo_code',
        });
        setPromoModalVisible(true);
    };

    const handleEditPromotion = (record) => {
        setEditingPromotion(record);
        setPromoType(record.promo_type || 'promo_code');
        promoForm.resetFields();
        promoForm.setFieldsValue({
            name: record.name,
            code: record.code,
            description: record.description || '',
            promo_type: record.promo_type || 'promo_code',
            discount_type: record.discount_type || 'percentage',
            discount_value: Number(record.discount_value || 0),
            discounted_price: record.discounted_price ? Number(record.discounted_price) : null,
            start_date: record.start_date ? dayjs(record.start_date) : null,
            end_date: record.end_date ? dayjs(record.end_date) : null,
            start_time: record.start_time ? dayjs(record.start_time, 'HH:mm') : null,
            end_time: record.end_time ? dayjs(record.end_time, 'HH:mm') : null,
            min_pax: record.min_pax,
            max_pax: record.max_pax,
            min_booking_amount: record.min_booking_amount ? Number(record.min_booking_amount) : null,
            max_redemptions: record.max_redemptions,
            per_customer_limit: record.per_customer_limit,
            days_before_event: record.days_before_event,
            allow_stacking: record.allow_stacking || false,
            is_active: record.is_active !== false,
            is_featured: record.is_featured || false,
            sort_order: record.sort_order || 0,
            banner_image_url: record.banner_image_url || '',
            applicable_menu_item_ids: record.applicable_menu_item_ids || [],
            applicable_package_ids: record.applicable_package_ids || [],
            applicable_event_type_ids: record.applicable_event_type_ids || [],
            free_addons: record.free_addons || [],
            complimentary_items: record.complimentary_items || '',
            available_dates: record.available_dates || [],
        });
        setAvailableDatesList(record.available_dates || []);
        setEditPromoModalVisible(true);
    };

    // REMOVED: handleDeletePromotion - Delete button removed

    const handleDuplicatePromotion = (record) => {
        Modal.confirm({
            title: 'Duplicate Promotion',
            content: (
                <div>
                    <p>Create a copy of <strong>"{record.name}"</strong>?</p>
                    <Text type="secondary">All settings will be copied.</Text>
                </div>
            ),
            okText: 'Yes, Duplicate',
            cancelText: 'Cancel',
            icon: <CopyOutlined style={{ color: '#1a7ab5' }} />,
            onOk: async () => {
                try {
                    await duplicatePromotion.mutateAsync(record.id);
                    promotionQuery.refetch();
                    message.success(`Duplicated ${record.name} promotion 📋`);
                } catch {
                    // Error handled by mutation
                }
            },
        });
    };

    const handleViewAnalytics = (record) => {
        setAnalyticsPromotion(record);
        setAnalyticsModalVisible(true);
    };

    const handleSavePromotion = async (values) => {
        const payload = {
            name: values.name.trim(),
            code: values.code?.trim().toUpperCase() || null,
            description: values.description || '',
            promo_type: values.promo_type || 'promo_code',
            discount_type: values.discount_type,
            discount_value: Number(values.discount_value),
            discounted_price: values.discounted_price ? Number(values.discounted_price) : null,
            start_date: values.start_date.format('YYYY-MM-DD'),
            end_date: values.end_date.format('YYYY-MM-DD'),
            start_time: values.start_time ? values.start_time.format('HH:mm') : null,
            end_time: values.end_time ? values.end_time.format('HH:mm') : null,
            min_pax: values.min_pax ? Number(values.min_pax) : null,
            max_pax: values.max_pax ? Number(values.max_pax) : null,
            min_booking_amount: values.min_booking_amount ? Number(values.min_booking_amount) : null,
            max_redemptions: values.max_redemptions ? Number(values.max_redemptions) : null,
            per_customer_limit: values.per_customer_limit ? Number(values.per_customer_limit) : null,
            days_before_event: values.days_before_event ? Number(values.days_before_event) : null,
            allow_stacking: values.allow_stacking || false,
            is_active: values.is_active !== false,
            is_featured: values.is_featured || false,
            is_automatic: values.promo_type === 'last_minute' || false,
            sort_order: Number(values.sort_order || 0),
            banner_image_url: values.banner_image_url || null,
            applicable_menu_item_ids: values.applicable_menu_item_ids || [],
            applicable_package_ids: values.applicable_package_ids || [],
            applicable_event_type_ids: values.applicable_event_type_ids || [],
            free_addons: values.free_addons || [],
            complimentary_items: values.complimentary_items || '',
            available_dates: values.available_dates || [],
        };

        try {
            if (editingPromotion) {
                await updatePromotion.mutateAsync({ id: editingPromotion.id, data: payload });
                message.success(`Updated ${values.name} promotion ✅`);
            } else {
                await createPromotion.mutateAsync(payload);
                message.success(`Created ${values.name} promotion 🎉`);
            }
            closePromoModal();
            promotionQuery.refetch();
        } catch {
            // Error handled by mutation
        }
    };

    // ============================================================
    // HANDLERS - SAVE MENU & PACKAGE
    // ============================================================
    const appendBoolean = (formData, key, value) => {
        formData.append(key, value ? '1' : '0');
    };

    const handleSaveMenu = async () => {
        try {
            const values = await menuForm.validateFields();
            const formData = new FormData();
            const recipePayload = recipeIngredients
                .filter((row) => row.ingredient_id && Number(row.quantity_per_pax) > 0)
                .map((row) => ({
                    ingredient_id: Number(row.ingredient_id),
                    quantity_per_pax: Number(row.quantity_per_pax),
                    unit: row.unit || ingredientById.get(Number(row.ingredient_id))?.unit || 'kg',
                }));

            formData.append('name', values.name.trim());
            formData.append('category_id', String(values.category_id));
            formData.append('description', values.description || '');
            formData.append('price', String(values.price));
            formData.append('cost_to_make', String(calculateTotalRecipeCost()));
            formData.append('prep_time_minutes', String(values.prep_time_minutes ?? 0));
            formData.append('serving_size', String(values.serving_size ?? 1));
            formData.append('allergens', Array.isArray(values.allergens) ? values.allergens.join(', ') : (values.allergens || ''));
            formData.append('nutritional_info', values.nutritional_info || '');
            formData.append('ingredients_list', values.ingredients_list || '');
            formData.append('ingredients', JSON.stringify(recipePayload));
            appendBoolean(formData, 'is_available', values.is_available !== false);
            appendBoolean(formData, 'is_popular', values.is_popular);
            appendBoolean(formData, 'is_vegetarian', values.is_vegetarian);
            appendBoolean(formData, 'is_vegan', values.is_vegan);
            appendBoolean(formData, 'is_gluten_free', values.is_gluten_free);
            appendBoolean(formData, 'is_halal', values.is_halal);

            const newImage = menuFileList.find((file) => file.originFileObj);
            if (newImage?.originFileObj) formData.append('image', newImage.originFileObj);

            if (selectedItem) {
                await updateMenuItem.mutateAsync({ id: selectedItem.id, data: formData });
                message.success(`Updated ${values.name} successfully ✅`);
            } else {
                await createMenuItem.mutateAsync(formData);
                message.success(`Created ${values.name} successfully 🎉`);
            }

            closeMenuModal();
            menuQuery.refetch();
        } catch {
            // Error handled by form or mutation
        }
    };

    const handleSavePackage = async () => {
        try {
            const values = await packageForm.validateFields();
            if (Number(values.max_pax) < Number(values.min_pax)) {
                message.error('Maximum guests must be greater than or equal to minimum guests');
                return;
            }

            const formData = new FormData();
            const menuItemsPayload = selectedMenuItems.map((item) => ({
                menu_item_id: Number(item.menu_item_id || item.id),
                quantity_per_pax: Number(item.quantity_per_pax || item.quantity || 1),
                is_optional: Boolean(item.is_optional || false),
                is_replaceable: Boolean(item.is_replaceable || false),
                additional_cost: Number(item.additional_cost || 0),
            }));

            formData.append('name', values.name.trim());
            formData.append('description', values.description || '');
            formData.append('base_price_per_pax', String(values.base_price_per_pax));
            formData.append('min_pax', String(values.min_pax));
            formData.append('max_pax', String(values.max_pax));
            formData.append('price_per_additional_pax', String(values.price_per_additional_pax || 0));
            formData.append('default_duration_hours', String(values.default_duration_hours || 4));
            formData.append('sort_order', String(values.sort_order || 0));
            formData.append('is_active', values.is_active !== false ? '1' : '0');
            formData.append('is_featured', values.is_featured ? '1' : '0');
            formData.append('inclusions', JSON.stringify(values.inclusions || []));
            formData.append('exclusions', JSON.stringify(values.exclusions || []));
            formData.append('menu_items', JSON.stringify(menuItemsPayload));

            const newImage = packageFileList.find((file) => file.originFileObj);
            if (newImage?.originFileObj) {
                formData.append('image', newImage.originFileObj);
            }

            if (selectedPackageItem) {
                await updatePackage.mutateAsync({ id: selectedPackageItem.id, data: formData });
                message.success(`Updated ${values.name} package ✅`);
            } else {
                await createPackage.mutateAsync(formData);
                message.success(`Created ${values.name} package 🎉`);
            }
            closePackageModal();
            packageQuery.refetch();
        } catch (error) {
            console.error('Save package error:', error);
        }
    };

    // ============================================================
    // UPLOAD PROPS
    // ============================================================
    const menuUploadProps = {
        beforeUpload: (file) => {
            if (!file.type?.startsWith('image/')) {
                message.error('You can only upload image files');
                return Upload.LIST_IGNORE;
            }
            if (file.size / 1024 / 1024 >= 2) {
                message.error('Image must be smaller than 2 MB');
                return Upload.LIST_IGNORE;
            }
            return false;
        },
        onChange: ({ fileList: nextFileList }) => setMenuFileList(nextFileList.slice(-1)),
    };

    const packageUploadProps = {
        beforeUpload: (file) => {
            if (!file.type?.startsWith('image/')) {
                message.error('You can only upload image files');
                return Upload.LIST_IGNORE;
            }
            if (file.size / 1024 / 1024 >= 2) {
                message.error('Image must be smaller than 2 MB');
                return Upload.LIST_IGNORE;
            }
            return false;
        },
        onChange: ({ fileList: nextFileList }) => setPackageFileList(nextFileList.slice(-1)),
    };

    // ============================================================
    // FILTERED & SORTED DATA
    // ============================================================
    const filteredMenus = menus.filter((item) => (
        (!menuFilters.search || item.name?.toLowerCase().includes(menuFilters.search.toLowerCase()))
        && (!menuFilters.category_id || Number(item.category_id) === Number(menuFilters.category_id))
    ));

    // Sort menus
    const sortedMenus = [...filteredMenus].sort((a, b) => {
        let aVal = a[menuSortField] || '';
        let bVal = b[menuSortField] || '';
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return menuSortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return menuSortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredPackages = packages.filter((item) => (
        !packageFilters.search || item.name?.toLowerCase().includes(packageFilters.search.toLowerCase())
    ));

    const filteredCategories = categories.filter((item) => (
        !categoryFilters.search || item.name?.toLowerCase().includes(categoryFilters.search.toLowerCase())
    ));

    const filteredPromotions = promotions.filter((item) => {
        let match = true;
        if (promotionFilters.search) {
            match = match && item.name?.toLowerCase().includes(promotionFilters.search.toLowerCase());
        }
        if (promotionFilters.status) {
            match = match && item.status === promotionFilters.status;
        }
        if (promotionFilters.promo_type) {
            match = match && item.promo_type === promotionFilters.promo_type;
        }
        return match;
    });

    // ============================================================
    // TABLE COLUMNS - ENHANCED (No Delete Button)
    // ============================================================
    const menuColumns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            fixed: 'left',
            render: (_, __, index) => (
                <span className="mm-row-index">{index + 1}</span>
            )
        },
        {
            title: 'ITEM',
            key: 'item',
            width: 300,
            fixed: 'left',
            render: (_, record) => (
                <div className="mm-menu-item-cell">
                    <Avatar
                        src={record.image_url || '/images/placeholder.svg'}
                        size={40}
                        shape="square"
                        className="mm-menu-item-avatar"
                        icon={<FileImageOutlined />}
                    />
                    <div className="mm-menu-item-info">
                        <div className="mm-menu-item-name">{record.name}</div>
                        <div className="mm-menu-item-meta">
                            <span className="mm-category-label">{record.category || 'Uncategorized'}</span>
                            {record.is_popular && <span className="mm-featured-label">★ Featured</span>}
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: 'DESCRIPTION',
            dataIndex: 'description',
            key: 'description',
            width: 200,
            ellipsis: true,
            render: (text) => (
                <Tooltip title={text}>
                    <span className="mm-description-text">{text?.substring(0, 50) || '—'}{text?.length > 50 ? '...' : ''}</span>
                </Tooltip>
            )
        },
        {
            title: 'PRICE',
            dataIndex: 'price',
            key: 'price',
            width: 120,
            align: 'right',
            render: (value) => (
                <span className="mm-price-amount">{currency(value)}</span>
            )
        },
        {
            title: 'DIETARY',
            key: 'dietary',
            width: 200,
            render: (_, record) => {
                const dietaryTags = [];
                if (record.is_vegetarian) dietaryTags.push('Vegetarian');
                if (record.is_vegan) dietaryTags.push('Vegan');
                if (record.is_gluten_free) dietaryTags.push('Gluten Free');
                if (record.is_halal) dietaryTags.push('Halal');
                if (dietaryTags.length === 0) return <span className="mm-dietary-none">—</span>;
                return (
                    <Space size={4} wrap>
                        {dietaryTags.map((tag, idx) => (
                            <span key={idx} className={`mm-dietary-tag ${tag.toLowerCase().replace(' ', '-')}`}>
                                {tag}
                            </span>
                        ))}
                    </Space>
                );
            }
        },
        {
            title: 'STATUS',
            key: 'status',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <Switch
                    checked={record.is_available !== false}
                    loading={toggleAvailability.isPending}
                    onChange={() => handleToggleMenuAvailability(record)}
                    checkedChildren={<CheckCircleOutlined />}
                    unCheckedChildren={<CloseOutlined />}
                    className="mm-status-switch"
                />
            )
        },
        {
            title: 'FEATURED',
            key: 'featured',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Button
                    type={record.is_popular ? 'primary' : 'text'}
                    shape="circle"
                    icon={<StarOutlined />}
                    onClick={() => handleToggleFeatured(record)}
                    loading={toggleFeatured.isPending}
                    className={`mm-featured-btn ${record.is_popular ? 'active' : ''}`}
                />
            )
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 120,
            fixed: 'right',
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="View Details">
                        <Button
                            className="mm-action-btn view"
                            icon={<EyeOutlined />}
                            onClick={() => handleQuickView(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            className="mm-action-btn edit"
                            icon={<EditOutlined />}
                            onClick={() => handleEditMenu(record)}
                            size="small"
                        />
                    </Tooltip>
                </Space>
            )
        },
    ];

    const packageColumns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_, __, index) => <span className="mm-row-index">{index + 1}</span>
        },
        {
            title: 'PACKAGE',
            key: 'package',
            width: 280,
            render: (_, record) => (
                <div className="mm-package-cell">
                    <Avatar
                        src={record.image_url || '/images/placeholder.svg'}
                        size={40}
                        shape="square"
                        className="mm-package-avatar"
                        icon={<AppstoreOutlined />}
                    />
                    <div className="mm-package-info">
                        <div className="mm-package-name">{record.name}</div>
                        <div className="mm-package-meta">
                            <span className="mm-pax-label">
                                <TeamOutlined /> {record.min_pax || 0} - {record.max_pax || 0} pax
                            </span>
                            <span className="mm-item-count">{record.menu_items?.length || 0} items</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: 'PRICE / PAX',
            dataIndex: 'base_price_per_pax',
            key: 'price',
            width: 130,
            align: 'right',
            render: (value) => (
                <span className="mm-package-price">{currency(value)}</span>
            )
        },
        {
            title: 'DURATION',
            dataIndex: 'default_duration_hours',
            key: 'duration',
            width: 100,
            align: 'center',
            render: (value) => <span className="mm-duration-label">{value || 4}h</span>
        },
        {
            title: 'STATUS',
            key: 'status',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <Switch
                    checked={record.is_active !== false}
                    loading={updatePackage.isPending}
                    onChange={() => handleTogglePackageActive(record)}
                    checkedChildren={<CheckCircleOutlined />}
                    unCheckedChildren={<CloseOutlined />}
                    className="mm-status-switch"
                />
            )
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 120,
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="View Items">
                        <Button
                            className="mm-action-btn view"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewPackage(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            className="mm-action-btn edit"
                            icon={<EditOutlined />}
                            onClick={() => handleEditPackage(record)}
                            size="small"
                        />
                    </Tooltip>
                </Space>
            )
        },
    ];

    const categoryColumns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_, __, index) => <span className="mm-row-index">{index + 1}</span>
        },
        {
            title: 'CATEGORY',
            key: 'category',
            width: 300,
            render: (_, record) => (
                <div className="mm-category-cell">
                    <div className="mm-category-info">
                        <div className="mm-category-name">{record.name}</div>
                        <span className="mm-category-slug">{record.slug}</span>
                    </div>
                </div>
            )
        },
        {
            title: 'ITEMS',
            key: 'items',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <span className="mm-item-count-badge">{record.menu_items_count || 0}</span>
            )
        },
        {
            title: 'STATUS',
            key: 'status',
            width: 100,
            align: 'center',
            render: (_, record) => (
                <Switch
                    checked={record.is_active !== false}
                    loading={updateCategory.isPending}
                    onChange={() => handleToggleCategoryActive(record)}
                    checkedChildren={<CheckCircleOutlined />}
                    unCheckedChildren={<CloseOutlined />}
                    className="mm-status-switch"
                />
            )
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 80,
            render: (_, record) => (
                <Space size={4}>
                    <Tooltip title="Edit">
                        <Button
                            className="mm-action-btn edit"
                            icon={<EditOutlined />}
                            onClick={() => handleEditCategory(record)}
                            size="small"
                        />
                    </Tooltip>
                </Space>
            )
        },
    ];

    const promoColumns = [
        {
            title: 'TYPE',
            dataIndex: 'promo_type',
            key: 'type',
            width: 140,
            render: (type) => {
                const info = PROMO_TYPE_MAP[type] || { label: type, color: '#1a7ab5', icon: <TagOutlined /> };
                return (
                    <span className="mm-promo-type" style={{ color: info.color }}>
                        {info.icon} {info.label}
                    </span>
                );
            }
        },
        {
            title: 'PROMOTION',
            key: 'promotion',
            width: 220,
            render: (_, record) => (
                <div className="mm-promo-cell">
                    <div className="mm-promo-name">{record.name}</div>
                    <div className="mm-promo-meta">
                        {record.code && <span className="mm-promo-code">{record.code}</span>}
                        {record.is_featured && <span className="mm-featured-label">★ Featured</span>}
                    </div>
                </div>
            )
        },
        {
            title: 'DISCOUNT',
            key: 'discount',
            width: 110,
            render: (_, record) => {
                if (record.discount_type === 'free_addon') {
                    return <span className="mm-discount-label free">Free Add-on</span>;
                }
                const value = record.discount_type === 'percentage' ? `${record.discount_value}%` : currency(record.discount_value);
                return <span className="mm-discount-label">{value}</span>;
            }
        },
        {
            title: 'PERIOD',
            key: 'period',
            width: 180,
            render: (_, record) => (
                <div className="mm-period-info">
                    <span>{dayjs(record.start_date).format('MMM DD')} → {dayjs(record.end_date).format('MMM DD, YYYY')}</span>
                    {record.days_until_expiry !== null && record.days_until_expiry > 0 && (
                        <span className="mm-days-left">{record.days_until_expiry} days left</span>
                    )}
                </div>
            )
        },
        {
            title: 'USAGE',
            key: 'usage',
            width: 130,
            render: (_, record) => {
                const total = record.max_redemptions || '∞';
                const used = record.redemption_count || 0;
                return (
                    <div className="mm-usage-cell">
                        <span className="mm-usage-text">{used} / {total}</span>
                    </div>
                );
            }
        },
        {
            title: 'STATUS',
            key: 'status',
            width: 100,
            align: 'center',
            render: (_, record) => {
                const info = PROMO_STATUS_MAP[record.status] || PROMO_STATUS_MAP.disabled;
                return (
                    <span className="mm-status-label" style={{ color: info.color }}>
                        ● {info.label}
                    </span>
                );
            }
        },
        {
            title: 'ACTIONS',
            key: 'actions',
            width: 160,
            render: (_, record) => (
                <Space size={4}>
                    <Switch
                        checked={record.is_active !== false && record.status !== 'expired'}
                        loading={togglePromotionActive.isPending}
                        onChange={() => handleTogglePromotionActive(record)}
                        size="small"
                        disabled={record.status === 'expired'}
                        className="mm-action-switch"
                    />
                    <Tooltip title="Analytics">
                        <Button
                            className="mm-action-btn view"
                            icon={<BarChartOutlined />}
                            onClick={() => handleViewAnalytics(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            className="mm-action-btn edit"
                            icon={<EditOutlined />}
                            onClick={() => handleEditPromotion(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Duplicate">
                        <Button
                            className="mm-action-btn duplicate"
                            icon={<CopyOutlined />}
                            onClick={() => handleDuplicatePromotion(record)}
                            size="small"
                        />
                    </Tooltip>
                </Space>
            )
        },
    ];

    // ============================================================
    // LOADING STATE
    // ============================================================
    const hasData = menuQuery.data || categoryQuery.data || packageQuery.data || promotionQuery.data;
    const isInitialLoading = !hasData &&
        (menuQuery.isLoading || categoryQuery.isLoading || packageQuery.isLoading || promotionQuery.isLoading);

    if (isInitialLoading) {
        return (
            <div className="mm-loading-container">
                <Spin size="large" tip="Loading menu data..." />
            </div>
        );
    }

    // ============================================================
    // THEME
    // ============================================================
    const theme = {
        token: {
            colorPrimary: '#1a7ab5',
            colorBgContainer: '#ffffff',
            colorBgElevated: '#ffffff',
            colorBorderSecondary: '#e4e9f0',
            borderRadius: 12,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            colorText: '#111827',
            colorTextSecondary: '#6b7280',
            controlHeight: 40,
            controlHeightLG: 44,
            controlHeightSM: 32,
        },
        components: {
            Table: {
                headerBg: '#f8fafc',
                headerColor: '#111827',
                rowHoverBg: '#f8fafc',
                headerBorderRadius: 12,
            },
            Card: {
                colorBgContainer: '#ffffff',
                borderRadiusLG: 16,
            },
            Button: {
                borderRadius: 10,
                controlHeight: 40,
            },
            Input: {
                borderRadius: 10,
            },
            Select: {
                borderRadius: 10,
            },
            Modal: {
                borderRadiusLG: 20,
            },
            Tag: {
                borderRadius: 8,
            },
        },
    };

    const handleTabChange = (key) => {
        setActiveMainTab(key);
    };

    // ============================================================
    // SORT CONTROLS - Enhanced with A-Z inside Sort
    // ============================================================
    const handleSortChange = (value) => {
        if (value === 'name_asc') {
            setMenuSortField('name');
            setMenuSortOrder('asc');
        } else if (value === 'name_desc') {
            setMenuSortField('name');
            setMenuSortOrder('desc');
        } else if (value === 'price_asc') {
            setMenuSortField('price');
            setMenuSortOrder('asc');
        } else if (value === 'price_desc') {
            setMenuSortField('price');
            setMenuSortOrder('desc');
        } else if (value === 'id_asc') {
            setMenuSortField('id');
            setMenuSortOrder('asc');
        } else if (value === 'id_desc') {
            setMenuSortField('id');
            setMenuSortOrder('desc');
        }
    };

    const getSortValue = () => {
        if (menuSortField === 'name') return menuSortOrder === 'asc' ? 'name_asc' : 'name_desc';
        if (menuSortField === 'price') return menuSortOrder === 'asc' ? 'price_asc' : 'price_desc';
        if (menuSortField === 'id') return menuSortOrder === 'asc' ? 'id_asc' : 'id_desc';
        return 'name_asc';
    };

    // ============================================================
    // QUICK VIEW DRAWER
    // ============================================================
    const QuickViewDrawer = () => (
        <Drawer
            title={
                <div className="mm-quickview-header">
                    <span className="mm-quickview-title">
                        <EyeOutlined className="mm-quickview-icon" />
                        Item Details
                    </span>
                    <span className="mm-quickview-id">#{quickViewItem?.id}</span>
                </div>
            }
            placement="right"
            onClose={closeQuickView}
            open={quickViewVisible}
            width={screens.xs ? '100%' : 480}
            className="mm-quickview-drawer"
            extra={
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => {
                            closeQuickView();
                            handleEditMenu(quickViewItem);
                        }}
                    >
                        Edit
                    </Button>
                    <Button type="primary" onClick={closeQuickView}>Close</Button>
                </Space>
            }
        >
            {quickViewItem && (
                <div className="mm-quickview-content">
                    <div className="mm-quickview-image">
                        <Image
                            src={quickViewItem.image_url || '/images/placeholder.svg'}
                            alt={quickViewItem.name}
                            width="100%"
                            height={200}
                            style={{ objectFit: 'cover', borderRadius: 12 }}
                            fallback="/images/placeholder.svg"
                        />
                    </div>

                    <Title level={4} className="mm-quickview-name">{quickViewItem.name}</Title>
                    <Paragraph className="mm-quickview-description">{quickViewItem.description || 'No description available'}</Paragraph>

                    <Divider className="mm-quickview-divider" />

                    <Row gutter={[16, 16]}>
                        <Col span={12}>
                            <Statistic
                                title="Price"
                                value={currency(quickViewItem.price)}
                                prefix={<DollarOutlined />}
                                valueStyle={{ color: '#1a7ab5', fontSize: 20 }}
                            />
                        </Col>
                        <Col span={12}>
                            <Statistic
                                title="Category"
                                value={quickViewItem.category || 'Uncategorized'}
                                prefix={<TagOutlined />}
                                valueStyle={{ fontSize: 16 }}
                            />
                        </Col>
                        <Col span={12}>
                            <Statistic
                                title="Prep Time"
                                value={quickViewItem.prep_time_minutes ? `${quickViewItem.prep_time_minutes} min` : 'N/A'}
                                prefix={<ClockCircleOutlined />}
                            />
                        </Col>
                        <Col span={12}>
                            <Statistic
                                title="Rating"
                                value={quickViewItem.rating || 0}
                                prefix={<StarFilled style={{ color: '#f59e0b' }} />}
                            />
                        </Col>
                    </Row>

                    <Divider className="mm-quickview-divider" />

                    <div className="mm-quickview-dietary">
                        <Text strong>Dietary Information</Text>
                        <Space size={8} wrap style={{ marginTop: 8 }}>
                            {quickViewItem.is_vegetarian && <Tag color="green">Vegetarian</Tag>}
                            {quickViewItem.is_vegan && <Tag color="lime">Vegan</Tag>}
                            {quickViewItem.is_gluten_free && <Tag color="gold">Gluten Free</Tag>}
                            {quickViewItem.is_halal && <Tag color="cyan">Halal</Tag>}
                            {!quickViewItem.is_vegetarian && !quickViewItem.is_vegan &&
                             !quickViewItem.is_gluten_free && !quickViewItem.is_halal && (
                                <Text type="secondary">No dietary restrictions</Text>
                            )}
                        </Space>
                    </div>

                    {quickViewItem.recipe_ingredients?.length > 0 && (
                        <>
                            <Divider className="mm-quickview-divider" />
                            <div className="mm-quickview-recipe">
                                <Text strong>Recipe Ingredients</Text>
                                <List
                                    size="small"
                                    dataSource={quickViewItem.recipe_ingredients}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <span>{item.name || item.ingredient?.name || '—'}</span>
                                            <span className="mm-quickview-recipe-qty">
                                                {item.quantity_per_pax} {item.unit}
                                            </span>
                                        </List.Item>
                                    )}
                                    className="mm-quickview-recipe-list"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
        </Drawer>
    );

    // ============================================================
    // PACKAGE VIEW MODAL
    // ============================================================
    const PackageViewModal = () => (
        <Modal
            title={
                <div className="mm-modal-header-clean">
                    <div className="mm-modal-title-icon"><AppstoreOutlined /></div>
                    <div className="mm-modal-title-text">Package Items</div>
                    <div className="mm-modal-badge">{viewingPackage?.name}</div>
                </div>
            }
            open={packageViewModalVisible}
            onCancel={closePackageView}
            width={700}
            className="mm-modal-clean"
            footer={
                <div className="mm-modal-footer-simple">
                    <Button type="primary" onClick={closePackageView}>Close</Button>
                </div>
            }
            styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
        >
            {viewingPackage && (
                <div className="mm-modal-clean-content">
                    <div className="mm-package-summary">
                        <Row gutter={16}>
                            <Col span={8}>
                                <div className="mm-summary-item">
                                    <span className="mm-summary-label">Total Items</span>
                                    <span className="mm-summary-value">{viewingPackage.menu_items?.length || 0}</span>
                                </div>
                            </Col>
                            <Col span={8}>
                                <div className="mm-summary-item">
                                    <span className="mm-summary-label">Price / Pax</span>
                                    <span className="mm-summary-value">{currency(viewingPackage.base_price_per_pax)}</span>
                                </div>
                            </Col>
                            <Col span={8}>
                                <div className="mm-summary-item">
                                    <span className="mm-summary-label">Guest Range</span>
                                    <span className="mm-summary-value">{viewingPackage.min_pax} - {viewingPackage.max_pax}</span>
                                </div>
                            </Col>
                        </Row>
                    </div>

                    <Divider />

                    <div className="mm-package-items-list">
                        <div className="mm-package-items-header">
                            <span>Item Name</span>
                            <span>Qty / Pax</span>
                            <span>Price</span>
                        </div>
                        {(viewingPackage.menu_items || []).map((item, idx) => (
                            <div key={idx} className="mm-package-item-row">
                                <span className="mm-item-name">{item.name}</span>
                                <span className="mm-item-qty">{item.quantity_per_pax || item.quantity || 1}</span>
                                <span className="mm-item-price">{currency(item.price || 0)}</span>
                            </div>
                        ))}
                        {(!viewingPackage.menu_items || viewingPackage.menu_items.length === 0) && (
                            <Empty description="No items in this package" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </div>

                    {viewingPackage.inclusions?.length > 0 && (
                        <>
                            <Divider />
                            <div className="mm-package-inclusions">
                                <Text strong>Inclusions:</Text>
                                <Space size={8} wrap>
                                    {viewingPackage.inclusions.map((item, idx) => (
                                        <Tag key={idx} color="green">{item}</Tag>
                                    ))}
                                </Space>
                            </div>
                        </>
                    )}

                    {viewingPackage.exclusions?.length > 0 && (
                        <>
                            <Divider />
                            <div className="mm-package-exclusions">
                                <Text strong>Exclusions:</Text>
                                <Space size={8} wrap>
                                    {viewingPackage.exclusions.map((item, idx) => (
                                        <Tag key={idx} color="red">{item}</Tag>
                                    ))}
                                </Space>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Modal>
    );

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <ConfigProvider theme={theme}>
            <div className="mm-menu-container">
                {/* ==================== HEADER ==================== */}
                <div className="mm-header">
                    <div className="mm-header-left">
                        <div className="mm-logo-icon">
                            <DashboardOutlined />
                        </div>
                        <div className="mm-header-info">
                            <h1>Menu Management</h1>
                            <div className="mm-breadcrumb">
                                <span>Dashboard</span>
                                <span className="mm-breadcrumb-sep">/</span>
                                <span>Menu</span>
                                <span className="mm-breadcrumb-sep">/</span>
                                <span className="mm-breadcrumb-active">Management</span>
                            </div>
                        </div>
                    </div>
                    <div className="mm-header-right">
                        <div className="mm-date-display">
                            <CalendarOutlined />
                            <span>{dayjs().format('MMMM DD, YYYY')}</span>
                        </div>
                        <div className="mm-header-actions">
                            <Tooltip title="Refresh Data">
                                <Button icon={<ReloadOutlined />} onClick={handleRefresh} className="mm-header-btn" />
                            </Tooltip>
                            <Tooltip title="Print">
                                <Button icon={<PrinterOutlined />} onClick={handlePrint} className="mm-header-btn" />
                            </Tooltip>
                            <Tooltip title="Export CSV">
                                <Button icon={<ExportOutlined />} onClick={handleExport} className="mm-header-btn">
                                    Export
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* ==================== STATS CARDS ==================== */}
                <div className="mm-dashboard-grid">
                    <div className="mm-stat-card">
                        <div className="mm-stat-icon blue"><MenuOutlined /></div>
                        <div className="mm-stat-content">
                            <div className="mm-stat-value">{menus.length}</div>
                            <div className="mm-stat-label">Total Items</div>
                        </div>
                        <div className="mm-stat-trend">
                            <span className="mm-trend-up">↑ 12%</span>
                        </div>
                    </div>
                    <div className="mm-stat-card">
                        <div className="mm-stat-icon green"><CheckCircleOutlined /></div>
                        <div className="mm-stat-content">
                            <div className="mm-stat-value">{menus.filter((item) => item.is_available !== false).length}</div>
                            <div className="mm-stat-label">Active Items</div>
                        </div>
                        <div className="mm-stat-trend">
                            <span className="mm-trend-up">↑ {menus.length > 0 ? Math.round((menus.filter(item => item.is_available !== false).length / menus.length) * 100) : 0}%</span>
                        </div>
                    </div>
                    <div className="mm-stat-card">
                        <div className="mm-stat-icon orange"><StarOutlined /></div>
                        <div className="mm-stat-content">
                            <div className="mm-stat-value">{menus.filter((item) => item.is_popular).length}</div>
                            <div className="mm-stat-label">Featured</div>
                        </div>
                        <div className="mm-stat-trend">
                            <span className="mm-trend-label">Best Sellers</span>
                        </div>
                    </div>
                    {!isHeadChefOnly && (
                        <>
                            <div className="mm-stat-card">
                                <div className="mm-stat-icon purple"><AppstoreOutlined /></div>
                                <div className="mm-stat-content">
                                    <div className="mm-stat-value">{packages.length}</div>
                                    <div className="mm-stat-label">Packages</div>
                                </div>
                                <div className="mm-stat-trend">
                                    <span className="mm-trend-label"><TeamOutlined /> {packages.reduce((sum, p) => sum + (p.menu_items?.length || 0), 0)} items</span>
                                </div>
                            </div>
                            <div className="mm-stat-card">
                                <div className="mm-stat-icon pink"><GiftOutlined /></div>
                                <div className="mm-stat-content">
                                    <div className="mm-stat-value">{promotions.length}</div>
                                    <div className="mm-stat-label">Promotions</div>
                                </div>
                                <div className="mm-stat-trend">
                                    <span className="mm-trend-label">{promotions.filter(p => p.status === 'active').length} active</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* ==================== MAIN CARD ==================== */}
                <Card className="mm-main-card" variant="borderless">
                    <Tabs
                        activeKey={activeMainTab}
                        onChange={handleTabChange}
                        className="mm-tabs"
                        destroyInactiveTabPane
                        tabBarExtraContent={
                            <div className="mm-tab-extra">
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={
                                        activeMainTab === 'menus' ? handleAddMenu :
                                        activeMainTab === 'packages' ? handleAddPackage :
                                        activeMainTab === 'categories' ? handleAddCategory :
                                        handleAddPromotion
                                    }
                                    className="mm-add-btn"
                                >
                                    {activeMainTab === 'menus' ? 'Add Item' :
                                     activeMainTab === 'packages' ? 'Create Package' :
                                     activeMainTab === 'categories' ? 'Add Category' :
                                     'Create Promotion'}
                                </Button>
                            </div>
                        }
                    >
                        {/* ==================== MENU ITEMS TAB ==================== */}
                        <TabPane tab={<span><MenuOutlined /> Menu Items</span>} key="menus">
                            <div className="mm-table-container">
                                <div className="mm-filter-bar">
                                    <div className="mm-filter-left">
                                        <Select
                                            value={menuFilters.category_id || 'all'}
                                            onChange={(value) => setMenuFilters((filters) => ({ ...filters, category_id: value === 'all' ? null : value }))}
                                            className="mm-filter-select"
                                            style={{ width: 180 }}
                                            suffixIcon={<FilterOutlined />}
                                        >
                                            <Option value="all">All Categories</Option>
                                            {categories.map((category) => (
                                                <Option key={category.id} value={category.id}>
                                                    {category.name}
                                                </Option>
                                            ))}
                                        </Select>
                                        <div className="mm-sort-controls">
                                            <span className="mm-sort-label">Sort:</span>
                                            <Select
                                                value={getSortValue()}
                                                onChange={handleSortChange}
                                                className="mm-sort-select"
                                                style={{ width: 160 }}
                                            >
                                                <Option value="name_asc">A → Z (Name)</Option>
                                                <Option value="name_desc">Z → A (Name)</Option>
                                                <Option value="price_asc">Price ↑ (Low to High)</Option>
                                                <Option value="price_desc">Price ↓ (High to Low)</Option>
                                                <Option value="id_asc">ID ↑ (Oldest)</Option>
                                                <Option value="id_desc">ID ↓ (Newest)</Option>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="mm-filter-right">
                                        <Search
                                            placeholder="Search menu items..."
                                            allowClear
                                            onChange={(event) => setMenuFilters((filters) => ({ ...filters, search: event.target.value }))}
                                            style={{ width: 280 }}
                                            className="mm-search-input"
                                            size="middle"
                                            enterButton={<SearchOutlined />}
                                        />
                                    </div>
                                </div>
                                <div className="mm-table-wrapper" id="menu-print-table">
                                    <Table
                                        columns={menuColumns}
                                        dataSource={sortedMenus}
                                        rowKey="id"
                                        className="mm-professional-table"
                                        pagination={false}
                                        scroll={{ x: 1200, y: 'calc(100vh - 420px)' }}
                                        rowClassName={(record) => !record.is_available ? 'mm-row-inactive' : ''}
                                    />
                                </div>
                            </div>
                        </TabPane>

                        {!isHeadChefOnly && (
                            <>
                                <TabPane tab={<span><AppstoreOutlined /> Packages</span>} key="packages">
                                    <div className="mm-table-container">
                                        <div className="mm-filter-bar">
                                            <div className="mm-filter-left">
                                                <Switch
                                                    checkedChildren="Active"
                                                    unCheckedChildren="All"
                                                    onChange={(checked) => setPackageFilters((filters) => ({ ...filters, is_active: checked ? true : null }))}
                                                    className="mm-filter-switch"
                                                />
                                            </div>
                                            <div className="mm-filter-right">
                                                <Search
                                                    placeholder="Search packages..."
                                                    allowClear
                                                    onChange={(event) => setPackageFilters((filters) => ({ ...filters, search: event.target.value }))}
                                                    style={{ width: 280 }}
                                                    className="mm-search-input"
                                                    size="middle"
                                                    enterButton={<SearchOutlined />}
                                                />
                                            </div>
                                        </div>
                                        <div className="mm-table-wrapper" id="package-print-table">
                                            <Table
                                                columns={packageColumns}
                                                dataSource={filteredPackages}
                                                rowKey="id"
                                                className="mm-professional-table"
                                                pagination={false}
                                                scroll={{ x: 900, y: 'calc(100vh - 420px)' }}
                                            />
                                        </div>
                                    </div>
                                </TabPane>
                            </>
                        )}

                        <TabPane tab={<span><TagOutlined /> Categories</span>} key="categories">
                            <div className="mm-table-container">
                                <div className="mm-filter-bar">
                                    <div className="mm-filter-left">
                                        <Switch
                                            checkedChildren="Active"
                                            unCheckedChildren="All"
                                            onChange={(checked) => setCategoryFilters((filters) => ({ ...filters, is_active: checked ? true : null }))}
                                            className="mm-filter-switch"
                                        />
                                    </div>
                                    <div className="mm-filter-right">
                                        <Search
                                            placeholder="Search categories..."
                                            allowClear
                                            onChange={(event) => setCategoryFilters((filters) => ({ ...filters, search: event.target.value }))}
                                            style={{ width: 280 }}
                                            className="mm-search-input"
                                            size="middle"
                                            enterButton={<SearchOutlined />}
                                        />
                                    </div>
                                </div>
                                <div className="mm-table-wrapper" id="category-print-table">
                                    <Table
                                        columns={categoryColumns}
                                        dataSource={filteredCategories}
                                        rowKey="id"
                                        className="mm-professional-table"
                                        pagination={false}
                                        scroll={{ x: 700, y: 'calc(100vh - 420px)' }}
                                    />
                                </div>
                            </div>
                        </TabPane>

                        {!isHeadChefOnly && (
                            <>
                                <TabPane tab={<span><GiftOutlined /> Promotions</span>} key="promotions">
                                    <div className="mm-table-container">
                                        <div className="mm-filter-bar">
                                            <div className="mm-filter-left">
                                                <Select
                                                    value={promotionFilters.promo_type || 'all'}
                                                    onChange={(value) => setPromotionFilters((filters) => ({ ...filters, promo_type: value === 'all' ? null : value }))}
                                                    className="mm-filter-select"
                                                    style={{ width: 150 }}
                                                    suffixIcon={<FilterOutlined />}
                                                >
                                                    <Option value="all">All Types</Option>
                                                    {Object.entries(PROMO_TYPE_MAP).map(([key, value]) => (
                                                        <Option key={key} value={key}>{value.label}</Option>
                                                    ))}
                                                </Select>
                                                <Select
                                                    value={promotionFilters.status || 'all'}
                                                    onChange={(value) => setPromotionFilters((filters) => ({ ...filters, status: value === 'all' ? null : value }))}
                                                    className="mm-filter-select"
                                                    style={{ width: 130 }}
                                                    suffixIcon={<FilterOutlined />}
                                                >
                                                    <Option value="all">All Status</Option>
                                                    <Option value="active">Active</Option>
                                                    <Option value="scheduled">Scheduled</Option>
                                                    <Option value="expired">Expired</Option>
                                                    <Option value="disabled">Disabled</Option>
                                                </Select>
                                            </div>
                                            <div className="mm-filter-right">
                                                <Search
                                                    placeholder="Search promotions..."
                                                    allowClear
                                                    onChange={(event) => setPromotionFilters((filters) => ({ ...filters, search: event.target.value }))}
                                                    style={{ width: 280 }}
                                                    className="mm-search-input"
                                                    size="middle"
                                                    enterButton={<SearchOutlined />}
                                                />
                                            </div>
                                        </div>
                                        <div className="mm-table-wrapper" id="promotion-print-table">
                                            <Table
                                                columns={promoColumns}
                                                dataSource={filteredPromotions}
                                                rowKey="id"
                                                className="mm-professional-table"
                                                pagination={false}
                                                scroll={{ x: 1300, y: 'calc(100vh - 420px)' }}
                                                rowClassName={(record) => record.status === 'expired' ? 'mm-row-expired' : ''}
                                            />
                                        </div>
                                    </div>
                                </TabPane>
                            </>
                        )}
                    </Tabs>
                </Card>

                {/* ============================================================
                    MENU ITEM MODAL - CLEAN STYLE WITH ICON VISIBLE
                ============================================================ */}
                <Modal
                    title={
                        <div className="mm-modal-header-clean">
                            <div className="mm-modal-title-icon">{selectedItem ? <EditOutlined /> : <PlusOutlined />}</div>
                            <div className="mm-modal-title-text">{selectedItem ? 'Edit Menu Item' : 'Create New Menu Item'}</div>
                            <div className="mm-modal-badge">{selectedItem ? `#${selectedItem.id}` : 'New'}</div>
                        </div>
                    }
                    open={menuModalVisible || editMenuModalVisible}
                    onCancel={closeMenuModal}
                    width={820}
                    className="mm-modal-clean"
                    footer={null}
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="mm-modal-clean-content">
                        <Steps
                            current={modalCurrentStep}
                            onChange={setModalCurrentStep}
                            className="mm-modal-steps"
                            items={[
                                { title: 'Basic', icon: <InfoCircleOutlined /> },
                                { title: 'Dietary', icon: <CheckCircleOutlined /> },
                                { title: 'Recipe', icon: <BoxPlotOutlined /> },
                                { title: 'Media', icon: <PictureOutlined /> },
                            ]}
                        />
                        <div className="mm-modal-form">
                            <Form form={menuForm} layout="vertical">
                                {/* Step 1: Basic Info */}
                                <div style={{ display: modalCurrentStep === 0 ? 'block' : 'none' }}>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item
                                                name="name"
                                                label="Menu Name"
                                                rules={[{ required: true, message: 'Please enter menu name' }]}
                                            >
                                                <Input placeholder="e.g., Chicken Adobo" size="large" className="mm-input-modern" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                name="category_id"
                                                label="Category"
                                                rules={[{ required: true, message: 'Please select a category' }]}
                                            >
                                                <Select
                                                    placeholder="Select category"
                                                    size="large"
                                                    className="mm-select-modern"
                                                    showSearch
                                                    optionFilterProp="children"
                                                >
                                                    {categories.map((category) => (
                                                        <Option key={category.id} value={category.id}>
                                                            {renderIcon(category.icon, 18)} {category.name}
                                                        </Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Form.Item name="description" label="Description">
                                        <TextArea rows={3} placeholder="Describe the menu item in detail" className="mm-textarea-modern" />
                                    </Form.Item>
                                    <Row gutter={16}>
                                        <Col span={8}>
                                            <Form.Item
                                                name="price"
                                                label="Price (₱)"
                                                rules={[{ required: true, message: 'Please enter price' }]}
                                            >
                                                <InputNumber
                                                    min={0}
                                                    step={0.01}
                                                    style={{ width: '100%' }}
                                                    prefix="₱"
                                                    placeholder="0.00"
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={8}>
                                            <Form.Item name="prep_time_minutes" label="Prep Time (mins)">
                                                <InputNumber
                                                    min={0}
                                                    style={{ width: '100%' }}
                                                    placeholder="15"
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={8}>
                                            <Form.Item name="serving_size" label="Serving Size">
                                                <InputNumber
                                                    min={1}
                                                    style={{ width: '100%' }}
                                                    placeholder="1"
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Step 2: Dietary */}
                                <div style={{ display: modalCurrentStep === 1 ? 'block' : 'none' }}>
                                    <Alert
                                        message="Dietary Information"
                                        description="Select applicable dietary options for this menu item"
                                        type="info"
                                        showIcon
                                        className="mm-modal-alert"
                                    />
                                    <div className="mm-dietary-grid">
                                        <Row gutter={[16, 16]}>
                                            <Col span={12}>
                                                <Form.Item name="is_vegetarian" label="Vegetarian" valuePropName="checked">
                                                    <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="is_vegan" label="Vegan" valuePropName="checked">
                                                    <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="is_gluten_free" label="Gluten Free" valuePropName="checked">
                                                    <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="is_halal" label="Halal" valuePropName="checked">
                                                    <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="is_available" label="Available" valuePropName="checked">
                                                    <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="is_popular" label="Featured" valuePropName="checked">
                                                    <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    </div>
                                    <Form.Item name="allergens" label="Allergens">
                                        <Select
                                            mode="tags"
                                            placeholder="e.g., Nuts, Dairy, Shellfish"
                                            size="large"
                                            className="mm-select-modern"
                                        />
                                    </Form.Item>
                                    <Form.Item name="nutritional_info" label="Nutritional Info">
                                        <TextArea
                                            rows={2}
                                            placeholder="Calories, Protein, Carbs, etc."
                                            className="mm-textarea-modern"
                                        />
                                    </Form.Item>
                                </div>

                                {/* Step 3: Recipe */}
                                <div style={{ display: modalCurrentStep === 2 ? 'block' : 'none' }}>
                                    <div className="mm-recipe-header">
                                        <Button
                                            onClick={handleAddRecipeIngredient}
                                            icon={<PlusOutlined />}
                                            className="mm-add-ingredient-btn"
                                        >
                                            Add Ingredient
                                        </Button>
                                        <div className="mm-recipe-cost">
                                            <Text strong>Total Cost: </Text>
                                            <Text className="mm-recipe-total">{currency(calculateTotalRecipeCost())}</Text>
                                        </div>
                                    </div>
                                    {recipeIngredients.length === 0 ? (
                                        <Empty
                                            description="No ingredients added yet"
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            className="mm-empty-recipe"
                                        />
                                    ) : (
                                        <Table
                                            dataSource={recipeIngredients}
                                            rowKey="id"
                                            size="small"
                                            pagination={false}
                                            className="mm-recipe-table"
                                            columns={[
                                                {
                                                    title: 'Ingredient',
                                                    width: 220,
                                                    render: (_, row) => (
                                                        <Select
                                                            showSearch
                                                            optionFilterProp="children"
                                                            placeholder="Select ingredient"
                                                            value={row.ingredient_id || undefined}
                                                            style={{ width: '100%' }}
                                                            className="mm-select-modern"
                                                            onChange={(value) => handleUpdateRecipeIngredient(row.id, 'ingredient_id', value)}
                                                        >
                                                            {ingredients.map((ingredient) => (
                                                                <Option key={ingredient.id} value={ingredient.id}>
                                                                    {ingredient.name}
                                                                </Option>
                                                            ))}
                                                        </Select>
                                                    )
                                                },
                                                {
                                                    title: 'Qty/Pax',
                                                    width: 95,
                                                    render: (_, row) => (
                                                        <InputNumber
                                                            min={0.001}
                                                            step={0.001}
                                                            value={row.quantity_per_pax}
                                                            onChange={(value) => handleUpdateRecipeIngredient(row.id, 'quantity_per_pax', value)}
                                                            style={{ width: '100%' }}
                                                            className="mm-input-modern"
                                                        />
                                                    )
                                                },
                                                {
                                                    title: 'Unit',
                                                    width: 85,
                                                    render: (_, row) => (
                                                        <Input
                                                            value={row.unit}
                                                            onChange={(event) => handleUpdateRecipeIngredient(row.id, 'unit', event.target.value)}
                                                            className="mm-input-modern"
                                                        />
                                                    )
                                                },
                                                {
                                                    title: 'Cost',
                                                    width: 110,
                                                    render: (_, row) => currency(
                                                        Number(row.quantity_per_pax || 0) *
                                                        Number(ingredientById.get(Number(row.ingredient_id))?.unit_cost || 0)
                                                    )
                                                },
                                                {
                                                    title: '',
                                                    width: 50,
                                                    render: (_, row) => (
                                                        <Button
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => handleRemoveRecipeIngredient(row.id)}
                                                            size="small"
                                                            className="mm-remove-ingredient-btn"
                                                        />
                                                    )
                                                },
                                            ]}
                                        />
                                    )}
                                    {calculateTotalRecipeCost() > 0 && Number(menuForm.getFieldValue('price') || 0) > 0 && (
                                        <div className="mm-recipe-summary">
                                            <Row gutter={16} align="middle">
                                                <Col span={16}>
                                                    <Progress
                                                        percent={Math.max(0, Math.min(100, Math.round(calculateProfitMargin())))}
                                                        status={calculateProfitMargin() > 50 ? 'success' : 'normal'}
                                                        className="mm-profit-progress"
                                                        strokeColor={calculateProfitMargin() > 50 ? '#10b981' : '#f59e0b'}
                                                    />
                                                </Col>
                                                <Col span={8}>
                                                    <div className="mm-profit-display">
                                                        <Text strong>Profit: </Text>
                                                        <Text className="mm-profit-amount">
                                                            {currency(Number(menuForm.getFieldValue('price') || 0) - calculateTotalRecipeCost())}
                                                        </Text>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </div>
                                    )}
                                </div>

                                {/* Step 4: Media - Enhanced Image Upload */}
                                <div style={{ display: modalCurrentStep === 3 ? 'block' : 'none' }}>
                                    <Alert
                                        message="Menu Image"
                                        description="Upload a high-quality image (max 2 MB)"
                                        type="info"
                                        showIcon
                                        className="mm-modal-alert"
                                    />
                                    <div className="mm-upload-section">
                                        <Upload
                                            {...menuUploadProps}
                                            accept="image/*"
                                            listType="picture-card"
                                            fileList={menuFileList}
                                            maxCount={1}
                                            className="mm-upload-modern"
                                        >
                                            {menuFileList.length < 1 ? (
                                                <div className="mm-upload-placeholder">
                                                    <PictureOutlined style={{ fontSize: 32, color: '#94a3b8' }} />
                                                    <div style={{ marginTop: 8, color: '#94a3b8' }}>Click to upload</div>
                                                    <div style={{ fontSize: 12, color: '#cbd5e1' }}>or drag and drop</div>
                                                    <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 4 }}>PNG, JPG, WEBP (max 2MB)</div>
                                                </div>
                                            ) : null}
                                        </Upload>
                                        {menuFileList.length > 0 && menuFileList[0].url && (
                                            <div style={{ marginTop: 12 }}>
                                                <Image
                                                    src={menuFileList[0].url}
                                                    alt="Preview"
                                                    width={120}
                                                    height={120}
                                                    style={{ objectFit: 'cover', borderRadius: 8 }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <Form.Item name="ingredients_list" label="Ingredients List">
                                        <TextArea
                                            rows={2}
                                            placeholder="List main ingredients separated by commas"
                                            className="mm-textarea-modern"
                                        />
                                    </Form.Item>
                                </div>
                            </Form>
                        </div>
                        <div className="mm-modal-footer">
                            <Button
                                onClick={() => setModalCurrentStep((step) => Math.max(0, step - 1))}
                                disabled={modalCurrentStep === 0}
                                className="mm-footer-btn secondary"
                            >
                                <LeftOutlined /> Previous
                            </Button>
                            <Space>
                                <Button onClick={closeMenuModal} className="mm-footer-btn cancel">
                                    Cancel
                                </Button>
                                {modalCurrentStep < 3 ? (
                                    <Button
                                        type="primary"
                                        onClick={async () => {
                                            try {
                                                if (modalCurrentStep === 0) {
                                                    await menuForm.validateFields(['name', 'category_id', 'price']);
                                                }
                                                setModalCurrentStep((step) => step + 1);
                                            } catch {
                                                // Form validation errors
                                            }
                                        }}
                                        className="mm-footer-btn primary"
                                    >
                                        Next <RightOutlined />
                                    </Button>
                                ) : (
                                    <Button
                                        type="primary"
                                        loading={createMenuItem.isPending || updateMenuItem.isPending}
                                        onClick={handleSaveMenu}
                                        className="mm-footer-btn primary"
                                        icon={<SaveOutlined />}
                                    >
                                        {selectedItem ? 'Update' : 'Create'}
                                    </Button>
                                )}
                            </Space>
                        </div>
                    </div>
                </Modal>

                {/* ============================================================
                    PACKAGE MODAL - CLEAN STYLE
                ============================================================ */}
                <Modal
                    title={
                        <div className="mm-modal-header-clean">
                            <div className="mm-modal-title-icon"><AppstoreOutlined /></div>
                            <div className="mm-modal-title-text">{selectedPackageItem ? 'Edit Package' : 'Create New Package'}</div>
                            <div className="mm-modal-badge">{selectedPackageItem ? `#${selectedPackageItem.id}` : 'New'}</div>
                        </div>
                    }
                    open={packageModalVisible || editPackageModalVisible}
                    onCancel={closePackageModal}
                    width={1000}
                    className="mm-modal-clean"
                    footer={null}
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="mm-modal-clean-content">
                        <Steps
                            current={packageCurrentStep}
                            onChange={setPackageCurrentStep}
                            className="mm-modal-steps"
                            items={[
                                { title: 'Package Info', icon: <InfoCircleOutlined /> },
                                { title: 'Select Items', icon: <MenuOutlined /> },
                                { title: 'Review', icon: <CheckCircleOutlined /> },
                            ]}
                        />
                        <div className="mm-modal-form">
                            <Form form={packageForm} layout="vertical">
                                {/* Step 0: Package Info */}
                                <div style={{ display: packageCurrentStep === 0 ? 'block' : 'none' }}>
                                    <Row gutter={20}>
                                        <Col span={12}>
                                            <Form.Item
                                                name="name"
                                                label="Package Name"
                                                rules={[{ required: true, message: 'Please enter package name' }]}
                                            >
                                                <Input placeholder="e.g., Family Feast Bundle" size="large" className="mm-input-modern" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                name="base_price_per_pax"
                                                label="Price per Person (₱)"
                                                rules={[{ required: true, message: 'Please enter price' }]}
                                            >
                                                <InputNumber
                                                    min={0}
                                                    step={0.01}
                                                    style={{ width: '100%' }}
                                                    prefix="₱"
                                                    placeholder="0.00"
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Form.Item name="description" label="Package Description">
                                        <TextArea rows={3} placeholder="Describe what is included in this package" className="mm-textarea-modern" />
                                    </Form.Item>
                                    <Row gutter={20}>
                                        <Col span={12}>
                                            <Form.Item
                                                name="min_pax"
                                                label="Minimum Guests"
                                                rules={[{ required: true, message: 'Minimum guests required' }]}
                                            >
                                                <InputNumber
                                                    min={1}
                                                    style={{ width: '100%' }}
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                name="max_pax"
                                                label="Maximum Guests"
                                                rules={[{ required: true, message: 'Maximum guests required' }]}
                                            >
                                                <InputNumber
                                                    min={1}
                                                    style={{ width: '100%' }}
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row gutter={20}>
                                        <Col span={12}>
                                            <Form.Item name="price_per_additional_pax" label="Additional Person Price">
                                                <InputNumber
                                                    min={0}
                                                    step={0.01}
                                                    style={{ width: '100%' }}
                                                    prefix="₱"
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="default_duration_hours" label="Duration (hours)">
                                                <InputNumber
                                                    min={1}
                                                    style={{ width: '100%' }}
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row gutter={20}>
                                        <Col span={8}>
                                            <Form.Item name="is_active" label="Active Package" valuePropName="checked">
                                                <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={8}>
                                            <Form.Item name="is_featured" label="Featured Package" valuePropName="checked">
                                                <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={8}>
                                            <Form.Item name="sort_order" label="Sort Order">
                                                <InputNumber
                                                    min={0}
                                                    style={{ width: '100%' }}
                                                    size="large"
                                                    className="mm-input-modern"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Form.Item name="inclusions" label="Inclusions">
                                        <Select
                                            mode="tags"
                                            placeholder="Press Enter after each inclusion"
                                            size="large"
                                            className="mm-select-modern"
                                        />
                                    </Form.Item>
                                    <Form.Item name="exclusions" label="Exclusions">
                                        <Select
                                            mode="tags"
                                            placeholder="Press Enter after each exclusion"
                                            size="large"
                                            className="mm-select-modern"
                                        />
                                    </Form.Item>

                                    <Divider className="mm-form-divider">Package Image</Divider>
                                    <Alert
                                        message="Upload Package Image"
                                        description="Upload a high-quality image for this package (max 2 MB)"
                                        type="info"
                                        showIcon
                                        className="mm-modal-alert"
                                    />
                                    <div className="mm-upload-section">
                                        <Upload
                                            {...packageUploadProps}
                                            accept="image/*"
                                            listType="picture-card"
                                            fileList={packageFileList}
                                            maxCount={1}
                                            className="mm-upload-modern"
                                        >
                                            {packageFileList.length < 1 ? (
                                                <div className="mm-upload-placeholder">
                                                    <PictureOutlined style={{ fontSize: 32, color: '#94a3b8' }} />
                                                    <div style={{ marginTop: 8, color: '#94a3b8' }}>Click to upload</div>
                                                    <div style={{ fontSize: 12, color: '#cbd5e1' }}>or drag and drop</div>
                                                </div>
                                            ) : null}
                                        </Upload>
                                        {packageFileList.length > 0 && packageFileList[0].url && (
                                            <div style={{ marginTop: 12 }}>
                                                <Image
                                                    src={packageFileList[0].url}
                                                    alt="Preview"
                                                    width={120}
                                                    height={120}
                                                    style={{ objectFit: 'cover', borderRadius: 8 }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Step 1: Select Items */}
                                <div style={{ display: packageCurrentStep === 1 ? 'block' : 'none' }}>
                                    <Alert
                                        message="Select Menu Items"
                                        description="Choose items to include in this package. You can adjust quantities per person."
                                        type="info"
                                        showIcon
                                        className="mm-modal-alert"
                                    />
                                    <div className="mm-package-items">
                                        <div className="mm-package-available">
                                            <div className="mm-package-panel-header">
                                                <span className="mm-package-panel-title"><MenuOutlined /> Available Items</span>
                                                <Badge count={menus.length} className="mm-package-badge" />
                                            </div>
                                            <div className="mm-package-panel-body">
                                                <Table
                                                    dataSource={menus}
                                                    rowKey="id"
                                                    size="small"
                                                    pagination={false}
                                                    className="mm-package-table"
                                                    columns={[
                                                        {
                                                            title: 'Name',
                                                            dataIndex: 'name',
                                                            render: (text) => <span className="mm-item-name">{text}</span>
                                                        },
                                                        {
                                                            title: 'Price',
                                                            dataIndex: 'price',
                                                            width: 95,
                                                            render: (value) => <span className="mm-item-price">{currency(value)}</span>
                                                        },
                                                        {
                                                            title: '',
                                                            width: 50,
                                                            render: (_, row) => (
                                                                <Button
                                                                    size="small"
                                                                    icon={<PlusOutlined />}
                                                                    onClick={() => handleAddMenuItemToPackage(row)}
                                                                    className="mm-package-add-btn"
                                                                />
                                                            )
                                                        }
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                        <div className="mm-package-selected">
                                            <div className="mm-package-panel-header">
                                                <span className="mm-package-panel-title"><CheckCircleOutlined /> Selected Items</span>
                                                <Badge count={selectedMenuItems.length} className="mm-package-badge" style={{ backgroundColor: '#10b981' }} />
                                            </div>
                                            <div className="mm-package-panel-body">
                                                {selectedMenuItems.length === 0 ? (
                                                    <Empty
                                                        description="No items selected"
                                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                        className="mm-empty-selected"
                                                    />
                                                ) : (
                                                    <Table
                                                        dataSource={selectedMenuItems}
                                                        rowKey="menu_item_id"
                                                        size="small"
                                                        pagination={false}
                                                        className="mm-package-table selected"
                                                        columns={[
                                                            {
                                                                title: 'Name',
                                                                dataIndex: 'name',
                                                                render: (text) => <span className="mm-item-name">{text}</span>
                                                            },
                                                            {
                                                                title: 'Qty',
                                                                width: 80,
                                                                render: (_, row) => (
                                                                    <InputNumber
                                                                        min={1}
                                                                        value={row.quantity}
                                                                        onChange={(value) => handleUpdateMenuItemQuantity(row.menu_item_id, value)}
                                                                        size="small"
                                                                        style={{ width: 60 }}
                                                                        className="mm-input-modern"
                                                                    />
                                                                )
                                                            },
                                                            {
                                                                title: 'Price',
                                                                width: 95,
                                                                dataIndex: 'price',
                                                                render: (value) => <span className="mm-item-price">{currency(value)}</span>
                                                            },
                                                            {
                                                                title: '',
                                                                width: 50,
                                                                render: (_, row) => (
                                                                    <Button
                                                                        danger
                                                                        size="small"
                                                                        icon={<DeleteOutlined />}
                                                                        onClick={() => handleRemoveMenuItemFromPackage(row.menu_item_id)}
                                                                        className="mm-package-remove-btn"
                                                                    />
                                                                )
                                                            }
                                                        ]}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: Review */}
                                <div style={{ display: packageCurrentStep === 2 ? 'block' : 'none' }}>
                                    <Alert
                                        message="Review Package Details"
                                        description="Please review all information before saving the package"
                                        type="success"
                                        showIcon
                                        className="mm-modal-alert"
                                    />
                                    <div className="mm-package-review">
                                        <div className="mm-package-review-header">
                                            <div>
                                                <div className="mm-package-review-name">
                                                    {packageForm.getFieldValue('name') || 'Package Name'}
                                                </div>
                                                <div className="mm-package-review-desc">
                                                    {packageForm.getFieldValue('description') || 'No description provided'}
                                                </div>
                                            </div>
                                            <Tag color="blue" className="mm-package-review-price">
                                                {currency(packageForm.getFieldValue('base_price_per_pax'))} / pax
                                            </Tag>
                                        </div>
                                        {packageFileList.length > 0 && packageFileList[0].url && (
                                            <div className="mm-package-review-image">
                                                <Image
                                                    src={packageFileList[0].url}
                                                    width={120}
                                                    height={80}
                                                    style={{ borderRadius: 8, objectFit: 'cover' }}
                                                    preview={false}
                                                />
                                            </div>
                                        )}
                                        <Divider className="mm-form-divider" />
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <div className="mm-review-item">
                                                    <TeamOutlined className="mm-review-icon" />
                                                    <span className="mm-review-label">Guest Range:</span>
                                                    <strong>{packageForm.getFieldValue('min_pax') || 0} - {packageForm.getFieldValue('max_pax') || 0}</strong>
                                                </div>
                                            </Col>
                                            <Col span={12}>
                                                <div className="mm-review-item">
                                                    <MenuOutlined className="mm-review-icon" />
                                                    <span className="mm-review-label">Menu Items:</span>
                                                    <strong>{selectedMenuItems.length}</strong>
                                                </div>
                                            </Col>
                                        </Row>
                                        <Divider className="mm-form-divider" />
                                        <Table
                                            dataSource={selectedMenuItems}
                                            rowKey="menu_item_id"
                                            size="small"
                                            pagination={false}
                                            className="mm-review-table"
                                            columns={[
                                                {
                                                    title: 'Item',
                                                    dataIndex: 'name',
                                                    render: (text) => <span className="mm-item-name">{text}</span>
                                                },
                                                {
                                                    title: 'Qty/Pax',
                                                    width: 100,
                                                    render: (_, row) => `${row.quantity || 1}x`
                                                },
                                                {
                                                    title: 'Price',
                                                    width: 110,
                                                    dataIndex: 'price',
                                                    render: currency
                                                },
                                                {
                                                    title: 'Total/Pax',
                                                    width: 120,
                                                    render: (_, row) => currency(Number(row.price || 0) * Number(row.quantity || 1))
                                                }
                                            ]}
                                        />
                                    </div>
                                </div>
                            </Form>
                        </div>
                        <div className="mm-modal-footer">
                            <Button
                                onClick={() => setPackageCurrentStep((step) => Math.max(0, step - 1))}
                                disabled={packageCurrentStep === 0}
                                className="mm-footer-btn secondary"
                            >
                                <LeftOutlined /> Previous
                            </Button>
                            <Space>
                                <Button onClick={closePackageModal} className="mm-footer-btn cancel">
                                    Cancel
                                </Button>
                                {packageCurrentStep < 2 ? (
                                    <Button
                                        type="primary"
                                        onClick={async () => {
                                            try {
                                                if (packageCurrentStep === 0) {
                                                    await packageForm.validateFields(['name', 'base_price_per_pax', 'min_pax', 'max_pax']);
                                                }
                                                setPackageCurrentStep((step) => step + 1);
                                            } catch {
                                                // Form validation errors
                                            }
                                        }}
                                        className="mm-footer-btn primary"
                                    >
                                        Next <RightOutlined />
                                    </Button>
                                ) : (
                                    <Button
                                        type="primary"
                                        loading={createPackage.isPending || updatePackage.isPending}
                                        onClick={handleSavePackage}
                                        className="mm-footer-btn primary"
                                        icon={<SaveOutlined />}
                                    >
                                        {selectedPackageItem ? 'Update Package' : 'Create Package'}
                                    </Button>
                                )}
                            </Space>
                        </div>
                    </div>
                </Modal>

                {/* ============================================================
                    CATEGORY MODAL - CLEAN STYLE
                ============================================================ */}
                <Modal
                    title={
                        <div className="mm-modal-header-clean">
                            <div className="mm-modal-title-icon"><TagOutlined /></div>
                            <div className="mm-modal-title-text">{editingCategory ? 'Edit Category' : 'Create Category'}</div>
                            <div className="mm-modal-badge">{editingCategory ? `#${editingCategory.id}` : 'New'}</div>
                        </div>
                    }
                    open={categoryModalVisible || editCategoryModalVisible}
                    onCancel={closeCategoryModal}
                    width={550}
                    className="mm-modal-clean"
                    footer={null}
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="mm-modal-clean-content">
                        <div className="mm-modal-form">
                            <Form form={categoryForm} layout="vertical" onFinish={handleSaveCategory}>
                                <Form.Item
                                    name="name"
                                    label="Category Name"
                                    rules={[{ required: true, message: 'Please enter category name' }]}
                                >
                                    <Input placeholder="e.g., Appetizers" size="large" className="mm-input-modern" />
                                </Form.Item>
                                <Form.Item name="description" label="Description">
                                    <TextArea rows={2} placeholder="Brief description" className="mm-textarea-modern" />
                                </Form.Item>
                                <Form.Item name="icon" label="Icon">
                                    <ProfessionalIconPicker />
                                </Form.Item>
                                <Form.Item name="display_order" label="Display Order">
                                    <InputNumber
                                        min={0}
                                        style={{ width: '100%' }}
                                        size="large"
                                        className="mm-input-modern"
                                    />
                                </Form.Item>
                                <Form.Item name="is_active" label="Active Category" valuePropName="checked">
                                    <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                </Form.Item>
                                <div className="mm-modal-footer">
                                    <Space>
                                        <Button
                                            onClick={closeCategoryModal}
                                            className="mm-footer-btn cancel"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={createCategory.isPending || updateCategory.isPending}
                                            className="mm-footer-btn primary"
                                            icon={<SaveOutlined />}
                                        >
                                            {editingCategory ? 'Update' : 'Create'}
                                        </Button>
                                    </Space>
                                </div>
                            </Form>
                        </div>
                    </div>
                </Modal>

                {/* ============================================================
                    PROMOTION MODAL - CLEAN STYLE
                ============================================================ */}
                <Modal
                    title={
                        <div className="mm-modal-header-clean">
                            <div className="mm-modal-title-icon"><GiftOutlined /></div>
                            <div className="mm-modal-title-text">{editingPromotion ? 'Edit Promotion' : 'Create Promotion'}</div>
                            <div className="mm-modal-badge">{editingPromotion ? `#${editingPromotion.id}` : 'New'}</div>
                        </div>
                    }
                    open={promoModalVisible || editPromoModalVisible}
                    onCancel={closePromoModal}
                    width={860}
                    className="mm-modal-clean"
                    footer={null}
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    <div className="mm-modal-clean-content">
                        <div className="mm-modal-form">
                            <Form form={promoForm} layout="vertical" onFinish={handleSavePromotion}>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="promo_type"
                                            label="Promotion Type"
                                            rules={[{ required: true }]}
                                        >
                                            <Select
                                                size="large"
                                                className="mm-select-modern"
                                                placeholder="Select promotion type"
                                                onChange={(value) => setPromoType(value)}
                                            >
                                                {Object.entries(PROMO_TYPE_MAP).map(([key, value]) => (
                                                    <Option key={key} value={key}>{value.icon} {value.label}</Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            name="name"
                                            label="Promotion Name"
                                            rules={[{ required: true }]}
                                        >
                                            <Input placeholder="e.g., Holiday Special 2026" size="large" className="mm-input-modern" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="code" label="Promo Code (Optional)">
                                            <Input
                                                placeholder="e.g., HOLIDAY10"
                                                size="large"
                                                className="mm-input-modern"
                                                style={{ textTransform: 'uppercase' }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="banner_image_url" label="Banner Image URL (Optional)">
                                            <Input
                                                placeholder="https://example.com/banner.jpg"
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item name="description" label="Description">
                                    <TextArea rows={2} placeholder="Describe the promotion in detail" className="mm-textarea-modern" />
                                </Form.Item>

                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="discount_type"
                                            label="Discount Type"
                                            rules={[{ required: true }]}
                                        >
                                            <Select size="large" className="mm-select-modern">
                                                <Option value="percentage">Percentage (%)</Option>
                                                <Option value="fixed">Fixed (₱)</Option>
                                                <Option value="free_addon">Free Add-on</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="discount_value"
                                            label="Discount Value"
                                            rules={[{ required: true }]}
                                        >
                                            <InputNumber
                                                min={0}
                                                step={0.01}
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="discounted_price" label="Discounted Price (Optional)">
                                            <InputNumber
                                                min={0}
                                                step={0.01}
                                                style={{ width: '100%' }}
                                                prefix="₱"
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="start_date"
                                            label="Start Date"
                                            rules={[{ required: true }]}
                                        >
                                            <DatePicker style={{ width: '100%' }} size="large" className="mm-input-modern" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            name="end_date"
                                            label="End Date"
                                            rules={[{ required: true }]}
                                        >
                                            <DatePicker style={{ width: '100%' }} size="large" className="mm-input-modern" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="start_time" label="Start Time (Optional)">
                                            <DatePicker.TimePicker
                                                format="HH:mm"
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="end_time" label="End Time (Optional)">
                                            <DatePicker.TimePicker
                                                format="HH:mm"
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Divider className="mm-form-divider">Conditions & Limits</Divider>

                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Form.Item name="min_pax" label="Minimum Pax">
                                            <InputNumber
                                                min={1}
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="max_pax" label="Maximum Pax">
                                            <InputNumber
                                                min={1}
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="min_booking_amount" label="Min Booking Amount (₱)">
                                            <InputNumber
                                                min={0}
                                                step={0.01}
                                                style={{ width: '100%' }}
                                                prefix="₱"
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Form.Item name="max_redemptions" label="Max Redemptions">
                                            <InputNumber
                                                min={1}
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="per_customer_limit" label="Per Customer Limit">
                                            <InputNumber
                                                min={1}
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="days_before_event" label="Days Before Event (Last Minute)">
                                            <InputNumber
                                                min={1}
                                                style={{ width: '100%' }}
                                                size="large"
                                                className="mm-input-modern"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Divider className="mm-form-divider">Applicable Items</Divider>

                                <Form.Item name="applicable_menu_item_ids" label="Applicable Menu Items">
                                    <Select
                                        mode="multiple"
                                        placeholder="Select menu items (leave empty for all)"
                                        size="large"
                                        className="mm-select-modern"
                                        showSearch
                                        optionFilterProp="children"
                                    >
                                        {menus.map((item) => (
                                            <Option key={item.id} value={item.id}>{item.name}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>

                                <Form.Item name="applicable_package_ids" label="Applicable Packages">
                                    <Select
                                        mode="multiple"
                                        placeholder="Select packages (leave empty for all)"
                                        size="large"
                                        className="mm-select-modern"
                                        showSearch
                                        optionFilterProp="children"
                                    >
                                        {packages.map((pkg) => (
                                            <Option key={pkg.id} value={pkg.id}>{pkg.name}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>

                                <Divider className="mm-form-divider">Value Added (Free Add-ons)</Divider>

                                <Form.Item name="free_addons" label="Free Add-ons">
                                    <Select
                                        mode="tags"
                                        placeholder="Enter free add-ons (press Enter after each)"
                                        size="large"
                                        className="mm-select-modern"
                                    />
                                </Form.Item>

                                <Form.Item name="complimentary_items" label="Complimentary Items Description">
                                    <TextArea
                                        rows={2}
                                        placeholder="Describe complimentary items included"
                                        className="mm-textarea-modern"
                                    />
                                </Form.Item>

                                <Divider className="mm-form-divider">Settings</Divider>

                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Form.Item name="is_active" label="Active" valuePropName="checked">
                                            <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="is_featured" label="Featured" valuePropName="checked">
                                            <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="allow_stacking" label="Allow Stacking" valuePropName="checked">
                                            <Switch className="mm-switch-modern" checkedChildren="Yes" unCheckedChildren="No" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item name="sort_order" label="Sort Order">
                                    <InputNumber
                                        min={0}
                                        style={{ width: '100%' }}
                                        size="large"
                                        className="mm-input-modern"
                                    />
                                </Form.Item>

                                <div className="mm-modal-footer">
                                    <Space>
                                        <Button
                                            onClick={closePromoModal}
                                            className="mm-footer-btn cancel"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={createPromotion.isPending || updatePromotion.isPending}
                                            className="mm-footer-btn primary"
                                            icon={<SaveOutlined />}
                                        >
                                            {editingPromotion ? 'Update' : 'Create'}
                                        </Button>
                                    </Space>
                                </div>
                            </Form>
                        </div>
                    </div>
                </Modal>

                {/* ============================================================
                    RECIPE MODAL
                ============================================================ */}
                <Modal
                    title={
                        <div className="mm-modal-header-clean">
                            <div className="mm-modal-title-icon"><BoxPlotOutlined /></div>
                            <div className="mm-modal-title-text">Recipe Details</div>
                            <div className="mm-modal-badge">{selectedItem?.name || 'Menu Item'}</div>
                        </div>
                    }
                    open={recipeModalVisible}
                    onCancel={() => setRecipeModalVisible(false)}
                    width={700}
                    className="mm-modal-clean"
                    footer={
                        <div className="mm-modal-footer-simple">
                            <Button type="primary" onClick={() => setRecipeModalVisible(false)}>Close</Button>
                        </div>
                    }
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {selectedItem && (
                        <div className="mm-modal-clean-content">
                            <Descriptions column={2} bordered size="small" className="mm-recipe-descriptions">
                                <Descriptions.Item label="ID">{selectedItem.id}</Descriptions.Item>
                                <Descriptions.Item label="Category">
                                    <Tag color="blue">{selectedItem.category}</Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="Price">
                                    <span className="mm-item-price">{currency(selectedItem.price)}</span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Prep Time">
                                    {selectedItem.prep_time_minutes ? `${selectedItem.prep_time_minutes} min` : '—'}
                                </Descriptions.Item>
                            </Descriptions>

                            <Divider className="mm-form-divider">Description</Divider>
                            <Paragraph className="mm-recipe-description">
                                {selectedItem.description || 'No description available.'}
                            </Paragraph>

                            <Divider className="mm-form-divider">Recipe Ingredients</Divider>
                            {selectedItem.recipe_ingredients?.length ? (
                                <Table
                                    rowKey="id"
                                    size="small"
                                    pagination={false}
                                    dataSource={selectedItem.recipe_ingredients}
                                    className="mm-recipe-table"
                                    columns={[
                                        {
                                            title: 'Ingredient',
                                            render: (_, row) => row.name || row.ingredient?.name || '—'
                                        },
                                        {
                                            title: 'Qty / Pax',
                                            render: (_, row) => `${row.quantity_per_pax} ${row.unit}`
                                        },
                                        {
                                            title: 'Unit Cost',
                                            render: (_, row) => currency(row.unit_cost || row.ingredient?.unit_cost)
                                        }
                                    ]}
                                />
                            ) : (
                                <Empty description="No recipe ingredients saved" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}

                            <Divider className="mm-form-divider">Dietary</Divider>
                            <Space wrap>
                                {selectedItem.is_vegetarian && <Tag color="green">Vegetarian</Tag>}
                                {selectedItem.is_vegan && <Tag color="lime">Vegan</Tag>}
                                {selectedItem.is_gluten_free && <Tag color="gold">Gluten Free</Tag>}
                                {selectedItem.is_halal && <Tag color="cyan">Halal</Tag>}
                            </Space>
                        </div>
                    )}
                </Modal>

                {/* ============================================================
                    ANALYTICS MODAL
                ============================================================ */}
                <Modal
                    title={
                        <div className="mm-modal-header-clean">
                            <div className="mm-modal-title-icon"><BarChartOutlined /></div>
                            <div className="mm-modal-title-text">Promotion Analytics</div>
                            <div className="mm-modal-badge">{analyticsPromotion?.name || 'Promotion'}</div>
                        </div>
                    }
                    open={analyticsModalVisible}
                    onCancel={closeAnalyticsModal}
                    width={920}
                    className="mm-modal-clean"
                    footer={
                        <div className="mm-modal-footer-simple">
                            <Button type="primary" onClick={closeAnalyticsModal}>Close</Button>
                        </div>
                    }
                    maskClosable={false}
                    keyboard={false}
                    styles={{ body: { padding: 0, maxHeight: 'none', overflow: 'visible' } }}
                >
                    {analyticsPromotion && (
                        <div className="mm-modal-clean-content">
                            {analyticsQuery.isLoading ? (
                                <div className="mm-analytics-loading">
                                    <Spin size="large" />
                                    <p>Loading analytics...</p>
                                </div>
                            ) : analyticsQuery.data ? (
                                <div className="mm-analytics-content">
                                    <Row gutter={16} className="mm-analytics-stats">
                                        <Col span={6}>
                                            <div className="mm-analytics-stat">
                                                <div className="mm-analytics-stat-value">
                                                    {analyticsQuery.data.total_redemptions || 0}
                                                </div>
                                                <div className="mm-analytics-stat-label">Total Redemptions</div>
                                            </div>
                                        </Col>
                                        <Col span={6}>
                                            <div className="mm-analytics-stat">
                                                <div className="mm-analytics-stat-value">
                                                    {currency(analyticsQuery.data.total_discount_given || 0)}
                                                </div>
                                                <div className="mm-analytics-stat-label">Total Discount Given</div>
                                            </div>
                                        </Col>
                                        <Col span={6}>
                                            <div className="mm-analytics-stat">
                                                <div className="mm-analytics-stat-value">
                                                    {analyticsQuery.data.usage_percentage || 0}%
                                                </div>
                                                <div className="mm-analytics-stat-label">Usage Rate</div>
                                            </div>
                                        </Col>
                                        <Col span={6}>
                                            <div className="mm-analytics-stat">
                                                <div className="mm-analytics-stat-value">
                                                    {analyticsPromotion.max_redemptions || '∞'}
                                                </div>
                                                <div className="mm-analytics-stat-label">Redemption Limit</div>
                                            </div>
                                        </Col>
                                    </Row>

                                    <Divider className="mm-form-divider">Top Customers</Divider>
                                    {analyticsQuery.data.top_customers?.length > 0 ? (
                                        <Table
                                            dataSource={analyticsQuery.data.top_customers}
                                            rowKey="customer_name"
                                            size="small"
                                            pagination={false}
                                            className="mm-analytics-table"
                                            columns={[
                                                { title: 'Customer', dataIndex: 'customer_name' },
                                                { title: 'Redemptions', dataIndex: 'count', align: 'center' },
                                                {
                                                    title: 'Total Saved',
                                                    dataIndex: 'total_saved',
                                                    render: currency,
                                                    align: 'right'
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <Empty description="No customer redemption data available" />
                                    )}

                                    <Divider className="mm-form-divider">Recent Redemptions</Divider>
                                    {redemptionsQuery.data?.data?.length > 0 ? (
                                        <Table
                                            dataSource={redemptionsQuery.data.data}
                                            rowKey="redemption_id"
                                            size="small"
                                            pagination={false}
                                            className="mm-analytics-table"
                                            columns={[
                                                {
                                                    title: 'Booking #',
                                                    dataIndex: ['booking', 'booking_no'],
                                                    render: (text) => text || 'N/A'
                                                },
                                                {
                                                    title: 'Customer',
                                                    dataIndex: ['booking', 'serviceEvent', 'customer', 'person', 'full_name'],
                                                    render: (text) => text || 'Guest'
                                                },
                                                {
                                                    title: 'Original',
                                                    dataIndex: 'original_amount',
                                                    render: currency,
                                                    align: 'right'
                                                },
                                                {
                                                    title: 'Discount',
                                                    dataIndex: 'discount_amount',
                                                    render: currency,
                                                    align: 'right'
                                                },
                                                {
                                                    title: 'Final',
                                                    dataIndex: 'final_amount',
                                                    render: currency,
                                                    align: 'right'
                                                },
                                                {
                                                    title: 'Date',
                                                    dataIndex: 'created_at',
                                                    render: (text) => dayjs(text).format('MMM DD, YYYY')
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <Empty description="No redemption records found" />
                                    )}
                                </div>
                            ) : (
                                <Empty description="No analytics data available" />
                            )}
                        </div>
                    )}
                </Modal>

                {/* ============================================================
                    QUICK VIEW DRAWER
                ============================================================ */}
                <QuickViewDrawer />

                {/* ============================================================
                    PACKAGE VIEW MODAL
                ============================================================ */}
                <PackageViewModal />

            </div>
        </ConfigProvider>
    );
};

export default MenuManagement;