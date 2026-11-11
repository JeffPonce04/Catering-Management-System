<?php

namespace App\Http\Controllers\Api;

use App\Models\Booking;
use App\Models\BookingEquipment;
use App\Models\Employee;
use App\Models\EventTracking;
use App\Models\EventChecklistItem;
use App\Models\EventDeliveryTracking;
use App\Models\Schedule;
use App\Models\ServiceEvent;
use App\Models\ShiftType;
use Carbon\Carbon;
use App\Models\Setting;
use App\Models\MealService;
use App\Services\EventService;
use App\Services\InventoryService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class EventController extends Controller
{
    private const MEAL_SEQUENCE = [
        'breakfast'        => 1,
        'morning snacks'   => 2,
        'morning snack'    => 2,
        'lunch'            => 3,
        'afternoon snacks' => 4,
        'afternoon snack'  => 4,
        'dinner'           => 5,
    ];

    protected $notificationService;
    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    private function query()
    {
        $relations = [
            'serviceEvent.customer.person',
            'serviceEvent.eventType',
            'serviceEvent.package',
            'items.menuItem',
            'payments',
            'equipment.equipment',
            'tracking',
            'order',
            'invoice',
        ];

        if (Schema::hasTable('event_days')) {
            $relations[] = 'eventDays';
        }

        if (Schema::hasTable('meal_services')) {
            $relations[] = 'mealServices.menuItem';
            $relations[] = 'mealServices.package';

            if (Schema::hasTable('meal_service_filters')) {
                $relations[] = 'mealServices.filters';
            }

            if (Schema::hasTable('meal_service_custom_items')) {
                $relations[] = 'mealServices.customItems.menuItem';
            }
        }

        if (Schema::hasTable('event_checklist_items')) {
            $relations[] = Schema::hasTable('meal_services') && Schema::hasTable('event_days')
                ? 'eventChecklistItems.mealService.eventDay'
                : 'eventChecklistItems';
        }

        if (Schema::hasTable('event_delivery_trackings')) {
            $relations[] = Schema::hasTable('meal_services') && Schema::hasTable('event_days')
                ? 'deliveryTrackings.mealService.eventDay'
                : 'deliveryTrackings';
        }

        return Booking::with($relations);
    }

    public function index(Request $request)
    {
        $query = $this->query()
            ->whereIn('booking_status', ['confirmed', 'ongoing', 'missed_delivery', 'missed_pickup'])
            ->whereHas('serviceEvent', fn($q) => $q->whereNotIn('status', ['completed', 'cancelled']));

        $requestedStatus = strtolower((string) $request->input('status', ''));
        if ($requestedStatus !== '' && $requestedStatus !== 'all') {
            $query->where('booking_status', $requestedStatus)
                ->whereHas('serviceEvent', fn($q) => $q->where('status', $requestedStatus));
        }

        if ($request->boolean('ongoing_only')) {
            $query->where('booking_status', 'ongoing')
                ->whereHas('serviceEvent', fn($q) => $q->where('status', 'ongoing'));
        }

        if ($request->event_date) {
            $query->whereHas('serviceEvent', fn($q) => $q->whereDate('event_date', $request->event_date));
        }

        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('booking_no', 'like', "%{$search}%")
                    ->orWhereHas(
                        'serviceEvent.customer.person',
                        fn($p) =>
                        $p->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                    );
            });
        }

        $events = $query->latest('booking_id')->paginate($request->integer('per_page', 15));
        $events->getCollection()->transform(fn($booking) => $this->formatEvent($booking));

        return $this->ok($events);
    }

    public function show($id)
    {
        $booking = $this->query()->findOrFail($id);
        return $this->ok($this->formatEvent($booking));
    }

    public function stats()
    {
        $operational = Booking::query()->where('booking_no', 'not like', 'HIST-%');
        $total = (clone $operational)->whereIn('booking_status', ['confirmed', 'ongoing', 'completed'])->count();
        $upcoming = (clone $operational)->whereHas('serviceEvent', fn($q) => $q->whereDate('event_date', '>=', now()))
            ->whereIn('booking_status', ['confirmed'])
            ->count();
        $ongoing = (clone $operational)->whereHas('serviceEvent', fn($q) => $q->whereDate('event_date', '<=', now()))
            ->whereIn('booking_status', ['ongoing'])
            ->count();
        $completed = (clone $operational)->where('booking_status', 'completed')->count();

        return $this->ok([
            'total' => $total,
            'upcoming' => $upcoming,
            'ongoing' => $ongoing,
            'completed' => $completed,
        ]);
    }

    /**
     * Send event reminders for tomorrow's events
     */
    public function sendEventReminders()
    {
        $tomorrow = now()->addDay()->toDateString();

        $events = Booking::whereHas('serviceEvent', function ($q) use ($tomorrow) {
            $q->whereDate('event_date', $tomorrow);
        })->whereIn('booking_status', ['confirmed', 'ongoing'])->get();

        $remindersSent = 0;

        foreach ($events as $booking) {
            // ✅ Notification: Event starts tomorrow for Event Coordinator
            $this->notificationService->eventStartsTomorrow($booking);
            $remindersSent++;

            // Also check equipment needs
            foreach ($booking->equipment as $equipmentItem) {
                if ($equipmentItem->equipment) {
                    $this->notificationService->equipmentPreparationNeeded($booking, $equipmentItem->equipment);
                }
            }

            // Check delivery preparation
            if ($booking->serviceEvent?->delivery_method === 'delivery') {
                $this->notificationService->deliveryPreparationReady($booking);
            }
        }

        return $this->ok(['sent' => $remindersSent], 'Event reminders sent');
    }

    public function assignStaff(Request $request, $id)
    {
        $validated = $request->validate([
            'staff_id' => 'nullable|exists:employees,employee_id',
            'staff_ids' => 'nullable|array',
            'staff_ids.*' => 'exists:employees,employee_id',
            'role' => 'required|string|max:100',
            'shift_type_id' => 'nullable|exists:shift_types,shift_type_id',
            'schedule' => 'nullable|string|max:100',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i|after:start_time',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
        ]);

        $staffIds = collect($validated['staff_ids'] ?? $validated['staff_id'] ?? [])
            ->flatten()
            ->filter()
            ->map(fn($value) => (int) $value)
            ->unique()
            ->values();

        if ($staffIds->isEmpty()) {
            return $this->fail('Please select at least one staff member.', 422);
        }

        $booking = Booking::with(['serviceEvent', 'payments', 'invoice', 'quotation'])->findOrFail($id);
        $eventDate = $booking->serviceEvent?->event_date;
        if (! $eventDate) {
            return $this->fail('Cannot assign staff because this booking has no scheduled event date.', 422);
        }

        [$parsedStart, $parsedEnd] = $this->parseScheduleWindow($validated['schedule'] ?? null);
        $shiftType = $this->resolveEventShiftType($validated['shift_type_id'] ?? null, $parsedStart, $parsedEnd);
        $startTime = $validated['start_time'] ?? (! empty($validated['schedule']) ? $parsedStart : substr((string) $shiftType->default_start_time, 0, 5));
        $endTime = $validated['end_time'] ?? (! empty($validated['schedule']) ? $parsedEnd : substr((string) $shiftType->default_end_time, 0, 5));
        $scheduleLabel = "{$startTime} - {$endTime}";
        $eventService = app(EventService::class);
        $employees = Employee::whereIn('employee_id', $staffIds)->get()->keyBy('employee_id');

        DB::transaction(function () use ($booking, $validated, $staffIds, $employees, $eventService, $eventDate, $startTime, $endTime, $scheduleLabel, $shiftType) {
            $assignments = $staffIds->map(fn($staffId) => [
                'staff_id' => $staffId,
                'role' => $validated['role'],
                'schedule' => $scheduleLabel,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'phone' => $validated['phone'] ?? null,
                'email' => $validated['email'] ?? null,
            ])->all();

            $eventService->assignStaffToEvent($booking, $assignments);

            $startDate = Carbon::parse($eventDate)->startOfDay();
            $endDate = $booking->serviceEvent?->event_end_date
                ? Carbon::parse($booking->serviceEvent->event_end_date)->startOfDay()
                : $startDate->copy();

            foreach ($staffIds as $staffId) {
                $employee = $employees->get($staffId);
                for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
                    $schedule = Schedule::withTrashed()
                        ->where('employee_id', $staffId)
                        ->whereDate('work_date', $date->toDateString())
                        ->first();

                    if (! $schedule) {
                        $schedule = new Schedule([
                            'employee_id' => $staffId,
                            'work_date' => $date->toDateString(),
                        ]);
                    } else {
                        $assignmentPayload = json_decode((string) $schedule->assignment_details, true) ?: [];
                        $existingBookingId = Schema::hasColumn('schedules', 'booking_id')
                            ? $schedule->booking_id
                            : ($assignmentPayload['booking_id'] ?? null);

                        if ($existingBookingId && (int) $existingBookingId !== (int) $booking->booking_id) {
                            throw \Illuminate\Validation\ValidationException::withMessages([
                                'staff_ids' => "Employee {$staffId} already has a schedule for another event on {$date->toDateString()}.",
                            ]);
                        }

                        if ($schedule->trashed()) {
                            $schedule->restore();
                        }
                    }

                    $payload = [
                        'shift_type_id' => (int) $shiftType->shift_type_id,
                        'start_time' => $startTime,
                        'end_time' => $endTime,
                        'break_minutes' => (float) ($shiftType->break_minutes ?? 0),
                        'assignment_details' => json_encode([
                            'placement' => $booking->serviceEvent?->venue,
                            'notes' => "Assigned to event: {$booking->booking_no} - Role: {$validated['role']}",
                            'booking_id' => $booking->booking_id,
                            'role' => $validated['role'],
                        ]),
                        'status' => 'scheduled',
                    ];

                    if (Schema::hasColumn('schedules', 'booking_id')) {
                        $payload['booking_id'] = $booking->booking_id;
                    }

                    $schedule->fill($payload)->save();

                    if ($employee?->user_id) {
                        try {
                            $this->notificationService->scheduleAssigned($schedule, $employee);
                        } catch (\Throwable $exception) {
                            Log::warning('Staff assignment notification failed', [
                                'booking_id' => $booking->booking_id,
                                'employee_id' => $staffId,
                                'message' => $exception->getMessage(),
                            ]);
                        }
                    }
                }
            }
        });

        // ⭐ FIX: Ensure the fresh staff list is returned so the frontend can map it correctly.
        $booking->refresh();
        return $this->ok($eventService->getAssignedStaff($booking), 'Staff assigned and schedule created successfully');
    }

    private function resolveEventShiftType(?int $shiftTypeId, string $startTime, string $endTime): ShiftType
    {
        if ($shiftTypeId) {
            return ShiftType::where('is_active', true)->findOrFail($shiftTypeId);
        }

        $existing = ShiftType::where('is_active', true)
            ->where(function ($query) {
                $query->where('slug', 'regular')->orWhere('name', 'Regular');
            })
            ->first() ?? ShiftType::where('is_active', true)->orderBy('shift_type_id')->first();

        if ($existing) {
            return $existing;
        }

        return ShiftType::firstOrCreate(
            ['slug' => 'event-regular'],
            [
                'name' => 'Event Regular',
                'default_start_time' => $startTime,
                'default_end_time' => $endTime,
                'break_minutes' => 60,
                'night_differential_rate' => 0,
                'is_active' => true,
            ]
        );
    }

    private function parseScheduleWindow(?string $schedule): array
    {
        $normalize = function (?string $time, string $fallback): string {
            $time = trim((string) $time);
            if ($time === '') {
                return $fallback;
            }
            try {
                return Carbon::parse($time)->format('H:i');
            } catch (\Throwable) {
                return $fallback;
            }
        };

        $schedule = trim((string) $schedule);
        if ($schedule && str_contains($schedule, '-')) {
            [$start, $end] = array_pad(array_map('trim', explode('-', $schedule, 2)), 2, null);
            return [$normalize($start, '08:00'), $normalize($end, '17:00')];
        }

        return ['08:00', '17:00'];
    }

    public function getStaff($id)
    {
        $booking = Booking::findOrFail($id);
        $eventService = app(EventService::class);

        return $this->ok($eventService->getAssignedStaff($booking));
    }

    public function updateStaffStatus(Request $request, $id, $staffId)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,confirmed,declined',
        ]);

        $booking = Booking::findOrFail($id);
        $tracking = EventTracking::where('booking_id', $booking->booking_id)
            ->where('stage', 'preparation')
            ->first();

        if ($tracking && $tracking->notes) {
            $metadata = json_decode($tracking->notes, true);
            $metadata = is_array($metadata) ? $metadata : [];
            foreach (($metadata['assigned_staff'] ?? []) as &$staff) {
                if ($staff['staff_id'] == $staffId) {
                    $staff['status'] = $validated['status'];
                    break;
                }
            }
            $tracking->update(['notes' => json_encode($metadata)]);
        }

        return $this->ok(null, 'Staff status updated');
    }

    public function removeStaff($id, $staffId)
    {
        $booking = Booking::findOrFail($id);
        $tracking = EventTracking::where('booking_id', $booking->booking_id)
            ->where('stage', 'preparation')
            ->first();

        if ($tracking && $tracking->notes) {
            $metadata = json_decode($tracking->notes, true);
            $metadata['assigned_staff'] = array_filter($metadata['assigned_staff'] ?? [], fn($s) => $s['staff_id'] != $staffId);
            $tracking->update(['notes' => json_encode($metadata)]);
        }

        // Remove only schedules created for this event.
        $scheduleQuery = Schedule::where('employee_id', $staffId);
        if (Schema::hasColumn('schedules', 'booking_id')) {
            $scheduleQuery->where('booking_id', $booking->booking_id);
        } else {
            $scheduleQuery->where('assignment_details', 'like', '%"booking_id":' . $booking->booking_id . '%');
        }
        $scheduleQuery->delete();

        // ✅ Notification: Staff removed from event
        $employee = Employee::find($staffId);
        if ($employee && $employee->user_id) {
            $eventDate = $booking->serviceEvent?->event_date;
            $eventDateLabel = $eventDate ? Carbon::parse($eventDate)->format('M d, Y') : 'the scheduled date';
            $this->notificationService->notifyUser(
                $employee->user_id,
                'schedule_cancelled',
                'Schedule Removed',
                "Your assignment for event {$booking->booking_no} on {$eventDateLabel} has been removed.",
                \App\Models\Notification::PRIORITY_MEDIUM,
                ['booking_id' => $booking->booking_id]
            );
        }

        return $this->ok(null, 'Staff removed');
    }

    public function getChecklist($id)
    {
        $booking = $this->query()->findOrFail($id);
        $rows = $this->ensureChecklistRows($booking);
        $warnings = $this->eventWarnings($booking);

        return $this->ok([
            'checklist' => $rows,
            'warnings' => $warnings,
            'has_warnings' => count($warnings) > 0,
            'warning_count' => count($warnings),
            'display_name' => $booking->serviceEvent?->customer?->person?->full_name . ' - ' . ($booking->serviceEvent?->eventType?->name ?? 'Event'),
            'customer_name' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
            'event_name' => $booking->serviceEvent?->eventType?->name ?? 'Event',
        ]);
    }

    public function updateChecklistItem(Request $request, $id, $itemId)
    {
        $validated = $request->validate([
            'completed' => 'nullable|boolean',
            'status' => 'nullable|in:pending,in_progress,completed',
            'notes' => 'nullable|string',
        ]);

        if (! array_key_exists('completed', $validated) && ! array_key_exists('status', $validated) && ! array_key_exists('notes', $validated)) {
            return $this->fail('Provide a completed state, status, or notes to update.', 422);
        }

        $booking = Booking::findOrFail($id);
        $item = EventChecklistItem::where('booking_id', $booking->booking_id)
            ->where(function ($q) use ($itemId) {
                $q->where('event_checklist_item_id', $itemId)->orWhere('task_key', $itemId);
            })
            ->firstOrFail();

        $updates = [];
        if (array_key_exists('completed', $validated)) {
            $updates['status'] = $validated['completed'] ? 'completed' : 'pending';
        } elseif (array_key_exists('status', $validated)) {
            $updates['status'] = $validated['status'];
        }
        if (array_key_exists('notes', $validated)) {
            $updates['notes'] = $validated['notes'];
        }
        if (Schema::hasColumn('event_checklist_items', 'manual_override')) {
            $updates['manual_override'] = true;
        }
        if (array_key_exists('status', $updates) && Schema::hasColumn('event_checklist_items', 'completed_at')) {
            $updates['completed_at'] = $updates['status'] === 'completed' ? now() : null;
        }
        if (array_key_exists('status', $updates) && Schema::hasColumn('event_checklist_items', 'completed_by')) {
            $updates['completed_by'] = $updates['status'] === 'completed' ? auth()->id() : null;
        }

        $item->update($updates);
        $freshBooking = $this->query()->findOrFail($id);

        return $this->ok([
            'item' => $this->formatChecklistRows(collect([$item->fresh()]))[0] ?? null,
            'checklist' => $this->ensureChecklistRows($freshBooking),
        ], 'Checklist updated');
    }

    public function addChecklistItem(Request $request, $id)
    {
        $validated = $request->validate([
            'task' => 'required|string|max:255',
            'assigned_to' => 'nullable|string|max:120',
            'meal_service_id' => 'nullable|exists:meal_services,meal_service_id',
            'notes' => 'nullable|string',
        ]);

        $booking = Booking::findOrFail($id);
        $item = EventChecklistItem::create([
            'booking_id' => $booking->booking_id,
            'meal_service_id' => $validated['meal_service_id'] ?? null,
            'task_key' => 'manual_' . now()->timestamp . '_' . random_int(100, 999),
            'task' => $validated['task'],
            'assigned_to' => $validated['assigned_to'] ?? 'Unassigned',
            'status' => 'pending',
            'source_type' => 'manual',
            'notes' => $validated['notes'] ?? null,
        ]);

        return $this->ok($item, 'Checklist item added');
    }

    public function deleteChecklistItem($id, $itemId)
    {
        $booking = Booking::findOrFail($id);
        EventChecklistItem::where('booking_id', $booking->booking_id)
            ->where(function ($q) use ($itemId) {
                $q->where('event_checklist_item_id', $itemId)->orWhere('task_key', $itemId);
            })
            ->delete();

        return $this->ok(null, 'Checklist item deleted');
    }

    public function getDeliveries($id)
    {
        $booking = $this->query()->findOrFail($id);
        return $this->ok($this->ensureDeliveryRows($booking));
    }

    public function updateDeliveryStatus(Request $request, $id, $deliveryId)
    {
        $validated = $request->validate([
            'status' => 'required|in:pending,preparing,departed,en_route,arrived,serving,completed,cancelled',
            'location' => 'nullable|string',
            'return_time' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
        ]);

        $booking = Booking::findOrFail($id);
        $delivery = EventDeliveryTracking::where('booking_id', $booking->booking_id)
            ->where('event_delivery_tracking_id', $deliveryId)
            ->firstOrFail();
        $metadata = $this->deliveryMetadata($delivery->notes);
        if (array_key_exists('notes', $validated)) {
            $metadata['notes'] = $validated['notes'];
        }

        $delivery->update([
            'status' => $validated['status'],
            'venue' => $validated['location'] ?? $delivery->venue,
            'return_time' => $validated['return_time'] ?? $delivery->return_time,
            'notes' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        if ($delivery->meal_service_id) {
            $mealUpdate = ['delivery_status' => $validated['status']];
            if (in_array($validated['status'], ['arrived', 'serving', 'completed'], true)) {
                $mealUpdate['meal_status'] = $validated['status'] === 'completed' ? 'completed' : 'delivered';
            }
            MealService::where('meal_service_id', $delivery->meal_service_id)->update($mealUpdate);
        }

        return $this->ok($delivery->fresh(), 'Delivery status updated');
    }

    public function addDelivery(Request $request, $id)
    {
        $validated = $request->validate([
            'meal_service_id' => 'nullable|exists:meal_services,meal_service_id',
            'delivery_type' => 'nullable|string|max:50',
            'delivery_date' => 'nullable|date',
            'delivery_time' => 'nullable|string|max:50',
            'return_time' => 'nullable|string|max:50',
            'venue' => 'nullable|string|max:255',
            'driver' => 'nullable|string|max:120',
            'driver_phone' => 'nullable|string|max:40',
            'vehicle' => 'nullable|string|max:120',
            'items' => 'nullable|string|max:5000',
            'notes' => 'nullable|string',
        ]);

        $booking = Booking::with(['serviceEvent', 'mealServices.eventDay'])->findOrFail($id);
        $meal = !empty($validated['meal_service_id'])
            ? $booking->mealServices->firstWhere('meal_service_id', (int) $validated['meal_service_id'])
            : null;

        $delivery = EventDeliveryTracking::create([
            'booking_id' => $booking->booking_id,
            'meal_service_id' => $meal?->meal_service_id,
            'delivery_type' => $validated['delivery_type'] ?? $booking->serviceEvent?->service_type ?? 'food',
            'delivery_date' => $validated['delivery_date'] ?? $meal?->service_date?->toDateString() ?? $booking->serviceEvent?->event_date?->toDateString(),
            'delivery_time' => $validated['delivery_time'] ?? $meal?->dispatch_time,
            'return_time' => $validated['return_time'] ?? null,
            'venue' => $validated['venue'] ?? $booking->serviceEvent?->venue,
            'driver' => $validated['driver'] ?? null,
            'driver_phone' => $validated['driver_phone'] ?? null,
            'status' => 'pending',
            'notes' => json_encode([
                'vehicle' => $validated['vehicle'] ?? null,
                'items' => $validated['items'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        return $this->ok($this->formatDeliveryRows(collect([$delivery->fresh('mealService.eventDay')]))[0] ?? null, 'Delivery added successfully');
    }

    public function updateDelivery(Request $request, $id, $deliveryId)
    {
        $validated = $request->validate([
            'meal_service_id' => 'nullable|exists:meal_services,meal_service_id',
            'delivery_type' => 'nullable|string|max:50',
            'delivery_date' => 'nullable|date',
            'delivery_time' => 'nullable|string|max:50',
            'return_time' => 'nullable|string|max:50',
            'venue' => 'nullable|string|max:255',
            'driver' => 'nullable|string|max:120',
            'driver_phone' => 'nullable|string|max:40',
            'vehicle' => 'nullable|string|max:120',
            'items' => 'nullable|string|max:5000',
            'notes' => 'nullable|string',
            'status' => 'nullable|in:pending,preparing,departed,en_route,arrived,serving,completed,cancelled',
        ]);

        $booking = Booking::findOrFail($id);
        $delivery = EventDeliveryTracking::where('booking_id', $booking->booking_id)
            ->where('event_delivery_tracking_id', $deliveryId)
            ->firstOrFail();
        $metadata = $this->deliveryMetadata($delivery->notes);
        foreach (['vehicle', 'items', 'notes'] as $field) {
            if (array_key_exists($field, $validated)) {
                $metadata[$field] = $validated[$field];
            }
        }

        $delivery->update(array_filter([
            'meal_service_id' => $validated['meal_service_id'] ?? $delivery->meal_service_id,
            'delivery_type' => $validated['delivery_type'] ?? $delivery->delivery_type,
            'delivery_date' => $validated['delivery_date'] ?? $delivery->delivery_date,
            'delivery_time' => $validated['delivery_time'] ?? $delivery->delivery_time,
            'return_time' => $validated['return_time'] ?? $delivery->return_time,
            'venue' => $validated['venue'] ?? $delivery->venue,
            'driver' => $validated['driver'] ?? $delivery->driver,
            'driver_phone' => $validated['driver_phone'] ?? $delivery->driver_phone,
            'status' => $validated['status'] ?? $delivery->status,
            'notes' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ], fn($value) => $value !== null));

        return $this->ok(
            $this->formatDeliveryRows(collect([$delivery->fresh('mealService.eventDay')]))[0] ?? null,
            'Delivery updated successfully'
        );
    }

    public function deleteDelivery($id, $deliveryId)
    {
        $booking = Booking::findOrFail($id);
        $delivery = EventDeliveryTracking::where('booking_id', $booking->booking_id)
            ->where('event_delivery_tracking_id', $deliveryId)
            ->firstOrFail();
        $delivery->delete();

        return $this->ok(null, 'Delivery removed successfully');
    }

    public function getDailyProgress($id)
    {
        $booking = Booking::findOrFail($id);
        $eventService = app(EventService::class);

        return $this->ok($eventService->getMultiDayProgress($booking));
    }

    public function updateDailyProgress(Request $request, $id, $day)
    {
        $validated = $request->validate([
            'completion' => 'required|integer|min:0|max:100',
            'notes' => 'nullable|string',
            'attendance' => 'nullable|integer|min:0',
        ]);

        $booking = Booking::findOrFail($id);
        $eventService = app(EventService::class);
        $eventService->updateDailyProgress($booking, $day, $validated);

        // ✅ Notification: Daily progress milestone reached
        if ($validated['completion'] >= 100) {
            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $this->notificationService->notifyUser(
                    $customer->user_id,
                    'day_completed',
                    "Day {$day} Completed",
                    "Day {$day} of your event {$booking->booking_no} has been completed successfully.",
                    \App\Models\Notification::PRIORITY_MEDIUM,
                    ['booking_id' => $booking->booking_id, 'day' => $day]
                );
            }
        }

        return $this->ok(null, 'Daily progress updated');
    }

    public function updateAttendance(Request $request, $id, $day)
    {
        $validated = $request->validate([
            'present' => 'required|integer|min:0',
        ]);

        $booking = Booking::findOrFail($id);
        $eventService = app(EventService::class);
        $eventService->updateAttendance($booking, $day, $validated['present']);

        return $this->ok(null, 'Attendance updated');
    }

    public function advanceToNextDay($id)
    {
        $booking = Booking::findOrFail($id);
        $eventService = app(EventService::class);
        $result = $eventService->advanceToNextDay($booking);

        // ✅ Notification: Next day advanced
        if ($result['success']) {
            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $this->notificationService->notifyUser(
                    $customer->user_id,
                    'day_advanced',
                    'Event Day Advanced',
                    "Your event has advanced to day {$result['current_day']} of {$result['total_days']}.",
                    \App\Models\Notification::PRIORITY_MEDIUM,
                    ['booking_id' => $booking->booking_id, 'current_day' => $result['current_day']]
                );
            }
        }

        return $this->ok($result, $result['success'] ? 'Advanced to next day' : 'Cannot advance');
    }

    public function getSessions($id)
    {
        $booking = Booking::findOrFail($id);
        return $this->ok(app(EventService::class)->getSessions($booking));
    }

    public function addSession(Request $request, $id)
    {
        $validated = $request->validate([
            'day' => 'nullable|integer|min:1',
            'title' => 'required_without:name|string|max:150',
            'name' => 'required_without:title|string|max:150',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i|after:start_time',
            'location' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'status' => 'nullable|in:scheduled,in_progress,completed,cancelled',
        ]);

        $booking = Booking::findOrFail($id);
        return $this->ok(app(EventService::class)->addSession($booking, $validated), 'Session added successfully');
    }

    public function updateSessionStatus(Request $request, $id, $sessionId)
    {
        $validated = $request->validate([
            'status' => 'required|in:scheduled,in_progress,completed,cancelled',
        ]);

        $booking = Booking::findOrFail($id);
        return $this->ok(
            app(EventService::class)->updateSessionStatus($booking, (string) $sessionId, $validated['status']),
            'Session status updated'
        );
    }

    public function deleteSession($id, $sessionId)
    {
        $booking = Booking::findOrFail($id);
        app(EventService::class)->deleteSession($booking, (string) $sessionId);
        return $this->ok(null, 'Session deleted');
    }

    public function complete(Request $request, $id)
    {
        $validated = $request->validate([
            'force_complete' => 'nullable|boolean',
            'reason' => 'nullable|string|max:1000',
        ]);

        $booking = Booking::with(['serviceEvent', 'payments', 'invoice', 'quotation', 'order'])->findOrFail($id);
        $totalAmount = (float) ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0);
        $paidAmount = (float) $booking->payments->where('status', 'completed')->sum('amount');
        $outstandingBalance = max(0, $totalAmount - $paidAmount);
        $forceComplete = (bool) ($validated['force_complete'] ?? false);
        $reason = trim((string) ($validated['reason'] ?? ''));

        if ($outstandingBalance > 0.01 && ! $forceComplete) {
            return $this->fail('The event still has an unpaid balance. Pay the remaining balance or confirm completion as a debt booking event.', 422, [
                'requires_confirmation' => true,
                'outstanding_balance' => $outstandingBalance,
            ]);
        }

        if ($outstandingBalance > 0.01 && $reason === '') {
            return $this->fail('A reason is required to complete an event with an outstanding balance.', 422);
        }

        // ⭐ FIX: Before completing, verify that every checked kitchen task
        //    has a matching deduction record. If a task is marked done in the
        //    UI but has no deduction record (or vice versa), the completion
        //    would lock in an incorrect state forever.
        $orderTasks = [];
        if ($booking->order && $booking->order->kitchen_tasks) {
            $orderTasks = is_array($booking->order->kitchen_tasks)
                ? $booking->order->kitchen_tasks
                : (json_decode($booking->order->kitchen_tasks, true) ?: []);
        }
        $deductionKeys = \App\Models\Setting::where('group', 'kitchen_task_deductions')
            ->where('key', 'like', $booking->booking_id . ':%')
            ->pluck('key')
            ->map(fn($k) => str_replace($booking->booking_id . ':', '', $k))
            ->all();
        $deductionSet = array_flip($deductionKeys);

        $inconsistent = [];
        foreach ($orderTasks as $task) {
            $taskId = (string) ($task['id'] ?? '');
            if ($taskId === '') continue;
            $uiDone = (bool) ($task['is_done'] ?? false);
            $hasDeduction = isset($deductionSet[$taskId]);
            if ($uiDone !== $hasDeduction) {
                $inconsistent[] = [
                    'task_id' => $taskId,
                    'task' => $task['task'] ?? $task['name'] ?? 'Task',
                    'ui_done' => $uiDone,
                    'has_deduction' => $hasDeduction,
                ];
            }
        }

        if (! empty($inconsistent)) {
            return $this->fail(
                'Some kitchen tasks have an inconsistent state. Please re-check or un-check them before completing the event.',
                422,
                ['code' => 'kitchen_task_inconsistent', 'tasks' => $inconsistent]
            );
        }

        $eventService = app(EventService::class);
        $eventService->completeEvent(
            $booking,
            true,
            [
                'debt_booking_event' => $outstandingBalance > 0.01,
                'outstanding_balance' => $outstandingBalance,
                'override_reason' => $outstandingBalance > 0.01 ? $reason : null,
                'override_approved_by' => $outstandingBalance > 0.01 ? auth()->id() : null,
                'override_approved_at' => $outstandingBalance > 0.01 ? now()->toDateTimeString() : null,
                'approved_by' => auth()->id(),
                'approved_at' => now()->toDateTimeString(),
            ]
        );

        // ✅ Notification: Event completed
        $customer = $booking->serviceEvent?->customer;
        if ($customer && $customer->user_id) {
            $this->notificationService->notifyUser(
                $customer->user_id,
                'event_completed',
                $outstandingBalance > 0.01 ? 'Event Completed - Balance Due' : 'Event Completed',
                $outstandingBalance > 0.01
                    ? "Your event {$booking->booking_no} has been completed. An outstanding balance of ₱" . number_format($outstandingBalance, 2) . ' remains due.'
                    : "Your event {$booking->booking_no} has been completed successfully. Thank you for choosing us!",
                \App\Models\Notification::PRIORITY_HIGH,
                ['booking_id' => $booking->booking_id]
            );
        }

        return $this->ok([
            'event_completed' => true,
            'booking_completed' => true,
            'debt_booking_event' => $outstandingBalance > 0.01,
            'outstanding_balance' => $outstandingBalance,
        ], $outstandingBalance > 0.01
            ? 'Event completed and moved to history with an outstanding balance recorded.'
            : 'Event marked as completed');
    }

    public function getEquipment($id)
    {
        $booking = Booking::with('equipment.equipment')->findOrFail($id);
        $eventService = app(EventService::class);

        return $this->ok($eventService->getEventEquipment($booking));
    }

    public function approveAllEquipment(Request $request, $id)
    {
        $validated = $request->validate([
            'expected_return_date' => 'nullable|date',
            'condition_out' => 'nullable|string|max:500',
            'checked_out_by' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
        ]);

        $booking = Booking::with('equipment.equipment')->findOrFail($id);
        $items = $booking->equipment
            ->filter(fn($item) => ! (bool) ($item->is_out_approved ?? false) && $item->status !== 'returned')
            ->values();

        $updated = $this->approveEquipmentRows($booking, $items, $validated);

        return $this->ok([
            'approved_count' => $updated,
            'equipment' => app(EventService::class)->getEventEquipment($booking->fresh(['equipment.equipment'])),
        ], $updated > 0 ? 'All reserved equipment approved successfully' : 'No unapproved equipment remained');
    }

    public function approveSelectedEquipment(Request $request, $id)
    {
        $validated = $request->validate([
            'equipment_item_ids' => 'required|array|min:1',
            'equipment_item_ids.*' => 'integer|distinct|exists:booking_equipment,booking_equipment_id',
            'expected_return_date' => 'nullable|date',
            'condition_out' => 'nullable|string|max:500',
            'checked_out_by' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
        ]);

        $booking = Booking::with('equipment.equipment')->findOrFail($id);
        $items = BookingEquipment::where('booking_id', $booking->booking_id)
            ->whereIn('booking_equipment_id', $validated['equipment_item_ids'])
            ->get();

        if ($items->count() !== count($validated['equipment_item_ids'])) {
            return $this->fail('One or more selected equipment items do not belong to this event.', 422);
        }

        $updated = $this->approveEquipmentRows($booking, $items, $validated);

        return $this->ok([
            'approved_count' => $updated,
            'equipment' => app(EventService::class)->getEventEquipment($booking->fresh(['equipment.equipment'])),
        ], $updated > 0 ? 'Selected equipment approved successfully' : 'Selected equipment was already approved');
    }

    private function approveEquipmentRows(Booking $booking, $items, array $validated): int
    {
        $checkedOutBy = $validated['checked_out_by'] ?? auth()->user()?->person?->full_name ?: auth()->user()?->username ?: 'Event Management';
        $expectedReturnDate = $validated['expected_return_date']
            ?? $booking->serviceEvent?->event_end_date?->toDateString()
            ?? now()->addDays(7)->toDateString();
        $conditionOut = $validated['condition_out'] ?? 'Good';
        $notes = $validated['notes'] ?? null;

        $itemIds = collect($items)->pluck('booking_equipment_id')->filter()->values();

        return DB::transaction(function () use ($itemIds, $checkedOutBy, $expectedReturnDate, $conditionOut, $notes) {
            $count = 0;
            $lockedItems = BookingEquipment::whereIn('booking_equipment_id', $itemIds)
                ->lockForUpdate()
                ->get();

            foreach ($lockedItems as $equipmentItem) {
                if ((bool) ($equipmentItem->is_out_approved ?? false) || $equipmentItem->status === 'returned') {
                    continue;
                }

                $updateData = [
                    'status' => 'checked_out',
                    'quantity_used' => (int) ($equipmentItem->quantity_reserved ?? 0),
                    'checked_out_date' => $equipmentItem->checked_out_date ?? now(),
                    'rental_end_date' => $expectedReturnDate,
                    'condition_notes_out' => $conditionOut,
                    'checked_out_by' => $checkedOutBy,
                    'is_out_approved' => true,
                    'out_approved_at' => now(),
                ];
                if ($notes && Schema::hasColumn('booking_equipment', 'notes')) {
                    $updateData['notes'] = $notes;
                }
                $equipmentItem->update($updateData);
                $count++;
            }
            return $count;
        });
    }

    public function checkoutEquipment(Request $request, $id)
    {
        $validated = $request->validate([
            'booking_equipment_id' => 'nullable|exists:booking_equipment,booking_equipment_id',
            'equipment_id' => 'required_without:booking_equipment_id|exists:equipment,equipment_id',
            'quantity' => 'required_without:booking_equipment_id|integer|min:1',
            'expected_return_date' => 'required|date|after_or_equal:today',
            'condition_out' => 'nullable|string',
            'checked_out_by' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $booking = Booking::with('serviceEvent')->findOrFail($id);

        // Existing reservation approval: this is the normal Event Management workflow.
        if (! empty($validated['booking_equipment_id'])) {
            $equipmentItem = BookingEquipment::where('booking_id', $booking->booking_id)
                ->where('booking_equipment_id', $validated['booking_equipment_id'])
                ->firstOrFail();

            $updated = $this->approveEquipmentRows($booking, collect([$equipmentItem]), $validated);

            return $this->ok(
                $equipmentItem->fresh('equipment'),
                $updated > 0 ? 'Equipment checked out successfully' : 'Equipment was already approved'
            );
        }

        // New reservation workflow: validate stock through the existing equipment service first,
        // then approve the newly-created reservation. This keeps inventory calculations consistent.
        $startDate = $booking->serviceEvent?->event_date?->toDateString() ?? now()->toDateString();
        $equipmentItem = app(\App\Services\EquipmentService::class)->reserveEquipment(
            $booking,
            (int) $validated['equipment_id'],
            (int) $validated['quantity'],
            $startDate,
            $validated['expected_return_date']
        );

        $this->approveEquipmentRows($booking, collect([$equipmentItem]), $validated);
        $this->notificationService->equipmentReserved($equipmentItem->fresh(), $booking);

        return $this->ok($equipmentItem->fresh('equipment'), 'Equipment checked out successfully');
    }

    /**
     * ⭐ Quick status update for an equipment row from the Operations Hub.
     * PUT /events/{id}/equipment/{transactionId}/status
     */
    public function updateEquipmentStatus(Request $request, $id, $transactionId)
    {
        $validated = $request->validate([
            'status' => 'required|in:reserved,checked_out,returned',
            'checked_out_by' => 'nullable|string',
            'returned_at' => 'nullable|date',
        ]);

        $booking = Booking::findOrFail($id);
        $equipmentItem = BookingEquipment::where('booking_id', $booking->booking_id)
            ->where('booking_equipment_id', $transactionId)
            ->firstOrFail();

        $updateData = [
            'status' => $validated['status'],
        ];

        if ($validated['status'] === 'checked_out') {
            $updateData['is_out_approved'] = true;
            $updateData['out_approved_at'] = now();
            $updateData['checked_out_date'] = $equipmentItem->checked_out_date ?? now();
            if (!empty($validated['checked_out_by'])) {
                $updateData['checked_out_by'] = $validated['checked_out_by'];
            }
        } elseif ($validated['status'] === 'returned') {
            $updateData['checked_in_date'] = now();
            $updateData['returned_by'] = $validated['checked_out_by'] ?? 'Event Management';
        }

        $equipmentItem->update($updateData);

        return $this->ok(
            $equipmentItem->fresh(['equipment']),
            'Equipment status updated successfully.'
        );
    }

    public function returnEquipment(Request $request, $id, $transactionId)
    {
        $validated = $request->validate([
            'condition_in' => 'nullable|string|max:500',
            'quantity_used' => 'nullable|integer|min:0',
            'quantity_damaged' => 'nullable|integer|min:0',
            'quantity_missing' => 'nullable|integer|min:0',
            'returned_by' => 'nullable|string|max:150',
            'notes' => 'nullable|string|max:1000',
        ]);

        $booking = Booking::findOrFail($id);
        $equipmentItem = BookingEquipment::where('booking_id', $booking->booking_id)
            ->where('booking_equipment_id', $transactionId)
            ->firstOrFail();

        if ($equipmentItem->status === 'returned') {
            return $this->ok($equipmentItem->fresh('equipment'), 'Equipment was already returned');
        }

        $used = (int) ($validated['quantity_used'] ?? $equipmentItem->quantity_reserved ?? 0);
        $damaged = (int) ($validated['quantity_damaged'] ?? 0);
        $missing = (int) ($validated['quantity_missing'] ?? 0);
        if ($used + $damaged + $missing > (int) $equipmentItem->quantity_reserved) {
            return $this->fail('Used, damaged, and missing quantities cannot exceed the reserved quantity.', 422);
        }

        DB::transaction(function () use ($equipmentItem, $validated, $used, $damaged, $missing) {
            $equipmentItem->update([
                'status' => 'returned',
                'checked_in_date' => now(),
                'condition_notes_in' => $validated['condition_in'] ?? null,
                'returned_by' => $validated['returned_by'] ?? null,
                'return_notes' => $validated['notes'] ?? null,
                'quantity_used' => $used,
                'quantity_damaged' => $damaged,
                'quantity_missing' => $missing,
            ]);

            if (($damaged > 0 || $missing > 0) && $equipmentItem->equipment) {
                $equipmentItem->equipment->update(['condition' => 'Fair']);
            }
        });

        // Equipment damage/missing counts are kept on booking_equipment rows.

        // ✅ Notifications for damaged/missing equipment
        if (($validated['quantity_damaged'] ?? 0) > 0) {
            $this->notificationService->equipmentDamaged($equipmentItem, $booking, $validated['quantity_damaged']);
        }

        if (($validated['quantity_missing'] ?? 0) > 0) {
            $this->notificationService->equipmentMissing($equipmentItem, $booking, $validated['quantity_missing']);
        }

        // Check if equipment is overdue
        if ($equipmentItem->rental_end_date < now()) {
            $this->notificationService->equipmentReturnOverdue($equipmentItem, $booking);
        }

        return $this->ok($equipmentItem, 'Equipment returned successfully');
    }

    public function getPendingDeductions($id, InventoryService $inventoryService)
    {
        $booking = Booking::with(['items.menuItem.recipeIngredients.ingredient.stock'])
            ->findOrFail($id);

        $deductions = $inventoryService->getPendingDeductions($booking);

        return $this->ok([
            'booking_id' => $booking->booking_id,
            'booking_no' => $booking->booking_no,
            'customer_name' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
            'event_name' => $booking->serviceEvent?->eventType?->name ?? 'Event',
            'deductions' => $deductions,
        ]);
    }

    public function confirmDeductions(Request $request, $id, InventoryService $inventoryService)
    {
        $validated = $request->validate([
            'deductions' => 'nullable|array',
            'deductions.*.ingredient_id' => 'required|exists:ingredients,ingredient_id',
            'deductions.*.quantity' => 'required|numeric|min:0',
        ]);

        $booking = Booking::findOrFail($id);
        if ($booking->booking_status !== 'completed') {
            return $this->fail('Inventory deductions can only be confirmed after the booking is marked as completed.', 422);
        }

        $confirmedDeductions = [];
        foreach ($validated['deductions'] ?? [] as $deduction) {
            $confirmedDeductions[$deduction['ingredient_id']] = $deduction['quantity'];
        }

        $results = $inventoryService->deductForCompletedEvent($booking, $confirmedDeductions);

        // ✅ Notification: Ingredient computation completed
        if ($booking->order) {
            $this->notificationService->ingredientComputationCompleted($booking->order);
        }

        return $this->ok($results, 'Inventory deductions confirmed');
    }

    public function returnEventEquipment($eventCode)
    {
        $booking = Booking::where('booking_no', $eventCode)
            ->orWhere('booking_id', $eventCode)
            ->firstOrFail();

        $returnedCount = 0;
        foreach ($booking->equipment as $eq) {
            if ($eq->status !== 'returned') {
                $eq->update([
                    'status' => 'returned',
                    'checked_in_date' => now(),
                ]);
                $returnedCount++;
            }
        }

        return $this->ok(['returned' => $returnedCount], 'All equipment returned');
    }

    public function store(Request $request)
    {
        return $this->fail('Create events through a confirmed booking.', 422);
    }

    public function update(Request $request, $id)
    {
        $booking = Booking::with('serviceEvent')->findOrFail($id);
        if (! $booking->serviceEvent) {
            return $this->fail('This booking does not have an event record.', 422);
        }

        $validated = $request->validate([
            'event_date' => 'sometimes|required|date',
            'event_end_date' => 'nullable|date',
            'event_time' => 'sometimes|required|string|max:50',
            'venue' => 'sometimes|required|string|max:500',
            'guests_count' => 'sometimes|required|integer|min:1',
            'status' => 'sometimes|required|in:pending,confirmed,ongoing,completed,cancelled',
            'special_requests' => 'nullable|string|max:5000',
        ]);

        if (
            strtolower((string) $booking->booking_status) === 'ongoing'
            && in_array(strtolower((string) ($validated['status'] ?? '')), ['pending', 'confirmed'], true)
        ) {
            return $this->fail(
                'An ongoing event can only be reverted with the Un-start Event action.',
                422,
                ['code' => 'event_ongoing_locked']
            );
        }

        $startDate = Carbon::parse($validated['event_date'] ?? $booking->serviceEvent->event_date);
        if (! empty($validated['event_end_date']) && Carbon::parse($validated['event_end_date'])->lt($startDate)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'event_end_date' => 'The event end date must be on or after the event date.',
            ]);
        }

        DB::transaction(function () use ($booking, $validated) {
            $status = $validated['status'] ?? null;
            $eventData = $validated;
            unset($eventData['status']);
            if ($eventData !== []) {
                $booking->serviceEvent->update($eventData);
            }

            if ($status === 'completed') {
                app(EventService::class)->completeEvent($booking->fresh('serviceEvent'));
            } elseif ($status !== null) {
                $booking->update(['booking_status' => $status]);
                $booking->serviceEvent->update(['status' => $status]);
            }
        });

        return $this->ok($this->formatEvent($this->query()->findOrFail($id)), 'Event updated');
    }

    public function destroy($id)
    {
        $booking = Booking::with('serviceEvent')->findOrFail($id);

        DB::transaction(function () use ($booking) {
            // ⭐ FIX: Reverse every kitchen task deduction before cancelling.
            //    Without this, cancelling a booking leaves stock permanently
            //    deducted with no way for the user to recover it.
            $deductionRecords = \App\Models\Setting::where('group', 'kitchen_task_deductions')
                ->where('key', 'like', $booking->booking_id . ':%')
                ->get();

            $inventory = app(\App\Services\InventoryService::class);
            foreach ($deductionRecords as $record) {
                $payload = json_decode((string) $record->value, true) ?: [];
                $ingredients = $payload['ingredients'] ?? [];
                $deductionId = $payload['deduction_id'] ?? $record->key;

                foreach ($ingredients as $row) {
                    $inventory->move(
                        (int) $row['ingredient_id'],
                        (float) $row['quantity'],
                        'return',
                        "Booking cancelled — kitchen task reversed [{$deductionId}] (Booking {$booking->booking_no})"
                    );

                    $stockRow = \App\Models\InventoryStock::where('ingredient_id', (int) $row['ingredient_id'])->first();
                    if ($stockRow) {
                        $stockRow->update([
                            'reserved_quantity' => (float) $stockRow->reserved_quantity + (float) $row['quantity'],
                        ]);
                    }
                }

                $record->delete();
            }

            $booking->update(['booking_status' => 'cancelled']);
            $booking->serviceEvent?->update(['status' => 'cancelled']);
        });

        return $this->ok(null, 'Event cancelled');
    }
    public function track(Request $request, $id)
    {
        $data = $request->validate([
            'stage' => 'required|in:preparation,ready,ongoing,completed',
            'progress_percentage' => 'nullable|integer|min:0|max:100',
            'notes' => 'nullable'
        ]);
        $tracking = EventTracking::updateOrCreate(
            ['booking_id' => $id, 'stage' => $data['stage']],
            [
                'progress_percentage' => $data['progress_percentage'] ?? 0,
                'notes' => is_array($data['notes'] ?? null) ? json_encode($data['notes']) : ($data['notes'] ?? null),
                'stage_started_at' => now()
            ]
        );
        return $this->ok($tracking, 'Event tracking updated');
    }

    public function liveStatus($id)
    {
        $booking = $this->query()->findOrFail($id);
        return $this->ok($this->formatEvent($booking)['live_status']);
    }

    public function updateLiveStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'current_phase' => 'nullable|in:pending,confirmed,preparation,ready,ongoing,completed,cancelled',
            'progress' => 'nullable|integer|min:0|max:100',
            'notes' => 'nullable|string|max:5000',
            'issues' => 'nullable|array',
            'current_day' => 'nullable|integer|min:1',
            'is_done' => 'nullable|boolean',
        ]);

        $booking = Booking::with('serviceEvent')->findOrFail($id);
        $status = app(EventService::class)->updateLiveStatus($booking, $validated);

        return $this->ok($status, 'Live status updated');
    }


    public function startEvent(Request $request, $id)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
            'force_start' => 'nullable|boolean',
        ]);

        $booking = Booking::with(['serviceEvent', 'payments', 'invoice', 'quotation'])->findOrFail($id);

        // ⭐ Requirement #4 — never allow double-start.
        $currentBookingStatus = strtolower((string) $booking->booking_status);
        $currentEventStatus   = strtolower((string) ($booking->serviceEvent?->status ?? ''));
        if (
            in_array($currentBookingStatus, ['ongoing', 'completed'], true) ||
            in_array($currentEventStatus, ['ongoing', 'completed'], true)
        ) {
            return $this->ok(
                $this->formatEvent($this->query()->findOrFail($id)),
                'The event is already started.'
            );
        }

        $eventDate = $booking->serviceEvent?->event_date;
        $scheduledDate = $eventDate ? Carbon::parse($eventDate)->toDateString() : null;
        $today = now()->toDateString();
        $isDifferentDate = $scheduledDate && $scheduledDate !== $today;
        $totalAmount = (float) ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0);
        $paidAmount = (float) $booking->payments->where('status', 'completed')->sum('amount');
        $requiredDeposit = round($totalAmount * 0.30, 2);
        $depositBalance = max(0, $requiredDeposit - $paidAmount);
        $depositOverride = $depositBalance > 0.01 && ! empty($validated['force_start']);

        if (($isDifferentDate || $depositBalance > 0.01) && empty($validated['force_start'])) {
            if ($depositBalance > 0.01) {
                return $this->fail('The required 30% deposit has not been paid. Pay the deposit or confirm a manual override.', 422, [
                    'required_deposit' => $requiredDeposit,
                    'paid_amount' => $paidAmount,
                    'deposit_balance' => $depositBalance,
                    'requires_confirmation' => true,
                ]);
            }
            return $this->fail('This event is scheduled for ' . Carbon::parse($eventDate)->format('F d, Y') . '. Confirm manual start first.', 422);
        }

        if (($isDifferentDate || $depositOverride) && empty(trim((string) ($validated['reason'] ?? '')))) {
            return $this->fail('Please enter a reason before manually starting this event.', 422);
        }

        // ⭐ Requirement #6 — block start until all ingredients are purchased.
        //    force_start bypasses this (logged with a reason).
        if (empty($validated['force_start'])) {
            $settingsRow = \App\Models\Setting::where('group', 'ingredients_summary')
                ->where('key', 'booking_' . $booking->booking_id)
                ->first();
            $ingredientsList = $settingsRow ? (json_decode($settingsRow->value, true) ?: []) : [];
            $unpurchased = collect($ingredientsList)->filter(
                fn($i) => ($i['need_to_buy'] ?? false) === true && ($i['purchased'] ?? false) !== true
            );

            if ($unpurchased->count() > 0) {
                return $this->fail(
                    'You cannot start this event until all ingredients are purchased. ' .
                        $unpurchased->count() . ' ingredient(s) still need to be bought.',
                    422,
                    [
                        'code' => 'ingredients_incomplete',
                        'unpurchased' => $unpurchased->values()->all(),
                    ]
                );
            }
        }

        DB::transaction(function () use ($booking, $validated, $isDifferentDate, $depositOverride, $requiredDeposit, $paidAmount, $depositBalance) {
            if ($booking->serviceEvent) {
                $booking->serviceEvent->update(['status' => 'ongoing']);
            }

            $tracking = EventTracking::where('booking_id', $booking->booking_id)
                ->where('stage', 'ongoing')
                ->lockForUpdate()
                ->first();
            $metadata = $tracking ? json_decode((string) $tracking->notes, true) : [];
            $metadata = is_array($metadata) ? $metadata : [];
            $metadata = array_merge($metadata, [
                'started_manually' => $isDifferentDate || $depositOverride,
                'reason' => $validated['reason'] ?? null,
                'started_at' => now()->toDateTimeString(),
                'deposit_override' => $depositOverride,
                'required_deposit' => $requiredDeposit,
                'paid_at_start' => $paidAmount,
                'deposit_balance_at_start' => $depositBalance,
                'approved_by' => auth()->id(),
                'approved_at' => now()->toDateTimeString(),
            ]);

            EventTracking::updateOrCreate(
                ['booking_id' => $booking->booking_id, 'stage' => 'ongoing'],
                [
                    'progress_percentage' => max(10, (int) ($tracking?->progress_percentage ?? 0)),
                    'stage_started_at' => $tracking?->stage_started_at ?? now(),
                    'notes' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]
            );

            // ⭐ Requirement #4 — mark the booking as ongoing so Kitchen
            //    Preparation sees a valid started status after force-start.
            $booking->update(['booking_status' => 'ongoing']);

            // ⭐ FIX #1 — Only activate the first meal when the booking is
            //    genuinely Ongoing in the DB (defensive: this block runs after
            //    the status update, but we re-check to be safe).
            $freshStatus = strtolower((string) $booking->fresh()->booking_status);
            if (in_array($freshStatus, ['ongoing', 'completed'], true)) {
                $this->activateFirstMeal($booking);
            }
        });

        $this->logCustom(
            'force_start_event',
            'bookings',
            $booking->booking_id,
            "Event {$booking->booking_no} force-started",
            [
                'booking_no'       => $booking->booking_no,
                'customer'         => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                'scheduled_date'   => $scheduledDate,
                'started_at'       => now()->toDateTimeString(),
                'started_by'       => optional($request->user())->user_id,
                'started_by_name'  => optional($request->user())->person?->full_name ?? optional($request->user())->username ?? 'System',
                'deposit_override' => $depositOverride,
                'reason'           => $validated['reason'] ?? null,
            ]
        );

        return $this->ok($this->formatEvent($this->query()->findOrFail($id)), 'Event started.');
    }

    public function updateMealStatus(Request $request, $id, $mealServiceId)
    {
        $validated = $request->validate([
            'meal_status' => 'nullable|string|max:40',
            'preparation_status' => 'nullable|string|max:40',
            'delivery_status' => 'nullable|string|max:40',
            'serving_status' => 'nullable|string|max:40',
            'notes' => 'nullable|string',
        ]);

        $meal = MealService::where('booking_id', $id)->where('meal_service_id', $mealServiceId)->firstOrFail();
        $meal->update(array_filter($validated, fn($value) => $value !== null));

        return $this->ok($meal->fresh(), 'Meal service status updated.');
    }


    // ============================================================
    // ⭐ KITCHEN TASK — Complete + deduct ingredients
    // ============================================================
    /**
     * POST /events/{id}/kitchen-task/complete
     *
     * The client sends the ACTUAL quantities used. We:
     *   1. Lock the stock rows and validate availability
     *   2. Deduct via InventoryService::move() (writes movements + audit)
     *   3. Store the deduction id on the task metadata for reversal
     *
     * Idempotency is enforced by the `deduplication_key` column
     * (bookingId:taskId). A repeated submit returns already_deducted.
     */
        // (duplicate KITCHEN TASK HELPERS + startMeal removed — kept only the first copy)

    /**
     * POST /events/{id}/kitchen-task/complete
     *
     * Validates (backend) → event started, meal started, ingredients belong to the
     * recipe, qty ≤ live stock → locks stock rows → deducts ONCE → persists DONE
     * permanently (deduction record + task store). Idempotent.
     */
    // ============================================================
    // ⭐ KITCHEN TASK HELPERS — single source of truth for DONE state
    // ============================================================

    private function decodeJsonValue($value): array
    {
        if (is_array($value)) return $value;
        if (is_object($value)) return (array) $value;
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function resolveOrder(Booking $booking): ?\App\Models\Order
    {
        $booking->loadMissing('order');
        return $booking->order;
    }

    private function readKitchenTasks(Booking $booking): array
    {
        $order = $this->resolveOrder($booking);
        if (! $order) return [];

        $tasks = [];
        $meta  = Setting::where('group', 'order_metadata')->where('key', 'order_' . $order->order_id)->first();
        if ($meta) {
            $decoded = $this->decodeJsonValue($meta->value);
            if (! empty($decoded['kitchen_preparation']) && is_array($decoded['kitchen_preparation'])) {
                $tasks = $decoded['kitchen_preparation'];
            }
        }
        if (empty($tasks)) {
            $legacy = Setting::where('group', 'kitchen_tasks')->where('key', 'order_' . $order->order_id)->first();
            if ($legacy) $tasks = $this->decodeJsonValue($legacy->value);
        }
        if (empty($tasks) && ! empty($order->kitchen_tasks)) {
            $tasks = $this->decodeJsonValue($order->kitchen_tasks);
        }

        return array_values(array_filter($tasks, 'is_array'));
    }

    private function writeKitchenTasks(Booking $booking, array $tasks): void
    {
        $order = $this->resolveOrder($booking);
        if (! $order) return;

        $tasks = array_values($tasks);
        $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

        $metaSetting = Setting::where('group', 'order_metadata')->where('key', 'order_' . $order->order_id)->first();
        $metadata    = $metaSetting ? $this->decodeJsonValue($metaSetting->value) : [];
        $metadata['kitchen_preparation'] = $tasks;

        Setting::updateOrCreate(
            ['group' => 'order_metadata', 'key' => 'order_' . $order->order_id],
            ['value' => json_encode($metadata, $flags), 'type' => 'json']
        );
        Setting::updateOrCreate(
            ['group' => 'kitchen_tasks', 'key' => 'order_' . $order->order_id],
            ['value' => json_encode($tasks, $flags), 'type' => 'json']
        );

        if (Schema::hasColumn('orders', 'kitchen_tasks')) {
            try {
                $order->update(['kitchen_tasks' => json_encode($tasks, $flags)]);
            } catch (\Throwable $e) {
                Log::warning('Could not mirror kitchen tasks to orders.kitchen_tasks: ' . $e->getMessage());
            }
        }
    }

    private function deductedTaskIds(int $bookingId): array
    {
        $prefixLen = strlen((string) $bookingId) + 1;

        return Setting::where('group', 'kitchen_task_deductions')
            ->where('key', 'like', $bookingId . ':%')
            ->pluck('key')
            ->map(fn($key) => substr((string) $key, $prefixLen))
            ->all();
    }

    private function applyDeductionState(int $bookingId, array $tasks): array
    {
        $done = array_flip($this->deductedTaskIds($bookingId));

        return array_map(function ($task) use ($done) {
            $taskId = (string) ($task['id'] ?? '');
            if ($taskId !== '' && isset($done[$taskId])) {
                $task['is_done'] = true;
                $task['status']  = 'completed';
            }
            return $task;
        }, $tasks);
    }

    private function isBookingStarted(Booking $booking): bool
    {
        $booking->loadMissing('serviceEvent');

        // ⭐ PACKED / TRAY: These service types do not use the "Start Event" 
        // workflow. They are considered ready for kitchen prep and 
        // delivery/pickup as soon as they are confirmed.
        $serviceType = strtolower((string) ($booking->serviceEvent?->service_type ?? ''));
        if (in_array($serviceType, ['packed', 'tray'], true)) {
            return true;
        }

        return in_array(strtolower((string) $booking->booking_status), ['ongoing', 'completed'], true)
            || in_array(strtolower((string) ($booking->serviceEvent?->status ?? '')), ['ongoing', 'completed'], true);
    }

    private function clockMinutes($value): ?int
    {
        $text = trim((string) $value);
        if ($text === '') return null;
        try {
            $c = Carbon::parse($text);
            return ((int) $c->format('G')) * 60 + (int) $c->format('i');
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Meals in chronological order: day → scheduled time → meal sequence. */
    private function orderedMeals(Booking $booking)
    {
        $booking->loadMissing('mealServices.eventDay');

        return $booking->mealServices->map(function ($meal) {
            $type = strtolower(trim(str_replace('_', ' ', (string) $meal->meal_type)));
            return [
                'meal' => $meal,
                'day'  => (int) ($meal->eventDay?->day_number ?? $meal->day_number ?? 1),
                'time' => $this->clockMinutes($meal->serving_time),
                'seq'  => self::MEAL_SEQUENCE[$type] ?? 99,
            ];
        })->sort(function ($a, $b) {
            if ($a['day'] !== $b['day']) return $a['day'] <=> $b['day'];
            if ($a['time'] !== null && $b['time'] !== null && $a['time'] !== $b['time']) return $a['time'] <=> $b['time'];
            if ($a['seq'] !== $b['seq']) return $a['seq'] <=> $b['seq'];
            return (int) $a['meal']->meal_service_id <=> (int) $b['meal']->meal_service_id;
        })->values();
    }

    /** meal_service_id => true when every kitchen task of that meal is DONE. */
    private function mealCompletionMap(Booking $booking): array
    {
        $tasks  = $this->applyDeductionState((int) $booking->booking_id, $this->readKitchenTasks($booking));
        $byMeal = [];
        foreach ($tasks as $task) {
            if (! empty($task['is_header'])) continue;
            $mealId = (int) ($task['meal_service_id'] ?? 0);
            if ($mealId) $byMeal[$mealId][] = ! empty($task['is_done']);
        }

        $map = [];
        foreach ($booking->mealServices as $meal) {
            $flags = $byMeal[(int) $meal->meal_service_id] ?? [];
            $map[(int) $meal->meal_service_id] = empty($flags) ? true : ! in_array(false, $flags, true);
        }
        return $map;
    }

    private function activateFirstMeal(Booking $booking): void
    {
        try {
            $booking->load('mealServices.eventDay');
            $ordered = $this->orderedMeals($booking);
            if ($ordered->isEmpty()) return;

            if ($ordered->contains(fn($row) => $row['meal']->preparation_status === 'preparing')) return;

            $first = $ordered->first(fn($row) => $row['meal']->preparation_status !== 'completed');
            if ($first) {
                $first['meal']->update(['preparation_status' => 'preparing']);
            }
        } catch (\Throwable $e) {
            Log::warning('activateFirstMeal failed: ' . $e->getMessage());
        }
    }

    /**
     * POST /events/{id}/meals/{mealServiceId}/start
     * Starts a meal (GREEN). If an earlier meal still has open tasks the client
     * must confirm with confirm_incomplete_previous = true.
     */
    /**
     * POST /events/{id}/meals/{mealServiceId}/unstart
     *
     * Returns a started meal to "Not Started".
     *  • Does NOT change the booking/event status.
     *  • Does NOT touch inventory (use /kitchen-task/uncomplete per
     *    completed task to reverse a deduction).
     */
    public function unstartMeal(Request $request, $id, $mealServiceId)
    {
        $booking = Booking::with(['mealServices', 'order'])->findOrFail($id);
        $meal = $booking->mealServices->firstWhere('meal_service_id', (int) $mealServiceId);

        if (! $meal) {
            return $this->fail('Meal service not found for this booking.', 404);
        }

        if (! in_array($meal->preparation_status, ['preparing', 'completed'], true)) {
            return $this->ok([
                'meal_service_id'    => (int) $meal->meal_service_id,
                'preparation_status' => $meal->preparation_status,
                'already_pending'    => true,
            ], 'This meal is already Not Started.');
        }

        $meal->update(['preparation_status' => 'pending']);

        return $this->ok([
            'meal_service_id'    => (int) $meal->meal_service_id,
            'preparation_status' => 'pending',
            'already_pending'    => false,
        ], 'Meal returned to Not Started.');
    }

    public function startMeal(Request $request, $id, $mealServiceId)
    {
        $validated = $request->validate(['confirm_incomplete_previous' => 'nullable|boolean']);

        $booking = Booking::with(['serviceEvent', 'order', 'mealServices.eventDay'])->findOrFail($id);

        // ⭐ Packed/Tray don't require the event to be "ongoing"
        $isPackedTray = in_array(strtolower((string) ($booking->serviceEvent?->service_type ?? '')), ['packed', 'tray'], true);

        if (! $isPackedTray && ! $this->isBookingStarted($booking)) {
            return $this->fail('The event is not started yet, you cannot start a meal.', 422, ['code' => 'event_not_started']);
        }

        $meal = $booking->mealServices->firstWhere('meal_service_id', (int) $mealServiceId);
        if (! $meal) {
            return $this->fail('Meal service not found for this booking.', 404);
        }

        if (in_array($meal->preparation_status, ['preparing', 'completed'], true)) {
            return $this->ok([
                'meal_service_id'    => (int) $meal->meal_service_id,
                'preparation_status' => $meal->preparation_status,
                'already_started'    => true,
            ], 'This meal is already started.');
        }

        $ordered    = $this->orderedMeals($booking);
        $completion = $this->mealCompletionMap($booking);
        $position   = $ordered->search(fn($row) => (int) $row['meal']->meal_service_id === (int) $meal->meal_service_id);

        $previousIncomplete = $position === false
            ? collect()
            : $ordered->slice(0, $position)
            ->filter(fn($row) => ! ($completion[(int) $row['meal']->meal_service_id] ?? true))
            ->values();

        if ($previousIncomplete->isNotEmpty() && ! ($validated['confirm_incomplete_previous'] ?? false)) {
            $blocking = $previousIncomplete->first();
            $mealName = ucwords(strtolower(trim(str_replace('_', ' ', (string) $meal->meal_type))));

            return $this->fail(
                "You have not completed all the tasks for the previous meal. Are you sure you want to start the next meal: {$mealName}?",
                422,
                [
                    'code'               => 'previous_meal_incomplete',
                    'next_meal_type'     => $mealName,
                    'blocking_day'       => $blocking['day'],
                    'blocking_meal_type' => ucwords(strtolower(trim(str_replace('_', ' ', (string) $blocking['meal']->meal_type)))),
                    'pending_count'      => $previousIncomplete->count(),
                ]
            );
        }

        $meal->update(['preparation_status' => 'preparing']);

        return $this->ok([
            'meal_service_id'    => (int) $meal->meal_service_id,
            'preparation_status' => 'preparing',
            'already_started'    => false,
        ], 'Meal started.');
    }


    public function completeKitchenTask(Request $request, $id)
    {
        $validated = $request->validate([
            'task_id'                     => ['required', 'string', 'max:255'],
            'meal_service_id'             => ['nullable', 'integer', 'exists:meal_services,meal_service_id'],
            'menu_item_id'                => ['nullable', 'integer', 'exists:menu_items,menu_item_id'],
            'deduplication_key'           => ['nullable', 'string', 'max:255'],
            'force_complete'              => ['nullable', 'boolean'], // ⭐ NEW
            'ingredients'                 => ['required', 'array', 'min:1'],
            'ingredients.*.ingredient_id' => ['required', 'integer', 'exists:ingredients,ingredient_id'],
            'ingredients.*.quantity'      => ['required', 'numeric', 'min:0.001'],
            'ingredients.*.unit'          => ['nullable', 'string', 'max:20'],
        ]);

        $forceComplete = (bool) ($validated['force_complete'] ?? false);

        $booking = Booking::with([
            'serviceEvent',
            'order',
            'mealServices.eventDay',
            'items.menuItem.recipeIngredients.ingredient',
        ])->findOrFail($id);

        $taskId   = (string) $validated['task_id'];
        $dedupKey = "{$booking->booking_id}:{$taskId}"; // always server-derived (reversal uses the same key)

        // 1. Idempotency — already deducted?
        $existing = Setting::where('group', 'kitchen_task_deductions')->where('key', $dedupKey)->first();
        if ($existing) {
            $payload = $this->decodeJsonValue($existing->value);
            return $this->ok([
                'already_deducted' => true,
                'deduction_id'     => $payload['deduction_id'] ?? null,
                'task_id'          => $taskId,
                'booking_id'       => $booking->booking_id,
            ], 'Ingredients were already deducted for this task.');
        }

        // 2. Check if 30% deposit is paid (applies to ALL service types now)
        if (! $forceComplete) {
            $totalAmount = (float) ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0);
            $paidAmount  = (float) $booking->payments()->where('status', 'completed')->sum('amount');
            $requiredDeposit = round($totalAmount * 0.30, 2);

            if ($paidAmount < $requiredDeposit) {
                return $this->fail(
                    'The required 30% deposit has not been paid.',
                    422,
                    ['code' => 'deposit_required', 'required' => $requiredDeposit, 'paid' => $paidAmount]
                );
            }
        }

        // 3. The event MUST be Ongoing / Started (unless Packed/Tray or force-completed).
        $isPackedTray = in_array(strtolower((string) ($booking->serviceEvent?->service_type ?? '')), ['packed', 'tray'], true);

        if (! $isPackedTray && ! $this->isBookingStarted($booking) && ! $forceComplete) {
            return $this->fail(
                'The event is not started yet, you cannot mark as done this menu.',
                422,
                ['code' => 'event_not_started']
            );
        }

        // 3. The task must exist in the order's kitchen list.
        $taskRow = collect($this->readKitchenTasks($booking))
            ->first(fn($t) => (string) ($t['id'] ?? '') === $taskId && empty($t['is_header']));
        if (! $taskRow) {
            return $this->fail(
                'This kitchen task no longer exists in the order. Please refresh the kitchen list and try again.',
                422,
                ['code' => 'task_not_found']
            );
        }

        $mealServiceId = (int) ($taskRow['meal_service_id'] ?? $validated['meal_service_id'] ?? 0) ?: null;
        $menuItemId    = (int) ($taskRow['menu_item_id'] ?? $validated['menu_item_id'] ?? 0) ?: null;
        // 4. The meal must be started (GREEN).
        if ($mealServiceId) {
            $meal = $booking->mealServices->firstWhere('meal_service_id', $mealServiceId);
            if (! $meal) {
                return $this->fail('Meal service not found for this booking.', 422, ['code' => 'meal_not_found']);
            }

            // ⭐ PACKED / TRAY bypass the "Start Meal" requirement.
            $serviceType = strtolower((string) ($booking->serviceEvent?->service_type ?? ''));
            $isPackedTray = in_array($serviceType, ['packed', 'tray'], true);

            if (! $isPackedTray && ! in_array($meal->preparation_status, ['preparing', 'completed'], true)) {
                return $this->fail('Please start this meal first.', 422, ['code' => 'meal_not_started']);
            }
        }

        // 5. Recipe requirements come from the DB — ingredients must belong to this menu.
        $inventory    = app(\App\Services\InventoryService::class);
        $requirements = collect($inventory->getKitchenTaskRequirements($booking, $mealServiceId, $menuItemId))
            ->keyBy('ingredient_id');
        if ($requirements->isEmpty()) {
            return $this->fail(
                'No recipe ingredients are configured for this menu. Add a recipe before completing the task.',
                422,
                ['code' => 'no_recipe']
            );
        }

        $rows = collect($validated['ingredients'])
            ->groupBy('ingredient_id')
            ->map(fn($group) => [
                'ingredient_id' => (int) $group->first()['ingredient_id'],
                'quantity'      => round((float) $group->sum('quantity'), 3),
                'unit'          => $group->first()['unit'] ?? null,
            ])
            ->values();

        if ($rows->contains(fn($r) => ! $requirements->has((int) $r['ingredient_id']))) {
            return $this->fail(
                'One or more ingredients do not belong to this menu.',
                422,
                ['code' => 'ingredient_mismatch']
            );
        }

        $deductionId = 'KTD-' . now()->format('YmdHisv') . '-' . $booking->booking_id . '-' . random_int(100, 999);
        $userId      = auth()->id();

        // 6. Atomic: lock → re-check → validate stock → deduct → persist.
        $outcome = DB::transaction(function () use (
            $booking,
            $taskId,
            $dedupKey,
            $rows,
            $inventory,
            $deductionId,
            $mealServiceId,
            $menuItemId,
            $userId
        ) {
            $order = $this->resolveOrder($booking);
            if ($order) {
                Setting::where('group', 'order_metadata')->where('key', 'order_' . $order->order_id)->lockForUpdate()->first();
            }

            $ids    = $rows->pluck('ingredient_id')->map(fn($v) => (int) $v)->sort()->values()->all();
            $stocks = \App\Models\InventoryStock::whereIn('ingredient_id', $ids)
                ->orderBy('ingredient_id')
                ->lockForUpdate()
                ->get()
                ->keyBy('ingredient_id');

            // Second request waiting on the lock lands here → no double deduction.
            if (Setting::where('group', 'kitchen_task_deductions')->where('key', $dedupKey)->exists()) {
                return ['already' => true];
            }

            $shortages = [];
            foreach ($rows as $row) {
                $stock     = $stocks->get((int) $row['ingredient_id']);
                $available = $stock ? (float) $stock->current_quantity : 0.0;
                $requested = (float) $row['quantity'];
                if ($requested > $available + 0.0005) {
                    $ingredient  = \App\Models\Ingredient::find($row['ingredient_id']);
                    $shortages[] = [
                        'ingredient_id' => $row['ingredient_id'],
                        'name'          => $ingredient?->name ?? "Ingredient #{$row['ingredient_id']}",
                        'unit'          => $row['unit'] ?? $ingredient?->unit ?? '',
                        'required'      => round($requested, 3),
                        'available'     => round($available, 3),
                        'shortage'      => round($requested - $available, 3),
                    ];
                }
            }
            if (! empty($shortages)) {
                return ['shortages' => $shortages];
            }

            // Mark the task done in the store.
            $tasks   = $this->readKitchenTasks($booking);
            $matched = false;
            foreach ($tasks as &$t) {
                if ((string) ($t['id'] ?? '') === $taskId && empty($t['is_header'])) {
                    $t['is_done']      = true;
                    $t['status']       = 'completed';
                    $t['completed_at'] = now()->toIso8601String();
                    $t['completed_by'] = $userId;
                    $t['deduction_id'] = $deductionId;
                    $matched = true;
                    break;
                }
            }
            unset($t);

            if (! $matched) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'task_id' => 'This kitchen task no longer exists in the order. Please refresh the kitchen list and try again.',
                ]);
            }

            // Deduct (writes Stock Movements + audit through InventoryService::move).
            $movementIds = [];
            $deducted    = [];
            foreach ($rows as $row) {
                $ingredientId = (int) $row['ingredient_id'];
                $qty          = round((float) $row['quantity'], 3);

                $movement = $inventory->move(
                    $ingredientId,
                    -1 * $qty,
                    'usage',
                    "Kitchen task completed [{$deductionId}]: {$taskId} (Booking {$booking->booking_no})"
                );
                $movement->update(['reference_type' => 'KitchenTaskDeduction', 'reference_id' => null]);
                $movementIds[] = $movement->movement_id;

                $released = 0.0;
                $stockRow = \App\Models\InventoryStock::where('ingredient_id', $ingredientId)->first();
                if ($stockRow) {
                    $reservedBefore = (float) $stockRow->reserved_quantity;
                    $released       = min($qty, $reservedBefore);
                    $stockRow->update(['reserved_quantity' => max(0, $reservedBefore - $qty)]);
                }

                $deducted[] = [
                    'ingredient_id'     => $ingredientId,
                    'quantity'          => $qty,
                    'unit'              => $row['unit'] ?? null,
                    'reserved_released' => round($released, 3),
                ];
            }

            Setting::updateOrCreate(
                ['group' => 'kitchen_task_deductions', 'key' => $dedupKey],
                [
                    'value' => json_encode([
                        'deduction_id'    => $deductionId,
                        'booking_id'      => $booking->booking_id,
                        'task_id'         => $taskId,
                        'meal_service_id' => $mealServiceId,
                        'menu_item_id'    => $menuItemId,
                        'movement_ids'    => $movementIds,
                        'ingredients'     => $deducted,
                        'deducted_at'     => now()->toIso8601String(),
                        'deducted_by'     => $userId,
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'type'  => 'json',
                ]
            );

            // Persist DONE permanently (deduction overlay heals any lost flag).
            $tasks = $this->applyDeductionState((int) $booking->booking_id, $tasks);
            $this->writeKitchenTasks($booking, $tasks);

            // Meal fully done → BLUE.
            $mealCompleted = false;
            if ($mealServiceId) {
                $mealTasks = array_filter($tasks, fn($t) => empty($t['is_header']) && (int) ($t['meal_service_id'] ?? 0) === $mealServiceId);
                $mealCompleted = ! empty($mealTasks) && collect($mealTasks)->every(fn($t) => ! empty($t['is_done']));
                if ($mealCompleted) {
                    MealService::where('meal_service_id', $mealServiceId)->update(['preparation_status' => 'completed']);
                }
            }

            return ['done' => true, 'meal_completed' => $mealCompleted, 'count' => count($deducted)];
        });

        if (! empty($outcome['already'])) {
            return $this->ok([
                'already_deducted' => true,
                'task_id'          => $taskId,
                'booking_id'       => $booking->booking_id,
            ], 'Ingredients were already deducted for this task.');
        }

        if (! empty($outcome['shortages'])) {
            return $this->fail(
                'Not enough stock to complete this task.',
                422,
                ['code' => 'insufficient_stock', 'shortages' => $outcome['shortages']]
            );
        }

        return $this->ok([
            'already_deducted' => false,
            'deduction_id'     => $deductionId,
            'task_id'          => $taskId,
            'booking_id'       => $booking->booking_id,
            'booking_no'       => $booking->booking_no,
            'deducted_count'   => $outcome['count'],
            'meal_service_id'  => $mealServiceId,
            'meal_completed'   => (bool) $outcome['meal_completed'],
        ], 'Kitchen task completed and inventory updated.');
    }

    // ⚠️ Legacy copy removed — see git history if needed.
    private function __completeKitchenTaskLegacy_removed(Request $request, $id)
    {
        $validated = $request->validate([
            'task_id'                     => ['required', 'string', 'max:255'],
            'meal_service_id'             => ['nullable', 'integer', 'exists:meal_services,meal_service_id'],
            'menu_item_id'                => ['nullable', 'integer', 'exists:menu_items,menu_item_id'],
            'deduplication_key'           => ['nullable', 'string', 'max:255'],
            'ingredients'                 => ['required', 'array', 'min:1'],
            'ingredients.*.ingredient_id' => ['required', 'integer', 'exists:ingredients,ingredient_id'],
            'ingredients.*.quantity'      => ['required', 'numeric', 'min:0.001'],
            'ingredients.*.unit'          => ['nullable', 'string', 'max:20'],
        ]);

        $booking = Booking::with([
            'serviceEvent',
            'order',
            'mealServices.eventDay',
            'items.menuItem.recipeIngredients.ingredient',
        ])->findOrFail($id);

        $taskId   = (string) $validated['task_id'];
        $dedupKey = "{$booking->booking_id}:{$taskId}"; // always server-derived (reversal uses the same key)

        // 1. Idempotency — already deducted?
        $existing = Setting::where('group', 'kitchen_task_deductions')->where('key', $dedupKey)->first();
        if ($existing) {
            $payload = $this->decodeJsonValue($existing->value);
            return $this->ok([
                'already_deducted' => true,
                'deduction_id'     => $payload['deduction_id'] ?? null,
                'task_id'          => $taskId,
                'booking_id'       => $booking->booking_id,
            ], 'Ingredients were already deducted for this task.');
        }

        // 2. The event MUST be Ongoing / Started.
        // ⭐ Packed/Tray are exempt from this rule since they skip the "Start Event" workflow.
        $isPackedTray = in_array(strtolower((string) ($booking->serviceEvent?->service_type ?? '')), ['packed', 'tray'], true);

        if (! $isPackedTray && ! $this->isBookingStarted($booking)) {
            return $this->fail(
                'The event is not started yet, you cannot mark as done this menu.',
                422,
                ['code' => 'event_not_started']
            );
        }
        // 3. The task must exist in the order's kitchen list.
        $taskRow = collect($this->readKitchenTasks($booking))
            ->first(fn($t) => (string) ($t['id'] ?? '') === $taskId && empty($t['is_header']));
        if (! $taskRow) {
            return $this->fail(
                'This kitchen task no longer exists in the order. Please refresh the kitchen list and try again.',
                422,
                ['code' => 'task_not_found']
            );
        }

        $mealServiceId = (int) ($taskRow['meal_service_id'] ?? $validated['meal_service_id'] ?? 0) ?: null;
        $menuItemId    = (int) ($taskRow['menu_item_id'] ?? $validated['menu_item_id'] ?? 0) ?: null;

        // 4. The meal must be started (GREEN).
        if ($mealServiceId) {
            $meal = $booking->mealServices->firstWhere('meal_service_id', $mealServiceId);
            if (! $meal) {
                return $this->fail('Meal service not found for this booking.', 422, ['code' => 'meal_not_found']);
            }

            // ⭐ PACKED / TRAY bypass the "Start Meal" requirement.
            $isPackedTray = in_array(strtolower((string) ($booking->serviceEvent?->service_type ?? '')), ['packed', 'tray'], true);

            if (! $isPackedTray && ! in_array($meal->preparation_status, ['preparing', 'completed'], true)) {
                return $this->fail('Please start this meal first.', 422, ['code' => 'meal_not_started']);
            }
        }

        // 5. Recipe requirements come from the DB — ingredients must belong to this menu.
        $inventory    = app(\App\Services\InventoryService::class);
        $requirements = collect($inventory->getKitchenTaskRequirements($booking, $mealServiceId, $menuItemId))
            ->keyBy('ingredient_id');
        if ($requirements->isEmpty()) {
            return $this->fail(
                'No recipe ingredients are configured for this menu. Add a recipe before completing the task.',
                422,
                ['code' => 'no_recipe']
            );
        }

        $rows = collect($validated['ingredients'])
            ->groupBy('ingredient_id')
            ->map(fn($group) => [
                'ingredient_id' => (int) $group->first()['ingredient_id'],
                'quantity'      => round((float) $group->sum('quantity'), 3),
                'unit'          => $group->first()['unit'] ?? null,
            ])
            ->values();

        if ($rows->contains(fn($r) => ! $requirements->has((int) $r['ingredient_id']))) {
            return $this->fail(
                'One or more ingredients do not belong to this menu.',
                422,
                ['code' => 'ingredient_mismatch']
            );
        }

        $deductionId = 'KTD-' . now()->format('YmdHisv') . '-' . $booking->booking_id . '-' . random_int(100, 999);
        $userId      = auth()->id();

        // 6. Atomic: lock → re-check → validate stock → deduct → persist.
        $outcome = DB::transaction(function () use (
            $booking,
            $taskId,
            $dedupKey,
            $rows,
            $inventory,
            $deductionId,
            $mealServiceId,
            $menuItemId,
            $userId
        ) {
            $order = $this->resolveOrder($booking);
            if ($order) {
                Setting::where('group', 'order_metadata')->where('key', 'order_' . $order->order_id)->lockForUpdate()->first();
            }

            $ids    = $rows->pluck('ingredient_id')->map(fn($v) => (int) $v)->sort()->values()->all();
            $stocks = \App\Models\InventoryStock::whereIn('ingredient_id', $ids)
                ->orderBy('ingredient_id')
                ->lockForUpdate()
                ->get()
                ->keyBy('ingredient_id');

            // Second request waiting on the lock lands here → no double deduction.
            if (Setting::where('group', 'kitchen_task_deductions')->where('key', $dedupKey)->exists()) {
                return ['already' => true];
            }

            $shortages = [];
            foreach ($rows as $row) {
                $stock     = $stocks->get((int) $row['ingredient_id']);
                $available = $stock ? (float) $stock->current_quantity : 0.0;
                $requested = (float) $row['quantity'];
                if ($requested > $available + 0.0005) {
                    $ingredient  = \App\Models\Ingredient::find($row['ingredient_id']);
                    $shortages[] = [
                        'ingredient_id' => $row['ingredient_id'],
                        'name'          => $ingredient?->name ?? "Ingredient #{$row['ingredient_id']}",
                        'unit'          => $row['unit'] ?? $ingredient?->unit ?? '',
                        'required'      => round($requested, 3),
                        'available'     => round($available, 3),
                        'shortage'      => round($requested - $available, 3),
                    ];
                }
            }
            if (! empty($shortages)) {
                return ['shortages' => $shortages];
            }

            // Mark the task done in the store.
            $tasks   = $this->readKitchenTasks($booking);
            $matched = false;
            foreach ($tasks as &$t) {
                if ((string) ($t['id'] ?? '') === $taskId && empty($t['is_header'])) {
                    $t['is_done']      = true;
                    $t['status']       = 'completed';
                    $t['completed_at'] = now()->toIso8601String();
                    $t['completed_by'] = $userId;
                    $t['deduction_id'] = $deductionId;
                    $matched = true;
                    break;
                }
            }
            unset($t);

            if (! $matched) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'task_id' => 'This kitchen task no longer exists in the order. Please refresh the kitchen list and try again.',
                ]);
            }

            // Deduct (writes Stock Movements + audit through InventoryService::move).
            $movementIds = [];
            $deducted    = [];
            foreach ($rows as $row) {
                $ingredientId = (int) $row['ingredient_id'];
                $qty          = round((float) $row['quantity'], 3);

                $movement = $inventory->move(
                    $ingredientId,
                    -1 * $qty,
                    'usage',
                    "Kitchen task completed [{$deductionId}]: {$taskId} (Booking {$booking->booking_no})"
                );
                $movement->update(['reference_type' => 'KitchenTaskDeduction', 'reference_id' => null]);
                $movementIds[] = $movement->movement_id;

                $released = 0.0;
                $stockRow = \App\Models\InventoryStock::where('ingredient_id', $ingredientId)->first();
                if ($stockRow) {
                    $reservedBefore = (float) $stockRow->reserved_quantity;
                    $released       = min($qty, $reservedBefore);
                    $stockRow->update(['reserved_quantity' => max(0, $reservedBefore - $qty)]);
                }

                $deducted[] = [
                    'ingredient_id'     => $ingredientId,
                    'quantity'          => $qty,
                    'unit'              => $row['unit'] ?? null,
                    'reserved_released' => round($released, 3),
                ];
            }

            Setting::updateOrCreate(
                ['group' => 'kitchen_task_deductions', 'key' => $dedupKey],
                [
                    'value' => json_encode([
                        'deduction_id'    => $deductionId,
                        'booking_id'      => $booking->booking_id,
                        'task_id'         => $taskId,
                        'meal_service_id' => $mealServiceId,
                        'menu_item_id'    => $menuItemId,
                        'movement_ids'    => $movementIds,
                        'ingredients'     => $deducted,
                        'deducted_at'     => now()->toIso8601String(),
                        'deducted_by'     => $userId,
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'type'  => 'json',
                ]
            );

            // Persist DONE permanently (deduction overlay heals any lost flag).
            $tasks = $this->applyDeductionState((int) $booking->booking_id, $tasks);
            $this->writeKitchenTasks($booking, $tasks);

            // Meal fully done → BLUE.
            $mealCompleted = false;
            if ($mealServiceId) {
                $mealTasks = array_filter($tasks, fn($t) => empty($t['is_header']) && (int) ($t['meal_service_id'] ?? 0) === $mealServiceId);
                $mealCompleted = ! empty($mealTasks) && collect($mealTasks)->every(fn($t) => ! empty($t['is_done']));
                if ($mealCompleted) {
                    MealService::where('meal_service_id', $mealServiceId)->update(['preparation_status' => 'completed']);
                }
            }

            return ['done' => true, 'meal_completed' => $mealCompleted, 'count' => count($deducted)];
        });

        if (! empty($outcome['already'])) {
            return $this->ok([
                'already_deducted' => true,
                'task_id'          => $taskId,
                'booking_id'       => $booking->booking_id,
            ], 'Ingredients were already deducted for this task.');
        }

        if (! empty($outcome['shortages'])) {
            return $this->fail(
                'Not enough stock to complete this task.',
                422,
                ['code' => 'insufficient_stock', 'shortages' => $outcome['shortages']]
            );
        }

        return $this->ok([
            'already_deducted' => false,
            'deduction_id'     => $deductionId,
            'task_id'          => $taskId,
            'booking_id'       => $booking->booking_id,
            'booking_no'       => $booking->booking_no,
            'deducted_count'   => $outcome['count'],
            'meal_service_id'  => $mealServiceId,
            'meal_completed'   => (bool) $outcome['meal_completed'],
        ], 'Kitchen task completed and inventory updated.');
    }

    /**
     * POST /events/{id}/kitchen-task/uncomplete
     *
     * Reverses the deduction stored for this task. Completed events are
     * rejected — the operator must create an explicit adjustment instead.
     */
    /**
     * POST /events/{id}/kitchen-task/uncomplete
     * Restores the deducted quantities ONCE (row-locked), writes a "return"
     * Stock Movement, un-checks the task permanently.
     */
    public function uncompleteKitchenTask(Request $request, $id)
    {
        $validated = $request->validate([
            'task_id'      => ['required', 'string', 'max:255'],
            'deduction_id' => ['nullable', 'string', 'max:255'],
        ]);

        $booking = Booking::with(['serviceEvent', 'order'])->findOrFail($id);

        if (
            strtolower((string) $booking->booking_status) === 'completed'
            || strtolower((string) ($booking->serviceEvent?->status ?? '')) === 'completed'
        ) {
            return $this->fail(
                'This event is completed. Create an inventory adjustment instead of reversing the deduction.',
                422,
                ['code' => 'event_completed']
            );
        }

        $taskId    = (string) $validated['task_id'];
        $dedupKey  = "{$booking->booking_id}:{$taskId}";
        $inventory = app(\App\Services\InventoryService::class);

        $outcome = DB::transaction(function () use ($booking, $taskId, $dedupKey, $inventory) {
            $order = $this->resolveOrder($booking);
            if ($order) {
                Setting::where('group', 'order_metadata')->where('key', 'order_' . $order->order_id)->lockForUpdate()->first();
            }

            // Row-locked: a second concurrent request finds nothing and restores nothing.
            $record = Setting::where('group', 'kitchen_task_deductions')->where('key', $dedupKey)->lockForUpdate()->first();
            if (! $record) {
                return ['reversed' => false];
            }

            $payload     = $this->decodeJsonValue($record->value);
            $rows        = $payload['ingredients'] ?? [];
            $deductionId = $payload['deduction_id'] ?? $dedupKey;

            usort($rows, fn($a, $b) => (int) $a['ingredient_id'] <=> (int) $b['ingredient_id']);
            $ids = collect($rows)->pluck('ingredient_id')->map(fn($v) => (int) $v)->unique()->values()->all();
            if (! empty($ids)) {
                \App\Models\InventoryStock::whereIn('ingredient_id', $ids)->orderBy('ingredient_id')->lockForUpdate()->get();
            }

            foreach ($rows as $row) {
                $ingredientId = (int) $row['ingredient_id'];
                $qty          = (float) $row['quantity'];

                $movement = $inventory->move(
                    $ingredientId,
                    $qty,
                    'return',
                    "Kitchen task reversed [{$deductionId}] (Booking {$booking->booking_no})"
                );
                $movement->update(['reference_type' => 'KitchenTaskReversal', 'reference_id' => null]);

                // Give back exactly what was released from the reservation.
                $release  = (float) ($row['reserved_released'] ?? $qty);
                $stockRow = \App\Models\InventoryStock::where('ingredient_id', $ingredientId)->first();
                if ($stockRow && $release > 0) {
                    $stockRow->update(['reserved_quantity' => (float) $stockRow->reserved_quantity + $release]);
                }
            }

            Setting::where('group', 'kitchen_task_deductions')->where('key', $dedupKey)->delete();

            // Un-check the task in the store.
            $tasks         = $this->readKitchenTasks($booking);
            $mealServiceId = null;
            foreach ($tasks as $i => &$t) {
                if ((string) ($t['id'] ?? '') === $taskId) {
                    $mealServiceId = (int) ($t['meal_service_id'] ?? 0) ?: null;
                    if (! empty($t['synthetic'])) {
                        unset($tasks[$i]);
                        continue;
                    }
                    $t['is_done'] = false;
                    $t['status']  = 'pending';
                    unset($t['completed_at'], $t['completed_by'], $t['deduction_id']);
                }
            }
            unset($t);

            $tasks = $this->applyDeductionState((int) $booking->booking_id, array_values($tasks));
            $this->writeKitchenTasks($booking, $tasks);

            if ($mealServiceId) {
                MealService::where('meal_service_id', $mealServiceId)
                    ->where('preparation_status', 'completed')
                    ->update(['preparation_status' => 'preparing']);
            }

            return ['reversed' => true, 'deduction_id' => $deductionId, 'count' => count($rows)];
        });

        if (! $outcome['reversed']) {
            return $this->ok([
                'reversed' => false,
                'task_id'  => $taskId,
                'reason'   => 'no_deduction_found',
            ], 'No deduction was recorded for this task.');
        }

        return $this->ok([
            'reversed'       => true,
            'deduction_id'   => $outcome['deduction_id'],
            'task_id'        => $taskId,
            'restored_count' => $outcome['count'],
        ], 'Ingredient deduction reversed and stock restored.');
    }

    private function checklistDueAt($serviceDate, $servingTime): ?Carbon
    {
        if (! $serviceDate) {
            return null;
        }

        try {
            $date = Carbon::parse($serviceDate)->toDateString();
            $time = $servingTime ? Carbon::parse((string) $servingTime)->format('H:i:s') : '12:00:00';

            return Carbon::createFromFormat('Y-m-d H:i:s', "{$date} {$time}");
        } catch (\Throwable $exception) {
            Log::warning('Invalid meal checklist due date; using noon fallback', [
                'service_date' => (string) $serviceDate,
                'serving_time' => (string) $servingTime,
                'message' => $exception->getMessage(),
            ]);

            try {
                return Carbon::parse($serviceDate)->startOfDay()->addHours(12);
            } catch (\Throwable) {
                return null;
            }
        }
    }

    private function ensureChecklistRows(Booking $booking): array
    {
        $booking->loadMissing(['serviceEvent', 'mealServices.eventDay', 'eventChecklistItems', 'equipment.equipment', 'payments']);
        $defaults = [
            ['all_recipes_purchased', 'All ingredients/recipes purchased', 'Purchasing Team'],
            ['buffet_setup_completed', 'Buffet table setup completed', 'Operations Team'],
            ['utensils_arranged', 'Utensils arranged', 'Operations Team'],
            ['drinks_refilled', 'Drinks refilled', 'Service Crew'],
            ['staff_assigned', 'Staff assigned', 'Admin'],
            ['equipment_checked_out', 'Equipment checked out', 'Operations Team'],
            ['equipment_returned', 'Equipment returned', 'Operations Team'],
            ['dining_area_cleaned', 'Dining area cleaned', 'Service Crew'],
            ['payment_30_completed', '30% payment completed', 'Cashier'],
            ['food_delivered', 'Food delivered', 'Delivery Team'],
            ['breakfast_served', 'Breakfast served', 'Service Crew'],
            ['morning_snacks_served', 'Morning snacks served', 'Service Crew'],
            ['lunch_served', 'Lunch served', 'Service Crew'],
            ['afternoon_snacks_served', 'Afternoon snacks served', 'Service Crew'],
            ['dinner_served', 'Dinner served', 'Service Crew'],
        ];

        foreach ($defaults as [$key, $task, $assignee]) {
            $item = EventChecklistItem::firstOrCreate(
                ['booking_id' => $booking->booking_id, 'task_key' => $key],
                ['task' => $task, 'assigned_to' => $assignee, 'status' => 'pending', 'source_type' => 'system']
            );

            if ($item->source_type === 'system' && ($item->task !== $task || $item->assigned_to !== $assignee)) {
                $item->update(['task' => $task, 'assigned_to' => $assignee]);
            }
        }

        foreach ($booking->mealServices as $meal) {
            $taskKey = 'food_out_' . $meal->meal_service_id;
            $mealStatus = in_array($meal->meal_status, ['delivered', 'serving', 'served', 'completed'], true) ? 'completed' : 'pending';
            $mealValues = [
                'meal_service_id' => $meal->meal_service_id,
                'task' => 'Food already out: Day ' . $meal->day_number . ' - ' . $meal->meal_type . ' (' . ($meal->serving_time ?? '-') . ')',
                'assigned_to' => 'Kitchen / Delivery Team',
                'status' => $mealStatus,
                'source_type' => 'meal_service',
                'due_at' => $this->checklistDueAt($meal->service_date, $meal->serving_time),
            ];

            $mealItem = EventChecklistItem::firstOrCreate(
                ['booking_id' => $booking->booking_id, 'task_key' => $taskKey],
                $mealValues
            );

            if (! (bool) ($mealItem->manual_override ?? false)) {
                if (Schema::hasColumn('event_checklist_items', 'completed_at')) {
                    $mealValues['completed_at'] = $mealStatus === 'completed' ? now() : null;
                }
                $mealItem->update($mealValues);
            }
        }

        $rows = EventChecklistItem::with('mealService.eventDay')->where('booking_id', $booking->booking_id)->get();

        // Keep system-detected rows fresh without overwriting manual rows.
        $paid = (float) $booking->payments()->where('status', 'completed')->sum('amount');
        $allEquipmentOut = $booking->equipment->count() > 0 && $booking->equipment->every(fn($eq) => in_array($eq->status, ['checked_out', 'returned'], true));
        $allEquipmentReturned = $booking->equipment->count() > 0 && $booking->equipment->every(fn($eq) => $eq->status === 'returned');
        $allMealsDelivered = $booking->mealServices->count() > 0 && $booking->mealServices->every(fn($meal) => in_array($meal->delivery_status, ['arrived', 'serving', 'completed'], true) || in_array($meal->meal_status, ['delivered', 'serving', 'served', 'completed'], true));

        $preparationTracking = $booking->tracking()->where('stage', 'preparation')->first();
        $preparationMetadata = json_decode($preparationTracking?->notes ?? '[]', true);
        $hasAssignedStaff = ! empty($preparationMetadata['assigned_staff'] ?? []);

        $detected = [
            'staff_assigned' => $hasAssignedStaff,
            'payment_30_completed' => $paid >= (float) ($booking->required_deposit ?? 0),
            'equipment_checked_out' => $allEquipmentOut,
            'equipment_returned' => $allEquipmentReturned,
            'food_delivered' => $allMealsDelivered,
        ];
        foreach ($detected as $taskKey => $isDone) {
            $query = EventChecklistItem::where('booking_id', $booking->booking_id)
                ->where('task_key', $taskKey)
                ->where('source_type', 'system');
            if (Schema::hasColumn('event_checklist_items', 'manual_override')) {
                $query->where('manual_override', false);
            }
            $updates = ['status' => $isDone ? 'completed' : 'pending'];
            if (Schema::hasColumn('event_checklist_items', 'completed_at')) {
                $updates['completed_at'] = $isDone ? now() : null;
            }
            $query->update($updates);
        }

        return $this->formatChecklistRows(EventChecklistItem::with('mealService.eventDay')->where('booking_id', $booking->booking_id)->orderBy('event_checklist_item_id')->get());
    }

    private function formatChecklistRows($rows): array
    {
        return collect($rows)->map(fn($item) => [
            'id' => $item->event_checklist_item_id,
            'event_checklist_item_id' => $item->event_checklist_item_id,
            'meal_service_id' => $item->meal_service_id,
            'meal_type' => $item->mealService?->meal_type,
            'day_number' => $item->mealService?->day_number,
            'service_date' => $item->mealService?->service_date?->toDateString(),
            'task_key' => $item->task_key,
            'task' => $item->task,
            'assigned_to' => $item->assigned_to,
            'status' => $item->status,
            'completed' => $item->status === 'completed',
            'source_type' => $item->source_type,
            'manual_override' => (bool) ($item->manual_override ?? false),
            'completed_at' => $item->completed_at?->toDateTimeString(),
            'notes' => $item->notes,
        ])->values()->all();
    }

    private function eventWarnings(Booking $booking): array
    {
        $warnings = [];
        if ($booking->mealServices->isEmpty()) {
            $warnings[] = ['type' => 'meals', 'severity' => 'critical', 'message' => 'No meal services found for this event.'];
        }
        if ($booking->serviceEvent?->service_type === 'buffet' && $booking->equipment->isEmpty()) {
            $warnings[] = ['type' => 'equipment', 'severity' => 'warning', 'message' => 'Buffet event has no equipment assigned yet.'];
        }
        return $warnings;
    }

    private function ensureDeliveryRows(Booking $booking): array
    {
        $booking->loadMissing(['serviceEvent', 'mealServices.eventDay', 'deliveryTrackings.mealService.eventDay']);
        foreach ($booking->mealServices as $meal) {
            EventDeliveryTracking::firstOrCreate(
                ['booking_id' => $booking->booking_id, 'meal_service_id' => $meal->meal_service_id],
                [
                    'delivery_type' => $booking->serviceEvent?->service_type ?? 'food',
                    'delivery_date' => $meal->service_date?->toDateString() ?? $booking->serviceEvent?->event_date?->toDateString(),
                    'delivery_time' => $meal->dispatch_time,
                    'return_time' => null,
                    'venue' => $booking->serviceEvent?->venue,
                    'driver' => null,
                    'status' => $meal->delivery_status === 'pending' ? 'pending' : $meal->delivery_status,
                    'notes' => $meal->notes,
                ]
            );
        }
        return $this->formatDeliveryRows(EventDeliveryTracking::with('mealService.eventDay')->where('booking_id', $booking->booking_id)->orderBy('delivery_date')->orderBy('delivery_time')->get());
    }

    private function formatDeliveryRows($rows): array
    {
        return collect($rows)->map(function ($delivery) {
            $metadata = $this->deliveryMetadata($delivery->notes);
            return [
                'id' => $delivery->event_delivery_tracking_id,
                'event_delivery_tracking_id' => $delivery->event_delivery_tracking_id,
                'meal_service_id' => $delivery->meal_service_id,
                'day_number' => $delivery->mealService?->day_number,
                'meal_type' => $delivery->mealService?->meal_type,
                'event_date' => $delivery->delivery_date?->toDateString(),
                'delivery_date' => $delivery->delivery_date?->toDateString(),
                'delivery_time' => $delivery->delivery_time,
                'return_time' => $delivery->return_time,
                'venue' => $delivery->venue,
                'driver' => $delivery->driver,
                'driver_phone' => $delivery->driver_phone,
                'delivery_type' => $delivery->delivery_type,
                'status' => $delivery->status,
                'vehicle' => $metadata['vehicle'] ?? null,
                'items' => $metadata['items'] ?? null,
                'notes' => $metadata['notes'] ?? null,
            ];
        })->values()->all();
    }

    private function deliveryMetadata(?string $notes): array
    {
        if (! $notes) return [];
        $decoded = json_decode($notes, true);
        if (is_array($decoded)) return $decoded;
        $lines = preg_split('/\R/', $notes, 2) ?: [];
        return [
            'vehicle' => trim((string) ($lines[0] ?? '')) ?: null,
            'items' => null,
            'notes' => trim((string) ($lines[1] ?? '')) ?: null,
        ];
    }

    private function formatEvent(Booking $booking): array
    {
        $event = $booking->serviceEvent;
        $person = $event?->customer?->person;
        $customerName = $person?->full_name ?? 'Unknown';
        $eventName = $event?->eventType?->name ?? 'Event';

        $trackingRows = $booking->relationLoaded('tracking') ? $booking->tracking : collect();
        $mealRows = $booking->relationLoaded('mealServices') ? $booking->mealServices : collect();
        $eventDayRows = $booking->relationLoaded('eventDays') ? $booking->eventDays : collect();
        $equipmentRows = $booking->relationLoaded('equipment') ? $booking->equipment : collect();
        $checklistRows = $booking->relationLoaded('eventChecklistItems') ? $booking->eventChecklistItems : collect();
        $deliveryRows = $booking->relationLoaded('deliveryTrackings') ? $booking->deliveryTrackings : collect();
        $paymentRows = $booking->relationLoaded('payments') ? $booking->payments : collect();
        // ⭐ Kitchen tasks live in the settings store (same one OrderController writes to).
        $kitchenStoreTasks = $this->readKitchenTasks($booking);
        // ⭐ Fetch the saved kitchen tasks from the Order model        $orderTasks = [];
        if ($booking->order && $booking->order->kitchen_tasks) {
            $orderTasks = is_array($booking->order->kitchen_tasks)
                ? $booking->order->kitchen_tasks
                : (json_decode($booking->order->kitchen_tasks, true) ?: []);
        }

        if (! empty($kitchenStoreTasks)) {
            $orderTasks = $kitchenStoreTasks;
        }
        // ⭐ FIX (BUG A): Use deduction records as the source of truth for        //    `is_done`, but do NOT force `is_done: false` on tasks that have
        //    no deduction yet. Manual task edits (start time / assigned to /
        //    out for delivery) preserve their saved is_done flag, and legacy
        //    tasks marked done before the deduction system existed must not
        //    be silently reverted on every refresh.
        if (! empty($orderTasks)) {
            $deductionKeys = \App\Models\Setting::where('group', 'kitchen_task_deductions')
                ->where('key', 'like', $booking->booking_id . ':%')
                ->pluck('key')
                ->map(fn($k) => str_replace($booking->booking_id . ':', '', $k))
                ->all();

            $doneTaskIds = array_flip($deductionKeys);

            $orderTasks = array_map(function ($task) use ($doneTaskIds) {
                $taskId = (string) ($task['id'] ?? '');
                $hasDeduction = $taskId !== '' && isset($doneTaskIds[$taskId]);
                $savedDone    = (bool) ($task['is_done'] ?? false);

                if ($hasDeduction) {
                    // Deduction exists → task MUST be done.
                    $task['is_done'] = true;
                    $task['status']  = 'completed';
                } elseif ($savedDone && ! empty($task['synthetic'])) {
                    // Synthetic record (was appended by completeKitchenTask
                    // for a legacy position-based task) → trust its flag.
                    $task['is_done'] = true;
                    $task['status']  = 'completed';
                }
                // Else: leave whatever was saved — do NOT force false.

                return $task;
            }, $orderTasks);
        }
        // ⭐ Attach the LIVE meal state + schedule so the UI can colour the meal header
        //    (GREEN = started, BLUE = all tasks done) and show date / day / meal / time.
        if (! empty($orderTasks) && $mealRows->isNotEmpty()) {
            $mealById = $mealRows->keyBy('meal_service_id');
            $dayById  = $eventDayRows->pluck('day_number', 'event_day_id');

            $orderTasks = array_map(function ($task) use ($mealById, $dayById) {
                $mealId = $task['meal_service_id'] ?? null;
                $meal   = $mealId ? $mealById->get((int) $mealId) : null;
                if ($meal) {
                    $task['meal_preparation_status'] = $meal->preparation_status;
                    $task['meal_type']    = $meal->meal_type ?? ($task['meal_type'] ?? null);
                    $task['service_date'] = $meal->service_date?->toDateString() ?? ($task['service_date'] ?? null);
                    $task['serving_time'] = $meal->serving_time ?? ($task['serving_time'] ?? null);
                    $task['day_number']   = (int) ($dayById->get($meal->event_day_id) ?? $meal->day_number ?? ($task['day_number'] ?? 1));
                }
                return $task;
            }, $orderTasks);
        }

        $tracking = $trackingRows->where('stage', 'ongoing')->first();
        $progressData = json_decode($tracking?->notes ?? '[]', true);

        $preparationTracking = $trackingRows->where('stage', 'preparation')->first();
        $preparationMetadata = json_decode($preparationTracking?->notes ?? '[]', true);
        $assignedStaff = collect($preparationMetadata['assigned_staff'] ?? [])->values();
        $completedTracking = $trackingRows->where('stage', 'completed')->first();
        $completionMetadata = json_decode($completedTracking?->notes ?? '[]', true);
        $completionMetadata = is_array($completionMetadata) ? $completionMetadata : [];
        $mealServices = $mealRows->map(fn($meal) => [
            'id' => $meal->meal_service_id,
            'meal_service_id' => $meal->meal_service_id,
            'event_day_id' => $meal->event_day_id,
            'day_number' => (int) $meal->day_number,
            'date' => $meal->service_date?->toDateString(),
            'service_date' => $meal->service_date?->toDateString(),
            'meal_type' => $meal->meal_type,
            'serving_time' => $meal->serving_time,
            'preparation_time' => $meal->preparation_time,
            'dispatch_time' => $meal->dispatch_time,
            'arrival_time' => $meal->arrival_time,
            'pax' => (int) $meal->pax,
            'menu_source' => $meal->menu_source,
            'package_id' => $meal->package_id,
            'menu_item_id' => $meal->menu_item_id,
            // ⭐ FIX #6 — If it's a package, provide the individual item names
            // so the frontend View Details modal doesn't show a combined string.
            'menu_name' => $meal->menu_source === 'package'
                ? ($meal->package?->menuItems->pluck('name')->join(', ') ?: 'Package Items')
                : $meal->menu_name,
            'menu_description' => $meal->menu_description,
            'price_per_head' => (float) $meal->price_per_head,
            'total_meal_amount' => (float) $meal->total_meal_amount,
            'filters' => ($meal->relationLoaded('filters') ? $meal->filters : collect())->map(fn($filter) => [
                'filter_key' => $filter->filter_key,
                'filter_value' => $filter->filter_value,
            ])->values(),
            'custom_items' => ($meal->relationLoaded('customItems') ? $meal->customItems : collect())->map(fn($item) => [
                'meal_service_custom_item_id' => $item->meal_service_custom_item_id,
                'menu_item_id' => $item->menu_item_id,
                'item_name' => $item->item_name ?? $item->menuItem?->name,
                'description' => $item->description,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'notes' => $item->notes,
            ])->values(),
            'notes' => $meal->notes,
            'preparation_status' => $meal->preparation_status,
            'delivery_status' => $meal->delivery_status,
            'serving_status' => $meal->serving_status,
            'meal_status' => $meal->meal_status,
        ])->values();
        $maxMealDay = max(1, (int)($eventDayRows->max('day_number') ?? 1));
        $computedTotalDays = $event?->event_date && $event?->event_end_date
            ? max(1, Carbon::parse($event->event_date)->diffInDays(Carbon::parse($event->event_end_date)) + 1)
            : $maxMealDay;
        $timeline = $mealServices->map(fn($meal) => [
            'time' => $meal['serving_time'],
            'activity' => 'Serve ' . $meal['meal_type'] . ($meal['menu_name'] ? ' - ' . $meal['menu_name'] : ''),
            'status' => $meal['meal_status'] ?? 'pending',
            'date' => $meal['date'],
        ])->values();

        return [
            'id' => $booking->booking_id,
            'event_id' => $booking->booking_id,
            'event_name' => $eventName,
            'display_name' => "{$customerName} - {$eventName}",
            'customer_name' => $customerName,
            'event_type' => $eventName,
            'booking_no' => $booking->booking_no,
            'customer_email' => $person?->email,
            'customer_phone' => $person?->phone,
            'date' => $event?->event_date?->toDateString(),
            'end_date' => $event?->event_end_date?->toDateString(),
            'time' => $event?->event_time,
            'location' => $event?->venue,
            'venue' => $event?->venue,
            'status' => $booking->booking_status,
            // ⭐ Keep Orders & Events consistent with Bookings.
            'booking_source' => $booking->booking_source ?? 'walk_in',
            'order_status' => $booking->order?->status,
            'guests_count' => $event?->guests_count ?? 0,
            'status' => $booking->booking_status,
            // ⭐ Keep Orders & Events consistent with Bookings.
            'booking_source' => $booking->booking_source ?? 'walk_in',
            // ⭐ SERVICE TYPE — surfaced so the frontend can render the
            //    correct Operations Hub layout and completion action.
            'service_type' => $event?->service_type,
            'service_type_label' => (function () use ($event) {
                $svc = strtolower((string) ($event?->service_type ?? 'buffet'));
                return match ($svc) {
                    'packed' => 'Packed',
                    'tray'   => 'Tray',
                    default  => 'Buffet',
                };
            })(),
            'is_packed_or_tray' => in_array(strtolower((string) ($event?->service_type ?? '')), ['packed', 'tray'], true),
            // ⭐ Normalized completion mode — always 'deliver' or 'pickup'.
            //    Mirrors the same resolution used by BookingController so
            //    both modules agree on the correct action label.
            'packed_tray_mode' => (function () use ($event) {
                $svc = strtolower(trim((string) ($event?->service_type ?? '')));
                if (! in_array($svc, ['packed', 'tray'], true)) return null;
                $raw = strtolower(trim((string) ($event?->delivery_method ?? '')));
                $normalized = str_replace([' ', '-'], '_', $raw);
                return in_array($normalized, ['delivery', 'deliver', 'delivered'], true)
                    ? 'deliver'
                    : 'pickup';
            })(),
            // ⭐ The raw customer-facing delivery method — untouched.
            'delivery_method' => $event?->delivery_method,
            'delivery_completed_at' => $event?->delivery_completed_at ?? null,
            'pickup_completed_at' => $event?->pickup_completed_at ?? null,
            'order_status' => $booking->order?->status,
            'total_amount' => $booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0,
            'paid_amount' => $booking->invoice?->paid_amount ?? $paymentRows->where('status', 'completed')->sum('amount') ?? 0,
            'balance' => max(0, ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0) - ($paymentRows->where('status', 'completed')->sum('amount') ?? 0)),
            'progress' => $tracking?->progress_percentage ?? 0,
            'is_multi_day' => ($event?->booking_scope === 'multi_day') || $computedTotalDays > 1,
            'total_days' => $computedTotalDays,
            'current_day' => $progressData['current_day'] ?? 1,
            'assigned_staff' => $assignedStaff,
            'total_staff_required' => $assignedStaff->count(),
            'event_completed' => (bool) ($completionMetadata['event_completed'] ?? false),
            'debt_booking_event' => (bool) ($completionMetadata['debt_booking_event'] ?? false),
            'was_debt_booking_event' => (bool) ($completionMetadata['was_debt_booking_event'] ?? $completionMetadata['debt_booking_event'] ?? false),
            'completion_override_reason' => $completionMetadata['override_reason'] ?? null,
            'outstanding_balance' => max(0, ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0) - ($paymentRows->where('status', 'completed')->sum('amount') ?? 0)),
            'equipment_in_out' => $equipmentRows->map(fn($eq) => [
                'id' => $eq->booking_equipment_id,
                'equipment_name' => $eq->equipment?->name,
                'equipment_status' => $eq->status,
                'quantity' => $eq->quantity_reserved,
                'unit' => 'units',
                'checkout_date' => $eq->checked_out_date?->toDateString(),
                'expected_return_date' => $eq->rental_end_date?->toDateString(),
                'actual_return_date' => $eq->checked_in_date?->toDateString(),
                'status' => $eq->status,
                'check_out_status' => ($eq->is_out_approved ?? false) ? 'approved' : 'pending_approval',
                'check_in_status' => $eq->checked_in_date ? 'returned' : 'not_returned',
                'condition_out' => $eq->condition_notes_out,
                'condition_in' => $eq->condition_notes_in,
                'is_out_approved' => (bool) ($eq->is_out_approved ?? false),
                'checked_out_by' => $eq->checked_out_by ?? null,
                'returned_by' => $eq->returned_by ?? null,
                'return_notes' => $eq->return_notes ?? null,
                'quantity_used' => (int) ($eq->quantity_used ?? 0),
                'quantity_damaged' => (int) ($eq->quantity_damaged ?? 0),
                'quantity_missing' => (int) ($eq->quantity_missing ?? 0),
            ]),
            'live_status' => [
                'current_phase' => $booking->booking_status,
                'progress' => $tracking?->progress_percentage ?? 0,
                'next_milestone' => $booking->booking_status === 'confirmed' ? 'Event preparation' : 'Event completion',
                'issues' => [],
                'notes' => '',
            ],
            'kitchen_preparation' => $orderTasks,  // ⭐ Added saved kitchen tasks
            'checklist' => $this->formatChecklistRows($checklistRows),
            'delivery_tracking' => $this->formatDeliveryRows($deliveryRows),
            'event_days' => $eventDayRows->map(fn($day) => [
                'day_number' => (int) $day->day_number,
                'date' => $day->date?->toDateString(),
                'day_status' => $day->day_status,
                'day_total_amount' => (float) $day->day_total_amount,
            ])->values(),
            'meal_services' => $mealServices,
            'meal_schedule' => $mealServices,
            'timeline' => $timeline,

            // ⭐ KEY #1 + #3 — Multi-day metadata for the frontend.
            //    `days` / `total_days` / `event_end_date` must survive
            //    every round-trip so the table, badge, and Day Schedule
            //    pane render correctly.
            'event_date' => $event?->event_date?->toDateString(),
            'event_end_date' => ($event?->event_end_date ?? $event?->event_date)?->toDateString(),
            'days' => $computedTotalDays,
            'total_days' => $computedTotalDays,
            'is_multi_day' => (bool) (($event?->booking_scope === 'multi_day') || $computedTotalDays > 1),
            'booking_scope' => $event?->booking_scope ?? 'regular',

            // ⭐ KEY #3 — Per-day order rows. Each entry is the meals that
            // belong to that day, so the frontend can render one row per
            // day without re-grouping on the client.
            'meal_services_by_day' => $mealServices
                ->groupBy(fn($m) => (int) ($m['day_number'] ?? 1))
                ->sortKeys()
                ->map(fn($rows) => $rows->values())
                ->values(),
        ];
    }
}
