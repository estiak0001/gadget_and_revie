'use client';

import { useParams } from 'next/navigation';
import OrderForm from '@/components/orders/OrderForm';

export default function EditOrderPage() {
  const params = useParams();
  const orderId = Number(params.id);

  return <OrderForm orderId={orderId} />;
}
