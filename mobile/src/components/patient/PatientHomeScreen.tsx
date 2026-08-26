import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { C, FONT, RADIUS } from "../../design/tokens";
import { useApiQuery } from "../../hooks/useApiQuery";
import { QuestionnairesService } from "../../services/questionnaires";

interface Props {
  navigation: any;
}

export function PatientHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const pendingQuery = useApiQuery(() => QuestionnairesService.getPending(), []);
  const navItems = [
    { label: t("nav.appointments"), route: "PHAppointments", icon: "calendar" },
    { label: t("nav.health"),        route: "PHHealth",       icon: "heart"    },
    { label: t("nav.meds"),          route: "PHMeds",         icon: "pill"     },
    { label: t("nav.bills"),         route: "PHBills",        icon: "wallet"   },
    { label: t("nav.messages"),      route: "PHMessages",     icon: "chat"     },
    { label: t("nav.education"),     route: "PHEducation",    icon: "book"     },
  ];

  return (
    <ScrollView style={styles.container}>
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
      <Text style={styles.title}>{t("nav.home")}</Text>
      <View style={styles.navGrid}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.route}
            testID={`patient-home-nav-${item.route}`}
            style={styles.navCard}
            onPress={() => navigation.navigate(item.route)}
            activeOpacity={0.85}
          >
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
  title: { color: C.textPrimary, fontFamily: FONT.uiBk, fontSize: 22, marginBottom: 14 },
  navGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  navCard: {
    width: "48%",
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
  },
  navLabel: { color: C.textPrimary, fontFamily: FONT.uiBd, fontSize: 14 },
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
