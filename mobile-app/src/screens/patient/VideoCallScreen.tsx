import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import telemedicineService from '../../services/telemedicine.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const VideoCallScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { consultationId } = (route.params as any) || {};
  const { user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMeetingUrl();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
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
      Alert.alert('Join Call', `Meeting URL: ${meetingUrl}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Video Consultation" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparing video call...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Video Consultation" subtitle="Join your virtual appointment" />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <GlassCard style={styles.card} padding={spacing.xl}>
          <Text style={styles.icon}>📹</Text>
          <Text style={styles.instructionText}>
            {meetingUrl
              ? 'Click the button below to join the video call'
              : 'Meeting URL not available'}
          </Text>

          {meetingUrl && (
            <PrimaryButton
              title="Join Call"
              onPress={handleJoinCall}
              icon="📹"
            />
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </GlassCard>
      </Animated.View>
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
    justifyContent: 'center',
    alignItems: 'center',
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
  card: {
    alignItems: 'center',
    width: '100%',
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  instructionText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cancelButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.textTertiary,
  },
});

export default VideoCallScreen;
