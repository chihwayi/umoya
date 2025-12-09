import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import prescriptionService from '../../services/prescription.service';
import drugService, { Drug } from '../../services/drug.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const CreatePrescriptionScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [medication, setMedication] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchingDrugs, setSearchingDrugs] = useState(false);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [showDrugSearch, setShowDrugSearch] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current; 

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchDrugs = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setDrugResults([]);
      setSearchingDrugs(false);
      return;
    }

    try {
      setSearchingDrugs(true);
      console.log(`🔍 [CreatePrescriptionScreen] Searching for: "${trimmedQuery}"`);
      const results = await drugService.searchDrugs(trimmedQuery);
      console.log(`✅ [CreatePrescriptionScreen] Search results:`, results.length, 'drugs');
      console.log(`📋 [CreatePrescriptionScreen] Results:`, JSON.stringify(results.slice(0, 3), null, 2));
      
      const drugArray = Array.isArray(results) ? results : [];
      console.log(`🎯 [CreatePrescriptionScreen] Setting drugResults to:`, drugArray.length, 'items');
      console.log(`🎯 [CreatePrescriptionScreen] First item ID:`, drugArray[0]?.id);
      setDrugResults(drugArray);
      
      // Force a re-render check
      setTimeout(() => {
        console.log(`🔍 [CreatePrescriptionScreen] State check - drugResults length:`, drugArray.length);
      }, 100);
    } catch (error: any) {
      console.error('❌ [CreatePrescriptionScreen] Error searching drugs:', error);
      console.error('❌ [CreatePrescriptionScreen] Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      setDrugResults([]);
    } finally {
      setSearchingDrugs(false);
    }
  }, []);

  const handleDrugSearchChange = (text: string) => {
    setMedication(text);
    setDrugSearchQuery(text);
    
    // Clear selected drug if user is typing
    if (selectedDrug && text !== selectedDrug.genericName) {
      setSelectedDrug(null);
    }
    
    // Always open modal when typing
    if (!showDrugSearch && text.trim().length > 0) {
      setShowDrugSearch(true);
    }
    
    // Search if text is long enough
    if (text.trim().length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      searchTimeoutRef.current = setTimeout(() => {
        console.log(`🔍 [CreatePrescriptionScreen] Searching for: "${text}"`);
        searchDrugs(text);
      }, 300); // Reduced debounce for faster response
    } else {
      setDrugResults([]);
    }
  };

  const handleSelectDrug = (drug: Drug) => {
    setSelectedDrug(drug);
    setMedication(drug.genericName);
    if (drug.brandNames && drug.brandNames.length > 0) {
      setMedication(`${drug.genericName} (${drug.brandNames[0]})`);
    }
    if (drug.strength) {
      setDosage(drug.strength);
    }
    setShowDrugSearch(false);
    setDrugSearchQuery('');
    setDrugResults([]);
  };

  const handleSubmit = async () => {
    if (!medication || !dosage || !frequency || !duration) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await prescriptionService.createPrescription({
        patientId,
        medicationName: selectedDrug ? selectedDrug.genericName : medication,
        medicationId: selectedDrug?.id,
        dosage,
        frequency,
        duration,
        instructions: instructions || undefined,
        quantity: quantity ? parseInt(quantity) : undefined,
        // Include SNOMED code if available
        medicationNameSnomed: selectedDrug?.snomedCode ? {
          conceptId: selectedDrug.snomedCode,
          term: selectedDrug.genericName,
        } : undefined,
      });

      Alert.alert('Success', 'Prescription created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Error creating prescription:', error);
      Alert.alert('Error', error.message || 'Failed to create prescription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="New Prescription" subtitle="Create a new medication prescription" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.form} padding={spacing.lg}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Medication *</Text>
              <View style={[styles.inputContainer, selectedDrug && { borderColor: colors.primary, borderWidth: 2 }]}>
                <Text style={styles.inputIcon}>💊</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Search medication from drug database..."
                  placeholderTextColor={colors.textTertiary}
                  value={medication}
                  onChangeText={(text) => {
                    setMedication(text);
                    if (!text) {
                      setSelectedDrug(null);
                    }
                    // Trigger search as user types
                    handleDrugSearchChange(text);
                  }}
                  onFocus={() => {
                    if (!selectedDrug) {
                      setShowDrugSearch(true);
                    }
                  }}
                  editable={true}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (selectedDrug) {
                      setSelectedDrug(null);
                      setMedication('');
                    } else {
                      setShowDrugSearch(true);
                    }
                  }}
                  style={styles.searchButton}
                >
                  <Text style={styles.searchButtonText}>🔍</Text>
                </TouchableOpacity>
                {selectedDrug && (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedDrug(null);
                      setMedication('');
                    }}
                    style={styles.clearButton}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {selectedDrug && (
                <View style={styles.drugInfo}>
                  <Text style={styles.drugInfoText}>
                    {selectedDrug.genericName}
                    {selectedDrug.brandNames && selectedDrug.brandNames.length > 0 && (
                      <Text style={styles.brandName}> • {selectedDrug.brandNames[0]}</Text>
                    )}
                  </Text>
                  {selectedDrug.drugClass && (
                    <Text style={styles.drugClass}>{selectedDrug.drugClass}</Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Dosage *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📏</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 500mg"
                  placeholderTextColor={colors.textTertiary}
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>⏰</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Twice daily"
                  placeholderTextColor={colors.textTertiary}
                  value={frequency}
                  onChangeText={setFrequency}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Duration *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📅</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 7 days"
                  placeholderTextColor={colors.textTertiary}
                  value={duration}
                  onChangeText={setDuration}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantity</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔢</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Number of tablets/capsules"
                  placeholderTextColor={colors.textTertiary}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instructions</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Additional instructions for patient"
                  placeholderTextColor={colors.textTertiary}
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>

            <PrimaryButton
              title="Create Prescription"
              onPress={handleSubmit}
              loading={loading}
              icon="💊"
            />
          </GlassCard>
        </Animated.View>
      </ScrollView>

      {/* Drug Search Modal */}
      <Modal
        visible={showDrugSearch}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDrugSearch(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Medication</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDrugSearch(false);
                  setDrugSearchQuery('');
                  setDrugResults([]);
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by generic or brand name..."
                  placeholderTextColor={colors.textTertiary}
                  value={drugSearchQuery}
                  onChangeText={handleDrugSearchChange}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchingDrugs && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
                )}
                {!searchingDrugs && drugSearchQuery.trim().length >= 2 && drugResults.length > 0 && (
                  <Text style={styles.searchResultsCount}>{drugResults.length} found</Text>
                )}
              </View>
            </View>

            {drugSearchQuery.trim().length >= 2 && (
              <View style={styles.searchStatusContainer}>
                {searchingDrugs ? (
                  <View style={styles.searchStatus}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.searchStatusText}>Searching...</Text>
                  </View>
                ) : drugResults.length > 0 ? (
                  <Text style={styles.searchStatusText}>Found {drugResults.length} medication{drugResults.length !== 1 ? 's' : ''}</Text>
                ) : (
                  <Text style={styles.searchStatusText}>No medications found. Try a different search term.</Text>
                )}
              </View>
            )}

            {/* Debug: Show drugResults count */}
            {__DEV__ && (
              <View style={{ padding: spacing.sm, backgroundColor: colors.warning + '20' }}>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                  DEBUG: drugResults.length = {drugResults.length}
                </Text>
              </View>
            )}

            <View style={styles.drugListContainer}>
              {drugResults.length > 0 ? (
                <FlatList
                  data={drugResults}
                  keyExtractor={(item, index) => {
                    const key = item.id || item.genericName || `drug-${index}`;
                    if (__DEV__) {
                      console.log(`🔑 [CreatePrescriptionScreen] Key for item ${index}:`, key);
                    }
                    return key;
                  }}
                  renderItem={({ item, index }) => {
                    if (__DEV__) {
                      console.log(`🎨 [CreatePrescriptionScreen] Rendering drug item ${index}:`, item.genericName, 'ID:', item.id);
                    }
                    return (
                      <TouchableOpacity
                        style={styles.drugItem}
                        onPress={() => {
                          if (__DEV__) {
                            console.log(`👆 [CreatePrescriptionScreen] Drug selected:`, item.genericName);
                          }
                          handleSelectDrug(item);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.drugItemContent}>
                          <Text style={styles.drugItemName}>{item.genericName || 'Unknown'}</Text>
                          {item.brandNames && Array.isArray(item.brandNames) && item.brandNames.length > 0 && (
                            <Text style={styles.drugItemBrand}>
                              Brand: {item.brandNames.join(', ')}
                            </Text>
                          )}
                          {item.drugClass && (
                            <Text style={styles.drugItemClass}>{item.drugClass}</Text>
                          )}
                          {item.description && (
                            <Text style={styles.drugItemDescription}>{item.description}</Text>
                          )}
                          {item.strength && (
                            <Text style={styles.drugItemStrength}>Strength: {item.strength} {item.unit || ''}</Text>
                          )}
                        </View>
                        <Text style={styles.selectArrow}>→</Text>
                      </TouchableOpacity>
                    );
                  }}
                  style={styles.drugList}
                  contentContainerStyle={styles.drugListContent}
                  showsVerticalScrollIndicator={true}
                  removeClippedSubviews={false}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={10}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  {drugSearchQuery.trim().length >= 2 ? (
                    <>
                      <Text style={styles.emptyText}>No medications found</Text>
                      <Text style={styles.emptyHint}>Try a different search term</Text>
                    </>
                  ) : (
                    <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  drugInfo: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
  },
  drugInfoText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  brandName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  drugClass: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  searchButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  searchButtonText: {
    fontSize: 18,
    color: colors.primary,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  clearButtonText: {
    fontSize: 18,
    color: colors.error,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingTop: spacing.lg,
    flex: 1,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  modalTitle: {
    ...typography.h3,
    fontSize: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.error,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
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
  searchResultsCount: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  searchStatusContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchStatusText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  drugListContainer: {
    flex: 1,
    minHeight: 200,
    maxHeight: 400,
  },
  drugList: {
    flex: 1,
  },
  drugListContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  drugListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 200,
  },
  drugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  drugItemContent: {
    flex: 1,
  },
  drugItemName: {
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  drugItemBrand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  drugItemClass: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  drugItemStrength: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  drugItemDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  selectArrow: {
    fontSize: 20,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});

export default CreatePrescriptionScreen;
