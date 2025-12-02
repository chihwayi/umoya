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

## Document Management (Sprint 19)

### Documents
```sql
documents
  - id (UUID)
  - patient_id
  - document_type (lab_result, imaging, consent, referral, etc.)
  - file_name
  - file_path
  - file_url
  - file_size
  - mime_type
  - description
  - uploaded_by
  - uploaded_at
  - current_version
  - is_archived
  - created_at
  - updated_at
```

### Document Versions
```sql
document_versions
  - id (UUID)
  - document_id
  - version_number
  - file_path
  - file_url
  - file_size
  - mime_type
  - change_summary
  - uploaded_by
  - uploaded_at
  - is_current
  - created_at
```

### Document Sharing
```sql
document_sharing
  - id (UUID)
  - document_id
  - shared_with_user_id
  - shared_with_role
  - permission_level (view, download, edit)
  - shared_by
  - shared_at
  - expires_at
  - is_active
  - created_at
```

### Document Tags
```sql
document_tags
  - id (UUID)
  - document_id
  - tag_name
  - created_by
  - created_at
  - UNIQUE(document_id, tag_name)
```

### Document Access Log
```sql
document_access_log
  - id (UUID)
  - document_id
  - accessed_by
  - access_type (view, download, edit, delete)
  - ip_address
  - user_agent
  - accessed_at
```

## Provider Messaging (Sprint 20)

### Provider Messages
```sql
provider_messages
  - id (UUID)
  - thread_id
  - sender_id
  - recipient_id
  - recipient_role
  - recipient_team
  - subject
  - message_text
  - message_type (message, task, alert, consultation, referral, etc.)
  - priority (low, normal, high, urgent)
  - status (draft, sent, delivered, read, archived, deleted)
  - patient_id
  - appointment_id
  - related_entity_type
  - related_entity_id
  - requires_response
  - response_required_by
  - is_urgent
  - sent_at
  - delivered_at
  - read_at
  - archived_at
  - created_at
  - updated_at
```

### Message Attachments
```sql
message_attachments
  - id (UUID)
  - message_id
  - file_name
  - file_path
  - file_url
  - file_size
  - mime_type
  - uploaded_at
```

### Message Threads
```sql
message_threads
  - id (UUID)
  - subject
  - patient_id
  - related_entity_type
  - related_entity_id
  - participants (JSONB)
  - last_message_at
  - is_archived
  - created_at
  - updated_at
```

### Message Read Receipts
```sql
message_read_receipts
  - id (UUID)
  - message_id
  - read_by
  - read_at
  - UNIQUE(message_id, read_by)
```

### Message Tasks
```sql
message_tasks
  - id (UUID)
  - message_id
  - task_title
  - task_description
  - assigned_to
  - assigned_by
  - due_date
  - priority (low, normal, high, urgent)
  - status (pending, in_progress, completed, cancelled)
  - completed_at
  - completion_notes
  - created_at
  - updated_at
```

### Message Templates
```sql
message_templates
  - id (UUID)
  - name
  - category (consultation, referral, lab_result, follow_up, urgent_alert, general)
  - subject_template
  - message_template
  - variables (JSONB)
  - is_default
  - is_active
  - usage_count
  - created_by
  - created_at
  - updated_at
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
- Patient → Documents (Sprint 19)
- User → Messages (sender) (Sprint 20)
- Document → Document Versions (Sprint 19)
- Message → Message Attachments (Sprint 20)
- Message → Message Tasks (Sprint 20)

### Many-to-Many
- Patients ↔ Medical Aids
- Doctors ↔ Specialties
- Medications ↔ Drug Interactions
- Documents ↔ Users (via document_sharing) (Sprint 19)
- Users ↔ Message Threads (via participants) (Sprint 20)

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

