// src/components/Staff_Management.jsx - COMPLETE UPDATED VERSION

import { API_ORIGIN } from '../../../config/env';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    SearchOutlined, PlusOutlined, TeamOutlined, ClockCircleOutlined,
    CalendarOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
    MailOutlined, PhoneOutlined, BankOutlined, IdcardOutlined,
    UploadOutlined, StarOutlined, FilterOutlined, ReloadOutlined,
    CloseOutlined, CheckCircleOutlined, WarningOutlined, CoffeeOutlined,
    SafetyOutlined, HeartOutlined, TrophyOutlined, BookOutlined,
    FileTextOutlined, PrinterOutlined, PhoneFilled, MailFilled,
    PauseCircleOutlined, InboxOutlined, BarChartOutlined,
    SortAscendingOutlined, SortDescendingOutlined, ColumnHeightOutlined,
    FullscreenOutlined, UserOutlined, BuildOutlined, HistoryOutlined,
    RestOutlined, LoadingOutlined, ExclamationCircleOutlined,
    DownOutlined, DollarOutlined, CheckSquareOutlined, EnvironmentOutlined,
    GlobalOutlined, FileSearchOutlined, FilePdfOutlined
} from '@ant-design/icons';
import { Tooltip, Input, Select, Button, Space } from 'antd';
import PeopleIcon from '@mui/icons-material/People';
import { staffAPI, ensureArray } from '../../../services/api';
import {
    useEmployees,
    useDepartments,
    usePositions,
    useSalaryGrades,
    useEmployeeStats,
    useArchivedEmployees,
    useCreateEmployee,
    useUpdateEmployee,
    useBulkUpdateStatus,
    useToggleBookmark,
    useCreateDepartment,
    useUpdateDepartment,
    useDeleteDepartment,
    useCreatePosition,
    useUpdatePosition,
    useDeletePosition,
    useCreateSalaryGrade,
    useUpdateSalaryGrade,
    useDeleteSalaryGrade,
} from '../../../hooks/useStaffQueries';
import '../styles/StaffManagement.css';

const { Search: AntSearch } = Input;
const { Option } = Select;

const StaffManagement = () => {
    // ==================== STATE MANAGEMENT ====================
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedTab, setSelectedTab] = useState('all');
    const [showArchive, setShowArchive] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'first_name', direction: 'asc' });
    const [visibleColumns, setVisibleColumns] = useState({
        employee: true, department: true, position: true, status: true,
        salary_grade: true, hourly_rate: true, contact: true, actions: true
    });
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentDate, setCurrentDate] = useState('');
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('success');
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(null);

    // Compliance Modal States
    const [complianceSearchQuery, setComplianceSearchQuery] = useState('');
    const [complianceFilterStatus, setComplianceFilterStatus] = useState('all');
    const [complianceFilterDepartment, setComplianceFilterDepartment] = useState('all');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showPositionModal, setShowPositionModal] = useState(false);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const [showSalaryGradeModal, setShowSalaryGradeModal] = useState(false);
    const [showComplianceModal, setShowComplianceModal] = useState(false);
    const [showBenefitsModal, setShowBenefitsModal] = useState(false);
    const [showReportsModal, setShowReportsModal] = useState(false);
    const [showStatusFilterModal, setShowStatusFilterModal] = useState(false);
    const [showComplianceEditModal, setShowComplianceEditModal] = useState(false);
    const [editingComplianceEmployee, setEditingComplianceEmployee] = useState(null);
    const [isLoadingCompliance, setIsLoadingCompliance] = useState(false);

    const [formData, setFormData] = useState({
        first_name: '', last_name: '', middle_name: '', email: '', phone: '',
        birth_date: '', gender: '', address: '', city: '', state: '', postal_code: '', country: 'Philippines',
        department_id: '', position_id: '', employee_type: 'regular', status: 'active',
        hire_date: '', hourly_rate_override: '', bank_name: '', bank_account: '',
        allowances: '', other_deductions: '', sss: '', philhealth: '', pagibig: '', tin: '',
        emergency_contact: '', emergency_relation: '', emergency_phone: '',
        skills: '', certifications: '', achievements: '', notes: '',
    });

    const [positionFormData, setPositionFormData] = useState({
        title: '', department_id: '', salary_grade_id: '', description: '',
        employment_type: 'full-time', max_hours_per_week: '40', required_skills: '', status: 'active'
    });
    const [departmentFormData, setDepartmentFormData] = useState({
        name: '', code: '', description: '', manager_id: '', status: 'active'
    });
    const [salaryGradeFormData, setSalaryGradeFormData] = useState({
        grade_name: '', hourly_rate: '', description: '', status: 'active'
    });

    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [touchedFields, setTouchedFields] = useState({});
    const [formStep, setFormStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [positionFormMode, setPositionFormMode] = useState('add');
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [departmentFormMode, setDepartmentFormMode] = useState('add');
    const [selectedDepartmentForEdit, setSelectedDepartmentForEdit] = useState(null);
    const [salaryGradeFormMode, setSalaryGradeFormMode] = useState('add');
    const [selectedSalaryGrade, setSelectedSalaryGrade] = useState(null);
    const [positionFormErrors, setPositionFormErrors] = useState({});
    const [departmentFormErrors, setDepartmentFormErrors] = useState({});
    const [salaryGradeFormErrors, setSalaryGradeFormErrors] = useState({});
    const [selectedPositionDetails, setSelectedPositionDetails] = useState({
        salary_grade: '', hourly_rate: 0, salary_grade_id: null
    });

    const [complianceData, setComplianceData] = useState([]);
    const [filteredComplianceData, setFilteredComplianceData] = useState([]);
    const [benefitsData, setBenefitsData] = useState([]);
    const [reportsData, setReportsData] = useState([]);

    const pageSize = 5;
    const API_URL = API_ORIGIN;

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') return true;
        if (savedTheme === 'light') return false;
        return document.body.classList.contains('dark-mode');
    });

    // Theme detection
    useEffect(() => {
        const updateTheme = () => {
            const isDark = document.body.classList.contains('dark-mode');
            setIsDarkMode(isDark);
        };
        
        const observer = new MutationObserver(() => {
            updateTheme();
        });
        
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        
        const handleThemeChange = (e) => {
            setIsDarkMode(e.detail.isDark);
        };
        
        const handleStorageChange = (e) => {
            if (e.key === 'theme') {
                const isDark = e.newValue === 'dark';
                setIsDarkMode(isDark);
            }
        };
        
        window.addEventListener('themeChange', handleThemeChange);
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            observer.disconnect();
            window.removeEventListener('themeChange', handleThemeChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // Options arrays
    const employmentTypeOptions = [
        { value: 'regular', label: 'Regular' },
        { value: 'oncall', label: 'On-call' },
        { value: 'probationary', label: 'Probationary' },
        { value: 'contract', label: 'Contract' },
        { value: 'intern', label: 'Intern' }
    ];

    const genderOptions = [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'other', label: 'Other' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' }
    ];

    const statusOptions = [
        { value: 'active', label: 'Active', icon: '●', color: '#10b981', bgColor: '#d1fae5', textColor: '#065f46' },
        { value: 'onleave', label: 'On Leave', icon: '●', color: '#f59e0b', bgColor: '#fed7aa', textColor: '#92400e' },
        { value: 'inactive', label: 'Inactive', icon: '●', color: '#6b7280', bgColor: '#f3f4f6', textColor: '#374151' },
        { value: 'terminated', label: 'Terminated', icon: '●', color: '#ef4444', bgColor: '#fee2e2', textColor: '#991b1b' }
    ];

    const positionEmploymentTypes = [
        { value: 'full-time', label: 'Full Time' },
        { value: 'part-time', label: 'Part Time' },
        { value: 'contract', label: 'Contract' },
        { value: 'internship', label: 'Internship' },
        { value: 'temporary', label: 'Temporary' },
        { value: 'seasonal', label: 'Seasonal' }
    ];

    // ==================== REACT QUERY HOOKS ====================
    const employeeFilters = useMemo(() => {
        const filters = { 
            page: currentPage, 
            per_page: pageSize,
            show_archive: selectedTab === 'inactive' || selectedTab === 'terminated'
        };
        if (selectedDepartment !== 'all') filters.department_id = selectedDepartment;
        if (selectedStatus !== 'all') filters.status = selectedStatus;
        if (selectedTab !== 'all' && selectedTab !== 'inactive' && selectedTab !== 'terminated') {
            filters.status = selectedTab;
        }
        if (searchQuery) filters.search = searchQuery;
        return filters;
    }, [selectedDepartment, selectedStatus, selectedTab, searchQuery, currentPage, pageSize]);

    const {
        data: employeesResponse,
        isLoading: employeesLoading,
        refetch: refetchEmployees
    } = useEmployees(employeeFilters);

    const { data: departmentsResponse, isLoading: departmentsLoading, refetch: refetchDepartments } = useDepartments();
    const { data: positionsResponse, isLoading: positionsLoading, refetch: refetchPositions } = usePositions();
    const { data: salaryGradesResponse, isLoading: salaryGradesLoading, refetch: refetchSalaryGrades } = useSalaryGrades();
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useEmployeeStats();
    const { data: archivedEmployeesResponse, isLoading: archivedLoading, refetch: refetchArchived } = useArchivedEmployees();

    const employees = React.useMemo(() => {
        if (!employeesResponse) return [];
        if (Array.isArray(employeesResponse)) return employeesResponse;
        if (employeesResponse.data && Array.isArray(employeesResponse.data)) return employeesResponse.data;
        if (employeesResponse.data && employeesResponse.data.data && Array.isArray(employeesResponse.data.data)) return employeesResponse.data.data;
        return [];
    }, [employeesResponse]);

    const pagination = React.useMemo(() => {
        if (!employeesResponse) return null;
        if (employeesResponse.pagination) return employeesResponse.pagination;
        if (employeesResponse.data && employeesResponse.data.pagination) return employeesResponse.data.pagination;
        return null;
    }, [employeesResponse]);

    const departments = React.useMemo(() => {
        if (!departmentsResponse) return [];
        if (Array.isArray(departmentsResponse)) return departmentsResponse;
        if (departmentsResponse.data && Array.isArray(departmentsResponse.data)) return departmentsResponse.data;
        if (departmentsResponse.data && departmentsResponse.data.data && Array.isArray(departmentsResponse.data.data)) return departmentsResponse.data.data;
        return [];
    }, [departmentsResponse]);

    const positions = React.useMemo(() => {
        if (!positionsResponse) return [];
        if (Array.isArray(positionsResponse)) return positionsResponse;
        if (positionsResponse.data && Array.isArray(positionsResponse.data)) return positionsResponse.data;
        if (positionsResponse.data && positionsResponse.data.data && Array.isArray(positionsResponse.data.data)) return positionsResponse.data.data;
        return [];
    }, [positionsResponse]);

    const salaryGrades = React.useMemo(() => {
        if (!salaryGradesResponse) return [];
        if (Array.isArray(salaryGradesResponse)) return salaryGradesResponse;
        if (salaryGradesResponse.data && Array.isArray(salaryGradesResponse.data)) return salaryGradesResponse.data;
        if (salaryGradesResponse.data && salaryGradesResponse.data.data && Array.isArray(salaryGradesResponse.data.data)) return salaryGradesResponse.data.data;
        return [];
    }, [salaryGradesResponse]);

    const archivedEmployees = React.useMemo(() => {
        if (!archivedEmployeesResponse) return [];
        if (Array.isArray(archivedEmployeesResponse)) return archivedEmployeesResponse;
        if (archivedEmployeesResponse.data && Array.isArray(archivedEmployeesResponse.data)) return archivedEmployeesResponse.data;
        if (archivedEmployeesResponse.data && archivedEmployeesResponse.data.data && Array.isArray(archivedEmployeesResponse.data.data)) return archivedEmployeesResponse.data.data;
        return [];
    }, [archivedEmployeesResponse]);

    const isLoading = employeesLoading && employees.length === 0;

    // Mutations
    const createEmployeeMutation = useCreateEmployee();
    const updateEmployeeMutation = useUpdateEmployee();
    const bulkUpdateStatusMutation = useBulkUpdateStatus();
    const toggleBookmarkMutation = useToggleBookmark();
    const createDepartmentMutation = useCreateDepartment();
    const updateDepartmentMutation = useUpdateDepartment();
    const deleteDepartmentMutation = useDeleteDepartment();
    const createPositionMutation = useCreatePosition();
    const updatePositionMutation = useUpdatePosition();
    const deletePositionMutation = useDeletePosition();
    const createSalaryGradeMutation = useCreateSalaryGrade();
    const updateSalaryGradeMutation = useUpdateSalaryGrade();
    const deleteSalaryGradeMutation = useDeleteSalaryGrade();

    // ==================== HELPER FUNCTIONS ====================
    const getImageUrl = useCallback((photoPath) => {
        if (!photoPath) return null;
        if (photoPath.startsWith('http')) return photoPath;
        if (photoPath.startsWith('/')) return `${API_URL}${photoPath}`;
        const cleanPath = photoPath.replace(/^storage\//, '');
        return `${API_URL}/storage/${cleanPath}`;
    }, [API_URL]);

    const getEmployeeSalaryGrade = useCallback((employee) => {
        if (employee.position?.salary_grade?.grade_name) {
            return employee.position.salary_grade.grade_name;
        }
        if (employee.position?.salary_grade_id) {
            const grade = salaryGrades.find(sg => sg.id === employee.position.salary_grade_id);
            return grade ? grade.grade_name : 'N/A';
        }
        return 'N/A';
    }, [salaryGrades]);

    const showNotificationMessage = useCallback((message, type = 'success') => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
    }, []);

    const handleBlur = (fieldName) => {
        setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
    };

    const validateTextOnly = (value, fieldName) => {
        if (value && /\d/.test(value)) {
            return `${fieldName} cannot contain numbers`;
        }
        return null;
    };

    const validateBirthDate = (date) => {
        if (!date) return true;
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate <= today;
    };

    const filteredPositions = useMemo(() => {
        if (formData.department_id && positions.length > 0) {
            return positions.filter(pos => pos.department_id === parseInt(formData.department_id));
        }
        return [];
    }, [formData.department_id, positions]);

    const handlePositionChange = useCallback(async (positionId) => {
        setFormData(prev => ({ ...prev, position_id: positionId }));

        if (positionId) {
            const position = positions.find(p => p.id === parseInt(positionId));
            if (position && position.salary_grade) {
                setSelectedPositionDetails({
                    salary_grade: position.salary_grade.grade_name,
                    hourly_rate: position.salary_grade.hourly_rate || 0,
                    salary_grade_id: position.salary_grade.id
                });
            } else if (position && position.salary_grade_id) {
                const salaryGrade = salaryGrades.find(sg => sg.id === position.salary_grade_id);
                if (salaryGrade) {
                    setSelectedPositionDetails({
                        salary_grade: salaryGrade.grade_name,
                        hourly_rate: salaryGrade.hourly_rate || 0,
                        salary_grade_id: salaryGrade.id
                    });
                }
            }
        } else {
            setSelectedPositionDetails({
                salary_grade: '',
                hourly_rate: 0,
                salary_grade_id: null
            });
        }
    }, [positions, salaryGrades]);

    const validateForm = () => {
        const errors = {};
        if (!formData.first_name?.trim()) errors.first_name = 'First name is required';
        if (!formData.last_name?.trim()) errors.last_name = 'Last name is required';
        if (!formData.email?.trim()) errors.email = 'Email is required';
        if (!formData.phone?.trim()) errors.phone = 'Phone is required';
        if (!formData.department_id) errors.department_id = 'Department is required';
        if (!formData.position_id) errors.position_id = 'Position is required';
        if (!formData.hire_date) errors.hire_date = 'Hire date is required';

        const textOnlyFields = [
            { field: 'first_name', label: 'First name' },
            { field: 'last_name', label: 'Last name' },
            { field: 'middle_name', label: 'Middle name' },
            { field: 'city', label: 'City' },
            { field: 'state', label: 'State/Province' },
            { field: 'country', label: 'Country' },
            { field: 'emergency_contact', label: 'Emergency contact' },
            { field: 'bank_name', label: 'Bank name' }
        ];

        textOnlyFields.forEach(({ field, label }) => {
            const error = validateTextOnly(formData[field], label);
            if (error) errors[field] = error;
        });

        if (formData.birth_date && !validateBirthDate(formData.birth_date)) {
            errors.birth_date = 'Birth date cannot be in the future';
        }

        if (formData.email && !/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
        }

        if (formData.phone && !/^[0-9+\-\s()]{10,20}$/.test(formData.phone)) {
            errors.phone = 'Please enter a valid phone number';
        }

        if (formData.hire_date) {
            const hireDate = new Date(formData.hire_date);
            const today = new Date();
            if (hireDate > today) {
                errors.hire_date = 'Hire date cannot be in the future';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep1 = () => {
        const errors = {};
        if (!formData.first_name?.trim()) errors.first_name = 'First name is required';
        if (!formData.last_name?.trim()) errors.last_name = 'Last name is required';
        if (!formData.email?.trim()) errors.email = 'Email is required';
        if (!formData.phone?.trim()) errors.phone = 'Phone is required';
        if (!formData.position_id) errors.position_id = 'Position is required';

        const nameError = validateTextOnly(formData.first_name, 'First name');
        if (nameError) errors.first_name = nameError;
        const lastNameError = validateTextOnly(formData.last_name, 'Last name');
        if (lastNameError) errors.last_name = lastNameError;
        const middleNameError = validateTextOnly(formData.middle_name, 'Middle name');
        if (middleNameError) errors.middle_name = middleNameError;

        if (formData.birth_date && !validateBirthDate(formData.birth_date)) {
            errors.birth_date = 'Birth date cannot be in the future';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = () => {
        const errors = {};
        if (!formData.department_id) errors.department_id = 'Department is required';
        if (!formData.hire_date) errors.hire_date = 'Hire date is required';

        if (formData.hire_date) {
            const hireDate = new Date(formData.hire_date);
            const today = new Date();
            if (hireDate > today) {
                errors.hire_date = 'Hire date cannot be in the future';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validatePositionForm = () => {
        const errors = {};
        if (!positionFormData.title?.trim()) errors.title = 'Position title is required';
        if (!positionFormData.department_id) errors.department_id = 'Department is required';
        if (!positionFormData.salary_grade_id) errors.salary_grade_id = 'Salary grade is required';
        if (positionFormData.title && /\d/.test(positionFormData.title)) {
            errors.title = 'Position title cannot contain numbers';
        }
        setPositionFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateDepartmentForm = () => {
        const errors = {};
        if (!departmentFormData.name?.trim()) errors.name = 'Department name is required';
        if (!departmentFormData.code?.trim()) errors.code = 'Department code is required';
        if (departmentFormData.name && /\d/.test(departmentFormData.name)) {
            errors.name = 'Department name cannot contain numbers';
        }
        setDepartmentFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateSalaryGradeForm = () => {
        const errors = {};
        if (!salaryGradeFormData.grade_name?.trim()) errors.grade_name = 'Grade name is required';
        if (!salaryGradeFormData.hourly_rate || salaryGradeFormData.hourly_rate <= 0) {
            errors.hourly_rate = 'Hourly rate must be greater than 0';
        }
        setSalaryGradeFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const resetForm = () => {
        setFormData({
            first_name: '', last_name: '', middle_name: '', position_id: '', email: '',
            phone: '', address: '', city: '', state: '', postal_code: '', country: 'Philippines',
            department_id: '', employee_type: 'regular', status: 'active',
            hire_date: '', hourly_rate_override: '', emergency_contact: '', emergency_relation: '',
            emergency_phone: '', sss: '', philhealth: '', pagibig: '', tin: '', skills: '',
            certifications: '', achievements: '', notes: '', profile_photo: null,
            bank_name: '', bank_account: '', birth_date: '', gender: '',
        });
        setSelectedPositionDetails({ salary_grade: '', hourly_rate: 0, salary_grade_id: null });
        setFormErrors({});
        setTouchedFields({});
        setImageFile(null);
        setImagePreview(null);
        setFormStep(1);
        setIsSubmitting(false);
        setUploadProgress(0);
    };

    const resetPositionForm = () => {
        setPositionFormData({
            title: '', department_id: '', salary_grade_id: '', description: '',
            employment_type: 'full-time', max_hours_per_week: '40', required_skills: '', status: 'active'
        });
        setPositionFormErrors({});
    };

    const resetDepartmentForm = () => {
        setDepartmentFormData({
            name: '', code: '', description: '', manager_id: '', status: 'active'
        });
        setDepartmentFormErrors({});
    };

    const resetSalaryGradeForm = () => {
        setSalaryGradeFormData({
            grade_name: '', hourly_rate: '', description: '', status: 'active'
        });
        setSalaryGradeFormErrors({});
    };

    const closeModal = () => {
        setShowModal(false);
        resetForm();
        setSelectedEmployee(null);
        setModalMode('add');
    };

    // Employee CRUD
    const handleAddEmployee = () => {
        resetForm();
        setSelectedEmployee(null);
        setModalMode('add');
        setFormStep(1);
        setShowModal(true);
    };

    const handleEditEmployee = (employee) => {
        setSelectedEmployee(employee);
        setModalMode('edit');
        setFormStep(1);
        setFormData({
            first_name: employee.first_name || '',
            last_name: employee.last_name || '',
            middle_name: employee.middle_name || '',
            position_id: employee.position?.id || employee.position_id || '',
            email: employee.email || '',
            phone: employee.phone || '',
            address: employee.address || '',
            city: employee.city || '',
            state: employee.state || '',
            postal_code: employee.postal_code || '',
            country: employee.country || 'Philippines',
            department_id: employee.department?.id || employee.department_id || '',
            employee_type: employee.employee_type || 'regular',
            status: employee.status || 'active',
            hire_date: employee.hire_date || '',
            hourly_rate_override: employee.hourly_rate_override || '',
            emergency_contact: employee.emergency_contact_name || employee.emergency_contact || '',
            emergency_relation: employee.emergency_contact_relation || employee.emergency_relation || '',
            emergency_phone: employee.emergency_contact_phone || employee.emergency_phone || '',
            sss: employee.sss_number || employee.sss || '',
            philhealth: employee.philhealth_number || employee.philhealth || '',
            pagibig: employee.pagibig_number || employee.pagibig || '',
            tin: employee.tin_number || employee.tin || '',
            skills: Array.isArray(employee.skills) ? employee.skills.join(', ') : (employee.skills || ''),
            certifications: Array.isArray(employee.certifications) ? employee.certifications.join(', ') : (employee.certifications || ''),
            achievements: Array.isArray(employee.achievements) ? employee.achievements.join(', ') : (employee.achievements || ''),
            notes: employee.notes || '',
            profile_photo: null,
            bank_name: employee.bank_name || '',
            bank_account: employee.bank_account_number || employee.bank_account || '',
            birth_date: employee.birth_date || '',
            gender: employee.gender || ''
        });

        if (employee.position) {
            const pos = employee.position;
            const salaryGrade = pos.salary_grade;
            if (salaryGrade) {
                setSelectedPositionDetails({
                    salary_grade: salaryGrade.grade_name,
                    hourly_rate: salaryGrade.hourly_rate || 0,
                    salary_grade_id: salaryGrade.id
                });
            } else if (pos.salary_grade_id) {
                const sg = salaryGrades.find(s => s.id === pos.salary_grade_id);
                if (sg) {
                    setSelectedPositionDetails({
                        salary_grade: sg.grade_name,
                        hourly_rate: sg.hourly_rate || 0,
                        salary_grade_id: sg.id
                    });
                }
            }
        }

        setImagePreview(getImageUrl(employee.profile_photo_url || employee.profile_photo));
        setImageFile(null);
        setFormErrors({});
        setTouchedFields({});
        setShowModal(true);
    };

    const handleViewEmployee = (employee) => {
        setSelectedEmployee(employee);
        setModalMode('view');
        setShowModal(true);
    };

    const handleSaveEmployee = async () => {
        if (!validateForm()) {
            showNotificationMessage('Please fill in all required fields', 'error');
            return;
        }

        setIsSubmitting(true);
        const formDataToSend = new FormData();

        const fieldMapping = {
            first_name: formData.first_name,
            last_name: formData.last_name,
            middle_name: formData.middle_name || '',
            email: formData.email,
            phone: formData.phone || '',
            birth_date: formData.birth_date || '',
            gender: formData.gender || '',
            address: formData.address || '',
            city: formData.city || '',
            state: formData.state || '',
            postal_code: formData.postal_code || '',
            country: formData.country || 'Philippines',
            department_id: formData.department_id,
            position_id: formData.position_id,
            employee_type: formData.employee_type || 'regular',
            status: formData.status || 'active',
            hire_date: formData.hire_date,
            hourly_rate_override: formData.hourly_rate_override || '',
            bank_name: formData.bank_name || '',
            bank_account_number: formData.bank_account || '',
            allowances: formData.allowances || 0,
            other_deductions: formData.other_deductions || 0,
            sss_number: formData.sss || '',
            philhealth_number: formData.philhealth || '',
            pagibig_number: formData.pagibig || '',
            tin_number: formData.tin || '',
            emergency_contact_name: formData.emergency_contact || '',
            emergency_contact_relation: formData.emergency_relation || '',
            emergency_contact_phone: formData.emergency_phone || '',
            notes: formData.notes || '',
        };

        Object.keys(fieldMapping).forEach(key => {
            const value = fieldMapping[key];
            if (value !== null && value !== undefined && value !== '') {
                formDataToSend.append(key, value);
            }
        });

        if (formData.skills && formData.skills.trim()) {
            const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(s => s);
            formDataToSend.append('skills', JSON.stringify(skillsArray));
        } else {
            formDataToSend.append('skills', JSON.stringify([]));
        }

        if (formData.certifications && formData.certifications.trim()) {
            const certsArray = formData.certifications.split(',').map(s => s.trim()).filter(s => s);
            formDataToSend.append('certifications', JSON.stringify(certsArray));
        } else {
            formDataToSend.append('certifications', JSON.stringify([]));
        }

        if (formData.achievements && formData.achievements.trim()) {
            const achievementsArray = formData.achievements.split(',').map(s => s.trim()).filter(s => s);
            formDataToSend.append('achievements', JSON.stringify(achievementsArray));
        } else {
            formDataToSend.append('achievements', JSON.stringify([]));
        }

        if (imageFile) {
            formDataToSend.append('profile_photo', imageFile);
        }

        try {
            if (modalMode === 'add') {
                await createEmployeeMutation.mutateAsync(formDataToSend);
                showNotificationMessage('Staff member added successfully', 'success');
                setShowSuccessAnimation(true);
                setTimeout(() => setShowSuccessAnimation(false), 2000);
                closeModal();
                await refetchEmployees();
                await refetchStats();
            } else if (selectedEmployee) {
                await updateEmployeeMutation.mutateAsync({
                    id: selectedEmployee.id || selectedEmployee.employee_id,
                    data: formDataToSend
                });
                showNotificationMessage('Staff member updated successfully', 'success');
                closeModal();
                await refetchEmployees();
                await refetchStats();
            }
            setCurrentPage(1);
        } catch (err) {
            console.error('Save error:', err);
            if (err.response?.data?.errors) {
                const errors = err.response.data.errors;
                const errorMessages = Object.keys(errors).map(field =>
                    `${field}: ${errors[field].join(', ')}`
                ).join('\n');
                showNotificationMessage(`Validation failed:\n${errorMessages}`, 'error');
            } else if (err.response?.data?.message) {
                const backendDebug = err.response?.data?.debug
                    ? `\nDetails: ${err.response.data.debug}`
                    : '';
                showNotificationMessage(`${err.response.data.message}${backendDebug}`, 'error');
            } else {
                showNotificationMessage('Operation failed. Check console for details.', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Archive functions
    const handleArchiveClick = (employee) => {
        setEmployeeToDelete(employee);
        setShowDeleteConfirm(true);
    };

    const confirmArchive = async () => {
        if (employeeToDelete) {
            try {
                await bulkUpdateStatusMutation.mutateAsync({ 
                    ids: [employeeToDelete.id || employeeToDelete.employee_id], 
                    status: 'inactive' 
                });
                showNotificationMessage('Staff member archived successfully', 'info');
                setShowDeleteConfirm(false);
                setEmployeeToDelete(null);
                await refetchEmployees();
                await refetchArchived();
                await refetchStats();
                setSelectedEmployees(prev => prev.filter(id => id !== (employeeToDelete.id || employeeToDelete.employee_id)));
                setCurrentPage(1);
            } catch (err) {
                console.error('Archive error:', err);
                showNotificationMessage('Failed to archive employee: ' + (err.response?.data?.message || err.message), 'error');
            }
        }
    };

    const restoreEmployee = async (id) => {
        try {
            await staffAPI.restoreEmployee(id);
            showNotificationMessage('Staff member restored successfully', 'success');
            await refetchEmployees();
            await refetchArchived();
            await refetchStats();
            setCurrentPage(1);
        } catch (err) {
            console.error('Restore error:', err);
            showNotificationMessage('Failed to restore employee: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const permanentlyDeleteEmployee = async (id) => {
        if (window.confirm('Are you ABSOLUTELY sure? This action cannot be undone!')) {
            try {
                await staffAPI.deleteEmployee(id);
                showNotificationMessage('Employee permanently deleted', 'warning');
                await refetchEmployees();
                await refetchArchived();
                await refetchStats();
                setCurrentPage(1);
            } catch (err) {
                console.error('Delete error:', err);
                showNotificationMessage('Failed to delete employee: ' + (err.response?.data?.message || err.message), 'error');
            }
        }
    };

    const handleBookmark = async (id) => {
        try {
            await toggleBookmarkMutation.mutateAsync(id);
            showNotificationMessage('Bookmark toggled', 'success');
            await refetchEmployees();
        } catch (err) {
            console.error('Bookmark error:', err);
            showNotificationMessage('Failed to update bookmark', 'error');
        }
    };

    const handleUpdateStatus = async (employeeId, newStatus) => {
        try {
            await bulkUpdateStatusMutation.mutateAsync({ ids: [employeeId], status: newStatus });
            const statusLabel = statusOptions.find(s => s.value === newStatus)?.label || newStatus;
            showNotificationMessage(`Status updated to ${statusLabel}`, 'success');
            await refetchEmployees();
            await refetchArchived();
            await refetchStats();
            setCurrentPage(1);
        } catch (err) {
            console.error('Status update error:', err);
            showNotificationMessage('Failed to update status: ' + (err.response?.data?.message || err.message), 'error');
        }
        setShowStatusDropdown(null);
    };

    // Bulk operations
    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedEmployees([]);
    };

    const handleSelectAll = () => {
        if (selectedEmployees.length === paginatedEmployees.length) {
            setSelectedEmployees([]);
        } else {
            setSelectedEmployees(paginatedEmployees.map(emp => emp.id || emp.employee_id));
        }
    };

    const handleSelectEmployee = (employeeId) => {
        setSelectedEmployees(prev =>
            prev.includes(employeeId) ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
        );
    };

    const handleBulkArchive = async () => {
        if (selectedEmployees.length === 0) {
            showNotificationMessage('No employees selected', 'error');
            return;
        }
        try {
            await bulkUpdateStatusMutation.mutateAsync({ ids: selectedEmployees, status: 'inactive' });
            showNotificationMessage(`${selectedEmployees.length} staff member(s) archived`, 'info');
            setSelectedEmployees([]);
            setIsSelectMode(false);
            await refetchEmployees();
            await refetchArchived();
            await refetchStats();
            setCurrentPage(1);
        } catch (err) {
            console.error('Bulk archive error:', err);
            showNotificationMessage('Failed to archive employees: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const handleBulkStatusUpdate = async (status) => {
        if (selectedEmployees.length === 0) {
            showNotificationMessage('No employees selected', 'error');
            return;
        }
        try {
            await bulkUpdateStatusMutation.mutateAsync({ ids: selectedEmployees, status });
            const statusLabel = statusOptions.find(s => s.value === status)?.label || status;
            showNotificationMessage(`Status updated to ${statusLabel} for ${selectedEmployees.length} staff members`, 'success');
            setSelectedEmployees([]);
            setIsSelectMode(false);
            await refetchEmployees();
            await refetchArchived();
            await refetchStats();
            setCurrentPage(1);
        } catch (err) {
            console.error('Bulk status update error:', err);
            showNotificationMessage('Failed to update status: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    // Position CRUD
    const handleAddPosition = () => {
        setPositionFormMode('add');
        resetPositionForm();
        setSelectedPosition(null);
        setShowPositionModal(true);
    };

    const handleEditPosition = (position) => {
        setPositionFormMode('edit');
        setSelectedPosition(position);
        setPositionFormData({
            title: position.title || '',
            department_id: position.department_id || '',
            salary_grade_id: position.salary_grade_id || '',
            description: position.description || '',
            employment_type: position.employment_type || 'full-time',
            max_hours_per_week: position.max_hours_per_week || '40',
            required_skills: Array.isArray(position.required_skills) ? position.required_skills.join(', ') : (position.required_skills || ''),
            status: position.status || 'active'
        });
        setPositionFormErrors({});
        setShowPositionModal(true);
    };

    const handleSavePosition = async () => {
        if (!validatePositionForm()) {
            showNotificationMessage('Please fill in all required fields', 'error');
            return;
        }

        setIsSubmitting(true);

        const data = {
            title: positionFormData.title.trim(),
            department_id: parseInt(positionFormData.department_id),
            salary_grade_id: parseInt(positionFormData.salary_grade_id),
            description: positionFormData.description || '',
            employment_type: positionFormData.employment_type,
            max_hours_per_week: parseInt(positionFormData.max_hours_per_week),
            status: positionFormData.status
        };

        if (positionFormData.required_skills && positionFormData.required_skills.trim()) {
            const skillsArray = positionFormData.required_skills
                .split(',')
                .map(s => s.trim())
                .filter(s => s);
            data.required_skills = skillsArray;
        } else {
            data.required_skills = [];
        }

        try {
            if (positionFormMode === 'add') {
                await createPositionMutation.mutateAsync(data);
                showNotificationMessage('Position created successfully', 'success');
            } else if (selectedPosition) {
                await updatePositionMutation.mutateAsync({ id: selectedPosition.id, data });
                showNotificationMessage('Position updated successfully', 'success');
            }
            setShowPositionModal(false);
            resetPositionForm();
            await refetchPositions();
        } catch (err) {
            console.error('Save position error:', err);
            if (err.response?.data?.errors) {
                const errors = err.response.data.errors;
                const errorMessages = Object.keys(errors).map(field => 
                    `${field}: ${errors[field].join(', ')}`
                ).join('\n');
                showNotificationMessage(`Validation failed:\n${errorMessages}`, 'error');
            } else {
                showNotificationMessage(err.response?.data?.message || 'Failed to save position', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const deletePosition = async (id) => {
        if (!window.confirm('Are you sure you want to delete this position?')) return;
        try {
            await deletePositionMutation.mutateAsync(id);
            showNotificationMessage('Position deleted successfully', 'success');
            await refetchPositions();
        } catch (err) {
            showNotificationMessage('Failed to delete position', 'error');
        }
    };

    // Department CRUD
    const handleAddDepartment = () => {
        setDepartmentFormMode('add');
        resetDepartmentForm();
        setSelectedDepartmentForEdit(null);
        setShowDepartmentModal(true);
    };

    const handleEditDepartment = (department) => {
        setDepartmentFormMode('edit');
        setSelectedDepartmentForEdit(department);
        setDepartmentFormData({
            name: department.name || '',
            code: department.code || '',
            description: department.description || '',
            manager_id: department.manager_id || '',
            status: department.status || 'active'
        });
        setDepartmentFormErrors({});
        setShowDepartmentModal(true);
    };

    const handleSaveDepartment = async () => {
        if (!validateDepartmentForm()) {
            showNotificationMessage('Please fill in all required fields', 'error');
            return;
        }

        setIsSubmitting(true);

        const data = {
            name: departmentFormData.name.trim(),
            code: departmentFormData.code.trim().toUpperCase(),
            description: departmentFormData.description || '',
            manager_id: departmentFormData.manager_id ? parseInt(departmentFormData.manager_id) : null,
            status: departmentFormData.status || 'active'
        };

        try {
            if (departmentFormMode === 'add') {
                await createDepartmentMutation.mutateAsync(data);
                showNotificationMessage('Department created successfully', 'success');
            } else if (selectedDepartmentForEdit) {
                await updateDepartmentMutation.mutateAsync({
                    id: selectedDepartmentForEdit.id,
                    data
                });
                showNotificationMessage('Department updated successfully', 'success');
            }
            setShowDepartmentModal(false);
            resetDepartmentForm();
            await refetchDepartments();
        } catch (err) {
            console.error('Save department error:', err);
            const errorMessage = err.response?.data?.message || err.response?.data?.errors || 'Failed to save department';
            showNotificationMessage(typeof errorMessage === 'string' ? errorMessage : 'Validation failed. Please check your input.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteDepartment = async (id) => {
        if (!window.confirm('Are you sure you want to delete this department?')) return;
        try {
            await deleteDepartmentMutation.mutateAsync(id);
            showNotificationMessage('Department deleted successfully', 'success');
            await refetchDepartments();
        } catch (err) {
            showNotificationMessage('Failed to delete department', 'error');
        }
    };

    // Salary Grade CRUD
    const handleAddSalaryGrade = () => {
        setSalaryGradeFormMode('add');
        resetSalaryGradeForm();
        setSelectedSalaryGrade(null);
        setShowSalaryGradeModal(true);
    };

    const handleEditSalaryGrade = (grade) => {
        setSalaryGradeFormMode('edit');
        setSelectedSalaryGrade(grade);
        setSalaryGradeFormData({
            grade_name: grade.grade_name || '',
            hourly_rate: grade.hourly_rate || '',
            description: grade.description || '',
            status: grade.status || 'active'
        });
        setSalaryGradeFormErrors({});
        setShowSalaryGradeModal(true);
    };

    const handleSaveSalaryGrade = async () => {
        if (!validateSalaryGradeForm()) {
            showNotificationMessage('Please fill in all required fields', 'error');
            return;
        }

        setIsSubmitting(true);

        const data = {
            grade_name: salaryGradeFormData.grade_name.trim().toUpperCase(),
            hourly_rate: parseFloat(salaryGradeFormData.hourly_rate),
            description: salaryGradeFormData.description || '',
            status: salaryGradeFormData.status
        };

        try {
            if (salaryGradeFormMode === 'add') {
                await createSalaryGradeMutation.mutateAsync(data);
                showNotificationMessage('Salary grade created successfully', 'success');
            } else if (selectedSalaryGrade) {
                await updateSalaryGradeMutation.mutateAsync({ id: selectedSalaryGrade.id, data });
                showNotificationMessage('Salary grade updated successfully', 'success');
            }
            setShowSalaryGradeModal(false);
            resetSalaryGradeForm();
            await refetchSalaryGrades();
        } catch (err) {
            console.error('Save salary grade error:', err);
            showNotificationMessage(err.response?.data?.message || 'Failed to save salary grade', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteSalaryGrade = async (id) => {
        if (!window.confirm('Are you sure you want to delete this salary grade?')) return;
        try {
            await deleteSalaryGradeMutation.mutateAsync(id);
            showNotificationMessage('Salary grade deleted successfully', 'success');
            await refetchSalaryGrades();
        } catch (err) {
            showNotificationMessage('Failed to delete salary grade', 'error');
        }
    };

    // ==================== COMPLIANCE FUNCTIONS (UPDATED) ====================
    
    /**
     * Fetches ALL employees from the database for compliance view
     */
    const fetchAllEmployeesForCompliance = useCallback(async () => {
        setIsLoadingCompliance(true);
        try {
            const response = await staffAPI.getEmployees({ 
                per_page: 9999,
                page: 1,
                show_archive: false
            });
            
            let allEmployees = [];
            if (response.data && response.data.data) {
                allEmployees = response.data.data;
            } else if (Array.isArray(response)) {
                allEmployees = response;
            } else if (response.data && Array.isArray(response.data)) {
                allEmployees = response.data;
            }
            
            return allEmployees;
        } catch (error) {
            console.error('Error fetching all employees for compliance:', error);
            showNotificationMessage('Failed to load compliance data', 'error');
            return [];
        } finally {
            setIsLoadingCompliance(false);
        }
    }, []);

    /**
     * Fetches compliance data from ALL employees
     */
    const fetchComplianceData = useCallback(async () => {
        const allEmployees = await fetchAllEmployeesForCompliance();
        
        if (!allEmployees || allEmployees.length === 0) {
            setComplianceData([]);
            setFilteredComplianceData([]);
            setShowComplianceModal(true);
            return;
        }

        const complianceRecords = allEmployees.map(emp => {
            const lastUpdated = emp.updated_at || emp.updatedAt || emp.created_at || emp.createdAt || null;
            
            let formattedLastUpdated = 'N/A';
            if (lastUpdated) {
                try {
                    const date = new Date(lastUpdated);
                    if (!isNaN(date.getTime())) {
                        formattedLastUpdated = date.toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                    }
                } catch (e) {
                    formattedLastUpdated = 'N/A';
                }
            }

            return {
                id: emp.id || emp.employee_id,
                name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown Staff',
                employee_code: emp.employee_code || `EMP-${emp.id}`,
                department: emp.department?.name || 'N/A',
                department_id: emp.department_id || emp.department?.id,
                sss: emp.sss_number || emp.sss || 'Not Provided',
                philhealth: emp.philhealth_number || emp.philhealth || 'Not Provided',
                pagibig: emp.pagibig_number || emp.pagibig || 'Not Provided',
                tin: emp.tin_number || emp.tin || 'Not Provided',
                status: (emp.sss_number || emp.sss) &&
                    (emp.philhealth_number || emp.philhealth) &&
                    (emp.pagibig_number || emp.pagibig) &&
                    (emp.tin_number || emp.tin) ? 'Compliant' : 'Missing Documents',
                last_updated: formattedLastUpdated,
                employee: emp
            };
        });
        setComplianceData(complianceRecords);
        setFilteredComplianceData(complianceRecords);
        setShowComplianceModal(true);
    }, [fetchAllEmployeesForCompliance]);

    /**
     * Filter compliance data based on search and filters
     */
    useEffect(() => {
        let filtered = [...complianceData];
        
        if (complianceSearchQuery.trim()) {
            const query = complianceSearchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(query) ||
                item.employee_code.toLowerCase().includes(query) ||
                item.sss.toLowerCase().includes(query) ||
                item.philhealth.toLowerCase().includes(query) ||
                item.pagibig.toLowerCase().includes(query) ||
                item.tin.toLowerCase().includes(query)
            );
        }
        
        if (complianceFilterStatus !== 'all') {
            filtered = filtered.filter(item => item.status === complianceFilterStatus);
        }
        
        if (complianceFilterDepartment !== 'all') {
            filtered = filtered.filter(item => 
                String(item.department_id) === String(complianceFilterDepartment)
            );
        }
        
        setFilteredComplianceData(filtered);
    }, [complianceSearchQuery, complianceFilterStatus, complianceFilterDepartment, complianceData]);

    /**
     * Print compliance report
     */
    const handlePrintCompliance = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showNotificationMessage('Please allow pop-ups to print', 'error');
            return;
        }

        const currentDateObj = new Date().toLocaleString();
        const companyName = "Catering Staff Management System";
        let tableRows = '';
        const dataToPrint = filteredComplianceData;

        dataToPrint.forEach(emp => {
            tableRows += `
                <tr>
                    <td>${emp.name}</td>
                    <td>${emp.employee_code}</td>
                    <td>${emp.sss}</td>
                    <td>${emp.philhealth}</td>
                    <td>${emp.pagibig}</td>
                    <td>${emp.tin}</td>
                    <td>${emp.status}</td>
                    <td>${emp.last_updated}</td>
                </tr>
            `;
        });

        const printHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Staff Compliance Report</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', sans-serif; padding: 40px; background: white; }
                    .print-container { max-width: 1200px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
                    .header h1 { font-size: 24px; color: #1e3a8a; }
                    .report-info { display: flex; justify-content: space-between; margin-bottom: 24px; padding: 12px; background: #f3f4f6; border-radius: 8px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #1e3a8a; color: white; padding: 12px; text-align: left; }
                    td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
                    .compliant { color: #10b981; font-weight: 600; }
                    .missing { color: #dc2626; font-weight: 600; }
                    .footer { margin-top: 30px; padding-top: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="header">
                        <h1>${companyName}</h1>
                        <p>Staff Compliance Report</p>
                    </div>
                    <div class="report-info">
                        <span>Generated: <strong>${currentDateObj}</strong></span>
                        <span>Total Employees: <strong>${dataToPrint.length}</strong></span>
                        <span>Compliant: <strong>${dataToPrint.filter(e => e.status === 'Compliant').length}</strong></span>
                        <span>Missing: <strong>${dataToPrint.filter(e => e.status === 'Missing Documents').length}</strong></span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>ID</th>
                                <th>SSS</th>
                                <th>PhilHealth</th>
                                <th>Pag-IBIG</th>
                                <th>TIN</th>
                                <th>Status</th>
                                <th>Last Updated</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    /**
     * Handles editing compliance information for a specific employee
     */
    const handleEditCompliance = (complianceRecord) => {
        setEditingComplianceEmployee(complianceRecord.employee);
        setFormData({
            first_name: complianceRecord.employee.first_name || '',
            last_name: complianceRecord.employee.last_name || '',
            middle_name: complianceRecord.employee.middle_name || '',
            position_id: complianceRecord.employee.position?.id || complianceRecord.employee.position_id || '',
            email: complianceRecord.employee.email || '',
            phone: complianceRecord.employee.phone || '',
            address: complianceRecord.employee.address || '',
            city: complianceRecord.employee.city || '',
            state: complianceRecord.employee.state || '',
            postal_code: complianceRecord.employee.postal_code || '',
            country: complianceRecord.employee.country || 'Philippines',
            department_id: complianceRecord.employee.department?.id || complianceRecord.employee.department_id || '',
            employee_type: complianceRecord.employee.employee_type || 'regular',
            status: complianceRecord.employee.status || 'active',
            hire_date: complianceRecord.employee.hire_date || '',
            hourly_rate_override: complianceRecord.employee.hourly_rate_override || '',
            emergency_contact: complianceRecord.employee.emergency_contact_name || complianceRecord.employee.emergency_contact || '',
            emergency_relation: complianceRecord.employee.emergency_contact_relation || complianceRecord.employee.emergency_relation || '',
            emergency_phone: complianceRecord.employee.emergency_contact_phone || complianceRecord.employee.emergency_phone || '',
            sss: complianceRecord.employee.sss_number || complianceRecord.employee.sss || '',
            philhealth: complianceRecord.employee.philhealth_number || complianceRecord.employee.philhealth || '',
            pagibig: complianceRecord.employee.pagibig_number || complianceRecord.employee.pagibig || '',
            tin: complianceRecord.employee.tin_number || complianceRecord.employee.tin || '',
            skills: Array.isArray(complianceRecord.employee.skills) ? complianceRecord.employee.skills.join(', ') : (complianceRecord.employee.skills || ''),
            certifications: Array.isArray(complianceRecord.employee.certifications) ? complianceRecord.employee.certifications.join(', ') : (complianceRecord.employee.certifications || ''),
            achievements: Array.isArray(complianceRecord.employee.achievements) ? complianceRecord.employee.achievements.join(', ') : (complianceRecord.employee.achievements || ''),
            notes: complianceRecord.employee.notes || '',
            profile_photo: null,
            bank_name: complianceRecord.employee.bank_name || '',
            bank_account: complianceRecord.employee.bank_account_number || complianceRecord.employee.bank_account || '',
            birth_date: complianceRecord.employee.birth_date || '',
            gender: complianceRecord.employee.gender || ''
        });
        setShowComplianceEditModal(true);
    };

    /**
     * Saves compliance information updates
     */
    const handleSaveComplianceEdit = async () => {
        if (!editingComplianceEmployee) return;

        setIsSubmitting(true);
        const formDataToSend = new FormData();

        const fieldMapping = {
            first_name: formData.first_name,
            last_name: formData.last_name,
            middle_name: formData.middle_name || '',
            email: formData.email,
            phone: formData.phone || '',
            birth_date: formData.birth_date || '',
            gender: formData.gender || '',
            address: formData.address || '',
            city: formData.city || '',
            state: formData.state || '',
            postal_code: formData.postal_code || '',
            country: formData.country || 'Philippines',
            department_id: formData.department_id,
            position_id: formData.position_id,
            employee_type: formData.employee_type || 'regular',
            status: formData.status || 'active',
            hire_date: formData.hire_date,
            hourly_rate_override: formData.hourly_rate_override || '',
            bank_name: formData.bank_name || '',
            bank_account_number: formData.bank_account || '',
            allowances: formData.allowances || 0,
            other_deductions: formData.other_deductions || 0,
            sss_number: formData.sss || '',
            philhealth_number: formData.philhealth || '',
            pagibig_number: formData.pagibig || '',
            tin_number: formData.tin || '',
            emergency_contact_name: formData.emergency_contact || '',
            emergency_contact_relation: formData.emergency_relation || '',
            emergency_contact_phone: formData.emergency_phone || '',
            notes: formData.notes || '',
        };

        Object.keys(fieldMapping).forEach(key => {
            const value = fieldMapping[key];
            if (value !== null && value !== undefined && value !== '') {
                formDataToSend.append(key, value);
            }
        });

        if (formData.skills && formData.skills.trim()) {
            const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(s => s);
            formDataToSend.append('skills', JSON.stringify(skillsArray));
        } else {
            formDataToSend.append('skills', JSON.stringify([]));
        }

        if (formData.certifications && formData.certifications.trim()) {
            const certsArray = formData.certifications.split(',').map(s => s.trim()).filter(s => s);
            formDataToSend.append('certifications', JSON.stringify(certsArray));
        } else {
            formDataToSend.append('certifications', JSON.stringify([]));
        }

        if (formData.achievements && formData.achievements.trim()) {
            const achievementsArray = formData.achievements.split(',').map(s => s.trim()).filter(s => s);
            formDataToSend.append('achievements', JSON.stringify(achievementsArray));
        } else {
            formDataToSend.append('achievements', JSON.stringify([]));
        }

        try {
            await updateEmployeeMutation.mutateAsync({
                id: editingComplianceEmployee.id || editingComplianceEmployee.employee_id,
                data: formDataToSend
            });
            
            showNotificationMessage('Staff compliance information updated successfully.', 'success');
            
            setShowComplianceEditModal(false);
            setEditingComplianceEmployee(null);
            resetForm();
            
            await refetchEmployees();
            await refetchStats();
            await fetchComplianceData();
        } catch (err) {
            console.error('Compliance update error:', err);
            if (err.response?.data?.errors) {
                const errors = err.response.data.errors;
                const errorMessages = Object.keys(errors).map(field =>
                    `${field}: ${errors[field].join(', ')}`
                ).join('\n');
                showNotificationMessage(`Validation failed:\n${errorMessages}`, 'error');
            } else {
                showNotificationMessage('Failed to update compliance information. Please try again.', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchBenefitsData = () => {
        const benefitRecords = employees.map(emp => ({
            id: emp.id,
            name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
            health_insurance: emp.health_insurance_status || emp.health_insurance || 'Not Recorded',
            paid_leaves: emp.paid_leave_balance ?? emp.leave_balance ?? 'Not Recorded',
            thirteenth_month: emp.thirteenth_month_status || 'Not Recorded',
            overtime_pay: emp.overtime_rate ?? emp.position?.overtime_rate ?? 'Not Recorded'
        }));
        setBenefitsData(benefitRecords);
        setShowBenefitsModal(true);
    };

    const fetchReportsData = () => {
        const activeCount = employees.filter(e => e.status === 'active').length;
        const onLeaveCount = employees.filter(e => e.status === 'onleave').length;
        const inactiveCount = employees.filter(e => e.status === 'inactive').length;
        const terminatedCount = employees.filter(e => e.status === 'terminated').length;
        
        const departmentStats = departments.map(dept => ({
            name: dept.name,
            count: employees.filter(e => e.department_id === dept.id).length,
            active: employees.filter(e => e.department_id === dept.id && e.status === 'active').length
        }));

        setReportsData({
            summary: {
                total: employees.length,
                active: activeCount,
                onLeave: onLeaveCount,
                inactive: inactiveCount,
                terminated: terminatedCount,
                archived: archivedEmployees.length,
                departments: departments.length,
                positions: positions.length,
                salaryGrades: salaryGrades.length
            },
            departmentStats,
            generated_on: new Date().toLocaleString()
        });
        setShowReportsModal(true);
    };

    // Input handlers
    const handleInputChange = (e) => {
        const { name, value, type, files } = e.target;

        if (type === 'file') {
            const file = files[0];
            if (file) {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!allowedTypes.includes(file.type)) {
                    showNotificationMessage('Only JPG, PNG images are allowed', 'error');
                    return;
                }
                if (file.size > 2 * 1024 * 1024) {
                    showNotificationMessage('Image size must be less than 2MB', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => setImagePreview(reader.result);
                reader.readAsDataURL(file);
                setImageFile(file);
                setFormData(prev => ({ ...prev, [name]: file }));

                setUploadProgress(0);
                const interval = setInterval(() => {
                    setUploadProgress(prev => {
                        if (prev >= 100) {
                            clearInterval(interval);
                            return 100;
                        }
                        return prev + 10;
                    });
                }, 100);
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
            if (formErrors[name]) {
                setFormErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[name];
                    return newErrors;
                });
            }
        }
    };

    const handlePositionFormChange = (e) => {
        const { name, value } = e.target;
        setPositionFormData(prev => ({ ...prev, [name]: value }));
        if (positionFormErrors[name]) {
            setPositionFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleDepartmentFormChange = (e) => {
        const { name, value } = e.target;
        setDepartmentFormData(prev => ({ ...prev, [name]: value }));
        if (departmentFormErrors[name]) {
            setDepartmentFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleSalaryGradeFormChange = (e) => {
        const { name, value } = e.target;
        setSalaryGradeFormData(prev => ({ ...prev, [name]: value }));
        if (salaryGradeFormErrors[name]) {
            setSalaryGradeFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleNextStep = () => {
        if (formStep === 1) {
            if (validateStep1()) {
                setFormStep(prev => prev + 1);
            } else {
                showNotificationMessage('Please fill in all required fields in Personal Information', 'error');
            }
        } else if (formStep === 2) {
            if (validateStep2()) {
                setFormStep(prev => prev + 1);
            } else {
                showNotificationMessage('Please fill in all required fields in Employment Details', 'error');
            }
        } else {
            setFormStep(prev => prev + 1);
        }
    };

    const handlePrevStep = () => setFormStep(prev => prev - 1);

    // Print functions
    const handlePrintAll = () => {
        setShowPrintModal(false);
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showNotificationMessage('Please allow pop-ups to print', 'error');
            return;
        }

        const currentDateObj = new Date().toLocaleString();
        const companyName = "Catering Staff Management System";
        let tableRows = '';
        const employeesToPrint = filteredEmployees;

        employeesToPrint.forEach(emp => {
            const positionName = emp.position ? (typeof emp.position === 'object' ? (emp.position.title || emp.position.name || 'N/A') : emp.position) : 'N/A';
            const departmentName = emp.department ? (typeof emp.department === 'object' ? (emp.department.name || 'N/A') : emp.department) : 'N/A';
            const statusLabel = statusOptions.find(s => s.value === emp.status)?.label || emp.status || 'Active';
            const hourlyRate = emp.hourly_rate || emp.calculated_hourly_rate || 0;
            const salaryGrade = getEmployeeSalaryGrade(emp);

            tableRows += `
                <tr>
                    <td>${emp.employee_code || emp.id || 'N/A'}</td>
                    <td>${emp.first_name || ''} ${emp.last_name || ''}</td>
                    <td>${departmentName}</td>
                    <td>${positionName}</td>
                    <td>${salaryGrade}</td>
                    <td>${statusLabel}</td>
                    <td>₱${hourlyRate.toLocaleString()}/hr</td>
                    <td>${emp.email || 'N/A'}</td>
                    <td>${emp.phone || 'N/A'}</td>
                </tr>
            `;
        });

        const printHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Staff Directory Report</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', sans-serif; padding: 40px; background: white; }
                    .print-container { max-width: 1200px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
                    .header h1 { font-size: 24px; color: #1e3a8a; }
                    .report-info { display: flex; justify-content: space-between; margin-bottom: 24px; padding: 12px; background: #f3f4f6; border-radius: 8px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #1e3a8a; color: white; padding: 12px; text-align: left; }
                    td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
                    .footer { margin-top: 30px; padding-top: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="header">
                        <h1>${companyName}</h1>
                        <p>Staff Directory Report</p>
                    </div>
                    <div class="report-info">
                        <span>Generated: <strong>${currentDateObj}</strong></span>
                        <span>Total Staff: <strong>${employeesToPrint.length}</strong></span>
                        <span>Active: <strong>${employeesToPrint.filter(e => e.status === 'active').length}</strong></span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th><th>Name</th><th>Department</th><th>Position</th>
                                <th>Salary Grade</th><th>Status</th><th>Hourly Rate</th><th>Email</th><th>Phone</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Catering Staff Management System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const handlePrintProfile = (employee) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showNotificationMessage('Please allow pop-ups to print', 'error');
            return;
        }

        const currentDateObj = new Date().toLocaleString();
        const companyName = "Catering Staff Management System";
        const positionName = employee.position ? (typeof employee.position === 'object' ? (employee.position.title || employee.position.name || 'N/A') : employee.position) : 'N/A';
        const departmentName = employee.department ? (typeof employee.department === 'object' ? (employee.department.name || 'N/A') : employee.department) : 'N/A';
        const statusLabel = statusOptions.find(s => s.value === employee.status)?.label || employee.status || 'Active';
        const hourlyRate = employee.hourly_rate || employee.calculated_hourly_rate || 0;
        const salaryGrade = getEmployeeSalaryGrade(employee);

        const printHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Employee Profile - ${employee.first_name} ${employee.last_name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', sans-serif; padding: 40px; background: white; }
                    .print-container { max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
                    .header h1 { font-size: 24px; color: #1e3a8a; }
                    .profile-section { margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
                    .profile-section h3 { background: #f3f4f6; padding: 12px 16px; margin: 0; color: #1e3a8a; }
                    .profile-section .content { padding: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                    .profile-section .content .field { display: flex; }
                    .profile-section .content .field .label { font-weight: bold; width: 140px; color: #6b7280; }
                    .profile-section .content .field .value { flex: 1; }
                    .footer { margin-top: 30px; padding-top: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="header">
                        <h1>${companyName}</h1>
                        <p>Employee Profile</p>
                    </div>
                    <div class="profile-section">
                        <h3>Personal Information</h3>
                        <div class="content">
                            <div class="field"><span class="label">Full Name:</span><span class="value">${employee.first_name} ${employee.last_name}</span></div>
                            <div class="field"><span class="label">Employee ID:</span><span class="value">${employee.employee_code || employee.id}</span></div>
                            <div class="field"><span class="label">Email:</span><span class="value">${employee.email || 'N/A'}</span></div>
                            <div class="field"><span class="label">Phone:</span><span class="value">${employee.phone || 'N/A'}</span></div>
                            <div class="field"><span class="label">Birth Date:</span><span class="value">${employee.birth_date || 'N/A'}</span></div>
                            <div class="field"><span class="label">Gender:</span><span class="value">${employee.gender || 'N/A'}</span></div>
                            <div class="field"><span class="label">Address:</span><span class="value">${employee.address || 'N/A'}</span></div>
                        </div>
                    </div>
                    <div class="profile-section">
                        <h3>Employment Details</h3>
                        <div class="content">
                            <div class="field"><span class="label">Department:</span><span class="value">${departmentName}</span></div>
                            <div class="field"><span class="label">Position:</span><span class="value">${positionName}</span></div>
                            <div class="field"><span class="label">Salary Grade:</span><span class="value">${salaryGrade}</span></div>
                            <div class="field"><span class="label">Hourly Rate:</span><span class="value">₱${hourlyRate.toLocaleString()}/hr</span></div>
                            <div class="field"><span class="label">Employee Type:</span><span class="value">${employee.employee_type || 'Regular'}</span></div>
                            <div class="field"><span class="label">Status:</span><span class="value">${statusLabel}</span></div>
                            <div class="field"><span class="label">Hire Date:</span><span class="value">${employee.hire_date || 'N/A'}</span></div>
                        </div>
                    </div>
                    <div class="profile-section">
                        <h3>Government IDs</h3>
                        <div class="content">
                            <div class="field"><span class="label">SSS:</span><span class="value">${employee.sss_number || employee.sss || 'N/A'}</span></div>
                            <div class="field"><span class="label">PhilHealth:</span><span class="value">${employee.philhealth_number || employee.philhealth || 'N/A'}</span></div>
                            <div class="field"><span class="label">Pag-IBIG:</span><span class="value">${employee.pagibig_number || employee.pagibig || 'N/A'}</span></div>
                            <div class="field"><span class="label">TIN:</span><span class="value">${employee.tin_number || employee.tin || 'N/A'}</span></div>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Report generated on ${currentDateObj}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setShowSortMenu(false);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setShowFullscreen(true);
        } else {
            document.exitFullscreen();
            setShowFullscreen(false);
        }
    };

    // Filter and sort employees
    const filteredEmployees = useMemo(() => {
        return employees;
    }, [employees]);

    const sortedEmployees = useMemo(() => {
        if (sortConfig.key && filteredEmployees.length > 0) {
            return [...filteredEmployees].sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'name') {
                    aValue = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
                    bValue = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
                } else if (sortConfig.key === 'department') {
                    aValue = a.department?.name || '';
                    bValue = b.department?.name || '';
                } else if (sortConfig.key === 'position') {
                    aValue = a.position?.title || '';
                    bValue = b.position?.title || '';
                } else if (sortConfig.key === 'salary_grade') {
                    aValue = getEmployeeSalaryGrade(a);
                    bValue = getEmployeeSalaryGrade(b);
                } else if (sortConfig.key === 'status') {
                    aValue = a.status || '';
                    bValue = b.status || '';
                } else if (sortConfig.key === 'hourly_rate') {
                    aValue = a.hourly_rate || a.calculated_hourly_rate || 0;
                    bValue = b.hourly_rate || b.calculated_hourly_rate || 0;
                } else {
                    aValue = a[sortConfig.key] || '';
                    bValue = b[sortConfig.key] || '';
                }
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filteredEmployees;
    }, [filteredEmployees, sortConfig, getEmployeeSalaryGrade]);

    const paginatedEmployees = sortedEmployees;
    const totalPages = pagination?.last_page || Math.ceil(filteredEmployees.length / pageSize);

    const getRowNumber = (index) => {
        return ((pagination?.current_page || currentPage) - 1) * pageSize + index + 1;
    };

    const goToPage = (page) => {
        setCurrentPage(page);
        setSelectedEmployees([]);
    };

    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            setSelectedEmployees([]);
        }
    };

    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            setSelectedEmployees([]);
        }
    };

    // Statistics
    const statistics = [
        { label: 'Total Staff', value: stats?.total || employees.length, icon: <TeamOutlined />, change: `${stats?.by_employee_type?.find(t => t.employee_type === 'regular')?.total || 0} regular` },
        { label: 'Active', value: stats?.active || employees.filter(e => e?.status === 'active').length, icon: <CheckCircleOutlined />, change: 'On Duty' },
        { label: 'On Leave', value: stats?.onleave || employees.filter(e => e?.status === 'onleave').length, icon: <ClockCircleOutlined />, change: 'This week' },
        { label: 'Inactive', value: stats?.inactive || 0, icon: <PauseCircleOutlined />, change: 'Archived' },
        { label: 'Archived', value: archivedEmployees.length, icon: <InboxOutlined />, change: 'Soft deleted' },
    ];

    const quickActions = [
        { icon: <DollarOutlined />, label: 'Salary Grades', action: handleAddSalaryGrade },
        { icon: <SafetyOutlined />, label: 'Compliance', action: fetchComplianceData },
        { icon: <HeartOutlined />, label: 'Benefits', action: fetchBenefitsData },
        { icon: <FileTextOutlined />, label: 'Reports', action: fetchReportsData },
        { icon: <BuildOutlined />, label: 'Positions', action: handleAddPosition },
        { icon: <BankOutlined />, label: 'Departments', action: handleAddDepartment },
        { icon: <HistoryOutlined />, label: 'Archive', action: () => setShowArchive(!showArchive) },
        { icon: <PrinterOutlined />, label: 'Print All', action: () => setShowPrintModal(true) },
        { icon: isSelectMode ? <CloseOutlined /> : <CheckSquareOutlined />, label: isSelectMode ? 'Cancel Select' : 'Select Mode', action: toggleSelectMode }
    ];

    // Set current date
    useEffect(() => {
        const date = new Date();
        setCurrentDate(date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    }, []);

    // ==================== MODAL RENDER FUNCTIONS ====================

    // Status Controls Component
    const StatusControls = ({ employee }) => (
        <div className="catering-status-controls">
            <h3><ClockCircleOutlined /> Staff Status</h3>
            <div className="catering-status-buttons">
                <button
                    className={`catering-status-btn ${employee.status === 'active' ? 'active' : ''}`}
                    onClick={() => handleUpdateStatus(employee.id || employee.employee_id, 'active')}
                >
                    <CheckCircleOutlined /> Active
                </button>
                <button
                    className={`catering-status-btn ${employee.status === 'onleave' ? 'onleave' : ''}`}
                    onClick={() => handleUpdateStatus(employee.id || employee.employee_id, 'onleave')}
                >
                    <PauseCircleOutlined /> On Leave
                </button>
                <button
                    className={`catering-status-btn ${employee.status === 'inactive' ? 'inactive' : ''}`}
                    onClick={() => handleUpdateStatus(employee.id || employee.employee_id, 'inactive')}
                >
                    <InboxOutlined /> Inactive
                </button>
                <button
                    className={`catering-status-btn ${employee.status === 'terminated' ? 'terminated' : ''}`}
                    onClick={() => handleUpdateStatus(employee.id || employee.employee_id, 'terminated')}
                >
                    <WarningOutlined /> Terminated
                </button>
            </div>
            <p className="catering-status-note">
                Current Status: <strong>
                    {statusOptions.find(s => s.value === employee.status)?.label || employee.status || 'Active'}
                </strong>
            </p>
        </div>
    );

    // Notification Component
    const Notification = () => (
        <div className={`catering-notification ${notificationType}`}>
            <div className="catering-notification-icon">
                {notificationType === 'success' && <CheckCircleOutlined />}
                {notificationType === 'error' && <WarningOutlined />}
                {notificationType === 'info' && <ExclamationCircleOutlined />}
            </div>
            <div className="catering-notification-message">{notificationMessage}</div>
            <button className="catering-notification-close" onClick={() => setShowNotification(false)}><CloseOutlined /></button>
        </div>
    );

    // ==================== COMPLIANCE MODAL (ENHANCED) ====================
   // ==================== COMPLIANCE MODAL (FIXED - STICKY HEADER & STICKY LEGEND) ====================
const renderComplianceModal = () => (
    <div 
        className="catering-modal-overlay" 
        onClick={(e) => e.stopPropagation()}
    >
        <div 
            className="catering-modal catering-compliance-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
                maxHeight: '90vh',
                maxWidth: '95vw',
                width: '1400px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff'
            }}
        >
            <div className="catering-modal-header" style={{ flexShrink: 0 }}>
                <h2 style={{ color: '#000000' }}><SafetyOutlined /> Staff Compliance Overview</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#000000' }}>
                        Total: <strong>{filteredComplianceData.length}</strong> employees
                    </span>
                    {isLoadingCompliance && <LoadingOutlined spin style={{ color: '#2563eb' }} />}
                    <button 
                        className="catering-modal-close" 
                        onClick={() => {
                            setShowComplianceModal(false);
                            setComplianceSearchQuery('');
                            setComplianceFilterStatus('all');
                            setComplianceFilterDepartment('all');
                        }}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
            </div>
            
            {/* Fixed Header Area - Search, Filters, Summary */}
            <div style={{ 
                flexShrink: 0,
                padding: '16px 24px 0 24px',
                backgroundColor: '#ffffff',
                zIndex: 10,
                borderBottom: '1px solid #e5e7eb'
            }}>
                {/* Search and Filter Bar */}
                <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                    alignItems: 'center',
                    padding: '16px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                }}>
                    <AntSearch
                        placeholder="Search by name, ID, SSS, PhilHealth, Pag-IBIG, TIN..."
                        allowClear
                        value={complianceSearchQuery}
                        onChange={(e) => setComplianceSearchQuery(e.target.value)}
                        style={{ flex: 1, minWidth: '200px' }}
                        prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
                    />
                    
                    <Select
                        placeholder="Filter by Status"
                        value={complianceFilterStatus}
                        onChange={(value) => setComplianceFilterStatus(value)}
                        style={{ minWidth: '150px' }}
                        allowClear
                    >
                        <Option value="all">All Status</Option>
                        <Option value="Compliant">Compliant</Option>
                        <Option value="Missing Documents">Missing Documents</Option>
                    </Select>
                    
                    <Select
                        placeholder="Filter by Department"
                        value={complianceFilterDepartment}
                        onChange={(value) => setComplianceFilterDepartment(value)}
                        style={{ minWidth: '150px' }}
                        allowClear
                    >
                        <Option value="all">All Departments</Option>
                        {departments.map(dept => (
                            <Option key={dept.id} value={String(dept.id)}>{dept.name}</Option>
                        ))}
                    </Select>
                    
                    <Button 
                        type="primary" 
                        icon={<PrinterOutlined />}
                        onClick={handlePrintCompliance}
                        style={{ marginLeft: 'auto' }}
                    >
                        Print
                    </Button>
                </div>

                {/* Summary Cards */}
                <div className="catering-compliance-summary" style={{ marginBottom: '16px' }}>
                    <div className="catering-compliance-stat" style={{ color: '#000000' }}>
                        <span style={{ color: '#000000' }}><CheckCircleOutlined /> Compliant</span>
                        <strong style={{ color: '#000000' }}>{filteredComplianceData.filter(c => c.status === 'Compliant').length}</strong>
                    </div>
                    <div className="catering-compliance-stat warning" style={{ color: '#000000' }}>
                        <span style={{ color: '#000000' }}><WarningOutlined /> Missing Documents</span>
                        <strong style={{ color: '#000000' }}>{filteredComplianceData.filter(c => c.status === 'Missing Documents').length}</strong>
                    </div>
                    <div className="catering-compliance-stat total" style={{ color: '#000000' }}>
                        <span style={{ color: '#000000' }}><TeamOutlined /> Total Employees</span>
                        <strong style={{ color: '#000000' }}>{filteredComplianceData.length}</strong>
                    </div>
                </div>
            </div>

            {/* Scrollable Table Area - WITH STICKY HEADER AND STICKY LEGEND */}
            <div 
                className="catering-modal-body"
                style={{
                    overflowY: 'auto',
                    overflowX: 'auto',
                    flex: '1 1 auto',
                    padding: '0',
                    maxHeight: 'calc(90vh - 280px)',
                    position: 'relative'
                }}
            >
                {isLoadingCompliance ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <LoadingOutlined spin style={{ fontSize: '32px', color: '#2563eb' }} />
                        <p style={{ marginTop: '12px', color: '#000000' }}>Loading compliance data...</p>
                    </div>
                ) : filteredComplianceData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <SafetyOutlined style={{ fontSize: '48px', color: '#9ca3af' }} />
                        <p style={{ marginTop: '12px', color: '#000000' }}>No employee records found matching the filters</p>
                    </div>
                ) : (
                    <div 
                        className="catering-compliance-table-container"
                        style={{
                            width: '100%',
                            position: 'relative',
                            padding: '0 24px',
                            paddingBottom: '0'
                        }}
                    >
                        <table 
                            className="catering-compliance-table"
                            style={{
                                width: '100%',
                                minWidth: '1000px',
                                tableLayout: 'fixed',
                                borderCollapse: 'separate',
                                borderSpacing: '0'
                            }}
                        >
                            <colgroup>
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '5%' }} />
                            </colgroup>
                            
                            {/* STICKY HEADER - Stays at top when scrolling */}
                            <thead style={{ 
                                position: 'sticky', 
                                top: 0, 
                                zIndex: 100,
                                backgroundColor: '#f8fafc'
                            }}>
                                <tr>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Employee
                                    </th>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        ID
                                    </th>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        SSS
                                    </th>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        PhilHealth
                                    </th>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Pag-IBIG
                                    </th>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        TIN
                                    </th>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Status
                                    </th>
                                    <th style={{ 
                                        textAlign: 'left', 
                                        padding: '12px 12px', 
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Last Updated
                                    </th>
                                    <th style={{ 
                                        textAlign: 'center', 
                                        padding: '12px 12px', 
                                        width: '60px',
                                        color: '#000000',
                                        backgroundColor: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            
                            {/* SCROLLABLE TABLE BODY */}
                            <tbody>
                                {filteredComplianceData.map((emp, index) => (
                                    <tr key={emp.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                                        <td style={{ 
                                            wordWrap: 'break-word', 
                                            wordBreak: 'break-word',
                                            padding: '10px 12px',
                                            fontSize: '13px',
                                            color: '#000000',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            <strong style={{ color: '#000000' }}>{emp.name}</strong>
                                        </td>
                                        <td style={{ 
                                            wordWrap: 'break-word', 
                                            wordBreak: 'break-word',
                                            padding: '10px 12px',
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            color: '#000000',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            {emp.employee_code}
                                        </td>
                                        <td style={{ 
                                            wordWrap: 'break-word', 
                                            wordBreak: 'break-word',
                                            padding: '10px 12px',
                                            fontSize: '12px',
                                            color: emp.sss === 'Not Provided' ? '#dc2626' : '#000000',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            {emp.sss === 'Not Provided' ? 'Not Provided' : emp.sss}
                                        </td>
                                        <td style={{ 
                                            wordWrap: 'break-word', 
                                            wordBreak: 'break-word',
                                            padding: '10px 12px',
                                            fontSize: '12px',
                                            color: emp.philhealth === 'Not Provided' ? '#dc2626' : '#000000',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            {emp.philhealth === 'Not Provided' ? 'Not Provided' : emp.philhealth}
                                        </td>
                                        <td style={{ 
                                            wordWrap: 'break-word', 
                                            wordBreak: 'break-word',
                                            padding: '10px 12px',
                                            fontSize: '12px',
                                            color: emp.pagibig === 'Not Provided' ? '#dc2626' : '#000000',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            {emp.pagibig === 'Not Provided' ? 'Not Provided' : emp.pagibig}
                                        </td>
                                        <td style={{ 
                                            wordWrap: 'break-word', 
                                            wordBreak: 'break-word',
                                            padding: '10px 12px',
                                            fontSize: '12px',
                                            color: emp.tin === 'Not Provided' ? '#dc2626' : '#000000',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            {emp.tin === 'Not Provided' ? 'Not Provided' : emp.tin}
                                        </td>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ 
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                color: emp.status === 'Compliant' ? '#065f46' : '#991b1b',
                                                background: emp.status === 'Compliant' ? '#d1fae5' : '#fee2e2'
                                            }}>
                                                {emp.status === 'Compliant' ? 'Compliant' : 'Missing'}
                                            </span>
                                        </td>
                                        <td style={{ 
                                            fontSize: '11px', 
                                            whiteSpace: 'nowrap',
                                            padding: '10px 12px',
                                            color: '#000000',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            {emp.last_updated}
                                        </td>
                                        <td style={{ 
                                            textAlign: 'center',
                                            padding: '10px 12px',
                                            borderBottom: '1px solid #f1f5f9'
                                        }}>
                                            <Tooltip title="Edit">
                                                <button 
                                                    className="catering-action-btn edit" 
                                                    onClick={() => handleEditCompliance(emp)}
                                                    aria-label="Edit"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: '#f3f4f6',
                                                        color: '#6b7280',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = '#dbeafe';
                                                        e.currentTarget.style.color = '#2563eb';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = '#f3f4f6';
                                                        e.currentTarget.style.color = '#6b7280';
                                                    }}
                                                >
                                                    <EditOutlined />
                                                </button>
                                            </Tooltip>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* STICKY LEGEND - Stays at bottom when scrolling */}
                        <div style={{ 
                            position: 'sticky', 
                            bottom: 0, 
                            zIndex: 100,
                            backgroundColor: '#ffffff',
                            padding: '16px 0 12px 0',
                            borderTop: '1px solid #e5e7eb',
                            marginTop: '0'
                        }}>
                            <div className="catering-compliance-legend">
                                <h4 style={{ fontSize: '13px', marginBottom: '8px', color: '#000000' }}>Legend:</h4>
                                <div className="catering-legend-items" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                                    <span className="catering-legend-item" style={{ fontSize: '12px', color: '#000000' }}>
                                        <span className="catering-legend-color compliant" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', marginRight: '6px' }}></span> 
                                        Compliant - All IDs provided
                                    </span>
                                    <span className="catering-legend-item" style={{ fontSize: '12px', color: '#000000' }}>
                                        <span className="catering-legend-color missing" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span> 
                                        Missing - One or more IDs missing
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="catering-modal-footer" style={{ flexShrink: 0 }}>
                <button 
                    className="catering-btn" 
                    onClick={() => {
                        setShowComplianceModal(false);
                        setComplianceSearchQuery('');
                        setComplianceFilterStatus('all');
                        setComplianceFilterDepartment('all');
                    }}
                >
                    Close
                </button>
                <button 
                    className="catering-btn catering-btn-primary" 
                    onClick={() => { 
                        showNotificationMessage('Compliance report exported successfully', 'success'); 
                    }}
                >
                    <FileTextOutlined /> Export Report
                </button>
            </div>
        </div>
    </div>
);

    // ==================== COMPLIANCE EDIT MODAL ====================
    const renderComplianceEditModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div 
                className="catering-modal catering-medium-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}><EditOutlined /> Edit Compliance Information</h2>
                    <button 
                        className="catering-modal-close" 
                        onClick={() => {
                            setShowComplianceEditModal(false);
                            setEditingComplianceEmployee(null);
                            resetForm();
                        }}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    <div className="catering-form">
                        <div className="catering-form-section">
                            <h3 style={{ color: '#000000' }}><UserOutlined /> Personal Information</h3>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>First Name *</label>
                                    <input 
                                        type="text" 
                                        name="first_name" 
                                        className="catering-form-input" 
                                        value={formData.first_name} 
                                        onChange={handleInputChange} 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Last Name *</label>
                                    <input 
                                        type="text" 
                                        name="last_name" 
                                        className="catering-form-input" 
                                        value={formData.last_name} 
                                        onChange={handleInputChange} 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                            </div>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Email *</label>
                                    <input 
                                        type="email" 
                                        name="email" 
                                        className="catering-form-input" 
                                        value={formData.email} 
                                        onChange={handleInputChange} 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Phone *</label>
                                    <input 
                                        type="tel" 
                                        name="phone" 
                                        className="catering-form-input" 
                                        value={formData.phone} 
                                        onChange={handleInputChange} 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="catering-form-section">
                            <h3 style={{ color: '#000000' }}><SafetyOutlined /> Government IDs</h3>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>SSS Number</label>
                                    <input 
                                        type="text" 
                                        name="sss" 
                                        className="catering-form-input" 
                                        value={formData.sss} 
                                        onChange={handleInputChange} 
                                        placeholder="XX-XXXXXXX-X" 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>PhilHealth</label>
                                    <input 
                                        type="text" 
                                        name="philhealth" 
                                        className="catering-form-input" 
                                        value={formData.philhealth} 
                                        onChange={handleInputChange} 
                                        placeholder="XX-XXXXXXXXX-X" 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                            </div>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Pag-IBIG</label>
                                    <input 
                                        type="text" 
                                        name="pagibig" 
                                        className="catering-form-input" 
                                        value={formData.pagibig} 
                                        onChange={handleInputChange} 
                                        placeholder="XXXX-XXXX-XXXX" 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>TIN</label>
                                    <input 
                                        type="text" 
                                        name="tin" 
                                        className="catering-form-input" 
                                        value={formData.tin} 
                                        onChange={handleInputChange} 
                                        placeholder="XXX-XXX-XXX-XXX" 
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="catering-form-section">
                            <h3 style={{ color: '#000000' }}><BankOutlined /> Employment Details</h3>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Department *</label>
                                    <select 
                                        name="department_id" 
                                        className="catering-form-select" 
                                        value={formData.department_id} 
                                        onChange={handleInputChange}
                                        style={{ color: '#000000' }}
                                    >
                                        <option value="">Select department</option>
                                        {departments.map(dept => (
                                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Position *</label>
                                    <select 
                                        name="position_id" 
                                        className="catering-form-select" 
                                        value={formData.position_id} 
                                        onChange={handleInputChange}
                                        style={{ color: '#000000' }}
                                    >
                                        <option value="">Select position</option>
                                        {(filteredPositions.length > 0 ? filteredPositions : positions).map(pos => {
                                            let titleString = '';
                                            if (typeof pos.title === 'string') titleString = pos.title;
                                            else if (pos.title && typeof pos.title === 'object') titleString = pos.title.title || pos.title.name || `Position ${pos.id}`;
                                            else if (typeof pos.name === 'string') titleString = pos.name;
                                            else titleString = `Position ${pos.id}`;
                                            return (
                                                <option key={pos.id} value={pos.id}>{titleString}</option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="catering-modal-footer">
                    <button 
                        className="catering-btn" 
                        onClick={() => {
                            setShowComplianceEditModal(false);
                            setEditingComplianceEmployee(null);
                            resetForm();
                        }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button 
                        className="catering-btn catering-btn-primary" 
                        onClick={handleSaveComplianceEdit} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <LoadingOutlined spin /> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );

    // ==================== BENEFITS MODAL (ENHANCED) ====================
    const renderBenefitsModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div 
                className="catering-modal catering-large-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    maxWidth: '95vw',
                    width: '1000px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}><HeartOutlined /> Employee Benefits Summary</h2>
                    <button 
                        className="catering-modal-close" 
                        onClick={() => setShowBenefitsModal(false)}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    <div className="catering-benefits-summary">
                        <div className="catering-benefits-card" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>Health Insurance</h4>
                            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>{benefitsData.filter(b => b.health_insurance === 'Enrolled').length}</strong> enrolled</p>
                            <small style={{ color: '#000000' }}>{benefitsData.filter(b => b.health_insurance === 'Not Eligible').length} not eligible</small>
                        </div>
                        <div className="catering-benefits-card" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>Paid Leaves</h4>
                            <p style={{ color: '#000000' }}>15 days/year for regular employees</p>
                        </div>
                        <div className="catering-benefits-card" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>13th Month Pay</h4>
                            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>{benefitsData.filter(b => b.thirteenth_month === 'Eligible').length}</strong> eligible</p>
                        </div>
                    </div>
                    <div 
                        className="catering-benefits-table-container"
                        style={{
                            overflowX: 'auto',
                            overflowY: 'visible',
                            marginTop: '16px',
                            width: '100%'
                        }}
                    >
                        <table 
                            className="catering-benefits-table"
                            style={{
                                width: '100%',
                                minWidth: '600px',
                                tableLayout: 'fixed',
                                borderCollapse: 'collapse'
                            }}
                        >
                            <colgroup>
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th style={{ color: '#000000' }}>Employee</th>
                                    <th style={{ color: '#000000' }}>Health Insurance</th>
                                    <th style={{ color: '#000000' }}>Paid Leaves</th>
                                    <th style={{ color: '#000000' }}>13th Month</th>
                                    <th style={{ color: '#000000' }}>Overtime Pay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {benefitsData.map(emp => (
                                    <tr key={emp.id}>
                                        <td style={{ wordWrap: 'break-word', wordBreak: 'break-word', color: '#000000' }}>
                                            <strong style={{ color: '#000000' }}>{emp.name}</strong>
                                        </td>
                                        <td style={{ color: '#000000' }}>
                                            <span className={`benefit-status ${emp.health_insurance === 'Enrolled' ? 'enrolled' : 'not-eligible'}`} style={{ color: '#000000' }}>
                                                {emp.health_insurance}
                                            </span>
                                        </td>
                                        <td style={{ wordWrap: 'break-word', wordBreak: 'break-word', color: '#000000' }}>{emp.paid_leaves}</td>
                                        <td style={{ color: '#000000' }}>
                                            <span className={`benefit-status ${emp.thirteenth_month === 'Eligible' ? 'eligible' : 'not-eligible'}`} style={{ color: '#000000' }}>
                                                {emp.thirteenth_month}
                                            </span>
                                        </td>
                                        <td style={{ wordWrap: 'break-word', wordBreak: 'break-word', color: '#000000' }}>{emp.overtime_pay}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="catering-modal-footer">
                    <button 
                        className="catering-btn" 
                        onClick={() => setShowBenefitsModal(false)}
                    >
                        Close
                    </button>
                    <button 
                        className="catering-btn catering-btn-primary" 
                        onClick={() => { 
                            setShowBenefitsModal(false); 
                            showNotificationMessage('Benefits summary exported', 'success'); 
                        }}
                    >
                        Export Summary
                    </button>
                </div>
            </div>
        </div>
    );

    // ==================== REPORTS MODAL (ENHANCED) ====================
    const renderReportsModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div 
                className="catering-modal catering-large-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    maxWidth: '95vw',
                    width: '1000px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}><BarChartOutlined /> Staff Reports Dashboard</h2>
                    <button 
                        className="catering-modal-close" 
                        onClick={() => setShowReportsModal(false)}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    <div className="catering-reports-summary">
                        <div className="catering-report-card" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>Total Staff</h4>
                            <p className="report-number" style={{ color: '#000000' }}>{reportsData.summary?.total || 0}</p>
                        </div>
                        <div className="catering-report-card success" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>Active Staff</h4>
                            <p className="report-number" style={{ color: '#000000' }}>{reportsData.summary?.active || 0}</p>
                        </div>
                        <div className="catering-report-card warning" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>On Leave</h4>
                            <p className="report-number" style={{ color: '#000000' }}>{reportsData.summary?.onLeave || 0}</p>
                        </div>
                        <div className="catering-report-card info" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>Inactive</h4>
                            <p className="report-number" style={{ color: '#000000' }}>{reportsData.summary?.inactive || 0}</p>
                        </div>
                        <div className="catering-report-card danger" style={{ color: '#000000' }}>
                            <h4 style={{ color: '#000000' }}>Terminated</h4>
                            <p className="report-number" style={{ color: '#000000' }}>{reportsData.summary?.terminated || 0}</p>
                        </div>
                    </div>
                    <div className="catering-reports-details">
                        <div className="catering-reports-section">
                            <h4 style={{ color: '#000000' }}>Departments Overview</h4>
                            <div 
                                className="catering-report-table-container"
                                style={{
                                    overflowX: 'auto',
                                    overflowY: 'visible',
                                    width: '100%'
                                }}
                            >
                                <table 
                                    className="catering-report-table"
                                    style={{
                                        width: '100%',
                                        minWidth: '400px',
                                        tableLayout: 'fixed',
                                        borderCollapse: 'collapse'
                                    }}
                                >
                                    <colgroup>
                                        <col style={{ width: '40%' }} />
                                        <col style={{ width: '20%' }} />
                                        <col style={{ width: '20%' }} />
                                        <col style={{ width: '20%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ color: '#000000' }}>Department</th>
                                            <th style={{ color: '#000000' }}>Total Staff</th>
                                            <th style={{ color: '#000000' }}>Active</th>
                                            <th style={{ color: '#000000' }}>Utilization</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportsData.departmentStats?.map((dept, i) => (
                                            <tr key={i}>
                                                <td style={{ wordWrap: 'break-word', wordBreak: 'break-word', color: '#000000' }}>{dept.name}</td>
                                                <td style={{ color: '#000000' }}>{dept.count}</td>
                                                <td style={{ color: '#000000' }}>{dept.active}</td>
                                                <td style={{ color: '#000000' }}>
                                                    <div className="progress-bar">
                                                        <div 
                                                            className="progress-fill" 
                                                            style={{ 
                                                                width: `${dept.count ? (dept.active / dept.count) * 100 : 0}%`,
                                                                minWidth: dept.active > 0 ? '4px' : '0'
                                                            }} 
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="catering-reports-section">
                            <h4 style={{ color: '#000000' }}>Organization Summary</h4>
                            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Departments:</strong> {reportsData.summary?.departments || 0}</p>
                            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Positions:</strong> {reportsData.summary?.positions || 0}</p>
                            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Salary Grades:</strong> {reportsData.summary?.salaryGrades || 0}</p>
                            <p style={{ color: '#000000' }}><strong style={{ color: '#000000' }}>Report Generated:</strong> {reportsData.generated_on}</p>
                        </div>
                    </div>
                </div>
                <div className="catering-modal-footer">
                    <button 
                        className="catering-btn" 
                        onClick={() => setShowReportsModal(false)}
                    >
                        Close
                    </button>
                    <button 
                        className="catering-btn catering-btn-primary" 
                        onClick={() => { 
                            setShowReportsModal(false); 
                            showNotificationMessage('Report exported', 'success'); 
                        }}
                    >
                        Export Report
                    </button>
                </div>
            </div>
        </div>
    );

    // ==================== SALARY GRADE MODAL ====================
    const renderSalaryGradeModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div 
                className="catering-modal catering-medium-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}>{salaryGradeFormMode === 'add' ? 'Add New Salary Grade' : 'Edit Salary Grade'}</h2>
                    <button 
                        className="catering-modal-close" 
                        onClick={() => setShowSalaryGradeModal(false)}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    <form className="catering-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="catering-form-section">
                            <h3 style={{ color: '#000000' }}><DollarOutlined /> Salary Grade Details</h3>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Grade Name *</label>
                                    <input
                                        type="text"
                                        name="grade_name"
                                        className={`catering-form-input ${salaryGradeFormErrors.grade_name ? 'error' : ''}`}
                                        value={salaryGradeFormData.grade_name}
                                        onChange={handleSalaryGradeFormChange}
                                        placeholder="e.g., A, B, C, or Grade 1, Grade 2"
                                        style={{ color: '#000000' }}
                                    />
                                    {salaryGradeFormErrors.grade_name && <span className="catering-form-error" style={{ color: '#000000' }}>{salaryGradeFormErrors.grade_name}</span>}
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Hourly Rate (₱) *</label>
                                    <input
                                        type="number"
                                        name="hourly_rate"
                                        className={`catering-form-input ${salaryGradeFormErrors.hourly_rate ? 'error' : ''}`}
                                        value={salaryGradeFormData.hourly_rate}
                                        onChange={handleSalaryGradeFormChange}
                                        min="0"
                                        step="10"
                                        placeholder="e.g., 125.00"
                                        style={{ color: '#000000' }}
                                    />
                                    {salaryGradeFormErrors.hourly_rate && <span className="catering-form-error" style={{ color: '#000000' }}>{salaryGradeFormErrors.hourly_rate}</span>}
                                </div>
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Description</label>
                                <textarea
                                    name="description"
                                    className="catering-form-textarea"
                                    value={salaryGradeFormData.description}
                                    onChange={handleSalaryGradeFormChange}
                                    rows="3"
                                    placeholder="Optional description of this salary grade"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Status</label>
                                <select name="status" className="catering-form-select" value={salaryGradeFormData.status} onChange={handleSalaryGradeFormChange} style={{ color: '#000000' }}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {salaryGrades.length > 0 && (
                            <div className="catering-form-section">
                                <h3 style={{ color: '#000000' }}><DollarOutlined /> Existing Salary Grades</h3>
                                <div className="catering-salary-grades-list">
                                    {salaryGrades.map(grade => (
                                        <div key={grade.id} className="catering-salary-grade-item">
                                            <div className="catering-salary-grade-info">
                                                <h4 style={{ color: '#000000' }}>Grade {grade.grade_name}</h4>
                                                <p style={{ color: '#000000' }}>₱{(grade.hourly_rate || 0).toLocaleString()}/hour</p>
                                                <small style={{ color: '#000000' }}>Monthly: ₱{((grade.hourly_rate || 0) * 160).toLocaleString()}</small>
                                                <small className={grade.status === 'active' ? 'status-active' : 'status-inactive'} style={{ color: '#000000' }}>{grade.status}</small>
                                            </div>
                                            <div className="catering-salary-grade-actions">
                                                <Tooltip title="Edit">
                                                    <button className="catering-action-btn edit" onClick={() => handleEditSalaryGrade(grade)} aria-label="Edit">
                                                        <EditOutlined />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <button className="catering-action-btn delete" onClick={() => deleteSalaryGrade(grade.id)} aria-label="Delete">
                                                        <DeleteOutlined />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
                </div>
                <div className="catering-modal-footer">
                    <button 
                        className="catering-btn" 
                        onClick={() => setShowSalaryGradeModal(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button 
                        className="catering-btn catering-btn-primary" 
                        onClick={handleSaveSalaryGrade} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <LoadingOutlined spin /> : (salaryGradeFormMode === 'add' ? 'Add Salary Grade' : 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>
    );

    // ==================== POSITION MODAL ====================
    const renderPositionModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div 
                className="catering-modal catering-medium-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}>{positionFormMode === 'add' ? 'Add New Position' : 'Edit Position'}</h2>
                    <button 
                        className="catering-modal-close" 
                        onClick={() => setShowPositionModal(false)}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    <form className="catering-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="catering-form-section">
                            <h3 style={{ color: '#000000' }}><BuildOutlined /> Position Details</h3>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Position Title *</label>
                                    <input
                                        type="text"
                                        name="title"
                                        className={`catering-form-input ${positionFormErrors.title ? 'error' : ''}`}
                                        value={positionFormData.title}
                                        onChange={handlePositionFormChange}
                                        style={{ color: '#000000' }}
                                    />
                                    {positionFormErrors.title && <span className="catering-form-error" style={{ color: '#000000' }}>{positionFormErrors.title}</span>}
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Department *</label>
                                    <select
                                        name="department_id"
                                        className={`catering-form-select ${positionFormErrors.department_id ? 'error' : ''}`}
                                        value={positionFormData.department_id}
                                        onChange={handlePositionFormChange}
                                        style={{ color: '#000000' }}
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                    </select>
                                    {positionFormErrors.department_id && <span className="catering-form-error" style={{ color: '#000000' }}>{positionFormErrors.department_id}</span>}
                                </div>
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Salary Grade *</label>
                                <select
                                    name="salary_grade_id"
                                    className={`catering-form-select ${positionFormErrors.salary_grade_id ? 'error' : ''}`}
                                    value={positionFormData.salary_grade_id}
                                    onChange={handlePositionFormChange}
                                    style={{ color: '#000000' }}
                                >
                                    <option value="">Select Salary Grade</option>
                                    {salaryGrades.filter(g => g.status === 'active').map(grade => (
                                        <option key={grade.id} value={grade.id}>
                                            Grade {grade.grade_name} - ₱{(grade.hourly_rate || 0).toLocaleString()}/hour
                                        </option>
                                    ))}
                                </select>
                                {positionFormErrors.salary_grade_id && <span className="catering-form-error" style={{ color: '#000000' }}>{positionFormErrors.salary_grade_id}</span>}
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Description</label>
                                <textarea
                                    name="description"
                                    className="catering-form-textarea"
                                    value={positionFormData.description}
                                    onChange={handlePositionFormChange}
                                    rows="3"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Employment Type</label>
                                    <select
                                        name="employment_type"
                                        className="catering-form-select"
                                        value={positionFormData.employment_type}
                                        onChange={handlePositionFormChange}
                                        style={{ color: '#000000' }}
                                    >
                                        {positionEmploymentTypes.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Max Hours/Week</label>
                                    <input
                                        type="number"
                                        name="max_hours_per_week"
                                        className="catering-form-input"
                                        value={positionFormData.max_hours_per_week}
                                        onChange={handlePositionFormChange}
                                        min="1"
                                        max="168"
                                        style={{ color: '#000000' }}
                                    />
                                </div>
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Required Skills (comma separated)</label>
                                <input
                                    type="text"
                                    name="required_skills"
                                    className="catering-form-input"
                                    value={positionFormData.required_skills}
                                    onChange={handlePositionFormChange}
                                    placeholder="e.g., Leadership, Communication, Project Management"
                                    style={{ color: '#000000' }}
                                />
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Status</label>
                                <select
                                    name="status"
                                    className="catering-form-select"
                                    value={positionFormData.status}
                                    onChange={handlePositionFormChange}
                                    style={{ color: '#000000' }}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {positions.length > 0 && (
                            <div className="catering-form-section">
                                <h3 style={{ color: '#000000' }}><BuildOutlined /> Existing Positions</h3>
                                <div className="catering-positions-list">
                                    {positions.map(pos => {
                                        let titleString = '';
                                        if (typeof pos.title === 'string') {
                                            titleString = pos.title;
                                        } else if (pos.title && typeof pos.title === 'object') {
                                            titleString = pos.title.title || pos.title.name || `Position ${pos.id}`;
                                        } else if (typeof pos.name === 'string') {
                                            titleString = pos.name;
                                        } else {
                                            titleString = `Position ${pos.id}`;
                                        }

                                        let deptName = '';
                                        if (pos.department) {
                                            if (typeof pos.department === 'string') {
                                                deptName = pos.department;
                                            } else if (typeof pos.department === 'object') {
                                                deptName = pos.department.name || `Department ${pos.department_id}`;
                                            }
                                        } else if (pos.department_id) {
                                            const foundDept = departments.find(d => d.id === pos.department_id);
                                            deptName = foundDept?.name || `Department ID: ${pos.department_id}`;
                                        } else {
                                            deptName = 'No Department';
                                        }

                                        let salaryInfo = '';
                                        if (pos.salary_grade) {
                                            salaryInfo = `Grade ${pos.salary_grade.grade_name} - ₱${(pos.salary_grade.hourly_rate || 0).toLocaleString()}/hour`;
                                        } else if (pos.salary_grade_id) {
                                            const sg = salaryGrades.find(s => s.id === pos.salary_grade_id);
                                            if (sg) {
                                                salaryInfo = `Grade ${sg.grade_name} - ₱${(sg.hourly_rate || 0).toLocaleString()}/hour`;
                                            }
                                        }

                                        return (
                                            <div key={pos.id} className="catering-position-item">
                                                <div className="catering-position-info">
                                                    <h4 style={{ color: '#000000' }}>{titleString}</h4>
                                                    <p style={{ color: '#000000' }}>{deptName}</p>
                                                    <small style={{ color: '#000000' }}>{salaryInfo}</small>
                                                </div>
                                                <div className="catering-position-actions">
                                                    <Tooltip title="Edit">
                                                        <button className="catering-action-btn edit" onClick={() => handleEditPosition(pos)} aria-label="Edit">
                                                            <EditOutlined />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <button className="catering-action-btn delete" onClick={() => deletePosition(pos.id)} aria-label="Delete">
                                                            <DeleteOutlined />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </form>
                </div>
                <div className="catering-modal-footer">
                    <button 
                        className="catering-btn" 
                        onClick={() => setShowPositionModal(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button 
                        className="catering-btn catering-btn-primary" 
                        onClick={handleSavePosition} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <LoadingOutlined spin /> : (positionFormMode === 'add' ? 'Add Position' : 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>
    );

    // ==================== DEPARTMENT MODAL ====================
    const renderDepartmentModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div 
                className="catering-modal catering-medium-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}>{departmentFormMode === 'add' ? 'Add New Department' : 'Edit Department'}</h2>
                    <button 
                        className="catering-modal-close" 
                        onClick={() => setShowDepartmentModal(false)}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    <form className="catering-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="catering-form-section">
                            <h3 style={{ color: '#000000' }}><BankOutlined /> Department Details</h3>
                            <div className="catering-form-row">
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Department Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        className={`catering-form-input ${departmentFormErrors.name ? 'error' : ''}`}
                                        value={departmentFormData.name}
                                        onChange={handleDepartmentFormChange}
                                        style={{ color: '#000000' }}
                                    />
                                    {departmentFormErrors.name && <span className="catering-form-error" style={{ color: '#000000' }}>{departmentFormErrors.name}</span>}
                                </div>
                                <div className="catering-form-group">
                                    <label style={{ color: '#000000' }}>Department Code *</label>
                                    <input
                                        type="text"
                                        name="code"
                                        className={`catering-form-input ${departmentFormErrors.code ? 'error' : ''}`}
                                        value={departmentFormData.code}
                                        onChange={handleDepartmentFormChange}
                                        placeholder="e.g., HR, IT, SALES"
                                        style={{ color: '#000000' }}
                                    />
                                    {departmentFormErrors.code && <span className="catering-form-error" style={{ color: '#000000' }}>{departmentFormErrors.code}</span>}
                                </div>
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Description</label>
                                <textarea name="description" className="catering-form-textarea" value={departmentFormData.description} onChange={handleDepartmentFormChange} rows="3" style={{ color: '#000000' }} />
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Department Manager</label>
                                <select name="manager_id" className="catering-form-select" value={departmentFormData.manager_id} onChange={handleDepartmentFormChange} style={{ color: '#000000' }}>
                                    <option value="">Select Manager</option>
                                    {employees.filter(e => e.status === 'active').map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="catering-form-group">
                                <label style={{ color: '#000000' }}>Status</label>
                                <select name="status" className="catering-form-select" value={departmentFormData.status} onChange={handleDepartmentFormChange} style={{ color: '#000000' }}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {departments.length > 0 && (
                            <div className="catering-form-section">
                                <h3 style={{ color: '#000000' }}><BankOutlined /> Existing Departments</h3>
                                <div className="catering-departments-list">
                                    {departments.map(dept => (
                                        <div key={dept.id} className="catering-department-item">
                                            <div className="catering-department-info">
                                                <h4 style={{ color: '#000000' }}>{dept.name}</h4>
                                                <p style={{ color: '#000000' }}>Code: {dept.code}</p>
                                                <small style={{ color: '#000000' }}>{dept.employees?.length || 0} employees</small>
                                            </div>
                                            <div className="catering-department-actions">
                                                <Tooltip title="Edit">
                                                    <button className="catering-action-btn edit" onClick={() => handleEditDepartment(dept)} aria-label="Edit">
                                                        <EditOutlined />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <button className="catering-action-btn delete" onClick={() => deleteDepartment(dept.id)} aria-label="Delete">
                                                        <DeleteOutlined />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
                </div>
                <div className="catering-modal-footer">
                    <button 
                        className="catering-btn" 
                        onClick={() => setShowDepartmentModal(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button 
                        className="catering-btn catering-btn-primary" 
                        onClick={handleSaveDepartment} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <LoadingOutlined spin /> : (departmentFormMode === 'add' ? 'Add Department' : 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>
    );

    // ==================== STATUS FILTER MODAL ====================
    const StatusFilterModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div 
                className="catering-modal catering-small-modal" 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}><FilterOutlined /> Filter by Status</h2>
                    <button 
                        className="catering-modal-close" 
                        onClick={() => setShowStatusFilterModal(false)}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>
                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    <div className="catering-status-filter-options">
                        <button 
                            className={`catering-status-filter-option ${selectedTab === 'all' ? 'active' : ''}`}
                            onClick={() => { setSelectedTab('all'); setSelectedStatus('all'); setShowStatusFilterModal(false); setCurrentPage(1); }}
                            style={{ color: '#000000' }}
                        >
                            <CheckCircleOutlined /> All Staff
                        </button>
                        <button 
                            className={`catering-status-filter-option ${selectedTab === 'active' ? 'active' : ''}`}
                            onClick={() => { setSelectedTab('active'); setSelectedStatus('active'); setShowStatusFilterModal(false); setCurrentPage(1); }}
                            style={{ color: '#000000' }}
                        >
                            <CheckCircleOutlined /> Active
                        </button>
                        <button 
                            className={`catering-status-filter-option ${selectedTab === 'onleave' ? 'active' : ''}`}
                            onClick={() => { setSelectedTab('onleave'); setSelectedStatus('onleave'); setShowStatusFilterModal(false); setCurrentPage(1); }}
                            style={{ color: '#000000' }}
                        >
                            <ClockCircleOutlined /> On Leave
                        </button>
                        <button 
                            className={`catering-status-filter-option ${selectedTab === 'inactive' ? 'active' : ''}`}
                            onClick={() => { setSelectedTab('inactive'); setSelectedStatus('inactive'); setShowStatusFilterModal(false); setCurrentPage(1); }}
                            style={{ color: '#000000' }}
                        >
                            <PauseCircleOutlined /> Inactive (Archived)
                        </button>
                        <button 
                            className={`catering-status-filter-option ${selectedTab === 'terminated' ? 'active' : ''}`}
                            onClick={() => { setSelectedTab('terminated'); setSelectedStatus('terminated'); setShowStatusFilterModal(false); setCurrentPage(1); }}
                            style={{ color: '#000000' }}
                        >
                            <WarningOutlined /> Terminated
                        </button>
                        <button 
                            className={`catering-status-filter-option ${selectedTab === 'bookmarked' ? 'active' : ''}`}
                            onClick={() => { setSelectedTab('bookmarked'); setSelectedStatus('all'); setShowStatusFilterModal(false); setCurrentPage(1); }}
                            style={{ color: '#000000' }}
                        >
                            <StarOutlined /> Bookmarked
                        </button>
                    </div>
                </div>
                <div className="catering-modal-footer">
                    <button 
                        className="catering-btn" 
                        onClick={() => setShowStatusFilterModal(false)}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );

    // ==================== EMPLOYEE MODAL (View/Add/Edit) ====================
    const renderEmployeeModal = () => (
        <div 
            className="catering-modal-overlay" 
            onClick={(e) => {
                if (modalMode === 'view') {
                    // Only close if clicking the overlay and not the modal content
                    if (e.target === e.currentTarget) {
                        // Don't close on backdrop click
                    }
                }
                e.stopPropagation();
            }}
        >
            <div 
                className={`catering-modal ${modalMode === 'view' ? 'catering-profile-modal' : ''}`} 
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div className="catering-modal-header">
                    <h2 style={{ color: '#000000' }}>
                        {modalMode === 'add' && 'Add New Staff Member'}
                        {modalMode === 'edit' && 'Edit Staff Information'}
                        {modalMode === 'view' && 'Staff Profile'}
                    </h2>
                    {modalMode !== 'view' && (
                        <div className="catering-modal-progress">
                            <span className={formStep >= 1 ? 'active' : ''} style={{ color: formStep >= 1 ? '#000000' : '#9ca3af' }}>1. Personal</span>
                            <span className={formStep >= 2 ? 'active' : ''} style={{ color: formStep >= 2 ? '#000000' : '#9ca3af' }}>2. Employment</span>
                            <span className={formStep >= 3 ? 'active' : ''} style={{ color: formStep >= 3 ? '#000000' : '#9ca3af' }}>3. Government</span>
                            <span className={formStep >= 4 ? 'active' : ''} style={{ color: formStep >= 4 ? '#000000' : '#9ca3af' }}>4. Skills & Emergency</span>
                        </div>
                    )}
                    <button 
                        className="catering-modal-close" 
                        onClick={closeModal}
                        aria-label="Close"
                    >
                        <CloseOutlined />
                    </button>
                </div>

                <div 
                    className="catering-modal-body"
                    style={{
                        overflowY: 'auto',
                        flex: '1 1 auto',
                        padding: '24px',
                        maxHeight: 'calc(90vh - 140px)'
                    }}
                >
                    {modalMode === 'view' && selectedEmployee ? (
                        <div className="catering-profile">
                            <div className="catering-profile-header">
                                <div className="catering-profile-avatar">
                                    {selectedEmployee.profile_photo_url ? (
                                        <img src={selectedEmployee.profile_photo_url} alt={selectedEmployee.first_name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    ) : (
                                        <div className="catering-profile-avatar-placeholder">
                                            {selectedEmployee.first_name?.[0]?.toUpperCase() || ''}{selectedEmployee.last_name?.[0]?.toUpperCase() || ''}
                                        </div>
                                    )}
                                    {selectedEmployee.is_bookmarked && <StarOutlined className="catering-profile-bookmark" />}
                                </div>
                                <h2 className="catering-profile-name" style={{ color: '#000000' }}>{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                                <p className="catering-profile-title" style={{ color: '#000000' }}>{selectedEmployee.position?.title || 'N/A'}</p>
                                <div className="catering-profile-badges">
                                    <span className="catering-profile-badge" style={{ color: '#000000' }}><BankOutlined /> {selectedEmployee.department?.name || 'N/A'}</span>
                                    <span className="catering-profile-badge" style={{ color: '#000000' }}><DollarOutlined /> Grade: {getEmployeeSalaryGrade(selectedEmployee)}</span>
                                </div>
                            </div>

                            <StatusControls employee={selectedEmployee} />

                            <div className="catering-profile-sections">
                                <div className="catering-profile-section">
                                    <h3 style={{ color: '#000000' }}><UserOutlined /> Personal Information</h3>
                                    <div className="catering-profile-grid">
                                        <div><label style={{ color: '#000000' }}>Email</label><span style={{ color: '#000000' }}>{selectedEmployee.email}</span></div>
                                        <div><label style={{ color: '#000000' }}>Phone</label><span style={{ color: '#000000' }}>{selectedEmployee.phone}</span></div>
                                        <div><label style={{ color: '#000000' }}>Address</label><span style={{ color: '#000000' }}>{selectedEmployee.address}</span></div>
                                        <div><label style={{ color: '#000000' }}>Emergency Contact</label><span style={{ color: '#000000' }}>{selectedEmployee.emergency_contact_name || selectedEmployee.emergency_contact} ({selectedEmployee.emergency_contact_relation || selectedEmployee.emergency_relation})<br/>{selectedEmployee.emergency_contact_phone || selectedEmployee.emergency_phone}</span></div>
                                    </div>
                                </div>

                                <div className="catering-profile-section">
                                    <h3 style={{ color: '#000000' }}><BankOutlined /> Employment Details</h3>
                                    <div className="catering-profile-grid">
                                        <div><label style={{ color: '#000000' }}>Hire Date</label><span style={{ color: '#000000' }}>{selectedEmployee.hire_date}</span></div>
                                        <div><label style={{ color: '#000000' }}>Employee Type</label><span style={{ color: '#000000' }}>{selectedEmployee.employee_type}</span></div>
                                        <div><label style={{ color: '#000000' }}>Hourly Rate</label><span style={{ color: '#000000' }}>₱{(selectedEmployee.hourly_rate || selectedEmployee.calculated_hourly_rate || 0).toLocaleString()}/hour</span></div>
                                        <div><label style={{ color: '#000000' }}>Bank Account</label><span style={{ color: '#000000' }}>{selectedEmployee.bank_name} - {selectedEmployee.bank_account_number || selectedEmployee.bank_account}</span></div>
                                    </div>
                                </div>

                                <div className="catering-profile-section">
                                    <h3 style={{ color: '#000000' }}><SafetyOutlined /> Government IDs</h3>
                                    <div className="catering-profile-grid">
                                        <div><label style={{ color: '#000000' }}>SSS</label><span style={{ color: '#000000' }}>{selectedEmployee.sss_number || selectedEmployee.sss || 'N/A'}</span></div>
                                        <div><label style={{ color: '#000000' }}>PhilHealth</label><span style={{ color: '#000000' }}>{selectedEmployee.philhealth_number || selectedEmployee.philhealth || 'N/A'}</span></div>
                                        <div><label style={{ color: '#000000' }}>Pag-IBIG</label><span style={{ color: '#000000' }}>{selectedEmployee.pagibig_number || selectedEmployee.pagibig || 'N/A'}</span></div>
                                        <div><label style={{ color: '#000000' }}>TIN</label><span style={{ color: '#000000' }}>{selectedEmployee.tin_number || selectedEmployee.tin || 'N/A'}</span></div>
                                    </div>
                                </div>

                                <div className="catering-profile-section">
                                    <h3 style={{ color: '#000000' }}><BookOutlined /> Skills & Certifications</h3>
                                    <div className="catering-profile-skills">
                                        {Array.isArray(selectedEmployee.skills) && selectedEmployee.skills.map((skill, i) => (
                                            <span key={i} className="catering-skill-tag highlight" style={{ color: '#000000' }}>{skill}</span>
                                        ))}
                                    </div>
                                    <div className="catering-profile-certifications">
                                        {Array.isArray(selectedEmployee.certifications) && selectedEmployee.certifications.map((cert, i) => (
                                            <span key={i} className="catering-skill-tag" style={{ color: '#000000' }}><TrophyOutlined /> {cert}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form className="catering-form" onSubmit={(e) => e.preventDefault()}>
                            {formStep === 1 && (
                                <>
                                    <div className="catering-upload-area" onClick={() => document.getElementById('profile-photo').click()}>
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="catering-upload-preview" />
                                        ) : (
                                            <>
                                                <UploadOutlined className="catering-upload-icon" />
                                                <p style={{ color: '#000000' }}>Click to upload photo</p>
                                                <p className="catering-upload-hint" style={{ color: '#000000' }}>Supported: JPG, PNG. Max size: 2MB</p>
                                            </>
                                        )}
                                        <input type="file" id="profile-photo" name="profile_photo" accept="image/jpeg,image/png,image/jpg" onChange={handleInputChange} style={{ display: 'none' }} />
                                    </div>

                                    {uploadProgress > 0 && uploadProgress < 100 && (
                                        <div className="catering-upload-progress">
                                            <div className="catering-progress-bar"><div className="catering-progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
                                            <span style={{ color: '#000000' }}>{uploadProgress}% uploaded</span>
                                        </div>
                                    )}

                                    <div className="catering-form-section">
                                        <h3 style={{ color: '#000000' }}><UserOutlined /> Personal Information</h3>
                                        <div className="catering-form-row">
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>First Name *</label>
                                                <input type="text" name="first_name" className={`catering-form-input ${formErrors.first_name && touchedFields.first_name ? 'error' : ''}`} value={formData.first_name} onChange={handleInputChange} onBlur={() => handleBlur('first_name')} style={{ color: '#000000' }} />
                                                {formErrors.first_name && touchedFields.first_name && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.first_name}</span>}
                                            </div>
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>Last Name *</label>
                                                <input type="text" name="last_name" className={`catering-form-input ${formErrors.last_name && touchedFields.last_name ? 'error' : ''}`} value={formData.last_name} onChange={handleInputChange} onBlur={() => handleBlur('last_name')} style={{ color: '#000000' }} />
                                                {formErrors.last_name && touchedFields.last_name && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.last_name}</span>}
                                            </div>
                                        </div>

                                        <div className="catering-form-row">
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>Middle Name</label>
                                                <input type="text" name="middle_name" className="catering-form-input" value={formData.middle_name} onChange={handleInputChange} style={{ color: '#000000' }} />
                                            </div>
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>Gender</label>
                                                <select name="gender" className="catering-form-select" value={formData.gender} onChange={handleInputChange} style={{ color: '#000000' }}>
                                                    <option value="">Select gender</option>
                                                    {genderOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="catering-form-row">
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>Birth Date</label>
                                                <input type="date" name="birth_date" className={`catering-form-input ${formErrors.birth_date ? 'error' : ''}`} value={formData.birth_date} onChange={handleInputChange} max={new Date().toISOString().split('T')[0]} style={{ color: '#000000' }} />
                                                {formErrors.birth_date && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.birth_date}</span>}
                                            </div>
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>Position *</label>
                                                <select name="position_id" className={`catering-form-select ${formErrors.position_id && touchedFields.position_id ? 'error' : ''}`} value={formData.position_id} onChange={(e) => { handleInputChange(e); handlePositionChange(e.target.value); }} onBlur={() => handleBlur('position_id')} style={{ color: '#000000' }}>
                                                    <option value="">Select position</option>
                                                    {(filteredPositions.length > 0 ? filteredPositions : positions).map(pos => {
                                                        let titleString = '';
                                                        if (typeof pos.title === 'string') titleString = pos.title;
                                                        else if (pos.title && typeof pos.title === 'object') titleString = pos.title.title || pos.title.name || `Position ${pos.id}`;
                                                        else if (typeof pos.name === 'string') titleString = pos.name;
                                                        else titleString = `Position ${pos.id}`;
                                                        return (<option key={pos.id} value={pos.id}>{titleString}</option>);
                                                    })}
                                                </select>
                                                {formErrors.position_id && touchedFields.position_id && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.position_id}</span>}
                                            </div>
                                        </div>

                                        <div className="catering-form-row">
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>Email *</label>
                                                <input type="email" name="email" className={`catering-form-input ${formErrors.email && touchedFields.email ? 'error' : ''}`} value={formData.email} onChange={handleInputChange} onBlur={() => handleBlur('email')} style={{ color: '#000000' }} />
                                                {formErrors.email && touchedFields.email && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.email}</span>}
                                            </div>
                                            <div className="catering-form-group">
                                                <label style={{ color: '#000000' }}>Phone *</label>
                                                <input type="tel" name="phone" className={`catering-form-input ${formErrors.phone && touchedFields.phone ? 'error' : ''}`} value={formData.phone} onChange={handleInputChange} onBlur={() => handleBlur('phone')} style={{ color: '#000000' }} />
                                                {formErrors.phone && touchedFields.phone && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.phone}</span>}
                                            </div>
                                        </div>

                                        <div className="catering-form-group">
                                            <label style={{ color: '#000000' }}>Address</label>
                                            <textarea name="address" className="catering-form-textarea" value={formData.address} onChange={handleInputChange} rows="3" style={{ color: '#000000' }} />
                                        </div>

                                        <div className="catering-form-row">
                                            <div className="catering-form-group"><label style={{ color: '#000000' }}>City</label><input type="text" name="city" className="catering-form-input" value={formData.city} onChange={handleInputChange} style={{ color: '#000000' }} /></div>
                                            <div className="catering-form-group"><label style={{ color: '#000000' }}>State/Province</label><input type="text" name="state" className="catering-form-input" value={formData.state} onChange={handleInputChange} style={{ color: '#000000' }} /></div>
                                        </div>

                                        <div className="catering-form-row">
                                            <div className="catering-form-group"><label style={{ color: '#000000' }}>Postal Code</label><input type="text" name="postal_code" className="catering-form-input" value={formData.postal_code} onChange={handleInputChange} style={{ color: '#000000' }} /></div>
                                            <div className="catering-form-group"><label style={{ color: '#000000' }}>Country</label><input type="text" name="country" className="catering-form-input" value={formData.country} onChange={handleInputChange} style={{ color: '#000000' }} /></div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {formStep === 2 && (
                                <div className="catering-form-section">
                                    <h3 style={{ color: '#000000' }}><BankOutlined /> Employment Details</h3>

                                    {selectedPositionDetails.salary_grade && (
                                        <div className="catering-auto-fill-section">
                                            <h4 style={{ color: '#000000' }}><DollarOutlined /> Salary Information (Auto-filled from Position)</h4>
                                            <div className="catering-form-row">
                                                <div className="catering-form-group">
                                                    <label style={{ color: '#000000' }}>Salary Grade</label>
                                                    <input type="text" className="catering-form-input catering-auto-field" value={selectedPositionDetails.salary_grade} disabled readOnly style={{ color: '#000000' }} />
                                                    <small className="catering-form-hint" style={{ color: '#000000' }}>Derived from selected position</small>
                                                </div>
                                                <div className="catering-form-group">
                                                    <label style={{ color: '#000000' }}>Hourly Rate (₱)</label>
                                                    <input type="text" className="catering-form-input catering-auto-field" value={`₱${selectedPositionDetails.hourly_rate.toLocaleString()}/hour`} disabled readOnly style={{ color: '#000000' }} />
                                                    <small className="catering-form-hint" style={{ color: '#000000' }}>Based on salary grade</small>
                                                </div>
                                            </div>
                                            <div className="catering-form-row">
                                                <div className="catering-form-group">
                                                    <label style={{ color: '#000000' }}>Monthly Equivalent (₱)</label>
                                                    <input type="text" className="catering-form-input catering-auto-field" value={`₱${(selectedPositionDetails.hourly_rate * 160).toLocaleString()}/month`} disabled readOnly style={{ color: '#000000' }} />
                                                    <small className="catering-form-hint" style={{ color: '#000000' }}>Based on 160 hours/month (for reference only)</small>
                                                </div>
                                                <div className="catering-form-group">
                                                    <label style={{ color: '#000000' }}>Hourly Rate Override (Optional)</label>
                                                    <input type="number" name="hourly_rate_override" className="catering-form-input" value={formData.hourly_rate_override} onChange={handleInputChange} placeholder="Leave empty to use grade rate" min="0" step="10" style={{ color: '#000000' }} />
                                                    <small className="catering-form-hint" style={{ color: '#000000' }}>Only use if this employee has a different rate</small>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="catering-form-row">
                                        <div className="catering-form-group">
                                            <label style={{ color: '#000000' }}>Department *</label>
                                            <select name="department_id" className={`catering-form-select ${formErrors.department_id && touchedFields.department_id ? 'error' : ''}`} value={formData.department_id} onChange={handleInputChange} onBlur={() => handleBlur('department_id')} style={{ color: '#000000' }}>
                                                <option value="">Select department</option>
                                                {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                            </select>
                                            {formErrors.department_id && touchedFields.department_id && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.department_id}</span>}
                                        </div>
                                        <div className="catering-form-group">
                                            <label style={{ color: '#000000' }}>Employee Type *</label>
                                            <select name="employee_type" className="catering-form-select" value={formData.employee_type} onChange={handleInputChange} style={{ color: '#000000' }}>
                                                {employmentTypeOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="catering-form-row">
                                        <div className="catering-form-group">
                                            <label style={{ color: '#000000' }}>Status *</label>
                                            <select name="status" className="catering-form-select" value={formData.status} onChange={handleInputChange} style={{ color: '#000000' }}>
                                                {statusOptions.filter(s => s.value !== 'terminated').map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                                            </select>
                                            <small className="catering-form-hint" style={{ color: '#000000' }}>Note: Terminated status is for former employees</small>
                                        </div>
                                        <div className="catering-form-group">
                                            <label style={{ color: '#000000' }}>Hire Date *</label>
                                            <input type="date" name="hire_date" className={`catering-form-input ${formErrors.hire_date && touchedFields.hire_date ? 'error' : ''}`} value={formData.hire_date} onChange={handleInputChange} onBlur={() => handleBlur('hire_date')} max={new Date().toISOString().split('T')[0]} style={{ color: '#000000' }} />
                                            {formErrors.hire_date && touchedFields.hire_date && <span className="catering-form-error" style={{ color: '#000000' }}>{formErrors.hire_date}</span>}
                                        </div>
                                    </div>

                                    <div className="catering-form-row">
                                        <div className="catering-form-group">
                                            <label style={{ color: '#000000' }}>Bank Name</label>
                                            <input type="text" name="bank_name" className="catering-form-input" value={formData.bank_name} onChange={handleInputChange} style={{ color: '#000000' }} />
                                        </div>
                                        <div className="catering-form-group">
                                            <label style={{ color: '#000000' }}>Bank Account</label>
                                            <input type="text" name="bank_account" className="catering-form-input" value={formData.bank_account} onChange={handleInputChange} style={{ color: '#000000' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formStep === 3 && (
                                <div className="catering-form-section">
                                    <h3 style={{ color: '#000000' }}><SafetyOutlined /> Government IDs</h3>
                                    <div className="catering-form-row">
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>SSS Number</label><input type="text" name="sss" className="catering-form-input" value={formData.sss} onChange={handleInputChange} placeholder="XX-XXXXXXX-X" style={{ color: '#000000' }} /></div>
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>PhilHealth</label><input type="text" name="philhealth" className="catering-form-input" value={formData.philhealth} onChange={handleInputChange} placeholder="XX-XXXXXXXXX-X" style={{ color: '#000000' }} /></div>
                                    </div>
                                    <div className="catering-form-row">
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>Pag-IBIG</label><input type="text" name="pagibig" className="catering-form-input" value={formData.pagibig} onChange={handleInputChange} placeholder="XXXX-XXXX-XXXX" style={{ color: '#000000' }} /></div>
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>TIN</label><input type="text" name="tin" className="catering-form-input" value={formData.tin} onChange={handleInputChange} placeholder="XXX-XXX-XXX-XXX" style={{ color: '#000000' }} /></div>
                                    </div>
                                </div>
                            )}

                            {formStep === 4 && (
                                <>
                                    <div className="catering-form-section">
                                        <h3 style={{ color: '#000000' }}><HeartOutlined /> Emergency Contact</h3>
                                        <div className="catering-form-row">
                                            <div className="catering-form-group"><label style={{ color: '#000000' }}>Contact Name</label><input type="text" name="emergency_contact" className="catering-form-input" value={formData.emergency_contact} onChange={handleInputChange} style={{ color: '#000000' }} /></div>
                                            <div className="catering-form-group"><label style={{ color: '#000000' }}>Relationship</label><input type="text" name="emergency_relation" className="catering-form-input" value={formData.emergency_relation} onChange={handleInputChange} style={{ color: '#000000' }} /></div>
                                        </div>
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>Emergency Phone</label><input type="tel" name="emergency_phone" className="catering-form-input" value={formData.emergency_phone} onChange={handleInputChange} style={{ color: '#000000' }} /></div>
                                    </div>

                                    <div className="catering-form-section">
                                        <h3 style={{ color: '#000000' }}><BookOutlined /> Skills & Certifications</h3>
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>Skills (comma separated)</label><input type="text" name="skills" className="catering-form-input" value={formData.skills} onChange={handleInputChange} placeholder="e.g., Food Safety, Menu Planning, Leadership" style={{ color: '#000000' }} /></div>
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>Certifications</label><input type="text" name="certifications" className="catering-form-input" value={formData.certifications} onChange={handleInputChange} placeholder="e.g., ServSafe, Culinary Arts" style={{ color: '#000000' }} /></div>
                                        <div className="catering-form-group"><label style={{ color: '#000000' }}>Achievements</label><input type="text" name="achievements" className="catering-form-input" value={formData.achievements} onChange={handleInputChange} placeholder="e.g., Employee of the Month" style={{ color: '#000000' }} /></div>
                                    </div>

                                    <div className="catering-form-section">
                                        <h3 style={{ color: '#000000' }}><FileTextOutlined /> Additional Notes</h3>
                                        <div className="catering-form-group"><textarea name="notes" className="catering-form-textarea" value={formData.notes} onChange={handleInputChange} placeholder="Enter any additional notes" rows="4" style={{ color: '#000000' }} /></div>
                                    </div>
                                </>
                            )}
                        </form>
                    )}
                </div>

                <div className="catering-modal-footer">
                    {modalMode !== 'view' && formStep > 1 && (<button className="catering-btn" onClick={handlePrevStep} disabled={isSubmitting} style={{ color: '#000000' }}>Previous</button>)}
                    <button className="catering-btn" onClick={closeModal} disabled={isSubmitting} style={{ color: '#000000' }}>Cancel</button>
                    {modalMode !== 'view' && formStep < 4 && (<button className="catering-btn catering-btn-primary" onClick={handleNextStep} disabled={isSubmitting}>Next</button>)}
                    {modalMode !== 'view' && formStep === 4 && (<button className="catering-btn catering-btn-primary" onClick={handleSaveEmployee} disabled={isSubmitting}>{isSubmitting ? <LoadingOutlined spin /> : (modalMode === 'add' ? 'Add Staff Member' : 'Save Changes')}</button>)}
                    {modalMode === 'view' && (
                        <>
                            <button className="catering-btn" onClick={() => handlePrintProfile(selectedEmployee)} style={{ color: '#000000' }}><PrinterOutlined /> Print Profile</button>
                            <button className="catering-btn" onClick={() => handleBookmark(selectedEmployee.id || selectedEmployee.employee_id)} style={{ color: '#000000' }}><StarOutlined /> {selectedEmployee?.is_bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}</button>
                            <button className="catering-btn catering-btn-primary" onClick={() => handleEditEmployee(selectedEmployee)}><EditOutlined /> Edit Profile</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    // ==================== MAIN RENDER ====================
    return (
        <div className="catering-layout">
            <header className="catering-header">
                <div className="catering-logo">
                    <div className="catering-logo-icon"><PeopleIcon /></div>
                    <div className="catering-logo-text">
                        <h1>Catering Staff Management</h1>
                        <span>Enterprise System</span>
                    </div>
                </div>
                <div className="catering-header-right">
                    <div className="catering-date"><CalendarOutlined /><span>{currentDate}</span></div>
                    <div className="catering-search">
                        <SearchOutlined className="catering-search-icon" />
                        <input type="text" className="catering-search-input" placeholder="Search by name, ID, department..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        {searchQuery && <button className="catering-search-clear" onClick={() => setSearchQuery('')}><CloseOutlined /></button>}
                    </div>
                    <button className="catering-header-icon" onClick={toggleFullscreen} title={showFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}><FullscreenOutlined /></button>
                    <button className="catering-header-icon" onClick={() => { refetchEmployees(); refetchStats(); }} title="Refresh Data"><ReloadOutlined /></button>
                </div>
            </header>

            <main className="catering-main">
                {/* Stats Grid */}
                <div className="catering-stats-grid">
                    {statistics.map((stat, index) => (
                        <div key={`stat-${index}`} className="catering-stat-card">
                            <div className="catering-stat-icon">{stat.icon}</div>
                            <div className="catering-stat-content"><h3>{stat.value}</h3><span>{stat.label}</span></div>
                            <span className="catering-stat-change">{stat.change}</span>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="catering-quick-actions">
                    {quickActions.map((action, index) => (
                        <div key={`action-${index}`} className="catering-quick-action" onClick={action.action}>
                            <div className="catering-quick-icon">{action.icon}</div>
                            <span>{action.label}</span>
                        </div>
                    ))}
                </div>

                {/* Archive Section */}
                {showArchive && (
                    <div className="catering-archive-section">
                        <div className="catering-archive-header">
                            <h3><InboxOutlined /> Archived Staff</h3>
                            <span className="catering-archive-count">{archivedEmployees.length} archived</span>
                            <button className="catering-archive-close" onClick={() => setShowArchive(false)}><CloseOutlined /></button>
                        </div>
                        {archivedLoading ? (
                            <div className="catering-loading-spinner"><LoadingOutlined spin /> Loading archived staff...</div>
                        ) : archivedEmployees.length > 0 ? (
                            <div className="catering-archive-list">
                                {archivedEmployees.map((emp) => (
                                    <div key={emp.id || emp.employee_id} className="catering-archive-item">
                                        <div className="catering-archive-item-info">
                                            <div className="catering-archive-avatar">
                                                {emp.profile_photo_url ? (<img src={emp.profile_photo_url} alt={emp.first_name} />) : (<div className="catering-archive-avatar-placeholder">{emp.first_name?.[0]}{emp.last_name?.[0]}</div>)}
                                            </div>
                                            <div className="catering-archive-details">
                                                <h4>{emp.first_name} {emp.last_name}</h4>
                                                <p><span>{emp.position?.title || 'N/A'}</span><span>•</span><span>{emp.department?.name || 'N/A'}</span></p>
                                                <small>Archived on: {new Date(emp.deleted_at || emp.updated_at).toLocaleDateString()}</small>
                                            </div>
                                        </div>
                                        <div className="catering-archive-actions">
                                            <button className="catering-archive-restore-btn" onClick={() => restoreEmployee(emp.id || emp.employee_id)}><RestOutlined /> Restore</button>
                                            <button className="catering-archive-delete-btn" onClick={() => permanentlyDeleteEmployee(emp.id || emp.employee_id)}><DeleteOutlined /> Delete Permanently</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="catering-archive-empty"><InboxOutlined className="catering-archive-empty-icon" /><p>No archived staff members</p></div>
                        )}
                    </div>
                )}

                {/* Filters */}
                <div className="catering-filters">
                    <div className="catering-filter-tabs">
                        <button className={`catering-filter-tab ${selectedTab === 'all' ? 'active' : ''}`} onClick={() => { setSelectedTab('all'); setSelectedStatus('all'); setCurrentPage(1); }}>All Staff</button>
                        <button className={`catering-filter-tab ${selectedTab === 'active' ? 'active' : ''}`} onClick={() => { setSelectedTab('active'); setSelectedStatus('active'); setCurrentPage(1); }}>Active</button>
                        <button className={`catering-filter-tab ${selectedTab === 'onleave' ? 'active' : ''}`} onClick={() => { setSelectedTab('onleave'); setSelectedStatus('onleave'); setCurrentPage(1); }}>On Leave</button>
                        <button className={`catering-filter-tab ${selectedTab === 'inactive' ? 'active' : ''}`} onClick={() => { setSelectedTab('inactive'); setSelectedStatus('inactive'); setCurrentPage(1); }}>Inactive</button>
                        <button className={`catering-filter-tab ${selectedTab === 'terminated' ? 'active' : ''}`} onClick={() => { setSelectedTab('terminated'); setSelectedStatus('terminated'); setCurrentPage(1); }}>Terminated</button>
                        <button className={`catering-filter-tab ${selectedTab === 'bookmarked' ? 'active' : ''}`} onClick={() => { setSelectedTab('bookmarked'); setSelectedStatus('all'); setCurrentPage(1); }}><StarOutlined /> Bookmarked</button>
                    </div>

                    <select className="catering-filter-select" value={selectedDepartment} onChange={(e) => { setSelectedDepartment(e.target.value); setCurrentPage(1); }}>
                        <option value="all">All Departments</option>
                        {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                    </select>

                    <div className="catering-badge-group">
                        <span className="catering-badge"><strong>{pagination?.total || filteredEmployees.length}</strong> Total Staff</span>
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {isSelectMode && selectedEmployees.length > 0 && (
                    <div className="catering-bulk-actions-bar">
                        <span className="catering-bulk-count">{selectedEmployees.length} selected</span>
                        <button className="catering-bulk-action" onClick={() => handleBulkStatusUpdate('active')}><CheckCircleOutlined /> Set Active</button>
                        <button className="catering-bulk-action" onClick={() => handleBulkStatusUpdate('onleave')}><PauseCircleOutlined /> Set On Leave</button>
                        <button className="catering-bulk-action" onClick={() => handleBulkStatusUpdate('inactive')}><InboxOutlined /> Set Inactive</button>
                        <button className="catering-bulk-action" onClick={() => handleBulkStatusUpdate('terminated')}><WarningOutlined /> Set Terminated</button>
                        <button className="catering-bulk-action" onClick={handleBulkArchive}><InboxOutlined /> Archive Selected</button>
                        <button className="catering-bulk-close" onClick={() => { setSelectedEmployees([]); setIsSelectMode(false); }}><CloseOutlined /></button>
                    </div>
                )}

                {/* Staff Table */}
                <div className="catering-table-card">
                    <div className="catering-table-header">
                        <div className="catering-table-title">
                            <h2>Staff Directory</h2>
                            <span className="catering-table-count">Showing {paginatedEmployees.length} of {pagination?.total || filteredEmployees.length} records</span>
                        </div>
                        <div className="catering-table-actions">
                            <Tooltip title="Add Staff Member">
                                <button className="catering-btn catering-btn-primary" onClick={handleAddEmployee}>
                                    <PlusOutlined /> Add Staff
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    <div className="catering-table-container">
                        {isLoading ? (
                            <div className="catering-loading-spinner"><LoadingOutlined spin /> Loading staff members...</div>
                        ) : (
                            <table className="catering-table">
                                <thead>
                                    <tr>
                                        {isSelectMode && (
                                            <th style={{ width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmployees.length === paginatedEmployees.length && paginatedEmployees.length > 0}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                        )}
                                        <th style={{ width: '50px' }}>#</th>
                                        {visibleColumns.employee && <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Employee {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}</th>}
                                        {visibleColumns.department && <th onClick={() => handleSort('department')} style={{ cursor: 'pointer' }}>Department {sortConfig.key === 'department' && (sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}</th>}
                                        {visibleColumns.position && <th onClick={() => handleSort('position')} style={{ cursor: 'pointer' }}>Position {sortConfig.key === 'position' && (sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}</th>}
                                        {visibleColumns.status && <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}</th>}
                                        {visibleColumns.salary_grade && <th onClick={() => handleSort('salary_grade')} style={{ cursor: 'pointer' }}>Salary Grade {sortConfig.key === 'salary_grade' && (sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}</th>}
                                        {visibleColumns.hourly_rate && <th onClick={() => handleSort('hourly_rate')} style={{ cursor: 'pointer' }}>Hourly Rate {sortConfig.key === 'hourly_rate' && (sortConfig.direction === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}</th>}
                                        {visibleColumns.contact && <th>Contact</th>}
                                        {visibleColumns.actions && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedEmployees.length > 0 ? (
                                        paginatedEmployees.map((emp, idx) => (
                                            <tr key={emp.id || emp.employee_id || Math.random()} className={selectedEmployees.includes(emp.id || emp.employee_id) ? 'selected' : ''}>
                                                {isSelectMode && (
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEmployees.includes(emp.id || emp.employee_id)}
                                                            onChange={() => handleSelectEmployee(emp.id || emp.employee_id)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="catering-row-number">{getRowNumber(idx)}</td>
                                                {visibleColumns.employee && (
                                                    <td>
                                                        <div className="catering-employee-cell">
                                                            <div className="catering-employee-avatar">
                                                                {emp.profile_photo_url ? (
                                                                    <img
                                                                        src={emp.profile_photo_url}
                                                                        alt={`${emp.first_name || ''} ${emp.last_name || ''}`}
                                                                        style={{
                                                                            width: '40px',
                                                                            height: '40px',
                                                                            borderRadius: '50%',
                                                                            objectFit: 'cover',
                                                                            border: '2px solid #e5e7eb'
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="catering-employee-avatar-placeholder">
                                                                        {(emp.first_name?.[0] || '').toUpperCase()}
                                                                        {(emp.last_name?.[0] || '').toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="catering-employee-info">
                                                                <span className="catering-employee-name">
                                                                    {`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown Staff'}
                                                                </span>

                                                                <span className="catering-employee-id">
                                                                    <IdcardOutlined /> {emp.employee_code || `EMP-${emp.employee_id || emp.id}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.department && <td><span className="catering-tag">{emp.department?.name || 'N/A'}</span></td>}
                                                {visibleColumns.position && <td><span className="catering-role-badge">{emp.position?.title || 'N/A'}</span></td>}
                                                {visibleColumns.status && (
                                                    <td className="catering-status-cell">
                                                        <button
                                                            className="catering-status-badge"
                                                            style={{
                                                                backgroundColor: statusOptions.find(s => s.value === emp.status)?.bgColor || '#f3f4f6',
                                                                color: statusOptions.find(s => s.value === emp.status)?.textColor || '#374151'
                                                            }}
                                                            onClick={() => setShowStatusDropdown(showStatusDropdown === emp.id ? null : emp.id)}
                                                        >
                                                            <span className="catering-status-dot" style={{ backgroundColor: statusOptions.find(s => s.value === emp.status)?.color || '#6b7280' }}></span>
                                                            {statusOptions.find(s => s.value === emp.status)?.label || emp.status || 'Active'}
                                                            <DownOutlined style={{ fontSize: '10px', marginLeft: '6px' }} />
                                                        </button>
                                                        {showStatusDropdown === emp.id && (
                                                            <div className="catering-status-dropdown">
                                                                <div className="catering-status-dropdown-header">
                                                                    <span>Change Status</span>
                                                                    <button onClick={() => setShowStatusDropdown(null)}><CloseOutlined /></button>
                                                                </div>
                                                                <div className="catering-status-dropdown-options">
                                                                    {statusOptions.map(option => (
                                                                        <button
                                                                            key={option.value}
                                                                            className={`catering-status-option ${emp.status === option.value ? 'active' : ''}`}
                                                                            onClick={() => handleUpdateStatus(emp.id || emp.employee_id, option.value)}
                                                                        >
                                                                            <span className="catering-status-dot" style={{ backgroundColor: option.color }}></span>
                                                                            <span>{option.label}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                {visibleColumns.salary_grade && <td><span className="catering-salary-grade-text">{getEmployeeSalaryGrade(emp)}</span></td>}
                                                {visibleColumns.hourly_rate && <td>₱{(emp.hourly_rate || emp.calculated_hourly_rate || 0).toLocaleString()}/hr</td>}
                                                {visibleColumns.contact && (
                                                    <td><div className="catering-contact-info"><span><MailFilled /> {emp.email}</span><span><PhoneFilled /> {emp.phone}</span></div></td>
                                                )}
                                                {visibleColumns.actions && (
                                                    <td>
                                                        <div className="catering-actions">
                                                            <Tooltip title="View">
                                                                <button className="catering-action-btn view" onClick={() => handleViewEmployee(emp)} aria-label="View">
                                                                    <EyeOutlined />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip title="Edit">
                                                                <button className="catering-action-btn edit" onClick={() => handleEditEmployee(emp)} aria-label="Edit">
                                                                    <EditOutlined />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip title="Bookmark">
                                                                <button className="catering-action-btn bookmark" onClick={() => handleBookmark(emp.id || emp.employee_id)} aria-label="Bookmark">
                                                                    <StarOutlined style={{ color: emp.is_bookmarked ? '#fbbf24' : '#9ca3af' }} />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip title="Archive">
                                                                <button className="catering-action-btn delete" onClick={() => handleArchiveClick(emp)} aria-label="Archive">
                                                                    <InboxOutlined />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="10" className="catering-table-empty"><div className="catering-empty-state"><TeamOutlined className="catering-empty-icon" /><h3>No staff members found</h3><p>Try adjusting your filters or add a new staff member</p><button className="catering-btn catering-btn-primary" onClick={handleAddEmployee}><PlusOutlined /> Add Staff Member</button></div></td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="catering-pagination">
                            <span className="catering-pagination-info">
                                Showing {((pagination?.current_page || currentPage) - 1) * pageSize + 1} to {Math.min((pagination?.current_page || currentPage) * pageSize, pagination?.total || filteredEmployees.length)} of {pagination?.total || filteredEmployees.length} staff members
                            </span>
                            <div className="catering-pagination-controls">
                                <button 
                                    className="catering-pagination-btn" 
                                    onClick={() => goToPage(1)} 
                                    disabled={currentPage === 1}
                                    aria-label="First page"
                                >
                                    «
                                </button>
                                <button 
                                    className="catering-pagination-btn" 
                                    onClick={prevPage} 
                                    disabled={currentPage === 1}
                                    aria-label="Previous page"
                                >
                                    ‹
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    if (pageNum >= 1 && pageNum <= totalPages) {
                                        return (
                                            <button 
                                                key={pageNum} 
                                                className={`catering-pagination-btn ${currentPage === pageNum ? 'active' : ''}`} 
                                                onClick={() => goToPage(pageNum)}
                                                aria-label={`Page ${pageNum}`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    return null;
                                })}
                                <button 
                                    className="catering-pagination-btn" 
                                    onClick={nextPage} 
                                    disabled={currentPage === totalPages}
                                    aria-label="Next page"
                                >
                                    ›
                                </button>
                                <button 
                                    className="catering-pagination-btn" 
                                    onClick={() => goToPage(totalPages)} 
                                    disabled={currentPage === totalPages}
                                    aria-label="Last page"
                                >
                                    »
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Render All Modals */}
            {showModal && renderEmployeeModal()}
            {showSalaryGradeModal && renderSalaryGradeModal()}
            {showPositionModal && renderPositionModal()}
            {showDepartmentModal && renderDepartmentModal()}
            {showComplianceModal && renderComplianceModal()}
            {showBenefitsModal && renderBenefitsModal()}
            {showReportsModal && renderReportsModal()}
            {showStatusFilterModal && <StatusFilterModal />}
            {showComplianceEditModal && renderComplianceEditModal()}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div 
                    className="catering-modal-overlay" 
                    onClick={(e) => e.stopPropagation()}
                >
                    <div 
                        className="catering-modal catering-confirm-modal" 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div className="catering-modal-header">
                            <h2 style={{ color: '#000000' }}>Confirm Archive</h2>
                            <button 
                                className="catering-modal-close" 
                                onClick={() => setShowDeleteConfirm(false)}
                                aria-label="Close"
                            >
                                <CloseOutlined />
                            </button>
                        </div>
                        <div 
                            className="catering-modal-body"
                            style={{
                                overflowY: 'auto',
                                flex: '1 1 auto',
                                padding: '24px',
                                maxHeight: 'calc(90vh - 140px)'
                            }}
                        >
                            <div className="catering-confirm-content">
                                <InboxOutlined className="catering-confirm-icon" />
                                <h3 style={{ color: '#000000' }}>Archive staff member?</h3>
                                <p style={{ color: '#000000' }}>Are you sure you want to archive <strong style={{ color: '#000000' }}>{employeeToDelete?.first_name} {employeeToDelete?.last_name}</strong>?<br />The employee will be moved to the archive and can be restored later.</p>
                            </div>
                        </div>
                        <div className="catering-modal-footer">
                            <button 
                                className="catering-btn" 
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={bulkUpdateStatusMutation.isPending}
                                style={{ color: '#000000' }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="catering-btn catering-btn-warning" 
                                onClick={confirmArchive} 
                                disabled={bulkUpdateStatusMutation.isPending}
                            >
                                {bulkUpdateStatusMutation.isPending ? <LoadingOutlined spin /> : <><InboxOutlined /> Archive</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal */}
            {showPrintModal && (
                <div 
                    className="catering-modal-overlay" 
                    onClick={(e) => e.stopPropagation()}
                >
                    <div 
                        className="catering-modal catering-small-modal" 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div className="catering-modal-header">
                            <h2 style={{ color: '#000000' }}>Print Staff Directory</h2>
                            <button 
                                className="catering-modal-close" 
                                onClick={() => setShowPrintModal(false)}
                                aria-label="Close"
                            >
                                <CloseOutlined />
                            </button>
                        </div>
                        <div 
                            className="catering-modal-body"
                            style={{
                                overflowY: 'auto',
                                flex: '1 1 auto',
                                padding: '24px',
                                maxHeight: 'calc(90vh - 140px)'
                            }}
                        >
                            <p style={{ color: '#000000' }}>Print all staff members with professional layout?</p>
                            <div className="catering-import-actions">
                                <button className="catering-btn" onClick={() => setShowPrintModal(false)} style={{ color: '#000000' }}>Cancel</button>
                                <button className="catering-btn catering-btn-primary" onClick={handlePrintAll}><PrinterOutlined /> Print All ({filteredEmployees.length})</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification */}
            {showNotification && <Notification />}

            {/* Success Animation */}
            {showSuccessAnimation && (<div className="catering-success-animation"><CheckCircleOutlined /><span>Staff Added Successfully!</span></div>)}
        </div>
    );
};

export default StaffManagement;