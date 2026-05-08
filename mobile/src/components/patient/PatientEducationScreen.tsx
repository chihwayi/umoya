import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Pressable, ActivityIndicator, FlatList,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { ScreenHeader, Badge, Icon } from '../ui';
import {
  EducationService,
  EducationCategory,
  EducationArticle,
  EducationArticleDetail,
} from '../../services/education';

const CATEGORY_COLORS: Record<string, string> = {
  hiv:      C.red,
  tb:       C.amber,
  maternal: C.purple,
  ncd:      C.blue,
  general:  C.teal,
};

const CATEGORY_ICONS: Record<string, string> = {
  hiv:      'virus',
  tb:       'lungs',
  maternal: 'baby',
  ncd:      'heart',
  general:  'book',
};

export const PatientEducationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const [categories,     setCategories]     = useState<EducationCategory[]>([]);
  const [selectedCat,    setSelectedCat]    = useState<string | undefined>(undefined);
  const [articles,       setArticles]       = useState<EducationArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [openArticle,    setOpenArticle]    = useState<EducationArticleDetail | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [reloadKey,      setReloadKey]      = useState(0);

  // Load categories on mount
  useEffect(() => {
    EducationService.getCategories()
      .then(cats => {
        setCategories(cats ?? []);
        // Auto-select first category
        if (cats?.length) setSelectedCat(cats[0].id);
      })
      .catch(() => setError(t('common.error')));
  }, []);

  // Load articles when category changes
  useEffect(() => {
    setLoadingArticles(true);
    setError(null);
    EducationService.getContent(selectedCat)
      .then(list => setArticles(list ?? []))
      .catch(() => setError(t('common.error')))
      .finally(() => setLoadingArticles(false));
  }, [selectedCat, reloadKey]);

  const openDetail = useCallback(async (id: string) => {
    setLoadingArticle(true);
    try {
      const detail = await EducationService.getArticle(id);
      setOpenArticle(detail);
    } catch {
      // silent - article simply doesn't open
    } finally {
      setLoadingArticle(false);
    }
  }, []);

  const closeDetail = useCallback(() => setOpenArticle(null), []);

  const color = (catId?: string) => CATEGORY_COLORS[catId ?? 'general'] ?? C.teal;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />
      <ScreenHeader
        title={t('education.title')}
        subtitle={t('education.subtitle')}
        accent={C.teal}
      />

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catStrip}
      >
        <TouchableOpacity
          style={[styles.catChip, !selectedCat && styles.catChipActive]}
          onPress={() => setSelectedCat(undefined)}
          activeOpacity={0.8}
        >
          <Text style={[styles.catChipText, !selectedCat && styles.catChipTextActive]}>
            {t('education.all')}
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.catChip,
              selectedCat === cat.id && { backgroundColor: color(cat.id) + '20', borderColor: color(cat.id) },
            ]}
            onPress={() => setSelectedCat(cat.id)}
            activeOpacity={0.8}
          >
            <Icon name={(CATEGORY_ICONS[cat.id] ?? 'book') as any} size={13} color={selectedCat === cat.id ? color(cat.id) : C.textMuted} />
            <Text style={[styles.catChipText, selectedCat === cat.id && { color: color(cat.id) }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Article list */}
      {loadingArticles ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={C.teal} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setReloadKey(k => k + 1)} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={a => a.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('common.noResults')}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.articleCard}
              onPress={() => openDetail(item.id)}
              activeOpacity={0.88}
            >
              <View style={[styles.articleAccent, { backgroundColor: color(item.category) }]} />
              <View style={styles.articleBody}>
                <View style={styles.articleTopRow}>
                  <Badge color={color(item.category)} size="xs">
                    {item.category?.toUpperCase()}
                  </Badge>
                  {item.readingTimeMinutes && (
                    <Text style={styles.readTime}>
                      {item.readingTimeMinutes} {t('education.minRead')}
                    </Text>
                  )}
                </View>
                <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.articleSummary} numberOfLines={3}>{item.summary}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Article detail modal */}
      <Modal
        visible={!!openArticle || loadingArticle}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />

            {loadingArticle ? (
              <ActivityIndicator color={C.teal} style={{ marginTop: 32 }} />
            ) : openArticle ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Badge color={color(openArticle.category)} size="sm">
                      {openArticle.category?.toUpperCase()}
                    </Badge>
                    <Text style={styles.modalTitle}>{openArticle.title}</Text>
                    {openArticle.authorName && (
                      <Text style={styles.modalMeta}>
                        {t('education.by')} {openArticle.authorName}
                      </Text>
                    )}
                  </View>
                  <Pressable onPress={closeDetail} style={styles.closeBtn} hitSlop={12}>
                    <Icon name="close" size={18} color={C.textSecondary} />
                  </Pressable>
                </View>

                {/* Render body as HTML in a WebView for full formatting support */}
                <WebView
                  source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui;font-size:15px;color:#E2E8F0;background:#0D1B2A;padding:16px;line-height:1.7;}h1,h2,h3{color:#F1F5F9;}a{color:#38BDF8;}</style></head><body>${openArticle.body}</body></html>` }}
                  style={styles.webview}
                  scrollEnabled
                  showsVerticalScrollIndicator={false}
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  catStrip: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  catChipActive: { backgroundColor: C.teal + '20', borderColor: C.teal },
  catChipText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.textMuted },
  catChipTextActive: { color: C.teal },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: RADIUS.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  retryText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.teal },
  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  emptyText: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 32 },
  articleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden', ...SHADOW.card },
  articleAccent: { width: 4, alignSelf: 'stretch' },
  articleBody: { flex: 1, padding: 14, gap: 8 },
  articleTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readTime: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  articleTitle: { fontFamily: FONT.uiBk, fontSize: 15, color: C.textPrimary, letterSpacing: -0.2 },
  articleSummary: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: C.border, maxHeight: '90%', flex: 1 },
  modalHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontFamily: FONT.uiBk, fontSize: 19, color: C.textPrimary, letterSpacing: -0.3, marginTop: 8 },
  modalMeta: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 4 },
  closeBtn: { padding: 4, marginTop: 2 },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
