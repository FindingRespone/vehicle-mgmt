import { prisma } from '@/lib/prisma';
import { canViewAllVehicles, canViewLoans } from '@/lib/roles';
import { csvRow, formatDateOnly } from '@/lib/csv';
import { parseDrivingLicenseMeta } from '@/lib/drivingLicense';

const statusLabels: Record<string, string> = {
  IN_USE: '使用中',
  MAINTENANCE: '维护中',
  STOPPED: '停用',
  DISPOSING: '处置中',
};

const availabilityLabels: Record<string, string> = {
  AVAILABLE: '可用',
  RISK: '风险',
  UNAVAILABLE: '不可用',
};

function installmentStatus(dueDate: Date, paidAt: Date | null): string {
  if (paidAt) return '已还';
  if (dueDate < new Date()) return '逾期';
  return '未还';
}

export async function buildFleetExportCsv(userId: string, role: string): Promise<string> {
  const includeLoans = canViewLoans(role);

  const vehicles = await prisma.vehicle.findMany({
    where: canViewAllVehicles(role)
      ? undefined
      : {
          OR: [
            { ownerUserId: userId },
            { members: { some: { userId } } },
          ],
        },
    include: {
      owner: { select: { name: true } },
      insurancePolicies: {
        orderBy: { endDate: 'desc' },
      },
      loans: {
        include: {
          installments: {
            orderBy: { periodNumber: 'asc' },
          },
        },
        orderBy: { startDate: 'desc' },
      },
    },
    orderBy: { plateNo: 'asc' },
  });

  const sections: string[] = [];

  sections.push('车辆主数据');
  sections.push(csvRow([
    '车牌号',
    'VIN',
    '品牌型号',
    '司机',
    '负责人',
    '状态',
    '可用性',
    '年检到期日',
    '行驶证证号',
    '行驶证车辆类型',
    '行驶证所有人',
    '行驶证使用性质',
    '备注',
  ]));

  for (const vehicle of vehicles) {
    const license = parseDrivingLicenseMeta(vehicle.drivingLicenseMeta);
    sections.push(csvRow([
      vehicle.plateNo,
      vehicle.vin || '',
      vehicle.brandModel,
      vehicle.driver || '',
      vehicle.owner.name,
      statusLabels[vehicle.status] || vehicle.status,
      availabilityLabels[vehicle.availability] || vehicle.availability,
      formatDateOnly(vehicle.annualInspectionDueAt),
      license.licenseNo || '',
      license.vehicleType || '',
      license.ownerName || '',
      license.useNature || '',
      vehicle.remark || '',
    ]));
  }

  sections.push('');
  sections.push('保险');
  sections.push(csvRow([
    '车牌号',
    '保单号',
    '保险公司',
    '险种',
    '起保日',
    '到期日',
    '保费',
    '备注',
  ]));

  for (const vehicle of vehicles) {
    for (const policy of vehicle.insurancePolicies) {
      sections.push(csvRow([
        vehicle.plateNo,
        policy.policyNo,
        policy.insuranceCompany,
        policy.insuranceType,
        formatDateOnly(policy.startDate),
        formatDateOnly(policy.endDate),
        Number(policy.premium),
        policy.remark || '',
      ]));
    }
  }

  // Loans are only exported for SUPER_ADMIN
  if (includeLoans) {
    sections.push('');
    sections.push('贷款');
    sections.push(csvRow([
      '车牌号',
      '贷款机构',
      '合同号',
      '贷款金额',
      '年化利率(%)',
      '月供',
      '起始日',
      '到期日',
      '分期次数',
      '备注',
    ]));

    for (const vehicle of vehicles) {
      for (const loan of vehicle.loans) {
        sections.push(csvRow([
          vehicle.plateNo,
          loan.lender,
          loan.contractNo || '',
          Number(loan.loanAmount),
          Number(loan.interestRate),
          Number(loan.monthlyPayment),
          formatDateOnly(loan.startDate),
          formatDateOnly(loan.endDate),
          loan.installmentCount,
          loan.remark || '',
        ]));
      }
    }

    sections.push('');
    sections.push('还款计划');
    sections.push(csvRow([
      '车牌号',
      '贷款机构',
      '合同号',
      '期数',
      '应还日',
      '月供',
      '状态',
      '实还日',
    ]));

    for (const vehicle of vehicles) {
      for (const loan of vehicle.loans) {
        for (const inst of loan.installments) {
          sections.push(csvRow([
            vehicle.plateNo,
            loan.lender,
            loan.contractNo || '',
            inst.periodNumber,
            formatDateOnly(inst.dueDate),
            Number(loan.monthlyPayment),
            installmentStatus(inst.dueDate, inst.paidAt),
            formatDateOnly(inst.paidAt),
          ]));
        }
      }
    }
  }

  return sections.join('\n') + '\n';
}
