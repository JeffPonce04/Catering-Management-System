<?php
// app/Http/Controllers/EventController.php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Equipment;
use App\Models\EventEquipment;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class EventController extends Controller
{
    /**
     * Display a listing of events
     */
    public function index(Request $request)
    {
        $query = Event::with(['equipment.equipment']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('event_id', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
                    ->orWhere('person_responsible', 'like', "%{$search}%");
            });
        }

        // Date range filter
        if ($request->has('date_from')) {
            $query->where('date_out', '>=', $request->date_from);
        }
        if ($request->has('date_to')) {
            $query->where('date_out', '<=', $request->date_to);
        }

        $events = $query->orderBy('date_out', 'desc')->paginate($request->get('per_page', 10));

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }

    /**
     * Store a newly created event (stock out)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'eventName' => 'required|string|max:255',
            'eventLocation' => 'required|string|max:255',
            'dateOut' => 'required|date',
            'expectedDateIn' => 'required|date|after:dateOut',
            'personResponsible' => 'required|string|max:255',
            'contactNumber' => 'nullable|string|max:20',
            'notes' => 'nullable|string',
            'equipment' => 'required|array|min:1',
            'equipment.*.id' => 'required|string',
            'equipment.*.quantityOut' => 'required|integer|min:1'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Generate event ID - FIXED: removed withTrashed()
        $count = Event::count() + 1;
        $eventId = 'EVT-' . str_pad($count, 4, '0', STR_PAD_LEFT);

        DB::beginTransaction();

        try {
            // Check equipment availability first
            $equipmentList = [];
            foreach ($request->equipment as $eq) {
                $item = Equipment::where('equipment_id', $eq['id'])->first();

                if (!$item) {
                    throw new \Exception("Equipment not found: {$eq['id']}");
                }

                if ($item->available < $eq['quantityOut']) {
                    throw new \Exception("Insufficient quantity for {$item->name}. Available: {$item->available}, Requested: {$eq['quantityOut']}");
                }

                $equipmentList[] = [
                    'item' => $item,
                    'quantity' => $eq['quantityOut']
                ];
            }

            // Create event
            $event = Event::create([
                'event_id' => $eventId,
                'name' => $request->eventName,
                'location' => $request->eventLocation,
                'date_out' => Carbon::parse($request->dateOut),
                'expected_date_in' => Carbon::parse($request->expectedDateIn),
                'person_responsible' => $request->personResponsible,
                'contact_number' => $request->contactNumber,
                'notes' => $request->notes,
                'status' => Carbon::parse($request->dateOut) > now() ? 'upcoming' : 'ongoing'
            ]);

            // Process each equipment
            foreach ($equipmentList as $eqData) {
                $item = $eqData['item'];
                $quantity = $eqData['quantity'];

                // Create event equipment record
                EventEquipment::create([
                    'event_id' => $eventId,
                    'equipment_id' => $item->equipment_id,
                    'quantity_out' => $quantity,
                    'quantity_returned' => 0,
                    'damaged' => 0,
                    'missing' => 0,
                    'status' => 'out',
                    'notes' => null
                ]);

                // Update equipment quantities
                $item->in_use += $quantity;
                $item->available -= $quantity;
                $item->usage_count += $quantity;
                $item->status = 'in-use';
                $item->save();

                // Create history
                InventoryHistory::create([
                    'trackable_id' => $item->id,
                    'trackable_type' => Equipment::class,
                    'item_name' => $item->name,
                    'type' => 'out',
                    'quantity' => $quantity,
                    'unit' => 'pcs',
                    'date' => now(),
                    'reason' => "Event: {$request->eventName}",
                    'performed_by' => auth()->user()->name ?? $request->personResponsible,
                    'event_id' => $eventId,
                    'event_name' => $request->eventName,
                    'details' => json_encode(['quantity_out' => $quantity])
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Event created successfully',
                'data' => $event->load('equipment.equipment')
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create event',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Return equipment from event (stock in)
     */
    /**
     * Return equipment from event (stock in)
     */
    public function returnEquipment(Request $request, $id)
    {
        $event = Event::where('event_id', $id)->first();

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Event not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'returns' => 'required|array',
            'returns.*.equipment_id' => 'required|string',
            'returns.*.returned' => 'required|integer|min:0',
            'returns.*.damaged' => 'required|integer|min:0',
            'returns.*.missing' => 'required|integer|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $allReturned = true;

            foreach ($request->returns as $return) {
                // Find the event equipment record
                $eventEquipment = EventEquipment::where('event_id', $id)
                    ->where('equipment_id', $return['equipment_id'])
                    ->first();

                if (!$eventEquipment) {
                    throw new \Exception("Equipment record not found for ID: {$return['equipment_id']}");
                }

                $totalReturned = $return['returned'] + $return['damaged'] + $return['missing'];

                if ($totalReturned > $eventEquipment->quantity_out) {
                    throw new \Exception("Returned quantity exceeds quantity taken out for equipment {$return['equipment_id']}");
                }

                $item = Equipment::where('equipment_id', $return['equipment_id'])->first();

                if (!$item) {
                    throw new \Exception("Equipment not found: {$return['equipment_id']}");
                }

                // Update equipment counts
                $item->in_use -= $eventEquipment->quantity_out;
                $item->available += $return['returned'];
                $item->damaged += $return['damaged'];
                $item->missing += $return['missing'];

                // Ensure available doesn't go negative
                if ($item->available < 0) {
                    $item->available = 0;
                }

                // Update status based on remaining stock
                if ($item->damaged == $item->total_quantity) {
                    $item->status = 'damaged';
                } elseif ($item->under_maintenance > 0) {
                    $item->status = 'maintenance';
                } elseif ($item->available > 0) {
                    $item->status = 'available';
                } elseif ($item->in_use > 0) {
                    $item->status = 'in-use';
                }

                $item->save();

                // Update event equipment record
                $eventEquipment->quantity_returned = $return['returned'];
                $eventEquipment->damaged = $return['damaged'];
                $eventEquipment->missing = $return['missing'];

                if ($totalReturned >= $eventEquipment->quantity_out) {
                    $eventEquipment->status = 'returned';
                } else {
                    $eventEquipment->status = 'partial';
                    $allReturned = false;
                }

                $eventEquipment->save();

                // Create history for returned items
                if ($return['returned'] > 0) {
                    InventoryHistory::create([
                        'trackable_id' => $item->id,
                        'trackable_type' => Equipment::class,
                        'item_name' => $item->name,
                        'type' => 'in',
                        'quantity' => $return['returned'],
                        'unit' => 'pcs',
                        'date' => now(),
                        'reason' => "Return from event: {$event->name}",
                        'performed_by' => auth()->user()->name ?? 'System',
                        'event_id' => $event->event_id,
                        'event_name' => $event->name,
                        'details' => json_encode(['returned' => $return['returned']])
                    ]);
                }

                // Create history for damaged items
                if ($return['damaged'] > 0) {
                    InventoryHistory::create([
                        'trackable_id' => $item->id,
                        'trackable_type' => Equipment::class,
                        'item_name' => $item->name,
                        'type' => 'damaged',
                        'quantity' => $return['damaged'],
                        'unit' => 'pcs',
                        'date' => now(),
                        'reason' => "Damaged during event: {$event->name}",
                        'performed_by' => auth()->user()->name ?? 'System',
                        'event_id' => $event->event_id,
                        'event_name' => $event->name,
                        'damaged' => $return['damaged'],
                        'details' => json_encode(['damaged' => $return['damaged']])
                    ]);
                }

                // Create history for missing items
                if ($return['missing'] > 0) {
                    InventoryHistory::create([
                        'trackable_id' => $item->id,
                        'trackable_type' => Equipment::class,
                        'item_name' => $item->name,
                        'type' => 'missing',
                        'quantity' => $return['missing'],
                        'unit' => 'pcs',
                        'date' => now(),
                        'reason' => "Missing from event: {$event->name}",
                        'performed_by' => auth()->user()->name ?? 'System',
                        'event_id' => $event->event_id,
                        'event_name' => $event->name,
                        'missing' => $return['missing'],
                        'details' => json_encode(['missing' => $return['missing']])
                    ]);
                }
            }

            // Update event status
            if ($allReturned) {
                $event->actual_date_in = now();
                $event->status = 'completed';
            }

            $event->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Equipment returned successfully',
                'data' => $event->load('equipment.equipment')
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to return equipment',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    /**
     * Display the specified event
     */
    public function show($id)
    {
        $event = Event::with(['equipment.equipment', 'history'])
            ->where('event_id', $id)
            ->first();

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Event not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $event
        ]);
    }

    /**
     * Update the specified event
     */
    public function update(Request $request, $id)
    {
        $event = Event::where('event_id', $id)->first();

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Event not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'location' => 'sometimes|string|max:255',
            'expected_date_in' => 'sometimes|date|after:date_out',
            'person_responsible' => 'sometimes|string|max:255',
            'contact_number' => 'nullable|string|max:20',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:ongoing,upcoming,completed,overdue'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $event->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Event updated successfully',
            'data' => $event
        ]);
    }

    /**
     * Get upcoming events
     */
    public function getUpcoming()
    {
        $events = Event::where('status', 'upcoming')
            ->where('date_out', '>', now())
            ->orderBy('date_out', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }

    /**
     * Get ongoing events
     */
    public function getOngoing()
    {
        $events = Event::where('status', 'ongoing')
            ->orderBy('date_out', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }

    /**
     * Get completed events
     */
    public function getCompleted()
    {
        $events = Event::where('status', 'completed')
            ->orderBy('actual_date_in', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }

    /**
     * Get overdue events
     */
    public function getOverdue()
    {
        $events = Event::where('status', 'ongoing')
            ->where('expected_date_in', '<', now())
            ->orderBy('expected_date_in', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }

    /**
     * Get event equipment
     */
    public function getEventEquipment($id)
    {
        $event = Event::where('event_id', $id)->first();

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Event not found'
            ], 404);
        }

        $equipment = EventEquipment::with('equipment')
            ->where('event_id', $id)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $equipment
        ]);
    }

    /**
     * Cancel event
     */
    public function cancel($id)
    {
        $event = Event::where('event_id', $id)->first();

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Event not found'
            ], 404);
        }

        if ($event->status !== 'upcoming') {
            return response()->json([
                'success' => false,
                'message' => 'Only upcoming events can be cancelled'
            ], 422);
        }

        DB::beginTransaction();

        try {
            // Return all equipment
            foreach ($event->equipment as $eventEquipment) {
                $item = Equipment::where('equipment_id', $eventEquipment->equipment_id)->first();

                if ($item) {
                    $item->in_use -= $eventEquipment->quantity_out;
                    $item->available += $eventEquipment->quantity_out;
                    $item->save();
                }
            }

            $event->status = 'cancelled';
            $event->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Event cancelled successfully',
                'data' => $event
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to cancel event',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete event
     */
    public function destroy($id)
    {
        $event = Event::where('event_id', $id)->first();

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Event not found'
            ], 404);
        }

        if ($event->status === 'ongoing') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete ongoing events'
            ], 422);
        }

        $event->delete();

        return response()->json([
            'success' => true,
            'message' => 'Event deleted successfully'
        ]);
    }

    /**
     * Get event statistics
     */
    public function getStats()
    {
        $stats = [
            'ongoing' => Event::where('status', 'ongoing')->count(),
            'upcoming' => Event::where('status', 'upcoming')
                ->where('date_out', '>', now())
                ->count(),
            'completed' => Event::where('status', 'completed')
                ->whereMonth('created_at', now()->month)
                ->count(),
            'overdue' => Event::where('status', 'ongoing')
                ->where('expected_date_in', '<', now())
                ->count(),
            'equipment_out' => EventEquipment::where('status', 'out')->sum('quantity_out'),
            'equipment_returned' => EventEquipment::sum('quantity_returned'),
            'equipment_damaged' => EventEquipment::sum('damaged'),
            'equipment_missing' => EventEquipment::sum('missing'),
            'total_events' => Event::count(),
            'completed_total' => Event::where('status', 'completed')->count()
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }
}
