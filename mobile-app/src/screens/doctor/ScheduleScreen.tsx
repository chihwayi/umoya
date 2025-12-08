import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Alert,
  PanResponder,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isSameMonth, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, isToday, isPast, isFuture, addMinutes } from 'date-fns';
import RNCalendarEvents from 'react-native-calendar-events';
import appointmentService, { Appointment } from '../../services/appointment.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const { width } = Dimensions.get('window');

type ViewMode = 'day' | 'week' | 'month';

const ScheduleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [draggingAppointment, setDraggingAppointment] = useState<Appointment | null>(null);
  const [draggingPosition, setDraggingPosition] = useState({ x: 0, y: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [currentDate, viewMode])
  );

  useEffect(() => {
    filterAppointments();
  }, [searchQuery, statusFilter, appointments]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      let dateRange: string[] = [];

      if (viewMode === 'day') {
        dateRange = [format(currentDate, 'yyyy-MM-dd')];
      } else if (viewMode === 'week') {
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        dateRange = days.map((day) => format(day, 'yyyy-MM-dd'));
      } else {
        // Month view - load for current month
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        dateRange = days.map((day) => format(day, 'yyyy-MM-dd'));
      }

      // Load appointments for all dates in range
      const allAppointments: Appointment[] = [];
      for (const date of dateRange) {
        const dayAppointments = await appointmentService.getAppointmentsByDate(date);
        allAppointments.push(...dayAppointments);
      }

      // Remove duplicates
      const uniqueAppointments = Array.from(
        new Map(allAppointments.map((apt) => [apt.id, apt])).values()
      );

      setAppointments(uniqueAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...appointments];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (apt) =>
          apt.patient.firstName.toLowerCase().includes(query) ||
          apt.patient.lastName.toLowerCase().includes(query) ||
          apt.patient.patientNumber?.toLowerCase().includes(query) ||
          apt.appointmentType.toLowerCase().includes(query) ||
          apt.reason?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((apt) => apt.status === statusFilter);
    }

    setFilteredAppointments(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getAppointmentsForDate = (date: Date): Appointment[] => {
    return filteredAppointments.filter((apt) => isSameDay(parseISO(apt.appointmentDate), date));
  };

  const getStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'checked_in':
        return colors.info;
      case 'in_progress':
        return colors.primary;
      case 'completed':
        return colors.success;
      case 'cancelled':
      case 'no_show':
        return colors.error;
      default:
        return colors.textTertiary;
    }
  };

  const getStatusText = (status: Appointment['status']) => {
    switch (status) {
      case 'checked_in':
        return 'Checked In';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'no_show':
        return 'No Show';
      default:
        return 'Scheduled';
    }
  };

  const handleAppointmentPress = (appointment: Appointment) => {
    if (appointment?.patient?.id) {
      (navigation as any).navigate('PatientDetail', { patientId: appointment.patient.id });
    } else {
      Alert.alert('Error', 'Patient information not available');
    }
  };

  const handleCreateAppointment = (date?: Date, time?: string) => {
    const selectedDate = date || currentDate;
    (navigation as any).navigate('CreateAppointment', {
      selectedDate,
      selectedTime: time,
    });
  };

  const handleLongPress = (date: Date, hour?: number) => {
    if (hour !== undefined) {
      const selectedDateTime = new Date(date);
      selectedDateTime.setHours(hour, 0, 0, 0);
      setSelectedTimeSlot(selectedDateTime);
      setShowCreateModal(true);
    } else {
      setSelectedTimeSlot(date);
      setShowCreateModal(true);
    }
  };

  const handleDragStart = (appointment: Appointment) => {
    setDraggingAppointment(appointment);
  };

  const handleDragEnd = async (newDate: Date) => {
    if (!draggingAppointment) return;

    try {
      await appointmentService.rescheduleAppointment(
        draggingAppointment.id,
        newDate.toISOString()
      );
      Alert.alert('Success', 'Appointment rescheduled successfully');
      loadAppointments();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reschedule appointment');
    } finally {
      setDraggingAppointment(null);
    }
  };

  const syncWithCalendar = async () => {
    try {
      const status = await RNCalendarEvents.requestPermissions();
      if (status === 'authorized') {
        // Sync appointments to device calendar
        for (const appointment of appointments) {
          const startDate = parseISO(appointment.appointmentDate);
          const endDate = addMinutes(startDate, appointment.durationMinutes);

          await RNCalendarEvents.saveEvent('Appointment: ' + appointment.patient.firstName + ' ' + appointment.patient.lastName, {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            notes: appointment.reason || appointment.notes,
            location: 'Clinic',
          });
        }
        Alert.alert('Success', 'Appointments synced to calendar');
        setCalendarSyncEnabled(true);
      } else {
        Alert.alert('Permission Required', 'Please grant calendar access to sync appointments');
      }
    } catch (error: any) {
      console.error('Calendar sync error:', error);
      Alert.alert('Error', 'Failed to sync with calendar');
    }
  };

  const isRecurring = (appointment: Appointment) => {
    return !!(appointment.recurringPattern || appointment.parentAppointmentId);
  };

  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <View style={styles.dayViewContainer}>
        <View style={styles.timeSlots}>
          {hours.map((hour) => {
            const hourAppointments = dayAppointments.filter((apt) => {
              const aptHour = parseISO(apt.appointmentDate).getHours();
              return aptHour === hour;
            });

            return (
              <View key={hour} style={styles.timeSlot}>
                <View style={styles.timeLabel}>
                  <Text style={styles.timeText}>
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </Text>
                </View>
                <View style={styles.appointmentsColumn}>
                  {hourAppointments.map((appointment) => (
                    <TouchableOpacity
                      key={appointment.id}
                      style={[styles.appointmentBlock, { backgroundColor: getStatusColor(appointment.status) + '30', borderLeftColor: getStatusColor(appointment.status), borderLeftWidth: 4 }]}
                      onPress={() => handleAppointmentPress(appointment)}
                      onLongPress={() => handleDragStart(appointment)}
                      activeOpacity={0.8}
                    >
                      {isRecurring(appointment) && (
                        <View style={styles.recurringIndicator}>
                          <Text style={styles.recurringIcon}>🔄</Text>
                        </View>
                      )}
                      <Text style={styles.appointmentTime}>
                        {format(parseISO(appointment.appointmentDate), 'h:mm a')}
                      </Text>
                      <Text style={styles.appointmentPatientName} numberOfLines={1}>
                        {appointment.patient.firstName} {appointment.patient.lastName}
                      </Text>
                      <Text style={styles.appointmentType} numberOfLines={1}>
                        {appointment.appointmentType}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(appointment.status)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {hourAppointments.length === 0 && (
                    <TouchableOpacity
                      style={styles.emptySlot}
                      onLongPress={() => handleLongPress(currentDate, hour)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emptySlotText}>Tap to add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate) });

    return (
      <View style={styles.weekViewContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScrollView}>
          <View style={styles.weekGrid}>
          {weekDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDate(day);
            const isCurrentDay = isToday(day);

            return (
              <View key={index} style={[styles.weekDayColumn, isCurrentDay && styles.currentDayColumn]}>
                <GlassCard style={[styles.weekDayHeader, isCurrentDay && styles.currentDayHeader]}>
                  <Text style={[styles.weekDayName, isCurrentDay && styles.currentDayText]}>
                    {format(day, 'EEE')}
                  </Text>
                  <Text style={[styles.weekDayNumber, isCurrentDay && styles.currentDayText]}>
                    {format(day, 'd')}
                  </Text>
                </GlassCard>
                <ScrollView 
                  style={styles.weekDayAppointments} 
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {dayAppointments.length === 0 ? (
                    <View style={styles.emptyDay}>
                      <Text style={styles.emptyDayText}>No appointments</Text>
                    </View>
                  ) : (
                    dayAppointments.map((appointment) => (
                      <TouchableOpacity
                        key={appointment.id}
                        style={[styles.weekAppointmentCard, { borderLeftColor: getStatusColor(appointment.status) }]}
                        onPress={() => handleAppointmentPress(appointment)}
                        onLongPress={() => handleDragStart(appointment)}
                        activeOpacity={0.8}
                      >
                        {isRecurring(appointment) && (
                          <View style={styles.recurringIndicatorSmall}>
                            <Text style={styles.recurringIconSmall}>🔄</Text>
                          </View>
                        )}
                        <Text style={styles.weekAppointmentTime}>
                          {format(parseISO(appointment.appointmentDate), 'h:mm a')}
                        </Text>
                        <Text style={styles.weekAppointmentName} numberOfLines={1}>
                          {appointment.patient.firstName} {appointment.patient.lastName}
                        </Text>
                        <Text style={styles.weekAppointmentType} numberOfLines={1}>
                          {appointment.appointmentType}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            );
          })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <View style={styles.monthViewContainer}>
        <View style={styles.monthHeader}>
          {weekDays.map((day) => (
            <View key={day} style={styles.monthDayHeader}>
              <Text style={styles.monthDayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {calendarDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthDayCell,
                  !isCurrentMonth && styles.monthDayCellOther,
                  isCurrentDay && styles.monthDayCellToday,
                ]}
                onPress={() => {
                  setCurrentDate(day);
                  setViewMode('day');
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.monthDayNumber,
                    !isCurrentMonth && styles.monthDayNumberOther,
                    isCurrentDay && styles.monthDayNumberToday,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                {dayAppointments.length > 0 && (
                  <View style={styles.monthAppointmentDots}>
                    {dayAppointments.slice(0, 3).map((apt, idx) => (
                      <View
                        key={idx}
                        style={[styles.monthAppointmentDot, { backgroundColor: getStatusColor(apt.status) }]}
                      />
                    ))}
                    {dayAppointments.length > 3 && (
                      <Text style={styles.monthAppointmentCount}>+{dayAppointments.length - 3}</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const getDateRangeText = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  if (loading && appointments.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Schedule" subtitle="View your appointments" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Schedule"
        subtitle={getDateRangeText()}
        rightAction={
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => handleCreateAppointment()}
            activeOpacity={0.7}
          >
            <Text style={styles.createButtonText}>+ New</Text>
          </TouchableOpacity>
        }
      />

      {/* View Mode Selector */}
      <View style={styles.viewModeSelector}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('day')}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>Day</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('week')}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('month')}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>Month</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Controls */}
      <View style={styles.navigationControls}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateDate('prev')} activeOpacity={0.7}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.todayButton} onPress={goToToday} activeOpacity={0.7}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateDate('next')} activeOpacity={0.7}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <GlassCard style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search appointments..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </GlassCard>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
          {['all', 'scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.statusFilterButton, statusFilter === status && styles.statusFilterButtonActive]}
              onPress={() => setStatusFilter(status)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.statusFilterText,
                  statusFilter === status && styles.statusFilterTextActive,
                ]}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Calendar Sync Button */}
      <View style={styles.syncContainer}>
        <TouchableOpacity
          style={[styles.syncButton, calendarSyncEnabled && styles.syncButtonActive]}
          onPress={syncWithCalendar}
          activeOpacity={0.7}
        >
          <Text style={styles.syncButtonText}>
            {calendarSyncEnabled ? '✓ Synced' : '📅 Sync Calendar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Schedule Content */}
      <Animated.View style={[styles.scheduleContent, { opacity: fadeAnim }]}>
        {viewMode === 'week' ? (
          // Week view handles its own scrolling (horizontal ScrollView with vertical ScrollViews inside day columns)
          // This is fine because the vertical ScrollViews are nested in a horizontal ScrollView, not another vertical one
          renderWeekView()
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {viewMode === 'day' && renderDayView()}
            {viewMode === 'month' && renderMonthView()}
          </ScrollView>
        )}
      </Animated.View>

      {/* Create Appointment Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Appointment</Text>
            <Text style={styles.modalSubtitle}>
              {selectedTimeSlot ? format(selectedTimeSlot, 'EEEE, MMMM d, yyyy h:mm a') : 'Select a time slot'}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  setShowCreateModal(false);
                  handleCreateAppointment(selectedTimeSlot || undefined);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  viewModeSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  viewModeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: colors.textPrimary,
  },
  navigationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  navButtonText: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  todayButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filtersContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  statusFilters: {
    marginTop: spacing.sm,
  },
  statusFilterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginRight: spacing.sm,
  },
  statusFilterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusFilterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statusFilterTextActive: {
    color: colors.textPrimary,
  },
  scheduleContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  // Day View
  dayViewContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  timeSlots: {
    flex: 1,
  },
  timeSlot: {
    flexDirection: 'row',
    minHeight: 80,
    marginBottom: spacing.sm,
  },
  timeLabel: {
    width: 60,
    paddingTop: spacing.xs,
  },
  timeText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  appointmentsColumn: {
    flex: 1,
    paddingLeft: spacing.md,
  },
  appointmentBlock: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    borderLeftWidth: 4,
  },
  appointmentTime: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  appointmentPatientName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  appointmentType: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  statusText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontSize: 10,
  },
  emptySlot: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderStyle: 'dashed',
  },
  emptySlotText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  recurringIndicator: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.primary + '40',
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurringIcon: {
    fontSize: 12,
  },
  recurringIndicatorSmall: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary + '40',
    borderRadius: borderRadius.full,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurringIconSmall: {
    fontSize: 8,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  createButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  syncContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  syncButton: {
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  syncButtonActive: {
    backgroundColor: colors.success + '20',
    borderColor: colors.success,
  },
  syncButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  modalButtonText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  // Week View
  weekViewContainer: {
    flex: 1,
  },
  weekScrollView: {
    flex: 1,
  },
  weekGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  weekDayColumn: {
    width: width / 7,
    borderRightWidth: 1,
    borderRightColor: colors.glassBorder,
  },
  currentDayColumn: {
    backgroundColor: colors.primary + '10',
  },
  weekDayHeader: {
    padding: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  currentDayHeader: {
    backgroundColor: colors.primary,
  },
  weekDayName: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  weekDayNumber: {
    ...typography.h4,
    fontSize: 20,
    color: colors.textPrimary,
  },
  currentDayText: {
    color: colors.textPrimary,
  },
  weekDayAppointments: {
    flex: 1,
    padding: spacing.xs,
  },
  emptyDay: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyDayText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  weekAppointmentCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.glassCard,
    borderLeftWidth: 3,
  },
  weekAppointmentTime: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginBottom: spacing.xxs,
  },
  weekAppointmentName: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  weekAppointmentType: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontSize: 11,
  },
  // Month View
  monthViewContainer: {
    flex: 1,
    padding: spacing.md,
  },
  monthHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  monthDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  monthDayHeaderText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    width: width / 7 - spacing.md,
    aspectRatio: 1,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.glassCard,
    margin: spacing.xxs,
    justifyContent: 'space-between',
  },
  monthDayCellOther: {
    opacity: 0.4,
  },
  monthDayCellToday: {
    backgroundColor: colors.primary + '30',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  monthDayNumber: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  monthDayNumberOther: {
    color: colors.textTertiary,
  },
  monthDayNumberToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  monthAppointmentDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    alignItems: 'center',
  },
  monthAppointmentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  monthAppointmentCount: {
    ...typography.labelSmall,
    fontSize: 8,
    color: colors.textTertiary,
    marginLeft: 2,
  },
});

export default ScheduleScreen;
