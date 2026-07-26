<?php

namespace Database\Seeders;

use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Fills out the live computer-repair service menu (Home Service, Desktop,
 * Laptop, Printer, Monitor, Data Recovery) with sub-categories and priced
 * services. Fully idempotent: matches on slug, so re-running only fills
 * gaps and never duplicates or touches existing rows.
 */
class ServiceCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $categoryImage = fn (string $family) => "categories/{$family}-photo.jpg";
        $serviceImage  = fn (string $family, string $tier) => "services/{$family}-photo.jpg";

        // [parent_slug, family, [ [name, slug, description, icon], ... ]]
        $subCategoryGroups = [
            'home-service' => [
                'family' => 'home-service',
                'icon' => 'home',
                'children' => [
                    ['name' => 'Home Visit - Desktop & Laptop', 'slug' => 'home-visit-desktop-laptop', 'description' => 'On-site diagnosis and repair for desktops and laptops at your home or office.'],
                    ['name' => 'Home Visit - Networking & WiFi', 'slug' => 'home-visit-networking-wifi', 'description' => 'Router, WiFi, and home/office network setup and troubleshooting.'],
                    ['name' => 'Home Visit - Printer Setup', 'slug' => 'home-visit-printer-setup', 'description' => 'On-site printer installation and network printer configuration.'],
                ],
            ],
            'desktop-services' => [
                'family' => 'desktop',
                'icon' => 'desktop',
                'children' => [
                    ['name' => 'Hardware Repair', 'slug' => 'desktop-hardware-repair', 'description' => 'Desktop hardware diagnostics and component replacement.'],
                    ['name' => 'Software & OS Repair', 'slug' => 'desktop-software-os-repair', 'description' => 'Operating system repair, driver fixes, and virus/malware removal.'],
                    ['name' => 'Upgrade & Assembly', 'slug' => 'desktop-upgrade-assembly', 'description' => 'RAM/SSD upgrades and custom PC assembly.'],
                ],
            ],
            'laptop-services' => [
                'family' => 'laptop',
                'icon' => 'laptop',
                'children' => [
                    ['name' => 'Battery & Power', 'slug' => 'laptop-battery-power', 'description' => 'Battery health, calibration, replacement, and charging port repair.'],
                    ['name' => 'Keyboard & Trackpad', 'slug' => 'laptop-keyboard-trackpad', 'description' => 'Keyboard and trackpad cleaning, repair, and replacement.'],
                    ['name' => 'Motherboard Repair', 'slug' => 'laptop-motherboard-repair', 'description' => 'Laptop motherboard diagnostics and chip-level repair.'],
                ],
            ],
            'printer-services' => [
                'family' => 'printer',
                'icon' => 'printer',
                'children' => [
                    ['name' => 'Inkjet Printer Repair', 'slug' => 'printer-inkjet-repair', 'description' => 'Inkjet printer cleaning, cartridge, and print head service.'],
                    ['name' => 'Laser Printer Repair', 'slug' => 'printer-laser-repair', 'description' => 'Laser printer toner, drum, and fuser unit service.'],
                    ['name' => 'Printer Maintenance', 'slug' => 'printer-maintenance', 'description' => 'Routine and deep printer maintenance service.'],
                ],
            ],
            'monitor-service' => [
                'family' => 'monitor',
                'icon' => 'monitor',
                'children' => [
                    ['name' => 'Power & Backlight Repair', 'slug' => 'monitor-power-backlight-repair', 'description' => 'Monitor power board and backlight diagnostics and repair.'],
                    ['name' => 'Panel Replacement', 'slug' => 'monitor-panel-replacement', 'description' => 'Monitor display panel diagnostics and replacement.'],
                ],
            ],
            'data-recovery' => [
                'family' => 'data-recovery',
                'icon' => 'database',
                'children' => [
                    ['name' => 'Hard Disk Recovery', 'slug' => 'data-recovery-hdd', 'description' => 'Data recovery from desktop/laptop hard disk drives.'],
                    ['name' => 'SSD Recovery', 'slug' => 'data-recovery-ssd', 'description' => 'Data recovery from solid state drives, including chip-level.'],
                    ['name' => 'Pen Drive & Memory Card Recovery', 'slug' => 'data-recovery-pendrive-memory-card', 'description' => 'Data recovery from USB pen drives and memory cards.'],
                ],
            ],
        ];

        $sortOrder = 100;
        $categorySlugToId = [];

        foreach ($subCategoryGroups as $parentSlug => $group) {
            $parent = ServiceCategory::where('slug', $parentSlug)->first();
            if (! $parent) {
                continue;
            }

            if (empty($parent->image)) {
                $parent->update(['image' => $categoryImage($group['family'])]);
            }

            foreach ($group['children'] as $child) {
                $category = ServiceCategory::firstOrCreate(
                    ['slug' => $child['slug']],
                    [
                        'parent_id' => $parent->id,
                        'name' => $child['name'],
                        'description' => $child['description'],
                        'icon' => $group['icon'],
                        'image' => $categoryImage($group['family']),
                        'is_active' => true,
                        'sort_order' => $sortOrder++,
                    ]
                );
                $categorySlugToId[$child['slug']] = $category->id;
            }
        }

        // Existing sub-categories that had no services yet.
        foreach (['retina', 'lcd'] as $existingSlug) {
            $existing = ServiceCategory::where('slug', $existingSlug)->first();
            if ($existing) {
                $categorySlugToId[$existingSlug] = $existing->id;
                if (empty($existing->image)) {
                    $existing->update(['image' => $categoryImage('laptop')]);
                }
            }
        }

        // Existing root categories, to attach parity-tier services directly.
        foreach (['home-service', 'desktop-services', 'laptop-services', 'printer-services', 'monitor-service', 'data-recovery'] as $rootSlug) {
            $root = ServiceCategory::where('slug', $rootSlug)->first();
            if ($root) {
                $categorySlugToId[$rootSlug] = $root->id;
            }
        }

        // [category_slug, family, [ services ] ]
        $services = [
            ['home-visit-desktop-laptop', 'home-service', [
                ['name' => 'Home Visit - Basic Diagnostic & Fix', 'tier' => 'basic', 'price' => 500, 'duration' => 'Same day (2-3 Hour)',
                    'items' => ['On-site hardware & software diagnosis', 'Minor software troubleshooting', 'Driver and OS quick fixes', 'Free re-visit within 7 days if unresolved']],
                ['name' => 'Home Visit - Hardware Repair', 'tier' => 'major', 'price' => 1500, 'duration' => 'Same day (3-5 Hour)',
                    'items' => ['On-site hardware replacement labor', 'Component and cable testing', 'Connector and port repair', 'Post-repair performance check']],
            ]],
            ['home-visit-networking-wifi', 'home-service', [
                ['name' => 'WiFi & Router Setup', 'tier' => 'basic', 'price' => 600, 'duration' => '1-2 Hour',
                    'items' => ['Router configuration', 'WiFi range and channel optimization', 'Password and security setup', 'Device connection assistance']],
                ['name' => 'Full Home/Office Network Setup', 'tier' => 'major', 'price' => 2000, 'duration' => '3-5 Hour',
                    'items' => ['Multi-device network setup', 'Cabling and access point placement', 'Network security hardening', 'Shared printer/NAS setup']],
            ]],
            ['home-visit-printer-setup', 'home-service', [
                ['name' => 'Printer Installation', 'tier' => 'basic', 'price' => 500, 'duration' => '1 Hour',
                    'items' => ['Driver installation', 'Wireless or USB setup', 'Test print and alignment', 'Basic troubleshooting']],
                ['name' => 'Office Network Printer Setup', 'tier' => 'major', 'price' => 1500, 'duration' => '2-3 Hour',
                    'items' => ['Multi-PC shared printer setup', 'Network printer configuration', 'Scan-to-email/folder setup', 'Staff walkthrough']],
            ]],
            ['desktop-hardware-repair', 'desktop', [
                ['name' => 'Hardware Diagnostic & Minor Repair', 'tier' => 'basic', 'price' => 500, 'duration' => '2-4 Hour',
                    'items' => ['Full hardware diagnostic', 'RAM and PSU testing', 'Cable and connection check', 'Internal dust cleaning']],
                ['name' => 'Component Replacement Service', 'tier' => 'major', 'price' => 1800, 'duration' => '1-2 days',
                    'items' => ['Motherboard, PSU, or RAM replacement labor', 'Post-replacement stress test', '90-day warranty on labor', 'Free pickup available']],
            ]],
            ['desktop-software-os-repair', 'desktop', [
                ['name' => 'OS Repair & Driver Fix', 'tier' => 'basic', 'price' => 500, 'duration' => '01-03 Hour',
                    'items' => ['Windows repair and reset', 'Driver installation and updates', 'Basic app troubleshooting', 'Startup issue fixes']],
                ['name' => 'Deep Virus/Malware Removal & OS Reinstall', 'tier' => 'major', 'price' => 1200, 'duration' => '03-05 Hour',
                    'items' => ['Full virus and malware removal', 'Clean OS reinstall with drivers', 'Data backup before reinstall', 'Essential software setup']],
            ]],
            ['desktop-upgrade-assembly', 'desktop', [
                ['name' => 'RAM / SSD Upgrade Installation', 'tier' => 'basic', 'price' => 600, 'duration' => '01-02 Hour',
                    'items' => ['Compatibility check', 'RAM or SSD installation', 'OS migration to SSD (if applicable)', 'Performance verification']],
                ['name' => 'Custom PC Assembly Service', 'tier' => 'major', 'price' => 2500, 'duration' => '1 days',
                    'items' => ['Full custom PC build', 'Cable management', 'OS and driver installation', 'Stress test and benchmark report']],
            ]],
            ['laptop-battery-power', 'laptop', [
                ['name' => 'Battery Health Check & Calibration', 'tier' => 'basic', 'price' => 800, 'duration' => '02-03 Hour',
                    'items' => ['Battery health diagnostic', 'Calibration for accurate charge reporting', 'Charging circuit check', 'Power setting optimization']],
                ['name' => 'Battery Replacement & Charging Port Repair', 'tier' => 'major', 'price' => 2800, 'duration' => '1-2 days',
                    'items' => ['Genuine/OEM-grade battery replacement', 'Charging port repair or replacement', 'Full charge cycle test', '90-day warranty']],
            ]],
            ['laptop-keyboard-trackpad', 'laptop', [
                ['name' => 'Keyboard Cleaning & Minor Key Repair', 'tier' => 'basic', 'price' => 600, 'duration' => '02-03 Hour',
                    'items' => ['Deep cleaning under keys', 'Individual key repair', 'Spill damage assessment', 'Function key testing']],
                ['name' => 'Full Keyboard/Trackpad Replacement', 'tier' => 'major', 'price' => 2200, 'duration' => '1-2 days',
                    'items' => ['Full keyboard assembly replacement', 'Trackpad replacement and calibration', 'Palm-rest reassembly', 'Post-repair typing test']],
            ]],
            ['laptop-motherboard-repair', 'laptop', [
                ['name' => 'Motherboard Diagnostic', 'tier' => 'basic', 'price' => 1000, 'duration' => '1 days',
                    'items' => ['Full board-level diagnostic', 'Power sequence testing', 'Short-circuit check', 'Repair estimate with no obligation']],
                ['name' => 'Chip-Level Motherboard Repair', 'tier' => 'major', 'price' => 4500, 'duration' => '3-5 days',
                    'items' => ['Chip-level component repair', 'IC/connector reballing or replacement', 'Post-repair burn-in test', '30-day repair warranty']],
            ]],
            ['retina', 'laptop', [
                ['name' => 'Retina Display Minor Repair', 'tier' => 'basic', 'price' => 3000, 'duration' => '1-2 days',
                    'items' => ['Backlight and flex cable check', 'Minor display defect repair', 'Color and brightness calibration', 'Hinge alignment check']],
                ['name' => 'Retina Display Full Replacement', 'tier' => 'major', 'price' => 9000, 'duration' => '3-5 days',
                    'items' => ['Full Retina panel replacement', 'True Tone/brightness calibration', 'Bezel and housing reassembly', '90-day warranty']],
            ]],
            ['lcd', 'laptop', [
                ['name' => 'LCD Screen Minor Repair', 'tier' => 'basic', 'price' => 2000, 'duration' => '1-2 days',
                    'items' => ['Flex cable and connector check', 'Minor screen defect repair', 'Backlight inverter check', 'Display test across resolutions']],
                ['name' => 'LCD Screen Full Replacement', 'tier' => 'major', 'price' => 5000, 'duration' => '2-3 days',
                    'items' => ['Full LCD panel replacement', 'Bezel and hinge reassembly', 'Dead pixel inspection', '90-day warranty']],
            ]],
            ['printer-inkjet-repair', 'printer', [
                ['name' => 'Inkjet Cleaning & Cartridge Fix', 'tier' => 'basic', 'price' => 400, 'duration' => '01-02 Hour',
                    'items' => ['Print head cleaning', 'Cartridge alignment and fix', 'Nozzle check', 'Test print']],
                ['name' => 'Print Head / Roller Replacement', 'tier' => 'major', 'price' => 1500, 'duration' => '1-2 days',
                    'items' => ['Print head replacement', 'Paper feed roller replacement', 'Calibration after replacement', 'Multi-page test print']],
            ]],
            ['printer-laser-repair', 'printer', [
                ['name' => 'Toner & Drum Cleaning Service', 'tier' => 'basic', 'price' => 600, 'duration' => '01-02 Hour',
                    'items' => ['Toner cartridge cleaning/refill check', 'Drum unit cleaning', 'Paper jam clearing', 'Print quality test']],
                ['name' => 'Fuser / Drum Unit Replacement', 'tier' => 'major', 'price' => 2500, 'duration' => '2-3 days',
                    'items' => ['Fuser unit replacement', 'Drum unit replacement', 'Full print quality calibration', '30-day warranty']],
            ]],
            ['printer-maintenance', 'printer', [
                ['name' => 'Routine Printer Maintenance', 'tier' => 'basic', 'price' => 500, 'duration' => '01 Hour',
                    'items' => ['General cleaning and inspection', 'Firmware/driver check', 'Print quality test', 'Maintenance report']],
                ['name' => 'Deep Maintenance & Parts Service', 'tier' => 'major', 'price' => 1200, 'duration' => '1 days',
                    'items' => ['Deep internal cleaning', 'Worn part replacement', 'Full calibration', 'Preventive maintenance schedule']],
            ]],
            ['monitor-power-backlight-repair', 'monitor', [
                ['name' => 'Power & Backlight Diagnostic', 'tier' => 'basic', 'price' => 800, 'duration' => '02-03 Hour',
                    'items' => ['Power board diagnostic', 'Backlight strip inspection', 'Capacitor check', 'Power-on test']],
                ['name' => 'Backlight / Power Board Replacement', 'tier' => 'major', 'price' => 2500, 'duration' => '1-2 days',
                    'items' => ['Backlight strip replacement', 'Power board replacement', 'Brightness and flicker test', '90-day warranty']],
            ]],
            ['monitor-panel-replacement', 'monitor', [
                ['name' => 'Panel Diagnostic & Minor Fix', 'tier' => 'basic', 'price' => 900, 'duration' => '02-03 Hour',
                    'items' => ['Panel and cable diagnostic', 'Dead/stuck pixel check', 'Minor display defect repair', 'Color calibration']],
                ['name' => 'Full Panel Replacement', 'tier' => 'major', 'price' => 3500, 'duration' => '2-3 days',
                    'items' => ['Full display panel replacement', 'Bezel and stand reassembly', 'Color and uniformity calibration', '90-day warranty']],
            ]],
            ['data-recovery-hdd', 'data-recovery', [
                ['name' => 'HDD Basic Recovery', 'tier' => 'basic', 'price' => 2000, 'duration' => '1-2 days',
                    'items' => ['Deleted/formatted file recovery', 'Logical drive error recovery', 'Free diagnosis before payment', 'Recovered data on external drive']],
                ['name' => 'HDD Major Recovery', 'tier' => 'major', 'price' => 6000, 'duration' => '5-7 days',
                    'items' => ['Bad sector and clicking drive recovery', 'Firmware-level recovery', 'Clean-room evaluation if required', 'Case-by-case success report']],
            ]],
            ['data-recovery-ssd', 'data-recovery', [
                ['name' => 'SSD Recovery - Basic', 'tier' => 'basic', 'price' => 3000, 'duration' => '2-3 days',
                    'items' => ['Deleted/formatted file recovery', 'Logical corruption recovery', 'TRIM-aware recovery attempt', 'Free diagnosis before payment']],
                ['name' => 'SSD Recovery - Major (Chip-Level)', 'tier' => 'major', 'price' => 8000, 'duration' => '7-10 days',
                    'items' => ['Controller and chip-level recovery', 'NAND chip-off recovery if required', 'Advanced lab-grade tools', 'Case-by-case success report']],
            ]],
            ['data-recovery-pendrive-memory-card', 'data-recovery', [
                ['name' => 'Pen Drive / Memory Card Recovery - Basic', 'tier' => 'basic', 'price' => 1000, 'duration' => '1 days',
                    'items' => ['Deleted/formatted file recovery', 'Corrupted file system recovery', 'Free diagnosis before payment', 'Recovered data on external drive']],
                ['name' => 'Pen Drive / Memory Card Recovery - Major', 'tier' => 'major', 'price' => 3500, 'duration' => '3-5 days',
                    'items' => ['Physically damaged media recovery', 'Chip-level data extraction', 'Advanced lab-grade tools', 'Case-by-case success report']],
            ]],
            // Parity tier directly on an existing root category.
            ['laptop-services', 'laptop', [
                ['name' => 'Minor Issue Service', 'tier' => 'minor', 'price' => 750, 'duration' => '1-2 days',
                    'items' => ['Extended diagnostic beyond basic check', 'Minor part adjustment or cleaning', 'Software and hardware combined check', 'Follow-up support included']],
            ]],
        ];

        $serviceSortOrder = 10;

        foreach ($services as [$categorySlug, $family, $tierServices]) {
            $categoryId = $categorySlugToId[$categorySlug] ?? null;
            if (! $categoryId) {
                continue;
            }

            foreach ($tierServices as $svc) {
                $slug = Str::slug($svc['name']) . '-' . Str::slug($categorySlug);

                $itemsHtml = collect($svc['items'])
                    ->map(fn ($item) => "<li><p><span>{$item}</span></p></li>")
                    ->implode('');

                Service::firstOrCreate(
                    ['slug' => $slug],
                    [
                        'category_id' => $categoryId,
                        'name' => $svc['name'],
                        'code' => 'SVC-' . Str::upper(Str::random(8)),
                        'description' => "<ul>{$itemsHtml}</ul><p></p>",
                        'short_description' => $svc['items'][0] ?? null,
                        'base_price' => $svc['price'],
                        'duration_estimate' => $svc['duration'],
                        'image' => $serviceImage($family, $svc['tier']),
                        'is_active' => true,
                        'is_featured' => false,
                        'sort_order' => $serviceSortOrder++,
                    ]
                );
            }
        }
    }
}
