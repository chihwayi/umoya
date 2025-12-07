import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import documentService, { Document } from '../../services/document.service';
import { format } from 'date-fns';

const DocumentViewerScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { documentId } = (route.params as any) || {};

  const [document, setDocument] = useState<Document | null>(null);
  const [viewUrl, setViewUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingUrl, setLoadingUrl] = useState(false);

  useEffect(() => {
    loadDocument();
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
        // For mobile, we'll open the URL which typically triggers download
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading document...</Text>
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Document not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonTextWhite}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const uploadDate = new Date(document.uploadedAt);
  const formattedDate = format(uploadDate, 'MMM dd, yyyy');
  const formattedTime = format(uploadDate, 'hh:mm a');
  const fileIcon = documentService.getFileIcon(document.mimeType);
  const fileSize = documentService.formatFileSize(document.fileSize);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Document
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.documentInfo}>
        <Text style={styles.documentIcon}>{fileIcon}</Text>
        <Text style={styles.documentName}>{document.documentName}</Text>
        <Text style={styles.documentType}>{document.documentType}</Text>
      </View>

      <View style={styles.detailsSection}>
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
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={handleView}
          disabled={loadingUrl}
        >
          {loadingUrl ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.actionButtonIcon}>👁️</Text>
              <Text style={styles.actionButtonText}>View Document</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.downloadButton]}
          onPress={handleDownload}
          disabled={loadingUrl}
        >
          {loadingUrl ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.actionButtonIcon}>⬇️</Text>
              <Text style={styles.actionButtonText}>Download</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={handleShare}
        >
          <Text style={styles.actionButtonIcon}>📤</Text>
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  documentInfo: {
    backgroundColor: '#ffffff',
    padding: 24,
    alignItems: 'center',
    margin: 16,
    borderRadius: 12,
  },
  documentIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  documentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  documentType: {
    fontSize: 16,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  detailsSection: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  descriptionContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  descriptionText: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 8,
    lineHeight: 20,
  },
  tagsContainer: {
    paddingVertical: 12,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  tag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  viewButton: {
    backgroundColor: '#3b82f6',
  },
  downloadButton: {
    backgroundColor: '#10b981',
  },
  shareButton: {
    backgroundColor: '#6b7280',
  },
  actionButtonIcon: {
    fontSize: 20,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonTextWhite: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default DocumentViewerScreen;



