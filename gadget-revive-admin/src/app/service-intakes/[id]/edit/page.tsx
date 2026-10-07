'use client';

import { useParams } from 'next/navigation';
import ServiceIntakeFormPage from '@/components/service-intakes/ServiceIntakeFormPage';

export default function EditServiceIntakePage() {
  const params = useParams();
  return <ServiceIntakeFormPage intakeId={Number(params.id)} />;
}
