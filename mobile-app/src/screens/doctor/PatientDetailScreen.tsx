import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import patientService, { Patient } from '../../services/patient.service';
import prescriptionService from '../../services/prescription.service';
import labService from '../../services/lab.service';

const PatientDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activePrescriptions, setActivePrescriptions] = useState<any[]>([]);
  const [recentLabs, setRecentLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const [patientData, prescriptions, labs] = await Promise.all([
        patientService.getPatientProfile(patientId),
        prescriptionService.getActivePrescriptions(patientId),
        labService.getPatientLabResults(patientId),
      ]);

      setPatient(patientData);
      setActivePrescriptions(prescriptions);
      setRecentLabs(labs.slice(0, 5)); // Last 5 results
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Patient not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.patientName}>
          {patient.firstName} {patient.lastName}
        </Text>
        {patient.patientNumber && (
          <Text style={styles.patientNumber}>ID: {patient.patientNumber}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Demographics</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date of Birth:</Text>
          <Text style={styles.infoValue}>{patient.dateOfBirth}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Gender:</Text>
          <Text style={styles.infoValue}>{patient.gender}</Text>
        </View>
        {patient.phone && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{patient.phone}</Text>
          </View>
        )}
        {patient.email && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{patient.email}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Prescriptions</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
          >
            <Text style={styles.actionButton}>+ Prescribe</Text>
          </TouchableOpacity>
        </View>
        {activePrescriptions.length > 0 ? (
          activePrescriptions.map((prescription) => (
            <View key={prescription.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{prescription.medication}</Text>
              <Text style={styles.itemSubtitle}>
                {prescription.dosage} - {prescription.frequency}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No active prescriptions</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Lab Results</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateLabOrder' as never, { patientId } as never)}
          >
            <Text style={styles.actionButton}>+ Order Lab</Text>
          </TouchableOpacity>
        </View>
        {recentLabs.length > 0 ? (
          recentLabs.map((lab) => (
            <View key={lab.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{lab.testName}</Text>
              <Text style={styles.itemSubtitle}>
                {lab.value} {lab.unit} - {lab.status}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No recent lab results</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
        >
          <Text style={styles.primaryButtonText}>Prescribe Medication</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('CreateLabOrder' as never, { patientId } as never)}
        >
          <Text style={styles.secondaryButtonText}>Order Lab Test</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 60,
  },
  patientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  patientNumber: {
    fontSize: 14,
    color: '#e0e7ff',
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    marginBottom: 0,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  actions: {
    padding: 15,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
});

export default PatientDetailScreen;

