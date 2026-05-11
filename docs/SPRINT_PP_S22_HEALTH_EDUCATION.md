# Sprint PP-S22 — Patient Portal: Health Education Content Browser

## Objective
Build a full health education content browser at `/education`. The backend has the `health_education_content` table populated and two endpoints ready. The patient portal has zero education UI. This sprint adds the complete browsing experience: category filtering, locale-aware content selection, article detail modal, and dashboard navigation tile.

## Background
**Backend endpoints already live:**
- `GET /patient-portal/education?category=...&language=...&limit=...&offset=...` — browse published articles
- `GET /patient-portal/education/:id` — get full article body

**Entity fields available:** `id`, `title`, `category`, `contentType` (article/video/infographic), `body` (HTML), `language`, `tags`, `isPublished`, `createdAt`

**Mobile (S19)** already has `PatientEducationScreen` with category tabs and locale-aware fetching — the portal page must match feature parity with the same visual language.

## Database Changes
None — `health_education_content` table already exists. Run `POST /admin-maintenance/tenants/repair-all` only if the table is missing from a tenant database.

## Files to Create

### `patient-portal/src/pages/HealthEducationPage.tsx`

**Page shell**
```
min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50
```
Sticky header: white/80 backdrop-blur, ChevronLeft back to dashboard.
Title: "Health Education" (text-2xl font-bold text-gray-900)
Subtitle: "Trusted health information in your language" (text-sm text-gray-600)

**Language selector** (top-right of header or just below title)
A dropdown/pill selector for locale. Options:
```
{ value: 'en', label: 'English' }
{ value: 'sw', label: 'Swahili' }
{ value: 'sn', label: 'Shona' }
{ value: 'zu', label: 'Zulu' }
{ value: 'nd', label: 'Ndebele' }
{ value: 'af', label: 'Afrikaans' }
{ value: 'fr', label: 'French' }
{ value: 'pt', label: 'Portuguese' }
```
Default to `'en'`. When changed, re-fetch articles with the new `language` param. Store selection in `localStorage` key `patient_education_locale`.

**Category tabs** (horizontally scrollable, below language selector)
Tab list:
```
All | Heart Health | Diabetes | HIV & Infectious | Maternal | Medications | Mental Health | Nutrition | General
```
Map to API `category` query param values:
```
All         → (no filter)
Heart Health → cardiology
Diabetes     → diabetes
HIV & Infectious → hiv
Maternal     → maternal
Medications  → pharmacy
Mental Health → mental_health
Nutrition    → nutrition
General      → general
```
Active tab styling: `bg-emerald-600 text-white rounded-full px-4 py-1.5 text-sm font-semibold`
Inactive tab: `bg-white border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50`

**Article grid** (`max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-4`)

Each article card:
```
bg-white rounded-2xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all
```
- Top row: `contentType` badge (pill) — "Article" (blue), "Video" (red), "Infographic" (orange) + category badge (emerald)
- Title: `text-base font-semibold text-gray-900 mt-2 line-clamp-2`
- Tags: small gray pills below title (max 3 shown)
- Footer: `text-xs text-gray-400` — published date using `format(createdAt, 'dd MMM yyyy')`
- Read more arrow: `ArrowRight` icon (text-emerald-600) at bottom-right

**Article detail modal** (full-screen slide-up modal on mobile / centered modal on desktop)
Triggered when a card is clicked. Fetches `GET /patient-portal/education/:id` if body wasn't included in list response.

Modal structure:
```
fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm
```
Inner panel:
```
bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto
```
- Drag handle (mobile): `w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4`
- Close button (X) top-right
- Article title: `text-xl font-bold text-gray-900 px-6 pt-4`
- Meta row: category badge + language flag emoji + date
- Body: render HTML using `dangerouslySetInnerHTML={{ __html: article.body }}` inside a `prose` wrapper div
  - Add `className="prose prose-sm max-w-none text-gray-700 px-6 pb-8 mt-4"` (requires `@tailwindcss/typography` plugin — add it to tailwind.config.js if not present, otherwise use plain text rendering with `whitespace-pre-wrap`)
  - **If `@tailwindcss/typography` is not installed**: render as `<div className="text-sm text-gray-700 leading-relaxed px-6 pb-8 mt-4" dangerouslySetInnerHTML={{ __html: article.body }} />`
- Share button at bottom: copies URL to clipboard (`${window.location.origin}/${tenantSlug}/education/${article.id}`) with toast confirmation

**Search bar** (optional but recommended — place above category tabs)
Text input: `bg-white border border-gray-200 rounded-xl px-4 py-2.5 w-full text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500`
Debounced 400ms — pass as `search` query param if backend supports it (check if it does; if not, filter client-side on title/tags).

**Loading state**: grid of 6 skeleton cards (`animate-pulse bg-gray-100 rounded-2xl h-40`)

**Empty state**:
```jsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
    <BookOpen className="w-10 h-10 text-emerald-400" />
  </div>
  <p className="text-gray-900 font-semibold text-lg">No articles found</p>
  <p className="text-gray-500 text-sm mt-1">Try a different category or language.</p>
</div>
```

**Pagination**: "Load more" button (loads 12 at a time).

## Files to Modify

### `patient-portal/src/services/api.ts`
Add two methods at the end of `patientPortalApi`:

```typescript
// Health Education
getEducationContent: async (
  token: string,
  tenantSlug: string,
  filters?: { category?: string; language?: string; limit?: number; offset?: number; search?: string }
) => {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.language) params.append('language', filters.language);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());
  if (filters?.search) params.append('search', filters.search);
  const response = await fetch(`${API_BASE_URL}/patient-portal/education?${params.toString()}`, {
    headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
  });
  _ensureOk(response, 'Failed to fetch education content');
  return response.json();
},

getEducationArticle: async (id: string, token: string, tenantSlug: string) => {
  const response = await fetch(`${API_BASE_URL}/patient-portal/education/${id}`, {
    headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
  });
  _ensureOk(response, 'Failed to fetch education article');
  return response.json();
},
```

### `patient-portal/src/App.tsx`
Add route:
```tsx
<Route
  path="/:tenantSlug/education"
  element={
    <ProtectedRoute requireLinked>
      <HealthEducationPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/:tenantSlug/education/:articleId"
  element={
    <ProtectedRoute requireLinked>
      <HealthEducationPage />
    </ProtectedRoute>
  }
/>
```
The `:articleId` route auto-opens the modal for that article on load (use `useParams` to detect `articleId` and pre-open the modal).

### `patient-portal/src/pages/PatientDashboard.tsx`
Add to `menuItems` array (after AI Follow-Ups):
```tsx
{ icon: BookOpen, label: 'Health Education', path: '/education', color: 'from-emerald-500 to-teal-600', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600' }
```
Import `BookOpen` from `lucide-react`.

### `patient-portal/tailwind.config.js`
If `@tailwindcss/typography` is not already in plugins, add it:
```js
plugins: [
  require('@tailwindcss/forms'),
  require('@tailwindcss/typography'),
],
```
And install: `npm install @tailwindcss/typography --save-dev` inside `patient-portal/`.

## Acceptance Criteria
- [ ] `/education` renders a grid of articles from the API
- [ ] Category tabs filter articles correctly (re-fetch on tab change)
- [ ] Language selector changes content language and persists in localStorage
- [ ] Clicking an article card opens the detail modal with full HTML body
- [ ] "Load more" loads the next 12 articles
- [ ] `/education/:articleId` deep-link auto-opens the article modal
- [ ] Empty state renders when no articles match
- [ ] Health Education tile visible on dashboard and navigates correctly
- [ ] Color system matches platform: emerald/teal for education feature accent, indigo buttons, white cards
- [ ] No hardcoded tenant slugs in this file
