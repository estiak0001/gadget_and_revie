import { redirect } from 'next/navigation';

// Vendor onboarding is currently disabled. Access is restricted and
// redirected to the home page.
export default function VendorOnboarding() {
  redirect('/');
}
