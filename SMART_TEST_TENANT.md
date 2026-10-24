# 🏥 Umoya EHR — Client Testing Access Guide

Two dedicated test tenants, each provisioned for a private clinic to trial the full Umoya EHR system end to end, with **no payment or billing restrictions of any kind.**

---

# 1. Smart Medical Test Clinic

## 💳 Payment Status: DISABLED

> **Every payment, billing-lock, and subscription-expiry gate has been switched off for this tenant.** Staff can move through the entire patient workflow — registration, consultation, prescriptions, lab orders, billing screens, claims — without ever being blocked by a payment wall, trial countdown, or subscription warning.
>
> - Subscription: **Enterprise tier, `paid` mode, active**
> - Billing expiry: set to **31 Dec 2099** (effectively never)
> - Payment lock: **explicitly waived** (`waivePaymentLock: true`)
> - Demo/trial expiry: **none configured** — this is not a time-boxed demo
>
> Testers can safely explore billing/claims *screens* to see how they look — nothing will actually block, charge, or lock the account.

## 🔑 Login Details

| Field | Value |
|---|---|
| **Clinic name** | Smart Medical Test Clinic |
| **Login URL** | https://app-173-212-195-88.sslip.io/ehr/**smart** |
| **Tenant ID** (if asked separately) | `smart` |
| **Deployment mode** | Hospital (all 36 clinical modules enabled) |
| **MFA** | Off (one less step for testers) |

## 👥 Staff Accounts

**Password for all accounts: `Umoya1#`**

| Role | Email | What they can test |
|---|---|---|
| 🧑‍⚕️ Doctor | `doctor@smart.com` | Consultations, diagnoses, prescriptions, orders |
| 👩‍⚕️ Nurse | `nurse@smart.com` | Patient intake, vitals, triage, ward tasks |
| 💰 Nurse (Accounts) | `nurse.accounts@smart.com` | Nursing + billing hybrid tasks |
| 💊 Pharmacist | `pharmacist@smart.com` | Dispensing, medication reconciliation |
| 🔬 Lab Technician | `lab@smart.com` | Lab orders, results entry |
| 📷 Radiologist | `radiologist@smart.com` | Imaging orders, reports |
| 🧾 Accounts | `accounts@smart.com` | Invoicing, claims, revenue screens |
| 📋 Receptionist | `receptionist@smart.com` | Registration, appointment booking |
| ⚙️ Admin | `admin@smart.com` | User management, clinic settings |
| 📦 Store Manager | `storemanager@smart.com` | Central storeroom, stock requests |
| 🖥️ Imaging Technologist | `technologist@smart.com` | Imaging workflow |

## 🔁 A Simple Test Flow: Nurse → Doctor (Patient Visit)

This is the core loop most clinics want to see working first. Two people (or one person switching accounts) can walk through it in about 10 minutes.

### Step 1 — Receptionist registers the patient
1. Log in as `receptionist@smart.com`
2. Register a new patient (name, DOB, contact info)
3. Book/create a visit or appointment for them

### Step 2 — Nurse does intake
1. Log in as `nurse@smart.com`
2. Find the patient on the nurse dashboard / queue
3. Record vitals (BP, temp, weight, etc.)
4. Add a triage note or chief complaint
5. Mark the patient ready for the doctor

### Step 3 — Doctor sees the patient
1. Log in as `doctor@smart.com`
2. Open the patient from the doctor's queue
3. Review the nurse's vitals/notes
4. Enter a diagnosis and clinical notes
5. Write a prescription (this will route to the pharmacist)
6. Optionally order a lab test or imaging (routes to lab tech / radiologist)

### Step 4 — Downstream staff pick it up
- **Pharmacist** (`pharmacist@smart.com`): sees the prescription, dispenses medication
- **Lab tech** (`lab@smart.com`): sees the lab order, enters results
- **Radiologist** (`radiologist@smart.com`): sees the imaging order, uploads a report

### Step 5 — Close the loop
- **Doctor** reviews lab/imaging results and finalizes the visit
- **Accounts** (`accounts@smart.com`): can view the visit's billing summary — *no payment will actually be required to complete anything*

## 💡 Tips for Testers

- All accounts are on the same tenant (`smart`) — everyone sees the same shared patient records, so the nurse→doctor handoff works exactly as it would in a real clinic.
- If a password needs resetting or a new staff member needs an account, `admin@smart.com` can manage this from **User Management**.
- Nothing here affects any other clinic's data — `smart` is fully isolated in its own database.

---

# 2. Horizon Medical Test Clinic

## 💳 Payment Status: DISABLED

> Same as above — **every payment, billing-lock, and subscription-expiry gate has been switched off for this tenant too.**
>
> - Subscription: **Enterprise tier, `paid` mode, active**
> - Billing expiry: set to **31 Dec 2099** (effectively never)
> - Payment lock: **explicitly waived** (`waivePaymentLock: true`)
> - Demo/trial expiry: **none configured** — this is not a time-boxed demo
>
> Testers can safely explore billing/claims *screens* to see how they look — nothing will actually block, charge, or lock the account.

## 🔑 Login Details

| Field | Value |
|---|---|
| **Clinic name** | Horizon Medical Test Clinic |
| **Login URL** | https://app-173-212-195-88.sslip.io/ehr/**horizon** |
| **Tenant ID** (if asked separately) | `horizon` |
| **Deployment mode** | Hospital (all 36 clinical modules enabled) |
| **MFA** | Off (one less step for testers) |

## 👥 Staff Accounts

**Password for all accounts: `Umoya1#`**

| Role | Email | What they can test |
|---|---|---|
| 🧑‍⚕️ Doctor | `doctor@horizon.com` | Consultations, diagnoses, prescriptions, orders |
| 👩‍⚕️ Nurse | `nurse@horizon.com` | Patient intake, vitals, triage, ward tasks |
| 💰 Nurse (Accounts) | `nurse.accounts@horizon.com` | Nursing + billing hybrid tasks |
| 💊 Pharmacist | `pharmacist@horizon.com` | Dispensing, medication reconciliation |
| 🔬 Lab Technician | `lab@horizon.com` | Lab orders, results entry |
| 📷 Radiologist | `radiologist@horizon.com` | Imaging orders, reports |
| 🧾 Accounts | `accounts@horizon.com` | Invoicing, claims, revenue screens |
| 📋 Receptionist | `receptionist@horizon.com` | Registration, appointment booking |
| ⚙️ Admin | `admin@horizon.com` | User management, clinic settings |
| 📦 Store Manager | `storemanager@horizon.com` | Central storeroom, stock requests |
| 🖥️ Imaging Technologist | `technologist@horizon.com` | Imaging workflow |

## 🔁 A Simple Test Flow: Nurse → Doctor (Patient Visit)

### Step 1 — Receptionist registers the patient
1. Log in as `receptionist@horizon.com`
2. Register a new patient (name, DOB, contact info)
3. Book/create a visit or appointment for them

### Step 2 — Nurse does intake
1. Log in as `nurse@horizon.com`
2. Find the patient on the nurse dashboard / queue
3. Record vitals (BP, temp, weight, etc.)
4. Add a triage note or chief complaint
5. Mark the patient ready for the doctor

### Step 3 — Doctor sees the patient
1. Log in as `doctor@horizon.com`
2. Open the patient from the doctor's queue
3. Review the nurse's vitals/notes
4. Enter a diagnosis and clinical notes
5. Write a prescription (this will route to the pharmacist)
6. Optionally order a lab test or imaging (routes to lab tech / radiologist)

### Step 4 — Downstream staff pick it up
- **Pharmacist** (`pharmacist@horizon.com`): sees the prescription, dispenses medication
- **Lab tech** (`lab@horizon.com`): sees the lab order, enters results
- **Radiologist** (`radiologist@horizon.com`): sees the imaging order, uploads a report

### Step 5 — Close the loop
- **Doctor** reviews lab/imaging results and finalizes the visit
- **Accounts** (`accounts@horizon.com`): can view the visit's billing summary — *no payment will actually be required to complete anything*

## 💡 Tips for Testers

- All accounts are on the same tenant (`horizon`) — everyone sees the same shared patient records, so the nurse→doctor handoff works exactly as it would in a real clinic.
- If a password needs resetting or a new staff member needs an account, `admin@horizon.com` can manage this from **User Management**.
- Nothing here affects any other clinic's data — `horizon` is fully isolated in its own database, completely separate from `smart`.
