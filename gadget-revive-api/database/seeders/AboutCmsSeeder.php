<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;

class AboutCmsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // ── Hero Section ─────────────────────────────────────────────────
            [
                'key'         => 'about_hero',
                'value'       => json_encode([
                    'badge_icon'  => 'CpuChipIcon',
                    'badge_text'  => 'Your Trusted Tech Partner',
                    'title'       => 'About Gadget Revive',
                    'subtitle'    => 'Professional data recovery, PC repair services, and quality computer parts — all under one roof',
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Hero Section',
                'description' => 'About page hero: badge icon name (Heroicon), badge text, h1 title, subtitle',
                'is_public'   => true,
            ],

            // ── Services / What We Do ─────────────────────────────────────────
            [
                'key'         => 'about_services',
                'value'       => json_encode([
                    'items' => [
                        [
                            'icon'        => 'CircleStackIcon',
                            'title'       => 'Data Recovery',
                            'description' => 'Advanced recovery from crashed drives, corrupted storage, and deleted files.',
                        ],
                        [
                            'icon'        => 'ComputerDesktopIcon',
                            'title'       => 'PC Repair & Service',
                            'description' => 'Hardware diagnostics, component replacement, and system optimization.',
                        ],
                        [
                            'icon'        => 'CpuChipIcon',
                            'title'       => 'Computer Parts',
                            'description' => 'Genuine components - CPUs, GPUs, RAM, SSDs, motherboards, and more.',
                        ],
                        [
                            'icon'        => 'CubeIcon',
                            'title'       => 'Accessories & Products',
                            'description' => 'Peripherals, cables, cooling systems, and PC building essentials.',
                        ],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Services (What We Do)',
                'description' => 'Floating card grid shown below hero: each item has icon (Heroicon name), title, description',
                'is_public'   => true,
            ],

            // ── Story Section ─────────────────────────────────────────────────
            [
                'key'         => 'about_story',
                'value'       => json_encode([
                    'badge_icon'  => 'RocketLaunchIcon',
                    'badge_text'  => 'Who We Are',
                    'heading'     => 'A New Standard in Computer Services',
                    'paragraphs'  => [
                        'Gadget Revive is your one-stop destination for all computer-related needs. We specialize in <strong>professional data recovery</strong>, bringing back your valuable files from crashed hard drives, corrupted SSDs, and damaged storage devices.',
                        'Our <strong>PC repair services</strong> cover everything from hardware diagnostics and component upgrades to complete system builds. Whether you need a simple RAM upgrade or a complex motherboard replacement, our skilled technicians have you covered.',
                        'We also stock a wide range of <strong>genuine computer parts and accessories</strong> — processors, graphics cards, storage drives, peripherals, and more. Quality products, competitive prices, and expert advice.',
                    ],
                    'highlights'  => [
                        ['icon' => 'CheckBadgeIcon', 'text' => 'Certified Technicians', 'dark' => false],
                        ['icon' => 'ShieldCheckIcon', 'text' => 'Genuine Parts',         'dark' => true],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Story Section (left column)',
                'description' => 'Who We Are story: badge icon/text, heading, paragraphs (HTML allowed), highlight badges',
                'is_public'   => true,
            ],

            // ── Stats Grid ────────────────────────────────────────────────────
            [
                'key'         => 'about_stats',
                'value'       => json_encode([
                    'items' => [
                        ['icon' => 'CircleStackIcon',    'value' => '95%+',   'label' => 'Data Recovery Success', 'dark' => false],
                        ['icon' => 'ComputerDesktopIcon','value' => '24-72h', 'label' => 'Avg. Repair Time',      'dark' => true],
                        ['icon' => 'CpuChipIcon',        'value' => '500+',   'label' => 'Products in Stock',     'dark' => true],
                        ['icon' => 'UserGroupIcon',      'value' => 'Expert', 'label' => 'Tech Support',          'dark' => false],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Stats Grid (right column)',
                'description' => '2×2 stats grid next to the story text: icon (Heroicon name), value, label, dark (black background)',
                'is_public'   => true,
            ],

            // ── Values Section ────────────────────────────────────────────────
            [
                'key'         => 'about_values',
                'value'       => json_encode([
                    'title'    => 'Why Choose Gadget Revive',
                    'subtitle' => 'Your data and devices are in expert hands',
                    'items'    => [
                        [
                            'icon'        => 'ShieldCheckIcon',
                            'title'       => 'Genuine Parts Only',
                            'description' => 'We source authentic components directly from trusted manufacturers.',
                        ],
                        [
                            'icon'        => 'ClockIcon',
                            'title'       => 'Quick Service',
                            'description' => 'Most repairs and data recovery completed within 24-72 hours.',
                        ],
                        [
                            'icon'        => 'SparklesIcon',
                            'title'       => 'Honest Pricing',
                            'description' => 'Transparent quotes with no hidden charges. Pay only for what you need.',
                        ],
                        [
                            'icon'        => 'CheckBadgeIcon',
                            'title'       => 'Service Warranty',
                            'description' => 'All services backed by warranty. Your satisfaction is guaranteed.',
                        ],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Values Section',
                'description' => 'Why Choose Us section: title, subtitle, 4 value cards each with icon (Heroicon name), title, description',
                'is_public'   => true,
            ],

            // ── Mission ───────────────────────────────────────────────────────
            [
                'key'         => 'about_mission',
                'value'       => json_encode([
                    'icon'  => 'TrophyIcon',
                    'title' => 'Our Mission',
                    'text'  => 'To provide professional data recovery and computer repair services that protect your valuable data and keep your systems running at peak performance. We combine technical expertise with genuine parts to deliver reliable solutions.',
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Mission Card',
                'description' => 'Dark mission card: icon (Heroicon name), title, body text',
                'is_public'   => true,
            ],

            // ── Vision ────────────────────────────────────────────────────────
            [
                'key'         => 'about_vision',
                'value'       => json_encode([
                    'icon'  => 'RocketLaunchIcon',
                    'title' => 'Our Vision',
                    'text'  => 'To be the most trusted name in computer services — where customers know their data is safe, their devices are in expert hands, and they\'re getting the best parts available.',
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Vision Card',
                'description' => 'Light vision card: icon (Heroicon name), title, body text',
                'is_public'   => true,
            ],

            // ── Team Section ──────────────────────────────────────────────────
            [
                'key'         => 'about_team',
                'value'       => json_encode([
                    'title'    => 'Our Expert Team',
                    'subtitle' => 'Skilled professionals ready to solve your tech challenges',
                    'members'  => [
                        ['name' => 'Tech Expert',   'role' => 'Data Recovery Specialist', 'initials' => 'DR'],
                        ['name' => 'Hardware Pro',  'role' => 'PC Service Engineer',       'initials' => 'PC'],
                        ['name' => 'Parts Advisor', 'role' => 'Product Specialist',        'initials' => 'PS'],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'Team Section',
                'description' => 'Team section: title, subtitle, members array (name, role, initials)',
                'is_public'   => true,
            ],

            // ── CTA Section ───────────────────────────────────────────────────
            [
                'key'         => 'about_cta',
                'value'       => json_encode([
                    'title'   => 'Need Data Recovery or PC Service?',
                    'text'    => 'Get in touch for a free consultation. We\'ll diagnose your issue and provide a transparent quote — no obligation.',
                    'buttons' => [
                        ['icon' => 'CircleStackIcon',       'label' => 'Data Recovery', 'href' => '/data-recovery', 'variant' => 'light'],
                        ['icon' => 'WrenchScrewdriverIcon', 'label' => 'PC Services',   'href' => '/services',       'variant' => 'dark'],
                        ['icon' => 'CpuChipIcon',           'label' => 'Shop Parts',    'href' => '/products',       'variant' => 'outline'],
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'about',
                'label'       => 'CTA Section',
                'description' => 'Bottom CTA: title, text, buttons array (icon Heroicon name, label, href, variant: light|dark|outline)',
                'is_public'   => true,
            ],
        ];

        foreach ($settings as $setting) {
            SiteSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }

        $this->command->info('About page CMS settings seeded successfully.');
    }
}
