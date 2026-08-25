<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Models\Role;
use App\Models\AuditLog;
use App\Support\NotificationCatalog;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Send notification to a specific user
     */
    public function notifyUser($userId, $type, $title, $message, $priority = Notification::PRIORITY_MEDIUM, $data = null, $actionUrl = null)
    {
        $type = NotificationCatalog::normalizeType($type);
        $payload = is_array($data) ? $data : ((array) $data);
        $definition = NotificationCatalog::definition($type);
        $title = $title ?: ($definition['title'] ?? '📢 System Notification');
        $priority = $priority ?: ($definition['priority'] ?? Notification::PRIORITY_MEDIUM);
        $actionUrl = NotificationCatalog::destination($type, $payload, $actionUrl);

        if ($this->shouldSkipDuplicate($userId, $type, $payload, $title)) {
            return null;
        }

        $notification = Notification::createNotification($userId, $type, $title, $message, $priority, $payload, $actionUrl);
        $this->logNotificationAction('notification_sent', $notification);

        return $notification;
    }

    /**
     * Send notification to all users with a specific role
     */
    public function notifyRole($roleSlug, $type, $title, $message, $priority = Notification::PRIORITY_MEDIUM, $data = null, $actionUrl = null)
    {
        $users = User::whereHas('roles', function ($query) use ($roleSlug) {
            $query->where('slug', $roleSlug);
        })->get();

        // Keep notifications functional even when optional roles like inventory_staff
        // or operations_staff do not exist in older databases. Critical system
        // notifications must still reach admins.
        if ($users->isEmpty() && $roleSlug !== 'admin') {
            $users = User::whereHas('roles', function ($query) {
                $query->where('slug', 'admin');
            })->get();
        }

        foreach ($users as $user) {
            $this->notifyUser($user->user_id, $type, $title, $message, $priority, $data, $actionUrl);
        }
    }

    /**
     * Send notification to multiple roles
     */
    public function notifyRoles($roleSlugs, $type, $title, $message, $priority = Notification::PRIORITY_MEDIUM, $data = null, $actionUrl = null)
    {
        $roleSlugs = collect((array) $roleSlugs)->filter()->unique()->values();
        $users = User::whereHas('roles', function ($query) use ($roleSlugs) {
            $query->whereIn('slug', $roleSlugs);
        })->get()->unique('user_id');

        if ($users->isEmpty()) {
            $users = User::whereHas('roles', function ($query) {
                $query->where('slug', 'admin');
            })->get()->unique('user_id');
        }

        foreach ($users as $user) {
            $this->notifyUser($user->user_id, $type, $title, $message, $priority, $data, $actionUrl);
        }
    }

    /**
     * Create a notification from the functional catalog.
     * Use this for new system events so all destinations, priorities and categories stay consistent.
     */
    public function notifySystemEvent($type, string $message, array $data = [], ?array $roles = null, ?string $title = null, ?string $priority = null, ?string $actionUrl = null): void
    {
        $type = NotificationCatalog::normalizeType($type);
        $definition = NotificationCatalog::definition($type);
        $roles = $roles ?: ($definition['roles'] ?? ['admin']);
        $title = $title ?: ($definition['title'] ?? '📢 System Notification');
        $priority = $priority ?: ($definition['priority'] ?? Notification::PRIORITY_MEDIUM);
        $actionUrl = NotificationCatalog::destination($type, $data, $actionUrl);

        $this->notifyRoles($roles, $type, $title, $message, $priority, $data, $actionUrl);
    }

    public function notificationCatalog(): array
    {
        return NotificationCatalog::all();
    }

    private function shouldSkipDuplicate($userId, string $type, array $data, string $title): bool
    {
        $reference = $data['reference_id']
            ?? $data['ingredient_id']
            ?? $data['equipment_id']
            ?? $data['booking_id']
            ?? $data['purchase_request_id']
            ?? $data['attendance_id']
            ?? $data['invoice_id']
            ?? null;

        if (!$reference) {
            return false;
        }

        return Notification::where('user_id', $userId)
            ->where('type', $type)
            ->where('title', $title)
            ->where('created_at', '>=', now()->subHours(12))
            ->where(function ($query) use ($reference) {
                $query->where('data->reference_id', $reference)
                    ->orWhere('data->ingredient_id', $reference)
                    ->orWhere('data->equipment_id', $reference)
                    ->orWhere('data->booking_id', $reference)
                    ->orWhere('data->purchase_request_id', $reference)
                    ->orWhere('data->attendance_id', $reference)
                    ->orWhere('data->invoice_id', $reference);
            })
            ->exists();
    }

    private function logNotificationAction(string $action, ?Notification $notification): void
    {
        if (!$notification) {
            return;
        }

        try {
            AuditLog::log(
                $action,
                'notifications',
                $notification->notification_id,
                null,
                [
                    'type' => $notification->type,
                    'title' => $notification->title,
                    'user_id' => $notification->user_id,
                    'priority' => $notification->priority,
                    'destination' => $notification->action_url,
                ],
                'Notification ' . str_replace('_', ' ', $action)
            );
        } catch (\Throwable $e) {
            Log::warning('Notification audit log failed: ' . $e->getMessage());
        }
    }

    // ==================== 📅 BOOKING NOTIFICATIONS ====================
    
    public function bookingSubmitted($booking)
    {
        $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        $eventDate = $booking->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';
        
        $this->notifyRole('admin', 
            Notification::TYPE_BOOKING_SUBMITTED,
            '📅 New Booking Request',
            "New booking request from {$customerName} for {$eventDate}.",
            Notification::PRIORITY_HIGH,
            ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
            "/admin/bookings/{$booking->booking_id}"
        );
    }

    public function bookingRequestReceived($booking)
    {
        $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        $bookingNo = $booking->booking_no;
        $eventDate = $booking->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';
        
        $this->notifyRole('admin',
            Notification::TYPE_BOOKING_REQUEST,
            '🆕 New Booking',
            "New booking request received ({$bookingNo}) from {$customerName} for {$eventDate}.",
            Notification::PRIORITY_HIGH,
            ['booking_id' => $booking->booking_id, 'booking_no' => $bookingNo],
            "/admin/bookings/{$booking->booking_id}"
        );
    }

    public function quotationRequested($quotation)
    {
        $customerName = $quotation->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        
        $this->notifyRole('admin',
            Notification::TYPE_QUOTATION_REQUEST,
            '📋 New Quotation Request',
            "Quotation request received from {$customerName}.",
            Notification::PRIORITY_HIGH,
            ['quotation_id' => $quotation->quotation_id, 'quote_no' => $quotation->quote_no],
            "/admin/quotations/{$quotation->quotation_id}"
        );
    }

    public function quotationAccepted($quotation, $booking)
    {
        $customerName = $quotation->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        
        $this->notifyRole('admin',
            Notification::TYPE_QUOTATION_ACCEPTED,
            '✅ Quotation Accepted',
            "Quotation {$quotation->quote_no} accepted by customer {$customerName}.",
            Notification::PRIORITY_HIGH,
            ['quotation_id' => $quotation->quotation_id, 'booking_id' => $booking->booking_id],
            "/admin/bookings/{$booking->booking_id}"
        );
    }

    public function scheduleConflictWarning($date, $conflictingBookings)
    {
        $conflictCount = count($conflictingBookings);
        
        $this->notifyRole('admin',
            Notification::TYPE_SCHEDULE_CONFLICT,
            '⚠️ Schedule Conflict Warning',
            "Booking conflict detected on {$date}. {$conflictCount} overlapping booking(s).",
            Notification::PRIORITY_HIGH,
            ['date' => $date, 'conflicts' => $conflictingBookings],
            "/admin/booking-calendar"
        );
    }

    public function bookingCancelled($booking, $reason = null)
    {
        $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        
        $this->notifyRole('admin',
            Notification::TYPE_BOOKING_CANCELLED,
            '🚫 Booking Cancellation Request',
            "Booking {$booking->booking_no} has been cancelled by {$customerName}." . ($reason ? " Reason: {$reason}" : ''),
            Notification::PRIORITY_MEDIUM,
            ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no, 'reason' => $reason],
            "/admin/bookings/{$booking->booking_id}"
        );
    }

    public function bookingRescheduleRequested($booking, $newDate, $newTime, $reason)
    {
        $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        
        $this->notifyRole('admin',
            Notification::TYPE_BOOKING_RESCHEDULED,
            '🔄 Booking Reschedule Request',
            "Booking {$booking->booking_no} requested a new schedule for {$newDate} at {$newTime}. Reason: {$reason}",
            Notification::PRIORITY_HIGH,
            ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no, 'new_date' => $newDate, 'new_time' => $newTime],
            "/admin/bookings/{$booking->booking_id}"
        );
    }

public function bookingConvertedToOrder($order)
{
    $bookingNo = $order->booking?->booking_no ?? 'Unknown';
    $eventDate = $order->booking?->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';
    $customerName = $order->booking?->serviceEvent?->customer?->person?->full_name ?? 'Customer';
    
    // Send to ADMIN instead of operations_staff
    $this->notifyRole('admin',
        Notification::TYPE_ORDER_READY,
        '✅ Booking Approved & Order Created',
        "Booking {$bookingNo} for {$customerName} on {$eventDate} has been approved. Order #{$order->order_number} has been created and is ready for processing.",
        Notification::PRIORITY_HIGH,
        ['order_id' => $order->order_id, 'order_number' => $order->order_number, 'booking_id' => $order->booking_id],
        "/admin/orders/{$order->order_id}"
    );
}


public function bookingApprovedNotification($booking)
{
    $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
    $eventDate = $booking->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';
    $eventTime = $booking->serviceEvent?->event_time ?? 'TBD';
    $venue = $booking->serviceEvent?->venue ?? 'TBD';
    $totalAmount = $booking->quotation?->total_amount ?? 0;
    
    $this->notifyRole('admin',
        'booking_approved',
        '✅ Booking Approval',
        "Booking {$booking->booking_no} for {$customerName} has been APPROVED.\n\n" .
        "📅 Event: {$eventDate} at {$eventTime}\n" .
        "📍 Venue: {$venue}\n" .
        "💰 Amount: ₱" . number_format($totalAmount, 2) . "\n\n" .
        "✅ Order created\n" .
        "✅ Invoice generated\n" .
        "✅ Ingredients reserved\n" .
        "✅ Equipment reserved",
        \App\Models\Notification::PRIORITY_HIGH,
        ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
        "/admin/bookings/{$booking->booking_id}"
    );
}



    // ==================== 📦 INVENTORY NOTIFICATIONS ====================
    
    public function lowStockWarning($ingredient, $currentStock, $reorderPoint)
    {
        $this->notifySystemEvent(
            Notification::TYPE_LOW_STOCK,
            "{$ingredient->name} is low. Current: {$currentStock} {$ingredient->unit}, Reorder point: {$reorderPoint} {$ingredient->unit}.",
            ['ingredient_id' => $ingredient->ingredient_id, 'reference_id' => $ingredient->ingredient_id, 'name' => $ingredient->name, 'current_stock' => $currentStock, 'reorder_point' => $reorderPoint]
        );
    }

    public function criticalStockLevel($ingredient, $currentStock)
    {
        $this->notifySystemEvent(
            Notification::TYPE_CRITICAL_STOCK,
            "{$ingredient->name} stock is critically low. Only {$currentStock} {$ingredient->unit} remaining.",
            ['ingredient_id' => $ingredient->ingredient_id, 'reference_id' => $ingredient->ingredient_id, 'name' => $ingredient->name, 'current_stock' => $currentStock]
        );
    }

    public function outOfStock($ingredient)
    {
        $this->notifySystemEvent(
            Notification::TYPE_OUT_OF_STOCK,
            "{$ingredient->name} is currently out of stock and needs immediate action.",
            ['ingredient_id' => $ingredient->ingredient_id, 'reference_id' => $ingredient->ingredient_id, 'name' => $ingredient->name]
        );
    }

    public function purchaseRequestGenerated($purchaseRequest)
    {
        $ingredientName = $purchaseRequest->ingredient?->name ?? 'Unknown';
        $this->notifySystemEvent(
            Notification::TYPE_PURCHASE_REQUEST_GENERATED,
            "Purchase Request {$purchaseRequest->pr_number} generated for {$ingredientName}. Quantity: {$purchaseRequest->quantity}.",
            ['purchase_request_id' => $purchaseRequest->purchase_request_id, 'reference_id' => $purchaseRequest->purchase_request_id, 'pr_number' => $purchaseRequest->pr_number]
        );
    }

    public function insufficientInventory($booking, $shortages)
    {
        $shortageList = collect($shortages)->take(3)->map(fn($shortage) => "• {$shortage['name']}: {$shortage['shortage']} {$shortage['unit']}")->implode("\n");
        $moreCount = count($shortages) - 3;

        $this->notifySystemEvent(
            Notification::TYPE_INVENTORY_SHORTAGE,
            "Insufficient stock for booking {$booking->booking_no}.\n{$shortageList}" . ($moreCount > 0 ? "\n+ {$moreCount} more items" : ''),
            ['booking_id' => $booking->booking_id, 'reference_id' => $booking->booking_id, 'shortages' => $shortages]
        );
    }

    public function equipmentShortageAlert($booking, $equipmentShortages)
    {
        $shortageList = collect($equipmentShortages)->map(fn($equipment) => "• {$equipment['name']}: Need {$equipment['required']}, Available {$equipment['available']}")->implode("\n");

        $this->notifySystemEvent(
            Notification::TYPE_EQUIPMENT_SHORTAGE,
            "Equipment shortage detected for booking {$booking->booking_no}.\n{$shortageList}",
            ['booking_id' => $booking->booking_id, 'reference_id' => $booking->booking_id, 'shortages' => $equipmentShortages]
        );
    }

    // ==================== 👨‍🍳 OPERATIONS STAFF NOTIFICATIONS ====================
    
    public function ingredientComputationCompleted($order)
    {
        $bookingNo = $order->booking?->booking_no ?? 'Unknown';
        
        $this->notifyRole('operations_staff',
            Notification::TYPE_INGREDIENT_COMPUTED,
            '🧮 Ingredient Computation Completed',
            "Ingredient computation completed for Booking {$bookingNo}. Check shopping list for purchase requirements.",
            Notification::PRIORITY_MEDIUM,
            ['order_id' => $order->order_id, 'booking_no' => $bookingNo],
            "/admin/orders/{$order->order_id}/ingredients"
        );
    }

    public function kitchenPreparationCreated($order)
    {
        $bookingNo = $order->booking?->booking_no ?? 'Unknown';
        
        $this->notifyRole('operations_staff',
            Notification::TYPE_KITCHEN_PREPARATION,
            '👨‍🍳 Kitchen Preparation List Generated',
            "Kitchen preparation list generated for Booking {$bookingNo}. Total items: {$order->items->count()}",
            Notification::PRIORITY_HIGH,
            ['order_id' => $order->order_id, 'booking_no' => $bookingNo],
            "/admin/kitchen/orders/{$order->order_id}"
        );
    }

    public function kitchenPreparationReminder($order)
    {
        $bookingNo = $order->booking?->booking_no ?? 'Unknown';
        $eventDate = $order->booking?->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';
        $eventTime = $order->booking?->serviceEvent?->event_time ?? 'TBD';
        $itemCount = $order->items->count();

        $this->notifySystemEvent(
            Notification::TYPE_KITCHEN_PREPARATION_REMINDER,
            "Kitchen preparation required for Booking {$bookingNo} on {$eventDate} at {$eventTime}. Total items: {$itemCount}.",
            ['order_id' => $order->order_id, 'reference_id' => $order->order_id, 'booking_no' => $bookingNo]
        );
    }

    public function deliveryPreparationReady($booking)
    {
        $eventName = $booking->serviceEvent?->eventType?->name ?? 'Event';
        
        $this->notifyRole('event_coordinator',
            Notification::TYPE_DELIVERY_READY,
            '🚚 Delivery Preparation Ready',
            "Delivery preparation checklist is ready for {$eventName}.",
            Notification::PRIORITY_HIGH,
            ['booking_id' => $booking->booking_id],
            "/admin/events/{$booking->booking_id}/deliveries"
        );
    }

    public function deliveryPreparationReminder($order)
    {
        $bookingNo = $order->booking?->booking_no ?? 'Unknown';
        $deliveryAddress = $order->booking?->serviceEvent?->delivery_address ?? $order->booking?->serviceEvent?->venue ?? 'N/A';

        $this->notifySystemEvent(
            Notification::TYPE_DELIVERY_PREPARATION_REMINDER,
            "Delivery preparation required for Booking {$bookingNo} to: {$deliveryAddress}.",
            ['order_id' => $order->order_id, 'reference_id' => $order->order_id, 'booking_no' => $bookingNo]
        );
    }

    // ==================== 🎯 EVENT COORDINATOR NOTIFICATIONS ====================
    
    public function eventStartsTomorrow($booking)
    {
        $eventName = $booking->serviceEvent?->eventType?->name ?? 'Event';
        $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        $eventDate = $booking->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';

        $this->notifySystemEvent(
            Notification::TYPE_EVENT_STARTS_TOMORROW,
            "{$eventName} for {$customerName} begins tomorrow, {$eventDate}. Please ensure all preparations are complete.",
            ['booking_id' => $booking->booking_id, 'reference_id' => $booking->booking_id, 'event_name' => $eventName, 'event_date' => $eventDate]
        );
    }

    public function upcomingEventReminder($booking, $daysBefore = 3)
    {
        $eventName = $booking->serviceEvent?->eventType?->name ?? 'Event';
        $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        $eventDate = $booking->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';

        $this->notifySystemEvent(
            Notification::TYPE_UPCOMING_EVENT_REMINDER,
            "Event \"{$eventName}\" for {$customerName} starts in {$daysBefore} days on {$eventDate}.",
            ['booking_id' => $booking->booking_id, 'reference_id' => $booking->booking_id, 'days_before' => $daysBefore]
        );
    }

    public function equipmentPreparationNeeded($booking, $equipment)
    {
        $eventName = $booking->serviceEvent?->eventType?->name ?? 'Event';
        
        $this->notifyRole('event_coordinator',
            Notification::TYPE_EQUIPMENT_PREPARATION,
            '🔧 Equipment Preparation Needed',
            "Prepare event equipment for {$eventName}: {$equipment->name} ({$equipment->pivot->quantity_reserved} units)",
            Notification::PRIORITY_MEDIUM,
            ['booking_id' => $booking->booking_id, 'equipment' => $equipment->name],
            "/admin/events/{$booking->booking_id}/equipment"
        );
    }

    public function eventStarted($booking)
    {
        $eventName = $booking->serviceEvent?->eventType?->name ?? 'Event';
        $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        $venue = $booking->serviceEvent?->venue ?? 'TBD';
        
        $this->notifyRole('event_coordinator',
            Notification::TYPE_EVENT_STARTED,
            '🎉 Event Started',
            "Event \"{$eventName}\" for {$customerName} at {$venue} is now ongoing.",
            Notification::PRIORITY_LOW,
            ['booking_id' => $booking->booking_id, 'event_name' => $eventName],
            "/admin/events/{$booking->booking_id}"
        );
    }

    // ==================== 👥 EMPLOYEE NOTIFICATIONS ====================
    
    public function scheduleAssigned($schedule, $employee)
    {
        $eventName = $schedule->assignmentPayload()['placement'] ?? 'Event';
        $workDate = $schedule->work_date->format('M d, Y');
        $shiftTime = "{$schedule->start_time} - {$schedule->end_time}";
        
        $this->notifyUser($employee->user_id,
            Notification::TYPE_SCHEDULE_ASSIGNED,
            '📅 Schedule Assigned',
            "You have been assigned to {$eventName} on {$workDate} ({$shiftTime}).",
            Notification::PRIORITY_MEDIUM,
            ['schedule_id' => $schedule->schedule_id, 'event_name' => $eventName, 'work_date' => $workDate],
            "/employee/schedules"
        );
    }

    public function scheduleUpdated($schedule, $employee, $changes)
    {
        $eventName = $schedule->assignmentPayload()['placement'] ?? 'Event';
        
        $this->notifyUser($employee->user_id,
            Notification::TYPE_SCHEDULE_UPDATED,
            '📅 Schedule Updated',
            "Your schedule for {$eventName} has been updated. Please review the changes.",
            Notification::PRIORITY_MEDIUM,
            ['schedule_id' => $schedule->schedule_id, 'changes' => $changes],
            "/employee/schedules"
        );
    }

    public function scheduleCancelled($schedule, $employee)
    {
        $eventName = $schedule->assignmentPayload()['placement'] ?? 'Event';
        $workDate = $schedule->work_date->format('M d, Y');
        
        $this->notifyUser($employee->user_id,
            Notification::TYPE_SCHEDULE_CANCELLED,
            '📅 Schedule Cancelled',
            "Your schedule assignment for {$eventName} on {$workDate} has been removed.",
            Notification::PRIORITY_MEDIUM,
            ['schedule_id' => $schedule->schedule_id],
            "/employee/schedules"
        );
    }

    public function staffScheduleConflict($employee, $date, $existingShift, $newShift)
    {
        $this->notifyRole('admin',
            Notification::TYPE_STAFF_SCHEDULE_CONFLICT,
            '👥 Staff Scheduling Conflict',
            "Employee {$employee->full_name} already assigned to a shift on {$date} from {$existingShift->start_time} to {$existingShift->end_time}.",
            Notification::PRIORITY_HIGH,
            ['employee_id' => $employee->employee_id, 'date' => $date],
            "/admin/schedules"
        );
    }

    // ==================== 📋 LEAVE REQUEST NOTIFICATIONS ====================
    
    public function leaveRequestSubmitted($leaveRequest)
    {
        $employeeName = $leaveRequest->employee?->full_name ?? 'Employee';
        $dates = "{$leaveRequest->start_date->format('M d, Y')} to {$leaveRequest->end_date->format('M d, Y')}";
        
        $this->notifyRole('admin',
            Notification::TYPE_LEAVE_REQUEST,
            '📋 New Leave Request',
            "New leave request submitted by {$employeeName}. Dates: {$dates}.",
            Notification::PRIORITY_MEDIUM,
            ['leave_request_id' => $leaveRequest->leave_request_id, 'employee_name' => $employeeName],
            "/admin/employee-requests/{$leaveRequest->leave_request_id}"
        );
    }

    public function sickLeaveSubmitted($leaveRequest)
    {
        $employeeName = $leaveRequest->employee?->full_name ?? 'Employee';
        
        $this->notifyRole('admin',
            Notification::TYPE_SICK_LEAVE,
            '🤒 New Sick Leave Request',
            "New sick leave request submitted by {$employeeName}.",
            Notification::PRIORITY_MEDIUM,
            ['leave_request_id' => $leaveRequest->leave_request_id, 'employee_name' => $employeeName],
            "/admin/employee-requests/{$leaveRequest->leave_request_id}"
        );
    }

    public function dayOffRequestSubmitted($leaveRequest)
    {
        $employeeName = $leaveRequest->employee?->full_name ?? 'Employee';
        $date = $leaveRequest->start_date->format('M d, Y');
        
        $this->notifyRole('admin',
            Notification::TYPE_DAY_OFF_REQUEST,
            '📅 New Day-Off Request',
            "New day-off request submitted by {$employeeName} on {$date}.",
            Notification::PRIORITY_LOW,
            ['leave_request_id' => $leaveRequest->leave_request_id, 'employee_name' => $employeeName],
            "/admin/employee-requests/{$leaveRequest->leave_request_id}"
        );
    }

    // ==================== 💰 PAYROLL NOTIFICATIONS ====================
    
    public function payrollReadyForProcessing($payroll)
    {
        $this->notifyRole('admin',
            Notification::TYPE_PAYROLL_READY,
            '💰 Payroll Ready for Processing',
            "Payroll period {$payroll->cutoff_start->format('M d')} - {$payroll->cutoff_end->format('M d, Y')} is ready for processing.",
            Notification::PRIORITY_HIGH,
            ['payroll_id' => $payroll->payroll_id, 'payroll_number' => $payroll->payroll_number],
            "/admin/payroll/{$payroll->payroll_id}"
        );
    }

    public function overtimePendingApproval($attendance, $employee)
    {
        $date = $attendance->attendance_date->format('M d, Y');
        $hours = $attendance->overtime_hours;
        
        $this->notifyRole('admin',
            Notification::TYPE_OVERTIME_PENDING,
            '⏰ Overtime Approval Required',
            "Overtime request from {$employee->full_name} for {$date} ({$hours} hours) is pending approval.",
            Notification::PRIORITY_HIGH,
            ['attendance_id' => $attendance->attendance_id, 'employee_name' => $employee->full_name],
            "/admin/attendance/{$attendance->attendance_id}"
        );
    }

    public function overtimeApproved($attendance, $employee)
    {
        $date = $attendance->attendance_date->format('M d, Y');
        $hours = $attendance->overtime_hours;
        
        $this->notifyUser($employee->user_id,
            Notification::TYPE_OVERTIME_APPROVED,
            '✅ Overtime Approved',
            "Your overtime request for {$date} ({$hours} hours) has been approved.",
            Notification::PRIORITY_MEDIUM,
            ['attendance_id' => $attendance->attendance_id],
            "/employee/attendance"
        );
    }

    public function overtimeRejected($attendance, $employee, $reason = null)
    {
        $date = $attendance->attendance_date->format('M d, Y');
        
        $this->notifyUser($employee->user_id,
            Notification::TYPE_OVERTIME_REJECTED,
            '❌ Overtime Rejected',
            "Your overtime request for {$date} has been rejected." . ($reason ? " Reason: {$reason}" : ''),
            Notification::PRIORITY_MEDIUM,
            ['attendance_id' => $attendance->attendance_id],
            "/employee/attendance"
        );
    }

    // ==================== 👤 CUSTOMER NOTIFICATIONS ====================
    
    public function paymentReceived($payment, $customer)
    {
        $amount = number_format($payment->amount, 2);
        $bookingNo = $payment->booking?->booking_no ?? 'Unknown';
        
        $this->notifyUser($customer->user_id,
            Notification::TYPE_PAYMENT_RECEIVED,
            '✅ Payment Received',
            "Payment of ₱{$amount} for booking {$bookingNo} has been successfully received.",
            Notification::PRIORITY_HIGH,
            ['payment_id' => $payment->payment_id, 'booking_no' => $bookingNo, 'amount' => $payment->amount],
            "/customer/bookings/{$payment->booking_id}"
        );
    }

    public function paymentProofUploaded($payment, $customer)
    {
        $this->notifyRole('admin',
            Notification::TYPE_PAYMENT_PROOF_UPLOADED,
            '💳 Payment Proof Uploaded',
            "Customer {$customer->person?->full_name} uploaded payment proof for ₱" . number_format($payment->amount, 2) . ".",
            Notification::PRIORITY_HIGH,
            ['payment_id' => $payment->payment_id, 'amount' => $payment->amount],
            "/admin/payments/{$payment->payment_id}"
        );
    }

    public function balanceReminder($booking, $customer, $balance)
    {
        $bookingNo = $booking->booking_no;
        $balanceAmount = number_format($balance, 2);
        
        $this->notifyUser($customer->user_id,
            Notification::TYPE_BALANCE_REMINDER,
            '💰 Balance Reminder',
            "Remaining balance due: ₱{$balanceAmount} for booking {$bookingNo}.",
            Notification::PRIORITY_MEDIUM,
            ['booking_id' => $booking->booking_id, 'booking_no' => $bookingNo, 'balance' => $balance],
            "/customer/bookings/{$booking->booking_id}/payments"
        );
    }

    public function balanceDueReminder($invoice, $customer, $daysLeft)
    {
        $this->notifyRole('admin',
            Notification::TYPE_BALANCE_DUE_REMINDER,
            '💰 Balance Due Reminder',
            "Customer {$customer->person?->full_name} has balance of ₱" . number_format($invoice->balance, 2) . " due in {$daysLeft} days.",
            Notification::PRIORITY_HIGH,
            ['invoice_id' => $invoice->invoice_id, 'balance' => $invoice->balance, 'days_left' => $daysLeft],
            "/admin/invoices/{$invoice->invoice_id}"
        );
    }

    public function overdueAccountAlert($customer, $overdueAmount, $overdueDays)
    {
        $this->notifyRole('admin',
            Notification::TYPE_OVERDUE_ACCOUNT,
            '🚨 Overdue Credit Account',
            "Customer {$customer->person?->full_name} has overdue balance of ₱" . number_format($overdueAmount, 2) . " for {$overdueDays} days.",
            Notification::PRIORITY_HIGH,
            ['customer_id' => $customer->customer_id, 'overdue_amount' => $overdueAmount, 'overdue_days' => $overdueDays],
            "/admin/customers/{$customer->customer_id}"
        );
    }

    public function paymentDueReminder($booking, $customer, $dueDate)
    {
        $bookingNo = $booking->booking_no;
        $daysLeft = now()->diffInDays($dueDate, false);
        
        $this->notifyUser($customer->user_id,
            Notification::TYPE_PAYMENT_DUE,
            '⏰ Payment Due Soon',
            "Payment for booking {$bookingNo} is due in {$daysLeft} days. Due date: {$dueDate->format('M d, Y')}",
            Notification::PRIORITY_HIGH,
            ['booking_id' => $booking->booking_id, 'booking_no' => $bookingNo, 'due_date' => $dueDate],
            "/customer/bookings/{$booking->booking_id}/payments"
        );
    }

    // ==================== 🔧 EQUIPMENT NOTIFICATIONS ====================
    
    public function equipmentReserved($bookingEquipment, $booking)
    {
        $equipmentName = $bookingEquipment->equipment?->name ?? 'Equipment';
        $eventName = $booking->serviceEvent?->eventType?->name ?? 'Event';
        
        $this->notifyRole('operations_staff',
            Notification::TYPE_EQUIPMENT_RESERVED,
            '🔧 Equipment Reserved',
            "Equipment reserved for {$eventName}: {$equipmentName} ({$bookingEquipment->quantity_reserved} units)",
            Notification::PRIORITY_MEDIUM,
            ['booking_equipment_id' => $bookingEquipment->booking_equipment_id, 'equipment_name' => $equipmentName],
            "/admin/events/{$booking->booking_id}/equipment"
        );
    }

    public function equipmentReturnOverdue($bookingEquipment, $booking)
    {
        $equipmentName = $bookingEquipment->equipment?->name ?? 'Equipment';
        $expectedReturn = $bookingEquipment->rental_end_date->format('M d, Y');
        
        $this->notifyRole('operations_staff',
            Notification::TYPE_EQUIPMENT_OVERDUE,
            '⚠️ Equipment Return Overdue',
            "Equipment {$equipmentName} return is overdue. Expected return date: {$expectedReturn}",
            Notification::PRIORITY_HIGH,
            ['booking_equipment_id' => $bookingEquipment->booking_equipment_id, 'equipment_name' => $equipmentName],
            "/admin/events/{$booking->booking_id}/equipment"
        );
    }

    public function equipmentReturnPending($booking)
    {
        $eventDate = $booking->serviceEvent?->event_date?->format('M d, Y') ?? 'TBD';
        $equipmentCount = $booking->equipment->where('status', 'checked_out')->count();

        $this->notifySystemEvent(
            Notification::TYPE_EQUIPMENT_RETURN_PENDING,
            "Equipment return verification required for event on {$eventDate}. {$equipmentCount} item(s) pending return.",
            ['booking_id' => $booking->booking_id, 'reference_id' => $booking->booking_id, 'equipment_count' => $equipmentCount]
        );
    }

    public function equipmentDamaged($bookingEquipment, $booking, $quantity)
    {
        $equipmentName = $bookingEquipment->equipment?->name ?? 'Equipment';

        $this->notifySystemEvent(
            Notification::TYPE_DAMAGED_EQUIPMENT_REPORTED,
            "Damaged equipment reported: {$quantity} units of {$equipmentName} from event {$booking->booking_no}.",
            ['booking_equipment_id' => $bookingEquipment->booking_equipment_id, 'reference_id' => $bookingEquipment->booking_equipment_id, 'equipment_name' => $equipmentName, 'quantity' => $quantity]
        );
    }

    public function equipmentMissing($bookingEquipment, $booking, $quantity)
    {
        $equipmentName = $bookingEquipment->equipment?->name ?? 'Equipment';

        $this->notifySystemEvent(
            Notification::TYPE_MISSING_EQUIPMENT,
            "Missing equipment detected: {$quantity} units of {$equipmentName} from event {$booking->booking_no}.",
            ['booking_equipment_id' => $bookingEquipment->booking_equipment_id, 'reference_id' => $bookingEquipment->booking_equipment_id, 'equipment_name' => $equipmentName, 'quantity' => $quantity]
        );
    }

    // ==================== ⭐ REVIEW & FEEDBACK NOTIFICATIONS ====================
    
    public function newCustomerReview($review)
    {
        $customerName = $review->booking?->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        $rating = $review->overall_rating;

        $this->notifySystemEvent(
            Notification::TYPE_CUSTOMER_REVIEW,
            "New customer feedback received from {$customerName}. Rating: {$rating} stars.",
            ['review_id' => $review->review_id, 'reference_id' => $review->review_id, 'customer_name' => $customerName, 'rating' => $rating]
        );
    }

    public function lowRatingAlert($review)
    {
        $customerName = $review->booking?->serviceEvent?->customer?->person?->full_name ?? 'Customer';
        $rating = $review->overall_rating;

        $this->notifySystemEvent(
            Notification::TYPE_LOW_RATING,
            "Customer {$customerName} rated event {$rating} stars. Please review feedback.",
            ['review_id' => $review->review_id, 'reference_id' => $review->review_id, 'customer_name' => $customerName, 'rating' => $rating]
        );
    }

    // ==================== 🔒 SECURITY NOTIFICATIONS ====================
    
    public function failedLoginAttempt($email, $ip, $attempts)
    {
        $this->notifyRole('admin',
            Notification::TYPE_FAILED_LOGIN,
            '🚫 Multiple Failed Login Attempts',
            "Multiple failed login attempts detected for {$email} from IP {$ip}. Attempts: {$attempts}",
            Notification::PRIORITY_HIGH,
            ['email' => $email, 'ip' => $ip, 'attempts' => $attempts]
        );
    }

    public function adminAccountCreated($newAdmin, $createdBy)
    {
        $this->notifyRole('admin',
            Notification::TYPE_ADMIN_CREATED,
            '👤 New Admin Account Created',
            "New administrator account created for {$newAdmin->email} by {$createdBy->email}.",
            Notification::PRIORITY_HIGH,
            ['new_admin_id' => $newAdmin->user_id, 'new_admin_email' => $newAdmin->email, 'created_by' => $createdBy->email]
        );
    }

    public function permissionChanged($user, $changedBy, $permissions)
    {
        $this->notifyRole('admin',
            Notification::TYPE_PERMISSION_CHANGED,
            '🔒 Permission Changed',
            "User permissions updated for {$user->email} by {$changedBy->email}.",
            Notification::PRIORITY_MEDIUM,
            ['user_id' => $user->user_id, 'user_email' => $user->email, 'changed_by' => $changedBy->email, 'permissions' => $permissions]
        );
    }

    // ==================== ⏰ ATTENDANCE NOTIFICATIONS ====================
    
    public function attendancePendingVerification($pendingCount)
    {
        $this->notifyRole('admin',
            Notification::TYPE_ATTENDANCE_PENDING,
            '📊 Attendance Waiting for Verification',
            "{$pendingCount} attendance record(s) are waiting for verification.",
            Notification::PRIORITY_HIGH,
            ['pending_count' => $pendingCount],
            "/admin/attendance/needs-approval"
        );
    }

    public function missingTimeoutAlert($employee, $attendance)
    {
        $this->notifyRole('admin',
            Notification::TYPE_MISSING_TIMEOUT,
            '⏳ Missing Time-Out Reminder',
            "Employee {$employee->full_name} has no recorded time-out for {$attendance->attendance_date->format('M d, Y')}.",
            Notification::PRIORITY_MEDIUM,
            ['attendance_id' => $attendance->attendance_id, 'employee_name' => $employee->full_name],
            "/admin/attendance/{$attendance->attendance_id}"
        );
    }

    // ==================== GENERIC REQUESTED NOTIFICATION EVENTS ====================

    public function notifyLowStockAlert($ingredient, $currentStock, $reorderPoint = null): void
    {
        $unit = $ingredient->unit ?? '';
        $name = $ingredient->name ?? 'Inventory item';
        $this->notifySystemEvent(
            'low_stock',
            "{$name} is low. Current stock: {$currentStock} {$unit}" . ($reorderPoint !== null ? ", reorder point: {$reorderPoint} {$unit}." : '.'),
            ['ingredient_id' => $ingredient->ingredient_id ?? null, 'reference_id' => $ingredient->ingredient_id ?? null, 'current_stock' => $currentStock, 'reorder_point' => $reorderPoint]
        );
    }

    public function notifyOutOfStockAlert($ingredient): void
    {
        $name = $ingredient->name ?? 'Inventory item';
        $this->notifySystemEvent(
            'out_of_stock',
            "{$name} is out of stock and needs immediate action.",
            ['ingredient_id' => $ingredient->ingredient_id ?? null, 'reference_id' => $ingredient->ingredient_id ?? null]
        );
    }

    public function notifyAuditLogAlert(string $message, array $data = []): void
    {
        $this->notifySystemEvent('audit_log_alert', $message, $data, ['admin']);
    }

    public function notifySecurityAlert(string $message, array $data = []): void
    {
        $this->notifySystemEvent('security_alert', $message, $data, ['admin']);
    }

    public function notifyOperationalEvent(string $type, string $message, array $data = []): void
    {
        $this->notifySystemEvent($type, $message, $data);
    }

}