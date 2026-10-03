import { prisma } from '@/lib/prisma';
import { Availability } from '@prisma/client';

/**
 * Get today's date in Asia/Shanghai timezone
 * Returns the start of today in Shanghai (00:00:00) as a UTC Date object
 */
function getTodayInShanghai(): Date {
  const now = new Date();
  
  // Get current time in Shanghai timezone as ISO string
  const shanghaiTimeString = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });
  
  // Parse the date parts (MM/DD/YYYY format)
  const [month, day, year] = shanghaiTimeString.split(', ')[0].split('/');
  
  // Create a Date object representing midnight in Shanghai (which is some time in UTC)
  // Shanghai is UTC+8, so midnight in Shanghai is 16:00 previous day UTC
  const shanghaiMidnight = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00+08:00`);
  
  return shanghaiMidnight;
}

export interface AvailabilityResult {
  availability: Availability;
  reasons: string[];
}

/**
 * Calculate vehicle availability based on business rules
 * 
 * Rules:
 * - 脱保: No valid insurance policy (endDate < today or no policy at all)
 * - 年检过期: annualInspectionDueAt < today (null doesn't count as expired)
 * - 贷款严重逾期: Has unpaid installment with dueDate < today (no loan doesn't count as overdue)
 * 
 * If any condition is met → should be UNAVAILABLE
 * If all conditions are clear → should be AVAILABLE
 * 
 * Uses Asia/Shanghai timezone for date comparisons
 */
export async function calculateVehicleAvailability(
  vehicleId: string
): Promise<AvailabilityResult> {
  const today = getTodayInShanghai();
  
  const reasons: string[] = [];
  
  // Check 1: Insurance (脱保)
  // endDate >= today means still valid (today is included)
  const validPolicies = await prisma.insurancePolicy.count({
    where: {
      vehicleId,
      endDate: {
        gte: today,
      },
    },
  });
  
  const hasInsurance = validPolicies > 0;
  
  if (!hasInsurance) {
    reasons.push('脱保');
  }
  
  // Check 2: Annual inspection (年检过期)
  // dueDate < today means expired (today is not included)
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      annualInspectionDueAt: true,
    },
  });
  
  if (vehicle?.annualInspectionDueAt) {
    const inspectionDue = new Date(vehicle.annualInspectionDueAt);
    
    // Convert inspection due date to Shanghai timezone midnight
    const [month, day, year] = inspectionDue.toLocaleString('en-US', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    }).split(', ')[0].split('/');
    
    const inspectionDueShanghai = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00+08:00`);
    
    if (inspectionDueShanghai < today) {
      reasons.push('年检过期');
    }
  }
  
  // Check 3: Loan overdue (贷款严重逾期)
  // dueDate < today means overdue (today is not included)
  const overdueInstallments = await prisma.loanInstallment.count({
    where: {
      loan: {
        vehicleId,
      },
      paidAt: null,
      dueDate: {
        lt: today,
      },
    },
  });
  
  if (overdueInstallments > 0) {
    reasons.push('贷款严重逾期');
  }
  
  // Determine availability
  const hasRiskFactors = reasons.length > 0;
  const availability: Availability = hasRiskFactors ? 'UNAVAILABLE' : 'AVAILABLE';
  
  return {
    availability,
    reasons,
  };
}

/**
 * Update vehicle availability based on rules
 * Only updates if current status needs to change:
 * - Has risk factors and currently AVAILABLE → change to UNAVAILABLE
 * - No risk factors and currently UNAVAILABLE → change to AVAILABLE
 * - RISK is never automatically changed (manual override)
 */
export async function updateVehicleAvailability(vehicleId: string): Promise<void> {
  const result = await calculateVehicleAvailability(vehicleId);
  
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { availability: true },
  });
  
  if (!vehicle) {
    return;
  }
  
  // Only update if rules suggest a change from AVAILABLE <-> UNAVAILABLE
  // Never change RISK automatically
  const shouldUpdate = 
    (result.availability === 'UNAVAILABLE' && vehicle.availability === 'AVAILABLE') ||
    (result.availability === 'AVAILABLE' && vehicle.availability === 'UNAVAILABLE');
  
  if (shouldUpdate) {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { availability: result.availability },
    });
  }
}

/**
 * Get availability status with reasons for display
 * Respects permissions: only SUPER_ADMIN can see loan-related reasons
 */
export async function getVehicleAvailabilityWithReasons(
  vehicleId: string,
  userRole: string
): Promise<{ availability: Availability; reasons: string[] }> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { availability: true },
  });
  
  if (!vehicle) {
    return { availability: 'AVAILABLE', reasons: [] };
  }
  
  const result = await calculateVehicleAvailability(vehicleId);
  
  // Filter out loan reasons for non-super-admin users
  if (userRole !== 'SUPER_ADMIN') {
    result.reasons = result.reasons.filter(r => r !== '贷款严重逾期');
  }
  
  // Return the database status with calculated reasons
  return {
    availability: vehicle.availability,
    reasons: result.reasons,
  };
}

/**
 * Batch update all vehicles' availability
 * Used by cron job to keep all vehicles up to date
 */
export async function updateAllVehiclesAvailability(): Promise<{ updated: number }> {
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true },
  });
  
  let updated = 0;
  
  for (const vehicle of vehicles) {
    const before = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      select: { availability: true },
    });
    
    await updateVehicleAvailability(vehicle.id);
    
    const after = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      select: { availability: true },
    });
    
    if (before?.availability !== after?.availability) {
      updated++;
    }
  }
  
  return { updated };
}
