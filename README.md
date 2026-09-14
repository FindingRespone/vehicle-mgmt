# 众投物流车辆管理系统

一个基于 Next.js + PostgreSQL 的车辆管理系统，支持车辆信息管理、权限控制和数据审计。

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + Prisma ORM
- **数据库**: PostgreSQL 16
- **认证**: NextAuth.js v5 (credentials provider)
- **部署**: Docker + Docker Compose

## 功能特性

### M1 里程碑 (当前版本)

- ✅ 用户认证与角色管理
  - ADMIN (管理员): 完全权限，可管理所有车辆
  - VEHICLE_MEMBER (车辆管理员): 只能查看自己拥有或关联的车辆
  - FINANCE_READONLY (财务只读): 预留角色
- ✅ 车辆管理
  - 车辆列表 (带权限过滤)
  - 车辆详情查看
  - 车辆创建/编辑 (管理员专属)
  - 车牌号必填且唯一
  - VIN 可选
- ✅ 数据模型
  - User, Vehicle, VehicleMember, InsurancePolicy, Loan
  - Attachment, Reminder, Device, AuditLog
- ✅ 中文界面

### 待开发功能 (后续里程碑)

- GPS 定位与地图墙
- JT808 协议集成
- 保险/贷款管理
- 附件上传 (行驶证、车辆照片、保单等)
- 提醒/定时任务
- 完整财务模块

## 快速开始

### 前置要求

- Docker & Docker Compose
- Node.js 20+ (本地开发)
- 或仅 Docker (容器化运行)

### 1. 克隆项目

\`\`\`bash
git clone <repository-url>
cd vehicle-mgmt
\`\`\`

### 2. 启动服务 (Docker Compose)

\`\`\`bash
# 复制环境变量文件
cp .env.example .env

# 启动所有服务 (数据库 + Web)
docker-compose up -d

# 查看日志
docker-compose logs -f web
\`\`\`

首次启动会自动执行:
1. 安装依赖
2. 生成 Prisma Client
3. 推送数据库 schema
4. 启动开发服务器

### 3. 初始化数据 (种子数据)

\`\`\`bash
# 进入 web 容器
docker-compose exec web sh

# 运行种子脚本
npm run db:seed

# 退出容器
exit
\`\`\`

### 4. 访问系统

打开浏览器访问: http://localhost:3000

**初始账号**:
- 管理员: \`admin\` / \`admin123\`
- 车辆管理员: \`member\` / \`member123\`

## 本地开发 (不使用 Docker)

### 1. 启动 PostgreSQL

\`\`\`bash
# 仅启动数据库
docker-compose up -d postgres
\`\`\`

### 2. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 3. 配置环境变量

\`\`\`bash
cp .env.example .env
# 编辑 .env，确保 DATABASE_URL 正确
\`\`\`

### 4. 初始化数据库

\`\`\`bash
# 生成 Prisma Client
npm run db:generate

# 推送 schema 到数据库
npm run db:push

# 或使用 migration (生产推荐)
npm run db:migrate

# 运行种子数据
npm run db:seed
\`\`\`

### 5. 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

访问: http://localhost:3000

## 数据库备份

### ⚠️ 重要: 备份策略

**车辆需要行驶证和车辆照片；保单需要保单照片。续保时上传新照片会保留旧照片历史。**

**早期备份 = 拉加密转储到本地机器 (不要只存在同一台 VPS)**

### 1. 导出数据库

\`\`\`bash
# 进入数据库容器
docker-compose exec postgres sh

# 导出数据库 (在容器内)
pg_dump -U postgres vehicle_mgmt > /tmp/backup.sql

# 退出容器
exit

# 复制备份文件到本地
docker cp vehicle-mgmt-db:/tmp/backup.sql ./backup-$(date +%Y%m%d-%H%M%S).sql
\`\`\`

### 2. 压缩并加密备份 (推荐)

\`\`\`bash
# 压缩
gzip backup-*.sql

# 加密 (需要 gpg)
gpg --symmetric --cipher-algo AES256 backup-*.sql.gz

# 推荐: 将 .gpg 文件下载到本地或其他服务器
scp backup-*.sql.gz.gpg user@local-machine:/path/to/backups/
\`\`\`

### 3. 恢复数据库

\`\`\`bash
# 解密 (如果已加密)
gpg backup-*.sql.gz.gpg

# 解压
gunzip backup-*.sql.gz

# 进入数据库容器并导入
docker cp backup-*.sql vehicle-mgmt-db:/tmp/restore.sql
docker-compose exec postgres psql -U postgres -d vehicle_mgmt -f /tmp/restore.sql
\`\`\`

## 数据模型

### 核心实体

- **User**: 用户账号与角色
- **Vehicle**: 车辆信息 (plateNo 唯一必填, vin 可选)
  - status: IN_USE | MAINTENANCE | STOPPED | DISPOSING
  - availability: AVAILABLE | RISK | UNAVAILABLE
  - 预留 GPS 字段: lastLat, lastLng, lastLocateAt (Phase 2)
- **VehicleMember**: 车辆成员关联
- **InsurancePolicy**: 保险保单
- **Loan**: 贷款信息
- **Attachment**: 附件 (支持软删除和版本历史)
  - category: DRIVING_LICENSE | VEHICLE_PHOTO | INSURANCE | LOAN_CONTRACT | OTHER
  - 支持 deletedAt 软删除
  - 支持 supersededAt 历史版本
- **Reminder**: 提醒事项
- **Device**: 设备 (预留 GPS/JT808)
- **AuditLog**: 审计日志

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DATABASE_URL | PostgreSQL 连接字符串 | \`postgresql://postgres:postgres@localhost:5432/vehicle_mgmt\` |
| NEXTAUTH_URL | NextAuth 回调 URL | \`http://localhost:3000\` |
| NEXTAUTH_SECRET | NextAuth 密钥 (生产环境必须修改) | \`change-this-to-a-random-secret-in-production\` |

## 常用命令

\`\`\`bash
# Docker Compose
docker-compose up -d          # 启动服务
docker-compose down           # 停止服务
docker-compose logs -f        # 查看日志
docker-compose exec web sh    # 进入 web 容器

# Prisma
npm run db:generate           # 生成 Prisma Client
npm run db:push               # 推送 schema (开发)
npm run db:migrate            # 运行 migration (生产)
npm run db:seed               # 运行种子数据

# Next.js
npm run dev                   # 开发模式
npm run build                 # 构建生产版本
npm run start                 # 启动生产服务器
npm run lint                  # 代码检查
\`\`\`

## 项目结构

\`\`\`
.
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # 需要认证的页面
│   │   ├── layout.tsx        # Dashboard 布局
│   │   └── vehicles/         # 车辆管理页面
│   ├── api/                  # API 路由
│   │   ├── auth/             # NextAuth 端点
│   │   └── vehicles/         # 车辆 CRUD API
│   ├── login/                # 登录页面
│   ├── globals.css           # 全局样式
│   ├── layout.tsx            # 根布局
│   └── page.tsx              # 首页 (重定向)
├── components/               # React 组件
│   ├── Navbar.tsx            # 导航栏
│   └── VehicleForm.tsx       # 车辆表单
├── lib/                      # 工具库
│   ├── auth.ts               # NextAuth 配置
│   ├── auth.types.ts         # 类型定义
│   └── prisma.ts             # Prisma 客户端
├── prisma/                   # Prisma 配置
│   ├── schema.prisma         # 数据库 schema
│   └── seed.ts               # 种子数据
├── docker-compose.yml        # Docker 编排
├── Dockerfile                # 容器构建配置
├── .env.example              # 环境变量模板
├── next.config.ts            # Next.js 配置
├── tailwind.config.ts        # Tailwind 配置
├── tsconfig.json             # TypeScript 配置
└── package.json              # 依赖管理
\`\`\`

## 权限控制

| 角色 | 车辆列表 | 车辆详情 | 创建车辆 | 编辑车辆 | 删除车辆 |
|------|---------|---------|---------|---------|---------|
| ADMIN | 所有车辆 | ✅ | ✅ | ✅ | ✅ |
| VEHICLE_MEMBER | 拥有/关联车辆 | ✅ (限自己) | ❌ | ❌ | ❌ |
| FINANCE_READONLY | 待实现 | - | ❌ | ❌ | ❌ |

## 注意事项

1. **生产环境部署前务必修改**:
   - \`NEXTAUTH_SECRET\`: 使用强随机字符串
   - PostgreSQL 密码 (docker-compose.yml 和 .env)
   - 数据库定期备份并下载到本地

2. **附件管理** (后续版本):
   - 车辆需要上传行驶证和车辆照片
   - 保单需要上传保单照片
   - 续保时新照片不会覆盖旧照片，通过 \`supersededAt\` 管理历史版本

3. **数据库 Migration**:
   - 开发环境: 使用 \`db:push\` 快速同步
   - 生产环境: 使用 \`db:migrate\` 并保留 migration 历史

4. **安全建议**:
   - 使用 HTTPS (生产环境)
   - 定期更新依赖
   - 启用 PostgreSQL SSL 连接
   - 配置防火墙规则

## 许可证

[根据项目需求填写]

## 支持

如有问题请提交 Issue 或联系开发团队。
