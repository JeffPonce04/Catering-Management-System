<?php
// database/seeders/StaffDatabaseSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Department;
use App\Models\Position;
use App\Models\Employee;
use App\Models\PayrollPeriod;
use Carbon\Carbon;

class StaffDatabaseSeeder extends Seeder
{
    public function run()
    {
        // Create Departments
        $departments = [
            ['department_id' => 'DEPT-001', 'name' => 'Kitchen Operations', 'code' => 'KIT', 'head_position' => 'Executive Chef'],
            ['department_id' => 'DEPT-002', 'name' => 'Pastry & Desserts', 'code' => 'PAS', 'head_position' => 'Pastry Chef'],
            ['department_id' => 'DEPT-003', 'name' => 'Events Management', 'code' => 'EVT', 'head_position' => 'Event Manager'],
            ['department_id' => 'DEPT-004', 'name' => 'Service Staff', 'code' => 'SRV', 'head_position' => 'Head Server'],
            ['department_id' => 'DEPT-005', 'name' => 'Beverage', 'code' => 'BEV', 'head_position' => 'Head Bartender'],
            ['department_id' => 'DEPT-006', 'name' => 'Operations', 'code' => 'OPS', 'head_position' => 'Operations Manager'],
        ];

        foreach ($departments as $dept) {
            Department::create($dept);
        }

        // Create Positions
        $positions = [
            // Kitchen
            ['position_id' => 'POS-001', 'title' => 'Executive Chef', 'department_id' => 1, 'base_salary' => 75000, 'hourly_rate' => 350],
            ['position_id' => 'POS-002', 'title' => 'Sous Chef', 'department_id' => 1, 'base_salary' => 55000, 'hourly_rate' => 280],
            ['position_id' => 'POS-003', 'title' => 'Line Cook', 'department_id' => 1, 'base_salary' => 35000, 'hourly_rate' => 180],
            ['position_id' => 'POS-004', 'title' => 'Dishwasher', 'department_id' => 1, 'base_salary' => 25000, 'hourly_rate' => 120],

            // Pastry
            ['position_id' => 'POS-005', 'title' => 'Pastry Chef', 'department_id' => 2, 'base_salary' => 58000, 'hourly_rate' => 290],
            ['position_id' => 'POS-006', 'title' => 'Baker', 'department_id' => 2, 'base_salary' => 38000, 'hourly_rate' => 190],

            // Events
            ['position_id' => 'POS-007', 'title' => 'Event Coordinator', 'department_id' => 3, 'base_salary' => 42000, 'hourly_rate' => 210],
            ['position_id' => 'POS-008', 'title' => 'Event Assistant', 'department_id' => 3, 'base_salary' => 28000, 'hourly_rate' => 140],

            // Service
            ['position_id' => 'POS-009', 'title' => 'Head Server', 'department_id' => 4, 'base_salary' => 32000, 'hourly_rate' => 160],
            ['position_id' => 'POS-010', 'title' => 'Server', 'department_id' => 4, 'base_salary' => 25000, 'hourly_rate' => 125],
            ['position_id' => 'POS-011', 'title' => 'Bartender', 'department_id' => 5, 'base_salary' => 30000, 'hourly_rate' => 150],

            // Operations
            ['position_id' => 'POS-012', 'title' => 'Logistics Manager', 'department_id' => 6, 'base_salary' => 45000, 'hourly_rate' => 225],
            ['position_id' => 'POS-013', 'title' => 'Setup Crew', 'department_id' => 6, 'base_salary' => 22000, 'hourly_rate' => 110],
        ];

        foreach ($positions as $pos) {
            Position::create($pos);
        }

        // Create Payroll Periods
        $startDate = Carbon::create(2026, 1, 1);
        for ($i = 0; $i < 6; $i++) {
            $periodStart = $startDate->copy()->addMonths($i);
            $periodEnd = $periodStart->copy()->addMonth()->subDay();

            PayrollPeriod::create([
                'period_id' => 'PRD-' . str_pad($i + 1, 3, '0', STR_PAD_LEFT),
                'name' => $periodStart->format('F Y'),
                'start_date' => $periodStart,
                'end_date' => $periodEnd,
                'cutoff_date' => $periodStart->copy()->addDays(15),
                'payment_date' => $periodEnd->copy()->addDays(5),
                'status' => $i < 3 ? 'completed' : ($i == 3 ? 'processing' : 'draft')
            ]);
        }
    }
}
