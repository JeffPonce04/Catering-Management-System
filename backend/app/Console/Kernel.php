<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by your application.
     *
     * @var array
     */
    protected $commands = [
        // Commands will be auto-discovered
    ];

    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // ==================== DAILY NOTIFICATIONS ====================
        
        // Daily at 9 AM - check upcoming events (3 days from now)
        $schedule->command('notify:upcoming-events')->dailyAt('09:00');
        
        // Daily at 10 AM - check pending attendance verifications
        $schedule->command('notify:pending-attendance')->dailyAt('10:00');
        
        // Daily at 8 AM - check missing time-outs from previous day
        $schedule->command('notify:missing-timeouts')->dailyAt('08:00');
        
        // Daily at 9 AM - check due and overdue balances
        $schedule->command('notify:due-balances')->dailyAt('09:00');
        
        // Daily at 8 AM - check overdue equipment returns
        $schedule->command('notify:equipment-overdue')->dailyAt('08:00');
        
        // Daily at 9 AM - check equipment return pending for completed events
        $schedule->command('notify:equipment-return-pending')->dailyAt('09:00');
        
        // ==================== EVERY HOUR ====================
        
        // Every hour - check for low stock alerts
        $schedule->command('notify:low-stock')->hourly();

        // Every hour - create purchase reminders for event ingredient shortages 24-8 hours before events
        $schedule->command('notify:purchase-requests')->hourly();
        
        // ==================== EVERY 30 MINUTES ====================
        
        // Every 30 minutes - sync event statuses
        $schedule->command('events:sync-status')->everyThirtyMinutes();
        
        // ==================== WEEKLY ====================
        
        // Every Monday at 8 AM - weekly schedule reminders
        $schedule->command('notify:weekly-schedule')->mondays()->at('08:00');
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}