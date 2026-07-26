<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;

class DataRecoveryCmsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // ── Hero Section ─────────────────────────────────────────────────
            [
                'key'         => 'dr_hero',
                'value'       => json_encode([
                    'badge_text'    => '98% Success Rate • No Data, No Fee',
                    'title_line1'   => 'Lost Your Data?',
                    'title_line2'   => 'We Can Recover It!',
                    'description'   => 'Professional data recovery services in Dhaka, Bangladesh. From damaged hard drives to deleted files - we recover what matters most to you.',
                    'stats'         => [
                        ['value' => '98%',  'label' => 'Success Rate'],
                        ['value' => '24h',  'label' => 'Free Diagnosis'],
                        ['value' => '10K+', 'label' => 'Recovered Devices'],
                        ['value' => '100%', 'label' => 'Confidential'],
                    ],
                    'cta1_text'      => 'Get Free Diagnosis',
                    'cta1_link'      => '#services',
                    'phone_number'   => '+880 1711-123456',
                    'phone_display'  => 'Emergency: +880 1711-123456',
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Hero Section',
                'description' => 'Data Recovery page hero content: badge, titles, description, stats, CTAs',
                'is_public'   => true,
            ],

            // ── Data Loss Scenarios Section ───────────────────────────────────
            [
                'key'         => 'dr_loss_scenarios',
                'value'       => json_encode([
                    'title'       => '💾 What Data Loss Situations Do We Handle?',
                    'description' => 'No matter how you lost your data, we have the expertise to recover it',
                    'items'       => [
                        ['scenario' => 'Accidental Deletion',  'icon' => '🗑️', 'recoverable' => true],
                        ['scenario' => 'Formatted Drive',       'icon' => '💾', 'recoverable' => true],
                        ['scenario' => 'Water Damage',          'icon' => '💧', 'recoverable' => true],
                        ['scenario' => 'Physical Damage',       'icon' => '🔨', 'recoverable' => true],
                        ['scenario' => 'Virus/Malware Attack',  'icon' => '🦠', 'recoverable' => true],
                        ['scenario' => 'Power Failure',         'icon' => '⚡', 'recoverable' => true],
                        ['scenario' => 'Corrupted Files',       'icon' => '📁', 'recoverable' => true],
                        ['scenario' => 'System Crash',          'icon' => '💥', 'recoverable' => true],
                        ['scenario' => 'Overwritten Data',      'icon' => '🔄', 'recoverable' => true],
                        ['scenario' => 'Partition Loss',        'icon' => '💿', 'recoverable' => true],
                        ['scenario' => 'Bad Sectors',           'icon' => '🔴', 'recoverable' => true],
                        ['scenario' => 'Firmware Failure',      'icon' => '⚙️', 'recoverable' => true],
                        ['scenario' => 'Fire Damage',           'icon' => '🔥', 'recoverable' => true],
                        ['scenario' => 'Mechanical Failure',    'icon' => '🔧', 'recoverable' => true],
                        ['scenario' => 'Dropped Device',        'icon' => '📱', 'recoverable' => true],
                        ['scenario' => 'Ransomware Attack',     'icon' => '🔒', 'recoverable' => true],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Data Loss Scenarios Section',
                'description' => 'Section title, description and list of data loss scenarios with emoji icons',
                'is_public'   => true,
            ],

            // ── Specialized Recovery Services (Features) ──────────────────────
            [
                'key'         => 'dr_features',
                'value'       => json_encode([
                    'label'       => '🔧 Specialized Recovery Services',
                    'title'       => 'We Recover Data From All Types of Devices',
                    'description' => 'Advanced tools, expert technicians, and clean room facilities',
                    'items'       => [
                        ['name' => 'Hard Drive Recovery',     'icon' => 'ServerIcon',           'description' => 'Mechanical & logical failures',   'successRate' => '95%'],
                        ['name' => 'SSD Data Recovery',       'icon' => 'CircleStackIcon',      'description' => 'Solid state drive recovery',      'successRate' => '92%'],
                        ['name' => 'Mobile Device Recovery',  'icon' => 'DevicePhoneMobileIcon','description' => 'Android & iOS devices',           'successRate' => '98%'],
                        ['name' => 'Memory Card Recovery',    'icon' => 'CpuChipIcon',          'description' => 'SD, microSD, CF cards',           'successRate' => '96%'],
                        ['name' => 'RAID Array Recovery',     'icon' => 'ServerIcon',           'description' => 'Complex RAID systems',            'successRate' => '90%'],
                        ['name' => 'USB Drive Recovery',      'icon' => 'CircleStackIcon',      'description' => 'Flash drives & pen drives',       'successRate' => '94%'],
                        ['name' => 'Email Recovery',          'icon' => 'DocumentTextIcon',     'description' => 'Lost emails & archives',          'successRate' => '99%'],
                        ['name' => 'Database Recovery',       'icon' => 'CloudArrowUpIcon',     'description' => 'SQL, MySQL, Oracle',              'successRate' => '93%'],
                        ['name' => 'Laptop/Desktop Recovery', 'icon' => 'ComputerDesktopIcon',  'description' => 'Complete system recovery',        'successRate' => '96%'],
                        ['name' => 'External Hard Drive',     'icon' => 'CircleStackIcon',      'description' => 'Portable drives recovery',        'successRate' => '95%'],
                        ['name' => 'NAS Recovery',            'icon' => 'ServerIcon',           'description' => 'Network Attached Storage',        'successRate' => '91%'],
                        ['name' => 'Tablet Recovery',         'icon' => 'DevicePhoneMobileIcon','description' => 'iPad & Android tablets',          'successRate' => '97%'],
                        ['name' => 'Camera/DSLR Recovery',    'icon' => 'CpuChipIcon',          'description' => 'Professional camera data',        'successRate' => '96%'],
                        ['name' => 'DVR/CCTV Recovery',       'icon' => 'ServerIcon',           'description' => 'Security footage recovery',       'successRate' => '89%'],
                        ['name' => 'Virtual Machine Recovery','icon' => 'CloudArrowUpIcon',     'description' => 'VM data files recovery',          'successRate' => '94%'],
                        ['name' => 'Server Recovery',         'icon' => 'ServerIcon',           'description' => 'Enterprise server data',          'successRate' => '92%'],
                        ['name' => 'Game Console Recovery',   'icon' => 'CpuChipIcon',          'description' => 'PS5, Xbox, Switch data',          'successRate' => '88%'],
                        ['name' => 'Cloud Data Recovery',     'icon' => 'CloudArrowUpIcon',     'description' => 'Deleted cloud files',             'successRate' => '97%'],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Specialized Recovery Services (Features)',
                'description' => 'Section heading and grid of device recovery types with Heroicon names and success rates',
                'is_public'   => true,
            ],

            // ── Emergency Alert Banner ─────────────────────────────────────────
            [
                'key'         => 'dr_emergency_alert',
                'value'       => json_encode([
                    'title'       => '⚠️ CRITICAL: Stop Using Your Device Immediately!',
                    'description' => 'Continued use can permanently damage your data. Power off your device and contact us right away to maximize recovery chances.',
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Emergency Alert Banner',
                'description' => 'The dark warning banner shown between Features and Services sections',
                'is_public'   => true,
            ],

            // ── Services / Pricing Section ────────────────────────────────────
            [
                'key'         => 'dr_services_section',
                'value'       => json_encode([
                    'title'          => '💰 Transparent Pricing',
                    'description'    => 'No hidden fees. Pay only if we successfully recover your data.',
                    'guarantee_badge'=> 'No Data, No Charge Guarantee',
                    'cta_text'       => 'Contact us for a personalized quote',
                    'cta_link'       => '/contact',
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Services / Pricing Section Header',
                'description' => 'Header text for the transparent pricing section (services are loaded from the services API)',
                'is_public'   => true,
            ],

            // ── Recovery Process Section ──────────────────────────────────────
            [
                'key'         => 'dr_process',
                'value'       => json_encode([
                    'badge_text'      => 'Simple 4-Step Process',
                    'title'           => 'How We Recover Your Data',
                    'description'     => "Clear, transparent process from diagnosis to delivery. You're informed at every step.",
                    'steps'           => [
                        [
                            'step'        => '1',
                            'title'       => 'Free Diagnosis',
                            'description' => 'Bring or ship your device to us. We perform a complete evaluation and provide a detailed report within 24 hours.',
                            'icon'        => 'DocumentTextIcon',
                            'color'       => 'from-blue-500 to-cyan-500',
                            'time'        => '24 hours',
                        ],
                        [
                            'step'        => '2',
                            'title'       => 'Quote Approval',
                            'description' => 'Review our transparent pricing and recovery success probability. No hidden fees - you decide if you want to proceed.',
                            'icon'        => 'CheckCircleIcon',
                            'color'       => 'from-purple-500 to-pink-500',
                            'time'        => 'Instant',
                        ],
                        [
                            'step'        => '3',
                            'title'       => 'Data Recovery',
                            'description' => 'Our expert technicians use advanced tools and clean room facilities to safely recover your data.',
                            'icon'        => 'CpuChipIcon',
                            'color'       => 'from-orange-500 to-red-500',
                            'time'        => '2-5 days',
                        ],
                        [
                            'step'        => '4',
                            'title'       => 'Verification & Delivery',
                            'description' => 'We verify all recovered data, provide a detailed report, and securely transfer your files to you.',
                            'icon'        => 'ShieldCheckIcon',
                            'color'       => 'from-green-500 to-emerald-500',
                            'time'        => '1 day',
                        ],
                    ],
                    'cta_heading'     => 'Ready to Start the Recovery Process?',
                    'cta_description' => 'Bring your device to any of our 5 locations in Dhaka or request a free pickup',
                    'cta_btn_text'    => 'View Services & Pricing',
                    'cta_btn_link'    => '#services',
                    'cta_phone_text'  => 'Call for Free Consultation',
                    'cta_phone'       => '+880 1711-123456',
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Recovery Process Section',
                'description' => 'Badge, title, description and 4 process steps with icons (Heroicon names) and colors',
                'is_public'   => true,
            ],

            // ── Guarantees Section ────────────────────────────────────────────
            [
                'key'         => 'dr_guarantees',
                'value'       => json_encode([
                    'title'       => '🛡️ Our Commitment to You',
                    'description' => "Your trust is our priority. Here's what makes us Bangladesh's #1 data recovery service.",
                    'items'       => [
                        [
                            'icon'        => 'ShieldCheckIcon',
                            'title'       => 'No Data, No Charge',
                            'description' => "If we can't recover your data, you pay absolutely nothing. That's our guarantee of confidence in our expertise.",
                        ],
                        [
                            'icon'        => 'LockClosedIcon',
                            'title'       => '100% Confidential',
                            'description' => 'Your data is handled with military-grade security. We sign NDAs and ensure complete privacy for all clients.',
                        ],
                        [
                            'icon'        => 'CheckCircleIcon',
                            'title'       => 'Free Diagnosis',
                            'description' => "Get a detailed evaluation within 24 hours. We'll tell you exactly what can be recovered before you commit.",
                        ],
                    ],
                    'why_title'       => 'Why Choose RecuvaPro?',
                    'why_description' => '10+ years of experience serving businesses and individuals across Bangladesh',
                    'benefits'        => [
                        ['emoji' => '⚡', 'title' => 'Fast Turnaround',  'description' => 'Most recoveries completed within 2-5 days'],
                        ['emoji' => '🏆', 'title' => 'Expert Team',      'description' => 'Certified technicians with 10+ years experience'],
                        ['emoji' => '🔬', 'title' => 'Clean Room Lab',   'description' => 'ISO-certified clean room for physical recovery'],
                        ['emoji' => '🚚', 'title' => 'Free Pickup',      'description' => 'Complimentary pickup & delivery in Dhaka'],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Guarantees Section',
                'description' => 'Section title, 3 guarantee cards (with Heroicon names), and the "Why Choose" block with benefits',
                'is_public'   => true,
            ],

            // ── FAQ Section Header ────────────────────────────────────────────
            [
                'key'         => 'dr_faq_section',
                'value'       => json_encode([
                    'title'       => '❓ Frequently Asked Questions',
                    'description' => 'Everything you need to know about our data recovery service',
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'FAQ Section Header',
                'description' => 'Title and description for the FAQ section (FAQs themselves are managed via the FAQs module)',
                'is_public'   => true,
            ],

            // ── CTA Section ───────────────────────────────────────────────────
            [
                'key'         => 'dr_cta',
                'value'       => json_encode([
                    'badge_text'       => '24/7 Emergency Service Available',
                    'title'            => "🚨 Lost Critical Data?\nWe're Here to Help!",
                    'description'      => "Don't panic! Our expert team is ready to recover your important files. Contact us now for immediate assistance and free diagnosis.",
                    'phone'            => '+880 1711-123456',
                    'phone_display'    => '+880 1711-123456',
                    'phone_label'      => 'Call Now',
                    'link_text'        => 'Visit Our Centers',
                    'link_href'        => '/contact',
                    'trust_indicators' => [
                        'Free Diagnosis',
                        'No Data, No Fee',
                        'Same Day Pickup',
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'data_recovery',
                'label'       => 'Bottom CTA Section',
                'description' => 'Final call-to-action section: badge, title, description, phone, link button and trust indicators',
                'is_public'   => true,
            ],
        ];

        foreach ($settings as $setting) {
            SiteSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }

        $this->command->info('Data Recovery CMS settings seeded successfully.');
    }
}
