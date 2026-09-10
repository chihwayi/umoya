import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { C, FONT, RADIUS } from "../../design/tokens";
import { Icon } from "../ui/Icon";
import { useApiQuery } from "../../hooks/useApiQuery";
import { QuestionnairesService } from "../../services/questionnaires";

interface Props {
  navigation: any;
}

export function PatientHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pendingQuery = useApiQuery(() => QuestionnairesService.getPending(), []);
  const navItems = [
    { label: t("nav.appointments"), route: "PHAppointments", icon: "calendar" as const, accent: C.blue,   inTabs: true  },
    { label: t("nav.health"),        route: "PHHealth",       icon: "heart"    as const, accent: C.coral,  inTabs: true  },
    { label: t("nav.meds"),          route: "PHMeds",         icon: "pill"     as const, accent: C.violet, inTabs: true  },
    { label: t("nav.bills"),         route: "PHBills",        icon: "wallet"   as const, accent: C.amber,  inTabs: true  },
    { label: t("nav.messages"),      route: "PHMessages",     icon: "chat"     as const, accent: C.teal,   inTabs: false },
    { label: t("nav.education"),     route: "PHEducation",    icon: "book"     as const, accent: C.green,  inTabs: false },
  ];

  const goTo = (route: string, inTabs: boolean) => {
    if (inTabs) {
      navigation.navigate(route);
    } else {
      navigation.getParent()?.navigate(route);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 16 }}>
      {pendingQuery.loading && <Text style={styles.loadingText}>{t("common.loading")}</Text>}
      {(pendingQuery.data?.length ?? 0) > 0 && (
        <TouchableOpacity
          testID="patient-home-pending-questionnaires"
          onPress={() => navigation.navigate("PHQuestionnaires")}
          style={styles.pendingQuestBanner}
        >
          <Text style={styles.pendingQuestText}>
            {pendingQuery.data!.length} questionnaire{pendingQuery.data!.length > 1 ? "s" : ""} waiting for you
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t("nav.home")}</Text>
        <TouchableOpacity
          testID="patient-home-settings"
          onPress={() => navigation.getParent()?.navigate("AccountSettings")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="settings" size={20} color={C.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.navGrid}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.route}
            testID={`patient-home-nav-${item.route}`}
            style={styles.navCard}
            onPress={() => goTo(item.route, item.inTabs)}
            activeOpacity={0.8}
          >
            <View style={[styles.navIconWrap, { backgroundColor: item.accent + '22' }]}>
              <Icon name={item.icon} size={22} color={item.accent} strokeWidth={1.8} />
            </View>
            <Text style={styles.navLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  loadingText: { color: C.textMuted, fontFamily: FONT.ui, fontSize: 13, marginBottom: 10 },
  title: { color: C.textPrimary, fontFamily: FONT.uiBk, fontSize: 22 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  navCard: {
    width: "48%",
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 10,
  },
  navIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: { color: C.textPrimary, fontFamily: FONT.uiBd, fontSize: 14, textAlign: "center" },
  pendingQuestBanner: {
    backgroundColor: "#B45309",
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 16,
  },
  pendingQuestText: {
    color: "#FEF3C7",
    fontFamily: FONT.uiBd,
    fontSize: 13,
    textAlign: "center",
  },
});
