import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';

interface MedicalRecord {
  id: string;
  recordNumber?: string;
  type: string;
  recordDate: string;
  chiefComplaint: string;
  provider?: {
    firstName: string;
    lastName: string;
  };
  diagnoses?: Array<{
    code: string;
    description: string;
    type: string;
  }>;
}

const MedicalRecordsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadRecords();
  }, [filter]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      if (patientId && currentTenant) {
        const response = await ehrApi.get(API_ENDPOINTS.MEDICAL_RECORD.PATIENT(patientId));
        let data = response.data.records || response.data || [];
        
        // Filter by type if not 'all'
        if (filter !== 'all') {
          data = data.filter((record: MedicalRecord) => record.type === filter);
        }
        
        setRecords(data);
      }
    } catch (error) {
      console.error('Error loading medical records:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation':
        return '🩺';
      case 'diagnosis':
        return '🔍';
      case 'treatment':
        return '💊';
      case 'procedure':
        return '⚕️';
      case 'lab_result':
        return '🔬';
      case 'imaging':
        return '📷';
      case 'prescription':
        return '📋';
      case 'vaccination':
        return '💉';
      case 'discharge':
        return '🏥';
      default:
        return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consultation':
        return '#3b82f6';
      case 'diagnosis':
        return '#8b5cf6';
      case 'treatment':
        return '#10b981';
      case 'procedure':
        return '#f59e0b';
      case 'lab_result':
        return '#06b6d4';
      case 'imaging':
        return '#ec4899';
      default:
        return '#6b7280';
    }
  };

  const renderRecord = ({ item }: { item: MedicalRecord }) => {
    const recordDate = new Date(item.recordDate);
    const formattedDate = format(recordDate, 'MMM dd, yyyy');
    const formattedTime = format(recordDate, 'hh:mm a');
    const typeIcon = getTypeIcon(item.type);
    const typeColor = getTypeColor(item.type);

    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() => (navigation as any).navigate('MedicalRecordDetail', { recordId: item.id })}
      >
        <View style={styles.recordHeader}>
          <View style={[styles.typeIcon, { backgroundColor: typeColor + '20' }]}>
            <Text style={styles.typeIconText}>{typeIcon}</Text>
          </View>
          <View style={styles.recordInfo}>
            <Text style={styles.recordType}>{item.type.replace('_', ' ').toUpperCase()}</Text>
            {item.recordNumber && (
              <Text style={styles.recordNumber}>#{item.recordNumber}</Text>
            )}
          </View>
        </View>
        <Text style={styles.chiefComplaint} numberOfLines={2}>
          {item.chiefComplaint}
        </Text>
        {item.diagnoses && item.diagnoses.length > 0 && (
          <View style={styles.diagnosesContainer}>
            <Text style={styles.diagnosesLabel}>Diagnosis:</Text>
            <Text style={styles.diagnosesText} numberOfLines={1}>
              {item.diagnoses.map(d => d.description).join(', ')}
            </Text>
          </View>
        )}
        <View style={styles.recordMeta}>
          <Text style={styles.metaText}>
            {formattedDate} at {formattedTime}
          </Text>
          {item.provider && (
            <Text style={styles.metaText}>
              Dr. {item.provider.firstName} {item.provider.lastName}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const recordTypes = Array.from(new Set(records.map(r => r.type)));

  if (loading && records.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading medical records...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Medical Records</Text>
      </View>

      {recordTypes.length > 0 && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {recordTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterButton, filter === type && styles.filterButtonActive]}
                onPress={() => setFilter(type)}
              >
                <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
                  {type.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No medical records found</Text>
          <Text style={styles.emptySubtext}>
            {filter !== 'all' ? `No ${filter} records` : 'You have no medical records at this time'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
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
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  filterContainer: {
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 4,
    marginLeft: 16,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeIconText: {
    fontSize: 24,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  recordNumber: {
    fontSize: 12,
    color: '#6b7280',
  },
  chiefComplaint: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 8,
    lineHeight: 20,
  },
  diagnosesContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  diagnosesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 4,
  },
  diagnosesText: {
    fontSize: 13,
    color: '#4b5563',
    flex: 1,
  },
  recordMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
});

export default MedicalRecordsScreen;



