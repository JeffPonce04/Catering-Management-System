<?php

namespace App\Observers;

use App\Models\Booking;
use Illuminate\Support\Facades\Log;

class BookingStatusGuard
{
    private const PRE_START = [
        'pending',
        'pending_approval',
        'draft',
        'approved',
        'confirmed',
        'rescheduled',
        'reschedule_requested',
        'reschedule_rejected',
    ];

    public function updating(Booking $booking): void
    {
        if (! $booking->isDirty('booking_status')) {
            return;
        }

        $original = strtolower((string) $booking->getOriginal('booking_status'));
        $next     = strtolower((string) $booking->booking_status);

        if ($original !== 'ongoing' || ! in_array($next, self::PRE_START, true)) {
            return;
        }

        // The ONLY path allowed to revert an ongoing event.
        if (request()->is('*/bookings/*/unstart-event')) {
            return;
        }

        Log::warning('Blocked automatic revert of an ongoing booking', [
            'booking_id' => $booking->booking_id,
            'attempted'  => $next,
        ]);

        $booking->booking_status = 'ongoing';
    }
}
