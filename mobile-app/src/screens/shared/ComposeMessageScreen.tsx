import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ehrApi } from '../../config/api';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const ComposeMessageScreen: React.FC = () => {
  const navigation = useNavigation();
  const { token } = useSelector((state: RootState) => state.auth);
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSend = async () => {
    if (!recipientId || !subject || !messageText) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!token || !currentTenant?.slug) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    try {
      setLoading(true);
      await ehrApi.sendMessage(
        {
          recipientId,
          subject,
          messageText,
        },
        token,
        currentTenant.slug
      );

      Alert.alert('Success', 'Message sent successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Compose Message" subtitle="Send a new message" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.form} padding={spacing.lg}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Recipient ID *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter recipient ID"
                  placeholderTextColor={colors.textTertiary}
                  value={recipientId}
                  onChangeText={setRecipientId}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Subject *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📝</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter message subject"
                  placeholderTextColor={colors.textTertiary}
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Message *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter your message"
                  placeholderTextColor={colors.textTertiary}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  numberOfLines={8}
                />
              </View>
            </View>

            <PrimaryButton
              title="Send Message"
              onPress={handleSend}
              loading={loading}
              icon="📤"
            />
          </GlassCard>
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
  form: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
});

export default ComposeMessageScreen;
