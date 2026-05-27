import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { ScreenHeader, Badge, Icon } from '../ui';
import { educationApi } from '../../services/api';

interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  target_audience?: string;
  completed_lessons?: number;
  total_lessons?: number;
  progressPct?: number;
  completed_at?: string | null;
}

type Tab = 'enrolled' | 'browse';

export const PatientEducationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();

  const [tab, setTab] = useState<Tab>('enrolled');
  const [enrolled, setEnrolled] = useState<Course[]>([]);
  const [browsable, setBrowsable] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await educationApi.getMyCourses(i18n.language || 'en');
      setEnrolled(res.data?.enrolled ?? []);
      setBrowsable(res.data?.browsable ?? []);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [i18n.language, t]);

  useEffect(() => { load(); }, [load]);

  const courses = tab === 'enrolled' ? enrolled : browsable;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />
      <ScreenHeader
        title={t('education.title', 'Health Education')}
        subtitle={t('education.subtitle', 'Learn at your own pace')}
        accent={C.teal}
      />

      {/* Tab strip */}
      <View style={styles.tabStrip}>
        {(['enrolled', 'browse'] as Tab[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => setTab(key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'enrolled' ? t('education.myCourses', 'My Courses') : t('education.explore', 'Explore')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={C.teal} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('common.noResults', 'No courses found')}</Text>
          }
          renderItem={({ item }) => {
            const pct = item.progressPct ?? 0;
            return (
              <TouchableOpacity
                style={styles.courseCard}
                onPress={() => navigation.navigate('PHEducationCourse', {
                  courseId: item.id,
                  courseTitle: item.title,
                })}
                activeOpacity={0.88}
              >
                <View style={styles.courseBody}>
                  <View style={styles.topRow}>
                    <Badge color={C.teal} size="xs">
                      {(item.category ?? 'general').toUpperCase()}
                    </Badge>
                    {item.completed_at && (
                      <Badge color={C.green ?? '#22c55e'} size="xs">✓ DONE</Badge>
                    )}
                  </View>
                  <Text style={styles.courseTitle} numberOfLines={2}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.courseDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                  {tab === 'enrolled' && (
                    <View style={styles.progressWrap}>
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>
                          {item.completed_lessons ?? 0}/{item.total_lessons ?? 0} {t('education.lessons', 'lessons')}
                        </Text>
                        <Text style={styles.progressLabel}>{pct}%</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  )}
                </View>
                <Icon name="chevron-right" size={16} color={C.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  tabStrip: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  tabBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  tabBtnActive: { backgroundColor: C.teal + '20', borderColor: C.teal },
  tabText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted },
  tabTextActive: { color: C.teal },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  retryText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal },
  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  courseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden', padding: 14, gap: 12, ...SHADOW.card },
  courseBody: { flex: 1, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseTitle: { fontFamily: FONT.uiBk, fontSize: 15, color: C.textPrimary, letterSpacing: -0.2 },
  courseDesc: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  progressWrap: { gap: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  progressTrack: { height: 4, backgroundColor: C.border, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: C.teal, borderRadius: 2 },
  emptyText: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 32 },
});
