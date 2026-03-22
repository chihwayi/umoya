import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS } from '../../design/tokens';
import { AiBadge, AiPulse, Card } from '../ui';

// Placeholder screen component reused for all unbuilt doctor screens
const Placeholder: React.FC<{
  title: string;
  subtitle: string;
  sprint: string;
  accent?: string;
}> = ({ title, subtitle, sprint, accent = C.teal }) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['#030B18', C.bg]}
      style={[styles.flex, { paddingTop: insets.top }]}
    >
      <View style={styles.container}>
        <AiPulse size={64} active />
        <AiBadge text={`SPRINT ${sprint}`} />
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Coming in Sprint {sprint}</Text>
          <Text style={styles.cardBody}>
            This screen is fully specced and will be built in the next sprint.
          </Text>
        </Card>
      </View>
    </LinearGradient>
  );
};

export const DoctorRoundsScreen = () => (
  <Placeholder title="Ward Rounds" subtitle="Doctor" sprint="S110" accent={C.teal} />
);
export const DoctorPostVisitScreen = () => (
  <Placeholder title="PostVisit AI Signoff" subtitle="Doctor" sprint="S110" accent={C.teal} />
);
export const DoctorEscalationScreen = () => (
  <Placeholder title="Escalation Inbox" subtitle="Doctor" sprint="S117" accent={C.red} />
);
export const DoctorMessagesScreen = () => (
  <Placeholder title="Secure Messaging" subtitle="Doctor" sprint="S116" accent={C.blue} />
);
export const DoctorAIScreen = () => (
  <Placeholder title="CDSS + Dictation" subtitle="Doctor" sprint="S111" accent={C.purple} />
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  title: { fontFamily: FONT.uiBk, fontSize: 26, letterSpacing: -0.4, textAlign: 'center' },
  sub: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  card: { width: '100%', marginTop: 8 },
  cardLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  cardBody: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, lineHeight: 20 },
});
