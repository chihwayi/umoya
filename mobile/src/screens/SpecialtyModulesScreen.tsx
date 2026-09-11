import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { IconName } from '../design/icons';

interface ModuleItem {
  route: string;
  label: string;
  icon: IconName;
  /** True if this screen requires a specific patient — routes through the picker first. */
  needsPatient?: boolean;
  idParam?: string;
  nameParam?: string;
}

interface ModuleGroup {
  title: string;
  items: ModuleItem[];
}

// Screens like CathLabAi (caseId) and NicuKmc/NicuDrugDose (admissionId) need a
// specific case/admission, not just a patient — they're reached by drilling into
// CathLabScreen / NicuAdmissionScreen instead, so they're intentionally not listed here.
// HbotSession (needs a courseId) has no mobile course-list screen yet — left out until built.

const DOCTOR_GROUPS: ModuleGroup[] = [
  {
    title: 'Telemedicine',
    items: [
      { route: 'DoctorTelemedicine', label: 'My Consultations', icon: 'telehealth' },
    ],
  },
  {
    title: 'Critical Care',
    items: [
      { route: 'IcuBed',        label: 'ICU Census',       icon: 'pulse' },
      { route: 'IcuAlerts',     label: 'ICU Alerts',       icon: 'alert' },
      { route: 'NicuCensus',    label: 'NICU',             icon: 'baby' },
      { route: 'NicuFollowup',  label: 'NICU Follow-up',   icon: 'calendar', needsPatient: true },
    ],
  },
  {
    title: 'Cardiology & Dialysis',
    items: [
      { route: 'CathLab',       label: 'Cath Lab',          icon: 'zap' },
      { route: 'DialysisSession', label: 'Dialysis Sessions', icon: 'flask', needsPatient: true },
      { route: 'PaedCardiology', label: 'Paed Cardiology',  icon: 'heart', needsPatient: true },
    ],
  },
  {
    title: 'Maternal & Child Health',
    items: [
      { route: 'WellBaby',           label: 'Well-Baby',        icon: 'baby', needsPatient: true },
      { route: 'VaccinationCard',    label: 'Vaccination Card', icon: 'shield', needsPatient: true },
      { route: 'NeonatalScreening',  label: 'Newborn Screening', icon: 'eye', needsPatient: true },
      { route: 'Epds',               label: 'EPDS Screening',   icon: 'brain', needsPatient: true },
      { route: 'AncCare',            label: 'ANC / PMTCT',      icon: 'heart', needsPatient: true },
    ],
  },
  {
    title: 'HIV Care',
    items: [
      { route: 'HivCare',            label: 'HIV Care & ART',   icon: 'shield', needsPatient: true },
    ],
  },
  {
    title: 'Microbiology',
    items: [
      { route: 'CultureSensitivity', label: 'Culture & Sensitivity', icon: 'virus', needsPatient: true },
      { route: 'Antibiogram',        label: 'Antibiogram',           icon: 'flask' },
    ],
  },
  {
    title: 'Specialty & Occupational',
    items: [
      { route: 'AviationCert',        label: 'Aviation Certificates', icon: 'sign', needsPatient: true, idParam: 'applicantId', nameParam: 'applicantName' },
      { route: 'Prosthetics',         label: 'Prosthetic Devices',    icon: 'users', needsPatient: true },
      { route: 'TransportDispatch',   label: 'Transport Dispatch',    icon: 'phone' },
      { route: 'AestheticsTreatment', label: 'Aesthetics Treatment',  icon: 'sparkle', needsPatient: true },
      { route: 'OccupationalMedicine', label: 'Occ. Medicine',        icon: 'briefcase' },
      { route: 'OemRtw',              label: 'Return to Work',        icon: 'check', needsPatient: true },
    ],
  },
];

const NURSE_GROUPS: ModuleGroup[] = [
  {
    title: 'Telemedicine',
    items: [
      { route: 'NurseTelemedicineQueue', label: 'Telehealth Queue', icon: 'telehealth' },
    ],
  },
  {
    title: 'Critical Care Monitoring',
    items: [
      { route: 'IcuBed',       label: 'ICU Census',    icon: 'pulse' },
      { route: 'IcuAlerts',    label: 'ICU Alerts',    icon: 'alert' },
      { route: 'NicuCensus',   label: 'NICU',          icon: 'baby' },
      { route: 'NicuFollowup', label: 'NICU Follow-up', icon: 'calendar', needsPatient: true },
    ],
  },
  {
    title: 'Maternal & Child Health',
    items: [
      { route: 'WellBaby',          label: 'Well-Baby',         icon: 'baby', needsPatient: true },
      { route: 'VaccinationCard',   label: 'Vaccination Card',  icon: 'shield', needsPatient: true },
      { route: 'NeonatalScreening', label: 'Newborn Screening', icon: 'eye', needsPatient: true },
      { route: 'AncCare',           label: 'ANC / PMTCT',       icon: 'heart', needsPatient: true },
    ],
  },
  {
    title: 'HIV Care',
    items: [
      { route: 'HivCare',           label: 'HIV Care & ART',    icon: 'shield', needsPatient: true },
    ],
  },
  {
    title: 'Microbiology',
    items: [
      { route: 'CultureSensitivity', label: 'Culture & Sensitivity', icon: 'virus', needsPatient: true },
    ],
  },
  {
    title: 'Dialysis & Transport',
    items: [
      { route: 'DialysisSession',   label: 'Dialysis Sessions', icon: 'flask', needsPatient: true },
      { route: 'TransportDispatch', label: 'Transport Dispatch', icon: 'phone' },
    ],
  },
];

interface Props {
  role: 'doctor' | 'nurse';
}

export default function SpecialtyModulesScreen({ role }: Props) {
  const navigation = useNavigation<any>();
  const groups = role === 'nurse' ? NURSE_GROUPS : DOCTOR_GROUPS;
  const accent = role === 'nurse' ? C.purple : C.teal;

  const open = (item: ModuleItem) => {
    if (item.needsPatient) {
      navigation.navigate('PatientPicker', {
        targetRoute: item.route,
        title: item.label,
        idParam: item.idParam,
        nameParam: item.nameParam,
      });
    } else {
      navigation.navigate(item.route);
    }
  };

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Specialty Modules"
        subtitle={`${groups.reduce((n, g) => n + g.items.length, 0)} modules`}
        accent={accent}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {groups.map(group => (
          <View key={group.title} style={s.group}>
            <Text style={s.groupTitle}>{group.title}</Text>
            <View style={s.grid}>
              {group.items.map(item => (
                <TouchableOpacity
                  key={item.route}
                  style={s.card}
                  activeOpacity={0.8}
                  onPress={() => open(item)}
                >
                  <View style={[s.iconWrap, { backgroundColor: `${accent}18` }]}>
                    <Icon name={item.icon} size={20} color={accent} />
                  </View>
                  <Text style={s.cardLabel} numberOfLines={2}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  content:    { padding: 16, paddingBottom: 40, gap: 20 },
  group:      { gap: 10 },
  groupTitle: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:       {
    width: '31%', minHeight: 88, backgroundColor: C.surface, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: C.border, padding: 10, alignItems: 'center',
    justifyContent: 'center', gap: 8, ...SHADOW.sm,
  },
  iconWrap:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardLabel:  { fontFamily: FONT.uiMd, fontSize: 11, color: C.text, textAlign: 'center' },
});
