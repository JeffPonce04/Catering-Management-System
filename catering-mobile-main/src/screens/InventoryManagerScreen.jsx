import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, RefreshControl, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../services/api';

const unwrap = (response) => {
  let value = response?.data;
  if (value && Object.prototype.hasOwnProperty.call(value, 'data')) value = value.data;
  if (value && Object.prototype.hasOwnProperty.call(value, 'data') && Array.isArray(value.data)) value = value.data;
  return value;
};
const rowsOf = (value) => Array.isArray(value) ? value : (value?.data && Array.isArray(value.data) ? value.data : []);
const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const norm = (v) => String(v || '').toLowerCase();

export default function InventoryManagerScreen({ navigation, onLogout }) {
  const [tab, setTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({});
  const [ingredients, setIngredients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [requestQuantity, setRequestQuantity] = useState('1');
  const [requestUrgency, setRequestUrgency] = useState('normal');
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    const jobs = await Promise.allSettled([
      api.get('/v1/inventory/dashboard-stats'),
      api.get('/v1/ingredients', { params: { per_page: 100 } }),
      api.get('/v1/equipment', { params: { per_page: 100 } }),
      api.get('/v1/inventory/purchase-requests', { params: { per_page: 100 } }),
      api.get('/v1/events', { params: { per_page: 100 } }),
    ]);
    const failures = [];
    jobs.forEach((job, index) => {
      if (job.status === 'rejected') {
        failures.push(['inventory summary', 'ingredients', 'equipment', 'purchase requests', 'meal tasks'][index]);
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

  const tasks = useMemo(() => events.flatMap((event) => {
    const meals = event.meal_services || event.meal_schedule || [];
    const mealById = new Map(meals.map((meal) => [String(meal.meal_service_id || meal.id), meal]));
    return (event.kitchen_preparation || []).filter((task) => !task.is_header).map((task) => {
      const meal = mealById.get(String(task.meal_service_id || '')) || {};
      return {
        ...task,
        event_id: event.id || event.event_id,
        booking_id: event.id || event.event_id,
        event_name: event.display_name || event.event_name || event.booking_no || 'Catering event',
        event_date: task.service_date || meal.service_date || meal.date || event.date || event.event_date,
        meal_label: [task.meal_type || meal.meal_type, task.serving_time || meal.serving_time].filter(Boolean).join(' · '),
        meal_preparation_status: task.meal_preparation_status || meal.preparation_status || 'pending',
        is_packed_or_tray: Boolean(event.is_packed_or_tray || ['packed', 'tray'].includes(norm(event.service_type))),
        is_done: task.is_done === true || task.is_done === 1 || task.is_done === '1' || task.status === 'completed',
      };
    });
  }), [events]);

  const startMeal = async (task, confirmIncomplete = false) => {
    if (!task.meal_service_id) {
      Alert.alert('Meal service unavailable', 'This task is not linked to a meal service.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/v1/events/${task.booking_id}/meals/${task.meal_service_id}/start`, {
        confirm_incomplete_previous: confirmIncomplete,
      });
      await load(true);
    } catch (e) {
      const body = e?.response?.data || {};
      const code = body?.data?.code || body?.code || body?.errors?.code;
      if (code === 'previous_meal_incomplete') {
        Alert.alert(
          'Previous meal is incomplete',
          body.message || 'The previous meal still has pending tasks. Do you want to start this meal anyway?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Start anyway', onPress: () => startMeal(task, true) },
          ]
        );
      } else {
        Alert.alert('Unable to start meal', body.message || 'The event must be started before this meal can be prepared.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const completeTask = async (task) => {
    if (!task.meal_service_id) {
      Alert.alert('Meal service unavailable', 'This task is not linked to a meal service. Please update the task in the web system before deducting stock.');
      return;
    }
    try {
      setSubmitting(true);
      const response = await api.get(`/v1/bookings/${task.booking_id}/meal-service/${task.meal_service_id}/ingredients`);
      const data = unwrap(response) || {};
      const ingredientsForTask = data.ingredients || [];
      if (!ingredientsForTask.length) {
        Alert.alert('No recipe ingredients', 'No recipe ingredients are linked to this menu item. Inventory was not changed.');
        return;
      }
      const usable = ingredientsForTask
        .filter((item) => Number(item.quantity_needed) > 0)
        .map((item) => ({
          ingredient_id: Number(item.ingredient_id),
          quantity: Number(item.quantity_needed ?? item.required_quantity ?? item.to_deduct ?? item.quantity ?? 0),
          unit: item.unit || null,
        }));
      if (!usable.length) {
        Alert.alert('No quantities to deduct', 'The linked recipe returned no positive ingredient quantities. Inventory was not changed.');
        return;
      }
      const details = ingredientsForTask.map((item) =>
        `• ${item.name}: ${Number(item.quantity_needed ?? item.required_quantity ?? item.to_deduct ?? item.quantity ?? 0)} ${item.unit || ''} (stock: ${Number(item.current_stock ?? item.available ?? 0)})`
      ).join('\n');
      Alert.alert(
        'Complete meal task and deduct stock?',
        `${task.task || task.name || 'Meal task'}\n\n${details}\n\nThis uses the same server-side deduction workflow as the web app. The operation is protected against duplicate deductions.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm & Deduct',
            onPress: async () => {
              setSubmitting(true);
              try {
                await api.post(`/v1/events/${task.booking_id}/kitchen-task/complete`, {
                  task_id: String(task.id),
                  meal_service_id: task.meal_service_id || null,
                  menu_item_id: task.menu_item_id,
                  ingredients: usable,
                });
                Alert.alert('Task completed', 'Ingredient stock deduction was processed by the server.');
                await load(true);
              } catch (e) {
                const body = e?.response?.data || {};
                Alert.alert('Could not complete task', body.message || 'The task was not completed. Check stock availability and try again.');
              } finally {
                setSubmitting(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Unable to load recipe', e?.response?.data?.message || 'Could not retrieve ingredient quantities. No stock was changed.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPurchaseRequest = async () => {
    const quantity = Number(requestQuantity);
    if (!selectedIngredient || !Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Check request details', 'Select an ingredient and enter a quantity greater than zero.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/v1/inventory/purchase-requests', {
        ingredient_id: Number(selectedIngredient.ingredient_id),
        quantity,
        urgency: requestUrgency,
        notes: requestNotes.trim() || 'Requested from Inventory Manager mobile app',
      });
      setRequestOpen(false);
      setSelectedIngredient(null);
      setRequestQuantity('1');
      setRequestUrgency('normal');
      setRequestNotes('');
      Alert.alert('Request submitted', 'Your purchase request has been sent for administrator review.');
      await load(true);
    } catch (e) {
      Alert.alert('Request failed', e?.response?.data?.message || 'Unable to submit purchase request.');
    } finally {
      setSubmitting(false);
    }
  };

  const lowStock = ingredients.filter((item) => {
    const current = Number(item.current_quantity ?? item.current_stock ?? item.stock?.current_quantity ?? 0);
    const minimum = Number(item.minimum_stock ?? item.minimum_quantity ?? item.min_stock ?? item.reorder_point ?? 0);
    return minimum > 0 && current <= minimum;
  });

  const Card = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;
  const Empty = ({ label }) => <View style={styles.empty}><Feather name="inbox" size={28} color="#94A3B8"/><Text style={styles.emptyText}>{label}</Text></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB"/>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DEAR BAB'S CATERING</Text>
          <Text style={styles.title}>Inventory Manager</Text>
          <Text style={styles.subtitle}>Meal operations · Stock control · Purchasing</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => load(true)}><Feather name="refresh-cw" size={19} color="#334155"/></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {[
          ['tasks','Meal Tasks','clipboard'],
          ['ingredients','Ingredients','package'],
          ['equipment','Equipment','tool'],
          ['requests','Purchase Requests','shopping-cart'],
        ].map(([key,label,icon]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Feather name={icon} size={15} color={tab === key ? '#FFFFFF' : '#475569'}/>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)}/>}
        contentContainerStyle={styles.bodyContent}
      >
        {loading ? <ActivityIndicator size="large" color="#E85D8F" style={{marginTop:40}}/> : null}
        {!!error && <Card><Text style={styles.errorText}>{error}</Text></Card>}
        {!loading && (
          <>
            <View style={styles.metrics}>
              {[
                ['Ingredients', ingredients.length, 'package'],
                ['Low Stock', lowStock.length, 'alert-triangle'],
                ['Equipment', equipment.length, 'tool'],
                ['Pending PR', requests.filter((r) => norm(r.status) === 'pending').length, 'shopping-cart'],
              ].map(([label,value,icon]) => <Card key={label} style={styles.metric}><Feather name={icon} size={17} color="#E85D8F"/><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Card>)}
            </View>

            {tab === 'tasks' && (
              <>
                <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Meal preparation tasks</Text><Text style={styles.count}>{tasks.length} tasks</Text></View>
                {tasks.length === 0 ? <Empty label="No active meal tasks found."/> : tasks.map((task,index) => (
                  <Card key={`${task.event_id}-${task.id || index}`}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.eventName}>{task.event_name}</Text>
                      <View style={[styles.pill, task.is_done ? styles.pillDone : styles.pillPending]}><Text style={[styles.pillText, task.is_done ? styles.doneText : styles.pendingText]}>{task.is_done ? 'COMPLETED' : 'PENDING'}</Text></View>
                    </View>
                    <Text style={styles.taskName}>{task.task || task.name || 'Meal preparation task'}</Text>
                    <Text style={styles.meta}>{[task.event_date, task.meal_label, task.quantity ? `Qty ${task.quantity}` : null].filter(Boolean).join(' · ')}</Text>
                    {!task.is_done && !task.is_packed_or_tray && !['preparing', 'completed'].includes(norm(task.meal_preparation_status)) && (
                      <TouchableOpacity style={styles.outlineButton} disabled={submitting} onPress={() => startMeal(task)}>
                        <Text style={styles.outlineButtonText}>Start this meal</Text>
                      </TouchableOpacity>
                    )}
                    {!task.is_done && (task.is_packed_or_tray || ['preparing', 'completed'].includes(norm(task.meal_preparation_status))) && (
                      <TouchableOpacity style={styles.primaryButton} disabled={submitting} onPress={() => completeTask(task)}>
                        <Feather name="check-circle" size={16} color="#FFF"/>
                        <Text style={styles.primaryButtonText}>Review ingredients & complete</Text>
                      </TouchableOpacity>
                    )}
                    {task.is_done && <Text style={styles.successNote}>Inventory deduction already recorded.</Text>}
                  </Card>
                ))}
              </>
            )}

            {tab === 'ingredients' && (
              <>
                <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Ingredient stock</Text><TouchableOpacity onPress={() => setRequestOpen(true)} style={styles.smallButton}><Feather name="plus" size={14} color="#FFF"/><Text style={styles.smallButtonText}>Request purchase</Text></TouchableOpacity></View>
                {ingredients.length === 0 ? <Empty label="No ingredient records found."/> : ingredients.map((item,index) => {
                  const current = Number(item.current_quantity ?? item.current_stock ?? item.stock?.current_quantity ?? 0);
                  const unit = item.unit || item.unit_of_measure || '';
                  const minimum = Number(item.minimum_stock ?? item.minimum_quantity ?? item.min_stock ?? item.reorder_point ?? 0);
                  const isLow = minimum > 0 && current <= minimum;
                  return <Card key={item.ingredient_id || item.id || index}>
                    <View style={styles.rowBetween}><Text style={styles.itemName}>{item.name || item.ingredient_name || 'Ingredient'}</Text><Text style={[styles.stockValue, isLow && {color:'#DC2626'}]}>{current} {unit}</Text></View>
                    <Text style={styles.meta}>Minimum stock: {minimum || 'Not set'} {unit}</Text>
                    {isLow && <Text style={styles.warningText}>Low stock · Reorder recommended</Text>}
                    <TouchableOpacity style={styles.outlineButton} onPress={() => {setSelectedIngredient(item);setRequestOpen(true);}}><Text style={styles.outlineButtonText}>Create purchase request</Text></TouchableOpacity>
                  </Card>;
                })}
              </>
            )}

            {tab === 'equipment' && (
              <>
                <Text style={styles.sectionTitle}>Equipment inventory</Text>
                {equipment.length === 0 ? <Empty label="No equipment records found."/> : equipment.map((item,index) => (
                  <Card key={item.equipment_id || item.id || index}>
                    <View style={styles.rowBetween}><Text style={styles.itemName}>{item.name || item.equipment_name || 'Equipment'}</Text><Text style={styles.stockValue}>{item.available_quantity ?? item.quantity_available ?? item.quantity ?? item.total_quantity ?? '—'} units</Text></View>
                    <Text style={styles.meta}>Code: {item.equipment_code || item.code || '—'} · Status: {item.status || 'Active'}</Text>
                    {item.description ? <Text style={styles.meta}>{item.description}</Text> : null}
                  </Card>
                ))}
              </>
            )}

            {tab === 'requests' && (
              <>
                <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Purchase requests</Text><TouchableOpacity onPress={() => setRequestOpen(true)} style={styles.smallButton}><Feather name="plus" size={14} color="#FFF"/><Text style={styles.smallButtonText}>New request</Text></TouchableOpacity></View>
                {requests.length === 0 ? <Empty label="No purchase requests found."/> : requests.map((item,index) => (
                  <Card key={item.purchase_request_id || item.id || index}>
                    <View style={styles.rowBetween}><Text style={styles.itemName}>{(typeof item.ingredient === 'string' ? item.ingredient : item.ingredient?.name) || item.ingredient_name || 'Ingredient request'}</Text><Text style={styles.pillText}>{String(item.status || 'pending').toUpperCase()}</Text></View>
                    <Text style={styles.meta}>PR: {item.pr_number || item.purchase_request_id || '—'} · Quantity: {item.quantity}</Text>
                    <Text style={styles.meta}>Urgency: {item.urgency || 'normal'} · {(typeof item.supplier === 'string' ? item.supplier : item.supplier?.name) || 'Supplier not assigned'}</Text>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={requestOpen} transparent animationType="slide" onRequestClose={() => setRequestOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modal}>
          <View style={styles.rowBetween}><Text style={styles.modalTitle}>New purchase request</Text><TouchableOpacity onPress={() => setRequestOpen(false)}><Feather name="x" size={22} color="#334155"/></TouchableOpacity></View>
          <Text style={styles.fieldLabel}>Ingredient</Text>
          <ScrollView style={{maxHeight:150}}>
            {ingredients.map((item) => <TouchableOpacity key={item.ingredient_id || item.id} style={[styles.choice, selectedIngredient?.ingredient_id === item.ingredient_id && styles.choiceActive]} onPress={() => setSelectedIngredient(item)}><Text style={styles.choiceText}>{item.name || item.ingredient_name}</Text></TouchableOpacity>)}
          </ScrollView>
          <Text style={styles.fieldLabel}>Quantity to request</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={requestQuantity} onChangeText={setRequestQuantity} placeholder="Enter quantity"/>
          <Text style={styles.fieldLabel}>Urgency</Text>
          <View style={styles.urgencyRow}>{['normal','urgent','critical'].map((v) => <TouchableOpacity key={v} style={[styles.urgency,requestUrgency===v&&styles.choiceActive]} onPress={() => setRequestUrgency(v)}><Text style={styles.choiceText}>{v.toUpperCase()}</Text></TouchableOpacity>)}</View>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput style={[styles.input,{height:70}]} multiline value={requestNotes} onChangeText={setRequestNotes} placeholder="Optional notes"/>
          <TouchableOpacity style={styles.primaryButton} disabled={submitting} onPress={submitPurchaseRequest}>{submitting?<ActivityIndicator color="#FFF"/>:<><Feather name="send" size={16} color="#FFF"/><Text style={styles.primaryButtonText}>Submit for approval</Text></>}</TouchableOpacity>
        </View></View>
      </Modal>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Signed in as Inventory Manager</Text>
        <TouchableOpacity onPress={() => onLogout?.()}><Text style={styles.logout}>Logout</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F5F7FB'},
  header:{paddingHorizontal:18,paddingTop:12,paddingBottom:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:'#E85D8F'},
  title:{fontSize:23,fontWeight:'800',color:'#172033',marginTop:3},
  subtitle:{fontSize:11,color:'#64748B',marginTop:3},
  iconButton:{width:42,height:42,borderRadius:14,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',elevation:2},
  tabs:{paddingHorizontal:14,paddingBottom:12,gap:8},
  tab:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:13,paddingVertical:10,borderRadius:12,backgroundColor:'#E8EDF5'},
  tabActive:{backgroundColor:'#E85D8F'},
  tabText:{fontSize:12,fontWeight:'700',color:'#475569'},
  tabTextActive:{color:'#FFFFFF'},
  body:{flex:1},
  bodyContent:{paddingHorizontal:14,paddingBottom:18,gap:10},
  metrics:{flexDirection:'row',flexWrap:'wrap',gap:8},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,padding:14,marginBottom:9,borderWidth:1,borderColor:'#E8EDF5'},
  metric:{width:'48%',flexGrow:1,minHeight:88,marginBottom:0},
  metricValue:{fontSize:22,fontWeight:'800',color:'#172033',marginTop:8},
  metricLabel:{fontSize:11,color:'#64748B',marginTop:2},
  sectionHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8},
  sectionTitle:{fontSize:17,fontWeight:'800',color:'#172033',marginVertical:7},
  count:{fontSize:11,color:'#64748B'},
  rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  eventName:{fontSize:12,fontWeight:'700',color:'#334155',flex:1},
  taskName:{fontSize:15,fontWeight:'700',color:'#172033',marginTop:10},
  itemName:{fontSize:14,fontWeight:'700',color:'#172033',flex:1},
  meta:{fontSize:11,color:'#64748B',marginTop:6},
  stockValue:{fontSize:15,fontWeight:'800',color:'#0F766E'},
  pill:{paddingHorizontal:8,paddingVertical:4,borderRadius:99},
  pillDone:{backgroundColor:'#DCFCE7'},
  pillPending:{backgroundColor:'#FEF3C7'},
  pillText:{fontSize:9,fontWeight:'800',color:'#475569'},
  doneText:{color:'#15803D'},
  pendingText:{color:'#B45309'},
  primaryButton:{marginTop:12,backgroundColor:'#E85D8F',borderRadius:12,paddingVertical:12,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  primaryButtonText:{fontSize:12,fontWeight:'800',color:'#FFFFFF'},
  outlineButton:{alignSelf:'flex-start',marginTop:10,borderWidth:1,borderColor:'#E85D8F',borderRadius:10,paddingVertical:8,paddingHorizontal:12},
  outlineButtonText:{fontSize:11,fontWeight:'700',color:'#E85D8F'},
  smallButton:{backgroundColor:'#E85D8F',borderRadius:10,paddingVertical:8,paddingHorizontal:10,flexDirection:'row',gap:5,alignItems:'center'},
  smallButtonText:{fontSize:10,fontWeight:'800',color:'#FFFFFF'},
  warningText:{fontSize:11,color:'#DC2626',fontWeight:'700',marginTop:6},
  successNote:{fontSize:11,color:'#15803D',fontWeight:'700',marginTop:10},
  empty:{alignItems:'center',paddingVertical:35,gap:8},
  emptyText:{fontSize:12,color:'#64748B'},
  errorText:{fontSize:12,color:'#B91C1C'},
  modalBackdrop:{flex:1,backgroundColor:'rgba(15,23,42,0.45)',justifyContent:'center',padding:18},
  modal:{backgroundColor:'#FFFFFF',borderRadius:20,padding:18,maxHeight:'90%'},
  modalTitle:{fontSize:17,fontWeight:'800',color:'#172033'},
  fieldLabel:{fontSize:11,fontWeight:'800',color:'#475569',marginTop:14,marginBottom:6},
  input:{backgroundColor:'#F8FAFC',borderWidth:1,borderColor:'#CBD5E1',borderRadius:10,padding:11,color:'#172033'},
  choice:{padding:10,borderRadius:9,backgroundColor:'#F1F5F9',marginBottom:5},
  choiceActive:{backgroundColor:'#FCE7F3',borderColor:'#E85D8F',borderWidth:1},
  choiceText:{fontSize:12,color:'#334155',fontWeight:'700'},
  urgencyRow:{flexDirection:'row',gap:6},
  urgency:{flex:1,padding:9,backgroundColor:'#F1F5F9',borderRadius:9,alignItems:'center'},
  footer:{height:46,borderTopWidth:1,borderTopColor:'#E2E8F0',paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFFFFF'},
  footerText:{fontSize:10,color:'#64748B'},
  logout:{fontSize:12,fontWeight:'800',color:'#DC2626'}
});
