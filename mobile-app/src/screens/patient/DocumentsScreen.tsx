import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import documentService, { Document, DocumentFilters } from '../../services/document.service';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const DocumentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDocuments();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [filter]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      if (patientId) {
        const filters: DocumentFilters | undefined = filter !== 'all' ? { documentType: filter } : undefined;
        const data = await documentService.getDocuments(patientId, filters);
        setDocuments(data);
        
        const types = Array.from(new Set(data.map(doc => doc.documentType)));
        setDocumentTypes(types);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDocuments();
      return;
    }

    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      const results = await documentService.searchDocuments(searchQuery.trim(), {
        patientId,
        documentType: filter !== 'all' ? filter : undefined,
      });
      setDocuments(results);
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderDocument = ({ item, index }: { item: Document; index: number }) => {
    const uploadDate = new Date(item.uploadedAt);
    const formattedDate = format(uploadDate, 'MMM dd, yyyy');
    const fileIcon = documentService.getFileIcon(item.mimeType);
    const fileSize = documentService.formatFileSize(item.fileSize);

    return (
      <Animated.View
        style={[
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('DocumentViewer', { documentId: item.id })}
          activeOpacity={0.8}
        >
          <GlassCard style={styles.documentCard} padding={spacing.lg}>
            <View style={styles.documentHeader}>
              <View style={styles.documentIconContainer}>
                <Text style={styles.documentIcon}>{fileIcon}</Text>
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentName} numberOfLines={2}>
                  {item.documentName}
                </Text>
                <Text style={styles.documentType}>{item.documentType}</Text>
              </View>
            </View>
            <View style={styles.documentMeta}>
              <Text style={styles.metaText}>
                {fileSize} • {formattedDate}
              </Text>
              {item.uploadedByFirstName && (
                <Text style={styles.metaText}>
                  Uploaded by {item.uploadedByFirstName} {item.uploadedByLastName}
                </Text>
              )}
            </View>
            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {item.tags.slice(0, 3).map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </GlassCard>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading && documents.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Documents" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Documents" subtitle="View your medical documents" />
      <View style={styles.content}>
        <GlassCard style={styles.searchContainer} padding={spacing.md}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.7}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {documentTypes.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                onPress={() => setFilter('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {documentTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterButton, filter === type && styles.filterButtonActive]}
                  onPress={() => setFilter(type)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {documents.length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No Documents</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search term' : 'You have no documents at this time'}
              </Text>
            </GlassCard>
          </Animated.View>
        ) : (
          <FlatList
            data={documents}
            renderItem={renderDocument}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  searchContainer: {
    margin: spacing.lg,
    marginBottom: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  searchButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filterContainer: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glassCard,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.lg,
  },
  documentCard: {
    marginBottom: spacing.md,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentIcon: {
    fontSize: 24,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  documentType: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textTransform: 'capitalize',
  },
  documentMeta: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
});

export default DocumentsScreen;
