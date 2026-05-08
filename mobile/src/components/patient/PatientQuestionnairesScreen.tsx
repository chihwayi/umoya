import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, FONT, RADIUS, SHADOW } from "../../design/tokens";
import { ScreenHeader, Card, Badge } from "../ui";
import { useApiQuery } from "../../hooks/useApiQuery";
import { QuestionnairesService, QuestionnaireAssignment, QuestionnaireHistoryEntry } from "../../services/questionnaires";

type Tab = "pending" | "history";

interface Props {
  navigation: any;
}

export function PatientQuestionnairesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("pending");

  const pendingQuery = useApiQuery(() => QuestionnairesService.getPending(), []);
  const historyQuery = useApiQuery(() => QuestionnairesService.getHistory(), []);

  const renderPendingItem = ({ item }: { item: QuestionnaireAssignment }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        {item.dueDate && <Badge color={C.amber}>{item.dueDate}</Badge>}
      </View>
      <Text style={styles.description}>{item.description}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("PHQuestionnaireDetail", { questionnaireId: item.questionnaireId, title: item.title })}
      >
        <Text style={styles.buttonText}>Start</Text>
      </TouchableOpacity>
    </Card>
  );

  const renderHistoryItem = ({ item }: { item: QuestionnaireHistoryEntry }) => (
    <Card style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>Completed: {new Date(item.completedAt).toLocaleDateString()}</Text>
      {item.scoreLabel && <Text style={styles.score}>{item.scoreLabel}</Text>}
    </Card>
  );

  const query = tab === "pending" ? pendingQuery : historyQuery;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Questionnaires" onBack={() => navigation.goBack()} />
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "pending" && styles.activeTab]} onPress={() => setTab("pending")}>
          <Text style={[styles.tabText, tab === "pending" && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "history" && styles.activeTab]} onPress={() => setTab("history")}>
          <Text style={[styles.tabText, tab === "history" && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>
      {query.loading ? (
        <ActivityIndicator color={C.teal} style={styles.loader} />
      ) : query.error ? (
        <Text style={styles.error}>{query.error}</Text>
      ) : (
        <FlatList
          data={(tab === "pending" ? pendingQuery.data : historyQuery.data) as any[]}
          renderItem={tab === "pending" ? renderPendingItem as any : renderHistoryItem as any}
          keyExtractor={(item: any) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>{tab === "pending" ? "No questionnaires waiting for you." : "Completed questionnaires will appear here."}</Text>}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  tabs: { flexDirection: "row", margin: 16, backgroundColor: C.surface, borderRadius: RADIUS.md, ...SHADOW.sm },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: C.teal },
  tabText: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  activeTabText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal },
  list: { padding: 16 },
  card: { marginBottom: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  title: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text },
  description: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 12 },
  button: { backgroundColor: C.teal, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: "center" },
  buttonText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.bg },
  score: { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal, marginTop: 8 },
  loader: { marginTop: 32 },
  error: { fontFamily: FONT.ui, fontSize: 13, color: C.red, textAlign: "center", marginTop: 32 },
  empty: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, textAlign: "center", marginTop: 32 },
});