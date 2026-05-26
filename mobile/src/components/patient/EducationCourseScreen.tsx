import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { ScreenHeader, Icon } from '../ui';
import { educationApi } from '../../services/api';

interface Lesson {
  id: string;
  title: string;
  content_type: 'text' | 'video_url' | 'pdf_url';
  content_body: string;
  duration_minutes?: number;
  completed_at?: string;
  quiz_id?: string;
  quiz_passed?: boolean;
  pass_threshold?: number;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseData {
  course: { id: string; title: string; description?: string; category?: string };
  enrollment: { id: string; completed_at?: string } | null;
  modules: Module[];
}

export const EducationCourseScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { courseId } = route.params as { courseId: string };
  const { i18n, t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await educationApi.getCourse(courseId, i18n.language);
      setData(res.data);
      // Auto-expand first module
      if (res.data?.modules?.[0]) {
        setExpanded(new Set([res.data.modules[0].id]));
      }
    } catch {
      Alert.alert('Error', 'Could not load course');
    } finally {
      setLoading(false);
    }
  }, [courseId, i18n.language]);

  useEffect(() => { load(); }, [load]);

  async function handleEnroll() {
    setEnrolling(true);
    try {
      await educationApi.enroll(courseId);
      await load();
    } catch {
      Alert.alert('Error', 'Could not enrol in course');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleComplete(lesson: Lesson) {
    setCompleting(lesson.id);
    try {
      await educationApi.markLessonComplete(lesson.id);
      await load();
    } catch {
      Alert.alert('Error', 'Could not mark lesson complete');
    } finally {
      setCompleting(null);
    }
  }

  function openExternal(url: string) {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link'));
  }

  function toggleModule(moduleId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  if (!data) return null;
  const { course, enrollment, modules } = data;

  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const doneLessons  = modules.reduce((s, m) => s + m.lessons.filter(l => l.completed_at).length, 0);
  const pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={course.title}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Course header card */}
        <LinearGradient colors={['#0EA5E9', '#6366F1']} style={styles.heroCard}>
          {course.description ? (
            <Text style={styles.heroDesc}>{course.description}</Text>
          ) : null}
          {course.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{course.category}</Text>
            </View>
          ) : null}
          {enrollment?.completed_at ? (
            <View style={styles.completeBadge}>
              <Icon name="check-circle" size={14} color="#fff" />
              <Text style={styles.completeBadgeText}>Completed</Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* Progress bar */}
        {enrollment && (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{t('education.progress', 'Progress')}</Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
            </View>
            <Text style={styles.progressSub}>{doneLessons} / {totalLessons} lessons</Text>
          </View>
        )}

        {/* Enrol button */}
        {!enrollment && (
          <TouchableOpacity
            style={styles.enrollBtn}
            onPress={handleEnroll}
            disabled={enrolling}
          >
            {enrolling
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.enrollBtnText}>{t('education.enroll', 'Start Course')}</Text>
            }
          </TouchableOpacity>
        )}

        {/* Modules */}
        {modules.map((mod, mi) => (
          <View key={mod.id} style={styles.moduleCard}>
            <TouchableOpacity
              style={styles.moduleHeader}
              onPress={() => toggleModule(mod.id)}
            >
              <Text style={styles.moduleTitle}>{mi + 1}. {mod.title}</Text>
              <Icon
                name={expanded.has(mod.id) ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={C.slate}
              />
            </TouchableOpacity>

            {expanded.has(mod.id) && mod.lessons.map(lesson => (
              <View key={lesson.id} style={styles.lessonBlock}>
                <View style={styles.lessonRow}>
                  <View style={[styles.lessonDot, lesson.completed_at ? styles.lessonDotDone : {}]} />
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    {lesson.duration_minutes ? (
                      <Text style={styles.lessonMeta}>{lesson.duration_minutes} min</Text>
                    ) : null}
                  </View>
                </View>

                {/* Lesson content */}
                {lesson.content_type === 'text' && lesson.content_body ? (
                  <Text style={styles.lessonBody}>{lesson.content_body}</Text>
                ) : null}
                {(lesson.content_type === 'video_url' || lesson.content_type === 'pdf_url') && lesson.content_body ? (
                  <TouchableOpacity
                    style={styles.externalBtn}
                    onPress={() => openExternal(lesson.content_body)}
                  >
                    <Icon
                      name={lesson.content_type === 'video_url' ? 'play-circle' : 'file-text'}
                      size={14}
                      color={C.blue}
                    />
                    <Text style={styles.externalBtnText}>
                      {lesson.content_type === 'video_url'
                        ? t('education.openVideo', 'Watch Video')
                        : t('education.openPdf', 'Open PDF')}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Quiz indicator */}
                {lesson.quiz_id && lesson.quiz_passed && (
                  <View style={styles.quizPassed}>
                    <Icon name="check-circle" size={13} color={C.green} />
                    <Text style={styles.quizPassedText}>{t('education.quizPassed', 'Passed')}</Text>
                  </View>
                )}
                {lesson.quiz_id && !lesson.quiz_passed && enrollment && (
                  <View style={styles.quizBadge}>
                    <Text style={styles.quizBadgeText}>{t('education.quiz', 'Knowledge Check')}</Text>
                  </View>
                )}

                {/* Complete button */}
                {!lesson.completed_at && enrollment && (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => handleComplete(lesson)}
                    disabled={completing === lesson.id}
                  >
                    {completing === lesson.id
                      ? <ActivityIndicator size="small" color={C.blue} />
                      : <Text style={styles.completeBtnText}>{t('education.markComplete', 'Mark Complete')}</Text>
                    }
                  </TouchableOpacity>
                )}
                {lesson.completed_at && (
                  <View style={styles.doneRow}>
                    <Icon name="check-circle" size={14} color={C.green} />
                    <Text style={styles.doneText}>Done</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F8FAFC' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:         { padding: 16, paddingBottom: 40 },
  heroCard:       { borderRadius: RADIUS.lg, padding: 20, marginBottom: 12 },
  heroDesc:       { fontSize: FONT.sm, color: '#fff', opacity: 0.9, marginBottom: 8, lineHeight: 20 },
  categoryBadge:  { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  categoryText:   { fontSize: FONT.xs, color: '#fff', fontWeight: '600' },
  completeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  completeBadgeText: { fontSize: FONT.xs, color: '#fff', fontWeight: '700' },
  progressCard:   { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 16, marginBottom: 12, ...SHADOW.sm },
  progressRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel:  { fontSize: FONT.sm, color: '#374151', fontWeight: '600' },
  progressPct:    { fontSize: FONT.sm, color: C.blue, fontWeight: '700' },
  progressTrack:  { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 4 },
  progressFill:   { height: 6, backgroundColor: C.blue, borderRadius: 3 },
  progressSub:    { fontSize: FONT.xs, color: '#9CA3AF' },
  enrollBtn:      { backgroundColor: C.blue, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  enrollBtnText:  { color: '#fff', fontSize: FONT.md, fontWeight: '700' },
  moduleCard:     { backgroundColor: '#fff', borderRadius: RADIUS.md, marginBottom: 10, ...SHADOW.sm, overflow: 'hidden' },
  moduleHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  moduleTitle:    { fontSize: FONT.md, fontWeight: '600', color: '#111827', flex: 1 },
  lessonBlock:    { borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 14 },
  lessonRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  lessonDot:      { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#D1D5DB', marginTop: 4 },
  lessonDotDone:  { backgroundColor: C.green, borderColor: C.green },
  lessonInfo:     { flex: 1 },
  lessonTitle:    { fontSize: FONT.sm, fontWeight: '600', color: '#374151' },
  lessonMeta:     { fontSize: FONT.xs, color: '#9CA3AF', marginTop: 2 },
  lessonBody:     { fontSize: FONT.sm, color: '#4B5563', lineHeight: 20, marginBottom: 10 },
  externalBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: C.blue, alignSelf: 'flex-start', marginBottom: 10 },
  externalBtnText:{ fontSize: FONT.xs, color: C.blue, fontWeight: '600' },
  quizBadge:      { backgroundColor: '#EDE9FE', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  quizBadgeText:  { fontSize: FONT.xs, color: '#7C3AED', fontWeight: '600' },
  quizPassed:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  quizPassedText: { fontSize: FONT.xs, color: C.green, fontWeight: '600' },
  completeBtn:    { borderWidth: 1, borderColor: C.blue, borderRadius: RADIUS.sm, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  completeBtnText:{ fontSize: FONT.sm, color: C.blue, fontWeight: '600' },
  doneRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  doneText:       { fontSize: FONT.xs, color: C.green, fontWeight: '600' },
});
