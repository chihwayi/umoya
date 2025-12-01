# Sprint 19: Document Management UI

## Overview
Complete document management system with file upload, versioning, search, and organization. The database schema already exists (`patient_documents` table), but the UI is missing.

## Goals
- Enable file uploads for clinical documents
- Organize documents by category/type
- Support document versioning
- Enable document search and filtering
- Allow document sharing between providers
- Support document signing/approval workflow

---

## Database Schema

### Existing Table (Already in Schema)
```sql
-- patient_documents table already exists in schema
-- We'll enhance it with additional fields if needed
```

### Document Versions Table
```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path VARCHAR(500),
  file_url TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  change_summary TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_document_versions_is_current ON document_versions(is_current);
```

### Document Sharing Table
```sql
CREATE TABLE document_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES users(id),
  shared_with_role VARCHAR(50), -- If shared with role instead of user
  permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('view', 'download', 'edit')),
  shared_by UUID REFERENCES users(id),
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_document_sharing_document_id ON document_sharing(document_id);
CREATE INDEX idx_document_sharing_user_id ON document_sharing(shared_with_user_id);
```

### Document Signatures Table
```sql
CREATE TABLE document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES users(id),
  signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
    'electronic',
    'digital',
    'wet_signature_scan'
  )),
  signature_data TEXT, -- Base64 encoded signature image or digital signature
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_document_signatures_document_id ON document_signatures(document_id);
CREATE INDEX idx_document_signatures_signer_id ON document_signatures(signer_id);
```

### Document Tags Table
```sql
CREATE TABLE document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, tag_name)
);

CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX idx_document_tags_tag_name ON document_tags(tag_name);
```

### Document Access Log Table
```sql
CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES patient_documents(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES users(id),
  access_type VARCHAR(50) NOT NULL CHECK (access_type IN ('view', 'download', 'edit', 'delete')),
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_accessed_by ON document_access_log(accessed_by);
CREATE INDEX idx_document_access_log_accessed_at ON document_access_log(accessed_at);
```

---

## Backend Services

### DocumentService
**Location:** `services/ehr-service/src/services/document.service.ts`

**Key Methods:**
- `uploadDocument(patientId, file, metadata, tenantDb)` - Upload document
- `getDocuments(patientId, filters, tenantDb)` - Get patient documents
- `getDocumentById(documentId, tenantDb)` - Get document details
- `updateDocument(documentId, updates, tenantDb)` - Update document metadata
- `deleteDocument(documentId, tenantDb)` - Delete document
- `downloadDocument(documentId, tenantDb)` - Get document download URL
- `searchDocuments(query, filters, tenantDb)` - Search documents
- `getDocumentVersions(documentId, tenantDb)` - Get version history
- `uploadNewVersion(documentId, file, changeSummary, tenantDb)` - Upload new version
- `restoreVersion(documentId, versionId, tenantDb)` - Restore to version
- `shareDocument(documentId, shareData, tenantDb)` - Share document
- `getSharedDocuments(userId, tenantDb)` - Get documents shared with user
- `signDocument(documentId, signatureData, tenantDb)` - Sign document
- `getDocumentSignatures(documentId, tenantDb)` - Get signatures
- `addTag(documentId, tagName, tenantDb)` - Add tag
- `removeTag(documentId, tagName, tenantDb)` - Remove tag
- `getDocumentAccessLog(documentId, tenantDb)` - Get access log

### FileStorageService (Enhanced)
**Location:** `services/ehr-service/src/services/file-storage.service.ts`

**Key Methods:**
- `uploadFile(file, folder, tenantDb)` - Upload file to storage
- `deleteFile(filePath, tenantDb)` - Delete file
- `getFileUrl(filePath, tenantDb)` - Get signed URL for download
- `validateFileType(file, allowedTypes)` - Validate file type
- `validateFileSize(file, maxSize)` - Validate file size

---

## API Endpoints

### Document Management
- `POST /documents/upload` - Upload document
- `GET /documents` - List documents (with filters)
- `GET /documents/:id` - Get document details
- `PUT /documents/:id` - Update document metadata
- `DELETE /documents/:id` - Delete document
- `GET /documents/:id/download` - Get download URL
- `GET /documents/search` - Search documents

### Document Versions
- `GET /documents/:id/versions` - Get version history
- `POST /documents/:id/versions` - Upload new version
- `POST /documents/:id/versions/:versionId/restore` - Restore to version
- `GET /documents/:id/versions/:versionId/download` - Download specific version

### Document Sharing
- `POST /documents/:id/share` - Share document
- `GET /documents/shared` - Get documents shared with me
- `PUT /documents/sharing/:id` - Update sharing permissions
- `DELETE /documents/sharing/:id` - Revoke sharing

### Document Signatures
- `POST /documents/:id/sign` - Sign document
- `GET /documents/:id/signatures` - Get signatures
- `GET /documents/:id/signature-status` - Check if document is signed

### Document Tags
- `POST /documents/:id/tags` - Add tag
- `DELETE /documents/:id/tags/:tagName` - Remove tag
- `GET /documents/tags` - Get all tags

### Document Access Log
- `GET /documents/:id/access-log` - Get access log

---

## Frontend Components

### DocumentUpload Component
**Location:** `ehr-frontend/src/components/DocumentUpload.tsx`

**Features:**
- Drag-and-drop file upload
- Multiple file upload
- File type validation
- File size validation
- Progress indicators
- Document metadata form (type, description, category)
- Tag assignment

### DocumentList Component
**Location:** `ehr-frontend/src/components/DocumentList.tsx`

**Features:**
- List documents with thumbnails
- Filter by type, date, tags
- Search documents
- Sort by date, name, size
- Grid/list view toggle
- Quick actions (view, download, share, delete)

### DocumentViewer Component
**Location:** `ehr-frontend/src/components/DocumentViewer.tsx`

**Features:**
- View document (PDF, images, text)
- Download document
- View version history
- View signatures
- View access log
- Share document
- Add tags
- Delete document

### DocumentVersionHistory Component
**Location:** `ehr-frontend/src/components/DocumentVersionHistory.tsx`

**Features:**
- List all versions
- Compare versions
- Restore to version
- Download specific version
- View change summary

### DocumentSharing Component
**Location:** `ehr-frontend/src/components/DocumentSharing.tsx`

**Features:**
- Share with users/roles
- Set permission levels
- Set expiration date
- View shared documents
- Revoke sharing

### DocumentSigning Component
**Location:** `ehr-frontend/src/components/DocumentSigning.tsx`

**Features:**
- Electronic signature pad
- Digital signature
- View signature history
- Signature verification

---

## Supported File Types

- **Documents:** PDF, DOC, DOCX, TXT, RTF
- **Images:** JPG, PNG, GIF, BMP, TIFF
- **Medical:** DICOM (via imaging viewer)
- **Spreadsheets:** XLS, XLSX, CSV
- **Other:** ZIP (for multiple files)

---

## File Storage

- **Development:** Local file system
- **Production:** MinIO/S3 compatible storage
- **Organization:** `/tenants/{tenantId}/patients/{patientId}/documents/`
- **Naming:** `{documentId}_{version}_{timestamp}.{ext}`

---

## Security Features

- File type validation
- File size limits (configurable)
- Virus scanning (optional integration)
- Access control (role-based)
- Audit logging (all access tracked)
- Encryption at rest
- Signed URLs for downloads

---

## Integration Points

- **Patient Service** - Link to patient records
- **Appointment Service** - Attach to appointments
- **Medical Records Service** - Link to clinical notes
- **Notification Service** - Notify on upload/share
- **Audit Service** - Log all document access

---

## Testing Checklist

- [ ] Upload single document
- [ ] Upload multiple documents
- [ ] View document
- [ ] Download document
- [ ] Update document metadata
- [ ] Delete document
- [ ] Upload new version
- [ ] Restore to previous version
- [ ] Share document
- [ ] Sign document
- [ ] Add/remove tags
- [ ] Search documents
- [ ] Filter documents
- [ ] View access log


---

---

## ⚠️ **CRITICAL IMPLEMENTATION GUIDELINES**

### **Database Provisioning**
- ✅ **ALWAYS provision database changes** - If database schema is modified, MUST provision it
- ✅ **Execute on bulawayo-general tenant** - All database changes MUST be tested on `bulawayo-general` tenant
- ✅ **Use provisioning bundle** - Add to `database-provisioning.service.ts` as a new bundle
- ✅ **Create provisioning script** - Create script in `scripts/` folder to apply to specific tenant

### **UI/UX Standards**
- ✅ **Follow existing component patterns** - Match UI/UX of existing components (DoctorDashboard, PatientPortal, etc.)
- ✅ **Use consistent styling** - Follow Tailwind CSS patterns already established
- ✅ **Polish all interfaces** - Ensure professional, modern UI matching existing quality
- ⚠️ **NEVER use default JavaScript alerts** - Always use modern UI components (ConfirmDialog, GlobalNotification) instead of `alert()`, `confirm()`, or `window.alert()`

### **Feature Completeness**
- ✅ **Complete feature sets** - If doctor feature needs nurse/patient features, implement ALL together
- ✅ **Do not move forward** - Complete all related features before moving to next item
- ✅ **Test end-to-end** - Test complete workflows across all user roles

### **Implementation Order**
1. Database schema → Provision → Test on bulawayo-general
2. Backend services → API endpoints
3. Frontend components (all roles if needed) → Polish UI/UX
4. Integration testing → End-to-end workflows
5. Documentation update


---

## Estimated Effort: 4-5 weeks

