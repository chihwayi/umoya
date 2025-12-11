# WHO Smart Forms Usage Guide

## 🎯 Overview

WHO Smart Forms are dynamic forms generated from FHIR Questionnaires. They support:
- ✅ Multiple question types (text, choice, boolean, date, etc.)
- ✅ Conditional logic (show/hide questions based on answers)
- ✅ Validation rules
- ✅ Nested groups (sections)
- ✅ Required fields

---

## 📋 Using Smart Forms in Your Components

### Basic Usage

```typescript
import { SmartFormSelector } from '@/components/WHOSmartForms';
import { whoSmartGuidelinesService } from '@/services/who-smart-guidelines.service';

function MyComponent() {
  const [token, setToken] = useState<string>('');
  const [tenantSlug, setTenantSlug] = useState<string>('');

  const handleFormSubmit = async (formId: string, answers: Record<string, any>) => {
    console.log('Form submitted:', formId, answers);
    // Process answers - save to database, send to API, etc.
  };

  return (
    <SmartFormSelector
      token={token}
      tenantSlug={tenantSlug}
      onFormSubmit={handleFormSubmit}
    />
  );
}
```

### Direct Form Loading

```typescript
import { FHIRQuestionnaireForm } from '@/components/WHOSmartForms';
import { whoSmartGuidelinesService } from '@/services/who-smart-guidelines.service';

function MyComponent() {
  const [form, setForm] = useState<SmartForm | null>(null);

  useEffect(() => {
    loadForm();
  }, []);

  const loadForm = async () => {
    const formData = await whoSmartGuidelinesService.getSmartForm(
      'art-initiation',
      token,
      tenantSlug
    );
    if (formData) {
      setForm(formData);
    }
  };

  if (!form) {
    return <div>Loading...</div>;
  }

  return (
    <FHIRQuestionnaireForm
      form={form}
      onSubmit={(answers) => {
        console.log('Answers:', answers);
        // Process answers
      }}
    />
  );
}
```

---

## 🔧 Integration Examples

### Example 1: Add to Appointment Notes

```typescript
// In AppointmentNotes.tsx
import { SmartFormSelector } from '@/components/WHOSmartForms';

function AppointmentNotes() {
  const [showSmartForm, setShowSmartForm] = useState(false);

  return (
    <div>
      {/* Existing appointment notes form */}
      
      <button onClick={() => setShowSmartForm(true)}>
        Use WHO Smart Form
      </button>

      {showSmartForm && (
        <SmartFormSelector
          token={token}
          tenantSlug={tenantSlug}
          onFormSubmit={(formId, answers) => {
            // Populate appointment notes with form answers
            setChiefComplaint(answers['chief-complaint'] || '');
            setHistoryOfPresentIllness(answers['history'] || '');
            // ... etc
            setShowSmartForm(false);
          }}
          onFormCancel={() => setShowSmartForm(false)}
        />
      )}
    </div>
  );
}
```

### Example 2: HIV Module Integration

```typescript
// In HIV visit form
import { SmartFormSelector } from '@/components/WHOSmartForms';

function HIVVisitForm() {
  return (
    <div>
      <h2>HIV Clinical Visit</h2>
      
      {/* WHO Smart Form for ART Initiation */}
      <SmartFormSelector
        token={token}
        tenantSlug={tenantSlug}
        selectedFormId="art-initiation"
        onFormSubmit={async (formId, answers) => {
          // Save to HIV visit
          await saveHIVVisit({
            ...answers,
            visitType: 'art_initiation',
          });
        }}
      />
    </div>
  );
}
```

### Example 3: Standalone Form Page

```typescript
// pages/SmartForms.tsx
import { SmartFormSelector } from '@/components/WHOSmartForms';

export default function SmartFormsPage() {
  const { token, tenantSlug } = useAuth();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">WHO Smart Forms</h1>
      <SmartFormSelector
        token={token}
        tenantSlug={tenantSlug}
        onFormSubmit={async (formId, answers) => {
          // Save form response
          await saveFormResponse(formId, answers);
          toast.success('Form submitted successfully');
        }}
      />
    </div>
  );
}
```

---

## 📊 Form Answer Structure

Form answers are returned as a flat object:

```typescript
{
  "question-1": "Answer text",
  "question-2": true,  // boolean
  "question-3": "2024-12-09",  // date
  "question-4": {  // quantity
    "value": 75,
    "unit": "kg"
  },
  "nested-question": "Answer"
}
```

---

## 🎨 Customization

### Styling

The forms use Tailwind CSS classes. You can customize by:
1. Overriding CSS classes
2. Wrapping in custom styled container
3. Using CSS modules

### Read-Only Mode

```typescript
<FHIRQuestionnaireForm
  form={form}
  onSubmit={handleSubmit}
  readOnly={true}  // Disables all inputs
  initialValues={existingAnswers}  // Pre-fill with existing data
/>
```

---

## 🔍 Supported Question Types

| Type | Input | Example |
|------|-------|---------|
| `string` | Text input | Name, address |
| `text` | Textarea | Notes, description |
| `boolean` | Yes/No radio | Pregnant? |
| `choice` | Dropdown | Select option |
| `date` | Date picker | Birth date |
| `dateTime` | DateTime picker | Appointment time |
| `time` | Time picker | Time of day |
| `integer` | Number (whole) | Age, count |
| `decimal` | Number (decimal) | Weight, height |
| `quantity` | Number + unit | 75 kg, 170 cm |
| `url` | URL input | Website link |
| `group` | Section header | Groups questions |
| `display` | Info text | Instructions |

---

## ✅ Validation

Forms automatically validate:
- ✅ Required fields
- ✅ Conditional visibility (enableWhen)
- ✅ Type checking

Validation errors are displayed below each field.

---

## 🚀 Next Steps

1. **Get WHO Smart Forms** - Contact `SMART_DAKS@who.int`
2. **Place FHIR Resources** - In `who-smart-guidelines/` directory
3. **Integrate** - Add Smart Forms to your workflows
4. **Customize** - Style and customize as needed

---

## 📚 Resources

- **Component:** `ehr-frontend/src/components/WHOSmartForms/`
- **Service:** `ehr-frontend/src/services/who-smart-guidelines.service.ts`
- **WHO Contact:** SMART_DAKS@who.int
