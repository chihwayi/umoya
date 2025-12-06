# Medication Reminder Service Fix

**Date:** December 5, 2025  
**Status:** ✅ Fixed

## Problem

The `MedicationReminderService` was throwing errors for multiple tenants:
- `column m.reminder_type does not exist`
- `column m.next_reminder_at does not exist` (some tenants had `next_send_at`)
- `column pr.is_active does not exist` (prescriptions table)
- `column pr.status does not exist` (prescriptions table)

## Root Cause

Different tenant databases have different schema versions. Some have newer columns (`reminder_type`, `timezone`, `next_reminder_at`) while others have older schemas without these columns.

## Solution

Updated `medication-reminder.service.ts` to:
1. **Check column existence** before building queries using `information_schema.columns`
2. **Dynamically build SELECT clauses** based on available columns
3. **Handle multiple timestamp column names** (`next_reminder_at` vs `next_send_at`)
4. **Handle prescription status checks** for both `is_active` and `status` columns, or skip if neither exists

## Changes Made

### 1. Column Existence Checking
```typescript
// Check which columns exist before building query
const medicationRemindersColumns = await connection.query(...);
const prescriptionsColumns = await connection.query(...);
```

### 2. Dynamic Query Building
```typescript
// Build SELECT clause based on available columns
const reminderTypeSelect = hasReminderType ? 'm.reminder_type' : "'all' as reminder_type";
const timezoneSelect = hasTimezone ? 'm.timezone' : "'Africa/Harare' as timezone";
```

### 3. Flexible Prescription Filtering
```typescript
// Build WHERE clause based on available columns
let prescriptionWhereClause = '';
if (hasPrescriptionIsActive) {
  prescriptionWhereClause = 'pr.is_active = true';
} else if (hasPrescriptionStatus) {
  prescriptionWhereClause = "pr.status = 'active'";
} else {
  prescriptionWhereClause = '1=1'; // No filtering
}
```

### 4. Timestamp Column Handling
```typescript
// Support both column names
const timestampColumn = hasNextReminderAt ? 'next_reminder_at' : 
                       (hasNextSendAt ? 'next_send_at' : null);
```

## Migration Created

Created `database/migrations/027-fix-medication-reminders.sql` to add missing columns to existing databases:
- `reminder_type` (VARCHAR(20), default 'all')
- `timezone` (VARCHAR(100), default 'Africa/Harare')
- `sent_count` (INTEGER, default 0)

## Result

✅ **All errors resolved** - The service now works with all tenant database schemas, regardless of version.

The cron job runs every minute without errors, processing medication reminders across all tenants.


