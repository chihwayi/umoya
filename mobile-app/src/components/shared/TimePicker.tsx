import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import GlassCard from './GlassCard';
import Icon from './Icon';

interface TimePickerProps {
  selectedTime: { hours: number; minutes: number };
  onTimeSelect: (hours: number, minutes: number) => void;
  onClose: () => void;
}

const TimePicker: React.FC<TimePickerProps> = ({
  selectedTime,
  onTimeSelect,
  onClose,
}) => {
  const [hours, setHours] = useState(selectedTime.hours);
  const [minutes, setMinutes] = useState(selectedTime.minutes);
  const [isAM, setIsAM] = useState(selectedTime.hours < 12);

  const handleConfirm = () => {
    let finalHours = hours;
    if (!isAM && hours !== 12) {
      finalHours = hours + 12;
    } else if (isAM && hours === 12) {
      finalHours = 0;
    }
    onTimeSelect(finalHours, minutes);
    onClose();
  };

  const renderNumberPicker = (
    values: number[],
    selected: number,
    onSelect: (value: number) => void,
    label: string
  ) => {
    const selectedIndex = values.indexOf(selected);

    return (
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>{label}</Text>
        <View style={styles.pickerWrapper}>
          <ScrollView
            style={styles.pickerScroll}
            contentContainerStyle={styles.pickerContent}
            showsVerticalScrollIndicator={false}
            snapToInterval={50}
            decelerationRate="fast"
          >
            {values.map((value, index) => {
              const isSelected = index === selectedIndex;
              const distance = Math.abs(index - selectedIndex);
              const opacity = Math.max(0.3, 1 - distance * 0.2);
              const scale = Math.max(0.8, 1 - distance * 0.1);

              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.pickerItem,
                    isSelected && styles.pickerItemSelected,
                    { opacity, transform: [{ scale }] },
                  ]}
                  onPress={() => onSelect(value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      isSelected && styles.pickerItemTextSelected,
                    ]}
                  >
                    {String(value).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  const hourValues = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteValues = Array.from({ length: 60 }, (_, i) => i);

  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

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
        <View style={styles.timeWrapper} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <GlassCard style={styles.timeContainer} padding={spacing.lg}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Time</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Icon name="close" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.pickersRow}>
          {renderNumberPicker(
            hourValues,
            displayHours,
            (value) => setHours(value),
            'Hour'
          )}

          <View style={styles.separator}>
            <Text style={styles.separatorText}>:</Text>
          </View>

          {renderNumberPicker(
            minuteValues,
            minutes,
            (value) => setMinutes(value),
            'Minute'
          )}

          <View style={styles.ampmContainer}>
            <TouchableOpacity
              style={[
                styles.ampmButton,
                isAM && styles.ampmButtonActive,
              ]}
              onPress={() => setIsAM(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.ampmText,
                  isAM && styles.ampmTextActive,
                ]}
              >
                AM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.ampmButton,
                !isAM && styles.ampmButtonActive,
              ]}
              onPress={() => setIsAM(false)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.ampmText,
                  !isAM && styles.ampmTextActive,
                ]}
              >
                PM
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.selectedTimeDisplay}>
          <Text style={styles.selectedTimeText}>
            {String(displayHours).padStart(2, '0')}:
            {String(minutes).padStart(2, '0')} {isAM ? 'AM' : 'PM'}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmButtonText}>Confirm</Text>
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
  timeWrapper: {
    width: '90%',
    maxWidth: 400,
    zIndex: 10000,
    elevation: 10000,
  },
  timeContainer: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  pickerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  pickerWrapper: {
    height: 200,
    width: '100%',
  },
  pickerScroll: {
    flex: 1,
  },
  pickerContent: {
    paddingVertical: 75,
  },
  pickerItem: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.md,
  },
  pickerItemText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  pickerItemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  separator: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
  },
  separatorText: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  ampmContainer: {
    flexDirection: 'column',
    gap: spacing.xs,
    marginLeft: spacing.md,
  },
  ampmButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minWidth: 60,
    alignItems: 'center',
  },
  ampmButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ampmText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  ampmTextActive: {
    color: colors.textOnPrimary,
  },
  selectedTimeDisplay: {
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
  },
  selectedTimeText: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});

export default TimePicker;

