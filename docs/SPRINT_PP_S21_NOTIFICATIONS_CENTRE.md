# Sprint PP-S21 — Patient Portal: Notifications Centre

## Objective
Replace the inline bell-dropdown on the dashboard with a full dedicated `/notifications` route that patients can browse, filter, mark read, and delete. The bell dropdown on the header remains as a quick-glance preview (top 5), but a "See all" link drives patients to the full page.

## Background
The backend already has three working endpoints:
- `GET  /patient-portal/notifications` (supports `?read=true/false&notificationType=...&limit=...`)
- `PUT  /patient-portal/notifications/:id/read`
- `PUT  /patient-portal/notifications/read-all`
- `DELETE /patient-portal/notifications/:id`

The `useNotifications` hook and `GlobalNotification` component already exist. `api.ts` has all four methods wired. What is missing is a dedicated navigable page.

## Database Changes
None — `patient_notifications` table already provisioned.

## Files to Create

### `patient-portal/src/pages/NotificationsPage.tsx`
Full notifications inbox page. Requirements:

**Page shell**
```
min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50
```
- Sticky header bar (same style as PatientDashboard header): white/80 backdrop-blur, shadow-sm, border-b border-gray-200/50
- Back arrow button (ChevronLeft from lucide-react) → navigates to `/${tenantSlug}/dashboard`
- Title: "Notifications" (text-2xl font-bold text-gray-900)
- Right side: "Mark all read" button (`text-indigo-600 hover:text-indigo-700 text-sm font-semibold`, only shown when `unreadCount > 0`)

**Filter tabs** (horizontal scrollable tab strip below header)
Tab options: All | Unread | Appointments | Medications | Lab Results | Billing | Clinical | System
- Active tab: `bg-indigo-600 text-white rounded-full px-4 py-1.5 text-sm font-semibold`
- Inactive tab: `bg-white border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50`
- When a tab other than "All" is selected, pass `notificationType` (lowercase, map tab label to API value) or `read=false` for Unread

**Notification card** (one per notification in a vertical list, gap-3, max-w-2xl mx-auto px-4 py-6)
- `bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-start gap-3`
- Unread: add left border `border-l-4 border-indigo-500` and `bg-indigo-50/30`
- Left icon column: 40×40 rounded-xl with gradient background per type:
  - `appointment` → `from-blue-500 to-blue-600` + Calendar icon
  - `medication` / `prescription` → `from-purple-500 to-purple-600` + Pill icon
  - `lab_result` → `from-emerald-500 to-emerald-600` + FlaskConical icon
  - `billing` / `payment` → `from-yellow-500 to-yellow-600` + CreditCard icon
  - `clinical` / `alert` → `from-red-500 to-red-600` + AlertCircle icon
  - default → `from-indigo-500 to-indigo-600` + Bell icon
- Middle column (flex-1):
  - Title: `text-sm font-semibold text-gray-900`
  - Body/message: `text-sm text-gray-600 mt-0.5 line-clamp-2`
  - Timestamp: `text-xs text-gray-400 mt-1` using `formatDistanceToNow` from date-fns
- Right column: action buttons
  - If unread: "Mark read" button (small, text-indigo-600)
  - Delete button: Trash2 icon (text-gray-400 hover:text-red-500), show confirmation before delete

**Empty state**
```
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
    <Bell className="w-10 h-10 text-indigo-400" />
  </div>
  <p className="text-gray-900 font-semibold text-lg">All caught up</p>
  <p className="text-gray-500 text-sm mt-1">No notifications here.</p>
</div>
```

**Loading state**: 4 skeleton cards (animate-pulse, `bg-gray-200 rounded-xl h-20 w-full`)

**Pagination**: load 20 at a time, "Load more" button at bottom (`bg-white border border-gray-200 text-gray-700 rounded-xl px-6 py-2 hover:bg-gray-50`)

**Data fetching**
- On mount: `patientPortalApi.getNotifications(token, tenantSlug, { limit: 20 })`
- On filter change: re-fetch with appropriate params
- On mark-read: optimistic update in local state, then API call
- On delete: optimistic removal from list, then API call with toast on error

## Files to Modify

### `patient-portal/src/services/api.ts`
No changes needed — all 4 methods already exist.

### `patient-portal/src/App.tsx`
Add route inside the protected section:
```tsx
<Route
  path="/:tenantSlug/notifications"
  element={
    <ProtectedRoute requireLinked>
      <NotificationsPage />
    </ProtectedRoute>
  }
/>
```
Import `NotificationsPage` at top.

### `patient-portal/src/pages/PatientDashboard.tsx`
1. In the bell dropdown, add a "See all notifications" footer link:
```tsx
<Link
  to={`/${tenantSlug}/notifications`}
  className="block text-center py-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700 border-t border-gray-100"
  onClick={() => setShowNotifications(false)}
>
  See all notifications
</Link>
```
2. Add a "Notifications" tile to `menuItems` array:
```tsx
{ icon: Bell, label: 'Notifications', path: '/notifications', color: 'from-violet-500 to-violet-600', bgColor: 'bg-violet-50', textColor: 'text-violet-600' }
```

## Acceptance Criteria
- [ ] `/notifications` route renders and is accessible from dashboard bell icon and nav tile
- [ ] All tab filters load correct notification subsets from the API
- [ ] Marking a single notification read turns off the unread highlight immediately
- [ ] "Mark all read" clears all highlights and the unread badge goes to 0
- [ ] Deleting a notification removes it from the list without full reload
- [ ] Empty state renders when no notifications match the filter
- [ ] Load more loads the next 20 notifications
- [ ] Bell badge on header dashboard remains functional (still uses `useNotifications` hook)
- [ ] Page uses consistent color system: indigo primary, white cards, gray-50 background
- [ ] No hardcoded tenant slugs anywhere in this file
