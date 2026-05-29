export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  linkPath?: string;
  linkLabel?: string;
}

export interface RoleChecklist {
  role: string;
  title: string;
  steps: OnboardingStep[];
}

export const ROLE_CHECKLISTS: Record<string, RoleChecklist> = {
  receptionist: {
    role: "receptionist",
    title: "Welcome — Getting Started As A Receptionist",
    steps: [
      { id: "register_patient", label: "Register your first patient", description: "Go to Patients and click New Registration.", linkPath: "/patients/register", linkLabel: "Register Patient" },
      { id: "book_appointment", label: "Book an appointment", description: "Open the Appointments calendar and select a time slot.", linkPath: "/appointments", linkLabel: "Appointments" },
      { id: "check_queue", label: "Check the queue", description: "Open the Queue screen to see patients waiting.", linkPath: "/queue", linkLabel: "Queue" },
      { id: "confirm_payment", label: "Confirm a payment", description: "Open Billing and confirm a patient payment.", linkPath: "/billing", linkLabel: "Billing" },
    ],
  },
  nurse: {
    role: "nurse",
    title: "Welcome — Getting Started As A Nurse",
    steps: [
      { id: "open_queue", label: "Open the nurse queue", description: "See patients assigned to you or your ward.", linkPath: "/queue", linkLabel: "Queue" },
      { id: "record_vitals", label: "Record vitals", description: "Open a patient record and record vital signs.", linkPath: "/patients", linkLabel: "Patients" },
      { id: "escalate", label: "Escalate a warning sign", description: "Use the escalation button in the patient record if a vital is critical.", linkPath: "/patients", linkLabel: "Patients" },
      { id: "handover", label: "Hand over to doctor", description: "Mark the patient as ready for the doctor.", linkPath: "/queue", linkLabel: "Queue" },
    ],
  },
  doctor: {
    role: "doctor",
    title: "Welcome — Getting Started As A Doctor",
    steps: [
      { id: "open_chart", label: "Open a patient chart", description: "Select a patient from the queue or search by name.", linkPath: "/patients", linkLabel: "Patients" },
      { id: "write_note", label: "Write a consultation note", description: "Use the SOAP note or clinical template.", linkPath: "/patients", linkLabel: "Patients" },
      { id: "order_lab", label: "Order a lab test", description: "Open the Orders section and select a lab test.", linkPath: "/orders", linkLabel: "Orders" },
      { id: "prescribe", label: "Prescribe a medicine", description: "Open Prescriptions and search for a drug.", linkPath: "/prescriptions", linkLabel: "Prescriptions" },
      { id: "close_visit", label: "Close the visit", description: "Mark the encounter as complete.", linkPath: "/patients", linkLabel: "Patients" },
    ],
  },
  pharmacist: {
    role: "pharmacist",
    title: "Welcome — Getting Started As A Pharmacist",
    steps: [
      { id: "view_prescription", label: "View a prescription", description: "Open the Pharmacy queue.", linkPath: "/pharmacy", linkLabel: "Pharmacy" },
      { id: "check_stock", label: "Check drug stock", description: "Open the Stock screen and search for a drug.", linkPath: "/pharmacy/stock", linkLabel: "Stock" },
      { id: "dispense", label: "Dispense a medication", description: "Select a prescription and dispense the drug.", linkPath: "/pharmacy", linkLabel: "Pharmacy" },
    ],
  },
  lab: {
    role: "lab",
    title: "Welcome — Getting Started In The Lab",
    steps: [
      { id: "view_orders", label: "View pending lab orders", description: "Open Lab and see the order queue.", linkPath: "/lab", linkLabel: "Lab" },
      { id: "enter_results", label: "Enter results", description: "Select a test order and enter results.", linkPath: "/lab", linkLabel: "Lab" },
      { id: "flag_critical", label: "Flag a critical result", description: "Use the critical flag button if a result is out of range.", linkPath: "/lab", linkLabel: "Lab" },
    ],
  },
  accounts: {
    role: "accounts",
    title: "Welcome — Getting Started In Accounts",
    steps: [
      { id: "create_bill", label: "Create a bill", description: "Open Billing and create a new invoice.", linkPath: "/billing", linkLabel: "Billing" },
      { id: "receive_payment", label: "Receive a payment", description: "Record a cash or mobile money payment.", linkPath: "/billing", linkLabel: "Billing" },
      { id: "review_claim", label: "Review an insurance claim", description: "Open Claims and check pending claims.", linkPath: "/claims", linkLabel: "Claims" },
    ],
  },
  admin: {
    role: "admin",
    title: "Welcome — Getting Started As A Facility Admin",
    steps: [
      { id: "add_users", label: "Add staff users", description: "Open Settings and create user accounts.", linkPath: "/settings/users", linkLabel: "Users" },
      { id: "assign_roles", label: "Assign roles", description: "Set the correct role for each user.", linkPath: "/settings/users", linkLabel: "Users" },
      { id: "check_settings", label: "Check tenant settings", description: "Review facility name, logo, and contact details.", linkPath: "/settings", linkLabel: "Settings" },
      { id: "view_reports", label: "View reports", description: "Open Reports and check daily activity.", linkPath: "/reports", linkLabel: "Reports" },
    ],
  },
};

export const DEFAULT_CHECKLIST: RoleChecklist = {
  role: "default",
  title: "Welcome To Umoya",
  steps: [
    { id: "explore", label: "Explore the system", description: "Use the navigation menu to find your workspace." },
  ],
};

export function getChecklist(role?: string | null): RoleChecklist {
  if (!role) return DEFAULT_CHECKLIST;
  return ROLE_CHECKLISTS[role.toLowerCase()] ?? DEFAULT_CHECKLIST;
}