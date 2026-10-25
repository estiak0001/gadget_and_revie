<?php

namespace Database\Seeders;

use App\Models\ChartOfAccount;
use App\Models\PaymentMethod;
use Illuminate\Database\Seeder;

class PaymentMethodSeeder extends Seeder
{
    /**
     * The 4 payment methods the app shipped with, as real rows. 'cash' is linked to the
     * EXISTING Cash account (1000) — reusing it, not creating a new one, so every historical
     * cash journal line keeps meaning exactly what it always has. The other 3 get fresh asset
     * accounts in the 11xx range (same numbering PaymentMethodController::store() uses for any
     * payment method added later), since today every bkash/nagad/bank_transfer order payment has
     * actually been posting into the single Cash account right alongside real cash — this is the
     * first time they get their own distinct ledger balance.
     */
    public function run(): void
    {
        $cash = ChartOfAccount::where('code', '1000')->firstOrFail();

        PaymentMethod::updateOrCreate(
            ['code' => 'cash'],
            ['name' => 'Cash', 'type' => 'cash', 'chart_of_account_id' => $cash->id, 'is_system' => true, 'is_active' => true, 'sort_order' => 1]
        );

        $defaults = [
            ['code' => 'bkash', 'name' => 'bKash', 'type' => 'mobile_banking', 'coa_code' => '1100', 'sort_order' => 2],
            ['code' => 'nagad', 'name' => 'Nagad', 'type' => 'mobile_banking', 'coa_code' => '1101', 'sort_order' => 3],
            ['code' => 'bank_transfer', 'name' => 'Bank Transfer', 'type' => 'bank', 'coa_code' => '1102', 'sort_order' => 4],
        ];

        foreach ($defaults as $d) {
            $account = ChartOfAccount::firstOrCreate(
                ['code' => $d['coa_code']],
                [
                    'name' => $d['name'],
                    'type' => 'asset',
                    'normal_balance' => 'debit',
                    'description' => 'Auto-created for the "' . $d['name'] . '" payment method.',
                    'is_system' => true,
                    'is_active' => true,
                ]
            );

            PaymentMethod::updateOrCreate(
                ['code' => $d['code']],
                [
                    'name' => $d['name'],
                    'type' => $d['type'],
                    'chart_of_account_id' => $account->id,
                    'is_system' => true,
                    'is_active' => true,
                    'sort_order' => $d['sort_order'],
                ]
            );
        }
    }
}
