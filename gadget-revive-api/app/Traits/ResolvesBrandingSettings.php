<?php

namespace App\Traits;

use App\Models\SiteSetting;

/**
 * Shared branding/contact fields used by the generated PDF documents
 * (invoice + service receipt). Pulls from the site_settings table with
 * sensible fallbacks so documents still render if a setting is missing.
 */
trait ResolvesBrandingSettings
{
    protected function brandingSettings(): array
    {
        $defaultTerms = "Please collect your product within fifteen (15) days of the issue date; "
            . "after this period we cannot be held responsible for any demurrage. "
            . "Devices are accepted for service in their reported condition and inspected on receipt. "
            . "Genuine parts carry the warranty stated above; physical or liquid damage voids warranty. "
            . "Please verify all items and serial numbers at the time of delivery.";

        return [
            'site_name'      => SiteSetting::get('site_name', 'Gadget Revive'),
            'site_tagline'   => SiteSetting::get('site_tagline', 'Repair. Shop. Revive.'),
            'address'        => SiteSetting::get('topbar_address', SiteSetting::get('contact_address', 'House 12, Road 4, Block C, Bashundhara R/A, Dhaka - 1229, Bangladesh')),
            'phone'          => SiteSetting::get('topbar_phone', SiteSetting::get('contact_phone', '+880 1800-000000')),
            'email'          => SiteSetting::get('footer_email', SiteSetting::get('topbar_email', 'support@gadgetrevive.com')),
            'website'        => SiteSetting::get('site_url', 'www.gadgetandrevive.com'),
            'terms'          => SiteSetting::get('invoice_terms', $defaultTerms),
            'footer_brand'   => SiteSetting::get('footer_brand_name', SiteSetting::get('site_name', 'Gadget Revive Bangladesh Ltd.')),
            'footer_address' => SiteSetting::get('topbar_address', 'House 12, Road 4, Block C, Bashundhara R/A, Dhaka - 1229'),
            'footer_phone'   => SiteSetting::get('topbar_phone', '+880 1800-000000'),
            'footer_email'   => SiteSetting::get('footer_email', SiteSetting::get('topbar_email', 'support@gadgetrevive.com')),
            'legal_entity'   => SiteSetting::get('footer_brand_name', SiteSetting::get('site_name', 'Gadget Revive Bangladesh Ltd.')),
            'logo_white'     => $this->logoDataUri('invoice-logo-white.png'),
            'logo_black'     => $this->logoDataUri('invoice-logo-black.png'),
        ];
    }

    /**
     * Encode a bundled logo as a base64 data URI so DomPDF can embed it
     * without remote loading or fragile filesystem paths. Returns null when
     * the asset is missing so templates can fall back to text.
     */
    protected function logoDataUri(string $filename): ?string
    {
        $path = public_path($filename);

        if (!is_file($path)) {
            return null;
        }

        $contents = @file_get_contents($path);

        if ($contents === false) {
            return null;
        }

        return 'data:image/png;base64,' . base64_encode($contents);
    }
}
