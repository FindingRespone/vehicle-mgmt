import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据...');

  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: adminPassword,
      name: '系统管理员',
      role: 'ADMIN',
    },
    create: {
      username: 'admin',
      password: adminPassword,
      name: '系统管理员',
      role: 'ADMIN',
    },
  });

  console.log('创建管理员用户:', admin);

  const memberPassword = await bcrypt.hash('member123', 10);

  const member = await prisma.user.upsert({
    where: { username: 'member' },
    update: {
      password: memberPassword,
      name: '普通成员',
      role: 'VEHICLE_MEMBER',
    },
    create: {
      username: 'member',
      password: memberPassword,
      name: '普通成员',
      role: 'VEHICLE_MEMBER',
    },
  });

  console.log('创建普通成员用户:', member);

  const superAdminPassword = await bcrypt.hash('superadmin123', 10);

  const superadmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {
      password: superAdminPassword,
      name: '超级管理员',
      role: 'SUPER_ADMIN',
    },
    create: {
      username: 'superadmin',
      password: superAdminPassword,
      name: '超级管理员',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('创建超级管理员用户:', superadmin);

  const vehicle = await prisma.vehicle.upsert({
    where: { plateNo: '京A12345' },
    update: {},
    create: {
      plateNo: '京A12345',
      brandModel: '解放J6P',
      status: 'IN_USE',
      availability: 'AVAILABLE',
      ownerUserId: admin.id,
      annualInspectionDueAt: new Date('2025-12-31'),
      remark: '示例车辆',
    },
  });

  console.log('创建示例车辆:', vehicle);

  await prisma.vehicleMember.upsert({
    where: {
      vehicleId_userId: {
        vehicleId: vehicle.id,
        userId: member.id,
      },
    },
    update: {},
    create: {
      vehicleId: vehicle.id,
      userId: member.id,
    },
  });

  console.log('车辆成员关联创建完成');
  console.log('\n初始账号信息:');
  console.log('超级管理员 - 用户名: superadmin, 密码: superadmin123');
  console.log('管理员 - 用户名: admin, 密码: admin123');
  console.log('普通成员 - 用户名: member, 密码: member123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
