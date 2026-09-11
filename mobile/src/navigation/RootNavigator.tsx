import React from "react";
import { View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../stores/useAuthStore";
import { useBadgeStore } from "../stores/useBadgeStore";
import { AppState } from "react-native";
import { registerPushToken, setupNotificationListeners, clearAppBadge } from "../services/pushNotifications";
import { C } from "../design/tokens";
import { CustomTabBar } from "./TabBar";

import { TenantSelectScreen } from "../components/shared/TenantSelectScreen";
import { LoginScreen } from "../components/shared/LoginScreen";
import { LockScreen } from "../components/shared/LockScreen";
import { AccountSettingsScreen } from "../components/shared/AccountSettingsScreen";

import { DoctorRoundsScreen }    from "../components/doctor/DoctorRoundsScreen";
import { DoctorPostVisitScreen } from "../components/doctor/DoctorPostVisitScreen";
import { DoctorAIScreen } from "../components/doctor/DoctorAIScreen";
import { DoctorMessagesScreen }    from "../components/doctor/DoctorMessagesScreen";
import { DoctorEscalationScreen }  from "../components/doctor/DoctorEscalationScreen";
import CathLabScreen from "../screens/CathLabScreen";
import CathLabAiScreen from "../screens/CathLabAiScreen";
import IcuBedScreen from "../screens/IcuBedScreen";
import IcuAlertsScreen from "../screens/IcuAlertsScreen";
import NicuAdmissionScreen from "../screens/NicuAdmissionScreen";
import NicuKmcScreen from "../screens/NicuKmcScreen";
import NicuDrugDoseScreen from "../screens/NicuDrugDoseScreen";
import WellBabyScreen from "../screens/WellBabyScreen";
import VaccinationCardScreen from "../screens/VaccinationCardScreen";
import NeonatalScreeningScreen from "../screens/NeonatalScreeningScreen";
import DialysisSessionScreen from "../screens/DialysisSessionScreen";
import AviationCertScreen from "../screens/AviationCertScreen";
import HbotSessionScreen from "../screens/HbotSessionScreen";
import ProstheticsScreen from "../screens/ProstheticsScreen";
import EpdsScreen from "../screens/EpdsScreen";
import NicuFollowupScreen from "../screens/NicuFollowupScreen";
import TransportDispatchScreen from "../screens/TransportDispatchScreen";
import AestheticsTreatmentScreen from "../screens/AestheticsTreatmentScreen";
import PaedCardiologyScreen from "../screens/PaedCardiologyScreen";
import CultureSensitivityScreen from "../screens/CultureSensitivityScreen";
import AntibiogramSummaryScreen from "../screens/AntibiogramSummaryScreen";
import OccupationalMedicineScreen from "../screens/OccupationalMedicineScreen";
import OemRtwScreen from "../screens/OemRtwScreen";
import SpecialtyModulesScreen from "../screens/SpecialtyModulesScreen";
import PatientPickerScreen from "../screens/PatientPickerScreen";
import AncCareScreen from "../screens/AncCareScreen";
import HivCareScreen from "../screens/HivCareScreen";
import DoctorTelemedicineScreen from "../screens/DoctorTelemedicineScreen";
import NurseTelemedicineQueueScreen from "../screens/NurseTelemedicineQueueScreen";

import { NurseShiftScreen }  from "../components/nurse/NurseShiftScreen";
import { NurseVitalsScreen } from "../components/nurse/NurseVitalsScreen";
import { NurseMessagesScreen } from "../components/nurse/NurseMessagesScreen";
import { NurseNcdCrisisScreen } from "../components/nurse/NurseNcdCrisisScreen";
import { GrowthMeasurementScreen } from "../components/nurse/GrowthMeasurementScreen";
import { MmdScheduleScreen } from "../components/nurse/MmdScheduleScreen";

import { PatientHomeScreen }      from "../components/patient/PatientHomeScreen";
import { PatientPostVisitScreen } from "../components/patient/PatientPostVisitScreen";
import { PatientMedsScreen }  from "../components/patient/PatientMedsScreen";
import { PatientBillsScreen } from "../components/patient/PatientBillsScreen";
import { PatientHealthScreen } from "../components/patient/PatientHealthScreen";
import { PatientTelemedicineScreen } from "../components/patient/PatientTelemedicineScreen";
import { PatientAppointmentsScreen }     from "../components/patient/PatientAppointmentsScreen";
import { PatientMessagesScreen }         from "../components/patient/PatientMessagesScreen";
import { PatientNotificationsScreen }    from "../components/patient/PatientNotificationsScreen";
import { PatientAiCompanionScreen }      from "../components/patient/PatientAiCompanionScreen";
import { PatientQuestionnairesScreen } from "../components/patient/PatientQuestionnairesScreen";
import { PatientQuestionnaireDetailScreen } from "../components/patient/PatientQuestionnaireDetailScreen";
import { PatientEducationScreen } from "../components/patient/PatientEducationScreen";
import { EducationCourseScreen } from "../components/patient/EducationCourseScreen";
import { PatientFamilyAccessScreen } from "../components/patient/PatientFamilyAccessScreen";

import ReportsNavigator from "./ReportsNavigator";

const Stack       = createNativeStackNavigator();
const DoctorStack = createNativeStackNavigator();
const NurseStack = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();
const DoctorTabs  = createBottomTabNavigator();
const NurseTabs   = createBottomTabNavigator();
const PatientTabs = createBottomTabNavigator();

const DoctorTabs_ = () => {
  const inboxCount = useBadgeStore((s) => s.inboxCount);
  const doctorTabs = [
    { icon: "rounds"    as const, label: "Rounds"    },
    { icon: "sparkle"   as const, label: "PostVisit" },
    { icon: "escalate"  as const, label: "Inbox",    badge: inboxCount || undefined },
    { icon: "chat"      as const, label: "Messages"  },
    { icon: "brain"     as const, label: "AI"        },
    { icon: "trending"  as const, label: "Reports"   },
  ];

  return (
  <DoctorTabs.Navigator
    tabBar={(props) => <CustomTabBar {...props} accent={C.teal} tabs={doctorTabs} />}
    screenOptions={{ headerShown: false }}
  >
    <DoctorTabs.Screen name="DRounds"      component={DoctorRoundsScreen}     />
    <DoctorTabs.Screen name="DPostVisit"   component={DoctorPostVisitScreen}  />
    <DoctorTabs.Screen name="DEscalations" component={DoctorEscalationScreen} />
    <DoctorTabs.Screen name="DMessages"    component={DoctorMessagesScreen}   />
    <DoctorTabs.Screen name="DAI"          component={DoctorAIScreen}         />
    <DoctorTabs.Screen name="DReports"     component={ReportsNavigator}       />
  </DoctorTabs.Navigator>
  );
};

const DoctorNavigator = () => (
  <DoctorStack.Navigator screenOptions={{ headerShown: false }}>
    <DoctorStack.Screen name="DoctorTabs" component={DoctorTabs_} />
    <DoctorStack.Screen name="CathLab" component={CathLabScreen} options={{ title: 'Cath Lab', headerShown: true }} />
    <DoctorStack.Screen name="CathLabAi" component={CathLabAiScreen} options={{ title: 'CathLab AI Summary', headerShown: true }} />
    <DoctorStack.Screen name="IcuBed"    component={IcuBedScreen}     options={{ title: 'ICU Census',   headerShown: true }} />
    <DoctorStack.Screen name="IcuAlerts"   component={IcuAlertsScreen}      options={{ title: 'ICU Alerts',   headerShown: true }} />
    <DoctorStack.Screen name="NicuCensus"   component={NicuAdmissionScreen}  options={{ title: 'NICU',             headerShown: true }} />
    <DoctorStack.Screen name="NicuKmc"     component={NicuKmcScreen}        options={{ title: 'KMC Session',      headerShown: true }} />
    <DoctorStack.Screen name="NicuDrugDose" component={NicuDrugDoseScreen} options={{ title: 'NICU Drug Dosing', headerShown: true }} />
    <DoctorStack.Screen name="WellBaby" component={WellBabyScreen} options={{ title: 'Well-Baby', headerShown: true }} />
    <DoctorStack.Screen name="VaccinationCard" component={VaccinationCardScreen} options={{ title: 'Vaccination Card', headerShown: true }} />
    <DoctorStack.Screen name="NeonatalScreening" component={NeonatalScreeningScreen} options={{ title: 'Newborn Screening', headerShown: true }} />
    <DoctorStack.Screen name="DialysisSession" component={DialysisSessionScreen} options={{ title: 'Dialysis Sessions', headerShown: true }} />
    <DoctorStack.Screen name="AviationCert" component={AviationCertScreen} options={{ title: 'Aviation Certificates', headerShown: true }} />
    <DoctorStack.Screen name="HbotSession" component={HbotSessionScreen} options={{ title: 'HBOT Sessions', headerShown: true }} />
    <DoctorStack.Screen name="Prosthetics" component={ProstheticsScreen} options={{ title: 'Prosthetic Devices', headerShown: true }} />
    <DoctorStack.Screen name="Epds" component={EpdsScreen} options={{ title: 'EPDS Screening', headerShown: true }} />
    <DoctorStack.Screen name="NicuFollowup" component={NicuFollowupScreen} options={{ title: 'NICU Follow-up', headerShown: true }} />
    <DoctorStack.Screen name="TransportDispatch" component={TransportDispatchScreen} options={{ title: 'Transport Dispatch', headerShown: true }} />
    <DoctorStack.Screen name="AestheticsTreatment" component={AestheticsTreatmentScreen} options={{ title: 'Aesthetics Treatment', headerShown: true }} />
    <DoctorStack.Screen name="PaedCardiology" component={PaedCardiologyScreen} options={{ title: 'Paediatric Cardiology', headerShown: true }} />
    <DoctorStack.Screen name="CultureSensitivity" component={CultureSensitivityScreen} options={{ title: 'Culture & Sensitivity', headerShown: true }} />
    <DoctorStack.Screen name="Antibiogram" component={AntibiogramSummaryScreen} options={{ title: 'Antibiogram', headerShown: true }} />
    <DoctorStack.Screen name="OccupationalMedicine" component={OccupationalMedicineScreen} options={{ title: 'Occ. Medicine', headerShown: true }} />
    <DoctorStack.Screen name="OemRtw" component={OemRtwScreen} options={{ title: 'Return to Work', headerShown: true }} />
    <DoctorStack.Screen name="SpecialtyModules">
      {() => <SpecialtyModulesScreen role="doctor" />}
    </DoctorStack.Screen>
    <DoctorStack.Screen name="PatientPicker" component={PatientPickerScreen} />
    <DoctorStack.Screen name="AncCare" component={AncCareScreen} />
    <DoctorStack.Screen name="HivCare" component={HivCareScreen} />
    <DoctorStack.Screen name="DoctorTelemedicine" component={DoctorTelemedicineScreen} />
    <DoctorStack.Screen name="AccountSettings" component={AccountSettingsScreen} />
  </DoctorStack.Navigator>
);

const NURSE_TABS = [
  { icon: "shift"      as const, label: "Shift"    },
  { icon: "pulse"      as const, label: "Vitals"   },
  { icon: "chat"       as const, label: "Messages" },
  { icon: "stethoscope" as const, label: "NCD"     },
  { icon: "trending"   as const, label: "Reports"  },
];

const NurseTabs_ = () => (
  <NurseTabs.Navigator
    tabBar={(props) => <CustomTabBar {...props} accent={C.purple} tabs={NURSE_TABS} />}
    screenOptions={{ headerShown: false }}
  >
    <NurseTabs.Screen name="NShift"    component={NurseShiftScreen}     />
    <NurseTabs.Screen name="NVitals"   component={NurseVitalsScreen}    />
    <NurseTabs.Screen name="NMessages" component={NurseMessagesScreen}  />
    <NurseTabs.Screen name="NNcdCrisis" component={NurseNcdCrisisScreen} />
    <NurseTabs.Screen name="NReports"  component={ReportsNavigator}     />
  </NurseTabs.Navigator>
);

const NurseNavigator = () => (
  <NurseStack.Navigator screenOptions={{ headerShown: false }}>
    <NurseStack.Screen name="NurseTabs" component={NurseTabs_} />
    <NurseStack.Screen name="IcuBed"    component={IcuBedScreen}     options={{ title: 'ICU Census',   headerShown: true }} />
    <NurseStack.Screen name="IcuAlerts"   component={IcuAlertsScreen}      options={{ title: 'ICU Alerts',   headerShown: true }} />
    <NurseStack.Screen name="NicuCensus"   component={NicuAdmissionScreen}  options={{ title: 'NICU',             headerShown: true }} />
    <NurseStack.Screen name="NicuKmc"     component={NicuKmcScreen}        options={{ title: 'KMC Session',      headerShown: true }} />
    <NurseStack.Screen name="NicuFollowup" component={NicuFollowupScreen} options={{ title: 'NICU Follow-up', headerShown: true }} />
    <NurseStack.Screen name="WellBaby" component={WellBabyScreen} options={{ title: 'Well-Baby', headerShown: true }} />
    <NurseStack.Screen name="VaccinationCard" component={VaccinationCardScreen} options={{ title: 'Vaccination Card', headerShown: true }} />
    <NurseStack.Screen name="NeonatalScreening" component={NeonatalScreeningScreen} options={{ title: 'Newborn Screening', headerShown: true }} />
    <NurseStack.Screen name="DialysisSession" component={DialysisSessionScreen} options={{ title: 'Dialysis Sessions', headerShown: true }} />
    <NurseStack.Screen name="CultureSensitivity" component={CultureSensitivityScreen} options={{ title: 'Culture & Sensitivity', headerShown: true }} />
    <NurseStack.Screen name="TransportDispatch" component={TransportDispatchScreen} options={{ title: 'Transport Dispatch', headerShown: true }} />
    <NurseStack.Screen name="SpecialtyModules">
      {() => <SpecialtyModulesScreen role="nurse" />}
    </NurseStack.Screen>
    <NurseStack.Screen name="PatientPicker" component={PatientPickerScreen} />
    <NurseStack.Screen name="AncCare" component={AncCareScreen} />
    <NurseStack.Screen name="HivCare" component={HivCareScreen} />
    <NurseStack.Screen name="NurseTelemedicineQueue" component={NurseTelemedicineQueueScreen} />
    <NurseStack.Screen name="AccountSettings" component={AccountSettingsScreen} />
  </NurseStack.Navigator>
);

const PATIENT_TABS = [
  { icon: "home"       as const, label: "Home"        },
  { icon: "calendar"   as const, label: "Appointments" },
  { icon: "sparkle"    as const, label: "PostVisit"   },
  { icon: "pill"       as const, label: "Meds"        },
  { icon: "wallet"     as const, label: "Bills"        },
  { icon: "heart"      as const, label: "Health"      },
  { icon: "telehealth" as const, label: "Telehealth"  },
];

const PatientNavigator = () => (
  <PatientTabs.Navigator
    tabBar={(props) => <CustomTabBar {...props} accent={C.teal} tabs={PATIENT_TABS} />}
    screenOptions={{ headerShown: false }}
  >
    <PatientTabs.Screen name="PHHome"         component={PatientHomeScreen}         />
    <PatientTabs.Screen name="PHAppointments" component={PatientAppointmentsScreen} />
    <PatientTabs.Screen name="PHPostVisit"    component={PatientPostVisitScreen}    />
    <PatientTabs.Screen name="PHMeds"         component={PatientMedsScreen}         />
    <PatientTabs.Screen name="PHBills"        component={PatientBillsScreen}        />
    <PatientTabs.Screen name="PHHealth"       component={PatientHealthScreen}       />
    <PatientTabs.Screen name="PHTelemedicine" component={PatientTelemedicineScreen} />
  </PatientTabs.Navigator>
);

const PatientStackNavigator = () => (
  <PatientStack.Navigator screenOptions={{ headerShown: false }}>
    <PatientStack.Screen name="PatientTabs"      component={PatientNavigator}             />
    <PatientStack.Screen name="PHMessages"       component={PatientMessagesScreen}        />
    <PatientStack.Screen name="PHNotifications"  component={PatientNotificationsScreen}   />
    <PatientStack.Screen name="PHCompanion"      component={PatientAiCompanionScreen}     />
    <PatientStack.Screen name="PostVisitSummary" component={PatientPostVisitScreen as any} />
    <PatientStack.Screen name="PHQuestionnaires"      component={PatientQuestionnairesScreen}       />
    <PatientStack.Screen name="PHQuestionnaireDetail" component={PatientQuestionnaireDetailScreen as any}  />
    <PatientStack.Screen name="PHEducation" component={PatientEducationScreen} />
    <PatientStack.Screen name="PHEducationCourse" component={EducationCourseScreen} options={{ headerShown: false }} />
    <PatientStack.Screen name="PHFamilyAccess" component={PatientFamilyAccessScreen} />
    <PatientStack.Screen name="GrowthMeasurement" component={GrowthMeasurementScreen as any} options={{ title: 'Growth Measurement' }} />
    <PatientStack.Screen name="MmdSchedule" component={MmdScheduleScreen as any} options={{ title: 'MMD Schedule' }} />
    <PatientStack.Screen name="AccountSettings" component={AccountSettingsScreen} />
  </PatientStack.Navigator>
);

const RoleRouter = () => {
  const { role } = useAuthStore();
  if (role === "nurse")   return <NurseNavigator />;
  if (role === "patient") return <PatientStackNavigator />;
  return <DoctorNavigator />;
};

export const RootNavigator = () => {
  const { jwt, tenant, isUnlocked, unlock, logout, clearTenant, role } = useAuthStore();
  const navigation = useNavigation<any>();

  React.useEffect(() => {
    if (!jwt || !isUnlocked) return;
    registerPushToken();
    clearAppBadge();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clearAppBadge();
    });
    const cleanup = setupNotificationListeners((notification) => {
      const data = notification.request.content.data;
      const type = data?.type;
      const patientId = data?.patientId;

      if (role === "nurse" && (type === "OI_DETERIORATION" || type === "NEWS2_CRITICAL")) {
        // Use timeout to ensure navigation is ready after app foregrounding
        setTimeout(() => {
          navigation.navigate("NNcdCrisis", { patientId, autoOpenAlert: true });
        }, 500);
      }
    });
    return () => {
      appStateSub.remove();
      cleanup();
    };
  }, [jwt, isUnlocked, role, navigation]);

  if (!tenant) {
    return <TenantSelectScreen onSelected={() => {}} />;
  }

  if (!jwt) {
    return <LoginScreen onLoggedIn={unlock} onChangeTenant={clearTenant} />;
  }

  return (
    <View style={styles.container}>
      <View style={isUnlocked ? styles.unlocked : styles.lockedUnderlay} pointerEvents={isUnlocked ? "auto" : "none"}>
        <RoleRouter />
      </View>

      {!isUnlocked && (
        <View style={styles.lockOverlay} pointerEvents="auto">
          <LockScreen onUnlocked={unlock} onSignOut={logout} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  unlocked: { flex: 1 },
  lockedUnderlay: { flex: 1 },
  lockOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
});
