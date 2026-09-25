// Maps an EHR user role to the tenant-scoped dashboard route they should land
// on after authenticating. Shared by EHRLogin (post-login redirect and the
// already-authenticated guard) and ImpersonationLanding so the role→route
// mapping is defined in exactly one place.
export const roleToRoute = (tenantSlug: string, role: string): string => {
  switch (role) {
    case 'doctor':
      return `/ehr/${tenantSlug}/doctor`;
    case 'radiologist':
      return `/ehr/${tenantSlug}/radiologist`;
    case 'lab_tech':
    case 'lab_technician':
      return `/ehr/${tenantSlug}/lab`;
    case 'nurse':
    case 'nurse_accounts':
      return `/ehr/${tenantSlug}/nurse`;
    default:
      return `/ehr/${tenantSlug}/dashboard`;
  }
};
