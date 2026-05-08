import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { ScreenHeader } from "../ui";
import { C, FONT, RADIUS } from "../../design/tokens";
import { useApiQuery } from "../../hooks/useApiQuery";
import { QuestionnairesService, Questionnaire, SubmitResponseBody } from "../../services/questionnaires";

interface RouteParams {
  questionnaireId: string;
  title?: string;
}

interface Props {
  navigation: any;
  route: { params: RouteParams };
}

export function PatientQuestionnaireDetailScreen({ navigation, route }: Props) {
  const { questionnaireId, title } = route.params;
  const { data, loading, error } = useApiQuery(() => QuestionnairesService.getQuestionnaire(questionnaireId), [questionnaireId]);
  const [responses, setResponses] = useState<Record<number, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    if (!data) return;

    // Validate
    for (const q of data.questions) {
      if (q.required && responses[q.questionNumber] === undefined) {
        Alert.alert("Required", `Please answer question ${q.questionNumber}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: SubmitResponseBody = {
        responses: data.questions.map(q => ({
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          responseValue: responses[q.questionNumber],
          responseType: q.responseType,
        })),
      };

      const res = await QuestionnairesService.submit(questionnaireId, body);
      if (res.queued) {
        Alert.alert("Saved Offline", "Your answers will be submitted when you reconnect.");
        navigation.goBack();
      } else if (res.result) {
        setResult(res.result);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator color={C.teal} style={{ flex: 1 }} />;
  if (error || !data) return <Text style={styles.error}>{error ?? "Questionnaire not found"}</Text>;
  if (result) {
    const interp = result.interpretation;
    const colorHex = interp?.colorHex ?? '#2B7FFF';
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.completionContent}>
        <ScreenHeader title={data.title} onBack={() => navigation.goBack()} />

        {/* Severity pill */}
        <View style={[styles.severityPill, { backgroundColor: colorHex + '22', borderColor: colorHex }]}>
          <Text style={[styles.severityLabel, { color: colorHex }]}>
            {interp?.label ?? 'Score Recorded'}
          </Text>
        </View>

        {/* Score */}
        <Text style={styles.scoreNumber}>{result.finalScore ?? result.totalScore}</Text>
        <Text style={styles.scoreCaption}>Your score</Text>

        {/* Patient-friendly message */}
        {interp?.patientMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{interp.patientMessage}</Text>
          </View>
        ) : null}

        {/* What happens next */}
        <View style={styles.nextCard}>
          <Text style={styles.nextHeading}>What happens next</Text>
          <Text style={styles.nextText}>
            Your care team has received your results and will review them. If you have urgent concerns, please contact the clinic directly.
          </Text>
        </View>

        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title={title ?? data.title} onBack={() => navigation.goBack()} />
      {data.questions.map(q => (
        <View key={q.questionNumber} style={styles.question}>
          <Text style={styles.questionText}>
            {q.questionNumber}. {q.questionText} {q.required ? "*" : ""}
          </Text>
          {(q.responseType === "scale" || q.responseType === "choice") && q.options?.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.option, responses[q.questionNumber] === opt && styles.activeOption]}
              onPress={() => setResponses(prev => ({ ...prev, [q.questionNumber]: opt }))}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
          {q.responseType === "number" && (
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(responses[q.questionNumber] ?? "")}
              onChangeText={val => setResponses(prev => ({ ...prev, [q.questionNumber]: Number(val) }))}
            />
          )}
          {q.responseType === "text" && (
            <TextInput
              style={styles.input}
              multiline
              numberOfLines={3}
              value={String(responses[q.questionNumber] ?? "")}
              onChangeText={val => setResponses(prev => ({ ...prev, [q.questionNumber]: val }))}
            />
          )}
          {q.responseType === "boolean" && (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.bool, responses[q.questionNumber] === true && styles.activeOption]}
                onPress={() => setResponses(prev => ({ ...prev, [q.questionNumber]: true }))}
              >
                <Text>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bool, responses[q.questionNumber] === false && styles.activeOption]}
                onPress={() => setResponses(prev => ({ ...prev, [q.questionNumber]: false }))}
              >
                <Text>No</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Submitting..." : "Submit"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  completion: { flex: 1, justifyContent: "center", alignItems: "center" },
  completionContent: { padding: 24, alignItems: 'center' },
  severityPill: { borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 6, marginTop: 16, marginBottom: 8 },
  severityLabel: { fontFamily: FONT.uiBd, fontSize: 14, letterSpacing: 0.3 },
  scoreNumber: { fontFamily: FONT.uiBk, fontSize: 52, color: C.text, marginTop: 8 },
  scoreCaption: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted ?? '#7A9CC0', marginBottom: 20 },
  messageCard: { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 16, marginBottom: 16, width: '100%' },
  messageText: { fontFamily: FONT.ui, fontSize: 14, color: C.text, lineHeight: 22 },
  nextCard: { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 16, marginBottom: 24, width: '100%', borderLeftWidth: 3, borderLeftColor: C.teal },
  nextHeading: { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal, marginBottom: 6 },
  nextText: { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 20 },
  doneButton: { backgroundColor: C.teal, padding: 16, borderRadius: RADIUS.md, alignItems: 'center', width: '100%' },
  question: { marginBottom: 24 },
  questionText: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, marginBottom: 12 },
  option: { padding: 12, borderRadius: RADIUS.sm, backgroundColor: C.surface, marginBottom: 8 },
  activeOption: { backgroundColor: C.teal + "22" },
  optionText: { fontFamily: FONT.ui, fontSize: 13, color: C.text },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, padding: 12, fontFamily: FONT.ui, fontSize: 13, color: C.text },
  row: { flexDirection: "row", gap: 12 },
  bool: { flex: 1, padding: 12, alignItems: "center", borderRadius: RADIUS.sm, backgroundColor: C.surface },
  submit: { backgroundColor: C.teal, padding: 16, borderRadius: RADIUS.md, alignItems: "center", marginTop: 24 },
  button: { backgroundColor: C.teal, padding: 12, borderRadius: RADIUS.md, alignItems: "center", width: "80%" },
  buttonText: { fontFamily: FONT.uiBd, fontSize: 15, color: C.bg },
  title: { fontFamily: FONT.uiBk, fontSize: 22, color: C.text },
  score: { fontFamily: FONT.uiBk, fontSize: 30, color: C.teal, marginVertical: 24 },
  error: { fontFamily: FONT.ui, fontSize: 13, color: C.red, textAlign: "center", marginTop: 32 },
});
