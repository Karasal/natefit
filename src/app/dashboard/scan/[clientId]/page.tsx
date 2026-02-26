'use client';


import { useParams, useRouter } from 'next/navigation';
import { ScanFlow } from '@/components/scan/ScanFlow';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import type { ScanFlowState } from '@/lib/types';

export default function ScanPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  const handleComplete = async (state: ScanFlowState) => {
    if (!state.result || !state.calibration || !profile) return;

    // Get org
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', profile.id)
      .single();

    if (!orgMember) {
      toast('Organization not found', 'error');
      return;
    }

    // Save scan
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        client_id: clientId,
        org_id: orgMember.org_id,
        performed_by: profile.id,
        status: 'completed',
        front_keypoints: state.frontKeypoints,
        side_keypoints: state.sideKeypoints,
        calibration_data: state.calibration,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanError || !scan) {
      toast('Failed to save scan', 'error');
      return;
    }

    // Upload images
    if (state.frontImage) {
      await supabase.storage
        .from('scan-images')
        .upload(`${scan.id}/front.jpg`, state.frontImage, { contentType: 'image/jpeg' });
    }
    if (state.sideImage) {
      await supabase.storage
        .from('scan-images')
        .upload(`${scan.id}/side.jpg`, state.sideImage, { contentType: 'image/jpeg' });
    }

    // Save measurements
    const { circumferences, composition } = state.result;
    const measurementData: Record<string, any> = {
      scan_id: scan.id,
      client_id: clientId,
      body_fat_pct: composition.body_fat_pct,
      body_fat_navy: composition.body_fat_navy,
      body_fat_cunbae: composition.body_fat_cunbae,
      lean_mass_kg: composition.lean_mass_kg,
      fat_mass_kg: composition.fat_mass_kg,
      bmi: composition.bmi,
      waist_hip_ratio: composition.waist_hip_ratio,
      confidence_score: state.result.confidence_score,
    };

    for (const c of circumferences) {
      measurementData[`${c.region}_cm`] = c.circumference_cm;
    }

    await supabase.from('measurements').insert(measurementData);

    toast('Scan saved successfully', 'success');
    router.push(`/dashboard/clients/${clientId}`);
  };

  return (
    <div className="max-w-lg mx-auto">
      <ScanFlow clientId={clientId} onComplete={handleComplete} />
    </div>
  );
}
