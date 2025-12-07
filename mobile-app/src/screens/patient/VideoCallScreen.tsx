import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import telemedicineService from '../../services/telemedicine.service';

const VideoCallScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { consultationId } = (route.params as any) || {};
  const { user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);

  useEffect(() => {
    loadMeetingUrl();
  }, [consultationId]);

  const loadMeetingUrl = async () => {
    try {
      setLoading(true);
      if (consultationId) {
        const url = await telemedicineService.getMeetingUrl(consultationId);
        setMeetingUrl(url);
      }
    } catch (error) {
      console.error('Error loading meeting URL:', error);
      Alert.alert('Error', 'Failed to load meeting URL');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCall = () => {
    if (meetingUrl) {
      // In a real implementation, you would open the video call interface
      // For now, we'll just show an alert
      Alert.alert('Join Call', `Meeting URL: ${meetingUrl}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Preparing video call...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Video Consultation</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.instructionText}>
          {meetingUrl
            ? 'Click the button below to join the video call'
            : 'Meeting URL not available'}
        </Text>

        {meetingUrl && (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoinCall}
            activeOpacity={0.7}
          >
            <Text style={styles.joinButtonText}>Join Call</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 30,
  },
  joinButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
});

export default VideoCallScreen;
