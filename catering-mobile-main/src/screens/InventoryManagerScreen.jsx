import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform,
  Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api';

/* ---------- helpers ---------- */
const unwrap = (response) => {
  let value = response?.data;
  if (value && Object.prototype.hasOwnProperty.call(value, 'data')) value = value.data;
  if (value && Object.prototype.hasOwnProperty.call(value, 'data') && Array.isArray(value.data)) value = value.data;
  return value;
};
const rowsOf = (value) => Array.isArray(value) ? value : (value?.data && Array.isArray(value.data) ? value.data : []);
const money = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v) => Number(v ?? 0);
const fmt = (v, d = 2) => Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: d });
const norm = (v) => String(v || '').toLowerCase();
const toYmd = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------- design tokens ---------- */
const C = {
  brand: '#E85D8F', brandDark: '#C13C6B', brandSoft: '#FCE7F3',
  ink: '#0F172A', inkSoft: '#334155', muted: '#64748B', faint: '#94A3B8',
  line: '#E8EDF5', bg: '#F5F7FB', surface: '#FFFFFF',
  success: '#15803D', successBg: '#DCFCE7',
  warning: '#B45309', warningBg: '#FEF3C7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
  teal: '#0F766E', tealBg: '#CCFBF1',
  indigo: '#4338CA', indigoBg: '#E0E7FF',
  sky: '#0369A1', skyBg: '#E0F2FE',
};
const R = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 };
const S = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 };
const shadow = {
  sm: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  lg: { shadowColor: '#E85D8F', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  nav: { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
};

/* ---------- animated pressable ---------- */
const Press = ({ children, style, onPress, disabled, activeScale = 0.96, ...rest }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: activeScale, useNativeDriver: true, friction: 6 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} onPress={onPress} disabled={disabled} {...rest}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
};

/* ---------- UI atoms ---------- */
const Badge = ({ label, tone = 'muted', icon }) => {
  const tones = {
    success: { bg: C.successBg, fg: C.success },
    warning: { bg: C.warningBg, fg: C.warning },
    danger: { bg: C.dangerBg, fg: C.danger },
    brand: { bg: C.brandSoft, fg: C.brandDark },
    muted: { bg: '#F1F5F9', fg: C.inkSoft },
    teal: { bg: C.tealBg, fg: C.teal },
    indigo: { bg: C.indigoBg, fg: C.indigo },
    sky: { bg: C.skyBg, fg: C.sky },
  };
  const t = tones[tone] || tones.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill }}>
      {icon ? <Feather name={icon} size={10} color={t.fg} /> : null}
      <Text style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4, color: t.fg }}>{label}</Text>
    </View>
  );
};

const SectionTitle = ({ title, right, count }) => (
  <View style={styles.sectionRow}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null ? <View style={styles.countChip}><Text style={styles.countText}>{count}</Text></View> : null}
    </View>
    {right}
  </View>
);

const EmptyState = ({ icon = 'inbox', title, hint }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrap}><Feather name={icon} size={28} color={C.brand} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
  </View>
);

const Field = ({ label, children }) => (
  <View style={{ marginTop: S.md }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

/* ---------- BOTTOM NAVIGATION ---------- */
const TAB_CONFIG = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'tasks', label: 'Tasks', icon: 'clipboard' },
  { key: 'ingredients', label: 'Inventory', icon: 'package' },
  { key: 'equipment', label: 'Equipment', icon: 'tool' },
  { key: 'requests', label: 'Requests', icon: 'shopping-cart' },
  { key: 'account', label: 'Account', icon: 'user' },
];

const NavItem = ({ item, isActive, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const bgProgress = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(bgProgress, { toValue: isActive ? 1 : 0, useNativeDriver: false, friction: 8, tension: 80 }).start();
  }, [isActive, bgProgress]);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 200 }).start();
  const labelColor = bgProgress.interpolate({ inputRange: [0, 1], outputRange: ['#94A3B8', C.brand] });

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.navItem} accessibilityRole="tab" accessibilityState={{ selected: isActive }}>
      <Animated.View style={[styles.navItemContent, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.navIconContainer, { backgroundColor: bgProgress.interpolate({ inputRange: [0, 1], outputRange: ['transparent', C.brand] }) }, isActive && styles.navIconContainerActive]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgProgress, alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name={item.icon} size={19} color="#FFFFFF" />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name={item.icon} size={19} color="#94A3B8" />
          </Animated.View>
        </Animated.View>
        <Animated.Text style={[styles.navLabel, { color: labelColor, fontWeight: isActive ? '800' : '600' }]} numberOfLines={1}>{item.label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

const BottomNav = ({ active, onChange }) => (
  <View style={styles.bottomNavWrapper} pointerEvents="box-none">
    <View style={[styles.bottomNavContainer, shadow.nav]}>
      <View style={styles.bottomNavInner}>
        {TAB_CONFIG.map((t) => (
          <NavItem key={t.key} item={t} isActive={active === t.key} onPress={() => onChange(t.key)} />
        ))}
      </View>
    </View>
  </View>
);

/* ---------- HOME SCREEN ---------- */
const HomeScreen = ({ ingredients, equipment, requests, events, onNavigate }) => {
  const lowStock = ingredients.filter((i) => {
    const cur = num(i.current_quantity ?? i.current_stock);
    const min = num(i.minimum_stock ?? i.minimum_quantity ?? i.reorder_point);
    return min > 0 && cur <= min;
  });
  const outOfStock = ingredients.filter((i) => num(i.current_quantity ?? i.current_stock) <= 0);
  const pendingPR = requests.filter((r) => norm(r.status) === 'pending');
  const ongoingEvents = events.filter((e) => norm(e.status) === 'ongoing');
  const completedEvents = events.filter((e) => norm(e.status) === 'completed');
  const upcomingEvents = events.filter((e) => ['confirmed', 'approved'].includes(norm(e.status)));

  const totalStockUnits = ingredients.reduce((sum, i) => sum + num(i.current_quantity ?? i.current_stock), 0);
  const totalEquipment = equipment.reduce((sum, e) => sum + num(e.total_quantity ?? e.total), 0);
  const damagedEquipment = equipment.reduce((sum, e) => sum + num(e.damaged_quantity ?? e.damaged), 0);
  const missingEquipment = equipment.reduce((sum, e) => sum + num(e.missing_quantity ?? e.missing), 0);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={{ gap: S.md }}>
      {/* Hero */}
      <View style={[styles.heroCard, shadow.md]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>{greeting.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>Inventory Center</Text>
            <Text style={styles.heroSubtitle}>{dateLabel}</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Feather name="activity" size={26} color={C.brand} />
          </View>
        </View>
        <View style={styles.heroStatsStrip}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{ongoingEvents.length}</Text>
            <Text style={styles.heroStatLabel}>Ongoing</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{upcomingEvents.length}</Text>
            <Text style={styles.heroStatLabel}>Upcoming</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{pendingPR.length}</Text>
            <Text style={styles.heroStatLabel}>Pending PR</Text>
          </View>
        </View>
      </View>

      {/* Insights — 2x2 grid */}
      <View style={styles.insightsGrid}>
        <Press onPress={() => onNavigate('ingredients')} style={[styles.insightCard, shadow.sm]}>
          <View style={[styles.insightIcon, { backgroundColor: C.brandSoft }]}>
            <Feather name="package" size={18} color={C.brand} />
          </View>
          <Text style={styles.insightValue}>{ingredients.length}</Text>
          <Text style={styles.insightLabel}>Ingredients</Text>
          <Text style={styles.insightSub}>{fmt(totalStockUnits, 0)} units total</Text>
        </Press>
        <Press onPress={() => onNavigate('equipment')} style={[styles.insightCard, shadow.sm]}>
          <View style={[styles.insightIcon, { backgroundColor: C.indigoBg }]}>
            <Feather name="tool" size={18} color={C.indigo} />
          </View>
          <Text style={styles.insightValue}>{equipment.length}</Text>
          <Text style={styles.insightLabel}>Equipment</Text>
          <Text style={styles.insightSub}>{fmt(totalEquipment, 0)} units</Text>
        </Press>
        <Press onPress={() => onNavigate('ingredients')} style={[styles.insightCard, shadow.sm]}>
          <View style={[styles.insightIcon, { backgroundColor: C.warningBg }]}>
            <Feather name="alert-triangle" size={18} color={C.warning} />
          </View>
          <Text style={styles.insightValue}>{lowStock.length}</Text>
          <Text style={styles.insightLabel}>Low Stock</Text>
          <Text style={styles.insightSub}>{outOfStock.length} out of stock</Text>
        </Press>
        <Press onPress={() => onNavigate('requests')} style={[styles.insightCard, shadow.sm]}>
          <View style={[styles.insightIcon, { backgroundColor: C.tealBg }]}>
            <Feather name="shopping-cart" size={18} color={C.teal} />
          </View>
          <Text style={styles.insightValue}>{pendingPR.length}</Text>
          <Text style={styles.insightLabel}>Pending PR</Text>
          <Text style={styles.insightSub}>{requests.length} total requests</Text>
        </Press>
      </View>

      {/* Ongoing Events */}
      <View style={[styles.blockCard, shadow.sm]}>
        <View style={styles.blockHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.blockDot, { backgroundColor: C.success }]} />
            <Text style={styles.blockTitle}>Ongoing Events</Text>
            <Badge label={String(ongoingEvents.length)} tone="success" />
          </View>
          <Press onPress={() => onNavigate('tasks')} style={styles.blockLink}>
            <Text style={styles.blockLinkText}>Open Tasks</Text>
            <Feather name="arrow-right" size={12} color={C.brand} />
          </Press>
        </View>
        {ongoingEvents.length === 0 ? (
          <Text style={styles.blockEmpty}>No events started yet.</Text>
        ) : (
          ongoingEvents.slice(0, 3).map((e) => (
            <Press key={e.id || e.event_id} onPress={() => onNavigate('tasks')} style={styles.eventRow}>
              <View style={[styles.eventIcon, { backgroundColor: C.successBg }]}>
                <Feather name="zap" size={14} color={C.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{e.booking_no || `BK-${e.id}`}</Text>
                <Text style={styles.eventMeta}>{e.customer_name || '—'} · {e.event_date || 'TBD'}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={C.faint} />
            </Press>
          ))
        )}
      </View>

      {/* Event Monitoring */}
      <View style={[styles.blockCard, shadow.sm]}>
        <View style={styles.blockHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.blockDot, { backgroundColor: C.sky }]} />
            <Text style={styles.blockTitle}>Event Monitoring</Text>
          </View>
        </View>
        <View style={styles.monitorRow}>
          <View style={styles.monitorItem}>
            <View style={[styles.monitorIcon, { backgroundColor: C.skyBg }]}>
              <Feather name="calendar" size={14} color={C.sky} />
            </View>
            <Text style={styles.monitorValue}>{upcomingEvents.length}</Text>
            <Text style={styles.monitorLabel}>Upcoming</Text>
          </View>
          <View style={styles.monitorDivider} />
          <View style={styles.monitorItem}>
            <View style={[styles.monitorIcon, { backgroundColor: C.warningBg }]}>
              <Feather name="activity" size={14} color={C.warning} />
            </View>
            <Text style={styles.monitorValue}>{ongoingEvents.length}</Text>
            <Text style={styles.monitorLabel}>Ongoing</Text>
          </View>
          <View style={styles.monitorDivider} />
          <View style={styles.monitorItem}>
            <View style={[styles.monitorIcon, { backgroundColor: C.successBg }]}>
              <Feather name="check-circle" size={14} color={C.success} />
            </View>
            <Text style={styles.monitorValue}>{completedEvents.length}</Text>
            <Text style={styles.monitorLabel}>Completed</Text>
          </View>
        </View>
      </View>

      {/* Dashboard */}
      <View style={[styles.blockCard, shadow.sm]}>
        <View style={styles.blockHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.blockDot, { backgroundColor: C.indigo }]} />
            <Text style={styles.blockTitle}>Dashboard</Text>
          </View>
        </View>
        <View style={styles.dashboardGrid}>
          <View style={styles.dashItem}>
            <Feather name="layers" size={16} color={C.brand} />
            <Text style={styles.dashValue}>{fmt(totalStockUnits, 0)}</Text>
            <Text style={styles.dashLabel}>Stock Units</Text>
          </View>
          <View style={styles.dashItem}>
            <Feather name="box" size={16} color={C.indigo} />
            <Text style={styles.dashValue}>{fmt(totalEquipment, 0)}</Text>
            <Text style={styles.dashLabel}>Equipment</Text>
          </View>
          <View style={styles.dashItem}>
            <Feather name="shopping-bag" size={16} color={C.teal} />
            <Text style={styles.dashValue}>{requests.length}</Text>
            <Text style={styles.dashLabel}>Requests</Text>
          </View>
        </View>
        {(damagedEquipment > 0 || missingEquipment > 0) && (
          <View style={styles.damageStrip}>
            <Feather name="alert-triangle" size={14} color={C.warning} />
            <Text style={styles.damageText}>
              {damagedEquipment} damaged · {missingEquipment} missing equipment
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

/* ---------- ACCOUNT SCREEN ---------- */
const AccountScreen = ({ user, onLogout, stats }) => {
  const initials = (user?.name || 'Inventory Manager').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const rows = [
    { icon: 'mail', label: 'Email', value: user?.email || 'inventory@dearbabs.com' },
    { icon: 'phone', label: 'Phone', value: user?.phone || 'Not set' },
    { icon: 'shield', label: 'Role', value: user?.role || 'Inventory Manager' },
    { icon: 'briefcase', label: 'Department', value: user?.department || 'Kitchen Operations' },
  ];
  return (
    <View style={{ gap: S.sm }}>
      <View style={[styles.profileCard, shadow.md]}>
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{initials}</Text></View>
        <Text style={styles.profileName}>{user?.name || 'Inventory Manager'}</Text>
        <Badge label="ACTIVE ACCOUNT" tone="success" icon="check-circle" />
        <View style={styles.profileStatsRow}>
          <View style={styles.profileStatItem}><Text style={styles.profileStatValue}>{stats?.ingredients ?? 0}</Text><Text style={styles.profileStatLabel}>Ingredients</Text></View>
          <View style={styles.profileDivider} />
          <View style={styles.profileStatItem}><Text style={styles.profileStatValue}>{stats?.equipment ?? 0}</Text><Text style={styles.profileStatLabel}>Equipment</Text></View>
          <View style={styles.profileDivider} />
          <View style={styles.profileStatItem}><Text style={styles.profileStatValue}>{stats?.pending ?? 0}</Text><Text style={styles.profileStatLabel}>Pending</Text></View>
        </View>
      </View>
      <SectionTitle title="Account information" />
      <View style={[styles.infoCard, shadow.sm]}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.infoRow, i < rows.length - 1 && styles.infoRowDivider]}>
            <View style={styles.infoIconWrap}><Feather name={r.icon} size={15} color={C.brand} /></View>
            <View style={{ flex: 1 }}><Text style={styles.infoLabel}>{r.label}</Text><Text style={styles.infoValue}>{r.value}</Text></View>
          </View>
        ))}
      </View>
      <Press onPress={() => onLogout?.()} style={[styles.logoutCard, shadow.sm]}>
        <View style={styles.logoutIconWrap}><Feather name="log-out" size={18} color={C.danger} /></View>
        <View style={{ flex: 1 }}><Text style={styles.logoutTitle}>Sign out</Text><Text style={styles.logoutSub}>You will need to sign in again</Text></View>
        <Feather name="chevron-right" size={18} color={C.faint} />
      </Press>
      <Text style={styles.versionText}>Dear Bab's Catering · v1.0.0</Text>
    </View>
  );
};

/* ---------- MAIN ---------- */
export default function InventoryManagerScreen({ navigation, onLogout, user }) {
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({});
  const [ingredients, setIngredients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);

  /* request modal */
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [requestQuantity, setRequestQuantity] = useState('1');
  const [requestUrgency, setRequestUrgency] = useState('normal');
  const [requestNotes, setRequestNotes] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* detail / movement / damage / history */
  const [openFolder, setOpenFolder] = useState(null);
  const [ingredientDetailOpen, setIngredientDetailOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [equipmentDamageOpen, setEquipmentDamageOpen] = useState(false);
  const [equipmentHistoryOpen, setEquipmentHistoryOpen] = useState(false);
  const [equipmentHistory, setEquipmentHistory] = useState([]);
  const [movementType, setMovementType] = useState('purchase');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementPurchasedBy, setMovementPurchasedBy] = useState('');
  const [movementDeliveredBy, setMovementDeliveredBy] = useState('');
  const [movementReceivedBy, setMovementReceivedBy] = useState('');
  const [movementSupplier, setMovementSupplier] = useState('');
  const [movementReference, setMovementReference] = useState('');
  const [damageQty, setDamageQty] = useState('');
  const [missingQty, setMissingQty] = useState('');
  const [damageReason, setDamageReason] = useState('');

  /* ingredient review modal — Actual Use editable */
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState(null);
  const [reviewRows, setReviewRows] = useState([]); // [{ ingredient_id, name, unit, required, available, actual }]
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    const jobs = await Promise.allSettled([
      api.get('/v1/inventory/dashboard-stats'),
      api.get('/v1/ingredients', { params: { per_page: 100 } }),
      api.get('/v1/equipment', { params: { per_page: 100 } }),
      api.get('/v1/inventory/purchase-requests', { params: { per_page: 100 } }),
      api.get('/v1/events', {
        params: { per_page: 100, status_in: 'confirmed,approved,ongoing,rescheduled,missed_delivery,missed_pickup' },
      }),
    ]);
    const failures = [];
    jobs.forEach((job, index) => {
      if (job.status === 'rejected') {
        failures.push(['summary', 'ingredients', 'equipment', 'purchase requests', 'meal tasks'][index]);
        return;
      }
      const payload = unwrap(job.value);
      if (index === 0) setStats(payload || {});
      if (index === 1) setIngredients(rowsOf(payload));
      if (index === 2) setEquipment(rowsOf(payload));
      if (index === 3) setRequests(rowsOf(payload));
      if (index === 4) setEvents(rowsOf(payload));
    });
    if (failures.length) setError(`Some sections could not load: ${failures.join(', ')}. Pull down to retry.`);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---------- task folders ---------- */
  const taskFolders = useMemo(() => {
    const byBooking = new Map();
    const APPROVED = ['confirmed', 'approved', 'ongoing', 'rescheduled', 'missed_delivery', 'missed_pickup'];

    events.forEach((event) => {
      const status = norm(event.status || event.booking_status);
      if (!APPROVED.includes(status)) return;
      if (!event.id && !event.event_id) return;

      const bookingId = event.id || event.event_id;
      const meals = event.meal_services || event.meal_schedule || [];
      const mealById = new Map(meals.map((m) => [String(m.meal_service_id || m.id), m]));

      const eventTasks = (event.kitchen_preparation || [])
        .filter((t) => !t.is_header)
        .map((t) => {
          const meal = mealById.get(String(t.meal_service_id || '')) || {};
          return {
            ...t,
            event_id: bookingId,
            booking_id: bookingId,
            booking_no: event.booking_no,
            event_name: event.display_name || event.event_name || event.booking_no || 'Catering event',
            event_date: t.service_date || meal.service_date || meal.date || event.event_date || event.date,
            day_number: t.day_number || meal.day_number || 1,
            meal_label: [t.meal_type || meal.meal_type, t.serving_time || meal.serving_time].filter(Boolean).join(' · '),
            serving_time: t.serving_time || meal.serving_time,
            meal_preparation_status: t.meal_preparation_status || meal.preparation_status || 'pending',
            is_packed_or_tray: Boolean(event.is_packed_or_tray || ['packed', 'tray'].includes(norm(event.service_type))),
            is_done: t.is_done === true || t.is_done === 1 || t.is_done === '1' || t.status === 'completed',
            deduction_id: t.deduction_id || null,
          };
        });

      const dates = eventTasks.map((t) => t.event_date).filter(Boolean).sort();
      const folderDate = dates[0] || event.event_date || event.date;
      const isToday = toYmd(folderDate) === toYmd(new Date());

      if (!byBooking.has(bookingId)) {
        byBooking.set(bookingId, {
          booking_id: bookingId,
          booking_no: event.booking_no || `BK-${bookingId}`,
          customer_name: event.customer_name,
          event_name: event.event_name || event.display_name,
          event_date: folderDate,
          is_today: isToday,
          status,
          tasks: [],
          done_count: 0,
          mealGroups: {},
        });
      }
      const folder = byBooking.get(bookingId);

      eventTasks.forEach((task) => {
        const key = String(task.meal_service_id || `meal-${task.day_number}-${task.meal_label}`);
        if (!folder.mealGroups[key]) {
          folder.mealGroups[key] = {
            meal_service_id: task.meal_service_id || null,
            meal_type: task.meal_type || 'Meal',
            meal_label: task.meal_label || task.meal_type || 'Meal',
            day_number: task.day_number || 1,
            serving_time: task.serving_time || null,
            tasks: [],
            done_count: 0,
          };
        }
        const enriched = {
          ...task,
          quantity: task.quantity ?? task.servings ?? task.pax ?? null,
          start_time: task.start_time || task.prepare_time || '—',
          out_for_delivery: task.out_for_delivery || task.delivery_time || '—',
          assigned_to: task.assigned_to || task.assigned || 'Kitchen Team',
        };
        folder.mealGroups[key].tasks.push(enriched);
        if (enriched.is_done) folder.mealGroups[key].done_count += 1;
      });

      folder.tasks.push(...eventTasks);
      folder.done_count += eventTasks.filter((t) => t.is_done).length;
    });

    Array.from(byBooking.values()).forEach((folder) => {
      folder.mealGroups = Object.values(folder.mealGroups).sort((a, b) => {
        if (a.day_number !== b.day_number) return a.day_number - b.day_number;
        return String(a.meal_type).localeCompare(String(b.meal_type));
      });
      folder.is_complete = folder.tasks.length > 0 && folder.done_count === folder.tasks.length;
    });

    const todayStr = toYmd(new Date());
    const bucket = (f) => {
      if (f.status === 'ongoing') return 0;
      if (!f.event_date) return 4;
      const d = String(f.event_date).slice(0, 10);
      if (d === todayStr) return 1;
      if (d > todayStr) return 2;
      return 3;
    };
    return Array.from(byBooking.values()).sort((a, b) => {
      const diff = bucket(a) - bucket(b);
      if (diff !== 0) return diff;
      return String(a.booking_no).localeCompare(String(b.booking_no));
    });
  }, [events]);

  /* helpers */
  const lowStock = ingredients.filter((i) => {
    const cur = num(i.current_quantity ?? i.current_stock);
    const min = num(i.minimum_stock ?? i.minimum_quantity ?? i.reorder_point);
    return min > 0 && cur <= min;
  });
  const pendingRequests = requests.filter((r) => norm(r.status) === 'pending');
  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return ingredients;
    const q = ingredientSearch.toLowerCase();
    return ingredients.filter((i) => norm(i.name || i.ingredient_name).includes(q));
  }, [ingredients, ingredientSearch]);

  /* ---------- actions ---------- */
  const startMeal = async (task, confirmIncomplete = false) => {
    if (!task.meal_service_id) {
      Alert.alert('Meal service unavailable', 'This task is not linked to a meal service.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/v1/events/${task.booking_id}/meals/${task.meal_service_id}/start`, { confirm_incomplete_previous: confirmIncomplete });
      await load(true);
       } catch (e) {
      const body = e?.response?.data || {};
      const code = body?.data?.code || body?.code || body?.errors?.code;

      if (code === 'previous_meal_incomplete') {
        // ⭐ The backend requires the previous meal to be finished first.
        Alert.alert(
          'Incomplete Previous Meal',
          body.message || 'You have not completed all the tasks for the previous meal. Are you sure you want to start the next meal?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Yes, start anyway', 
              style: 'destructive', 
              onPress: () => startMeal(task, true) 
            },
          ]
        );
      } else {
        Alert.alert('Unable to start meal', body.message || 'The event must be started first.');
      }
    } finally { setSubmitting(false); }
  };

  /**
   * ⭐ Open ingredient review modal (Done flow).
   * Shows Unit, Required, Available, Actual Use (editable).
   */
  const openReview = async (task) => {
    if (!task.meal_service_id) {
      Alert.alert('Meal service unavailable', 'Update the task on web first.');
      return;
    }
    setReviewTask(task);
    setReviewRows([]);
    setReviewError('');
    setReviewOpen(true);
    setReviewLoading(true);
    try {
      const response = await api.get(`/v1/bookings/${task.booking_id}/meal-service/${task.meal_service_id}/ingredients`);
      const data = unwrap(response) || {};
      const items = data.ingredients || [];
      if (!items.length) {
        setReviewError('No recipe ingredients linked to this menu. Inventory was not changed.');
        setReviewLoading(false);
        return;
      }
      setReviewRows(items.map((i) => {
        const required = num(i.quantity_needed ?? i.required_quantity);
        const available = num(i.available_stock ?? i.current_stock ?? i.available);
        return {
          ingredient_id: Number(i.ingredient_id),
          name: i.name || 'Ingredient',
          unit: i.unit || '',
          required,
          available,
          actual: String(required),
          shortage: Math.max(0, required - available),
        };
      }));
    } catch (e) {
      setReviewError(e?.response?.data?.message || 'Could not load recipe ingredients.');
    } finally {
      setReviewLoading(false);
    }
  };

  const updateActual = (ingredientId, value) => {
    setReviewRows((prev) => prev.map((r) => r.ingredient_id === ingredientId ? { ...r, actual: value } : r));
  };

  const confirmReviewAndDeduct = async () => {
    if (!reviewTask) return;
    const invalid = reviewRows.find((r) => {
      const n = Number(r.actual);
      return !Number.isFinite(n) || n < 0;
    });
    if (invalid) {
      Alert.alert('Invalid quantity', `Enter a valid actual quantity for "${invalid.name}".`);
      return;
    }
    const used = reviewRows
      .filter((r) => Number(r.actual) > 0)
      .map((r) => ({ ingredient_id: r.ingredient_id, quantity: Number(r.actual), unit: r.unit || null }));
    if (!used.length) {
      Alert.alert('Nothing to deduct', 'All actual quantities are zero. Nothing will be deducted.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/v1/events/${reviewTask.booking_id}/kitchen-task/complete`, {
        task_id: String(reviewTask.id),
        meal_service_id: reviewTask.meal_service_id,
        menu_item_id: reviewTask.menu_item_id,
        ingredients: used,
      });
      setReviewOpen(false);
      setReviewTask(null);
      setReviewRows([]);
      await load(true);
    } catch (e) {
      const body = e?.response?.data || {};
      const shortages = body?.data?.shortages || body?.shortages;
      if (Array.isArray(shortages) && shortages.length > 0) {
        Alert.alert('Insufficient stock', shortages.map((s) => `${s.name}: need ${s.required}, only ${s.available} available`).join('\n'));
      } else {
        Alert.alert('Could not complete', body.message || 'Try again.');
      }
    } finally { setSubmitting(false); }
  };

  const undoTask = async (task) => {
    if (!task?.meal_service_id) {
      Alert.alert('Meal service unavailable', 'This task is not linked to a meal service.');
      return;
    }
    Alert.alert('Undo this task?', 'Ingredient stock will be restored.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo & restore',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await api.post(`/v1/events/${task.booking_id}/kitchen-task/uncomplete`, {
              task_id: String(task.id),
              deduction_id: task.deduction_id || null,
            });
            Alert.alert('Undone', 'Stock has been restored.');
            await load(true);
          } catch (e) {
            Alert.alert('Could not undo', e?.response?.data?.message || 'Try again.');
          } finally { setSubmitting(false); }
        },
      },
    ]);
  };

  const completeEvent = async (folder) => {
    Alert.alert(
      'Complete this event?',
      'All meal tasks are done. Completing removes this event from Meal Preparation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete event',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post(`/v1/events/${folder.booking_id}/complete`, { force_complete: false });
              await load(true);
            } catch (e) {
              const body = e?.response?.data || {};
              if (body?.data?.requires_confirmation || body?.requires_confirmation) {
                Alert.alert(
                  'Outstanding balance',
                  body.message || 'Pay the balance or confirm as debt booking.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Complete as debt',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await api.post(`/v1/events/${folder.booking_id}/complete`, {
                            force_complete: true,
                            reason: 'Completed with outstanding balance from mobile.',
                          });
                          await load(true);
                        } catch (err) {
                          Alert.alert('Could not complete', err?.response?.data?.message || 'Try again.');
                        }
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Could not complete event', body.message || 'Try again.');
              }
            } finally { setSubmitting(false); }
          },
        },
      ]
    );
  };

  /* movement submit with inline validation */
  const [movementErrors, setMovementErrors] = useState({});
  const submitMovement = async () => {
    const errors = {};
    const isEquipment = Boolean(selectedEquipment) && !selectedIngredient;
    const target = selectedIngredient || selectedEquipment;

    if (!target) errors.item = 'Select an ingredient or equipment.';
    const qty = Number(movementQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.quantity = 'Enter a quantity greater than zero.';
    } else if (movementType === 'usage') {
      const available = isEquipment
        ? num(selectedEquipment?.available_quantity ?? selectedEquipment?.available)
        : num(selectedIngredient?.current_quantity ?? selectedIngredient?.current_stock);
      if (qty > available) errors.quantity = `Only ${available} ${isEquipment ? 'units' : selectedIngredient?.unit || ''} available.`;
    }
    if (!movementReason.trim()) errors.reason = 'Reason is required.';
    if (movementType === 'purchase' && !movementPurchasedBy.trim()) errors.purchased_by = 'Purchased By is required for stock in.';

    setMovementErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);
      if (isEquipment) {
        const id = target.booking_equipment_id || target.id;
        await api.put(`/v1/equipment/tracking/${id}`, {
          quantity_reserved: movementType === 'purchase'
            ? Math.max(1, num(target.quantity_reserved) + qty)
            : Math.max(0, num(target.quantity_reserved) - qty),
          notes: `${movementType === 'purchase' ? 'Stock In' : 'Stock Out'}: ${movementReason.trim()}`,
        });
      } else {
        await api.post('/v1/inventory/movements', {
          ingredient_id: Number(selectedIngredient.ingredient_id),
          movement_type: movementType,
          quantity_change: movementType === 'purchase' ? qty : -qty,
          reason: movementReason.trim(),
          purchased_by_name: movementPurchasedBy.trim() || null,
          delivered_by: movementDeliveredBy.trim() || null,
          received_by: movementReceivedBy.trim() || null,
          supplier_name: movementSupplier.trim() || null,
          reference_number: movementReference.trim() || null,
        });
      }
      setMovementOpen(false);
      setMovementQuantity(''); setMovementReason('');
      setMovementPurchasedBy(''); setMovementDeliveredBy(''); setMovementReceivedBy('');
      setMovementSupplier(''); setMovementReference(''); setMovementErrors({});
      await load(true);
    } catch (e) {
      Alert.alert('Movement failed', e?.response?.data?.message || 'Unable to record.');
    } finally { setSubmitting(false); }
  };

  const [damageErrors, setDamageErrors] = useState({});
  const submitEquipmentDamage = async () => {
    const errors = {};
    if (!selectedEquipment) errors.item = 'Select equipment.';
    const dmg = Number(damageQty) || 0;
    const mss = Number(missingQty) || 0;
    if (dmg <= 0 && mss <= 0) errors.quantity = 'Enter damaged or missing quantity.';
    if (!damageReason.trim()) errors.reason = 'Reason is required.';

    setDamageErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);
      await api.post(`/v1/equipment/checkin/${selectedEquipment.booking_equipment_id || selectedEquipment.id}`, {
        quantity_used: 0, quantity_damaged: dmg, quantity_missing: mss,
        condition_notes_in: damageReason.trim(), notes: damageReason.trim(),
      });
      setEquipmentDamageOpen(false);
      setDamageQty(''); setMissingQty(''); setDamageReason(''); setDamageErrors({});
      await load(true);
    } catch (e) {
      Alert.alert('Save failed', e?.response?.data?.message || 'Try again.');
    } finally { setSubmitting(false); }
  };

  const loadEquipmentHistory = async (equipment) => {
    try {
      setEquipmentHistory([]); setEquipmentHistoryOpen(true);
      const response = await api.get(`/v1/equipment/${equipment.equipment_id || equipment.id}/history`);
      setEquipmentHistory(rowsOf(unwrap(response)).map((row) => ({
        movement_type: row.movement_type || row.status || 'reservation',
        quantity: row.quantity ?? row.quantity_reserved ?? 0,
        unit: row.unit || 'pcs',
        movement_at: row.movement_at || row.created_at || row.updated_at,
      })));
    } catch (e) { setEquipmentHistory([]); }
  };

  const [requestErrors, setRequestErrors] = useState({});
  const submitPurchaseRequest = async () => {
    const errors = {};
    if (!selectedIngredient) errors.ingredient = 'Select an ingredient.';
    const qty = Number(requestQuantity);
    if (!Number.isFinite(qty) || qty <= 0) errors.quantity = 'Enter quantity greater than zero.';

    setRequestErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);
      await api.post('/v1/inventory/purchase-requests', {
        ingredient_id: Number(selectedIngredient.ingredient_id),
        quantity: qty,
        urgency: requestUrgency,
        notes: requestNotes.trim() || 'Requested from Inventory Manager mobile app',
      });
      setRequestOpen(false);
      setSelectedIngredient(null); setRequestQuantity('1'); setRequestUrgency('normal');
      setRequestNotes(''); setIngredientSearch(''); setRequestErrors({});
      await load(true);
    } catch (e) {
      Alert.alert('Request failed', e?.response?.data?.message || 'Unable to submit.');
    } finally { setSubmitting(false); }
  };

  const headerMeta = {
    home: { title: 'Dashboard', subtitle: 'Inventory overview' },
    tasks: { title: 'Meal Preparation', subtitle: `${taskFolders.length} booking${taskFolders.length !== 1 ? 's' : ''}` },
    ingredients: { title: 'Ingredients', subtitle: `${ingredients.length} items` },
    equipment: { title: 'Equipment', subtitle: `${equipment.length} items` },
    requests: { title: 'Requests', subtitle: `${pendingRequests.length} pending` },
    account: { title: 'Account', subtitle: 'Profile' },
  }[tab] || { title: 'Inventory', subtitle: '' };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.brand} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}><View style={styles.brandDot} /><Text style={styles.eyebrow}>DEAR BAB'S CATERING</Text></View>
          <Text style={styles.title}>{headerMeta.title}</Text>
          <Text style={styles.subtitle}>{headerMeta.subtitle}</Text>
        </View>
        {tab !== 'account' && (
          <Press onPress={() => load(true)} style={styles.headerIconBtn}>
            <Feather name="refresh-cw" size={17} color={C.brandDark} />
          </Press>
        )}
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.brand} />}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-triangle" size={16} color={C.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.brand} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          <>
            {tab === 'home' && <HomeScreen ingredients={ingredients} equipment={equipment} requests={requests} events={events} onNavigate={setTab} />}

            {tab === 'tasks' && (
              <View style={{ gap: S.sm }}>
                {taskFolders.length === 0 ? (
                  <EmptyState icon="clipboard" title="No meal tasks" hint="Approved bookings will appear here." />
                ) : taskFolders.map((folder) => {
                  const total = folder.tasks.length;
                  const done = folder.done_count;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  const isOpen = openFolder === folder.booking_id;
                  const isOngoing = folder.status === 'ongoing';
                  const isComplete = folder.is_complete;

                  return (
                    <View key={folder.booking_id} style={[styles.folderCard, shadow.sm, isOngoing && styles.folderCardOngoing, isComplete && styles.folderCardComplete]}>
                      <Press onPress={() => setOpenFolder(isOpen ? null : folder.booking_id)}>
                        <View style={styles.folderHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={styles.folderTitle}>{folder.booking_no}</Text>
                              {isOngoing && <Badge label="ONGOING" tone="warning" icon="zap" />}
                              {folder.is_today && !isOngoing && <Badge label="TODAY" tone="brand" icon="star" />}
                              {isComplete && <Badge label="COMPLETE" tone="success" icon="check" />}
                            </View>
                            <Text style={styles.folderMeta}>{folder.customer_name || '—'} · {folder.event_date || 'TBD'}</Text>
                          </View>
                          <View style={styles.folderProgress}><Text style={styles.folderProgressText}>{done}/{total}</Text></View>
                          <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: isComplete ? C.success : C.brand }]} />
                        </View>
                      </Press>

                      {isOpen && folder.tasks.length === 0 && (
                        <View style={styles.warnBox}>
                          <Feather name="alert-triangle" size={14} color={C.warning} />
                          <Text style={styles.warnBoxText}>No kitchen tasks generated yet.</Text>
                        </View>
                      )}

                      {isOpen && folder.tasks.length > 0 && (
                        <View style={{ marginTop: S.md, gap: 12 }}>
                          {folder.mealGroups.map((group, gi) => (
                            <View key={`${group.meal_service_id || gi}`} style={styles.mealBlock}>
                              <View style={styles.mealHeader}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.mealTitle}>Day {group.day_number} · {String(group.meal_type).toUpperCase()}</Text>
                                  <Text style={styles.mealMeta}>{group.serving_time || 'Time TBD'}</Text>
                                </View>
                                <Badge label={`${group.done_count}/${group.tasks.length}`} tone={group.done_count === group.tasks.length ? 'success' : group.done_count > 0 ? 'warning' : 'muted'} />
                              </View>
                              <View style={{ gap: 8, marginTop: 10 }}>
                                {group.tasks.map((task, index) => {
                                  const prepStatus = norm(task.meal_preparation_status);
                                  const inProgress = ['preparing', 'in_progress'].includes(prepStatus);
                                  return (
                                    <View key={`${task.id || index}`} style={styles.taskItem}>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.taskItemTitle}>{task.task || task.name || 'Meal task'}</Text>
                                        <View style={styles.taskMetaRow}>
                                          <Text style={styles.taskMetaText}>QTY {task.quantity ?? '—'}</Text>
                                          <Text style={styles.taskMetaDot}>•</Text>
                                          <Text style={styles.taskMetaText}>{task.start_time}</Text>
                                          <Text style={styles.taskMetaDot}>•</Text>
                                          <Text style={styles.taskMetaText}>{task.out_for_delivery}</Text>
                                        </View>
                                        <Text style={styles.taskAssignee}>👤 {task.assigned_to}</Text>
                                      </View>
                                      {task.is_done ? (
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                          <Badge label="DONE" tone="success" icon="check" />
                                          <Press onPress={() => undoTask(task)} disabled={submitting} style={styles.undoBtn}>
                                            <Feather name="rotate-ccw" size={11} color={C.danger} />
                                          </Press>
                                        </View>
                                      ) : inProgress || task.is_packed_or_tray ? (
                                        <Press onPress={() => openReview(task)} disabled={submitting} style={styles.doneBtn}>
                                          <Feather name="check-circle" size={12} color="#FFF" />
                                          <Text style={styles.doneBtnText}>Done</Text>
                                        </Press>
                                      ) : (
                                        <Press onPress={() => startMeal(task)} disabled={submitting} style={styles.startBtn}>
                                          <Feather name="play" size={12} color={C.brand} />
                                          <Text style={styles.startBtnText}>Start</Text>
                                        </Press>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          ))}

                          {isComplete && (
                            <Press onPress={() => completeEvent(folder)} disabled={submitting} style={styles.completeEventBtn}>
                              <Feather name="check-circle" size={16} color="#FFF" />
                              <Text style={styles.completeEventText}>Complete Event</Text>
                            </Press>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {tab === 'ingredients' && (
              <View style={{ gap: S.sm }}>
                {lowStock.length > 0 && (
                  <View style={styles.warnBanner}>
                    <Feather name="alert-triangle" size={15} color={C.warning} />
                    <Text style={styles.warnText}>{lowStock.length} low-stock item{lowStock.length !== 1 ? 's' : ''}</Text>
                  </View>
                )}
                {ingredients.length === 0 ? (
                  <EmptyState icon="package" title="No ingredients" hint="Add ingredients on web first." />
                ) : ingredients.map((item, index) => {
                  const current = num(item.current_quantity ?? item.current_stock);
                  const unit = item.unit || '';
                  const minimum = num(item.minimum_stock ?? item.minimum_quantity ?? item.reorder_point);
                  const isLow = minimum > 0 && current <= minimum;
                  const isOut = current <= 0;
                  const pct = minimum > 0 ? Math.min(100, (current / Math.max(minimum * 2, 1)) * 100) : 0;
                  const needsAction = isLow || isOut;

                  return (
                    <View key={item.ingredient_id || item.id || index} style={[styles.invCard, shadow.sm]}>
                      <View style={styles.invRow}>
                        <View style={[styles.invIcon, { backgroundColor: needsAction ? C.dangerBg : C.brandSoft }]}>
                          <Feather name="package" size={18} color={needsAction ? C.danger : C.brand} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.invTitle}>{item.name || item.ingredient_name}</Text>
                          <Text style={styles.invMeta}>{current} {unit} · Min {minimum || '—'}</Text>
                        </View>
                        <Badge label={isOut ? 'OUT' : isLow ? 'CRITICAL' : 'OK'} tone={isOut ? 'danger' : isLow ? 'warning' : 'success'} />
                      </View>

                      {minimum > 0 && (
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: isOut ? C.danger : isLow ? C.warning : C.success }]} />
                        </View>
                      )}

                      <View style={styles.invActions}>
                        <Press onPress={() => { setSelectedIngredient(item); setSelectedEquipment(null); setMovementOpen(true); }} style={styles.invActionBtn}>
                          <Feather name="plus" size={12} color={C.brand} />
                          <Text style={styles.invActionBtnText}>Add</Text>
                        </Press>
                                                {needsAction && (
                          <Press onPress={() => { 
                            setSelectedIngredient(item); 
                            setRequestQuantity('1'); 
                            setRequestNotes(''); 
                            setIngredientSearch(item.name || item.ingredient_name || ''); 
                            setRequestErrors({}); 
                            setRequestOpen(true); 
                          }} style={[styles.invActionBtn, styles.invActionBtnDanger]}>
                            <Feather name="shopping-bag" size={12} color={C.danger} />
                            <Text style={[styles.invActionBtnText, { color: C.danger }]}>Request</Text>
                          </Press>
                        )}
                        {needsAction && (
                          <Press onPress={() => { setSelectedIngredient(item); setIngredientDetailOpen(true); }} style={styles.invActionBtn}>
                            <Feather name="info" size={12} color={C.brand} />
                            <Text style={styles.invActionBtnText}>Details</Text>
                          </Press>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {tab === 'equipment' && (
              <View style={{ gap: S.sm }}>
                {equipment.length === 0 ? (
                  <EmptyState icon="tool" title="No equipment" hint="Add equipment on web first." />
                ) : equipment.map((item, index) => {
                  const total = num(item.total_quantity ?? item.total);
                  const reserved = num(item.reserved_quantity ?? item.reserved);
                  const damaged = num(item.damaged_quantity ?? item.damaged);
                  const missing = num(item.missing_quantity ?? item.missing);
                  const available = num(item.available_quantity ?? item.available ?? Math.max(0, total - reserved - damaged - missing));
                  const statusTone = available <= 0 ? 'danger' : available <= 5 ? 'warning' : 'success';

                  return (
                    <View key={item.equipment_id || item.id || index} style={[styles.invCard, shadow.sm]}>
                      <View style={styles.invRow}>
                        <View style={[styles.invIcon, { backgroundColor: C.indigoBg }]}>
                          <MaterialCommunityIcons name="blender" size={18} color={C.indigo} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.invTitle}>{item.name || item.equipment_name}</Text>
                          <Text style={styles.invMeta}>Code: {item.code || '—'} · {item.condition || 'Good'}</Text>
                        </View>
                        <Badge label={`${available} avail`} tone={statusTone} />
                      </View>

                      <View style={styles.metaChipsRow}>
                        <View style={styles.metaChipMini}><Text style={styles.metaChipMiniText}>Total {total}</Text></View>
                        <View style={styles.metaChipMini}><Text style={styles.metaChipMiniText}>Reserved {reserved}</Text></View>
                        <View style={styles.metaChipMini}><Text style={styles.metaChipMiniText}>Damaged {damaged}</Text></View>
                        <View style={styles.metaChipMini}><Text style={styles.metaChipMiniText}>Missing {missing}</Text></View>
                      </View>

                      <View style={styles.invActions}>
                        <Press onPress={() => { setSelectedIngredient(null); setSelectedEquipment(item); setMovementOpen(true); }} style={styles.invActionBtn}>
                          <Feather name="repeat" size={12} color={C.brand} />
                          <Text style={styles.invActionBtnText}>Stock</Text>
                        </Press>
                        <Press onPress={() => { setSelectedEquipment(item); setEquipmentDamageOpen(true); }} style={[styles.invActionBtn, styles.invActionBtnWarn]}>
                          <Feather name="alert-triangle" size={12} color={C.warning} />
                          <Text style={[styles.invActionBtnText, { color: C.warning }]}>Damage</Text>
                        </Press>
                        <Press onPress={() => loadEquipmentHistory(item)} style={styles.invActionBtn}>
                          <Feather name="clock" size={12} color={C.brand} />
                          <Text style={styles.invActionBtnText}>History</Text>
                        </Press>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

                       {tab === 'requests' && (
              <View style={{ gap: S.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                  <TouchableOpacity 
                    onPress={() => { 
                      setSelectedIngredient(null); 
                      setRequestQuantity('1'); 
                      setRequestNotes(''); 
                      setIngredientSearch(''); 
                      setRequestErrors({}); 
                      setRequestOpen(true); 
                    }} 
                    style={styles.smallBtn}
                  >
                    <Feather name="plus" size={14} color="#FFF" />
                    <Text style={styles.smallBtnText}>New Request</Text>
                  </TouchableOpacity>
                </View>

                {requests.length === 0 ? (
                  <EmptyState icon="shopping-cart" title="No requests" hint="Tap 'New Request' to add a new request." />
                ) : requests.map((item, index) => {
                  const status = norm(item.status || 'pending');
                  const tone = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'received' ? 'sky' : 'warning';
                  return (
                    <View key={item.purchase_request_id || item.id || index} style={[styles.invCard, shadow.sm]}>
                      <View style={styles.invRow}>
                        <View style={[styles.invIcon, { backgroundColor: C.tealBg }]}>
                          <Feather name="shopping-cart" size={18} color={C.teal} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.invTitle}>{(typeof item.ingredient === 'string' ? item.ingredient : item.ingredient?.name) || item.ingredient_name || 'Ingredient'}</Text>
                          <Text style={styles.invMeta}>PR #{item.pr_number || item.purchase_request_id || '—'}</Text>
                        </View>
                        <Badge label={String(item.status || 'PENDING').toUpperCase()} tone={tone} />
                      </View>
                      <View style={styles.metaChipsRow}>
                        <View style={styles.metaChipMini}><Text style={styles.metaChipMiniText}>Qty {item.quantity}</Text></View>
                        <View style={styles.metaChipMini}><Text style={styles.metaChipMiniText}>{item.urgency || 'normal'}</Text></View>
                        <View style={styles.metaChipMini}><Text style={styles.metaChipMiniText}>{item.supplier?.name || item.supplier || 'No supplier'}</Text></View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {tab === 'account' && (
              <AccountScreen
                user={user}
                onLogout={onLogout}
                stats={{ ingredients: ingredients.length, equipment: equipment.length, pending: pendingRequests.length }}
              />
            )}
          </>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      <BottomNav active={tab} onChange={setTab} />

      {/* ---------- INGREDIENT REVIEW MODAL ---------- */}
      <Modal visible={reviewOpen} transparent animationType="slide" onRequestClose={() => setReviewOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Review Ingredients</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>{reviewTask?.task || reviewTask?.name || 'Meal task'}</Text>
              </View>
              <Press onPress={() => setReviewOpen(false)} style={styles.modalClose}>
                <Feather name="x" size={18} color={C.inkSoft} />
              </Press>
            </View>

            {reviewLoading && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={C.brand} />
                <Text style={styles.loadingText}>Loading ingredients…</Text>
              </View>
            )}

            {!reviewLoading && reviewError && (
              <View style={{ paddingVertical: 24 }}>
                <View style={styles.validationBanner}>
                  <Feather name="alert-triangle" size={16} color={C.danger} />
                  <Text style={styles.validationBannerText}>{reviewError}</Text>
                </View>
              </View>
            )}

                     {!reviewLoading && !reviewError && reviewRows.length > 0 && (
              <>
                              <ScrollView
                  style={{ flexGrow: 0, flexShrink: 1, marginBottom: 12, maxHeight: '70%' }}
                  contentContainerStyle={{ paddingBottom: 4 }}
                  showsVerticalScrollIndicator
                >
                  {reviewRows.map((row) => {
                    const actualNum = Number(row.actual);
                    const isInvalid = !Number.isFinite(actualNum) || actualNum < 0;
                    const isOver = Number.isFinite(actualNum) && actualNum > row.available;
                    const isShort = row.required > row.available;

                    return (
                      <View key={row.ingredient_id} style={styles.reviewRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={styles.reviewName}>{row.name}</Text>
                          {isShort && <Badge label="SHORT" tone="warning" icon="alert-triangle" />}
                          {isOver && <Badge label="OVER" tone="danger" icon="x" />}
                        </View>
                        <View style={styles.reviewGrid}>
                          <View style={styles.reviewCell}>
                            <Text style={styles.reviewLabel}>UNIT</Text>
                            <Text style={styles.reviewValue}>{row.unit || '—'}</Text>
                          </View>
                          <View style={styles.reviewCell}>
                            <Text style={styles.reviewLabel}>REQUIRED</Text>
                            <Text style={styles.reviewValue}>{fmt(row.required, 3)}</Text>
                          </View>
                          <View style={styles.reviewCell}>
                            <Text style={styles.reviewLabel}>AVAILABLE</Text>
                            <Text style={[styles.reviewValue, isShort && { color: C.warning }]}>{fmt(row.available, 3)}</Text>
                          </View>
                        </View>
                        <View style={styles.reviewActualWrap}>
                          <Text style={styles.reviewLabel}>ACTUAL USE</Text>
                          <TextInput
                            style={[styles.reviewInput, isInvalid && styles.reviewInputError, isOver && styles.reviewInputWarning]}
                            keyboardType="decimal-pad"
                            value={row.actual}
                            onChangeText={(v) => updateActual(row.ingredient_id, v)}
                            placeholder="0"
                            placeholderTextColor={C.faint}
                          />
                        </View>
                        {isInvalid && <Text style={styles.reviewErrorText}>Enter a valid number.</Text>}
                        {isOver && <Text style={styles.reviewErrorText}>Exceeds available stock ({fmt(row.available, 3)}).</Text>}
                      </View>
                    );
                  })}
                </ScrollView>
                              <View style={styles.modalFixedFooter}>
                  <TouchableOpacity onPress={confirmReviewAndDeduct} disabled={submitting} style={styles.primaryBtnFixed}>
                    {submitting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Feather name="check" size={16} color="#FFF" />
                        <Text style={styles.primaryBtnText}>Continue</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- INGREDIENT DETAIL MODAL ---------- */}
      <Modal visible={ingredientDetailOpen} transparent animationType="slide" onRequestClose={() => setIngredientDetailOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>{selectedIngredient?.name || 'Ingredient'}</Text><Text style={styles.modalSubtitle}>Stock information</Text></View>
              <Press onPress={() => setIngredientDetailOpen(false)} style={styles.modalClose}><Feather name="x" size={18} color={C.inkSoft} /></Press>
            </View>
            {selectedIngredient && (() => {
              const current = num(selectedIngredient.current_quantity);
              const minimum = num(selectedIngredient.minimum_stock);
              const reserved = num(selectedIngredient.reserved_quantity);
              const unit = selectedIngredient.unit || '';
              const rows = [
                ['Current stock', `${current} ${unit}`],
                ['Reserved', `${reserved} ${unit}`],
                ['Available', `${Math.max(0, current - reserved)} ${unit}`],
                ['Minimum', `${minimum} ${unit}`],
                ['Reorder point', `${num(selectedIngredient.reorder_point)} ${unit}`],
                ['Unit cost', money(selectedIngredient.unit_cost)],
              ];
              return rows.map(([label, value]) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{value}</Text>
                </View>
              ));
            })()}
            <Press onPress={() => { setIngredientDetailOpen(false); setRequestOpen(true); }} style={styles.primaryBtn}>
              <Feather name="shopping-bag" size={15} color="#FFF" />
              <Text style={styles.primaryBtnText}>Request more stock</Text>
            </Press>
          </View>
        </View>
      </Modal>

      {/* ---------- MOVEMENT MODAL ---------- */}
      <Modal visible={movementOpen} transparent animationType="slide" onRequestClose={() => setMovementOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Stock Movement</Text>
                <Text style={styles.modalSubtitle}>{selectedIngredient?.name || selectedEquipment?.name || 'Select item'}</Text>
              </View>
              <Press onPress={() => setMovementOpen(false)} style={styles.modalClose}><Feather name="x" size={18} color={C.inkSoft} /></Press>
            </View>

            <ScrollView style={{ maxHeight: '80%' }} showsVerticalScrollIndicator={false}>
              {!selectedIngredient && !selectedEquipment && (
                <ScrollView style={{ maxHeight: 220 }}>
                  <Text style={styles.fieldLabel}>Ingredients</Text>
                  {ingredients.map((ing) => (
                    <TouchableOpacity key={`ing-${ing.ingredient_id || ing.id}`} style={styles.choice} onPress={() => setSelectedIngredient(ing)}>
                      <Text style={styles.choiceText}>{ing.name || ing.ingredient_name}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={[styles.fieldLabel, { marginTop: S.md }]}>Equipment</Text>
                  {equipment.map((eq) => (
                    <TouchableOpacity key={`eq-${eq.equipment_id || eq.id}`} style={styles.choice} onPress={() => setSelectedEquipment(eq)}>
                      <Text style={styles.choiceText}>{eq.name || eq.equipment_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Field label="Movement type">
                <View style={styles.urgencyRow}>
                  {['purchase', 'usage'].map((v) => {
                    const active = movementType === v;
                    const tone = v === 'purchase' ? C.success : C.danger;
                    return (
                      <TouchableOpacity key={v} style={[styles.urgency, active && { backgroundColor: tone + '15', borderColor: tone }]} onPress={() => setMovementType(v)}>
                        <View style={[styles.urgencyDot, { backgroundColor: active ? tone : C.faint }]} />
                        <Text style={[styles.choiceText, { fontSize: 11 }, active && { color: tone }]}>{v === 'purchase' ? 'STOCK IN' : 'STOCK OUT'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <Field label="Quantity">
                <TextInput
                  style={[styles.input, movementErrors.quantity && styles.inputError]}
                  keyboardType="decimal-pad"
                  value={movementQuantity}
                  onChangeText={setMovementQuantity}
                  placeholder="0"
                  placeholderTextColor={C.faint}
                />
                {movementErrors.quantity && <Text style={styles.errorTextInline}>{movementErrors.quantity}</Text>}
              </Field>

              <Field label="Reason">
                <TextInput
                  style={[styles.input, { height: 66, textAlignVertical: 'top' }, movementErrors.reason && styles.inputError]}
                  multiline
                  value={movementReason}
                  onChangeText={setMovementReason}
                  placeholder="Required"
                  placeholderTextColor={C.faint}
                />
                {movementErrors.reason && <Text style={styles.errorTextInline}>{movementErrors.reason}</Text>}
              </Field>

              <Field label="Purchased By">
                <TextInput
                  style={[styles.input, movementErrors.purchased_by && styles.inputError]}
                  value={movementPurchasedBy}
                  onChangeText={setMovementPurchasedBy}
                  placeholder="Employee"
                  placeholderTextColor={C.faint}
                />
                {movementErrors.purchased_by && <Text style={styles.errorTextInline}>{movementErrors.purchased_by}</Text>}
              </Field>

              <Field label="Delivered By"><TextInput style={styles.input} value={movementDeliveredBy} onChangeText={setMovementDeliveredBy} placeholder="Person" placeholderTextColor={C.faint} /></Field>
              <Field label="Received By"><TextInput style={styles.input} value={movementReceivedBy} onChangeText={setMovementReceivedBy} placeholder="Receiver" placeholderTextColor={C.faint} /></Field>
              <Field label="Supplier"><TextInput style={styles.input} value={movementSupplier} onChangeText={setMovementSupplier} placeholder="Supplier" placeholderTextColor={C.faint} /></Field>
                                      <Field label="Reference #"><TextInput style={styles.input} value={movementReference} onChangeText={setMovementReference} placeholder="DR / OR" placeholderTextColor={C.faint} /></Field>
            </ScrollView>

                   {/* ⭐ Save button pinned OUTSIDE the scroll area — always visible */}
            <View style={styles.modalFixedFooter}>
              <TouchableOpacity onPress={submitMovement} disabled={submitting} style={styles.primaryBtnFixed}>
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="save" size={16} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Save Movement</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- DAMAGE MODAL ---------- */}
      <Modal visible={equipmentDamageOpen} transparent animationType="slide" onRequestClose={() => setEquipmentDamageOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>Damage / Missing</Text><Text style={styles.modalSubtitle}>{selectedEquipment?.name}</Text></View>
              <Press onPress={() => setEquipmentDamageOpen(false)} style={styles.modalClose}><Feather name="x" size={18} color={C.inkSoft} /></Press>
            </View>
            <Field label="Damaged qty">
              <TextInput style={[styles.input, damageErrors.quantity && styles.inputError]} keyboardType="number-pad" value={damageQty} onChangeText={setDamageQty} placeholder="0" placeholderTextColor={C.faint} />
            </Field>
            <Field label="Missing qty">
              <TextInput style={styles.input} keyboardType="number-pad" value={missingQty} onChangeText={setMissingQty} placeholder="0" placeholderTextColor={C.faint} />
            </Field>
            {damageErrors.quantity && <Text style={styles.errorTextInline}>{damageErrors.quantity}</Text>}
                      <Field label="Reason">
              <TextInput style={[styles.input, { height: 66 }, damageErrors.reason && styles.inputError]} multiline value={damageReason} onChangeText={setDamageReason} placeholder="Required" placeholderTextColor={C.faint} />
            </Field>
            {damageErrors.reason && <Text style={styles.errorTextInline}>{damageErrors.reason}</Text>}
            <View style={{ height: 8 }} />
            {/* ⭐ Save button pinned below the form — always visible */}
            <View style={styles.modalFixedFooter}>
              <TouchableOpacity onPress={submitEquipmentDamage} disabled={submitting} style={styles.primaryBtnFixed}>
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="save" size={16} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Save Damage</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- HISTORY MODAL ---------- */}
      <Modal visible={equipmentHistoryOpen} transparent animationType="slide" onRequestClose={() => setEquipmentHistoryOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>History</Text><Text style={styles.modalSubtitle}>{selectedEquipment?.name}</Text></View>
              <Press onPress={() => setEquipmentHistoryOpen(false)} style={styles.modalClose}><Feather name="x" size={18} color={C.inkSoft} /></Press>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {equipmentHistory.length === 0 ? <Text style={styles.meta}>No movements yet.</Text> : equipmentHistory.map((row, idx) => (
                <View key={idx} style={styles.infoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>{row.movement_type}</Text>
                    <Text style={styles.infoValue}>{row.quantity} {row.unit}</Text>
                    <Text style={styles.meta}>{row.movement_at}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---------- REQUEST MODAL ---------- */}
      <Modal visible={requestOpen} transparent animationType="slide" onRequestClose={() => setRequestOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>New Request</Text><Text style={styles.modalSubtitle}>For admin review</Text></View>
              <Press onPress={() => setRequestOpen(false)} style={styles.modalClose}><Feather name="x" size={18} color={C.inkSoft} /></Press>
            </View>
                     <ScrollView style={{ flexGrow: 0, flexShrink: 1, maxHeight: '70%' }} showsVerticalScrollIndicator={false}>
              <View style={styles.searchWrap}>
                <Feather name="search" size={14} color={C.faint} />
                <TextInput style={styles.searchInput} placeholder="Search" value={ingredientSearch} onChangeText={setIngredientSearch} placeholderTextColor={C.faint} />
              </View>
              <ScrollView style={{ maxHeight: 140, marginTop: 8 }}>
                {filteredIngredients.map((item) => {
                  const active = selectedIngredient?.ingredient_id === item.ingredient_id;
                  return (
                    <TouchableOpacity key={item.ingredient_id} style={[styles.choice, active && styles.choiceActive]} onPress={() => setSelectedIngredient(item)}>
                      <Text style={styles.choiceText}>{item.name || item.ingredient_name}</Text>
                      {active && <Feather name="check" size={14} color={C.brand} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {requestErrors.ingredient && <Text style={styles.errorTextInline}>{requestErrors.ingredient}</Text>}

              <Field label="Quantity">
                <TextInput
                  style={[styles.input, requestErrors.quantity && styles.inputError]}
                  keyboardType="decimal-pad"
                  value={requestQuantity}
                  onChangeText={setRequestQuantity}
                />
                {requestErrors.quantity && <Text style={styles.errorTextInline}>{requestErrors.quantity}</Text>}
              </Field>

              <Field label="Urgency">
                <View style={styles.urgencyRow}>
                  {['normal', 'urgent', 'critical'].map((v) => {
                    const active = requestUrgency === v;
                    const tone = v === 'critical' ? C.danger : v === 'urgent' ? C.warning : C.success;
                    return (
                      <TouchableOpacity key={v} style={[styles.urgency, active && { backgroundColor: tone + '15', borderColor: tone }]} onPress={() => setRequestUrgency(v)}>
                        <View style={[styles.urgencyDot, { backgroundColor: active ? tone : C.faint }]} />
                        <Text style={[styles.choiceText, { fontSize: 11 }, active && { color: tone }]}>{v.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <Field label="Notes">
                <TextInput style={[styles.input, { height: 66 }]} multiline value={requestNotes} onChangeText={setRequestNotes} placeholder="Optional" placeholderTextColor={C.faint} />
              </Field>
            </ScrollView>

                      {/* ⭐ Submit button pinned below the form — always visible */}
            <View style={styles.modalFixedFooter}>
              <TouchableOpacity onPress={submitPurchaseRequest} disabled={submitting} style={styles.primaryBtnFixed}>
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Feather name="send" size={16} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Submit Request</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.brand, paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.md, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, ...shadow.lg },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.3, color: '#FFFFFF', opacity: 0.9 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 11.5, color: '#FFFFFF', opacity: 0.85, marginTop: 4 },
  headerIconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 120 },
  loadingWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  loadingText: { fontSize: 12, color: C.muted },
  errorBanner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: C.dangerBg, padding: S.md, borderRadius: R.md, marginBottom: S.sm },
  errorText: { fontSize: 12, color: C.danger, flex: 1, fontWeight: '600' },
  errorTextInline: { fontSize: 11, color: C.danger, fontWeight: '700', marginTop: 4 },

  /* HOME */
  heroCard: { backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: 1, borderColor: C.line },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: C.brand },
  heroTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 4, letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 12, color: C.muted, marginTop: 4 },
  heroIconWrap: { width: 54, height: 54, borderRadius: 18, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  heroStatsStrip: { flexDirection: 'row', alignItems: 'center', marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.line },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: C.ink },
  heroStatLabel: { fontSize: 9.5, fontWeight: '700', color: C.muted, marginTop: 2, letterSpacing: 0.4, textTransform: 'uppercase' },
  heroStatDivider: { width: 1, height: 26, backgroundColor: C.line },

  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  insightCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.line },
  insightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightValue: { fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 10, letterSpacing: -0.4 },
  insightLabel: { fontSize: 11, color: C.muted, marginTop: 2, fontWeight: '700' },
  insightSub: { fontSize: 10, color: C.faint, marginTop: 2 },

  blockCard: { backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.line },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm },
  blockDot: { width: 8, height: 8, borderRadius: 4 },
  blockTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  blockLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  blockLinkText: { fontSize: 11, fontWeight: '700', color: C.brand },
  blockEmpty: { fontSize: 12, color: C.muted, paddingVertical: 8 },

  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, gap: 10 },
  eventIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontSize: 13, fontWeight: '800', color: C.ink },
  eventMeta: { fontSize: 11, color: C.muted, marginTop: 2 },

  monitorRow: { flexDirection: 'row', alignItems: 'center' },
  monitorItem: { flex: 1, alignItems: 'center', paddingVertical: 6, gap: 4 },
  monitorIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  monitorValue: { fontSize: 22, fontWeight: '800', color: C.ink },
  monitorLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  monitorDivider: { width: 1, height: 42, backgroundColor: C.line },

  dashboardGrid: { flexDirection: 'row', gap: 8 },
  dashItem: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: R.md, padding: S.md },
  dashValue: { fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 6 },
  dashLabel: { fontSize: 10, color: C.muted, marginTop: 2, fontWeight: '600' },
  damageStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.warningBg, padding: 10, borderRadius: R.sm, marginTop: S.sm },
  damageText: { fontSize: 11, fontWeight: '700', color: C.warning },

  /* TASKS */
  folderCard: { backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.line },
  folderCardOngoing: { borderColor: C.warning, borderWidth: 2, backgroundColor: '#FFFBEB' },
  folderCardComplete: { borderColor: C.success, borderWidth: 1.5 },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  folderTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  folderMeta: { fontSize: 11.5, color: C.muted, marginTop: 3 },
  folderProgress: { backgroundColor: C.brandSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  folderProgressText: { fontSize: 11, fontWeight: '800', color: C.brandDark },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  mealBlock: { backgroundColor: '#F8FAFC', borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.line },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealTitle: { fontSize: 12, fontWeight: '800', color: C.ink, letterSpacing: 0.3 },
  mealMeta: { fontSize: 10.5, color: C.muted, marginTop: 2 },

  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: R.sm, padding: S.sm, borderWidth: 1, borderColor: C.line },
  taskItemTitle: { fontSize: 13, fontWeight: '800', color: C.ink },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  taskMetaText: { fontSize: 10, color: C.muted, fontWeight: '600' },
  taskMetaDot: { fontSize: 10, color: C.faint },
  taskAssignee: { fontSize: 10, color: C.muted, marginTop: 4, fontWeight: '600' },

  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: C.brand, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: C.brandSoft },
  startBtnText: { fontSize: 10, fontWeight: '800', color: C.brand },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.brand, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 10 },
  doneBtnText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  undoBtn: { borderWidth: 1.5, borderColor: C.danger, borderRadius: R.pill, padding: 6, backgroundColor: C.dangerBg },

  completeEventBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.success, borderRadius: R.md, paddingVertical: 14, marginTop: 4 },
  completeEventText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },

  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.warningBg, padding: 10, borderRadius: R.sm, marginTop: S.md },
  warnBoxText: { fontSize: 11, fontWeight: '700', color: C.warning, flex: 1 },

  /* INVENTORY */
  invCard: { backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.line },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  invIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  invTitle: { fontSize: 14.5, fontWeight: '800', color: C.ink, letterSpacing: -0.1 },
  invMeta: { fontSize: 11.5, color: C.muted, marginTop: 3 },
  invActions: { flexDirection: 'row', gap: 8, marginTop: S.md, flexWrap: 'wrap' },
  invActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: C.brand, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.brandSoft },
  invActionBtnText: { fontSize: 11, fontWeight: '800', color: C.brand },
  invActionBtnDanger: { borderColor: C.danger, backgroundColor: C.dangerBg },
  invActionBtnWarn: { borderColor: C.warning, backgroundColor: C.warningBg },

  metaChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: S.sm },
  metaChipMini: { backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, borderWidth: 1, borderColor: C.line },
  metaChipMiniText: { fontSize: 10, color: C.inkSoft, fontWeight: '600' },

  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.warningBg, padding: 11, borderRadius: R.md, borderWidth: 1, borderColor: '#FDE68A' },
  warnText: { fontSize: 11.5, fontWeight: '700', color: C.warning },

  /* SHARED */
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  sectionTitle: { fontSize: 16.5, fontWeight: '800', color: C.ink, letterSpacing: -0.2 },
  countChip: { backgroundColor: C.brandSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill },
  countText: { fontSize: 10, fontWeight: '800', color: C.brandDark },
  meta: { fontSize: 11, color: C.muted, marginTop: 3 },

  emptyState: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: S.lg, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: C.ink },
  emptyHint: { fontSize: 11.5, color: C.muted, marginTop: 4, textAlign: 'center' },

  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, ...shadow.lg },
  smallBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.brand, borderRadius: R.md, paddingVertical: 14, marginTop: S.md },  primaryBtnText: { fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },

  /* NAV */
  bottomNavWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 24 : 14, paddingTop: 8 },
  bottomNavContainer: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(232, 237, 245, 0.8)', paddingVertical: 10, paddingHorizontal: 6, ...shadow.nav },
  bottomNavInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  navItemContent: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIconContainer: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  navIconContainerActive: { shadowColor: C.brand, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  navLabel: { fontSize: 9.5, letterSpacing: 0.2, textAlign: 'center', marginTop: 2 },

  /* MODALS */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: S.lg,
    paddingBottom: 24,
    maxHeight: '92%',
    flexDirection: 'column',
    ...shadow.md,
  },  modalHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: S.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.ink, letterSpacing: -0.2 },
  modalSubtitle: { fontSize: 11.5, color: C.muted, marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: C.inkSoft, letterSpacing: 0.3, textTransform: 'uppercase' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, padding: 12, color: C.ink, fontSize: 13.5, marginTop: 8, fontWeight: '600' },
  inputError: { borderColor: C.danger, backgroundColor: C.dangerBg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginTop: 8 },
  searchInput: { flex: 1, fontSize: 13, color: C.ink, paddingVertical: 6 },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11, borderRadius: R.sm, backgroundColor: '#F8FAFC', marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  choiceActive: { backgroundColor: C.brandSoft, borderColor: C.brand },
  choiceText: { fontSize: 12.5, color: C.inkSoft, fontWeight: '700' },
  urgencyRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  urgency: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#F8FAFC', borderRadius: R.md, borderWidth: 1.5, borderColor: C.line },
  urgencyDot: { width: 7, height: 7, borderRadius: 4 },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  infoLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: 13, fontWeight: '700', color: C.ink },

  /* REVIEW */
  reviewRow: { backgroundColor: '#F8FAFC', borderRadius: R.md, padding: S.md, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  reviewName: { fontSize: 13.5, fontWeight: '800', color: C.ink, flex: 1 },
  reviewGrid: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reviewCell: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: R.sm, padding: S.sm, borderWidth: 1, borderColor: C.line },
  reviewLabel: { fontSize: 9, fontWeight: '800', color: C.faint, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  reviewValue: { fontSize: 13, fontWeight: '800', color: C.ink },
  reviewActualWrap: { marginTop: S.sm },
  reviewInput: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: C.line, borderRadius: R.sm, padding: 10, fontSize: 14, fontWeight: '800', color: C.ink, marginTop: 4 },
  reviewInputError: { borderColor: C.danger, backgroundColor: C.dangerBg },
  reviewInputWarning: { borderColor: C.warning, backgroundColor: C.warningBg },
  reviewErrorText: { fontSize: 10.5, color: C.danger, fontWeight: '700', marginTop: 4 },
  reviewActions: { flexDirection: 'row', gap: 8, marginTop: S.md },
  reviewActionsFixed: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  reviewCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.md, paddingVertical: 12, backgroundColor: '#F1F5F9' },
  reviewCancelText: { fontSize: 13, fontWeight: '800', color: C.inkSoft },
  reviewConfirm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: R.md, paddingVertical: 14, backgroundColor: C.brand, minHeight: 48 },
  reviewConfirmText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  modalFixedFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.surface,
  },
  primaryBtnFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.brand,
    borderRadius: R.md,
    paddingVertical: 14,
    minHeight: 48,
  },

  validationBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.dangerBg, padding: 12, borderRadius: R.md, borderWidth: 1, borderColor: '#FCA5A5' },
  validationBannerText: { fontSize: 12, fontWeight: '700', color: C.danger, flex: 1 },

  /* ACCOUNT */
  profileCard: { backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, alignItems: 'center', borderWidth: 1, borderColor: C.line, marginBottom: S.sm },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', marginBottom: S.md, ...shadow.lg },
  profileInitials: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  profileName: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 8, letterSpacing: -0.2 },
  profileStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', marginTop: S.lg, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.line },
  profileStatItem: { alignItems: 'center', flex: 1 },
  profileStatValue: { fontSize: 18, fontWeight: '800', color: C.ink },
  profileStatLabel: { fontSize: 10.5, color: C.muted, marginTop: 2, fontWeight: '600' },
  profileDivider: { width: 1, height: 28, backgroundColor: C.line },
  infoCard: { backgroundColor: C.surface, borderRadius: R.lg, padding: S.sm, borderWidth: 1, borderColor: C.line },
  infoRowDivider: { borderBottomWidth: 1, borderBottomColor: C.line },
  infoIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.brandSoft, alignItems: 'center', justifyContent: 'center' },
  logoutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.line, marginTop: S.sm },
  logoutIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.dangerBg, alignItems: 'center', justifyContent: 'center' },
  logoutTitle: { fontSize: 14, fontWeight: '800', color: C.danger },
  logoutSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  versionText: { fontSize: 10.5, color: C.faint, textAlign: 'center', marginTop: S.lg, letterSpacing: 0.3 },
});