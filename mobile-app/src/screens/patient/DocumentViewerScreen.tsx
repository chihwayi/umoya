import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  Animated,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import documentService, { Document } from '../../services/document.service';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const DocumentViewerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { documentId } = (route.params as any) || {};

  const [document, setDocument] = useState<Document | null>(null);
  const [viewUrl, setViewUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDocument();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const doc = await documentService.getDocumentById(documentId);
      setDocument(doc);
    } catch (error) {
      console.error('Error loading document:', error);
      Alert.alert('Error', 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async () => {
    try {
      setLoadingUrl(true);
      const url = await documentService.getDocumentViewUrl(documentId);
      setViewUrl(url);
      
      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open document URL');
        }
      } else {
        Alert.alert('Error', 'Document URL not available');
      }
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Error', 'Failed to open document');
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleDownload = async () => {
    try {
      setLoadingUrl(true);
      const url = await documentService.getDocumentViewUrl(documentId);
      
      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          Alert.alert('Download Started', 'The document download has started');
        } else {
          Alert.alert('Error', 'Cannot download document');
        }
      } else {
        Alert.alert('Error', 'Document URL not available');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      Alert.alert('Error', 'Failed to download document');
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleShare = async () => {
    if (!document) return;

    try {
      const url = viewUrl || await documentService.getDocumentViewUrl(documentId);
      await Share.share({
        message: `Medical Document: ${document.documentName}\n${url}`,
        title: document.documentName,
      });
    } catch (error) {
      console.error('Error sharing document:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Document" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Document" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Document not found</Text>
        </View>
      </View>
    );
  }

  const uploadDate = new Date(document.uploadedAt);
  const formattedDate = format(uploadDate, 'MMM dd, yyyy');
  const formattedTime = format(uploadDate, 'hh:mm a');
  const fileIcon = documentService.getFileIcon(document.mimeType);
  const fileSize = documentService.formatFileSize(document.fileSize);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Document" subtitle={document.documentName} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.documentInfo} padding={spacing.xl}>
            <Text style={styles.documentIcon}>{fileIcon}</Text>
            <Text style={styles.documentName}>{document.documentName}</Text>
            <Text style={styles.documentType}>{document.documentType}</Text>
          </GlassCard>

          <GlassCard style={styles.detailsSection} padding={spacing.lg}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>File Size</Text>
              <Text style={styles.detailValue}>{fileSize}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>File Type</Text>
              <Text style={styles.detailValue}>{document.mimeType || 'Unknown'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Uploaded</Text>
              <Text style={styles.detailValue}>
                {formattedDate} at {formattedTime}
              </Text>
            </View>
            {document.uploadedByFirstName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Uploaded By</Text>
                <Text style={styles.detailValue}>
                  {document.uploadedByFirstName} {document.uploadedByLastName}
                </Text>
              </View>
            )}
            {document.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.descriptionText}>{document.description}</Text>
              </View>
            )}
            {document.tags && document.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                <Text style={styles.detailLabel}>Tags</Text>
                <View style={styles.tagsList}>
                  {document.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </GlassCard>

          <View style={styles.actions}>
            <PrimaryButton
              title="View Document"
              onPress={handleView}
              loading={loadingUrl}
              icon="👁️"
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleDownload}
              disabled={loadingUrl}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>⬇️ Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>📤 Share</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
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
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  documentInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  documentIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  documentName: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  documentType: {
    ...typography.body,
    color: colors.textTertiary,
    textTransform: 'capitalize',
  },
  detailsSection: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textTertiary,
  },
  detailValue: {
    ...typography.body,
    flex: 1,
    textAlign: 'right',
  },
  descriptionContainer: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  descriptionText: {
    ...typography.body,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  tagsContainer: {
    paddingTop: spacing.md,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
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
  actions: {
    gap: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default DocumentViewerScreen;
