import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Types
// ============================================================

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface ComplianceCategory {
  completed: number;
  scheduled: number;
  rate: number | null; // null if no data to compute against
}

export interface NutritionCompliance {
  daysLogged: number;
  totalDays: number;
  daysHittingTargets: number;
  rate: number;
}

export interface HabitCompliance {
  completed: number;
  total: number;
  rate: number;
}

export interface ClientCompliance {
  workout: ComplianceCategory;
  nutrition: NutritionCompliance;
  habits: HabitCompliance;
  overall: number; // 0-100 weighted average
}

export interface ClientComplianceSummary {
  client_id: string;
  full_name: string;
  email: string;
  compliance: ClientCompliance;
}

export interface OrgComplianceResult {
  clients: ClientComplianceSummary[];
  averages: {
    workout: number;
    nutrition: number;
    habits: number;
    overall: number;
  };
}

export interface AtRiskClient {
  client_id: string;
  full_name: string;
  email: string;
  lastWorkoutAt: string | null;
  complianceRate: number;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  weekEnd: string;
  workout: number;
  nutrition: number;
  habits: number;
  overall: number;
}

// ============================================================
// Helpers
// ============================================================

function daysBetween(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function computeOverall(
  workoutRate: number | null,
  nutritionRate: number,
  habitRate: number
): number {
  // Weighted: 50% workout, 25% nutrition, 25% habits
  // If no workout data, redistribute to 50% nutrition, 50% habits
  if (workoutRate === null) {
    return Math.round((nutritionRate * 50 + habitRate * 50) / 100);
  }
  return Math.round((workoutRate * 50 + nutritionRate * 25 + habitRate * 25) / 100);
}

// ============================================================
// getClientCompliance
// ============================================================

export async function getClientCompliance(
  supabase: SupabaseClient,
  clientId: string,
  dateRange: DateRange
): Promise<{ data: ClientCompliance | null; error: any }> {
  try {
    const totalDays = daysBetween(dateRange.from, dateRange.to);

    // --- Workout Compliance ---
    const { data: completedWorkouts, error: workoutErr } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', clientId)
      .gte('started_at', `${dateRange.from}T00:00:00`)
      .lte('started_at', `${dateRange.to}T23:59:59`)
      .not('completed_at', 'is', null);

    if (workoutErr) return { data: null, error: workoutErr };

    const workoutCompleted = completedWorkouts?.length || 0;

    // Find active program and count scheduled (non-rest) days in range
    let workoutScheduled = 0;
    let workoutRate: number | null = null;

    const { data: activeProgram } = await supabase
      .from('client_programs')
      .select('id, program_id, start_date')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (activeProgram) {
      // Get all non-rest program days for this program
      const { data: programDays } = await supabase
        .from('program_days')
        .select('id, rest_day, day_order, program_weeks!inner(week_number, program_phases!inner(program_id))')
        .eq('program_weeks.program_phases.program_id', activeProgram.program_id)
        .eq('rest_day', false);

      if (programDays && programDays.length > 0) {
        // Count total program days per week, then figure out how many weeks in range
        const daysPerWeek = programDays.length;
        // Get total unique weeks in program
        const weekIds = new Set(programDays.map((d: any) => {
          const pw = d.program_weeks;
          return pw ? (Array.isArray(pw) ? pw[0]?.week_number : pw.week_number) : null;
        }).filter(Boolean));
        const totalWeeksInProgram = weekIds.size || 1;
        const trainingDaysPerWeek = Math.ceil(daysPerWeek / totalWeeksInProgram);

        const weeksInRange = totalDays / 7;
        workoutScheduled = Math.round(trainingDaysPerWeek * weeksInRange);
        workoutRate = workoutScheduled > 0
          ? Math.round((workoutCompleted / workoutScheduled) * 100)
          : null;
      }
    }

    // --- Nutrition Compliance ---
    const { data: foodLogs, error: nutritionErr } = await supabase
      .from('food_logs')
      .select('log_date, calories')
      .eq('client_id', clientId)
      .gte('log_date', dateRange.from)
      .lte('log_date', dateRange.to);

    if (nutritionErr) return { data: null, error: nutritionErr };

    // Group food logs by date and sum calories
    const caloriesByDate: Record<string, number> = {};
    for (const log of foodLogs || []) {
      if (!caloriesByDate[log.log_date]) caloriesByDate[log.log_date] = 0;
      caloriesByDate[log.log_date] += log.calories || 0;
    }
    const daysLogged = Object.keys(caloriesByDate).length;

    // Check nutrition targets
    const { data: target } = await supabase
      .from('nutrition_targets')
      .select('daily_calories')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let daysHittingTargets = 0;
    if (target?.daily_calories) {
      const targetCal = target.daily_calories;
      const tolerance = targetCal * 0.15;
      for (const cal of Object.values(caloriesByDate)) {
        if (cal >= targetCal - tolerance && cal <= targetCal + tolerance) {
          daysHittingTargets++;
        }
      }
    }

    const nutritionRate = totalDays > 0 ? Math.round((daysLogged / totalDays) * 100) : 0;

    // --- Habit Compliance ---
    const { data: activeHabits } = await supabase
      .from('client_habits')
      .select('id')
      .eq('client_id', clientId)
      .eq('active', true);

    const activeHabitCount = activeHabits?.length || 0;

    const { data: habitLogs, error: habitErr } = await supabase
      .from('habit_logs')
      .select('completed')
      .eq('client_id', clientId)
      .gte('log_date', dateRange.from)
      .lte('log_date', dateRange.to);

    if (habitErr) return { data: null, error: habitErr };

    const habitCompleted = (habitLogs || []).filter((l: any) => l.completed).length;
    const habitTotal = activeHabitCount * totalDays;
    const habitRate = habitTotal > 0 ? Math.round((habitCompleted / habitTotal) * 100) : 0;

    // --- Overall ---
    const overall = computeOverall(workoutRate, nutritionRate, habitRate);

    const compliance: ClientCompliance = {
      workout: { completed: workoutCompleted, scheduled: workoutScheduled, rate: workoutRate },
      nutrition: { daysLogged, totalDays, daysHittingTargets, rate: nutritionRate },
      habits: { completed: habitCompleted, total: habitTotal, rate: habitRate },
      overall,
    };

    return { data: compliance, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

// ============================================================
// getOrgCompliance
// ============================================================

export async function getOrgCompliance(
  supabase: SupabaseClient,
  orgId: string,
  dateRange: DateRange
): Promise<{ data: OrgComplianceResult | null; error: any }> {
  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('id, full_name, email')
    .eq('org_id', orgId);

  if (clientErr || !clients) return { data: null, error: clientErr };

  const summaries: ClientComplianceSummary[] = [];
  let totalWorkout = 0;
  let totalNutrition = 0;
  let totalHabits = 0;
  let totalOverall = 0;

  for (const client of clients) {
    const { data: compliance } = await getClientCompliance(supabase, client.id, dateRange);

    if (compliance) {
      summaries.push({
        client_id: client.id,
        full_name: client.full_name,
        email: client.email,
        compliance,
      });
      totalWorkout += compliance.workout.rate ?? 0;
      totalNutrition += compliance.nutrition.rate;
      totalHabits += compliance.habits.rate;
      totalOverall += compliance.overall;
    }
  }

  const count = summaries.length || 1;

  return {
    data: {
      clients: summaries,
      averages: {
        workout: Math.round(totalWorkout / count),
        nutrition: Math.round(totalNutrition / count),
        habits: Math.round(totalHabits / count),
        overall: Math.round(totalOverall / count),
      },
    },
    error: null,
  };
}

// ============================================================
// getAtRiskClients
// ============================================================

export async function getAtRiskClients(
  supabase: SupabaseClient,
  orgId: string,
  days: number = 7
): Promise<{ data: AtRiskClient[] | null; error: any }> {
  const now = new Date();
  const rangeStart = new Date(now.getTime() - days * 86400000);
  const dateRange: DateRange = {
    from: formatDate(rangeStart),
    to: formatDate(now),
  };

  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('id, full_name, email')
    .eq('org_id', orgId);

  if (clientErr || !clients) return { data: null, error: clientErr };

  const atRisk: AtRiskClient[] = [];

  for (const client of clients) {
    // Get last workout
    const { data: lastWorkout } = await supabase
      .from('workout_logs')
      .select('completed_at')
      .eq('client_id', client.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastWorkoutAt = lastWorkout?.completed_at || null;

    // Check workout compliance in date range
    const { data: compliance } = await getClientCompliance(supabase, client.id, dateRange);
    const workoutRate = compliance?.workout.rate ?? 0;

    // No workout in N days or workout compliance < 50%
    const noRecentWorkout = !lastWorkoutAt || new Date(lastWorkoutAt) < rangeStart;
    const lowCompliance = workoutRate < 50;

    if (noRecentWorkout || lowCompliance) {
      atRisk.push({
        client_id: client.id,
        full_name: client.full_name,
        email: client.email,
        lastWorkoutAt,
        complianceRate: compliance?.overall ?? 0,
      });
    }
  }

  // Sort by compliance rate ascending (worst first)
  atRisk.sort((a, b) => a.complianceRate - b.complianceRate);

  return { data: atRisk, error: null };
}

// ============================================================
// getWeeklyComplianceTrend
// ============================================================

export async function getWeeklyComplianceTrend(
  supabase: SupabaseClient,
  clientId: string,
  weeks: number = 8
): Promise<{ data: WeeklyTrendPoint[] | null; error: any }> {
  const now = new Date();
  const trend: WeeklyTrendPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now.getTime() - i * 7 * 86400000);
    const weekStart = new Date(weekEnd.getTime() - 6 * 86400000);

    const dateRange: DateRange = {
      from: formatDate(weekStart),
      to: formatDate(weekEnd),
    };

    const { data: compliance } = await getClientCompliance(supabase, clientId, dateRange);

    trend.push({
      weekStart: dateRange.from,
      weekEnd: dateRange.to,
      workout: compliance?.workout.rate ?? 0,
      nutrition: compliance?.nutrition.rate ?? 0,
      habits: compliance?.habits.rate ?? 0,
      overall: compliance?.overall ?? 0,
    });
  }

  return { data: trend, error: null };
}
