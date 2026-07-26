import { redirect } from 'next/navigation';

// Vendor feature is currently disabled. Any access to the vendor dashboard
// is restricted and redirected to the home page.
export default function VendorDashboard() {
  redirect('/');
}
