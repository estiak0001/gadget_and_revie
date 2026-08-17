<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;

class SiteSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            // General Settings
            ['key' => 'site_name', 'value' => 'Gadget Revibe', 'group' => 'general', 'is_public' => true],
            ['key' => 'site_tagline', 'value' => 'Your Trusted Repair Partner', 'group' => 'general', 'is_public' => true],
            ['key' => 'site_url', 'value' => 'www.gadgetandrevive.com', 'group' => 'general', 'is_public' => true],
            ['key' => 'site_description', 'value' => 'Professional gadget repair services and quality spare parts at your doorstep', 'group' => 'general', 'is_public' => true],
            ['key' => 'site_logo', 'value' => '/images/logo.png', 'group' => 'general', 'is_public' => true],
            ['key' => 'site_favicon', 'value' => '/images/favicon.ico', 'group' => 'general', 'is_public' => true],
            ['key' => 'currency', 'value' => 'BDT', 'group' => 'general', 'is_public' => true],
            ['key' => 'currency_symbol', 'value' => '৳', 'group' => 'general', 'is_public' => true],
            ['key' => 'timezone', 'value' => 'Asia/Dhaka', 'group' => 'general', 'is_public' => true],

            // Contact Settings
            ['key' => 'contact_email', 'value' => 'support@gadgetrevibe.com', 'group' => 'contact', 'is_public' => true],
            ['key' => 'contact_phone', 'value' => '+880 1XXX-XXXXXX', 'group' => 'contact', 'is_public' => true],
            ['key' => 'contact_address', 'value' => 'Dhaka, Bangladesh', 'group' => 'contact', 'is_public' => true],
            ['key' => 'support_hours', 'value' => 'Saturday - Thursday: 9:00 AM - 8:00 PM', 'group' => 'contact', 'is_public' => true],

            // Social Media
            ['key' => 'facebook_url', 'value' => 'https://facebook.com/gadgetrevibe', 'group' => 'social', 'is_public' => true],
            ['key' => 'instagram_url', 'value' => 'https://instagram.com/gadgetrevibe', 'group' => 'social', 'is_public' => true],
            ['key' => 'youtube_url', 'value' => 'https://youtube.com/@gadgetrevibe', 'group' => 'social', 'is_public' => true],
            ['key' => 'twitter_url', 'value' => '', 'group' => 'social', 'is_public' => true],
            ['key' => 'linkedin_url', 'value' => '', 'group' => 'social', 'is_public' => true],

            // Payment Settings
            ['key' => 'bkash_enabled', 'value' => 'true', 'group' => 'payment', 'is_public' => true],
            ['key' => 'nagad_enabled', 'value' => 'true', 'group' => 'payment', 'is_public' => true],
            ['key' => 'cash_enabled', 'value' => 'true', 'group' => 'payment', 'is_public' => true],
            ['key' => 'bank_transfer_enabled', 'value' => 'true', 'group' => 'payment', 'is_public' => true],
            ['key' => 'bkash_merchant_number', 'value' => '01XXXXXXXXX', 'group' => 'payment', 'is_public' => false],
            ['key' => 'nagad_merchant_number', 'value' => '01XXXXXXXXX', 'group' => 'payment', 'is_public' => false],
            ['key' => 'bank_account_details', 'value' => json_encode([
                'bank_name' => 'Bank Name',
                'account_name' => 'Gadget Revibe Ltd',
                'account_number' => 'XXXXXXXXXXXX',
                'branch' => 'Main Branch',
                'routing_number' => 'XXXXXXXXX',
            ]), 'group' => 'payment', 'is_public' => false],

            // Business Settings
            ['key' => 'vendor_commission_rate', 'value' => '10', 'group' => 'business', 'is_public' => false],
            ['key' => 'min_order_amount', 'value' => '100', 'group' => 'business', 'is_public' => true],
            ['key' => 'order_cancellation_hours', 'value' => '24', 'group' => 'business', 'is_public' => true],
            ['key' => 'review_edit_days', 'value' => '7', 'group' => 'business', 'is_public' => true],

            // SEO Settings
            ['key' => 'meta_title', 'value' => 'Gadget Revibe - Professional Gadget Repair Services', 'group' => 'seo', 'is_public' => true],
            ['key' => 'meta_description', 'value' => 'Get your gadgets repaired by certified professionals. Mobile phones, laptops, tablets, and more. Quality parts and affordable prices.', 'group' => 'seo', 'is_public' => true],
            ['key' => 'meta_keywords', 'value' => 'gadget repair, mobile repair, laptop repair, phone screen replacement, battery replacement, Bangladesh', 'group' => 'seo', 'is_public' => true],
            ['key' => 'google_analytics_id', 'value' => '', 'group' => 'seo', 'is_public' => false],
            ['key' => 'facebook_pixel_id', 'value' => '', 'group' => 'seo', 'is_public' => false],
            // Google Search Console's HTML-tag verification method — the content value of
            // <meta name="google-site-verification">. Not a secret (it ends up in page source
            // either way), kept public like the other SEO fields.
            ['key' => 'google_site_verification', 'value' => '', 'group' => 'seo', 'is_public' => true],

            // Email Settings
            ['key' => 'mail_from_name', 'value' => 'Gadget Revibe', 'group' => 'email', 'is_public' => false],
            ['key' => 'mail_from_address', 'value' => 'noreply@gadgetrevibe.com', 'group' => 'email', 'is_public' => false],

            // Feature Toggles
            ['key' => 'vendor_registration_enabled', 'value' => 'true', 'group' => 'features', 'is_public' => true],
            ['key' => 'customer_registration_enabled', 'value' => 'true', 'group' => 'features', 'is_public' => true],
            ['key' => 'review_moderation_enabled', 'value' => 'false', 'group' => 'features', 'is_public' => false],
            ['key' => 'maintenance_mode', 'value' => 'false', 'group' => 'features', 'is_public' => true],
            // OTP / Phone verification toggle (admin-controlled; default OFF for frictionless onboarding)
            ['key' => 'otp_verification_enabled', 'value' => 'false', 'type' => 'boolean', 'group' => 'features', 'label' => 'OTP Verification', 'description' => 'Require phone OTP verification on customer sign-up and login.', 'is_public' => true],
        ];

        foreach ($settings as $setting) {
            SiteSetting::create($setting);
        }
    }
}
