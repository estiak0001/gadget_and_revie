<?php

namespace Database\Seeders;

use App\Models\ProductCategory;
use App\Models\ServiceCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Service Categories
        $serviceCategories = [
            [
                'name' => 'Mobile Phone Repair',
                'icon' => 'smartphone',
                'description' => 'All types of mobile phone repair services including screen replacement, battery, and software issues',
                'children' => [
                    ['name' => 'Screen Repair', 'icon' => 'screen', 'description' => 'Display and touch screen repairs'],
                    ['name' => 'Battery Replacement', 'icon' => 'battery', 'description' => 'Battery replacement services'],
                    ['name' => 'Charging Port Repair', 'icon' => 'plug', 'description' => 'Charging port and cable issues'],
                    ['name' => 'Software Issues', 'icon' => 'software', 'description' => 'OS updates, app issues, and software fixes'],
                    ['name' => 'Water Damage', 'icon' => 'water', 'description' => 'Water damage repair and recovery'],
                ],
            ],
            [
                'name' => 'Laptop & Computer Repair',
                'icon' => 'laptop',
                'description' => 'Laptop and desktop computer repair services',
                'children' => [
                    ['name' => 'Screen Replacement', 'icon' => 'monitor', 'description' => 'Laptop screen repairs'],
                    ['name' => 'Keyboard Repair', 'icon' => 'keyboard', 'description' => 'Keyboard replacement and repair'],
                    ['name' => 'Hardware Upgrade', 'icon' => 'cpu', 'description' => 'RAM, SSD, and hardware upgrades'],
                    ['name' => 'Virus Removal', 'icon' => 'shield', 'description' => 'Malware and virus removal'],
                    ['name' => 'Data Recovery', 'icon' => 'database', 'description' => 'Data recovery services'],
                ],
            ],
            [
                'name' => 'Tablet Repair',
                'icon' => 'tablet',
                'description' => 'iPad and Android tablet repair services',
                'children' => [
                    ['name' => 'Screen Repair', 'icon' => 'screen', 'description' => 'Tablet screen repairs'],
                    ['name' => 'Battery Replacement', 'icon' => 'battery', 'description' => 'Tablet battery services'],
                    ['name' => 'Button Repair', 'icon' => 'button', 'description' => 'Home and power button repairs'],
                ],
            ],
            [
                'name' => 'Smartwatch Repair',
                'icon' => 'watch',
                'description' => 'Smart watch and fitness tracker repairs',
                'children' => [
                    ['name' => 'Screen Replacement', 'icon' => 'screen', 'description' => 'Watch display repairs'],
                    ['name' => 'Battery Replacement', 'icon' => 'battery', 'description' => 'Watch battery services'],
                    ['name' => 'Band Replacement', 'icon' => 'band', 'description' => 'Watch band and strap services'],
                ],
            ],
            [
                'name' => 'Gaming Console Repair',
                'icon' => 'gamepad',
                'description' => 'PlayStation, Xbox, and Nintendo console repairs',
                'children' => [
                    ['name' => 'Hardware Repair', 'icon' => 'tool', 'description' => 'Console hardware issues'],
                    ['name' => 'Controller Repair', 'icon' => 'controller', 'description' => 'Game controller repairs'],
                    ['name' => 'Cleaning Service', 'icon' => 'clean', 'description' => 'Console cleaning and maintenance'],
                ],
            ],
            [
                'name' => 'Audio Equipment Repair',
                'icon' => 'headphones',
                'description' => 'Headphones, speakers, and audio device repairs',
                'children' => [
                    ['name' => 'Headphone Repair', 'icon' => 'headphones', 'description' => 'Headphone and earphone repairs'],
                    ['name' => 'Speaker Repair', 'icon' => 'speaker', 'description' => 'Bluetooth and wired speaker repairs'],
                ],
            ],
            [
                'name' => 'Camera Repair',
                'icon' => 'camera',
                'description' => 'Digital camera and lens repair services',
                'children' => [
                    ['name' => 'DSLR Repair', 'icon' => 'camera', 'description' => 'DSLR camera repairs'],
                    ['name' => 'Lens Repair', 'icon' => 'lens', 'description' => 'Camera lens services'],
                    ['name' => 'Sensor Cleaning', 'icon' => 'clean', 'description' => 'Sensor and CCD cleaning'],
                ],
            ],
            [
                'name' => 'Drone Repair',
                'icon' => 'drone',
                'description' => 'Drone and quadcopter repair services',
                'children' => [
                    ['name' => 'Motor Replacement', 'icon' => 'motor', 'description' => 'Drone motor repairs'],
                    ['name' => 'Camera Repair', 'icon' => 'camera', 'description' => 'Drone camera repairs'],
                    ['name' => 'Propeller Replacement', 'icon' => 'propeller', 'description' => 'Propeller services'],
                ],
            ],
        ];

        $sortOrder = 1;
        foreach ($serviceCategories as $category) {
            $parent = ServiceCategory::create([
                'name' => $category['name'],
                'slug' => Str::slug($category['name']),
                'description' => $category['description'],
                'icon' => $category['icon'],
                'is_active' => true,
                'sort_order' => $sortOrder++,
            ]);

            if (isset($category['children'])) {
                $childOrder = 1;
                foreach ($category['children'] as $child) {
                    ServiceCategory::create([
                        'parent_id' => $parent->id,
                        'name' => $child['name'],
                        'slug' => Str::slug($parent->name . '-' . $child['name']),
                        'description' => $child['description'],
                        'icon' => $child['icon'],
                        'is_active' => true,
                        'sort_order' => $childOrder++,
                    ]);
                }
            }
        }

        // Product Categories
        $productCategories = [
            [
                'name' => 'Mobile Accessories',
                'icon' => 'phone-accessories',
                'description' => 'Mobile phone accessories and parts',
                'children' => [
                    ['name' => 'Screen Protectors', 'icon' => 'protector', 'description' => 'Tempered glass and screen protectors'],
                    ['name' => 'Cases & Covers', 'icon' => 'case', 'description' => 'Phone cases and protective covers'],
                    ['name' => 'Chargers & Cables', 'icon' => 'charger', 'description' => 'Charging accessories'],
                    ['name' => 'Batteries', 'icon' => 'battery', 'description' => 'Replacement batteries'],
                    ['name' => 'Earphones & Headsets', 'icon' => 'headphones', 'description' => 'Audio accessories'],
                ],
            ],
            [
                'name' => 'Laptop Accessories',
                'icon' => 'laptop-accessories',
                'description' => 'Laptop accessories and components',
                'children' => [
                    ['name' => 'Laptop Bags', 'icon' => 'bag', 'description' => 'Laptop bags and sleeves'],
                    ['name' => 'Keyboards', 'icon' => 'keyboard', 'description' => 'External keyboards'],
                    ['name' => 'Mouse & Trackpads', 'icon' => 'mouse', 'description' => 'Mouse and pointing devices'],
                    ['name' => 'Chargers & Adapters', 'icon' => 'charger', 'description' => 'Power adapters'],
                    ['name' => 'RAM & Storage', 'icon' => 'memory', 'description' => 'Memory and storage upgrades'],
                ],
            ],
            [
                'name' => 'Spare Parts',
                'icon' => 'parts',
                'description' => 'Replacement parts for various devices',
                'children' => [
                    ['name' => 'Mobile Parts', 'icon' => 'mobile-parts', 'description' => 'Mobile phone spare parts'],
                    ['name' => 'Laptop Parts', 'icon' => 'laptop-parts', 'description' => 'Laptop spare parts'],
                    ['name' => 'Tablet Parts', 'icon' => 'tablet-parts', 'description' => 'Tablet spare parts'],
                    ['name' => 'Gaming Parts', 'icon' => 'gaming-parts', 'description' => 'Gaming console parts'],
                ],
            ],
            [
                'name' => 'Tools & Equipment',
                'icon' => 'tools',
                'description' => 'Repair tools and equipment',
                'children' => [
                    ['name' => 'Screwdriver Sets', 'icon' => 'screwdriver', 'description' => 'Precision screwdriver sets'],
                    ['name' => 'Opening Tools', 'icon' => 'opener', 'description' => 'Pry tools and openers'],
                    ['name' => 'Soldering Equipment', 'icon' => 'solder', 'description' => 'Soldering stations and accessories'],
                    ['name' => 'Testing Equipment', 'icon' => 'test', 'description' => 'Multimeters and testing tools'],
                ],
            ],
            [
                'name' => 'Refurbished Devices',
                'icon' => 'refurbished',
                'description' => 'Certified refurbished electronics',
                'children' => [
                    ['name' => 'Refurbished Phones', 'icon' => 'phone', 'description' => 'Refurbished mobile phones'],
                    ['name' => 'Refurbished Laptops', 'icon' => 'laptop', 'description' => 'Refurbished laptops'],
                    ['name' => 'Refurbished Tablets', 'icon' => 'tablet', 'description' => 'Refurbished tablets'],
                ],
            ],
        ];

        $sortOrder = 1;
        foreach ($productCategories as $category) {
            $parent = ProductCategory::create([
                'name' => $category['name'],
                'slug' => Str::slug($category['name']),
                'description' => $category['description'],
                'icon' => $category['icon'],
                'is_active' => true,
                'sort_order' => $sortOrder++,
            ]);

            if (isset($category['children'])) {
                $childOrder = 1;
                foreach ($category['children'] as $child) {
                    ProductCategory::create([
                        'parent_id' => $parent->id,
                        'name' => $child['name'],
                        'slug' => Str::slug($parent->name . '-' . $child['name']),
                        'description' => $child['description'],
                        'icon' => $child['icon'],
                        'is_active' => true,
                        'sort_order' => $childOrder++,
                    ]);
                }
            }
        }
    }
}
