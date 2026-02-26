'use client';

import { ScanFlow } from '@/components/scan/ScanFlow';
import { useAuth } from '@/components/providers/AuthProvider';

export default function PortalScanPage() {
  const { profile } = useAuth();

  return (
    <div className="max-w-lg mx-auto">
      <ScanFlow />
    </div>
  );
}
