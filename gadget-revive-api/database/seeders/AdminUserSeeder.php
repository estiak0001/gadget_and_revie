<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create Super Admin user
        $admin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@gadgetrevibe.com',
            'password' => Hash::make('Admin@123456'),
            'phone' => '+8801700000000',
            'role' => 'admin',
            'status' => 'active',
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        $admin->assignRole('admin');

        // Create a demo customer
        $customer = User::create([
            'name' => 'Demo Customer',
            'email' => 'customer@gadgetrevibe.com',
            'password' => Hash::make('Customer@123456'),
            'phone' => '+8801700000001',
            'role' => 'customer',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $customer->assignRole('customer');

        // Create a demo vendor
        $vendor = User::create([
            'name' => 'Demo Vendor',
            'email' => 'vendor@gadgetrevibe.com',
            'password' => Hash::make('Vendor@123456'),
            'phone' => '+8801700000002',
            'role' => 'vendor',
            'status' => 'active',
            'email_verified_at' => now(),
        ]);

        $vendor->assignRole('vendor');

        // Create vendor profile
        // First, get Dhaka division and district
        $dhakaDivision = \App\Models\Division::where('name', 'Dhaka')->first();
        $dhakaDistrict = \App\Models\District::where('name', 'Dhaka')->first();
        $gulshanArea = \App\Models\Area::where('name', 'Gulshan')->first();

        if ($dhakaDivision && $dhakaDistrict) {
            \App\Models\VendorProfile::create([
                'user_id' => $vendor->id,
                'business_name' => 'Demo Repair Shop',
                'slug' => 'demo-repair-shop',
                'owner_name' => 'Demo Vendor',
                'description' => 'Professional gadget repair services with certified technicians and quality spare parts.',
                'address' => 'House 123, Road 10, Gulshan-1',
                'division_id' => $dhakaDivision->id,
                'district_id' => $dhakaDistrict->id,
                'area_id' => $gulshanArea?->id,
                'status' => 'approved',
                'approved_at' => now(),
                'bkash_number' => '01700000003',
                'is_featured' => true,
            ]);
        }
    }
}
