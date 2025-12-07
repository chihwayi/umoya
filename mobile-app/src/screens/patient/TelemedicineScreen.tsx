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
import telemedicineService, { TelemedicineConsultation } from '../../services/telemedicine.service';
import { format } from 'date-fns';

const TelemedicineScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [consultations, setConsultations] = useState<TelemedicineConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    loadConsultations();
  }, [filter]);

  const loadConsultations = async () => {
    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      if (patientId) {
        const filters: any = { patientId };
        if (filter !== 'all') {
          filters.status = filter;
        }
        const data = await telemedicineService.getConsultations(filters);
        setConsultations(data);
      }
    } catch (error) {
      console.error('Error loading consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConsultations();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return '#3b82f6';
      case 'in_progress':
        return '#10b981';
      case 'completed':
        return '#6b7280';
      case 'cancelled':
        return '#ef4444';
      case 'no_show':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return '📅';
      case 'in_progress':
        return '🔴';
      case 'completed':
        return '✅';
      case 'cancelled':
        return '❌';
      case 'no_show':
        return '⏰';
      default:
        return '📋';
    }
  };

  const canJoin = (consultation: TelemedicineConsultation) => {
    return consultation.status === 'scheduled' || consultation.status === 'in_progress';
  };

  const renderConsultation = ({ item }: { item: TelemedicineConsultation }) => {
    const scheduledDate = new Date(item.scheduledStartTime);
    const formattedDate = format(scheduledDate, 'MMM dd, yyyy');
    const formattedTime = format(scheduledDate, 'hh:mm a');
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <TouchableOpacity
        style={styles.consultationCard}
        onPress={() => (navigation as any).navigate('ConsultationDetail', { consultationId: item.id })}
      >
        <View style={styles.consultationHeader}>
          <View style={styles.consultationInfo}>
            <View style={styles.statusRow}>
              <Text style={styles.statusIcon}>{statusIcon}</Text>
              <View
                style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
            {item.doctorName && (
              <Text style={styles.doctorName}>Dr. {item.doctorName}</Text>
            )}
            <Text style={styles.consultationType}>
              {item.consultationType.toUpperCase()} Consultation
            </Text>
          </View>
        </View>
        <View style={styles.consultationMeta}>
          <Text style={styles.metaText}>
            📅 {formattedDate} at {formattedTime}
          </Text>
          {item.durationMinutes && (
            <Text style={styles.metaText}>
              ⏱️ Duration: {item.durationMinutes} minutes
            </Text>
          )}
        </View>
        {canJoin(item) && (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => (navigation as any).navigate('VideoCall', { consultationId: item.id })}
          >
            <Text style={styles.joinButtonText}>
              {item.status === 'in_progress' ? 'Join Call' : 'Start Consultation'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && consultations.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading consultations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Telemedicine</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => (navigation as any).navigate('ScheduleConsultation')}
        >
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

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
          <TouchableOpacity
            style={[styles.filterButton, filter === 'scheduled' && styles.filterButtonActive]}
            onPress={() => setFilter('scheduled')}
          >
            <Text style={[styles.filterText, filter === 'scheduled' && styles.filterTextActive]}>
              Scheduled
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'in_progress' && styles.filterButtonActive]}
            onPress={() => setFilter('in_progress')}
          >
            <Text style={[styles.filterText, filter === 'in_progress' && styles.filterTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {consultations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No consultations found</Text>
          <Text style={styles.emptySubtext}>
            {filter !== 'all' ? `No ${filter} consultations` : 'Schedule your first telemedicine consultation'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={consultations}
          renderItem={renderConsultation}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  newButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newButtonText: {
    color: '#ffffff',
    fontWeight: '600',
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
  consultationCard: {
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
  consultationHeader: {
    marginBottom: 12,
  },
  consultationInfo: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statusIcon: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  consultationType: {
    fontSize: 14,
    color: '#6b7280',
  },
  consultationMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  joinButton: {
    marginTop: 12,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TelemedicineScreen;



