// ============================================================
// Database Types
// ============================================================

export type UserRole = 'trainer' | 'client';
export type OrgRole = 'owner' | 'trainer' | 'viewer';
export type ScanStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type GoalDirection = 'increase' | 'decrease' | 'maintain';
export type Sex = 'male' | 'female';
export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  sex: Sex | null;
  height_cm: number | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan_tier: string;
  max_clients: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface Client {
  id: string;
  org_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  invite_token: string | null;
  invite_status: InviteStatus;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scan {
  id: string;
  client_id: string;
  org_id: string;
  performed_by: string;
  status: ScanStatus;
  front_image_path: string | null;
  side_image_path: string | null;
  front_keypoints: PoseKeypoints | null;
  side_keypoints: PoseKeypoints | null;
  calibration_data: CalibrationData | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Measurement {
  id: string;
  scan_id: string;
  client_id: string;
  neck_cm: number | null;
  chest_cm: number | null;
  left_bicep_cm: number | null;
  right_bicep_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  left_calf_cm: number | null;
  right_calf_cm: number | null;
  shoulders_cm: number | null;
  left_forearm_cm: number | null;
  right_forearm_cm: number | null;
  wrist_cm: number | null;
  body_fat_pct: number | null;
  body_fat_navy: number | null;
  body_fat_cunbae: number | null;
  lean_mass_kg: number | null;
  fat_mass_kg: number | null;
  bmi: number | null;
  waist_hip_ratio: number | null;
  confidence_score: number;
  created_at: string;
}

export interface Goal {
  id: string;
  client_id: string;
  org_id: string;
  metric: string;
  target_value: number;
  direction: GoalDirection;
  deadline: string | null;
  achieved_at: string | null;
  created_at: string;
}

export interface ScanComparison {
  id: string;
  client_id: string;
  scan_a_id: string;
  scan_b_id: string;
  created_by: string;
  notes: string | null;
  created_at: string;
}

// ============================================================
// Scan Engine Types
// ============================================================

export interface PoseKeypoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
  name: string;
}

export type PoseKeypoints = PoseKeypoint[];

export interface CalibrationData {
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: Sex;
  pixels_per_cm?: number;
  image_width?: number;
  image_height?: number;
}

export interface SilhouetteWidth {
  region: MeasurementRegion;
  y_position: number;
  left_edge: number;
  right_edge: number;
  width_pixels: number;
}

export type MeasurementRegion =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'left_bicep'
  | 'right_bicep'
  | 'left_forearm'
  | 'right_forearm'
  | 'wrist'
  | 'waist'
  | 'hips'
  | 'left_thigh'
  | 'right_thigh'
  | 'left_calf'
  | 'right_calf';

export interface RegionWidths {
  frontal_cm: number;
  sagittal_cm: number;
}

export interface CircumferenceResult {
  region: MeasurementRegion;
  circumference_cm: number;
  frontal_width_cm: number;
  sagittal_depth_cm: number;
  confidence: number;
}

export interface BodyCompositionResult {
  body_fat_pct: number;
  body_fat_navy: number;
  body_fat_cunbae: number;
  body_fat_smpl?: number;
  lean_mass_kg: number;
  fat_mass_kg: number;
  bmi: number;
  waist_hip_ratio: number;
}

export interface ScanResult {
  circumferences: CircumferenceResult[];
  composition: BodyCompositionResult;
  confidence_score: number;
  mesh_vertices?: number[];
  mesh_faces?: number[];
  scan_tier?: 'lidar' | 'photo';
  smpl_betas?: number[];
}

// ============================================================
// Scan Flow Types
// ============================================================

export type ScanStep =
  | 'intro'
  | 'calibration'
  | 'front_capture'
  | 'front_review'
  | 'side_capture'
  | 'side_review'
  | 'processing'
  | 'results';

export interface ScanFlowState {
  step: ScanStep;
  calibration: CalibrationData | null;
  frontImage: Blob | null;
  frontKeypoints: PoseKeypoints | null;
  sideImage: Blob | null;
  sideKeypoints: PoseKeypoints | null;
  result: ScanResult | null;
  error: string | null;
}

// ============================================================
// UI Types
// ============================================================

export interface MeasurementDelta {
  label: string;
  current: number;
  previous: number;
  unit: string;
  direction: 'up' | 'down' | 'same';
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ClientWithScans extends Client {
  scans: (Scan & { measurements: Measurement | null })[];
  profile: Profile | null;
}

export interface ScanWithMeasurements extends Scan {
  measurements: Measurement | null;
  client: Client;
}
