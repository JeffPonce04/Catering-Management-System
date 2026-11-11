<?php
// ⭐ FIND: no migration exists for salary base
// ⭐ REPLACE: add this migration file

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // ---------- EMPLOYEES ----------
        Schema::table('employees', function (Blueprint $table) {
            if (!Schema::hasColumn('employees', 'salary_base')) {
                $table->enum('salary_base', ['monthly', 'daily', 'hourly'])
                    ->default('hourly')
                    ->after('hourly_rate')
                    ->comment('hourly = legacy default to preserve existing employees');
            }
            if (!Schema::hasColumn('employees', 'monthly_salary')) {
                $table->decimal('monthly_salary', 12, 2)->nullable()->after('salary_base');
            }
            if (!Schema::hasColumn('employees', 'daily_rate')) {
                $table->decimal('daily_rate', 12, 2)->nullable()->after('monthly_salary');
            }
            if (!Schema::hasColumn('employees', 'payroll_frequency')) {
                $table->enum('payroll_frequency', ['semi_monthly', 'monthly'])
                    ->default('semi_monthly')
                    ->after('daily_rate');
            }
            if (!Schema::hasColumn('employees', 'salary_effective_date')) {
                $table->date('salary_effective_date')->nullable()->after('payroll_frequency');
            }
        });

        // ---------- SALARY HISTORY (append-only) ----------
        if (!Schema::hasTable('employee_salary_history')) {
            Schema::create('employee_salary_history', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('employee_id');
                $table->enum('salary_base', ['monthly', 'daily', 'hourly']);
                $table->decimal('monthly_salary', 12, 2)->nullable();
                $table->decimal('daily_rate', 12, 2)->nullable();
                $table->decimal('hourly_rate', 12, 2)->nullable();
                $table->enum('payroll_frequency', ['semi_monthly', 'monthly'])->default('semi_monthly');
                $table->date('effective_date');
                $table->unsignedBigInteger('changed_by')->nullable();
                $table->string('reason', 255)->nullable();
                $table->timestamps();
                $table->index(['employee_id', 'effective_date'], 'emp_salary_hist_idx');
            });
        }

        // ---------- PAYROLLS ----------
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'salary_base')) {
                $table->enum('salary_base', ['monthly', 'daily', 'hourly'])
                    ->default('hourly')->after('employee_id');
            }
            if (!Schema::hasColumn('payrolls', 'monthly_salary_snapshot')) {
                $table->decimal('monthly_salary_snapshot', 12, 2)->nullable();
            }
            if (!Schema::hasColumn('payrolls', 'daily_rate_snapshot')) {
                $table->decimal('daily_rate_snapshot', 12, 2)->nullable();
            }
            if (!Schema::hasColumn('payrolls', 'payable_days')) {
                $table->decimal('payable_days', 8, 2)->default(0);
            }
            if (!Schema::hasColumn('payrolls', 'night_diff_hours')) {
                $table->decimal('night_diff_hours', 8, 2)->default(0);
            }
            if (!Schema::hasColumn('payrolls', 'night_diff_pay')) {
                $table->decimal('night_diff_pay', 12, 2)->default(0);
            }
            if (!Schema::hasColumn('payrolls', 'holiday_pay')) {
                $table->decimal('holiday_pay', 12, 2)->default(0);
            }
            if (!Schema::hasColumn('payrolls', 'rest_day_pay')) {
                $table->decimal('rest_day_pay', 12, 2)->default(0);
            }
            if (!Schema::hasColumn('payrolls', 'undertime_pay')) {
                $table->decimal('undertime_pay', 12, 2)->default(0);
            }
        });

        // ---------- BACKFILL: map existing hourly employees ----------
        DB::table('employees')->whereNull('salary_base')->update(['salary_base' => 'hourly']);
        DB::table('payrolls')->whereNull('salary_base')->update(['salary_base' => 'hourly']);
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_salary_history');
        Schema::table('employees', function (Blueprint $table) {
            foreach (['salary_base', 'monthly_salary', 'daily_rate', 'payroll_frequency', 'salary_effective_date'] as $c) {
                if (Schema::hasColumn('employees', $c)) $table->dropColumn($c);
            }
        });
        Schema::table('payrolls', function (Blueprint $table) {
            foreach (
                [
                    'salary_base',
                    'monthly_salary_snapshot',
                    'daily_rate_snapshot',
                    'payable_days',
                    'night_diff_hours',
                    'night_diff_pay',
                    'holiday_pay',
                    'rest_day_pay',
                    'undertime_pay'
                ] as $c
            ) {
                if (Schema::hasColumn('payrolls', $c)) $table->dropColumn($c);
            }
        });
    }
};
