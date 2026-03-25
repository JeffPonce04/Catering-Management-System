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

        // Create Payroll Periods for 2026
        $startDate = Carbon::create(2026, 1, 1);
        for ($i = 0; $i < 12; $i++) {
            $periodStart = $startDate->copy()->addMonths($i);
            $periodEnd = $periodStart->copy()->endOfMonth();

            PayrollPeriod::create([
                'period_id' => 'PRD-' . str_pad($i + 1, 3, '0', STR_PAD_LEFT),
                'name' => $periodStart->format('F Y'),
                'start_date' => $periodStart,
                'end_date' => $periodEnd,
                'cutoff_date' => $periodStart->copy()->addDays(15),
                'payment_date' => $periodEnd->copy()->addDays(5),
                'status' => $i < now()->month ? 'completed' : ($i == now()->month ? 'processing' : 'draft')
            ]);
        }

        // Create sample employees matching your frontend data
        $employees = [
            [
                'employee_id' => 'CAT-001',
                'first_name' => 'John',
                'last_name' => 'Smith',
                'email' => 'john.smith@catering.com',
                'phone' => '+1 (234) 567-8901',
                'emergency_phone' => '+1 (234) 567-8999',
                'emergency_contact' => 'Jane Smith',
                'emergency_relation' => 'Spouse',
                'address' => '123 Main Street, Apt 4B, New York, NY 10001',
                'department_id' => 1,
                'position_id' => 1,
                'employee_type' => 'regular',
                'status' => 'active',
                'hire_date' => '2023-01-15',
                'birth_date' => '1985-03-12',
                'gender' => 'male',
                'sss' => '12-3456789-0',
                'philhealth' => '12-345678901-2',
                'pagibig' => '1234-5678-9012',
                'tin' => '123-456-789-000',
                'bank_name' => 'Chase Bank',
                'bank_account' => '****1234',
                'shift_preference' => 'morning',
                'hourly_rate' => 35,
                'monthly_salary' => 75000,
                'skills' => json_encode(['Menu Planning', 'Kitchen Management', 'Food Cost Control', 'Team Leadership']),
                'certifications' => json_encode(['ServSafe Certified', 'Culinary Arts Degree', 'HACCP Certified']),
                'achievements' => json_encode(['Employee of the Month - Mar 2023', 'Best Menu Innovation 2023']),
                'notes' => 'Excellent leadership skills. Trained 5 junior chefs.',
                'is_bookmarked' => false,
                'login_count' => 245
            ],
            [
                'employee_id' => 'CAT-002',
                'first_name' => 'Sarah',
                'last_name' => 'Johnson',
                'email' => 'sarah.j@catering.com',
                'phone' => '+1 (234) 567-8902',
                'emergency_phone' => '+1 (234) 567-8998',
                'emergency_contact' => 'Tom Johnson',
                'emergency_relation' => 'Brother',
                'address' => '456 Oak Avenue, Los Angeles, CA 90001',
                'department_id' => 2,
                'position_id' => 5,
                'employee_type' => 'regular',
                'status' => 'active',
                'hire_date' => '2023-03-20',
                'birth_date' => '1990-07-24',
                'gender' => 'female',
                'sss' => '23-4567890-1',
                'philhealth' => '23-456789012-3',
                'pagibig' => '2345-6789-0123',
                'tin' => '234-567-890-111',
                'bank_name' => 'Wells Fargo',
                'bank_account' => '****5678',
                'shift_preference' => 'morning',
                'hourly_rate' => 30,
                'monthly_salary' => 62000,
                'skills' => json_encode(['French Pastry', 'Cake Design', 'Chocolate Work', 'Baking']),
                'certifications' => json_encode(['Pastry Arts Certificate', 'Food Handler', 'Wedding Cake Specialist']),
                'achievements' => json_encode(['Best Dessert Award 2023', 'Wedding Cake Competition Finalist']),
                'notes' => 'Specializes in wedding cakes. Has 50+ wedding clients.',
                'is_bookmarked' => false,
                'login_count' => 189
            ],
            [
                'employee_id' => 'CAT-003',
                'first_name' => 'Michael',
                'last_name' => 'Chen',
                'email' => 'michael.c@catering.com',
                'phone' => '+1 (234) 567-8903',
                'emergency_phone' => '+1 (234) 567-8997',
                'emergency_contact' => 'Lisa Chen',
                'emergency_relation' => 'Mother',
                'address' => '789 Pine Street, Chicago, IL 60601',
                'department_id' => 1,
                'position_id' => 2,
                'employee_type' => 'regular',
                'status' => 'onleave',
                'hire_date' => '2023-06-10',
                'birth_date' => '1992-11-05',
                'gender' => 'male',
                'sss' => '34-5678901-2',
                'philhealth' => '34-567890123-4',
                'pagibig' => '3456-7890-1234',
                'tin' => '345-678-901-222',
                'bank_name' => 'Citibank',
                'bank_account' => '****9012',
                'shift_preference' => 'evening',
                'hourly_rate' => 28,
                'monthly_salary' => 58000,
                'skills' => json_encode(['Asian Cuisine', 'Inventory Management', 'Staff Training', 'Cost Control']),
                'certifications' => json_encode(['Culinary Management', 'HACCP Certified', 'First Aid']),
                'achievements' => json_encode(['Cost Reduction Award 2023']),
                'notes' => 'Currently on medical leave. Expected return: April 2024.',
                'is_bookmarked' => false,
                'login_count' => 156
            ],
            [
                'employee_id' => 'CAT-004',
                'first_name' => 'Emily',
                'last_name' => 'Davis',
                'email' => 'emily.d@catering.com',
                'phone' => '+1 (234) 567-8904',
                'emergency_phone' => '+1 (234) 567-8996',
                'emergency_contact' => 'David Davis',
                'emergency_relation' => 'Father',
                'address' => '321 Elm Street, Houston, TX 77001',
                'department_id' => 3,
                'position_id' => 7,
                'employee_type' => 'regular',
                'status' => 'active',
                'hire_date' => '2023-09-05',
                'birth_date' => '1995-02-18',
                'gender' => 'female',
                'sss' => '45-6789012-3',
                'philhealth' => '45-678901234-5',
                'pagibig' => '4567-8901-2345',
                'tin' => '456-789-012-333',
                'bank_name' => 'Bank of America',
                'bank_account' => '****3456',
                'shift_preference' => 'flexible',
                'hourly_rate' => 25,
                'monthly_salary' => 55000,
                'skills' => json_encode(['Event Planning', 'Client Relations', 'Vendor Management', 'Budgeting']),
                'certifications' => json_encode(['Certified Event Planner', 'First Aid', 'Customer Service Excellence']),
                'achievements' => json_encode(['Best Event Coordinator 2023', 'Client Satisfaction Award', '100+ Events Coordinated']),
                'notes' => 'Managed 50+ corporate events in 2023. Client satisfaction rate: 98%.',
                'is_bookmarked' => true,
                'login_count' => 134
            ]
        ];

        foreach ($employees as $emp) {
            Employee::create($emp);
        }
    }
}
