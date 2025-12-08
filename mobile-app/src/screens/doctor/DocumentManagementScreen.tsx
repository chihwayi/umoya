import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import documentService, { Document } from '../../services/document.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';
import { format, parseISO } from 'date-fns';

const DocumentManagementScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    loadDocuments();
  }, [patientId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await documentService.getPatientDocuments(patientId);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = () => {
    // TODO: Implement camera/image picker
    Alert.alert('Upload Document', 'Camera and file picker integration coming soon');
  };

  const handleViewDocument = (document: Document) => {
    navigation.navigate('DocumentViewer' as never, { documentId: document.id } as never);
  };

  const handleDeleteDocument = async (documentId: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentService.deleteDocument(documentId);
              loadDocuments();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '📷';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word')) return '📝';
    return '📎';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Documents" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Documents"
        subtitle="Patient Documents & Files"
        rightAction={
          <TouchableOpacity onPress={handleUpload} activeOpacity={0.7}>
            <Icon name="upload" size={24} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {documents.length > 0 ? (
          documents.map((document) => (
            <GlassCard key={document.id} style={styles.documentCard} padding={spacing.md}>
              <TouchableOpacity
                onPress={() => handleViewDocument(document)}
                activeOpacity={0.7}
              >
                <View style={styles.documentHeader}>
                  <View style={styles.documentIcon}>
                    <Text style={styles.documentIconText}>
                      {getFileIcon(document.fileType)}
                    </Text>
                  </View>
                  <View style={styles.documentContent}>
                    <Text style={styles.documentName}>{document.fileName}</Text>
                    {document.description && (
                      <Text style={styles.documentDescription}>{document.description}</Text>
                    )}
                    <Text style={styles.documentMeta}>
                      {format(parseISO(document.uploadedAt), 'MMM dd, yyyy')}
                      {document.fileSize && ` • ${(document.fileSize / 1024).toFixed(1)} KB`}
                    </Text>
                    {document.tags && document.tags.length > 0 && (
                      <View style={styles.tagsContainer}>
                        {document.tags.map((tag, index) => (
                          <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteDocument(document.id)}
                    style={styles.deleteButton}
                  >
                    <Icon name="delete" size={20} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </GlassCard>
          ))
        ) : (
          <GlassCard style={styles.emptyCard} padding={spacing.xl}>
            <Icon name="upload" size={48} />
            <Text style={styles.emptyText}>No documents</Text>
            <Text style={styles.emptySubtext}>
              Upload documents, images, or files for this patient
            </Text>
          </GlassCard>
        )}

        <PrimaryButton
          title="Upload Document"
          onPress={handleUpload}
          icon="upload"
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  documentCard: {
    marginBottom: spacing.md,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentIconText: {
    fontSize: 24,
  },
  documentContent: {
    flex: 1,
  },
  documentName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  documentDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  documentMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '20',
  },
  tagText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 10,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...typography.h5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default DocumentManagementScreen;

