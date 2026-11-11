<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\BookingPayment;
use App\Models\Customer;
use App\Models\EventTracking;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Person;
use App\Models\Quotation;
use App\Models\ServiceEvent;
use App\Models\InventoryStock;
use App\Models\BookingEquipment;
use App\Models\Setting;
use App\Models\Equipment;
use App\Models\Ingredient;
use App\Models\PurchaseRequest;
use App\Models\MealService;
use App\Models\EventDay;
use App\Models\BookingCharge;
use App\Models\MealServiceFilter;
use App\Models\MealServiceCustomItem;
use App\Events\BookingApproved;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class BookingService
{
    protected ProfitabilityService $profitabilityService;
    protected BookingPolicyService $policyService;

    public function __construct(
        ProfitabilityService $profitabilityService,
        BookingPolicyService $policyService
    ) {
        $this->profitabilityService = $profitabilityService;
        $this->policyService = $policyService;
    }

    // ============================================================
    // NUMBER GENERATORS
    // ============================================================

    private function generateBookingNumber(): string
    {
        return $this->generateSequentialNumber('BK-', Booking::class, 'booking_no');
    }

    private function generateQuoteNumber(): string
    {
        return $this->generateSequentialNumber('QT-', Quotation::class, 'quote_no');
    }

    private function generateOrderNumber(): string
    {
        return $this->generateSequentialNumber('ORD-', Order::class, 'order_number');
    }

    private function generateInvoiceNumber(): string
    {
        // ⭐ Changed padding to 9 for 9-digit sequential format
        return $this->generateSequentialNumber('INV-', Invoice::class, 'invoice_number', 9);
    }

    private function generateSequentialNumber(string $prefix, string $modelClass, string $column, int $padding = 4): string
    {
        try {
            if (!class_exists($modelClass)) {
                throw new \Exception("Model class {$modelClass} not found");
            }

            $instance = new $modelClass();
            $keyName = $instance->getKeyName();

            $query = $modelClass::query();
            if (in_array(\Illuminate\Database\Eloquent\SoftDeletes::class, class_uses_recursive($modelClass), true)) {
                $query->withTrashed();
            }

            $lastRecord = $query
                ->where($column, 'LIKE', $prefix . '%')
                ->orderBy($keyName, 'desc')
                ->first();

            if ($lastRecord && isset($lastRecord->$column)) {
                $lastNumber = intval(substr($lastRecord->$column, strlen($prefix)));
                $newNumber = str_pad($lastNumber + 1, $padding, '0', STR_PAD_LEFT);
            } else {
                $newNumber = str_repeat('0', $padding - 1) . '1';
            }

            return $prefix . $newNumber;
        } catch (\Exception $e) {
            Log::warning("Failed to generate sequential number for {$prefix}: " . $e->getMessage());
            return $prefix . now()->format('YmdHis') . '-' . substr(microtime(true) * 10000, -4);
        }
    }

    // ============================================================
    // CUSTOMER CREATION
    // ============================================================

    private function createCustomerFromData(array $data): Customer
    {
        $firstName = $data['first_name'] ?? $data['customer_name'] ?? 'Customer';
        $lastName = $data['last_name'] ?? '';
        $email = strtolower(trim($data['email'] ?? $data['customer_email'] ?? ''));
        $phone = $data['phone'] ?? $data['customer_phone'] ?? null;
        $addressLine1 = $data['address_line_1'] ?? $data['customer_address'] ?? null;
        $city = $data['city'] ?? null;
        $province = $data['province'] ?? null;
        $postalCode = $data['postal_code'] ?? null;
        $country = $data['country'] ?? 'Philippines';

        if (str_contains($firstName, ' ') && empty($lastName)) {
            $parts = explode(' ', $firstName, 2);
            $firstName = $parts[0];
            $lastName = $parts[1] ?? '';
        }

        if ($email) {
            // ⭐ REQUEST #1.2 — Match case-insensitively so "Juan@Gmail.com"
            //    and "juan@gmail.com" resolve to the same Person.
            $existingPerson = Person::with('customer')
                ->whereRaw('LOWER(email) = ?', [strtolower($email)])
                ->first();

            if ($existingPerson) {
                // ⭐ IMPORTANT: never overwrite the email. Only fill in
                //    missing contact/address fields so a returning customer
                //    keeps their established identity.
                $existingPerson->update([
                    'first_name'     => $existingPerson->first_name     ?: $firstName,
                    'last_name'      => $existingPerson->last_name      ?: $lastName,
                    'phone'          => $existingPerson->phone          ?: $phone,
                    'address_line_1' => $existingPerson->address_line_1 ?: $addressLine1,
                    'city'           => $existingPerson->city           ?: $city,
                    'province'       => $existingPerson->province       ?: $province,
                    'postal_code'    => $existingPerson->postal_code    ?: $postalCode,
                    'country'        => $existingPerson->country        ?: $country,
                ]);

                if ($existingPerson->customer) {
                    // ⭐ REQUEST #1.2 + #2.1 — Reuse the existing customer,
                    //    make sure their login account exists, and return.
                    $this->ensureCustomerLoginAccount($existingPerson->customer, $existingPerson);
                    return $existingPerson->customer;
                }

                // Person exists but has no Customer row — link one now.
                $customer = Customer::create([
                    'person_id'     => $existingPerson->person_id,
                    'customer_code' => 'CUST-' . str_pad((string) ($existingPerson->person_id ?? 0), 4, '0', STR_PAD_LEFT),
                    'is_active'     => true,
                ]);
                $this->ensureCustomerLoginAccount($customer, $existingPerson);
                return $customer;
            }
        }
        if (!$email) {
            $email = 'guest_' . uniqid() . '@example.local';
        }

        $person = Person::create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'phone' => $phone,
            'address_line_1' => $addressLine1,
            'city' => $city,
            'province' => $province,
            'postal_code' => $postalCode,
            'country' => $country,
        ]);

        $customer = Customer::create([
            'person_id' => $person->person_id,
            'customer_code' => 'CUST-' . str_pad((string) ($person->person_id ?? 0), 4, '0', STR_PAD_LEFT),
            'is_active' => true,
        ]);

        // ⭐ REQUEST #2 + #7: Walk-in bookings auto-create a customer login
        //    so the customer can later access the mobile app with the same
        //    email. Default password = "password123" (they can change it).
        $this->ensureCustomerLoginAccount($customer, $person);

        return $customer;
    }

    /**
     * ⭐ REQUEST #2 + #7: Ensure a User + customer role exists for the
     *    given Customer/Person, and link it back onto the customer row.
     *
     *    - If the Person already has a User → link it, do nothing else.
     *    - If not → create the User with default password "password123",
     *      assign the `customer` role, and link it to the Customer.
     *
     *    The customer is NOT notified. This is silent — they only learn
     *    about the account if they try to log in to the mobile app.
     */
    /**
     * ⭐ REQUEST #1.1 + #1.2 + #2.1
     *
     * Ensure a User + `customer` role exists for the given Customer/Person
     * and link it back onto the customer row.
     *
     * Behaviour:
     *   - If the Customer already has a linked user_id → nothing to do.
     *   - If a User already exists for this Person → reuse it, do NOT
     *     create another one, do NOT overwrite its password.
     *   - Otherwise → create a User with default password "password123",
     *     assign the `customer` role, link it to the Customer, and mark
     *     `must_change_password = true` if the column exists.
     *
     * This method is idempotent and safe to call multiple times.
     */
    private function ensureCustomerLoginAccount(Customer $customer, Person $person): void
    {
        // ── 1. Already linked on the customer row? Nothing to do.
        if (!empty($customer->user_id)) {
            return;
        }

        // ── 2. A User already exists for this Person?
        $existingUser = \App\Models\User::where('person_id', $person->person_id)->first();
        if ($existingUser) {
            $customer->update(['user_id' => $existingUser->user_id]);

            Log::info('Walk-in booking reused existing customer user account', [
                'customer_id' => $customer->customer_id,
                'person_id'   => $person->person_id,
                'user_id'     => $existingUser->user_id,
                'email'       => $person->email,
            ]);
            return;
        }

        // ── 3. No user yet — create one with the default password.
        try {
            $user = \App\Models\User::create([
                'person_id' => $person->person_id,
                // ⭐ Use the Gmail address as the username so mobile login
                //    works with the same credentials.
                'username'  => $person->email,
                'password'  => \Illuminate\Support\Facades\Hash::make('password123'),
                'is_active' => true,
            ]);

            // ── 4. Assign the `customer` role.
            $role = \App\Models\Role::where('slug', 'customer')->first();
            if ($role) {
                $user->roles()->sync([$role->role_id]);
            }

            // ── 5. If the users table supports a "must change password"
            //       flag, set it so the customer is nudged on first login.
            if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'must_change_password')) {
                try {
                    $user->forceFill(['must_change_password' => true])->save();
                } catch (\Throwable $e) {
                    Log::warning('Could not set must_change_password flag: ' . $e->getMessage());
                }
            }

            // ── 6. Link the user to the customer row.
            $customer->update(['user_id' => $user->user_id]);

            Log::info('Auto-created customer login for walk-in booking', [
                'customer_id' => $customer->customer_id,
                'person_id'   => $person->person_id,
                'user_id'     => $user->user_id,
                'email'       => $person->email,
            ]);
        } catch (\Throwable $e) {
            // Non-fatal: the booking itself must still succeed.
            Log::warning('ensureCustomerLoginAccount failed: ' . $e->getMessage(), [
                'customer_id' => $customer->customer_id,
                'person_id'   => $person->person_id,
                'email'       => $person->email,
            ]);
        }
    }

    // ============================================================
    // SERVICE EVENT CREATION
    // ============================================================

    /**
     * ⭐ Normalize any "delivery" / "deliver" / "pick up" / "pickup" spelling.
     *    Buffet always delivers; Packed/Tray follow the customer's choice.
     */
    private function normalizeDeliveryMethod(string $serviceType, $value): string
    {
        // ⭐ Buffet always delivers (setup at the venue).
        $serviceType = strtolower(trim($serviceType));
        if ($serviceType === 'buffet') {
            return 'delivery';
        }

        // ⭐ Packed/Tray respect the customer's choice.
        $key = strtolower(preg_replace('/[\s_\-]+/', '', trim((string) $value)));

        if (in_array($key, ['delivery', 'deliver', 'delivered'], true)) {
            return 'delivery';
        }

        if (in_array($key, ['pickup', 'pickedup', 'pick', 'pick-up', 'pick_up'], true)) {
            return 'pickup';
        }

        // If the value is somehow empty or invalid, check the payload for packed_tray_mode
        // before defaulting to pickup.
        $fallbackKey = strtolower(preg_replace('/[\s_\-]+/', '', trim((string) request()->input('packed_tray_mode'))));
        if (in_array($fallbackKey, ['delivery', 'deliver', 'delivered'], true)) {
            return 'delivery';
        }

        return 'pickup';
    }

    private function createOrUpdateServiceEvent(?Customer $customer, array $data): ServiceEvent
    {
        // ⭐ FIX #4: Guard event_date
        if (empty($data['event_date'])) {
            throw new \InvalidArgumentException('Event date is required to create a service event.');
        }

        $eventDateRaw = $data['event_date'];
        $eventDate = $eventDateRaw instanceof \DateTimeInterface
            ? $eventDateRaw->format('Y-m-d')
            : (string) $eventDateRaw;

        $eventEndDate = $data['event_end_date'] ?? $eventDate;
        if ($eventEndDate instanceof \DateTimeInterface) {
            $eventEndDate = $eventEndDate->format('Y-m-d');
        }

        // ⭐ KEY #1 — Multi-day bookings without an explicit end date must
        // derive one from `days` / `total_days` / `multiDayDays`. Otherwise
        // the event collapses back to a single day on the next save.
        $scope = ($data['booking_scope'] ?? 'regular') === 'multi_day' ? 'multi_day' : 'regular';
        if ($scope === 'multi_day' && $eventEndDate === $eventDate) {
            $requestedDays = (int) (
                $data['days']
                ?? $data['total_days']
                ?? $data['multi_day_days']
                ?? 0
            );
            if ($requestedDays > 1) {
                $eventEndDate = \Carbon\Carbon::parse($eventDate)
                    ->addDays($requestedDays - 1)
                    ->format('Y-m-d');
            }
        }
        // ⭐ SERVICE TYPE RESTRICTION: Packed and Tray are ALWAYS regular
        //    (single-day) events. Multi-day is only allowed for Buffet.
        $requestedServiceType = strtolower(trim((string) ($data['service_type'] ?? 'buffet')));
        $isPackedOrTray = in_array($requestedServiceType, ['packed', 'tray'], true);

        if ($isPackedOrTray) {
            $scope = 'regular';
            $eventEndDate = $eventDate; // force single day
        }

        $payload = [
            'customer_id' => $customer->customer_id,
            'event_type_id' => $data['event_type_id'] ?? null,
            'package_id' => $data['package_id'] ?? null,
            'event_date' => $eventDate,
            'event_end_date' => $eventEndDate,
            'event_time' => $data['event_time'],
            'venue' => $data['venue'],
            'guests_count' => $data['guests_count'],
            'service_type' => $requestedServiceType,
            'menu_selection_type' => $data['menu_selection_type'] ?? 'custom',
            'has_waiters' => $data['has_waiters'] ?? false,
            // ⭐ Buffet always delivers (setup at venue). Packed/Tray respect
            //    the customer's actual delivery arrangement.
            //    The normalized value is what `packed_tray_mode` will mirror.
            'delivery_method' => $this->normalizeDeliveryMethod(
                $requestedServiceType,
                $data['delivery_method'] ?? $data['packed_tray_mode'] ?? null
            ),
            'special_requests' => $data['special_requests'] ?? null,
            'delivery_address' => $data['delivery_address'] ?? null,
            'delivery_contact_person' => $data['delivery_contact_person'] ?? null,
            'delivery_contact_phone' => $data['delivery_contact_phone'] ?? null,
            'delivery_fee' => (float) ($data['delivery_fee'] ?? 0),
            'status' => 'pending',
        ];

        if (Schema::hasColumn('service_events', 'booking_scope')) {
            $payload['booking_scope'] = $scope;
        }

        // ⭐ Packed/Tray completion markers (safe to add if columns exist)
        if (Schema::hasColumn('service_events', 'delivery_completed_at')) {
            $payload['delivery_completed_at'] = null;
        }
        if (Schema::hasColumn('service_events', 'pickup_completed_at')) {
            $payload['pickup_completed_at'] = null;
        }

        return ServiceEvent::create($payload);
    }

    // ============================================================
    // TOTALS & CHARGES
    // ============================================================

    private function calculateItemsTotal(array $data): float
    {
        $total = 0;
        if (isset($data['items']) && is_array($data['items'])) {
            foreach ($data['items'] as $item) {
                $total += (float)($item['unit_price'] ?? 0) * (int)($item['quantity'] ?? 1);
            }
        }
        return $total;
    }

    private function calculateMealServicesTotal(array $data): float
    {
        $total = 0;
        foreach (($data['meal_services'] ?? []) as $meal) {
            $pax = (int)($meal['pax'] ?? 0);
            $price = (float)($meal['price_per_head'] ?? 0);
            $total += $pax * $price;
        }
        return $total;
    }

    private function calculateAdditionalCharges(array $data): float
    {
        $total = 0;
        foreach ($this->normalizeChargesPayload($data) as $charge) {
            $amount = (float) ($charge['amount'] ?? 0);
            $total += ($charge['charge_kind'] ?? 'charge') === 'discount' ? -$amount : $amount;
        }
        return $total;
    }

    private function calculateTotalAmount(array $data): float
    {
        $mealTotal = $this->calculateMealServicesTotal($data);
        $base = $mealTotal > 0 ? $mealTotal : $this->calculateItemsTotal($data);
        return max(0, $base + $this->calculateAdditionalCharges($data));
    }

    private function normalizeChargesPayload(array $data): array
    {
        $charges = [];
        $fieldMap = [
            'transportation_fee' => 'Transportation fee',
            'setup_fee' => 'Setup fee',
            'service_crew_fee' => 'Service crew fee',
            'equipment_rental' => 'Equipment rental',
            'extra_food_fee' => 'Extra food request',
        ];

        $specificChargesTotal = 0;
        foreach ($fieldMap as $field => $label) {
            $amount = (float) ($data[$field] ?? 0);
            if ($amount > 0) {
                $specificChargesTotal += $amount;
                $charges[] = [
                    'charge_kind' => 'charge',
                    'charge_type' => $field,
                    'description' => $label,
                    'amount' => $amount,
                ];
            }
        }

        $legacyAdditional = (float) ($data['additional_charges'] ?? 0);
        if ($legacyAdditional > 0 && abs($legacyAdditional - $specificChargesTotal) > 0.01) {
            $charges[] = [
                'charge_kind' => 'charge',
                'charge_type' => 'additional_charges',
                'description' => 'Additional charge',
                'amount' => $legacyAdditional,
            ];
        }

        foreach (($data['charges'] ?? []) as $charge) {
            $amount = (float) ($charge['amount'] ?? 0);
            if ($amount <= 0) continue;
            $charges[] = [
                'charge_kind' => ($charge['charge_kind'] ?? 'charge') === 'discount' ? 'discount' : 'charge',
                'charge_type' => $charge['charge_type'] ?? 'manual_charge',
                'description' => $charge['description'] ?? null,
                'amount' => $amount,
            ];
        }

        $discount = (float) ($data['discount'] ?? 0);
        if ($discount > 0) {
            $charges[] = [
                'charge_kind' => 'discount',
                'charge_type' => 'discount',
                'description' => 'Booking discount',
                'amount' => $discount,
            ];
        }

        $promoDiscount = (float) ($data['promo_discount_amount'] ?? 0);
        if ($promoDiscount > 0) {
            $promoLabel = trim(($data['promo_code'] ?? '') . ' ' . ($data['promo_name'] ?? ''));
            $charges[] = [
                'charge_kind' => 'discount',
                'charge_type' => 'promo_discount',
                'description' => $promoLabel !== '' ? 'Promo: ' . $promoLabel : 'Promo discount',
                'amount' => $promoDiscount,
            ];
        }

        return $charges;
    }

    private function syncBookingChargesForBooking(Booking $booking, array $data): void
    {
        if (!Schema::hasTable('booking_charges')) return;

        BookingCharge::where('booking_id', $booking->booking_id)->delete();

        $charges = $this->normalizeChargesPayload($data);
        if (empty($charges)) return;

        $chargesData = [];
        foreach ($charges as $charge) {
            $chargesData[] = array_merge($charge, [
                'booking_id' => $booking->booking_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
        BookingCharge::insert($chargesData);
    }

    private function saveInitialDownPayment(Booking $booking, array $data): void
    {
        $amount = (float) ($data['down_payment'] ?? 0);
        if ($amount <= 0) return;

        $method = strtolower(str_replace(' ', '_', (string) ($data['payment_method'] ?? 'cash')));
        $method = match ($method) {
            'credit_card' => 'card',
            default => in_array($method, ['cash', 'gcash', 'maya', 'bank_transfer', 'card', 'check'], true) ? $method : 'cash',
        };

        BookingPayment::create([
            'payment_number' => 'PAY-' . now()->format('YmdHis') . '-' . random_int(100, 999),
            'booking_id' => $booking->booking_id,
            'amount' => $amount,
            'payment_method' => $method,
            'payment_type' => 'deposit',
            'reference_number' => $data['payment_reference'] ?? null,
            'transaction_id' => $data['transaction_id'] ?? null,
            'status' => 'completed',
            'notes' => 'Initial down payment recorded from booking form',
            'payment_date' => now(),
            'verified_by' => auth()->id() ?? 1,
            'verified_at' => now(),
        ]);
    }

    // ============================================================
    // MEAL SERVICES SYNC — HARDENED VERSION
    // ============================================================

    private function syncMealServicesForBooking(Booking $booking, array $data): void
    {
        $mealServices = $data['meal_services'] ?? [];
        if (!is_array($mealServices) || empty($mealServices)) {
            return;
        }

        // ⭐ FIX #7: Guard event_date
        $eventStartRaw = $data['event_date'] ?? $booking->serviceEvent?->event_date;
        if (!$eventStartRaw) {
            throw new \InvalidArgumentException('Cannot sync meal services: event date is missing.');
        }
        $eventStart = Carbon::parse($eventStartRaw);

        $eventEndRaw = $data['event_end_date']
            ?? $booking->serviceEvent?->event_end_date
            ?? $eventStart;
        $eventEnd = Carbon::parse($eventEndRaw);

        $scope = ($data['booking_scope'] ?? $booking->serviceEvent?->booking_scope ?? 'regular') === 'multi_day'
            ? 'multi_day'
            : 'regular';

        if ($eventEnd->lt($eventStart)) {
            throw new \InvalidArgumentException('Event end date must be on or after the event date.');
        }

        $maximumDay = $scope === 'multi_day'
            ? max(1, (int) $eventStart->diffInDays($eventEnd) + 1)
            : 1;

        $mealSequence = [
            'breakfast' => ['label' => 'Breakfast', 'time' => '8:00 AM', 'order' => 0],
            'morning snacks' => ['label' => 'Morning Snacks', 'time' => '10:00 AM', 'order' => 1],
            'morning snack' => ['label' => 'Morning Snacks', 'time' => '10:00 AM', 'order' => 1],
            'lunch' => ['label' => 'Lunch', 'time' => '12:00 PM', 'order' => 2],
            'afternoon snacks' => ['label' => 'Afternoon Snacks', 'time' => '3:00 PM', 'order' => 3],
            'afternoon snack' => ['label' => 'Afternoon Snacks', 'time' => '3:00 PM', 'order' => 3],
            'dinner' => ['label' => 'Dinner', 'time' => '6:00 PM', 'order' => 4],
        ];

        $seenMealSlots = [];

        foreach ($mealServices as &$meal) {
            if (!is_array($meal)) {
                throw new \InvalidArgumentException('Every meal service must be a valid object.');
            }

            $dayNumber = max(1, (int) ($meal['day_number'] ?? 1));
            $normalizedType = strtolower(trim((string) ($meal['meal_type'] ?? '')));
            if (!isset($mealSequence[$normalizedType])) {
                throw new \InvalidArgumentException('Meal type must be Breakfast, Morning Snacks, Lunch, Afternoon Snacks, or Dinner.');
            }

            $slotKey = $dayNumber . '|' . $mealSequence[$normalizedType]['label'];
            if (isset($seenMealSlots[$slotKey])) {
                throw new \InvalidArgumentException("{$mealSequence[$normalizedType]['label']} may only be added once for Day {$dayNumber}.");
            }
            // ⭐ KEY #1 — Auto-grow the event window rather than throwing,
            //    because the operator may add a day-4 meal after the
            //    create form has already committed the booking.
            if ($dayNumber > $maximumDay) {
                $maximumDay = $dayNumber;
                $eventEnd = $eventStart->copy()->addDays($maximumDay - 1);
            }
            $seenMealSlots[$slotKey] = true;
            $meal['day_number'] = $dayNumber;
            $meal['meal_type'] = $mealSequence[$normalizedType]['label'];
            $meal['serving_time'] = $meal['serving_time'] ?? $mealSequence[$normalizedType]['time'];
            $meal['_meal_order'] = $mealSequence[$normalizedType]['order'];
        }
        unset($meal);

        usort($mealServices, function (array $left, array $right): int {
            $dayComparison = ((int) ($left['day_number'] ?? 1)) <=> ((int) ($right['day_number'] ?? 1));
            if ($dayComparison !== 0) {
                return $dayComparison;
            }
            return ((int) ($left['_meal_order'] ?? 99)) <=> ((int) ($right['_meal_order'] ?? 99));
        });

        $mealServices = array_map(function (array $meal): array {
            unset($meal['_meal_order']);
            return $meal;
        }, $mealServices);

        // Clean up existing records
        MealService::where('booking_id', $booking->booking_id)->delete();
        EventDay::where('booking_id', $booking->booking_id)->delete();
        BookingItem::where('booking_id', $booking->booking_id)->delete();

        $eventDaysData = [];
        $dayMap = [];

        foreach ($mealServices as $meal) {
            $dayNumber = max(1, (int)($meal['day_number'] ?? 1));
            if (isset($dayMap[$dayNumber])) continue;

            $serviceDate = $meal['service_date'] ?? $eventStart->copy()->addDays($dayNumber - 1)->toDateString();

            $eventDaysData[] = [
                'booking_id' => $booking->booking_id,
                'day_number' => $dayNumber,
                'date' => $serviceDate,
                'day_status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ];
            $dayMap[$dayNumber] = true;
        }

        if (!empty($eventDaysData)) {
            EventDay::insert($eventDaysData);
        }

        $createdEventDays = EventDay::where('booking_id', $booking->booking_id)
            ->get()
            ->keyBy('day_number');

        // ⭐ FIX #2: Insert one at a time to guarantee ID alignment
        $createdMealServices = [];
        foreach ($mealServices as $meal) {
            $dayNumber = max(1, (int)($meal['day_number'] ?? 1));
            $serviceDate = $meal['service_date']
                ?? $eventStart->copy()->addDays($dayNumber - 1)->toDateString();

            $pax = max(1, (int)($meal['pax'] ?? $data['guests_count'] ?? 1));
            $price = max(0, (float)($meal['price_per_head'] ?? 0));
            $menuSource = ($meal['menu_source'] ?? $meal['menu_mode'] ?? (!empty($meal['package_id']) ? 'package' : 'custom')) === 'package'
                ? 'package'
                : 'custom';

            // ⭐ BUG FIX: meal_services has NO menu_name/menu_description columns.
            //    Package name and description are derived at read time from the
            //    package relation (packages.name / packages.description).
            $created = MealService::create([
                'booking_id' => $booking->booking_id,
                'event_day_id' => $createdEventDays[$dayNumber]->event_day_id ?? null,
                'meal_type' => $meal['meal_type'] ?? 'Meal',
                'serving_time' => $meal['serving_time'] ?? $data['event_time'] ?? null,
                'preparation_time' => $meal['preparation_time'] ?? null,
                'dispatch_time' => $meal['dispatch_time'] ?? null,
                'arrival_time' => $meal['arrival_time'] ?? null,
                'pax' => $pax,
                'menu_source' => $menuSource,
                'package_id' => $menuSource === 'package' ? ($meal['package_id'] ?? $data['package_id'] ?? null) : null,
                'menu_item_id' => $meal['menu_item_id'] ?? null,
                'price_per_head' => $price,
                'notes' => $meal['notes'] ?? null,
                'assigned_staff' => $meal['assigned_staff'] ?? null,
                'food_quantity' => $meal['food_quantity'] ?? null,
                'delivery_setup_time' => $meal['delivery_setup_time'] ?? null,
                'preparation_status' => $meal['preparation_status'] ?? 'pending',
                'delivery_status' => $meal['delivery_status'] ?? 'pending',
                'serving_status' => $meal['serving_status'] ?? 'pending',
                'meal_status' => $meal['meal_status'] ?? 'pending',
            ]);

            $createdMealServices[] = $created;
        }

        // ⭐ KEY #1 — Keep service_events.event_end_date in sync with the
        // largest day_number actually persisted.
        if (! empty($eventDaysData)) {
            $maxDayNumber = collect($eventDaysData)->max('day_number') ?: 1;
            $derivedEndDate = $eventStart->copy()->addDays($maxDayNumber - 1)->format('Y-m-d');
            $booking->serviceEvent?->update([
                'event_end_date' => $derivedEndDate,
                'booking_scope' => $maxDayNumber > 1 ? 'multi_day' : 'regular',
            ]);
        }
        // ⭐ Now build filters / custom items / booking items with real IDs
        $finalFiltersData = [];
        $finalCustomItemsData = [];
        $finalBookingItemsData = [];

        foreach ($mealServices as $index => $meal) {
            $mealId = $createdMealServices[$index]->meal_service_id ?? null;
            if (!$mealId) continue;

            $dayNumber = max(1, (int)($meal['day_number'] ?? 1));
            $serviceDate = $meal['service_date']
                ?? $eventStart->copy()->addDays($dayNumber - 1)->toDateString();
            $pax = max(1, (int)($meal['pax'] ?? $data['guests_count'] ?? 1));
            $price = max(0, (float)($meal['price_per_head'] ?? 0));
            $menuSource = ($meal['menu_source'] ?? $meal['menu_mode'] ?? (!empty($meal['package_id']) ? 'package' : 'custom')) === 'package'
                ? 'package'
                : 'custom';

            // -------- Filters --------
            $rawFilters = $meal['filters'] ?? $meal['dietary_filters'] ?? [];
            if (is_string($rawFilters)) {
                $decoded = json_decode($rawFilters, true);
                $rawFilters = is_array($decoded)
                    ? $decoded
                    : array_filter(array_map('trim', explode(',', $rawFilters)));
            }

            $seenFilters = [];
            foreach ((array) $rawFilters as $key => $value) {
                if (is_int($key)) {
                    $filterKey = is_array($value) ? ($value['filter_key'] ?? $value['key'] ?? null) : $value;
                    $filterValue = is_array($value) ? ($value['filter_value'] ?? $value['value'] ?? null) : null;
                } else {
                    if ($value === false || $value === null || $value === '') continue;
                    $filterKey = $key;
                    $filterValue = is_bool($value) ? ($value ? 'yes' : 'no') : (string) $value;
                }

                $filterKey = strtolower(str_replace(' ', '_', trim((string) $filterKey)));
                if ($filterKey === '' || isset($seenFilters[$filterKey])) continue;
                $seenFilters[$filterKey] = true;

                $finalFiltersData[] = [
                    'meal_service_id' => $mealId,
                    'filter_key' => $filterKey,
                    'filter_value' => $filterValue,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            // -------- Custom items + booking items --------
            $items = $meal['custom_items'] ?? $meal['menu_items'] ?? [];
            if (empty($items) && (!empty($meal['menu_name']) || !empty($meal['menu_item_id']))) {
                $items = [[
                    'menu_item_id' => $meal['menu_item_id'] ?? null,
                    'item_name' => $meal['menu_name'] ?? null,
                    'description' => $meal['menu_description'] ?? null,
                    'quantity' => 1,
                    'unit_price' => $price,
                    'notes' => $meal['notes'] ?? null,
                ]];
            }

            $baseBookingItemPayload = [
                'booking_id' => $booking->booking_id,
                'meal_service_id' => $mealId,
                'item_type' => 'menu_item',
                'action_type' => 'included',
                'special_instructions' => trim(
                    ($meal['meal_type'] ?? 'Meal') . ' | Day ' . $dayNumber . ' | ' .
                        ($serviceDate ?? '') . ' ' . ($meal['serving_time'] ?? '') . ' | ' .
                        ($meal['notes'] ?? '')
                ),
                'created_at' => now(),
                'updated_at' => now(),
            ];

            // Package items
            if ($menuSource === 'package' && !empty($meal['package_id'])) {
                $package = \App\Models\Package::with('menuItems')->find($meal['package_id']);
                $packageItems = $package?->menuItems ?? collect();

                if ($packageItems->isNotEmpty()) {
                    foreach ($packageItems as $menuItem) {
                        $qtyPerPax = max(1, (int)($menuItem->pivot->quantity_per_pax ?? 1));

                        $finalCustomItemsData[] = [
                            'meal_service_id' => $mealId,
                            'menu_item_id' => $menuItem->menu_item_id,
                            'item_name' => $menuItem->name,
                            'description' => $menuItem->description ?? null,
                            'quantity' => $qtyPerPax,
                            'unit_price' => (float)($menuItem->pivot->additional_cost ?? $menuItem->price ?? 0),
                            'notes' => null,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];

                        $finalBookingItemsData[] = array_merge($baseBookingItemPayload, [
                            'menu_item_id' => $menuItem->menu_item_id,
                            'custom_item_name' => null,
                            'description' => $menuItem->description ?? null,
                            'quantity' => $pax * $qtyPerPax,
                            'unit_price' => (float)($menuItem->pivot->additional_cost ?? $menuItem->price ?? 0),
                        ]);
                    }
                    continue;
                }
            }

            // Custom items
            if (!empty($items)) {
                foreach ((array) $items as $item) {
                    if (!is_array($item)) continue;

                    $menuItemId = $item['menu_item_id'] ?? null;
                    $itemName = $item['item_name'] ?? $item['name'] ?? null;
                    $quantity = max(1, (int)($item['quantity'] ?? 1));
                    $unitPrice = max(0, (float)($item['unit_price'] ?? $item['price'] ?? 0));

                    $finalCustomItemsData[] = [
                        'meal_service_id' => $mealId,
                        'menu_item_id' => $menuItemId,
                        'item_name' => $itemName,
                        'description' => $item['description'] ?? null,
                        'quantity' => $quantity,
                        'unit_price' => $unitPrice,
                        'notes' => $item['notes'] ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    $finalBookingItemsData[] = array_merge($baseBookingItemPayload, [
                        'menu_item_id' => $menuItemId,
                        'custom_item_name' => $menuItemId ? null : ($itemName ?: 'Custom item'),
                        'description' => $item['description'] ?? null,
                        'quantity' => $pax * $quantity,
                        'unit_price' => $unitPrice,
                        'item_type' => $menuItemId ? 'menu_item' : 'custom_item',
                    ]);
                }
                continue;
            }

            // Fallback: single menu line
            $finalBookingItemsData[] = array_merge($baseBookingItemPayload, [
                'menu_item_id' => $meal['menu_item_id'] ?? null,
                'custom_item_name' => !empty($meal['menu_item_id']) ? null : ($meal['menu_name'] ?? 'Menu'),
                'description' => $meal['menu_description'] ?? null,
                'quantity' => $pax,
                'unit_price' => $price,
                'item_type' => !empty($meal['menu_item_id']) ? 'menu_item' : 'custom_item',
            ]);
        }

        if (!empty($finalFiltersData)) {
            MealServiceFilter::insert($finalFiltersData);
        }
        if (!empty($finalCustomItemsData)) {
            MealServiceCustomItem::insert($finalCustomItemsData);
        }
        if (!empty($finalBookingItemsData)) {
            BookingItem::insert($finalBookingItemsData);
        }
    }

    // ============================================================
    // ORDER ITEM SYNC
    // ============================================================

    private function syncOrderItemsFromBooking(Order $order, Booking $booking): void
    {
        $booking->loadMissing(['items.menuItem', 'items.mealService.eventDay']);
        OrderItem::where('order_id', $order->order_id)->delete();

        $orderItemsData = [];
        foreach ($booking->items as $item) {
            $payload = [
                'order_id' => $order->order_id,
                'menu_item_id' => $item->menu_item_id,
                'item_name' => $item->custom_item_name ?? $item->menuItem?->name ?? 'Menu Item',
                'quantity' => $item->quantity,
                'unit_price_snapshot' => $item->unit_price,
                'created_at' => now(),
                'updated_at' => now(),
            ];
            if (Schema::hasColumn('order_items', 'meal_service_id')) {
                $payload['meal_service_id'] = $item->meal_service_id ?? null;
            }
            if (Schema::hasColumn('order_items', 'special_notes')) {
                $payload['special_notes'] = $item->special_instructions ?? null;
            }
            $orderItemsData[] = $payload;
        }

        if (!empty($orderItemsData)) {
            OrderItem::insert($orderItemsData);
        }
    }

    // ============================================================
    // ADMIN UPDATE
    // ============================================================

    public function updateBookingFromAdmin(Booking $booking, array $data): Booking
    {
        return DB::transaction(function () use ($booking, $data) {
            $booking->loadMissing(['serviceEvent.customer.person', 'quotation', 'order']);

            if ($booking->serviceEvent?->customer?->person) {
                $person = $booking->serviceEvent->customer->person;
                if (!empty($data['customer_name'])) {
                    $nameParts = explode(' ', trim($data['customer_name']), 2);
                    $person->first_name = $nameParts[0] ?? $person->first_name;
                    $person->last_name = $nameParts[1] ?? $person->last_name;
                }
                foreach (
                    [
                        // ⭐ REQUEST #3: `customer_email` is intentionally
                        //    OMITTED here — it is the identity key and
                        //    cannot be edited via the admin update path.
                        'customer_phone' => 'phone',
                        'customer_address' => 'address_line_1',
                        'address_line_1' => 'address_line_1',
                        'city' => 'city',
                        'province' => 'province',
                        'postal_code' => 'postal_code',
                    ] as $input => $column
                ) {
                    if (array_key_exists($input, $data)) $person->{$column} = $data[$input];
                }
                if (array_key_exists('country', $data)) $person->country = $data['country'];
                $person->save();
            }

            if ($booking->serviceEvent) {
                $eventDate = $data['event_date'] ?? $booking->serviceEvent->event_date;

                // ⭐ SERVICE TYPE RESTRICTION (admin update path): switching
                //    to Packed/Tray forces a regular single-day event.
                $updatedServiceType = strtolower(trim((string) (
                    $data['service_type'] ?? $booking->serviceEvent->service_type
                )));
                $isPackedOrTray = in_array($updatedServiceType, ['packed', 'tray'], true);

                $requestedScope = ($data['booking_scope'] ?? $booking->serviceEvent->booking_scope ?? 'regular') === 'multi_day'
                    ? 'multi_day'
                    : 'regular';
                if ($isPackedOrTray) {
                    $requestedScope = 'regular';
                }

                $eventEndDate = $data['event_end_date'] ?? $eventDate;
                if ($isPackedOrTray || $requestedScope === 'regular') {
                    $eventEndDate = $eventDate;
                }
                // ⭐ FIX: If the payload explicitly contains 'delivery_method', use it. 
                // Only fallback to the old value if the payload didn't include it at all.
                $submittedDeliveryMethod = $data['delivery_method'] ?? null;

                $updatedDeliveryMethod = $this->normalizeDeliveryMethod(
                    $updatedServiceType,
                    $submittedDeliveryMethod !== null
                        ? $submittedDeliveryMethod
                        : ($data['packed_tray_mode'] ?? $booking->serviceEvent->delivery_method)
                );
                $booking->serviceEvent->update([
                    'event_type_id' => $data['event_type_id'] ?? $booking->serviceEvent->event_type_id,
                    'event_date' => $eventDate,
                    'event_end_date' => $eventEndDate,
                    'event_time' => $data['event_time'] ?? $booking->serviceEvent->event_time,
                    'venue' => $data['venue'] ?? $booking->serviceEvent->venue,
                    'guests_count' => $data['guests_count'] ?? $booking->serviceEvent->guests_count,
                    'service_type' => $updatedServiceType,
                    'menu_selection_type' => $data['menu_selection_type'] ?? $booking->serviceEvent->menu_selection_type,
                    'delivery_method' => $updatedDeliveryMethod,
                    'special_requests' => $data['special_requests'] ?? $booking->serviceEvent->special_requests,
                    'delivery_address' => $data['delivery_address'] ?? $booking->serviceEvent->delivery_address,
                    'delivery_fee' => (float) ($data['delivery_fee'] ?? $booking->serviceEvent->delivery_fee ?? 0),
                    'booking_scope' => $requestedScope,
                ]);
            }

            // ⭐ FIX #5: Wrap syncMealServicesForBooking with validation exception
            if (array_key_exists('meal_services', $data) && is_array($data['meal_services'])) {
                try {
                    $this->syncMealServicesForBooking($booking, $data);
                } catch (\InvalidArgumentException $e) {
                    throw ValidationException::withMessages([
                        'meal_services' => [$e->getMessage()],
                    ]);
                }
            }

            if (array_key_exists('items', $data) && empty($data['meal_services'])) {
                BookingItem::where('booking_id', $booking->booking_id)->delete();
                $bookingItemsData = [];
                foreach (($data['items'] ?? []) as $item) {
                    $bookingItemsData[] = [
                        'booking_id' => $booking->booking_id,
                        'menu_item_id' => $item['menu_item_id'] ?? null,
                        'custom_item_name' => $item['custom_item_name'] ?? null,
                        'description' => $item['description'] ?? null,
                        'quantity' => $item['quantity'] ?? 1,
                        'unit_price' => $item['unit_price'] ?? 0,
                        'item_type' => $item['item_type'] ?? 'menu_item',
                        'action_type' => 'included',
                        'special_instructions' => $item['special_instructions'] ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
                if (!empty($bookingItemsData)) {
                    BookingItem::insert($bookingItemsData);
                }
            }

            $this->syncBookingChargesForBooking($booking, $data);
            $newTotal = $data['total_amount'] ?? $this->calculateTotalAmount($data);
            if ($booking->quotation) {
                $booking->quotation->update(['total_amount' => $newTotal]);
            }
            $defaultDepositPct = $this->policyService->depositPercentage();
            $computedDeposit = $data['required_deposit'] ?? round($newTotal * ($defaultDepositPct / 100), 2);

            $booking->update([
                'required_deposit' => $computedDeposit,
                'requested_date' => $data['event_date'] ?? $booking->requested_date,
                'requested_time' => $data['event_time'] ?? $booking->requested_time,
            ]);

            $depositPaid = $booking->payments()
                ->where('payment_type', 'deposit')
                ->where('status', 'completed')
                ->sum('amount');

            if ((float)($data['down_payment'] ?? 0) > $depositPaid) {
                $data['down_payment'] = (float)$data['down_payment'] - $depositPaid;
                $this->saveInitialDownPayment($booking, $data);
            }

            $booking->refresh()->load(['order']);
            if ($booking->order) {
                $this->syncOrderItemsFromBooking($booking->order, $booking);
                $this->createKitchenPreparation($booking, $booking->order);
                $this->createIngredientsManagement($booking);
            }

            $this->saveProfitabilitySnapshot($booking, 'projected', true);

            return $booking->fresh([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'quotation',
                'items.menuItem',
                'items.mealService.eventDay',
                'eventDays',
                'mealServices.menuItem',
                'mealServices.package',
                'mealServices.filters',
                'mealServices.customItems.menuItem',
                'payments',
                'order',
                'charges',
            ]);
        });
    }

    private function subtractTime(?string $time, int $minutes): ?string
    {
        if (!$time) return null;
        try {
            return Carbon::parse($time)->subMinutes($minutes)->format('h:i A');
        } catch (\Exception $e) {
            return null;
        }
    }

    // ============================================================
    // AVAILABILITY VALIDATION — HARDENED
    // ============================================================

    public function validateAvailability(
        string $eventDate,
        ?string $eventTime = null,
        ?int $excludeBookingId = null
    ): ?array {
        $targetDate = Carbon::parse($eventDate)->toDateString();
        $today = now()->startOfDay();

        if (Carbon::parse($targetDate)->startOfDay()->lt($today)) {
            return ['code' => 'past_date', 'message' => 'The proposed date is in the past.'];
        }

        $setting = Setting::where('group', 'booking_calendar')
            ->where('key', $targetDate)
            ->first();

        $maxBookings = null;
        $operationMode = 'normal';

        if ($setting) {
            $value = json_decode($setting->value, true) ?: [];
            $status = $value['status'] ?? 'available';
            $operationMode = $value['operation_mode'] ?? 'normal';
            $maxBookings = $value['max_bookings'] ?? null;

            if ($status === 'unavailable') {
                return [
                    'code' => 'date_unavailable',
                    'message' => "The date {$targetDate} is marked as unavailable.",
                ];
            }
            if ($status === 'fully_booked') {
                return [
                    'code' => 'date_fully_booked',
                    'message' => "The date {$targetDate} is fully booked.",
                ];
            }
        }

        $query = Booking::whereHas('serviceEvent', function ($q) use ($targetDate) {
            $q->whereDate('event_date', $targetDate);
        })->whereIn('booking_status', [
            'confirmed',
            'pending_approval',
            'ongoing',
            'reschedule_proposed',
            'reschedule_requested',
        ]);

        if ($excludeBookingId) {
            $query->where('booking_id', '!=', $excludeBookingId);
        }

        $bookingCount = $query->count();

        if ($operationMode === 'limited_slot' && $maxBookings !== null && $bookingCount >= (int) $maxBookings) {
            return [
                'code' => 'slot_full',
                'message' => "The date {$targetDate} is fully booked ({$bookingCount}/{$maxBookings}).",
            ];
        }

        // ⭐ FIX #6: Case-insensitive, trimmed time comparison
        if ($eventTime) {
            $normalizedTime = strtolower(trim((string) $eventTime));

            $timeQuery = Booking::whereHas('serviceEvent', function ($q) use ($targetDate, $normalizedTime) {
                $q->whereDate('event_date', $targetDate)
                    ->whereRaw('LOWER(TRIM(event_time)) = ?', [$normalizedTime]);
            })->whereIn('booking_status', [
                'confirmed',
                'pending_approval',
                'ongoing',
                'reschedule_proposed',
                'reschedule_requested',
            ]);

            if ($excludeBookingId) {
                $timeQuery->where('booking_id', '!=', $excludeBookingId);
            }

            $timeConflict = $timeQuery->first();

            if ($timeConflict) {
                return [
                    'code' => 'time_conflict',
                    'message' => "The time slot {$eventTime} on {$targetDate} is already taken by booking {$timeConflict->booking_no}.",
                    'conflicting_booking_id' => $timeConflict->booking_id,
                    'conflicting_booking_no' => $timeConflict->booking_no,
                ];
            }
        }

        return null;
    }

    // ============================================================
    // RESCHEDULE EXPIRY — FIXED
    // ============================================================

    /**
     * Expire admin-initiated reschedule proposals that the customer
     * has not responded to within the configured window.
     * Auto-cancels the booking.
     *
     * ⭐ FIX #9: Query by reschedule_status/reschedule_proposed_by
     * (not by booking_status='reschedule_proposed' which is never set)
     */
    public function expireCustomerRescheduleResponses(): int
    {
        $hours = $this->policyService->customerRescheduleResponseHours();

        if ($hours <= 0) {
            return 0;
        }

        $cutoff = now()->subHours($hours);

        $bookings = Booking::where('reschedule_status', 'pending')
            ->where('reschedule_proposed_by', 'admin')
            ->whereNotNull('reschedule_proposed_at')
            ->where('reschedule_proposed_at', '<=', $cutoff)
            ->whereNotIn('booking_status', ['cancelled', 'rejected', 'completed'])
            ->get();

        $count = 0;

        foreach ($bookings as $booking) {
            try {
                DB::transaction(function () use ($booking, $hours) {
                    $booking->update([
                        'booking_status' => 'cancelled',
                        'cancellation_reason' => 'Reschedule request expired — customer did not respond within '
                            . $hours . ' hours.',
                        'reschedule_status' => 'expired',
                    ]);
                    $booking->serviceEvent?->update(['status' => 'cancelled']);
                });
                $count++;
            } catch (\Throwable $e) {
                Log::warning('Failed to expire reschedule proposal', [
                    'booking_id' => $booking->booking_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $count;
    }

    /**
     * Count customer-initiated reschedule requests that the admin
     * has not responded to within the configured window.
     * These remain visible but are flagged as overdue.
     *
     * ⭐ FIX #10: Query by reschedule_status/reschedule_proposed_by
     */
    public function expireAdminRescheduleResponses(): int
    {
        $hours = $this->policyService->adminRescheduleResponseHours();

        if ($hours <= 0) {
            return 0;
        }

        $cutoff = now()->subHours($hours);

        return Booking::where('reschedule_status', 'pending')
            ->where('reschedule_proposed_by', 'customer')
            ->whereNotNull('reschedule_proposed_at')
            ->where('reschedule_proposed_at', '<=', $cutoff)
            ->whereNotIn('booking_status', ['cancelled', 'rejected', 'completed'])
            ->count();
    }

    // ============================================================
    // REQUEST BOOKING
    // ============================================================

    public function requestBooking(?Customer $customer, array $data): Booking
    {
        $policyErrors = $this->policyService->validate($data);
        if (!empty($policyErrors)) {
            throw ValidationException::withMessages([
                'booking' => $policyErrors,
            ]);
        }

        return DB::transaction(function () use ($customer, $data) {
            if (!$customer && (isset($data['customer_email']) || isset($data['customer_name']))) {
                $customer = $this->createCustomerFromData($data);
            }

            if (!$customer) {
                throw new \Exception('Customer information is required to create a booking.');
            }

            $serviceEvent = $this->createOrUpdateServiceEvent($customer, $data);
            $totalAmount = $data['total_amount'] ?? $this->calculateTotalAmount($data);

            $requiredDeposit = $data['required_deposit'] ?? null;
            if ($requiredDeposit === null) {
                if ($this->policyService->requireDeposit()) {
                    $depositPct = $this->policyService->depositPercentage();
                    if ($depositPct > 0) {
                        $requiredDeposit = round($totalAmount * ($depositPct / 100), 2);
                    } else {
                        $requiredDeposit = $this->policyService->depositAmount();
                    }
                } else {
                    $requiredDeposit = 0;
                }
            }
            $quotation = Quotation::create([
                'quote_no' => $this->generateQuoteNumber(),
                'service_event_id' => $serviceEvent->service_event_id,
                'total_amount' => $totalAmount,
                'status' => 'pending',
                'valid_until' => now()->addDays($this->policyService->depositPaymentDays())->toDateString(),
            ]);

            $booking = Booking::create([
                'booking_no' => $this->generateBookingNumber(),
                'service_event_id' => $serviceEvent->service_event_id,
                'quotation_id' => $quotation->quotation_id,
                'required_deposit' => $requiredDeposit,
                'booking_status' => 'pending_approval',
                // ⭐ Persist where the booking came from. Admin-created
                //    bookings are walk-in by default.
                'booking_source' => $this->resolveBookingSource($data),
                'requested_date' => $data['event_date'] ?? null,
                'requested_time' => $data['event_time'] ?? null,
            ]);

            if (!empty($data['meal_services']) && is_array($data['meal_services'])) {
                $this->syncMealServicesForBooking($booking, $data);
            }

            $this->syncBookingChargesForBooking($booking, $data);
            $this->saveInitialDownPayment($booking, $data);

            if (empty($data['meal_services']) && isset($data['items']) && is_array($data['items'])) {
                $bookingItemsData = [];
                foreach ($data['items'] as $item) {
                    $bookingItemsData[] = [
                        'booking_id' => $booking->booking_id,
                        'menu_item_id' => $item['menu_item_id'] ?? null,
                        'custom_item_name' => $item['custom_item_name'] ?? null,
                        'description' => $item['description'] ?? null,
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'],
                        'item_type' => $item['item_type'] ?? 'menu_item',
                        'action_type' => 'included',
                        'special_instructions' => $item['special_instructions'] ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
                if (!empty($bookingItemsData)) {
                    BookingItem::insert($bookingItemsData);
                }
            }

            return $booking->fresh([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'quotation',
            ]);
        });
    }


    /**
     * ⭐ Resolve the booking source from the request, defaulting to walk_in.
     *    Valid values: walk_in, mobile, web, phone.
     */
    private function resolveBookingSource(array $data): string
    {
        $raw = strtolower(trim((string) ($data['booking_source'] ?? '')));

        // Normalize common spellings
        $raw = str_replace([' ', '-'], '_', $raw);

        if ($raw === 'walkin' || $raw === 'walk') {
            $raw = 'walk_in';
        }
        if ($raw === 'app') {
            $raw = 'mobile';
        }

        return in_array($raw, ['walk_in', 'mobile', 'web', 'phone'], true)
            ? $raw
            : 'walk_in';
    }
    // ============================================================
    // APPROVE — with idempotency guard
    // ============================================================

    public function approve(Booking $booking): Booking
    {
        return DB::transaction(function () use ($booking) {
            try {
                $booking->load([
                    'serviceEvent.customer.person',
                    'items.menuItem',
                    'items.mealService.eventDay',
                    'serviceEvent.package',
                    'mealServices',
                    'charges',
                    'quotation',
                    'order',
                ]);

                // ⭐ An Ongoing / Completed booking must never be re-approved (would reset its status).
                $currentStatus = strtolower((string) $booking->booking_status);
                if (in_array($currentStatus, ['ongoing', 'completed'], true)) {
                    return $booking->fresh([
                        'serviceEvent.customer.person',
                        'order',
                        'quotation',
                        'invoice',
                    ]);
                }

                // ⭐ FIX #11: Idempotency guard
                $alreadyApproved = $currentStatus === 'confirmed'
                    && $booking->order;

                if ($alreadyApproved) {
                    Log::info('Booking already approved — skipping duplicate work', [
                        'booking_id' => $booking->booking_id,
                        'booking_no' => $booking->booking_no,
                    ]);
                    return $booking->fresh([
                        'serviceEvent.customer.person',
                        'order',
                        'quotation',
                        'invoice',
                    ]);
                }

                $shouldSendQuotation = ! in_array(
                    strtolower((string) $booking->booking_status),
                    ['approved', 'confirmed'],
                    true
                );

                $booking->update(['booking_status' => 'confirmed']);

                if ($booking->serviceEvent) {
                    $booking->serviceEvent->update(['status' => 'confirmed']);
                }

                $quotation = $this->ensureQuotationForBooking($booking);
                $quotation->update(['status' => 'approved']);
                $booking->setRelation('quotation', $quotation);
                $order = $this->createOrderFromBooking($booking);

                // ⭐ Invoices are NOT created here. The cashier creates them
                //    manually via Billing → Invoices → Create Invoice.
                //    See InvoiceController::store().

                $this->saveProfitabilitySnapshot($booking, 'projected', true);
                $bookingId = $booking->booking_id;
                $orderId = $order?->order_id;

                // Dispatch a single background job so the HTTP response returns immediately.
                // This job will handle: quotation delivery, BookingApproved event,
                // kitchen prep, delivery prep, ingredients management, and event tracking.
                \App\Jobs\ProcessBookingApprovalSideEffects::dispatch(
                    $bookingId,
                    $orderId,
                    $shouldSendQuotation
                );

                Log::info('Booking approved - background jobs scheduled after response', [
                    'booking_id' => $booking->booking_id,
                    'booking_no' => $booking->booking_no,
                    'order_id' => $order->order_id ?? null,
                ]);

                return $booking->fresh([
                    'serviceEvent.customer.person',
                    'order',
                    'quotation',
                ]);
            } catch (\Exception $e) {
                Log::error('Error in booking approval: ' . $e->getMessage(), [
                    'booking_id' => $booking->booking_id,
                    'trace' => $e->getTraceAsString()
                ]);
                throw $e;
            }
        });
    }

    // ============================================================
    // PROFITABILITY SNAPSHOT
    // ============================================================

    private function saveProfitabilitySnapshot(Booking $booking, string $type = 'projected', bool $fresh = false): void
    {
        try {
            if ($fresh) {
                $booking = $booking->fresh([
                    'serviceEvent.customer.person',
                    'serviceEvent.eventType',
                    'items.menuItem.recipeIngredients.ingredient',
                    'mealServices.menuItem.recipeIngredients.ingredient',
                    'payments',
                    'invoice',
                    'quotation',
                    'charges',
                    'equipment.equipment',
                ]) ?? $booking;
            }

            $this->profitabilityService->calculateProfitability($booking, true, $type);

            Log::info('Profitability snapshot saved', [
                'booking_id' => $booking->booking_id,
                'booking_no' => $booking->booking_no,
                'snapshot_type' => $type,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to save profitability snapshot: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id ?? null,
                'snapshot_type' => $type,
            ]);
        }
    }

    // ============================================================
    // QUOTATION HELPERS
    // ============================================================

    private function ensureQuotationForBooking(Booking $booking): Quotation
    {
        if (! $booking->service_event_id) {
            throw new \RuntimeException('Cannot generate a quotation without a service event.');
        }

        $quotation = $booking->quotation
            ?? Quotation::query()->where('service_event_id', $booking->service_event_id)->first();

        if (! $quotation) {
            $quotation = Quotation::query()->create([
                'quote_no' => $this->generateQuoteNumber(),
                'service_event_id' => $booking->service_event_id,
                'total_amount' => $this->calculateQuotationTotal($booking),
                'status' => 'approved',
                'valid_until' => now()->addDays(7)->toDateString(),
            ]);
        }

        if ((int) $booking->quotation_id !== (int) $quotation->quotation_id) {
            $booking->update(['quotation_id' => $quotation->quotation_id]);
        }

        return $quotation;
    }

    private function calculateQuotationTotal(Booking $booking): float
    {
        $booking->loadMissing(['mealServices', 'items', 'charges']);

        $mealTotal = $booking->mealServices->sum(function ($meal) {
            $storedTotal = (float) ($meal->total_meal_amount ?? 0);
            return $storedTotal > 0
                ? $storedTotal
                : ((float) ($meal->pax ?? 0) * (float) ($meal->price_per_head ?? 0));
        });

        $itemTotal = $booking->items->sum(function ($item) {
            return (float) ($item->quantity ?? 0) * (float) ($item->unit_price ?? 0);
        });

        $adjustmentTotal = $booking->charges->sum(function ($charge) {
            $amount = (float) ($charge->amount ?? 0);
            return $charge->charge_kind === 'discount' ? -$amount : $amount;
        });

        return max(0, ($mealTotal > 0 ? $mealTotal : $itemTotal) + $adjustmentTotal);
    }

    // ============================================================
    // ORDER / INVOICE CREATION
    // ============================================================

    private function createOrderFromBooking(Booking $booking): ?Order
    {
        try {
            $existingOrder = Order::where('booking_id', $booking->booking_id)->first();
            if ($existingOrder) {
                return $existingOrder;
            }

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'booking_id' => $booking->booking_id,
                'status' => 'pending',
            ]);

            $this->syncOrderItemsFromBooking($order, $booking);

            return $order;
        } catch (\Exception $e) {
            Log::error('Failed to create order: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id
            ]);
            return null;
        }
    }

    // ⭐ Removed — invoices are created manually by the cashier via
    //    POST /invoices (InvoiceController::store). This method is
    //    intentionally not called during booking approval.
    // ============================================================
    // BACKGROUND JOB METHODS
    // ============================================================

    // ⭐ Removed — invoices are created manually via
    //    Billing → Invoices → Create Invoice (InvoiceController::store).

    public function createKitchenPreparation(Booking $booking, Order $order): void
    {
        $kitchenTasks = $this->preserveKitchenTaskState(
            $booking,
            $order,
            $this->generateKitchenTasks($booking)
        );

        Setting::updateOrCreate(
            ['group' => 'kitchen_tasks', 'key' => 'order_' . $order->order_id],
            ['value' => json_encode($kitchenTasks, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'type' => 'json']
        );

        $this->mergeOrderMetadata($order, [
            'kitchen_preparation' => $kitchenTasks,
            'kitchen_created_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * ⭐ Carry DONE state (and staff edits) over when tasks are regenerated.
     *    A deduction record in settings is the permanent source of truth.
     */
    private function preserveKitchenTaskState(Booking $booking, Order $order, array $tasks): array
    {
        $existing = [];
        $setting  = Setting::where('group', 'kitchen_tasks')->where('key', 'order_' . $order->order_id)->first();
        if ($setting) {
            foreach ($this->decodeSettingValue($setting->value) as $old) {
                if (is_array($old) && ! empty($old['id'])) {
                    $existing[(string) $old['id']] = $old;
                }
            }
        }

        $prefixLen = strlen((string) $booking->booking_id) + 1;
        $deducted  = array_flip(
            Setting::where('group', 'kitchen_task_deductions')
                ->where('key', 'like', $booking->booking_id . ':%')
                ->pluck('key')
                ->map(fn($key) => substr((string) $key, $prefixLen))
                ->all()
        );

        foreach ($tasks as &$task) {
            if (! empty($task['is_header'])) {
                continue;
            }
            $id = (string) ($task['id'] ?? '');
            if ($id === '') {
                continue;
            }

            if (isset($deducted[$id])) {
                $task['is_done'] = true;
                $task['status']  = 'completed';
            }

            if (isset($existing[$id])) {
                $old = $existing[$id];
                foreach (['completed_at', 'completed_by', 'deduction_id'] as $key) {
                    if (isset($old[$key])) {
                        $task[$key] = $old[$key];
                    }
                }
                if (! empty($old['is_done'])) {
                    $task['is_done'] = true;
                    $task['status']  = 'completed';
                }
                if (! empty($old['assigned_to'])) {
                    $task['assigned_to'] = $old['assigned_to'];
                }
            }
        }
        unset($task);

        return $tasks;
    }

    /**
     * ⭐ Delivery leaves 30 min before serving; cooking starts 60 min before that.
     */
    private function suggestKitchenTimes(?string $servingTime, int $prepMinutes = 60, int $leadMinutes = 30): array
    {
        if (! $servingTime) {
            return ['start' => null, 'out' => null];
        }

        try {
            $serve = Carbon::parse($servingTime);
            $out   = $serve->copy()->subMinutes($leadMinutes);
            $start = $out->copy()->subMinutes($prepMinutes);

            return ['start' => $start->format('g:i A'), 'out' => $out->format('g:i A')];
        } catch (\Throwable $e) {
            return ['start' => null, 'out' => null];
        }
    }
    private function generateKitchenTasks(Booking $booking): array
    {
        $tasks = [];
        $booking->loadMissing([
            'mealServices.menuItem',
            'mealServices.package.menuItems',
            'items.menuItem',
        ]);

        if ($booking->mealServices && $booking->mealServices->count() > 0) {
            $tasks[] = [
                'id' => 'header-' . uniqid(),
                'is_header' => true,
                'task' => 'EVENT MEAL PLAN - ' . $booking->booking_no,
                'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                'event_date' => $booking->serviceEvent?->event_date?->format('Y-m-d'),
                'event_time' => $booking->serviceEvent?->event_time,
                'venue' => $booking->serviceEvent?->venue ?? 'N/A',
                'guests' => $booking->serviceEvent?->guests_count ?? 0,
            ];

            foreach ($booking->mealServices as $meal) {
                $meta = [
                    'meal_service_id' => $meal->meal_service_id,
                    'meal_type'        => $meal->meal_type,
                    'quantity'         => $meal->pax,
                    'servings'         => $meal->pax,
                    'day_number'       => (int) $meal->day_number,
                    'service_date'     => $meal->service_date?->toDateString(),
                    'serving_time'     => $meal->serving_time,
                    'start_time'       => $meal->preparation_time ?: ($this->suggestKitchenTimes($meal->serving_time)['start'] ?? null),
                    'end_time'         => $meal->serving_time,
                    'assigned_to'      => $meal->assigned_staff ?: 'Kitchen Team',
                    'status'           => $meal->preparation_status === 'completed' ? 'completed' : 'pending',
                    'is_done'          => $meal->preparation_status === 'completed',
                    'out_for_delivery' => $meal->dispatch_time ?: ($this->suggestKitchenTimes($meal->serving_time)['out'] ?? null),
                    'notes'            => $meal->notes ?? '',
                ];

                // ⭐ FIX #6 — PACKAGE MEALS: emit ONE task per package
                //    menu item. Each item is independently checkable,
                //    reviewable, and reversible.
                if (! empty($meal->package_id)) {
                    // Eager load the package if it wasn't loaded
                    $package = $meal->package ?? \App\Models\Package::with('menuItems')->find($meal->package_id);
                    $packageItems = $package ? $package->menuItems : collect();

                    if ($packageItems->isNotEmpty()) {
                        foreach ($packageItems as $menuItem) {
                            $tasks[] = array_merge($meta, [
                                'id'              => 'meal-' . $meal->meal_service_id . '-item-' . $menuItem->menu_item_id,
                                'is_header'       => false,
                                'task'            => $menuItem->name ?: 'Menu item',
                                'menu_item_id'    => $menuItem->menu_item_id,
                                'package_id'      => $meal->package_id,
                                'package_name'    => $package->name ?? 'Package',
                                'quantity'        => (int) ($menuItem->pivot->quantity_per_pax ?? 1) * (int) $meal->pax,
                                'servings'        => $meal->pax,
                            ]);
                        }
                        continue;
                    }
                }

                // ⭐ FIX #6 — SINGLE MENU ITEM meal. Never use "Meal"
                //    as a fallback label — use the actual menu item name,
                //    then the meal type label, then a stable placeholder.
                $menuName = $meal->menuItem?->name
                    ?: ($meal->package?->name)
                    ?: (string) ($meal->meal_type ?: 'Menu item');

                $tasks[] = array_merge($meta, [
                    'id' => 'meal-' . $meal->meal_service_id,
                    'is_header' => false,
                    'task' => $menuName,
                    'menu_item_id' => $meal->menu_item_id,
                    'package_id' => $meal->package_id,
                ]);
            }
            return $tasks;
        }

        $menuItems = $booking->items;
        $eventDate = Carbon::parse($booking->serviceEvent?->event_date ?? now());
        $eventTime = $booking->serviceEvent?->event_time ?? '12:00 PM';

        $timeParts = explode(' ', $eventTime);
        $time = $timeParts[0] ?? '12:00';
        $modifier = $timeParts[1] ?? 'PM';
        list($hour, $minute) = explode(':', $time);
        $hour = (int)$hour;
        if ($modifier === 'PM' && $hour !== 12) $hour += 12;
        if ($modifier === 'AM' && $hour === 12) $hour = 0;

        $eventDateTime = $eventDate->copy()->setTime($hour, (int)($minute ?? 0));
        $prepStartTime = $eventDateTime->copy()->subHours(2);

        $tasks[] = [
            'id' => 'header-' . uniqid(),
            'is_header' => true,
            'task' => 'EVENT ORDER - ' . $booking->booking_no,
            'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
            'event_date' => $eventDate->format('Y-m-d'),
            'event_time' => $eventTime,
            'venue' => $booking->serviceEvent?->venue ?? 'N/A',
            'guests' => $booking->serviceEvent?->guests_count ?? 0,
        ];

        $currentTime = $prepStartTime->copy();
        foreach ($menuItems as $index => $item) {
            $prepTime = $item->menuItem?->prep_time_minutes ?? 30;
            $endTime = $currentTime->copy()->addMinutes($prepTime);

            $tasks[] = [
                'id' => 'task-' . uniqid(),
                'is_header' => false,
                'task' => $item->custom_item_name ?? $item->menuItem?->name ?? 'Menu Item',
                'menu_item_id' => $item->menu_item_id,   // ⭐ NEW
                'quantity' => $item->quantity,
                'servings' => $item->quantity * ($booking->serviceEvent?->guests_count ?? 1),
                'start_time' => $currentTime->format('h:i A'),
                'end_time' => $endTime->format('h:i A'),
                'assigned_to' => 'Kitchen Team',
                'status' => 'pending',
                'is_done' => false,
                'out_for_delivery' => $eventDateTime->copy()->subMinutes(30)->format('h:i A'),
                'notes' => $item->special_instructions ?? '',
            ];

            $currentTime = $endTime;
        }

        $tasks[] = [
            'id' => 'complete-' . uniqid(),
            'is_header' => false,
            'task' => 'Quality check and final packaging',
            'quantity' => 1,
            'servings' => 1,
            'start_time' => $currentTime->format('h:i A'),
            'end_time' => $eventDateTime->copy()->subMinutes(15)->format('h:i A'),
            'assigned_to' => 'Quality Control',
            'status' => 'pending',
            'is_done' => false,
            'out_for_delivery' => $eventDateTime->copy()->subMinutes(30)->format('h:i A'),
            'notes' => '',
        ];

        return $tasks;
    }

    public function createDeliveryPreparation(Booking $booking, Order $order): void
    {
        $deliveryItems = $this->generateDeliveryItems($booking);

        Setting::updateOrCreate(
            ['group' => 'delivery_items', 'key' => 'order_' . $order->order_id],
            ['value' => json_encode($deliveryItems, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'type' => 'json']
        );

        $this->mergeOrderMetadata($order, [
            'delivery_preparation' => $deliveryItems,
            'delivery_created_at' => now()->toIso8601String(),
        ]);
    }

    private function generateDeliveryItems(Booking $booking): array
    {
        return [];
    }

    // ============================================================
    // INGREDIENTS MANAGEMENT — FIX #13: dedup PRs
    // ============================================================

    public function createIngredientsManagement(Booking $booking): void
    {
        $ingredients = $this->calculateIngredientsForBooking($booking);

        Setting::updateOrCreate(
            ['group' => 'ingredients_summary', 'key' => 'booking_' . $booking->booking_id],
            ['value' => json_encode($ingredients), 'type' => 'json']
        );

        foreach ($ingredients as $ingredient) {
            if (!($ingredient['need_to_buy'] && $ingredient['shortage'] > 0)) {
                continue;
            }

            // ⭐ Skip if a purchase request already exists for this booking/ingredient
            $existing = PurchaseRequest::where('ingredient_id', $ingredient['ingredient_id'])
                ->where('booking_id', $booking->booking_id)
                ->whereIn('status', ['pending', 'received', 'purchased'])
                ->exists();

            if ($existing) {
                continue;
            }

            $this->createPurchaseRequest(
                $ingredient['ingredient_id'],
                $ingredient['shortage'],
                "Auto-generated for booking {$booking->booking_no}",
                $booking->booking_id
            );
        }
    }

    private function calculateIngredientsForBooking(Booking $booking): array
    {
        $ingredientsMap = [];
        $booking->loadMissing(['items.menuItem.recipeIngredients.ingredient']);

        foreach ($booking->items as $item) {
            if (!$item->menu_item_id) continue;

            $menuItem = $item->menuItem;
            if (!$menuItem) continue;

            foreach ($menuItem->recipeIngredients as $recipe) {
                $ingredientId = $recipe->ingredient_id;
                $quantityPerPax = (float)$recipe->quantity_per_pax;
                $requiredQty = $quantityPerPax * $item->quantity;

                if (!isset($ingredientsMap[$ingredientId])) {
                    $stock = InventoryStock::where('ingredient_id', $ingredientId)->first();
                    $ingredient = Ingredient::find($ingredientId);

                    $ingredientsMap[$ingredientId] = [
                        'ingredient_id' => $ingredientId,
                        'name' => $ingredient?->name ?? 'Unknown',
                        'unit' => $recipe->unit ?? $ingredient?->unit ?? 'kg',
                        'per_pax' => $quantityPerPax,
                        'quantity_needed' => 0,
                        'current_stock' => $stock?->current_quantity ?? 0,
                        'reserved_quantity' => $stock?->reserved_quantity ?? 0,
                        'available_stock' => ($stock?->current_quantity ?? 0) - ($stock?->reserved_quantity ?? 0),
                        'unit_cost' => $ingredient?->unit_cost ?? 0,
                        'menu_items' => [],
                        'purchased' => false,
                    ];
                }

                $ingredientsMap[$ingredientId]['quantity_needed'] += $requiredQty;
                $ingredientsMap[$ingredientId]['menu_items'][] = [
                    'name' => $menuItem->name,
                    'quantity' => $item->quantity,
                    'per_pax' => $quantityPerPax,
                    'required' => $requiredQty,
                ];
            }
        }

        foreach ($ingredientsMap as &$ing) {
            $ing['shortage'] = max(0, $ing['quantity_needed'] - $ing['available_stock']);
            $ing['need_to_buy'] = $ing['shortage'] > 0;
            $ing['status'] = $ing['shortage'] > 0
                ? 'insufficient'
                : ($ing['available_stock'] < $ing['quantity_needed'] * 1.2 ? 'low' : 'sufficient');
        }

        return array_values($ingredientsMap);
    }

    private function createPurchaseRequest(int $ingredientId, float $quantity, string $reason, ?int $bookingId = null): PurchaseRequest
    {
        $ingredient = Ingredient::find($ingredientId);

        $prNumber = 'PRQ-' . now()->format('YmdHis') . '-' . substr(microtime(true) * 10000, -4) . '-' . random_int(100, 999);

        return PurchaseRequest::create([
            'pr_number' => $prNumber,
            'ingredient_id' => $ingredientId,
            'quantity' => $quantity,
            'urgency' => $quantity <= 10 ? 'critical' : ($quantity <= 25 ? 'urgent' : 'normal'),
            'status' => 'pending',
            'notes' => "Auto-generated: {$reason} for {$ingredient?->name}" . ($bookingId ? " (Booking: {$bookingId})" : ''),
            'requested_by' => auth()->id() ?? 1,
            'supplier_id' => null,
            'booking_id' => $bookingId,
            'expected_delivery' => null,
        ]);
    }

    private function mergeOrderMetadata(Order $order, array $changes): void
    {
        $setting = Setting::where('group', 'order_metadata')->where('key', 'order_' . $order->order_id)->first();
        $existing = $setting ? $this->decodeSettingValue($setting->value) : [];
        $metadata = array_merge(is_array($existing) ? $existing : [], $changes);

        Setting::updateOrCreate(
            ['group' => 'order_metadata', 'key' => 'order_' . $order->order_id],
            ['value' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'type' => 'json']
        );
    }

    private function decodeSettingValue($value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_object($value)) {
            return (array) $value;
        }
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
    }

    public function createEventTracking(Booking $booking): void
    {
        $stages = ['preparation', 'ready', 'ongoing', 'completed'];

        foreach ($stages as $index => $stage) {
            EventTracking::create([
                'booking_id' => $booking->booking_id,
                'stage' => $stage,
                'progress_percentage' => $index === 0 ? 0 : ($index === 3 ? 100 : 0),
                'stage_started_at' => $index === 0 ? now() : null,
                'notes' => $stage === 'ongoing' ? json_encode([
                    'is_multi_day' => ($booking->serviceEvent?->booking_scope === 'multi_day') || ($booking->eventDays?->max('day_number') ?? 1) > 1,
                    'total_days' => max(1, (int)($booking->eventDays?->max('day_number') ?? 1)),
                    'current_day' => 1,
                ]) : null,
            ]);
        }
    }

    // ============================================================
    // REJECT / CANCEL
    // ============================================================

    public function reject(Booking $booking): Booking
    {
        return DB::transaction(function () use ($booking) {
            $booking->update(['booking_status' => 'rejected']);

            if ($booking->serviceEvent) {
                $booking->serviceEvent->update(['status' => 'cancelled']);
            }

            if ($booking->quotation) {
                $booking->quotation->update(['status' => 'rejected']);
            }

            return $booking;
        });
    }

    public function cancel(Booking $booking, ?string $reason = null): Booking
    {
        $eventDate = $booking->serviceEvent?->event_date;
        $cutoffDays = $this->policyService->cancellationCutoffDays();

        if (!$eventDate && $cutoffDays > 0) {
            Log::warning('Cancelling booking with no event date — cutoff check skipped', [
                'booking_id' => $booking->booking_id,
                'booking_no' => $booking->booking_no,
            ]);
        }

        if ($eventDate && $cutoffDays > 0) {
            $eventCarbon = $eventDate instanceof Carbon
                ? $eventDate
                : Carbon::parse($eventDate);

            $daysUntilEvent = (int) now()->startOfDay()->diffInDays(
                $eventCarbon->copy()->startOfDay(),
                false
            );

            // ⭐ REQUEST #4 — Once the event date has arrived (daysUntilEvent <= 0),
            //    the cutoff rule no longer applies. This is the "auto-remove"
            //    path: the booking was never approved and the event is today
            //    or past — auto-cancellation MUST be allowed so the operator
            //    can clean up stale pending rows.
            $eventHasArrived = $daysUntilEvent <= 0;

            if ($daysUntilEvent < $cutoffDays && !$eventHasArrived) {
                throw ValidationException::withMessages([
                    'cancellation' => [
                        "Cancellation is no longer available because the booking has reached the cancellation cutoff period."
                    ],
                ]);
            }

            if ($eventHasArrived) {
                Log::info('Cancellation allowed past cutoff — event date has arrived', [
                    'booking_id'       => $booking->booking_id,
                    'booking_no'       => $booking->booking_no,
                    'days_until_event' => $daysUntilEvent,
                ]);
            }
        }

        return DB::transaction(function () use ($booking, $reason) {
            $booking->update([
                'booking_status' => 'cancelled',
                'cancellation_reason' => $reason,
            ]);

            if ($booking->serviceEvent) {
                $booking->serviceEvent->update(['status' => 'cancelled']);
            }

            foreach ($booking->equipment as $equipmentItem) {
                $equipmentItem->update(['status' => 'cancelled']);
                $equipment = Equipment::find($equipmentItem->equipment_id);
                if ($equipment) {
                    $equipment->decrement('reserved_quantity', $equipmentItem->quantity_reserved);
                }
            }

            return $booking;
        });
    }

    // ============================================================
    // PAYMENTS
    // ============================================================

    public function paymentSummary(Booking $booking): array
    {
        $totalAmount = $booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0;
        $paidAmount = $booking->payments()->where('status', 'completed')->sum('amount');
        $pendingPayments = $booking->payments()->where('status', 'pending')->sum('amount');

        return [
            'booking_id' => $booking->booking_id,
            'booking_no' => $booking->booking_no,
            'total_amount' => (float) $totalAmount,
            'total_paid' => (float) $paidAmount,
            'pending_amount' => (float) $pendingPayments,
            'balance' => max(0, $totalAmount - $paidAmount),
            'payment_status' => $paidAmount <= 0 ? 'pending' : ($paidAmount < $totalAmount ? 'partial' : 'paid'),
            'payments' => $booking->payments->map(fn($p) => [
                'id' => $p->payment_id,
                'amount' => (float) $p->amount,
                'method' => $p->payment_method,
                'type' => $p->payment_type,
                'status' => $p->status,
                'date' => $p->payment_date?->toDateString(),
                'reference' => $p->reference_number,
            ]),
        ];
    }

    public function recordPayment(Booking $booking, array $data): BookingPayment
    {
        return DB::transaction(function () use ($booking, $data) {
            $payment = BookingPayment::create([
                'booking_id' => $booking->booking_id,
                'payment_number' => 'PAY-' . now()->format('YmdHis') . '-' . $booking->booking_id,
                'amount' => $data['amount'],
                'payment_method' => $data['payment_method'] ?? 'cash',
                'payment_type' => $data['payment_type'] ?? 'partial',
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => 'completed',
                'payment_date' => now(),
                'verified_by' => auth()->id(),
                'verified_at' => now(),
            ]);

            $invoice = $booking->invoice;
            if ($invoice) {
                // ⭐ FIX: Exclude refunds from total paid
                $totalPaid = $booking->payments()
                    ->where('status', 'completed')
                    ->where('payment_type', '!=', 'refund')
                    ->sum('amount');

                $invoice->update([
                    'paid_amount' => $totalPaid,
                    'status' => $totalPaid >= $invoice->total_amount ? 'paid' : ($totalPaid > 0 ? 'partial' : 'unpaid'),
                ]);
            }

            return $payment;
        });
    }
}
