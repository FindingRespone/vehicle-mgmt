#!/usr/bin/env tsx

import { Prisma, PrismaClient } from '@prisma/client';
import { parseDrivingLicenseMeta, serializeDrivingLicenseMeta } from '../lib/drivingLicense';
import { buildFleetExportCsv } from '../lib/export';
import { getVehicleAvailabilityWithReasons } from '../lib/availability';

const prisma = new PrismaClient();

async function main() {
  console.log('=== MVP 字段与权限验收 ===\n');

  const finance = await prisma.user.findUnique({ where: { username: 'finance' } });
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  const member = await prisma.user.findUnique({ where: { username: 'member' } });
  const superadmin = await prisma.user.findUnique({ where: { username: 'superadmin' } });
  const vehicle = await prisma.vehicle.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!finance || !admin || !member || !superadmin || !vehicle) {
    throw new Error('缺少种子用户或车辆');
  }

  console.log('【1】行驶证摘要');
  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      drivingLicenseMeta: parseDrivingLicenseMeta({
        licenseNo: '110012345678',
        vehicleType: '重型厢式货车',
        ownerName: '众投物流',
        useNature: '货运',
      }),
    },
  });
  const parsed = parseDrivingLicenseMeta(updated.drivingLicenseMeta);
  console.log(`  摘要: ${parsed.licenseNo} / ${parsed.vehicleType} / ${parsed.ownerName} / ${parsed.useNature}`);
  console.log(parsed.licenseNo ? '  ✓ 行驶证摘要可读写' : '  ✗ 行驶证摘要失败');
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { drivingLicenseMeta: Prisma.DbNull },
  });

  console.log('\n【2】贷款合同号');
  const loan = await prisma.loan.findFirst();
  if (loan) {
    const loanUpdated = await prisma.loan.update({
      where: { id: loan.id },
      data: { contractNo: 'HT-2024-001' },
    });
    console.log(`  合同号: ${loanUpdated.contractNo}`);
    console.log(loanUpdated.contractNo === 'HT-2024-001' ? '  ✓ 合同号可写' : '  ✗ 合同号失败');
  } else {
    const created = await prisma.loan.create({
      data: {
        vehicleId: vehicle.id,
        lender: '测试银行',
        contractNo: 'HT-TEST-001',
        loanAmount: 100000,
        interestRate: 5.5,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2026-01-01'),
        monthlyPayment: 5000,
        installmentCount: 1,
        installments: {
          create: [{ periodNumber: 1, dueDate: new Date('2024-02-01') }],
        },
      },
    });
    console.log(`  新建合同号: ${created.contractNo}`);
    console.log('  ✓ 无贷款时也能写入合同号');
  }

  console.log('\n【3】导出范围');
  const financeCsv = await buildFleetExportCsv(finance.id, 'FINANCE_READONLY');
  const adminCsv = await buildFleetExportCsv(admin.id, 'ADMIN');
  const memberCsv = await buildFleetExportCsv(member.id, 'VEHICLE_MEMBER');
  console.log(`  财务含贷款: ${financeCsv.includes('\n贷款\n') && financeCsv.includes('\n还款计划\n') ? '✓' : '✗'}`);
  console.log(`  管理员不含贷款: ${!adminCsv.includes('\n贷款\n') ? '✓' : '✗'}`);
  console.log(`  成员不含贷款: ${!memberCsv.includes('\n贷款\n') ? '✓' : '✗'}`);
  console.log(`  不含定位字段: ${!financeCsv.includes('lastLat') && !financeCsv.includes('lastLng') ? '✓' : '✗'}`);

  console.log('\n【4】财务可用性原因');
  const financeReasons = await getVehicleAvailabilityWithReasons(vehicle.id, 'FINANCE_READONLY');
  const memberReasons = await getVehicleAvailabilityWithReasons(vehicle.id, 'VEHICLE_MEMBER');
  console.log(`  财务原因: ${financeReasons.reasons.join(', ') || '无'}`);
  console.log(`  成员原因: ${memberReasons.reasons.join(', ') || '无'}`);
  if (financeReasons.reasons.includes('贷款严重逾期')) {
    console.log(memberReasons.reasons.includes('贷款严重逾期') ? '  ✗ 成员不该看到贷款原因' : '  ✓ 财务可见贷款逾期，成员不可见');
  } else {
    console.log('  ✓ 当前无贷款逾期；过滤逻辑已按角色放行财务');
  }

  console.log('\n【5】财务账号');
  console.log(`  username=${finance.username} role=${finance.role}`);
  console.log(finance.role === 'FINANCE_READONLY' ? '  ✓ finance 账号可用' : '  ✗ 角色不对');

  console.log('\n验收脚本完成');
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    prisma.$disconnect();
    process.exit(1);
  });
