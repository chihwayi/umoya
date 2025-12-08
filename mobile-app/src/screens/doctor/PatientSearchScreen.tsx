import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import patientService, { Patient } from '../../services/patient.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const PatientSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const performSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    
    // Require at least 2 characters to search
    if (trimmedQuery.length < 2) {
      setPatients([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Search with the query
      const results = await patientService.searchPatients(trimmedQuery);
      
      // If multiple words, filter to match all words
      const words = trimmedQuery.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2 && results.length > 0) {
        const filtered = results.filter(patient => {
          const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
          const patientNumber = (patient.patientNumber || '').toLowerCase();
          const phone = (patient.phone || '').toLowerCase();
          const searchText = `${fullName} ${patientNumber} ${phone}`;
          
          // Check if all words appear in the patient's information
          return words.every(word => searchText.includes(word.toLowerCase()));
        });
        setPatients(filtered);
      } else {
        setPatients(results);
      }
    } catch (error: any) {
      console.error('Error searching patients:', error);
      setError(error.response?.data?.message || error.message || 'Failed to search patients');
      setPatients([]);
      
      // Show error alert for debugging
      if (error.response?.status === 404) {
        Alert.alert('Search Error', 'Patient search endpoint not found. Please check API configuration.');
      } else if (error.response?.status === 401) {
        Alert.alert('Authentication Error', 'Please log in again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const handleTextChange = (text: string) => {
    setSearchQuery(text);
    setError(null);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce: search after 500ms of no typing
    if (text.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(text);
      }, 500);
    } else {
      setPatients([]);
    }
  };

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const renderPatient = ({ item, index }: { item: Patient; index: number }) => (
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
        onPress={() => (navigation as any).navigate('PatientDetail', { patientId: item.id })}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.patientCard} padding={spacing.lg}>
          <View style={styles.patientHeader}>
            <View style={styles.patientIconContainer}>
              <Text style={styles.patientIcon}>👤</Text>
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>
                {item.firstName} {item.lastName}
              </Text>
              {item.patientNumber && (
                <Text style={styles.patientNumber}>ID: {item.patientNumber}</Text>
              )}
              {item.dateOfBirth && (
                <Text style={styles.patientMeta}>DOB: {item.dateOfBirth}</Text>
              )}
            </View>
            <Text style={styles.arrow}>→</Text>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Search Patients" subtitle="Find patient records" />
      <View style={styles.content}>
        <GlassCard style={styles.searchContainer} padding={spacing.md}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, ID, or phone (min 2 chars)..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={handleTextChange}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.7}>
              {loading ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>

        {error && (
          <GlassCard style={styles.errorCard} padding={spacing.md}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCard>
        )}
        
        {loading && searchQuery.trim().length >= 2 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {!loading && patients.length === 0 && searchQuery.trim().length >= 2 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>No Patients Found</Text>
              <Text style={styles.emptySubtext}>
                Try a different search term or check spelling
              </Text>
              <Text style={styles.emptyHint}>
                Search by: First Name, Last Name, Patient ID, or Phone Number
              </Text>
            </GlassCard>
          </Animated.View>
        ) : !loading && patients.length > 0 ? (
          <FlatList
            data={patients}
            renderItem={renderPatient}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Search Patients</Text>
              <Text style={styles.emptySubtext}>
                Enter at least 2 characters to search
              </Text>
              <Text style={styles.emptyHint}>
                Search by: First Name, Last Name, Patient ID, or Phone Number
              </Text>
            </GlassCard>
          </Animated.View>
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
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.lg,
  },
  patientCard: {
    marginBottom: spacing.md,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  patientIcon: {
    fontSize: 28,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  patientNumber: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  patientMeta: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  arrow: {
    fontSize: 24,
    color: colors.textTertiary,
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
    marginBottom: spacing.xs,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorCard: {
    margin: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.error + '20',
    borderWidth: 1,
    borderColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
});

export default PatientSearchScreen;

