# Data Model Architecture

## Overview
MediCore uses a comprehensive data model designed for healthcare facilities with support for multi-tenancy, clinical documentation, billing, and interoperability.

## Core Entities

### Users
```sql
users
  - id (UUID)
  - email
  - password_hash
  - role (admin, doctor, nurse, etc.)
  - tenant_id
  - created_at
  - updated_at
```

### Patients
```sql
patients
  - id (UUID)
  - first_name
  - last_name
  - date_of_birth
  - gender
  - phone
  - email
  - address (JSONB)
  - medical_aid (JSONB)
  - created_at
  - updated_at
```

### Medical Records
```sql
medical_records
  - id (UUID)
  - patient_id
  - doctor_id
  - encounter_date
  - chief_complaint
  - diagnosis
  - snomed_code
  - treatment_plan
  - notes
  - created_at
```

### Appointments
```sql
appointments
  - id (UUID)
  - patient_id
  - doctor_id
  - appointment_date
  - duration
  - type
  - status
  - notes
  - created_at
```

## Clinical Data Model

### Prescriptions
```sql
prescriptions
  - id (UUID)
  - patient_id
  - doctor_id
  - medications (JSONB)
  - issue_date
  - expiry_date
  - status
  - created_at
```

### Lab Orders
```sql
lab_orders
  - id (UUID)
  - patient_id
  - doctor_id
  - order_date
  - tests (JSONB)
  - status
  - results (JSONB)
  - created_at
```

### Vitals
```sql
vitals
  - id (UUID)
  - patient_id
  - recorded_by
  - recorded_at
  - blood_pressure
  - heart_rate
  - temperature
  - weight
  - height
  - created_at
```

## Billing Data Model

### Bills
```sql
bills
  - id (UUID)
  - patient_id
  - bill_date
  - items (JSONB)
  - total_amount
  - status
  - payment_method
  - created_at
```

### Payments
```sql
payments
  - id (UUID)
  - bill_id
  - amount
  - payment_method
  - payment_date
  - reference
  - created_at
```

### Medical Aid Claims
```sql
medical_aid_claims
  - id (UUID)
  - patient_id
  - bill_id
  - medical_aid_name
  - member_number
  - claim_amount
  - status
  - submission_date
  - created_at
```

## Patient History

### Medical History
```sql
patient_medical_history
  - id (UUID)
  - patient_id
  - condition
  - snomed_code
  - diagnosis_date
  - status
  - notes
  - created_at
```

### Family History
```sql
patient_family_history
  - id (UUID)
  - patient_id
  - relationship
  - condition
  - snomed_code
  - notes
  - created_at
```

### Social History
```sql
patient_social_history
  - id (UUID)
  - patient_id
  - smoking_status
  - alcohol_consumption
  - occupation
  - exercise_habits
  - created_at
```

## Patient Portal

### Health Goals
```sql
health_goals
  - id (UUID)
  - patient_id
  - title
  - target_value
  - current_value
  - unit
  - target_date
  - status
  - created_at
```

### PRO Questionnaires
```sql
patient_questionnaires
  - id (UUID)
  - patient_id
  - questionnaire_id
  - responses (JSONB)
  - score
  - completed_at
  - created_at
```

## Specialty Modules

### HIV Management
```sql
hiv_patients
  - id (UUID)
  - patient_id
  - hiv_status
  - art_start_date
  - current_regimen
  - viral_load
  - cd4_count
  - created_at
```

### Diabetes Management
```sql
diabetes_patients
  - id (UUID)
  - patient_id
  - diagnosis_date
  - type
  - hba1c
  - medications
  - care_plan
  - created_at
```

## Relationships

### One-to-Many
- User → Patients (doctor)
- Patient → Medical Records
- Patient → Appointments
- Patient → Prescriptions
- Patient → Bills

### Many-to-Many
- Patients ↔ Medical Aids
- Doctors ↔ Specialties
- Medications ↔ Drug Interactions

## Data Integrity

### Constraints
- Foreign key constraints
- Unique constraints
- Check constraints
- Not null constraints

### Indexes
- Primary keys
- Foreign keys
- Search fields
- Date ranges
- Status fields

## Data Types

### UUIDs
- Primary keys use UUIDs
- Better for distributed systems
- No sequential exposure

### JSONB
- Flexible schema for:
  - Addresses
  - Medical aid info
  - Medications
  - Test results
  - Metadata

### Timestamps
- Created at (automatic)
- Updated at (automatic)
- Soft deletes (deleted_at)

## Audit Trail

### Audit Logs
```sql
audit_logs
  - id (UUID)
  - entity_type
  - entity_id
  - action
  - user_id
  - changes (JSONB)
  - timestamp
```

### Access Logs
- Track all data access
- User actions
- API calls
- Security events

## Best Practices

### Design Principles
- Normalize where appropriate
- Use JSONB for flexible data
- Index frequently queried fields
- Use UUIDs for primary keys
- Maintain audit trails

### Performance
- Proper indexing
- Query optimization
- Connection pooling
- Caching strategies
- Partition large tables

