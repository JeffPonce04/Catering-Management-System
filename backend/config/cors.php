<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'login',
        'logout',
        'register',
        'user',
        'auth/*',
        'bookings',
        'bookings/*',
        'bookings-statistics',
        'quotations',
        'quotations/*',
        'menu-items',
        'menu-items/*',
        'meal-categories',
        'meal-categories/*',
        'meal-categories/manage',
        'packages',
        'packages/*',
        'promotions',
        'promotions/*',
        'ingredients',
        'ingredients/*',
        'recipes',
        'recipes/*',
        'menu-statistics',
        'event-types',
        'calendar-events',
        'booking-calendar/availability',
        'booking-calendar/availability/*',
        'employees',
        'employees/*',
        'schedules',
        'schedules/*',
        'attendance',
        'attendance/*',
        'daily-attendance',
        'daily-attendance/*',
        'payroll',
        'payroll/*',
        'payslips',
        'payslips/*',
        'employee-requests',
        'employee-requests/*',
        'departments',
        'departments/*',
        'positions',
        'positions/*',
        'salary-grades',
        'salary-grades/*',
        'products',
        'products/*',
        'equipment',
        'equipment/*',
        'events',
        'events/*',
        'inventory-history',
        'inventory-history/*',
        'dashboard',
        'dashboard/*',
        'payments',
        'payments/*',
        'invoices',
        'invoices/*',
        'financial-reports',
        'financial-reports/*',
        'shift-types',
        'shift-types/*',
        'orders',
        'orders/*',
        'shopping-list',
        'shopping-list/*',
    ],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        // Local development
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://127.0.0.1:8081',
        'http://localhost:8081',
        'http://127.0.0.1:19006',
        'http://localhost:19006',
        'http://127.0.0.1:8000',
        'http://localhost:8000',

        // Production backend (Hostinger)
        'https://plum-jaguar-651638.hostingersite.com',

        // ⚠️ REPLACE the line below with your actual Expo web / frontend domain
        'https://your-expo-web-app.vercel.app',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
