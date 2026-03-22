import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT } from '../../design/tokens';
import { AiBadge, AiPulse, Card } from '../ui';

const Placeholder: React.FC<{ title: string; sprint: string; accent?: string }> = ({
  title, sprint, accent = C.teal,
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

export const PatientHomeScreen      = () => <Placeholder title="Home"          sprint="S113" />;
export const PatientPostVisitScreen = () => <Placeholder title="PostVisit AI"  sprint="S113" accent={C.teal} />;
export const PatientMedsScreen      = () => <Placeholder title="My Medications" sprint="S114" accent={C.blue} />;
export const PatientBillsScreen     = () => <Placeholder title="My Bills"      sprint="S114" accent={C.amber} />;
export const PatientHealthScreen    = () => <Placeholder title="My Health"     sprint="S115" accent={C.green} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontFamily: FONT.uiBk, fontSize: 26, letterSpacing: -0.4, textAlign: 'center' },
  card: { width: '100%', marginTop: 8 },
  cardLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
});
