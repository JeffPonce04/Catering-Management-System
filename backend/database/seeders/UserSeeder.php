<?php
// database/seeders/UserSeeder.php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run()
    {
        $users = [
            [
                'name' => 'Admin User',
                'email' => 'admin@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'role' => 'admin',
                'phone' => '09123456789',
                'address' => 'Main Office',
                'status' => 'active'
            ],
            [
                'name' => 'Inventory Manager',
                'email' => 'manager@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'role' => 'manager',
                'phone' => '09234567890',
                'address' => 'Warehouse A',
                'status' => 'active'
            ],
            [
                'name' => 'Staff User',
                'email' => 'staff@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'role' => 'staff',
                'phone' => '09345678901',
                'address' => 'Warehouse B',
                'status' => 'active'
            ],
            [
                'name' => 'John Doe',
                'email' => 'john@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'role' => 'staff',
                'phone' => '09456789012',
                'address' => 'Branch Office',
                'status' => 'active'
            ],
            [
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'role' => 'manager',
                'phone' => '09567890123',
                'address' => 'Main Warehouse',
                'status' => 'active'
            ],
            [
                'name' => 'Test User',
                'email' => 'test@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
                'role' => 'staff',
                'phone' => '09678901234',
                'address' => 'Test Location',
                'status' => 'active'
            ],
        ];

        foreach ($users as $user) {
            User::create($user);
        }

        $this->command->info('Test users created successfully!');
    }
}
