import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT } from '../../design/tokens';
import { AiBadge, AiPulse, Card } from '../ui';

const Placeholder: React.FC<{ title: string; sprint: string; accent?: string }> = ({
  title, sprint, accent = C.purple,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#030B18', C.bg]} style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <AiPulse size={64} active />
        <AiBadge text={`SPRINT ${sprint}`} />
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Coming in Sprint {sprint}</Text>
        </Card>
      </View>
    </LinearGradient>
  );
};

export const NurseShiftScreen   = () => <Placeholder title="Shift Dashboard" sprint="S112" />;
export const NurseVitalsScreen  = () => <Placeholder title="Record Vitals"   sprint="S112" />;
export const NurseMessagesScreen= () => <Placeholder title="Secure Messaging" sprint="S116" accent={C.blue} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontFamily: FONT.uiBk, fontSize: 26, letterSpacing: -0.4, textAlign: 'center' },
  card: { width: '100%', marginTop: 8 },
  cardLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
});
