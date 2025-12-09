import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import patientService, { Patient } from '../../services/patient.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const PatientSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const routeParams = route.params as { source?: string; showAppointments?: boolean } | undefined;
  const source = routeParams?.source; // 'recordVitals' or undefined 
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const performSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    
    console.log('🔍 [PatientSearchScreen] performSearch called with:', trimmedQuery);
    
    // Require at least 2 characters to search
    if (trimmedQuery.length < 2) {
      console.log('🔍 [PatientSearchScreen] Query too short, clearing results');
      setPatients([]);
      setError(null);
      return;
    }

    try {
      console.log('🔍 [PatientSearchScreen] Starting search...');
      setLoading(true);
      setError(null);
      
      // Search with the query
      console.log('🔍 [PatientSearchScreen] Calling patientService.searchPatients...');
      const results = await patientService.searchPatients(trimmedQuery);
      console.log('🔍 [PatientSearchScreen] Search returned:', results?.length || 0, 'results');
      
      // If multiple words, filter to match all words
      const words = trimmedQuery.split(/\s+/).filter(w => w.length > 0);
      console.log('🔍 [PatientSearchScreen] Search words:', words);
      console.log('🔍 [PatientSearchScreen] Results before filtering:', results?.length || 0);
      console.log('🔍 [PatientSearchScreen] First result:', results?.[0] ? JSON.stringify(results[0], null, 2) : 'No results');
      
      let finalResults = results || [];
      
      if (words.length >= 2 && results.length > 0) {
        const filtered = results.filter(patient => {
          const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
          const patientNumber = (patient.patientNumber || '').toLowerCase();
          const phone = (patient.phone || '').toLowerCase();
          const searchText = `${fullName} ${patientNumber} ${phone}`;
          
          // Check if all words appear in the patient's information
          return words.every(word => searchText.includes(word.toLowerCase()));
        });
        console.log('🔍 [PatientSearchScreen] After multi-word filter:', filtered.length);
        finalResults = filtered;
      }
      
      console.log('🔍 [PatientSearchScreen] Setting final results:', finalResults.length);
      console.log('🔍 [PatientSearchScreen] Final results data:', JSON.stringify(finalResults, null, 2));
      setPatients(finalResults);
    } catch (error: any) {
      console.error('❌ Error searching patients:', error);
      console.error('❌ Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to search patients';
      setError(errorMessage);
      setPatients([]);
      
      // Show error alert for debugging
      if (error.response?.status === 404) {
        Alert.alert('Search Error', 'Patient search endpoint not found. Please check API configuration.');
      } else if (error.response?.status === 401) {
        Alert.alert('Authentication Error', 'Please log in again.');
      } else if (error.response?.status === 500) {
        Alert.alert('Server Error', 'An error occurred on the server. Please try again later.');
      } else {
        // Show detailed error for debugging
        console.log('🔍 Showing error to user:', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const handleTextChange = (text: string) => {
    console.log('🔍 [PatientSearchScreen] Text changed:', text);
    setSearchQuery(text);
    setError(null);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce: search after 500ms of no typing
    if (text.trim().length >= 2) {
      console.log('🔍 [PatientSearchScreen] Scheduling search in 500ms...');
      searchTimeoutRef.current = setTimeout(() => {
        console.log('🔍 [PatientSearchScreen] Debounced search triggered');
        performSearch(text);
      }, 500);
    } else {
      console.log('🔍 [PatientSearchScreen] Query too short, clearing patients');
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

  const renderPatient = ({ item, index }: { item: Patient; index: number }) => {
    console.log(`🔍 [PatientSearchScreen] Rendering patient ${index}:`, {
      id: item.id,
      firstName: item.firstName,
      lastName: item.lastName,
      patientNumber: item.patientNumber
    });
    
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
          onPress={() => {
            console.log(`🔍 [PatientSearchScreen] Patient clicked:`, item.id);
            // If opened from "Record Vitals", navigate directly to Vitals screen
            if (source === 'recordVitals') {
              (navigation as any).navigate('Vitals', { patientId: item.id });
            } else {
              (navigation as any).navigate('PatientDetail', { patientId: item.id });
            }
          }}
          activeOpacity={0.8}
        >
          <GlassCard style={styles.patientCard} padding={spacing.lg}>
            <View style={styles.patientHeader}>
              <View style={styles.patientIconContainer}>
                <Text style={styles.patientIcon}>👤</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>
                  {item.firstName || ''} {item.lastName || ''}
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
  };

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title={source === 'recordVitals' ? 'Select Patient for Vitals' : 'Search Patients'} 
        subtitle={source === 'recordVitals' ? 'Find patient to record vitals' : 'Find patient records'} 
      />
      
      {/* Search Bar - Always visible */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
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
      </View>

      {/* Error Message */}
      {error && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <GlassCard style={styles.errorCard} padding={spacing.md}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={[styles.errorText, { marginTop: spacing.sm, fontSize: 12 }]}>
              Please check your connection and try again. Make sure you're searching with at least 2 characters.
            </Text>
          </GlassCard>
        </View>
      )}
      
      {/* Info Card */}
      {source === 'recordVitals' && searchQuery.trim().length === 0 && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <GlassCard style={styles.infoCard} padding={spacing.md}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>
              Search for a patient by name, patient ID, or phone number. Type at least 2 characters to start searching.
            </Text>
          </GlassCard>
        </View>
      )}

      {/* Content Area */}
      {loading && searchQuery.trim().length >= 2 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : !loading && patients.length > 0 ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={{ padding: spacing.md, backgroundColor: colors.info + '10', borderRadius: borderRadius.md }}>
              <Text style={{ fontSize: 12, color: colors.info, fontWeight: '600' }}>
                Found {patients.length} patient{patients.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <FlatList
            data={patients}
            renderItem={renderPatient}
            keyExtractor={(item, index) => {
              const key = item.id || `patient-${index}-${item.firstName}-${item.lastName}`;
              console.log(`🔍 [PatientSearchScreen] KeyExtractor for item ${index}:`, key);
              return key;
            }}
            contentContainerStyle={[styles.listContent, { paddingTop: 0 }]}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <Text style={{ color: colors.textTertiary }}>No patients to display</Text>
              </View>
            }
            onLayout={() => {
              console.log('🔍 [PatientSearchScreen] FlatList onLayout - patients.length:', patients.length);
            }}
          />
        </View>
      ) : !loading && patients.length === 0 && searchQuery.trim().length >= 2 && !error ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
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
              <Text style={[styles.emptyHint, { marginTop: spacing.sm, fontSize: 11, color: colors.textTertiary }]}>
                Search query: "{searchQuery}"
              </Text>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
      )}
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
  infoCard: {
    margin: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.info + '20',
    borderWidth: 1,
    borderColor: colors.info,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.info,
    flex: 1,
  },
});

export default PatientSearchScreen;

