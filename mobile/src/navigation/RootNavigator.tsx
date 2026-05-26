import React from "react";
import { View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "../stores/useAuthStore";
import { registerPushToken, setupNotificationListeners } from "../services/pushNotifications";
import { C } from "../design/tokens";
import { CustomTabBar } from "./TabBar";

import { TenantSelectScreen } from "../components/shared/TenantSelectScreen";
import { LoginScreen } from "../components/shared/LoginScreen";
import { LockScreen } from "../components/shared/LockScreen";

import { DoctorRoundsScreen }    from "../components/doctor/DoctorRoundsScreen";
import { DoctorPostVisitScreen } from "../components/doctor/DoctorPostVisitScreen";
import { DoctorAIScreen } from "../components/doctor/DoctorAIScreen";
import { DoctorMessagesScreen }    from "../components/doctor/DoctorMessagesScreen";
import { DoctorEscalationScreen }  from "../components/doctor/DoctorEscalationScreen";

import { NurseShiftScreen }  from "../components/nurse/NurseShiftScreen";
import { NurseVitalsScreen } from "../components/nurse/NurseVitalsScreen";
import { NurseMessagesScreen } from "../components/nurse/NurseMessagesScreen";
import { NurseNcdCrisisScreen } from "../components/nurse/NurseNcdCrisisScreen";

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

const Stack  = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();
const DoctorTabs  = createBottomTabNavigator();
const NurseTabs   = createBottomTabNavigator();
const PatientTabs = createBottomTabNavigator();

const DOCTOR_TABS = [
  { icon: "rounds"    as const, label: "Rounds"    },
  { icon: "sparkle"   as const, label: "PostVisit" },
  { icon: "escalate"  as const, label: "Inbox",    badge: 3 },
  { icon: "chat"      as const, label: "Messages"  },
  { icon: "brain"     as const, label: "AI"        },
];

const DoctorNavigator = () => (
  <DoctorTabs.Navigator
    tabBar={(props) => <CustomTabBar {...props} accent={C.teal} tabs={DOCTOR_TABS} />}
    screenOptions={{ headerShown: false }}
  >
    <DoctorTabs.Screen name="DRounds"      component={DoctorRoundsScreen}     />
    <DoctorTabs.Screen name="DPostVisit"   component={DoctorPostVisitScreen}  />
    <DoctorTabs.Screen name="DEscalations" component={DoctorEscalationScreen} />
    <DoctorTabs.Screen name="DMessages"    component={DoctorMessagesScreen}   />
    <DoctorTabs.Screen name="DAI"          component={DoctorAIScreen}         />
  </DoctorTabs.Navigator>
);

const NURSE_TABS = [
  { icon: "shift"      as const, label: "Shift"    },
  { icon: "pulse"      as const, label: "Vitals"   },
  { icon: "chat"       as const, label: "Messages" },
  { icon: "stethoscope" as const, label: "NCD"     },
];

const NurseNavigator = () => (
  <NurseTabs.Navigator
    tabBar={(props) => <CustomTabBar {...props} accent={C.purple} tabs={NURSE_TABS} />}
    screenOptions={{ headerShown: false }}
  >
    <NurseTabs.Screen name="NShift"    component={NurseShiftScreen}     />
    <NurseTabs.Screen name="NVitals"   component={NurseVitalsScreen}    />
    <NurseTabs.Screen name="NMessages" component={NurseMessagesScreen}  />
    <NurseTabs.Screen name="NNcdCrisis" component={NurseNcdCrisisScreen} />
  </NurseTabs.Navigator>
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
  </PatientStack.Navigator>
);

const RoleRouter = () => {
  const { role } = useAuthStore();
  if (role === "nurse")   return <NurseNavigator />;
  if (role === "patient") return <PatientStackNavigator />;
  return <DoctorNavigator />;
};

export const RootNavigator = () => {
  const { jwt, tenant, isUnlocked, unlock, logout, clearTenant } = useAuthStore();

  React.useEffect(() => {
    if (!jwt || !isUnlocked) return;
    registerPushToken();
    const cleanup = setupNotificationListeners((_notification) => {});
    return cleanup;
  }, [jwt, isUnlocked]);

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
