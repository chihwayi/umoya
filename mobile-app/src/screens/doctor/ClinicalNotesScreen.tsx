import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import clinicalNotesService from '../../services/clinical-notes.service';
import appointmentService from '../../services/appointment.service';
import terminologyService, { SnomedConcept, Icd10Code, Icd10Mapping } from '../../services/terminology.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';
import VoiceConsultationButton from '../../components/voice/VoiceConsultationButton';
import medicalEntityExtractor, { ExtractedEntities } from '../../services/medical-entity-extractor.service';
import appointmentService, { Appointment } from '../../services/appointment.service';

const ClinicalNotesScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { appointmentId, patientId } = route.params as { appointmentId?: string; patientId: string };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientName, setPatientName] = useState<string>('');
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  
  // SOAP Note fields 
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [physicalExamination, setPhysicalExamination] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Diagnosis codes
  const [selectedSnomedConcept, setSelectedSnomedConcept] = useState<SnomedConcept | null>(null);
  const [selectedIcd10Code, setSelectedIcd10Code] = useState<Icd10Code | null>(null);
  const [icd10Mappings, setIcd10Mappings] = useState<Icd10Mapping[]>([]);
  const [showSnomedSearch, setShowSnomedSearch] = useState(false);
  const [showIcd10Search, setShowIcd10Search] = useState(false);
  const [snomedSearchQuery, setSnomedSearchQuery] = useState('');
  const [icd10SearchQuery, setIcd10SearchQuery] = useState('');
  const [snomedResults, setSnomedResults] = useState<SnomedConcept[]>([]);
  const [icd10Results, setIcd10Results] = useState<Icd10Code[]>([]);
  const [searchingSnomed, setSearchingSnomed] = useState(false);
  const [searchingIcd10, setSearchingIcd10] = useState(false);
  const snomedSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const icd10SearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadExistingNotes();
  }, [appointmentId]);

  useEffect(() => {
    return () => {
      if (snomedSearchTimeoutRef.current) {
        clearTimeout(snomedSearchTimeoutRef.current);
      }
      if (icd10SearchTimeoutRef.current) {
        clearTimeout(icd10SearchTimeoutRef.current);
      }
    };
  }, []);

  // Load ICD-10 mappings when SNOMED concept is selected
  useEffect(() => {
    if (selectedSnomedConcept) {
      loadIcd10Mappings(selectedSnomedConcept.conceptId);
    } else {
      setIcd10Mappings([]);
    }
  }, [selectedSnomedConcept]);

  const loadIcd10Mappings = async (snomedConceptId: string) => {
    try {
      const mappings = await terminologyService.getIcd10MappingsFromSnomed(snomedConceptId, {
        primaryOnly: false,
        includeInactive: false,
        limit: 10,
      });
      setIcd10Mappings(mappings);
    } catch (error) {
      console.error('Error loading ICD-10 mappings:', error);
      setIcd10Mappings([]);
    }
  };

  const searchSnomed = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSnomedResults([]);
      setSearchingSnomed(false);
      return;
    }

    try {
      setSearchingSnomed(true);
      console.log(`🔍 [ClinicalNotesScreen] Searching SNOMED for: "${trimmedQuery}"`);
      const results = await terminologyService.searchSnomed(trimmedQuery, {
        limit: 20,
        activeOnly: true,
        context: 'condition',
      });
      console.log(`✅ [ClinicalNotesScreen] SNOMED results: ${results.length} concepts`);
      setSnomedResults(Array.isArray(results) ? results : []);
    } catch (error: any) {
      console.error('❌ [ClinicalNotesScreen] Error searching SNOMED:', error);
      console.error('❌ [ClinicalNotesScreen] Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      setSnomedResults([]);
    } finally {
      setSearchingSnomed(false);
    }
  }, []);

  const searchIcd10 = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setIcd10Results([]);
      setSearchingIcd10(false);
      return;
    }

    try {
      setSearchingIcd10(true);
      console.log(`🔍 [ClinicalNotesScreen] Searching ICD-10 for: "${trimmedQuery}"`);
      const results = await terminologyService.searchIcd10(trimmedQuery, {
        limit: 20,
        billable: true,
      });
      console.log(`✅ [ClinicalNotesScreen] ICD-10 results: ${results.length} codes`);
      setIcd10Results(Array.isArray(results) ? results : []);
    } catch (error: any) {
      console.error('❌ [ClinicalNotesScreen] Error searching ICD-10:', error);
      console.error('❌ [ClinicalNotesScreen] Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      setIcd10Results([]);
    } finally {
      setSearchingIcd10(false);
    }
  }, []);

  const handleSnomedSearchChange = (text: string) => {
    setSnomedSearchQuery(text);
    
    if (snomedSearchTimeoutRef.current) {
      clearTimeout(snomedSearchTimeoutRef.current);
    }
    
    if (text.trim().length >= 2) {
      snomedSearchTimeoutRef.current = setTimeout(() => {
        searchSnomed(text);
      }, 500);
    } else {
      setSnomedResults([]);
    }
  };

  const handleIcd10SearchChange = (text: string) => {
    setIcd10SearchQuery(text);
    
    if (icd10SearchTimeoutRef.current) {
      clearTimeout(icd10SearchTimeoutRef.current);
    }
    
    if (text.trim().length >= 2) {
      icd10SearchTimeoutRef.current = setTimeout(() => {
        searchIcd10(text);
      }, 500);
    } else {
      setIcd10Results([]);
    }
  };

  const handleSelectSnomed = (concept: SnomedConcept) => {
    setSelectedSnomedConcept(concept);
    if (concept.term && !assessment.includes(concept.term)) {
      setAssessment(prev => prev ? `${prev}\n${concept.term}` : concept.term);
    }
    setShowSnomedSearch(false);
    setSnomedSearchQuery('');
    setSnomedResults([]);
  };

  const handleSelectIcd10 = (code: Icd10Code) => {
    setSelectedIcd10Code(code);
    setShowIcd10Search(false);
    setIcd10SearchQuery('');
    setIcd10Results([]);
  };

  const handleSelectIcd10Mapping = (mapping: Icd10Mapping) => {
    setSelectedIcd10Code({
      code: mapping.targetCode,
      description: mapping.targetDisplay,
      billable: true,
      validForCoding: true,
    });
  };

  const loadExistingNotes = async () => {
    if (!appointmentId) return;

    try {
      setLoading(true);
      const appointmentData = await appointmentService.getAppointmentById(appointmentId);
      setAppointment(appointmentData);
      
      // Set patient name for voice consultation
      if (appointmentData?.patient) {
        setPatientName(
          `${appointmentData.patient.firstName || ''} ${appointmentData.patient.lastName || ''}`.trim()
        );
      }
      
      if (appointmentData?.notes) {
        try {
          const notes = typeof appointment.notes === 'string' 
            ? JSON.parse(appointment.notes) 
            : appointment.notes;
          
          const clinicalDoc = notes.clinicalDocumentation || {};
          setChiefComplaint(clinicalDoc.chiefComplaint || '');
          setHistoryOfPresentIllness(clinicalDoc.historyOfPresentIllness || '');
          setPhysicalExamination(clinicalDoc.physicalExamination || '');
          setAssessment(clinicalDoc.clinicalAssessment || '');
          setPlan(clinicalDoc.plan || '');
          setAdditionalNotes(notes.notes || clinicalDoc.additionalNotes || '');
        } catch (e) {
          // If notes is plain text, put it in additionalNotes
          setAdditionalNotes(appointmentData.notes);
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!appointmentId) {
      Alert.alert('Error', 'Appointment ID is required');
      return;
    }

    try {
      setSaving(true);
      
      await clinicalNotesService.updateAppointmentNotes(appointmentId, {
        clinicalDocumentation: {
          chiefComplaint,
          historyOfPresentIllness,
          physicalExamination,
          clinicalAssessment: assessment,
          plan,
          additionalNotes,
        },
        notes: additionalNotes,
      });

      Alert.alert('Success', 'Clinical notes saved successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', error.message || 'Failed to save clinical notes');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!appointmentId) return;
    
    try {
      setSaving(true);
      await clinicalNotesService.updateAppointmentNotes(appointmentId, {
        clinicalDocumentation: {
          chiefComplaint,
          historyOfPresentIllness,
          physicalExamination,
          clinicalAssessment: assessment,
          plan,
          additionalNotes,
        },
        notes: additionalNotes,
      });
      Alert.alert('Draft Saved', 'Your notes have been saved as draft');
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Clinical Notes" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScreenHeader title="Clinical Notes" subtitle="SOAP Documentation" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="stethoscope" size={24} />
            <Text style={styles.sectionTitle}>Subjective</Text>
          </View>
          
          {/* Voice Consultation Button */}
          <View style={styles.voiceSection}>
            <VoiceConsultationButton
              patientName={patientName}
              patientId={patientId}
              language="auto"
              onTranscriptionComplete={(text, entities) => {
                // Auto-populate form fields from extracted entities
                if (entities.chiefComplaint) {
                  setChiefComplaint(entities.chiefComplaint);
                }
                if (entities.symptoms && entities.symptoms.length > 0) {
                  const symptomsText = entities.symptoms.join(', ');
                  setHistoryOfPresentIllness(prev => 
                    prev ? `${prev}\n\nSymptoms: ${symptomsText}` : `Symptoms: ${symptomsText}`
                  );
                }
                if (entities.problems && entities.problems.length > 0) {
                  const problemsText = entities.problems.join(', ');
                  setAssessment(prev => 
                    prev ? `${prev}\n\nProblems: ${problemsText}` : `Problems: ${problemsText}`
                  );
                }
                if (entities.notes) {
                  setAdditionalNotes(prev => 
                    prev ? `${prev}\n\nVoice Notes: ${entities.notes}` : `Voice Notes: ${entities.notes}`
                  );
                }
                
                // Show confirmation alert
                Alert.alert(
                  'Voice Transcription Complete',
                  `Extracted ${Object.keys(entities.vitals || {}).length} vitals, ${entities.symptoms?.length || 0} symptoms, and ${entities.problems?.length || 0} problems.\n\nPlease review and confirm the auto-populated fields.`,
                  [{ text: 'OK' }]
                );
              }}
              onError={(error) => {
                Alert.alert('Voice Recording Error', error);
              }}
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Chief Complaint</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter chief complaint..."
              placeholderTextColor={colors.textMuted}
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>History of Present Illness (HPI)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe the history of present illness..."
              placeholderTextColor={colors.textMuted}
              value={historyOfPresentIllness}
              onChangeText={setHistoryOfPresentIllness}
              multiline
              numberOfLines={6}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="chart" size={24} />
            <Text style={styles.sectionTitle}>Objective</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Physical Examination</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Document physical examination findings..."
              placeholderTextColor={colors.textMuted}
              value={physicalExamination}
              onChangeText={setPhysicalExamination}
              multiline
              numberOfLines={8}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="problem" size={24} />
            <Text style={styles.sectionTitle}>Assessment</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Clinical Assessment / Diagnosis</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Enter assessment and diagnosis..."
              placeholderTextColor={colors.textMuted}
              value={assessment}
              onChangeText={setAssessment}
              multiline
              numberOfLines={5}
            />
            
            {/* Diagnosis Code Selection - PROMINENT */}
            <View style={styles.diagnosisCodesContainer}>
              <View style={styles.diagnosisCodesHeader}>
                <Text style={styles.diagnosisCodesTitle}>📋 Diagnosis Coding (SNOMED/ICD-10)</Text>
                <Text style={styles.diagnosisCodesSubtitle}>Add structured diagnosis codes</Text>
              </View>
              <View style={styles.codeSelectionRow}>
                <TouchableOpacity
                  style={[
                    styles.codeButton,
                    styles.codeButtonProminent,
                    selectedSnomedConcept && styles.codeButtonSelected
                  ]}
                  onPress={() => setShowSnomedSearch(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.codeButtonIcon}>🔬</Text>
                  <Text style={styles.codeButtonText}>
                    {selectedSnomedConcept ? '✓ SNOMED CT Selected' : '+ Add SNOMED CT Code'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.codeButton,
                    styles.codeButtonProminent,
                    selectedIcd10Code && styles.codeButtonSelected
                  ]}
                  onPress={() => setShowIcd10Search(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.codeButtonIcon}>🏥</Text>
                  <Text style={styles.codeButtonText}>
                    {selectedIcd10Code ? '✓ ICD-10 Selected' : '+ Add ICD-10 Code'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Selected Codes Display */}
              {selectedSnomedConcept && (
                <View style={styles.selectedCodeCard}>
                  <View style={styles.selectedCodeHeader}>
                    <Text style={styles.selectedCodeLabel}>SNOMED CT</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedSnomedConcept(null);
                        setIcd10Mappings([]);
                        setSelectedIcd10Code(null);
                      }}
                    >
                      <Text style={styles.removeCodeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.selectedCodeValue}>{selectedSnomedConcept.conceptId}</Text>
                  <Text style={styles.selectedCodeDescription}>{selectedSnomedConcept.term}</Text>
                </View>
              )}

              {selectedIcd10Code && (
                <View style={styles.selectedCodeCard}>
                  <View style={styles.selectedCodeHeader}>
                    <Text style={styles.selectedCodeLabel}>ICD-10</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedIcd10Code(null)}
                    >
                      <Text style={styles.removeCodeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.selectedCodeValue}>{selectedIcd10Code.code}</Text>
                  <Text style={styles.selectedCodeDescription}>{selectedIcd10Code.description}</Text>
                </View>
              )}

              {/* ICD-10 Mappings from SNOMED */}
              {selectedSnomedConcept && icd10Mappings.length > 0 && !selectedIcd10Code && (
                <View style={styles.mappingsContainer}>
                  <Text style={styles.mappingsTitle}>Suggested ICD-10 Codes:</Text>
                  {icd10Mappings.slice(0, 3).map((mapping, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.mappingItem}
                      onPress={() => handleSelectIcd10Mapping(mapping)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.mappingCode}>{mapping.targetCode}</Text>
                      <Text style={styles.mappingDescription}>{mapping.targetDisplay}</Text>
                      {mapping.mapPriority === 1 && (
                        <Text style={styles.mappingPriority}>Primary</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="prescription" size={24} />
            <Text style={styles.sectionTitle}>Plan</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Treatment Plan</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Document treatment plan, medications, follow-up..."
              placeholderTextColor={colors.textMuted}
              value={plan}
              onChangeText={setPlan}
              multiline
              numberOfLines={6}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="notes" size={24} />
            <Text style={styles.sectionTitle}>Additional Notes</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Any additional notes or observations..."
              placeholderTextColor={colors.textMuted}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              multiline
              numberOfLines={4}
            />
          </View>
        </GlassCard>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.draftButton}
            onPress={handleSaveDraft}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Icon name="save" size={20} />
            <Text style={styles.draftButtonText}>Save Draft</Text>
          </TouchableOpacity>
          
          <PrimaryButton
            title="Save Notes"
            onPress={handleSave}
            disabled={saving}
            icon="check"
          />
        </View>
      </ScrollView>

      {/* SNOMED Search Modal */}
      <Modal
        visible={showSnomedSearch}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSnomedSearch(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search SNOMED CT</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSnomedSearch(false);
                  setSnomedSearchQuery('');
                  setSnomedResults([]);
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
                  placeholder="Search SNOMED CT diagnosis..."
                  placeholderTextColor={colors.textTertiary}
                  value={snomedSearchQuery}
                  onChangeText={handleSnomedSearchChange}
                  autoFocus
                />
                {searchingSnomed && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
                )}
              </View>
            </View>

            <FlatList
              data={snomedResults}
              keyExtractor={(item, index) => `${item.conceptId}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelectSnomed(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultItemContent}>
                    <Text style={styles.resultItemCode}>{item.conceptId}</Text>
                    <Text style={styles.resultItemName}>{item.term}</Text>
                    {item.preferredTerm && item.preferredTerm !== item.term && (
                      <Text style={styles.resultItemAlt}>{item.preferredTerm}</Text>
                    )}
                  </View>
                  <Text style={styles.selectArrow}>→</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                snomedSearchQuery.trim().length >= 2 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No SNOMED concepts found</Text>
                    <Text style={styles.emptyHint}>Try a different search term</Text>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
                  </View>
                )
              }
              style={styles.resultList}
              contentContainerStyle={snomedResults.length === 0 ? styles.resultListEmpty : styles.resultListContent}
            />
          </View>
        </View>
      </Modal>

      {/* ICD-10 Search Modal */}
      <Modal
        visible={showIcd10Search}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowIcd10Search(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search ICD-10</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowIcd10Search(false);
                  setIcd10SearchQuery('');
                  setIcd10Results([]);
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
                  placeholder="Search ICD-10 diagnosis code..."
                  placeholderTextColor={colors.textTertiary}
                  value={icd10SearchQuery}
                  onChangeText={handleIcd10SearchChange}
                  autoFocus
                />
                {searchingIcd10 && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
                )}
              </View>
            </View>

            <FlatList
              data={icd10Results}
              keyExtractor={(item, index) => `${item.code}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelectIcd10(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultItemContent}>
                    <Text style={styles.resultItemCode}>{item.code}</Text>
                    <Text style={styles.resultItemName}>{item.description}</Text>
                    {item.category && (
                      <Text style={styles.resultItemAlt}>Category: {item.category}</Text>
                    )}
                  </View>
                  <Text style={styles.selectArrow}>→</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                icd10SearchQuery.trim().length >= 2 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No ICD-10 codes found</Text>
                    <Text style={styles.emptyHint}>Try a different search term</Text>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
                  </View>
                )
              }
              style={styles.resultList}
              contentContainerStyle={snomedResults.length === 0 ? styles.resultListEmpty : styles.resultListContent}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  card: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.primary,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
    color: colors.textSecondary,
  },
  textInput: {
    ...typography.body,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minHeight: 50,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  draftButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  diagnosisCodesContainer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary + '08',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  diagnosisCodesHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '20',
  },
  diagnosisCodesTitle: {
    ...typography.h4,
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  diagnosisCodesSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  codeSelectionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  codeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonProminent: {
    backgroundColor: colors.primary + '15',
    borderWidth: 2,
    borderColor: colors.primary + '50',
    paddingVertical: spacing.lg,
    minHeight: 60,
  },
  codeButtonSelected: {
    backgroundColor: colors.primary + '25',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  codeButtonIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  codeButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: 13,
    textAlign: 'center',
  },
  selectedCodeCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  selectedCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  selectedCodeLabel: {
    ...typography.label,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  removeCodeText: {
    fontSize: 18,
    color: colors.error,
    fontWeight: 'bold',
  },
  selectedCodeValue: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  selectedCodeDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  mappingsContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
  },
  mappingsTitle: {
    ...typography.label,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  mappingItem: {
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  mappingCode: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mappingDescription: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  mappingPriority: {
    ...typography.bodySmall,
    fontSize: 10,
    color: colors.success,
    marginTop: spacing.xs,
    fontWeight: '600',
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
  resultList: {
    flex: 1,
  },
  resultListContent: {
    paddingBottom: spacing.xl,
  },
  resultListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  resultItemContent: {
    flex: 1,
  },
  resultItemCode: {
    ...typography.bodyBold,
    fontSize: 12,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  resultItemName: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  resultItemAlt: {
    ...typography.bodySmall,
    color: colors.textTertiary,
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
  voiceSection: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
});
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

export default ClinicalNotesScreen;

