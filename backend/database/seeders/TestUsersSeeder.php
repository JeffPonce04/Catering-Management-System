<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class TestUsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create multiple test accounts
        $testUsers = [
            [
                'name' => 'John Doe',
                'user_id' => '12345678',
                'phone_number' => '09123456789',
                'password' => Hash::make('password123'),
                'email' => 'john@example.com',
            ],
            [
                'name' => 'Jane Smith',
                'user_id' => '87654321',
                'phone_number' => '09876543210',
                'password' => Hash::make('password123'),
                'email' => 'jane@example.com',
            ],
            [
                'name' => 'Admin User',
                'user_id' => 'admin001',
                'phone_number' => '09111222333',
                'password' => Hash::make('admin123'),
                'email' => 'admin@example.com',
            ],
            [
                'name' => 'Test User',
                'user_id' => 'test123',
                'phone_number' => '09090909090',
                'password' => Hash::make('test123'),
                'email' => 'test@example.com',
            ],
        ];

        foreach ($testUsers as $user) {
            User::create($user);
        }

        $this->command->info('Test users created successfully!');
    }
}
