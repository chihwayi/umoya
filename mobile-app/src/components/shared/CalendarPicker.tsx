import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import GlassCard from './GlassCard';
import Icon from './Icon';

interface CalendarPickerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  minimumDate?: Date;
  onClose: () => void;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  selectedDate,
  onDateSelect,
  minimumDate = new Date(),
  onClose,
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const isDateDisabled = (date: Date) => {
    return date < minimumDate;
  };

  const isDateSelected = (date: Date) => {
    return isSameDay(date, selectedDate);
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.calendarWrapper} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <GlassCard style={styles.calendarContainer} padding={spacing.lg}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handlePreviousMonth}
            activeOpacity={0.7}
          >
            <Icon name="arrowLeft" size={24} />
          </TouchableOpacity>
          
          <View style={styles.monthYearContainer}>
            <Text style={styles.monthYearText}>
              {format(currentMonth, 'MMMM yyyy')}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.navButton}
            onPress={handleNextMonth}
            activeOpacity={0.7}
          >
            <Icon name="arrowRight" size={24} />
          </TouchableOpacity>
        </View>

        {/* Week Days */}
        <View style={styles.weekDaysContainer}>
          {weekDays.map((day) => (
            <View key={day} style={styles.weekDayHeader}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            const isCurrentMonthDay = isSameMonth(day, currentMonth);
            const isDisabled = isDateDisabled(day);
            const isSelected = isDateSelected(day);
            const isCurrentDay = isToday(day);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  !isCurrentMonthDay && styles.dayCellOtherMonth,
                  isSelected && styles.dayCellSelected,
                  isCurrentDay && !isSelected && styles.dayCellToday,
                  isDisabled && styles.dayCellDisabled,
                ]}
                onPress={() => {
                  if (!isDisabled) {
                    onDateSelect(day);
                  }
                }}
                disabled={isDisabled}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayText,
                    !isCurrentMonthDay && styles.dayTextOtherMonth,
                    isSelected && styles.dayTextSelected,
                    isCurrentDay && !isSelected && styles.dayTextToday,
                    isDisabled && styles.dayTextDisabled,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.todayButton}
            onPress={() => {
              const today = new Date();
              if (!isDateDisabled(today)) {
                onDateSelect(today);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
            </GlassCard>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  calendarWrapper: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    zIndex: 10000,
    elevation: 10000,
  },
  calendarContainer: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthYearText: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  weekDaysContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  weekDayText: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    margin: 2,
  },
  dayCellOtherMonth: {
    opacity: 0.3,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellToday: {
    backgroundColor: colors.primary + '30',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayCellDisabled: {
    opacity: 0.2,
  },
  dayText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  dayTextOtherMonth: {
    color: colors.textTertiary,
  },
  dayTextSelected: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  todayButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  todayButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  doneButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  doneButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});

export default CalendarPicker;

