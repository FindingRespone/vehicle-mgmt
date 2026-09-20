# Insurance Expiry Tracking Implementation Summary

## Overview
Successfully implemented insurance expiry tracking features to address the user feedback: "台账界面没有过期保险事项" (the ledger/ops UI does not surface expired or soon-expiring insurance items).

## Changes Made

### 1. Dashboard (`app/(dashboard)/dashboard/page.tsx`)
**KPI Card Update:**
- Changed "即将到期保单" card to show both metrics:
  - Expired count (red): `expiredPoliciesCount`
  - Expiring count (yellow): `expiringPoliciesCount`
- Card now labeled "保险事项" (Insurance Matters)

**New Insurance Items List Section:**
- Added dedicated "保险事项" section above annual inspection list
- Two subsections:
  1. **已过期保单** (Expired Policies):
     - Red background with red border
     - Shows vehicle plate number, insurance type, company, policy number
     - Displays overdue days count
     - Sorted by most recent expiry (desc)
  2. **即将到期** (Expiring Soon, ≤30 days):
     - Yellow/orange background (orange for ≤7 days urgent)
     - Shows vehicle plate number, insurance type, company, policy number
     - Displays days remaining until expiry
     - Sorted by soonest expiry (asc)
- Each policy item links to vehicle detail page
- Empty state message when all policies are normal

**Data Queries:**
- Query expired policies: `endDate < now`
- Query expiring policies: `now <= endDate <= now+30days`
- Include vehicle data: `plateNo`, `brandModel`
- Limited to 10 items each (top 10 expired, top 10 expiring)
- Respects RBAC: VEHICLE_MEMBER only sees their assigned vehicles

### 2. Vehicle Ledger (`app/(dashboard)/vehicles/page.tsx`)
**New Insurance Status Column:**
- Added "保险" column to vehicle table
- Status badges with 4 states:
  - **已过期** (Expired, red): Any policy expired
  - **即将到期** (Expiring, yellow): Any policy expires within 30 days, none expired
  - **正常** (Normal, green): All policies expire after 30 days
  - **无保单** (No Policy, gray): No policies exist
  
**Insurance Status Filter:**
- Added dropdown filter in search form
- Options: 已过期 | 即将到期 | 正常 | 无保单
- Filter is client-side to avoid complex DB aggregations

**Helper Function:**
```typescript
getInsuranceStatus(policies): 'EXPIRED' | 'EXPIRING' | 'NORMAL' | 'NONE'
```

**Query Optimization:**
- Only fetch minimal policy data: `endDate`, `insuranceType`
- Policies included in vehicle query with select

**Pagination Updates:**
- All pagination links now include `insuranceStatusFilter` parameter

### 3. RBAC Compliance
Both dashboard and vehicle ledger respect role-based access:
- **ADMIN/SUPER_ADMIN**: See all vehicles and all policies
- **VEHICLE_MEMBER**: Only see vehicles they own or are members of

### 4. Google Font Hotfix Maintained
- Confirmed `app/layout.tsx` still uses `className="font-sans"` only
- No `next/font/google` imports

## Technical Details

**Status Calculation Logic:**
```
IF no policies → NONE
ELSE IF any policy endDate < now → EXPIRED
ELSE IF any policy endDate <= now+30days → EXPIRING
ELSE → NORMAL
```

**Time Calculations:**
- Days overdue: `Math.floor((now - endDate) / (1000*60*60*24))`
- Days remaining: `Math.floor((endDate - now) / (1000*60*60*24))`
- Urgent threshold: ≤7 days (orange color)

**Color Scheme:**
- Red: Expired, critical
- Orange: Urgent (≤7 days)
- Yellow: Warning (expiring within 30 days)
- Green: Normal
- Gray: No data

## Build Status
✅ TypeScript compilation successful
✅ Next.js build completed without errors
✅ All components render correctly

## Git Commit
```
feat: add insurance expiry tracking to dashboard and vehicle ledger

- Dashboard now shows separate sections for expired and soon-expiring insurance policies
- Updated KPI card to display both expired count (red) and expiring count (yellow)
- Added detailed insurance items list with policy info, vehicle details, and expiry status
- Vehicle table now includes insurance status column with 4 states
- Added insurance status filter to vehicle ledger
- Respects RBAC for both admin and vehicle member roles
- Kept Google-font hotfix
```

## Pull Request
Updated PR #3: https://github.com/FindingRespone/vehicle-mgmt/pull/3
Branch: `cursor/insurance-policy-mgmt-b253`

## Verification Checklist
- [x] Dashboard shows expired policies count in KPI
- [x] Dashboard shows expiring policies count in KPI
- [x] Dashboard has "保险事项" list section with both subsections
- [x] Each policy item shows: plateNo, insuranceType, company, policyNo, endDate, days
- [x] Each policy item links to vehicle detail
- [x] Vehicle table has insurance status column
- [x] Vehicle table shows 4 status badges correctly
- [x] Insurance status filter dropdown works
- [x] RBAC respected for VEHICLE_MEMBER
- [x] Layout.tsx has no Google fonts
- [x] Build succeeds
- [x] Code committed and pushed
- [x] PR updated

## Done Criteria Met
✅ Dashboard shows a list of expired + soon-expiring insurance items (not only a number)
✅ Vehicle table shows insurance status per row
✅ Member scope still respected
✅ layout.tsx still has no Google fonts
✅ Commits pushed to PR
✅ List UI exists in the files (not just claimed)
