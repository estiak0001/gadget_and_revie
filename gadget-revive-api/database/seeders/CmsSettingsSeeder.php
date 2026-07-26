<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;

class CmsSettingsSeeder extends Seeder
{
    public function run(): void
    {
        // ── Topbar Settings ──────────────────────────────────────────────────
        $topbarSettings = [
            [
                'key'         => 'topbar_phone',
                'value'       => '+880 1711-123456',
                'type'        => 'text',
                'group'       => 'topbar',
                'label'       => 'Phone Number',
                'description' => 'Phone number shown in the top bar',
                'is_public'   => true,
            ],
            [
                'key'         => 'topbar_email',
                'value'       => 'support@gadgetrevive.com',
                'type'        => 'text',
                'group'       => 'topbar',
                'label'       => 'Email Address',
                'description' => 'Email address shown in the top bar',
                'is_public'   => true,
            ],
            [
                'key'         => 'topbar_address',
                'value'       => 'Dhanmondi, Dhaka',
                'type'        => 'text',
                'group'       => 'topbar',
                'label'       => 'Address',
                'description' => 'Short address shown in the top bar',
                'is_public'   => true,
            ],
            [
                'key'         => 'topbar_hours',
                'value'       => 'Sat-Thu: 10AM-8PM',
                'type'        => 'text',
                'group'       => 'topbar',
                'label'       => 'Business Hours',
                'description' => 'Business hours shown in the top bar',
                'is_public'   => true,
            ],
            [
                'key'         => 'topbar_promo_text',
                'value'       => 'Free Diagnosis',
                'type'        => 'text',
                'group'       => 'topbar',
                'label'       => 'Promo Badge Text',
                'description' => 'Text displayed in the green promo badge on the top bar',
                'is_public'   => true,
            ],
        ];

        // ── Homepage Settings ────────────────────────────────────────────────
        $homepageSettings = [
            [
                'key'         => 'news_ticker_items',
                'value'       => json_encode([
                    'Wednesday, 25 February, all our branches are open. Additionally, our online activities are running as usual.',
                    '🎉 Special Offer: 15% OFF on first-time data recovery service!',
                    '📍 Now serving in Gulshan, Banani, Dhanmondi, Uttara & Mirpur',
                    '✅ 100% Genuine Parts with Warranty - No Compromise on Quality',
                ]),
                'type'        => 'json',
                'group'       => 'homepage',
                'label'       => 'News Ticker Items',
                'description' => 'Array of text items displayed in the scrolling news ticker',
                'is_public'   => true,
            ],
            [
                'key'         => 'homepage_service_cards',
                'value'       => json_encode([
                    [
                        'badge'       => '🔥 Priority',
                        'title'       => 'Data Recovery',
                        'description' => 'Professional data recovery from damaged drives, SSDs, RAID systems with 98% success rate.',
                        'features'    => ['HDD & SSD Recovery', 'RAID Systems', 'Emergency 24-48hrs'],
                        'stat1_value' => '98%',
                        'stat1_label' => 'Success',
                        'stat2_value' => '$199+',
                        'stat2_label' => 'From',
                        'cta_text'    => 'Start Recovery',
                        'cta_link'    => '/services',
                    ],
                    [
                        'badge'       => '⚡ Fast',
                        'title'       => 'Repair Services',
                        'description' => 'Expert hardware repair for laptops, desktops, mobiles with certified technicians and warranty.',
                        'features'    => ['Hardware Repair', 'Software Solutions', 'Performance Boost'],
                        'stat1_value' => '15K+',
                        'stat1_label' => 'Repaired',
                        'stat2_value' => '$69+',
                        'stat2_label' => 'From',
                        'cta_text'    => 'Book Repair',
                        'cta_link'    => '/services',
                    ],
                    [
                        'badge'       => '✓ Genuine',
                        'title'       => 'Mobile Parts',
                        'description' => 'Genuine spare parts and accessories for all mobile brands with warranty and fast shipping.',
                        'features'    => ['100% Genuine Parts', 'All Brands Available', 'Warranty Included'],
                        'stat1_value' => '500+',
                        'stat1_label' => 'Products',
                        'stat2_value' => 'Fast',
                        'stat2_label' => 'Delivery',
                        'cta_text'    => 'Shop Parts',
                        'cta_link'    => '/products',
                    ],
                ]),
                'type'        => 'json',
                'group'       => 'homepage',
                'label'       => 'Service Cards',
                'description' => 'Three core service cards shown in the hero section',
                'is_public'   => true,
            ],
        ];

        // ── CTA Section Settings ─────────────────────────────────────────────
        $ctaSettings = [
            [
                'key'         => 'cta_badge_text',
                'value'       => 'Professional Repair Services',
                'type'        => 'text',
                'group'       => 'homepage',
                'label'       => 'CTA Badge Text',
                'description' => 'Small badge label above the CTA section heading',
                'is_public'   => true,
            ],
            [
                'key'         => 'cta_title',
                'value'       => 'Ready to Fix Your Device?',
                'type'        => 'text',
                'group'       => 'homepage',
                'label'       => 'CTA Section Title',
                'description' => 'Main heading of the call-to-action section',
                'is_public'   => true,
            ],
            [
                'key'         => 'cta_description',
                'value'       => 'Get a free diagnosis and quote. Our expert technicians are standing by to help you with all your repair needs.',
                'type'        => 'textarea',
                'group'       => 'homepage',
                'label'       => 'CTA Section Description',
                'description' => 'Subtitle text below the CTA heading',
                'is_public'   => true,
            ],
            [
                'key'         => 'cta_primary_button_text',
                'value'       => 'Book Service',
                'type'        => 'text',
                'group'       => 'homepage',
                'label'       => 'CTA Primary Button Text',
                'description' => 'Text label on the primary CTA button',
                'is_public'   => true,
            ],
            [
                'key'         => 'cta_primary_button_link',
                'value'       => '/services',
                'type'        => 'text',
                'group'       => 'homepage',
                'label'       => 'CTA Primary Button Link',
                'description' => 'URL the primary CTA button points to',
                'is_public'   => true,
            ],
            [
                'key'         => 'cta_trust_indicators',
                'value'       => json_encode([
                    'Free Diagnosis',
                    '90-Day Warranty',
                    'Genuine Parts',
                    'Same Day Service',
                ]),
                'type'        => 'json',
                'group'       => 'homepage',
                'label'       => 'CTA Trust Indicators',
                'description' => 'List of trust badges shown below the CTA buttons',
                'is_public'   => true,
            ],
        ];

        // ── Footer Settings ──────────────────────────────────────────────────
        $footerSettings = [
            [
                'key'         => 'footer_brand_description',
                'value'       => 'Your trusted partner for data recovery, PC repairs, and genuine computer parts. Expert service you can count on.',
                'type'        => 'textarea',
                'group'       => 'footer',
                'label'       => 'Brand Description',
                'description' => 'Tagline shown below the logo in the footer',
                'is_public'   => true,
            ],
            [
                'key'         => 'footer_cta_tagline',
                'value'       => 'Need help with your device?',
                'type'        => 'text',
                'group'       => 'footer',
                'label'       => 'Footer CTA Tagline',
                'description' => 'Small text above the footer CTA button',
                'is_public'   => true,
            ],
            [
                'key'         => 'footer_cta_button_text',
                'value'       => 'Get in Touch',
                'type'        => 'text',
                'group'       => 'footer',
                'label'       => 'Footer CTA Button Text',
                'description' => 'Label on the footer call-to-action button',
                'is_public'   => true,
            ],
            [
                'key'         => 'footer_cta_button_link',
                'value'       => '/contact',
                'type'        => 'text',
                'group'       => 'footer',
                'label'       => 'Footer CTA Button Link',
                'description' => 'URL the footer CTA button links to',
                'is_public'   => true,
            ],
            [
                'key'         => 'footer_email',
                'value'       => 'info@gadgetrevive.com',
                'type'        => 'text',
                'group'       => 'footer',
                'label'       => 'Footer Email',
                'description' => 'Contact email shown in the footer',
                'is_public'   => true,
            ],
            [
                'key'         => 'footer_copyright',
                'value'       => '© 2026 Gadget Revive · Dhaka, Bangladesh',
                'type'        => 'text',
                'group'       => 'footer',
                'label'       => 'Copyright Text',
                'description' => 'Copyright line shown at the bottom of the footer',
                'is_public'   => true,
            ],
            [
                'key'         => 'footer_nav_links',
                'value'       => json_encode([
                    ['name' => 'About',     'href' => '/about'],
                    ['name' => 'Contact',   'href' => '/contact'],
                    ['name' => 'Locations', 'href' => '/locations'],
                    ['name' => 'Privacy',   'href' => '/privacy'],
                    ['name' => 'Terms',     'href' => '/terms'],
                    ['name' => 'Returns',   'href' => '/returns'],
                ]),
                'type'        => 'json',
                'group'       => 'footer',
                'label'       => 'Footer Navigation Links',
                'description' => 'Quick links shown in the footer middle row',
                'is_public'   => true,
            ],
        ];

        // ── Contact Page Settings ────────────────────────────────────────────
        $contactSettings = [
            [
                'key'         => 'contact_hero_title',
                'value'       => 'Get In Touch',
                'type'        => 'text',
                'group'       => 'contact',
                'label'       => 'Contact Hero Title',
                'description' => 'Main heading on the contact page hero section',
                'is_public'   => true,
            ],
            [
                'key'         => 'contact_hero_subtitle',
                'value'       => 'Have a question or need help? Our team is here to assist you 24/7.',
                'type'        => 'textarea',
                'group'       => 'contact',
                'label'       => 'Contact Hero Subtitle',
                'description' => 'Subtext below the contact page hero title',
                'is_public'   => true,
            ],
            [
                'key'         => 'contact_support_email',
                'value'       => 'support@gadgetrevive.com',
                'type'        => 'text',
                'group'       => 'contact',
                'label'       => 'Support Email',
                'description' => 'Email shown in the contact email card and form',
                'is_public'   => true,
            ],
            [
                'key'         => 'contact_subjects',
                'value'       => json_encode([
                    'General Inquiry',
                    'Mobile Repair',
                    'Data Recovery',
                    'Product Purchase',
                    'Warranty Claim',
                    'Technical Support',
                    'Business Partnership',
                ]),
                'type'        => 'json',
                'group'       => 'contact',
                'label'       => 'Contact Form Subject Options',
                'description' => 'Dropdown options for the contact form subject field',
                'is_public'   => true,
            ],
            [
                'key'         => 'contact_social_facebook',
                'value'       => '#',
                'type'        => 'text',
                'group'       => 'contact',
                'label'       => 'Facebook URL',
                'description' => 'Facebook page URL shown on contact page',
                'is_public'   => true,
            ],
            [
                'key'         => 'contact_social_instagram',
                'value'       => '#',
                'type'        => 'text',
                'group'       => 'contact',
                'label'       => 'Instagram URL',
                'description' => 'Instagram profile URL shown on contact page',
                'is_public'   => true,
            ],
            [
                'key'         => 'contact_social_whatsapp',
                'value'       => '#',
                'type'        => 'text',
                'group'       => 'contact',
                'label'       => 'WhatsApp URL',
                'description' => 'WhatsApp link shown on contact page',
                'is_public'   => true,
            ],
            [
                'key'         => 'contact_social_youtube',
                'value'       => '#',
                'type'        => 'text',
                'group'       => 'contact',
                'label'       => 'YouTube URL',
                'description' => 'YouTube channel URL shown on contact page',
                'is_public'   => true,
            ],
        ];

        foreach ([...$topbarSettings, ...$homepageSettings, ...$ctaSettings, ...$footerSettings, ...$contactSettings] as $setting) {
            SiteSetting::updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }

        $this->command->info('CMS settings seeded successfully.');
    }
}
