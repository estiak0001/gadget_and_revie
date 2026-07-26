'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DollarSign,
  Download,
  Clock,
  CheckCircle,
  CreditCard,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Select,
  Modal,
  Badge,
  LoadingSpinner,
  Pagination,
} from '@/components/ui';
import { formatCurrency, formatDateTime, getErrorMessage } from '@/lib/utils';
import adminService from '@/lib/adminService';
import toast from 'react-hot-toast';

interface Payout {
  id: number;
  payout_number: string;
  amount: number;
  fee: number;
  net_amount: number;
  payment_method: string;
  account_details: string;
  status: string;
  requested_at: string;
  processed_at?: string;
  notes?: string;
}

interface Earning {
  id: number;
  order_id: number;
  order_number: string;
  gross_amount: number;
  commission: number;
  net_amount: number;
  status: string;
  created_at: string;
}

interface PayoutStats {
  availableBalance: number;
  pendingPayouts: number;
  totalPaidOut: number;
  thisMonthEarnings: number;
  earningsGrowth: number;
}

const PAYOUT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'warning' },
  { value: 'processing', label: 'Processing', color: 'default' },
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'rejected', label: 'Rejected', color: 'danger' },
];

function VendorPayoutsContent() {
  const searchParams = useSearchParams();
  const vendorId = searchParams.get('vendor_id');
  
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<'payouts' | 'earnings'>('payouts');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bkash');
  const [accountDetails, setAccountDetails] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const vendorParams = vendorId ? { vendor_id: parseInt(vendorId) } : {};
      const [statsRes, payoutsRes, earningsRes] = await Promise.all([
        adminService.getVendorPayoutStats(vendorParams),
        adminService.getVendorPayouts({ page: currentPage, ...(filterStatus ? { status: filterStatus } : {}), ...vendorParams }),
        adminService.getVendorEarnings({ page: currentPage, ...vendorParams }),
      ]);
      setStats(statsRes.data);
      setPayouts(payoutsRes.data.data);
      setEarnings(earningsRes.data.data);
      setTotalPages(payoutsRes.data.last_page || 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setStats(null);
      setPayouts([]);
      setEarnings([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, filterStatus, vendorId]);

  const handleRequestPayout = async () => {
    if (!requestAmount || !accountDetails) return;
    setIsSaving(true);
    try {
      await adminService.requestVendorPayout({
        amount: parseFloat(requestAmount),
        payment_method: paymentMethod,
        account_details: accountDetails,
      });
      setIsRequestModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = PAYOUT_STATUSES.find(s => s.value === status);
    return (
      <Badge variant={statusConfig?.color as 'success' | 'warning' | 'danger' | 'default' || 'default'}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getEarningStatusBadge = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'default'> = {
      available: 'success',
      pending: 'warning',
      paid: 'default',
    };
    return <Badge variant={colors[status] || 'default'}>{status}</Badge>;
  };

  const getPaymentMethodIcon = (method: string) => {
    const icons: Record<string, string> = {
      bkash: '🅱️',
      nagad: '🟠',
      rocket: '🚀',
      bank: '🏦',
    };
    return icons[method] || '💳';
  };

  return (
    <AdminLayout>
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Payouts & Earnings</h1>
          <p className="page-description">Track your earnings and request payouts</p>
        </div>
        <Button onClick={() => setIsRequestModalOpen(true)} disabled={(stats?.availableBalance || 0) < 1000}>
          <Wallet className="w-4 h-4 mr-2" />
          Request Payout
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-green-100">Available Balance</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.availableBalance || 0)}</p>
                <p className="text-xs text-green-100 mt-2">Ready to withdraw</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Payouts</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.pendingPayouts || 0)}</p>
                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Processing
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">This Month</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.thisMonthEarnings || 0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  {(stats?.earningsGrowth || 0) >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-xs ${(stats?.earningsGrowth || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(stats?.earningsGrowth || 0)}%
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Paid Out</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.totalPaidOut || 0)}</p>
                <p className="text-xs text-gray-400 mt-2">All time</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'payouts' ? 'primary' : 'outline'}
          onClick={() => setActiveTab('payouts')}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Payout History
        </Button>
        <Button
          variant={activeTab === 'earnings' ? 'primary' : 'outline'}
          onClick={() => setActiveTab('earnings')}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Earnings
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'payouts' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payout History</CardTitle>
            <Select 
              options={[
                { value: '', label: 'All Status' },
                ...PAYOUT_STATUSES.map((status) => ({
                  value: status.value,
                  label: status.label
                }))
              ]}
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-40"
            />
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Loading payouts..." />
              </div>
            ) : payouts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No payouts yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-y">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payout</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-mono font-medium">{payout.payout_number}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium">{formatCurrency(payout.amount)}</p>
                          <p className="text-xs text-gray-500">Fee: {formatCurrency(payout.fee)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getPaymentMethodIcon(payout.payment_method)}</span>
                            <div>
                              <p className="capitalize">{payout.payment_method}</p>
                              <p className="text-xs text-gray-500">{payout.account_details}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                        <td className="px-6 py-4 text-gray-600 text-sm">{formatDateTime(payout.requested_at)}</td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {payout.processed_at ? formatDateTime(payout.processed_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Earnings from Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Loading earnings..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-y">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {earnings.map((earning) => (
                      <tr key={earning.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-primary">{earning.order_number}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{formatCurrency(earning.gross_amount)}</td>
                        <td className="px-6 py-4 text-red-500">-{formatCurrency(earning.commission)}</td>
                        <td className="px-6 py-4 font-medium text-green-600">{formatCurrency(earning.net_amount)}</td>
                        <td className="px-6 py-4">{getEarningStatusBadge(earning.status)}</td>
                        <td className="px-6 py-4 text-gray-600 text-sm">{formatDateTime(earning.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* Request Payout Modal */}
      <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="Request Payout">
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-sm text-green-700">Available Balance</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(stats?.availableBalance || 0)}</p>
          </div>

          {(stats?.availableBalance || 0) < 1000 && (
            <div className="bg-yellow-50 p-4 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-700">Minimum payout amount is ৳1,000. Please wait until you have sufficient balance.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳) *</label>
            <input
              type="number"
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
              className="w-full border rounded-lg p-3"
              placeholder="Enter amount"
              max={stats?.availableBalance || 0}
              min={1000}
            />
            <p className="text-xs text-gray-500 mt-1">Min: ৳1,000 | Max: {formatCurrency(stats?.availableBalance || 0)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <Select 
              options={[
                { value: 'bkash', label: 'bKash' },
                { value: 'nagad', label: 'Nagad' },
                { value: 'rocket', label: 'Rocket' },
                { value: 'bank', label: 'Bank Transfer' }
              ]}
              value={paymentMethod} 
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {paymentMethod === 'bank' ? 'Bank Account Details' : 'Mobile Number'} *
            </label>
            <input
              type="text"
              value={accountDetails}
              onChange={(e) => setAccountDetails(e.target.value)}
              className="w-full border rounded-lg p-3"
              placeholder={paymentMethod === 'bank' ? 'Bank Name - Account Number' : '+8801XXXXXXXXX'}
            />
          </div>

          {requestAmount && parseFloat(requestAmount) > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Payout Summary</p>
              <div className="flex justify-between text-sm">
                <span>Amount</span>
                <span>{formatCurrency(parseFloat(requestAmount))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processing Fee (1%)</span>
                <span className="text-red-500">-{formatCurrency(parseFloat(requestAmount) * 0.01)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t mt-2">
                <span>You'll Receive</span>
                <span className="text-green-600">{formatCurrency(parseFloat(requestAmount) * 0.99)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsRequestModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleRequestPayout} 
              isLoading={isSaving}
              disabled={!requestAmount || parseFloat(requestAmount) < 1000 || parseFloat(requestAmount) > (stats?.availableBalance || 0) || !accountDetails}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Request Payout
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}

export default function VendorPayoutsPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" text="Loading..." /></div></AdminLayout>}>
      <VendorPayoutsContent />
    </Suspense>
  );
}
