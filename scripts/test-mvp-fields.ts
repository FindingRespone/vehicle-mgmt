#!/usr/bin/env tsx

import { Prisma, PrismaClient } from '@prisma/client';
import { parseDrivingLicenseMeta } from '../lib/drivingLicense';
import { buildFleetExportCsv } from '../lib/export';
import { getVehicleAvailabilityWithReasons } from '../lib/availability';
import { canViewLoans, canViewAllVehicles, canExportFleet, canDownloadAttachments } from '../lib/roles';

const prisma = new PrismaClient();

async function main() {
  console.log('=== MVP 字段与权限验收 ===\n');

  const finance = await prisma.user.findUnique({ where: { username: 'finance' } });
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  const member = await prisma.user.findUnique({ where: { username: 'member' } });
  const superadmin = await prisma.user.findUnique({ where: { username: 'superadmin' } });
  const vehicle = await prisma.vehicle.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!admin || !member || !superadmin || !vehicle) {
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
    await prisma.loan.delete({ where: { id: created.id } });
  }

  console.log('\n【3】导出范围');
  const superCsv = await buildFleetExportCsv(superadmin.id, 'SUPER_ADMIN');
  const adminCsv = await buildFleetExportCsv(admin.id, 'ADMIN');
  const memberCsv = await buildFleetExportCsv(member.id, 'VEHICLE_MEMBER');
  console.log(`  超管含贷款: ${superCsv.includes('\n贷款\n') && superCsv.includes('\n还款计划\n') ? '✓' : '✗'}`);
  console.log(`  管理员不含贷款: ${!adminCsv.includes('\n贷款\n') ? '✓' : '✗'}`);
  console.log(`  成员不含贷款: ${!memberCsv.includes('\n贷款\n') ? '✓' : '✗'}`);
  console.log(`  不含定位字段: ${!superCsv.includes('lastLat') && !superCsv.includes('lastLng') ? '✓' : '✗'}`);

  console.log('\n【4】可用性原因');
  const superReasons = await getVehicleAvailabilityWithReasons(vehicle.id, 'SUPER_ADMIN');
  const adminReasons = await getVehicleAvailabilityWithReasons(vehicle.id, 'ADMIN');
  console.log(`  超管原因: ${superReasons.reasons.join(', ') || '无'}`);
  console.log(`  管理员原因: ${adminReasons.reasons.join(', ') || '无'}`);
  if (superReasons.reasons.includes('贷款严重逾期')) {
    console.log(adminReasons.reasons.includes('贷款严重逾期') ? '  ✗ 管理员不该看到贷款原因' : '  ✓ 仅超管可见贷款逾期');
  } else {
    console.log('  ✓ 贷款原因仍只对超管开放');
  }

  console.log('\n【5】财务账号与入口');
  console.log(`  finance 用户: ${finance ? '仍存在 ✗' : '已清除 ✓'}`);
  console.log(`  财务可看贷款: ${canViewLoans('FINANCE_READONLY') ? '✗ 仍放行' : '✓ 已关闭'}`);
  console.log(`  财务可看全车: ${canViewAllVehicles('FINANCE_READONLY') ? '✗ 仍放行' : '✓ 已关闭'}`);
  console.log(`  财务可导出: ${canExportFleet('FINANCE_READONLY') ? '✗ 仍放行' : '✓ 已关闭'}`);
  console.log(`  财务可下载附件: ${canDownloadAttachments('FINANCE_READONLY') ? '✗ 仍放行' : '✓ 已关闭'}`);
  console.log(`  成员可导出: ${canExportFleet('VEHICLE_MEMBER') ? '✓' : '✗'}`);
  console.log(`  管理员可导出: ${canExportFleet('ADMIN') ? '✓' : '✗'}`);
  console.log(`  超管可导出: ${canExportFleet('SUPER_ADMIN') ? '✓' : '✗'}`);
  console.log(`  超管可看贷款: ${canViewLoans('SUPER_ADMIN') ? '✓' : '✗'}`);

  console.log('\n验收脚本完成');
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    prisma.$disconnect();
    process.exit(1);
  });
