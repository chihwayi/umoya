# Universal WHO Smart Forms Integration

## Overview

WHO Smart Forms have been integrated across **ALL modules** in the EHR system, providing standardized, evidence-based clinical documentation capabilities throughout the entire application.

## Integration Architecture

### Core Components

1. **UniversalSmartFormsPanel** (`ehr-frontend/src/components/WHOSmartForms/UniversalSmartFormsPanel.tsx`)
   - Comprehensive panel displaying all available WHO Smart Forms
   - Advanced filtering by category (testing, registration, care, maternity, history, screening, treatment, referral)
   - Search functionality
   - Module-specific filtering (HIV, TB, Maternity, Clinical, All)
   - Can be rendered as modal or inline component

2. **SmartFormsFloatingButton** (`ehr-frontend/src/components/WHOSmartForms/SmartFormsFloatingButton.tsx`)
   - Floating action button for quick access to Smart Forms
   - Positionable (bottom-right, bottom-left, top-right, top-left)
   - Opens UniversalSmartFormsPanel in modal overlay
   - Minimal UI footprint

3. **GenericSmartFormWrapper** (`ehr-frontend/src/components/WHOSmartForms/GenericSmartFormWrapper.tsx`)
   - Reusable wrapper for rendering any WHO Smart Form
   - Handles form loading, submission, and error handling
   - Supports both modal and inline rendering

## Integrated Modules

### ✅ Main Doctor Dashboard
- **Location**: `ehr-frontend/src/pages/DoctorDashboard.tsx`
- **Integration**: "WHO Forms" button in Quick Actions toolbar
- **Access**: Available during any appointment
- **Module Filter**: `all` (shows all available forms)

### ✅ Cardiology Dashboard
- **Location**: `ehr-frontend/src/pages/CardiologyDashboard.tsx`
- **Integration**: Floating button (bottom-right)
- **Module Filter**: `clinical` (clinical documentation forms)

### ✅ Diabetes Management Dashboard
- **Location**: `ehr-frontend/src/pages/DiabetesManagementDashboard.tsx`
- **Integration**: Floating button (bottom-right)
- **Module Filter**: `clinical` (clinical documentation forms)

### ✅ Oncology Dashboard
- **Location**: `ehr-frontend/src/pages/OncologyDashboard.tsx`
- **Integration**: Floating button (bottom-right)
- **Module Filter**: `clinical` (clinical documentation forms)

### ✅ Ophthalmology Dashboard
- **Location**: `ehr-frontend/src/pages/OphthalmologyDashboard.tsx`
- **Integration**: Floating button (bottom-right)
- **Module Filter**: `clinical` (clinical documentation forms)

### ✅ Maternity Doctor Dashboard
- **Location**: `ehr-frontend/src/pages/MaternityDoctorDashboard.tsx`
- **Integration**: Floating button (bottom-right)
- **Module Filter**: `maternity` (maternity/PMTCT-specific forms)

### ✅ HIV Module (Previously Integrated)
- **Location**: `ehr-frontend/src/pages/HIVDoctorDashboard.tsx`, `NurseDashboard.tsx`
- **Integration**: Full workflow integration with specific forms
- **Module Filter**: `hiv` (HIV-specific forms)

### ✅ TB Module (Previously Integrated)
- **Location**: `ehr-frontend/src/pages/NurseDashboard.tsx`
- **Integration**: TB Screening tab with Smart Forms
- **Module Filter**: `tb` (TB-specific forms)

### ✅ Clinical Notes Modal (Previously Integrated)
- **Location**: `ehr-frontend/src/components/ClinicalNotesModal.tsx`
- **Integration**: Optional "Use WHO Forms" button
- **Module Filter**: `clinical` (general clinical documentation)

## Form Categories

The UniversalSmartFormsPanel automatically categorizes forms:

- **Testing** (`TestTube` icon): HIV testing, lab ordering forms
- **Registration** (`User` icon): Patient registration, enrollment forms
- **Care** (`Stethoscope` icon): Clinical visits, care documentation
- **Maternity** (`Baby` icon): PMTCT, maternity-specific forms
- **History** (`FileText` icon): History taking, reason for visit forms
- **Screening** (`Activity` icon): TB screening, health screening forms
- **Treatment** (`Heart` icon): ART initiation, treatment forms
- **Referral** (`ChevronRight` icon): Referral documentation forms

## Usage Patterns

### Pattern 1: Floating Button (Recommended for Dashboards)

```tsx
import { SmartFormsFloatingButton } from '../components/WHOSmartForms';

// In your component
<SmartFormsFloatingButton
  patientId={selectedPatient?.id}
  patientName={selectedPatient?.name}
  token={localStorage.getItem('ehr_token') || ''}
  tenantSlug={tenantSlug!}
  moduleFilter="clinical" // or 'hiv', 'tb', 'maternity', 'all'
  position="bottom-right"
  onFormSubmit={(formId, formData) => {
    // Handle form submission
    console.log('Form submitted:', formId, formData);
  }}
/>
```

### Pattern 2: Inline Panel

```tsx
import { UniversalSmartFormsPanel } from '../components/WHOSmartForms';

// In your component
<UniversalSmartFormsPanel
  patientId={patientId}
  patientName={patientName}
  token={token}
  tenantSlug={tenantSlug}
  moduleFilter="all"
  showAsModal={false}
  onFormSubmit={(formId, formData) => {
    // Handle form submission
  }}
/>
```

### Pattern 3: Modal Panel

```tsx
import { UniversalSmartFormsPanel } from '../components/WHOSmartForms';
import ModalPortal from '../components/ModalPortal';

const [showPanel, setShowPanel] = useState(false);

{showPanel && (
  <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          <UniversalSmartFormsPanel
            patientId={patientId}
            patientName={patientName}
            token={token}
            tenantSlug={tenantSlug}
            moduleFilter="all"
            showAsModal={false}
            onClose={() => setShowPanel(false)}
            onFormSubmit={(formId, formData) => {
              // Handle submission
              setShowPanel(false);
            }}
          />
        </div>
      </div>
    </div>
  </ModalPortal>
)}
```

## Module Filters

- **`all`**: Shows all available WHO Smart Forms (default)
- **`hiv`**: Filters to HIV-related forms (HIV.*)
- **`tb`**: Filters to TB-related forms (HIV.D4ScreenForTb, etc.)
- **`maternity`**: Filters to maternity/PMTCT forms (HIV.E*, HIV.F*)
- **`clinical`**: Filters to general clinical documentation forms (HIV.D1*, HIV.D8*, etc.)

## Data Flow

1. **Form Selection**: User selects a form from UniversalSmartFormsPanel
2. **Form Loading**: GenericSmartFormWrapper loads the FHIR Questionnaire via API
3. **Form Rendering**: FHIRQuestionnaireForm dynamically renders the form fields
4. **Form Submission**: User completes and submits the form
5. **Data Mapping**: Form answers are mapped to EHR data structures (if needed)
6. **API Call**: Data is sent to appropriate EHR API endpoint
7. **Storage**: Full form data is stored in `whoSmartFormData` JSONB field
8. **Success Callback**: `onFormSubmit` callback is triggered

## Benefits

1. **Consistency**: Standardized forms across all modules
2. **Evidence-Based**: WHO guidelines ensure best practices
3. **Completeness**: Structured data capture reduces missing information
4. **Interoperability**: FHIR-based forms enable data exchange
5. **Accessibility**: Available from any dashboard via floating button
6. **Flexibility**: Module-specific filtering ensures relevant forms only

## Future Enhancements

- [ ] Add form favorites/bookmarks
- [ ] Recent forms history
- [ ] Form templates/pre-filled forms
- [ ] Offline form support
- [ ] Form analytics and completion rates
- [ ] Custom form builder (if needed)
- [ ] Integration with voice consultation feature

## Technical Notes

- All Smart Forms components use the `who-smart-guidelines.service.ts` for API calls
- Forms are cached client-side for performance
- Error handling includes user-friendly notifications
- Mobile-responsive design throughout
- Supports both authenticated and unauthenticated access (with appropriate guards)

## Related Documentation

- [Complete System Integration](./COMPLETE_SYSTEM_INTEGRATION.md)
- [Smart Forms Data Flow](./SMART_FORMS_DATA_FLOW.md)
- [Smart Forms Usage Guide](./SMART_FORMS_USAGE.md)
- [HIV Module Integration](./HIV_MODULE_INTEGRATION.md)


