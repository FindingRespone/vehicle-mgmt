import { prisma } from '@/lib/prisma';
import { Availability } from '@prisma/client';

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
 * If any condition is met → should not be AVAILABLE
 * If all conditions are clear → should be AVAILABLE
 */
export async function calculateVehicleAvailability(
  vehicleId: string
): Promise<AvailabilityResult> {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Start of today
  
  const reasons: string[] = [];
  
  // Check 1: Insurance (脱保)
  const validPolicies = await prisma.insurancePolicy.count({
    where: {
      vehicleId,
      endDate: {
        gte: now,
      },
    },
  });
  
  const hasInsurance = validPolicies > 0;
  
  if (!hasInsurance) {
    reasons.push('脱保');
  }
  
  // Check 2: Annual inspection (年检过期)
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      annualInspectionDueAt: true,
    },
  });
  
  if (vehicle?.annualInspectionDueAt) {
    const inspectionDue = new Date(vehicle.annualInspectionDueAt);
    inspectionDue.setHours(0, 0, 0, 0);
    
    if (inspectionDue < now) {
      reasons.push('年检过期');
    }
  }
  
  // Check 3: Loan overdue (贷款严重逾期)
  const overdueInstallments = await prisma.loanInstallment.count({
    where: {
      loan: {
        vehicleId,
      },
      paidAt: null,
      dueDate: {
        lt: now,
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
 * Update vehicle availability if it should be changed by rules
 * Only updates if:
 * - Has risk factors but currently AVAILABLE → change to UNAVAILABLE
 * - No risk factors but currently UNAVAILABLE or RISK → change to AVAILABLE
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
  
  // Only update if rules suggest a change
  const shouldUpdate = 
    (result.availability === 'UNAVAILABLE' && vehicle.availability === 'AVAILABLE') ||
    (result.availability === 'AVAILABLE' && (vehicle.availability === 'UNAVAILABLE' || vehicle.availability === 'RISK'));
  
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
  const result = await calculateVehicleAvailability(vehicleId);
  
  // Filter out loan reasons for non-super-admin users
  if (userRole !== 'SUPER_ADMIN') {
    result.reasons = result.reasons.filter(r => r !== '贷款严重逾期');
  }
  
  return result;
}
