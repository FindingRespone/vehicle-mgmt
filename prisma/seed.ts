import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: '系统管理员',
      role: 'ADMIN',
    },
  });

  console.log('创建管理员用户:', admin);

  const memberPassword = await bcrypt.hash('member123', 10);
  
  const member = await prisma.user.upsert({
    where: { username: 'member' },
    update: {},
    create: {
      username: 'member',
      password: memberPassword,
      name: '车辆管理员',
      role: 'VEHICLE_MEMBER',
    },
  });

  console.log('创建车辆管理员用户:', member);

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
  console.log('管理员 - 用户名: admin, 密码: admin123');
  console.log('车辆管理员 - 用户名: member, 密码: member123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
