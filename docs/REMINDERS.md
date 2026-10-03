# 提醒闭环系统使用指南

## 概述

提醒闭环系统自动扫描保险、年检、贷款等到期事项，并通过站内待办和可选的 Webhook 通知相关人员及时处理。

## 功能特性

### 1. 自动扫描

日批任务每天自动扫描：
- **保险到期**：InsurancePolicy.endDate
- **年检到期**：Vehicle.annualInspectionDueAt
- **贷款还款**：LoanInstallment.dueDate（未付分期）

### 2. 分级提醒

系统在以下时间点创建提醒：
- 到期前 30 天
- 到期前 15 天
- 到期前 7 天
- 已过期（当天）

### 3. 防重机制

通过唯一键约束 `(vehicleId, sourceType, sourceId, offsetDays, channel)` 确保同一事项的相同档位提醒只创建一次。

### 4. 闭环处理

负责人在站内待办页面点击"已处理"后：
- 提醒状态变为 CONFIRMED
- 系统提示更新到期日以避免下次重复提醒
- 如果到期日变更，旧的未确认提醒自动作废

## 使用步骤

### 一、配置环境变量

在 `.env` 文件中添加：

```bash
# 必需：日批任务密钥
CRON_SECRET=your_secure_random_string_here

# 可选：Webhook 通知 URL（钉钉/企微机器人）
NOTIFY_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
```

### 二、设置定时任务

#### 方案 1：使用 cron（推荐）

编辑 crontab：
```bash
crontab -e
```

添加任务（每天早上 8 点运行）：
```cron
0 8 * * * curl -X POST https://your-domain.com/api/cron/reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  >> /var/log/reminder-cron.log 2>&1
```

#### 方案 2：使用外部定时服务

使用 GitHub Actions、Vercel Cron、或云服务商的定时任务功能调用 API。

示例 GitHub Actions（`.github/workflows/daily-reminders.yml`）：
```yaml
name: Daily Reminders
on:
  schedule:
    - cron: '0 0 * * *'  # UTC 00:00 = 北京时间 08:00
  workflow_dispatch:

jobs:
  run-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Reminder Cron
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/reminders \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### 三、处理站内待办

1. 登录系统
2. 点击导航栏的"待办提醒"
3. 查看所有未处理的提醒
4. 处理实际事项（续保、年检、还款等）
5. **重要**：在车辆管理中更新对应的到期日
6. 返回提醒页面，点击"已处理"确认

## 权限说明

| 角色 | 保险提醒 | 年检提醒 | 贷款提醒 |
|------|---------|---------|---------|
| 超级管理员 | ✓ 全部 | ✓ 全部 | ✓ 全部 |
| 管理员 | ✓ 全部 | ✓ 全部 | ✗ 无权限 |
| 车辆成员 | ✓ 所负责车辆 | ✓ 所负责车辆 | ✗ 无权限 |

**注意**：贷款提醒及金额信息仅超级管理员可见。

## API 说明

### POST /api/cron/reminders

**请求头**
```
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json
```

**响应**
```json
{
  "success": true,
  "created": 5,
  "skipped": 0,
  "total": 5
}
```

**错误响应**
- `401 Unauthorized`：密钥缺失或错误
- `500 Internal Server Error`：服务器错误

## Webhook 格式

如果配置了 `NOTIFY_WEBHOOK_URL`，系统会发送以下格式的消息：

```json
{
  "msgtype": "text",
  "text": {
    "content": "**车辆提醒汇总**\n\n今日共生成 5 条提醒，请及时处理。\n\n查看详情：https://your-domain.com/reminders"
  }
}
```

此格式兼容钉钉和企业微信机器人。

## 数据流转

```
1. 日批扫描
   ↓
2. 创建/更新提醒记录
   ↓
3. 发送 Webhook（可选）
   ↓
4. 负责人查看站内待办
   ↓
5. 处理实际事项
   ↓
6. 更新业务到期日 → 作废旧提醒
   ↓
7. 点击"已处理"确认
   ↓
8. 提醒状态变为 CONFIRMED
```

## 常见问题

### Q1: 为什么没有收到提醒？

**检查清单**：
1. 日批任务是否正常运行？查看日志或手动调用 API 测试
2. 到期日是否在 30 天内？超过 30 天不会创建提醒
3. 该档位提醒是否已经创建？唯一键防重，不会重复插入
4. 权限是否正确？车辆成员只能看到自己负责的车辆

### Q2: 已处理的提醒又出现了？

**原因**：到期日未更新。

**解决**：在确认提醒前，先在车辆管理中更新实际的到期日（续保后的新到期日、年检后的下次年检日等）。

### Q3: 如何测试提醒功能？

运行验收测试脚本：
```bash
npm run test:reminders
# 或
npx tsx scripts/test-reminders.ts
```

手动测试：
```bash
# 1. 创建一个 10 天后到期的保险单
# 2. 调用日批 API
curl -X POST http://localhost:3000/api/cron/reminders \
  -H "Authorization: Bearer test_cron_secret_12345"

# 3. 查看 /reminders 页面
```

### Q4: Webhook 通知失败怎么办？

Webhook 失败不会影响日批任务继续执行。提醒仍会写入站内待办。

**排查步骤**：
1. 检查 `NOTIFY_WEBHOOK_URL` 是否正确
2. 检查 Webhook 地址是否可访问
3. 检查消息格式是否符合机器人要求
4. 查看日批任务日志中的错误信息

### Q5: 如何自定义提醒档位？

修改 `/app/api/cron/reminders/route.ts` 中的 `offsets` 数组：

```typescript
const offsets = [30, 15, 7];  // 改为 [60, 30, 14, 7, 3, 1]
```

**注意**：修改后需要重新部署应用。

## 监控建议

### 日志监控

记录日批任务的执行结果：
- 成功创建的提醒数
- 失败的情况和原因
- Webhook 发送状态

### 告警设置

建议设置以下告警：
- 日批任务连续失败超过 2 次
- 已过期提醒数量过多（可能意味着处理不及时）
- Webhook 发送失败率超过 50%

### 指标统计

定期统计：
- 提醒触达率（创建数 vs 确认数）
- 平均处理时长（创建时间到确认时间）
- 到期事项按时完成率

## 最佳实践

1. **每天固定时间运行日批**：建议早上 8 点，给当天处理留出时间
2. **及时更新到期日**：续保/年检后立即更新系统中的到期日
3. **定期检查待办**：每天登录系统查看待办提醒
4. **保留历史记录**：不要删除已确认的提醒，便于审计和统计
5. **合理分配负责人**：确保每辆车都有明确的负责人

## 技术细节

### 数据模型

```prisma
model Reminder {
  id            String          @id @default(cuid())
  vehicleId     String
  sourceType    String          // InsurancePolicy | AnnualInspection | LoanInstallment
  sourceId      String?
  title         String
  description   String?
  dueDate       DateTime        // 业务到期日
  remindAt      DateTime        // 计划提醒日
  offsetDays    Int             // 30 | 15 | 7 | 0
  channel       String          // inbox | webhook
  status        ReminderStatus  // PENDING | SENT | CONFIRMED | SKIPPED
  payload       String?         // JSON 快照
  isCompleted   Boolean
  confirmedBy   String?
  confirmedAt   DateTime?
  sentAt        DateTime?
  
  @@unique([vehicleId, sourceType, sourceId, offsetDays, channel])
  @@index([remindAt, status])
}
```

### 唯一键说明

`(vehicleId, sourceType, sourceId, offsetDays, channel)` 确保：
- 同一车辆的同一保险单的 30 天提醒只会创建一次
- 不同档位（30/15/7/0）可以共存
- 不同通道（inbox/webhook）可以共存

## 更新日志

- 2026-10-03：初版发布，支持保险、年检、贷款提醒
