import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SCAN_API_URL = process.env.SCAN_API_URL || 'http://localhost:8000';
const SCAN_TIMEOUT_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse incoming FormData
    const formData = await request.formData();
    const frontImage = formData.get('front_image') as File | null;
    const sideImage = formData.get('side_image') as File | null;
    const heightCm = formData.get('height_cm');
    const weightKg = formData.get('weight_kg');
    const age = formData.get('age');
    const sex = formData.get('sex');

    if (!frontImage || !sideImage || !heightCm || !weightKg || !age || !sex) {
      return NextResponse.json(
        { error: 'Missing required fields: front_image, side_image, height_cm, weight_kg, age, sex' },
        { status: 400 }
      );
    }

    // Build FormData for GPU backend
    const backendForm = new FormData();
    backendForm.append('front_image', frontImage);
    backendForm.append('side_image', sideImage);
    backendForm.append('height_cm', heightCm.toString());
    backendForm.append('weight_kg', weightKg.toString());
    backendForm.append('age', age.toString());
    backendForm.append('sex', sex.toString());

    // Forward to GPU backend
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

    let backendResponse: Response;
    try {
      backendResponse = await fetch(`${SCAN_API_URL}/api/scan`, {
        method: 'POST',
        body: backendForm,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Scan processing timed out. Please try again.' },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: 'Scan backend is unavailable. Please try again later.' },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!backendResponse.ok) {
      const errorBody = await backendResponse.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { error: `Scan processing failed: ${errorBody}` },
        { status: backendResponse.status }
      );
    }

    const scanResult = await backendResponse.json();
    return NextResponse.json(scanResult);
  } catch (err) {
    console.error('Scan API error:', err);
    return NextResponse.json(
      { error: 'Internal server error during scan processing' },
      { status: 500 }
    );
  }
}
