<?php

namespace Database\Seeders;

use App\Models\Banner;
use Illuminate\Database\Seeder;

class BannerSeeder extends Seeder
{
    public function run(): void
    {
        // ── Homepage Slider Banners ───────────────────────────────────────────
        // These are the main carousel slides on the homepage.
        // Images can be uploaded via Admin → CMS → Banners after seeding.
        $sliders = [
            [
                'title'      => 'Professional Device Repair',
                'subtitle'   => 'Expert technicians for all your gadget needs',
                'link_url'   => '/services',
                'link_text'  => 'Book a Repair',
                'position'   => 'homepage_slider',
                'sort_order' => 1,
                'is_active'  => true,
                'image'      => null,
                'meta'       => ['gradient_from' => 'blue-600', 'gradient_to' => 'indigo-600'],
            ],
            [
                'title'      => 'Data Recovery Specialists',
                'subtitle'   => '98% success rate — HDD, SSD & RAID systems',
                'link_url'   => '/services',
                'link_text'  => 'Start Recovery',
                'position'   => 'homepage_slider',
                'sort_order' => 2,
                'is_active'  => true,
                'image'      => null,
                'meta'       => ['gradient_from' => 'orange-500', 'gradient_to' => 'red-500'],
            ],
            [
                'title'      => 'Genuine Spare Parts',
                'subtitle'   => '500+ products with warranty — fast delivery',
                'link_url'   => '/products',
                'link_text'  => 'Shop Now',
                'position'   => 'homepage_slider',
                'sort_order' => 3,
                'is_active'  => true,
                'image'      => null,
                'meta'       => ['gradient_from' => 'green-500', 'gradient_to' => 'teal-600'],
            ],
        ];

        // ── Homepage Side Banners ─────────────────────────────────────────────
        // These appear on the right side of the homepage carousel.
        $sideBanners = [
            [
                'title'      => 'Free Diagnosis',
                'subtitle'   => 'Walk in anytime',
                'link_url'   => '/services',
                'link_text'  => null,
                'position'   => 'homepage_banner',
                'sort_order' => 1,
                'is_active'  => true,
                'image'      => null,
                'meta'       => ['gradient_from' => 'emerald-500', 'gradient_to' => 'teal-600', 'icon' => '🔬'],
            ],
            [
                'title'      => 'Same Day Repair',
                'subtitle'   => 'Most repairs done in 24hrs',
                'link_url'   => '/services',
                'link_text'  => null,
                'position'   => 'homepage_banner',
                'sort_order' => 2,
                'is_active'  => true,
                'image'      => null,
                'meta'       => ['gradient_from' => 'purple-500', 'gradient_to' => 'pink-500', 'icon' => '⚡'],
            ],
        ];

        foreach ([...$sliders, ...$sideBanners] as $data) {
            Banner::updateOrCreate(
                ['title' => $data['title'], 'position' => $data['position']],
                $data,
            );
        }

        $this->command->info('Banners seeded successfully.');
    }
}
