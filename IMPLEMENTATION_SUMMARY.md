# Loan Installment Tracking Implementation Summary

## Overview
Enhanced the loan ledger (贷款台账) feature with comprehensive installment tracking capabilities, allowing SUPER_ADMIN users to manage per-period repayment schedules for each loan.

## What Was Implemented

### 1. Database Schema Changes

**Updated `Loan` Model:**
- Added `installmentCount` field (Int, required) - tracks total number of installments
- Added relation to `installments` - array of LoanInstallment records

**New `LoanInstallment` Model:**
```prisma
model LoanInstallment {
  id            String    @id @default(cuid())
  loanId        String
  loan          Loan      @relation(fields: [loanId], references: [id], onDelete: Cascade)
  periodNumber  Int       // 1, 2, 3, ... N
  dueDate       DateTime  // When this installment is due
  paidAt        DateTime? // When it was paid (null = unpaid)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([loanId, periodNumber])
  @@index([loanId])
  @@index([dueDate])
}
```

### 2. Backend API Updates

**POST /api/vehicles/[id]/loans**
- Now requires `installmentCount` field (integer, >= 1)
- Now requires `installments` array with length matching `installmentCount`
- Each installment has: `{ dueDate: string }`
- Atomically creates loan + all installments in single transaction

**PATCH /api/vehicles/[id]/loans/[loanId]**
- Supports updating `installmentCount`
- Supports updating `installments` array
- Validates count matches array length
- Replaces all installments (delete old, create new) for simplicity

**GET /api/vehicles/[id]/loans**
- Now includes `installments` array in response
- Ordered by `periodNumber` ascending

**DELETE /api/vehicles/[id]/loans/[loanId]**
- Cascade deletes installments automatically (database constraint)

### 3. Frontend UI Enhancements

**Form Improvements:**
- Added "分期次数" (installment count) input field
- Auto-generates monthly installment dates when:
  - User enters installment count
  - User selects start date
- Displays editable grid of installment dates (第1期, 第2期, ...)
- Handles dynamic adding/removing of installments when count changes
- Validates that installment count matches the number of dates

**Display Improvements:**
- Shows "还款计划（共 N 期）" header
- Displays installments in responsive grid (2-6 columns)
- Color-coded installment cards:
  - **Green** with ✓: Paid installments (`paidAt` is set)
  - **Red** with "逾期": Overdue unpaid installments (dueDate < today, no paidAt)
  - **Gray**: Future installments (not yet due)
- Each card shows: period number + due date (月/日 format)

**Smart Date Generation:**
```typescript
// Auto-generates monthly installments from start date
generateInstallments(startDate, count) {
  for (let i = 0; i < count; i++) {
    dueDate = startDate + (i + 1) months
  }
}
```

### 4. User Experience Flow

**Creating a Loan:**
1. Click "新增贷款"
2. Fill in: lender, amount, interest rate, monthly payment
3. Select start date
4. Enter installment count (e.g., 24)
5. System auto-generates 24 monthly dates
6. Edit any individual dates as needed
7. Upload contract (optional)
8. Save → Loan + 24 installments created atomically

**Viewing Loans:**
1. Loan card shows basic info (amount, rate, monthly payment)
2. Below: "还款计划（共 24 期）"
3. Grid of 24 installment cards
4. Visual status at a glance (overdue in red, future in gray)

**Editing a Loan:**
1. Click "编辑"
2. Change installment count (e.g., 24 → 36)
3. Dates automatically adjust to 36 periods
4. Fine-tune any dates
5. Save → Old installments deleted, new ones created

### 5. Key Features

✅ **Atomic Operations**: Loan + installments saved/updated together  
✅ **Auto-Generation**: Monthly dates calculated from start date  
✅ **Full Editability**: Each installment date can be individually adjusted  
✅ **Overdue Detection**: Automatically highlights past-due unpaid installments  
✅ **Responsive UI**: Grid adapts from 2 to 6 columns based on screen size  
✅ **Permission Control**: SUPER_ADMIN only (ADMIN/MEMBER cannot see)  
✅ **Validation**: Ensures count matches array length, validates positive integers  
✅ **Future-Ready**: `paidAt` field supports marking installments as paid (UI not yet implemented)

## Files Changed

### Database
- `prisma/schema.prisma` - Added `installmentCount` to Loan, created LoanInstallment model

### Backend APIs
- `app/api/vehicles/[id]/loans/route.ts` - Updated GET/POST to handle installments
- `app/api/vehicles/[id]/loans/[loanId]/route.ts` - Updated PATCH to handle installments

### Frontend
- `components/LoanSection.tsx` - Complete UI overhaul:
  - Added installment state management
  - Added date generation logic
  - Added installment input grid
  - Added installment display grid with overdue highlighting

## Testing Checklist

### ✅ Create Loan with Installments
1. Login as `superadmin` / `superadmin123`
2. Navigate to any vehicle detail page
3. Click "新增贷款"
4. Fill required fields
5. Set installmentCount = 12
6. Set startDate = 2024-01-15
7. Verify 12 dates appear (2024-02-15, 2024-03-15, ..., 2025-01-15)
8. Edit one date manually
9. Save → Success, loan created with 12 installments

### ✅ View Installment Schedule
1. Loan card displays "还款计划（共 12 期）"
2. Grid shows 12 cards: 第1期, 第2期, ..., 第12期
3. Each card shows due date (M/D format)
4. Past dates show red + "逾期" (if not paid)
5. Future dates show gray

### ✅ Edit Installments
1. Click "编辑" on existing loan
2. Change installmentCount from 12 to 24
3. Verify 24 date inputs appear
4. Change startDate
5. Verify all 24 dates regenerate from new start date
6. Save → Success, 12 old installments deleted, 24 new ones created

### ✅ Validate Count Mismatch
1. Try to save with installmentCount = 10 but only 8 dates
2. Should show error: "请正确设置分期次数和还款日期"

### ✅ Permission Control
1. Login as `admin` / `admin123`
2. Navigate to same vehicle
3. Loan section should not appear ✓
4. Login as `member` / `member123`
5. Loan section should not appear ✓

### ✅ Existing Loans Migration
- Existing loans without installments will have `installmentCount = 1` (default from migration)
- When editing old loans, set proper installmentCount and dates

## Future Enhancements

The implementation includes groundwork for future features:

1. **Mark as Paid**: UI to set `paidAt` for each installment
   - Already in schema, just needs UI button/checkbox
   - Would turn card green with ✓

2. **Payment Tracking**: Link actual payment records to installments

3. **Reminders**: Auto-generate reminders for upcoming due dates

4. **Bulk Operations**: Mark multiple installments as paid at once

5. **Reports**: Generate payment history reports

## Migration Notes

**Database Migration File Created:**
```
prisma/migrations/20261002124849_add_loan_installments/migration.sql
```

**To Apply Migration in Production:**
```bash
npx prisma migrate deploy
```

**Or Generate Prisma Client:**
```bash
npx prisma generate
npx prisma db push
```

## Deployment Verification

After deploying:

1. Run database migration
2. Login as SUPER_ADMIN
3. Create a new loan with installments
4. Verify installments display correctly
5. Edit loan, change installment count
6. Verify old installments deleted, new ones created
7. Check that overdue installments show in red

## Technical Decisions

### Why Delete & Recreate Installments on Update?
- **Simpler Logic**: Avoids complex diff/patch logic
- **Cleaner State**: No orphaned installments
- **Atomic**: Single transaction ensures consistency
- **Trade-off**: Loses `paidAt` history when editing (can be addressed if needed)

### Why Auto-Generate Monthly Dates?
- **User Convenience**: Most loans have monthly installments
- **Time-Saving**: No need to manually enter 24+ dates
- **Still Flexible**: All dates remain editable

### Why Grid Layout for Display?
- **Dense Information**: Shows many installments without scrolling
- **Visual Scanning**: Easy to spot overdue payments at a glance
- **Responsive**: Works on mobile and desktop

### Why No "Mark as Paid" UI Yet?
- **Scope**: User requested minimum viable installment tracking
- **Future-Ready**: Schema supports it, UI can be added incrementally
- **Priority**: Data entry (setting up installments) was higher priority

## Success Metrics

✅ SUPER_ADMIN can set installment count when creating/editing loans  
✅ Per-installment repayment dates persist and reload correctly  
✅ UI auto-suggests monthly dates (editable)  
✅ Overdue installments visually highlighted  
✅ ADMIN cannot see loans (preserved RBAC)  
✅ No regressions in insurance, 年检, driver, or attachment features  
✅ Build passes without errors  
✅ PR #4 updated with full documentation

## Commit Details

**Commit**: `ba4d8ef`
**Message**: feat: add loan installment tracking
**Branch**: cursor/add-driver-field-90ff
**PR**: [#4](https://github.com/FindingRespone/vehicle-mgmt/pull/4)

---

Implementation complete and ready for review! 🎉
