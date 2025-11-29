# Patient Portal Architecture

## Overview
Separate patient-facing portal with secure account linking and minimalistic design.

## Architecture Decision: Separate Port/Subdomain ✅

**Recommendation: Separate Port (e.g., 3014) or Subdomain**

### Why Separate?
1. **Security Isolation**: Patient portal can be publicly accessible without exposing admin routes
2. **Scalability**: Can scale independently from main EHR
3. **User Experience**: Clean URL (portal.medicore.com or localhost:3014)
4. **Mobile App Ready**: Same API, different frontend
5. **Compliance**: Easier to apply different security policies

### Port Structure
- **Main EHR Frontend**: Port 3014 (staff/admin)
- **Patient Portal**: Port 3015 (patients)
- **EHR API**: Port 3013 (shared)

## User Flow

### Phase 1: Self-Registration (Public)
1. Patient visits `/register`
2. Enters:
   - Email
   - Password
   - Patient Number (MRN)
   - Date of Birth (for verification)
   - Phone (optional)
3. System creates portal account but **NOT linked** to patient record
4. Email verification sent
5. After verification → **Onboarding/Linking Page**

### Phase 2: Account Linking (Secure)
1. Patient logs in → sees "Link Your Account" page
2. Verifies identity with:
   - Patient Number
   - Date of Birth
   - National ID (optional, for extra security)
   - Phone number (optional)
3. System matches with existing patient record
4. Once verified → **Full Portal Access**

### Phase 3: Patient Portal (Minimalistic)
**Core Features:**
- Dashboard (upcoming appointments, recent visits)
- Appointments (view, book, reschedule, cancel)
- Medical Records (view only, basic info)
- Lab Results (view results)
- Prescriptions (view current medications)
- Bills & Payments (view bills, pay online)
- Messages (2-way communication with clinic)
- Vitals Monitoring (self-report vitals)
- Profile Settings

**Design Principles:**
- Clean, minimalistic UI
- Mobile-first responsive
- Easy navigation
- Clear call-to-actions
- Patient-friendly language (no medical jargon)

## Technical Stack

### Frontend (Patient Portal)
- **React** (same as main EHR for consistency)
- **Port**: 3014
- **Route**: `/patient-portal` or separate app
- **Authentication**: JWT tokens (separate from staff auth)

### Backend
- **Same EHR API** (port 3013)
- **New Routes**: `/api/patient-portal/*`
- **Patient Auth**: Separate JWT strategy for patients
- **Access Control**: Patients can only access their own data

### Mobile App (Future)
- **React Native** or **Flutter**
- **Same API endpoints**
- **Same authentication flow**
- **Mirror patient portal functionality**

## Security Considerations

1. **Account Linking Security**:
   - Multiple verification factors (DOB + Patient Number + optional ID)
   - Rate limiting on linking attempts
   - Audit log of linking actions

2. **Data Access**:
   - Patients can ONLY see their own data
   - Role-based access control (role: 'patient')
   - HIPAA-compliant access logging

3. **Communication**:
   - Secure messaging (encrypted)
   - No sensitive data in emails
   - 2FA optional for extra security

## Implementation Phases

### Phase 1: Infrastructure ✅ (Done)
- [x] Patient authentication service
- [x] Portal access fields in database
- [x] Registration/login endpoints

### Phase 2: Self-Registration Page
- [ ] Create separate React app (port 3014)
- [ ] Registration form
- [ ] Email verification flow
- [ ] Account linking page

### Phase 3: Patient Portal Core
- [ ] Dashboard
- [ ] Appointments management
- [ ] Medical records viewer
- [ ] Lab results viewer

### Phase 4: Advanced Features
- [ ] 2-way messaging
- [ ] Vitals monitoring
- [ ] Prescription refill requests
- [ ] Bill payment integration

### Phase 5: Mobile App
- [ ] React Native/Flutter setup
- [ ] Mirror portal functionality
- [ ] Push notifications

