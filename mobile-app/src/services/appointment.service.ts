import { ehrApi, API_ENDPOINTS } from '../config/api';
import { format } from 'date-fns';

export interface Appointment {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  doctor?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  appointmentDate: string;
  durationMinutes: number;
  appointmentType: string;
  status: 'scheduled' | 'checked_in' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  reason?: string;
  notes?: string;
  checkInTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  paymentStatus?: string;
  feeAmount?: number;
  recurringPattern?: string; // e.g., 'daily', 'weekly', 'monthly'
  parentAppointmentId?: string; // For recurring appointments
  isRecurring?: boolean; // Computed field
}

const appointmentService = {
  /**
   * Get today's appointments for the current doctor
   * @returns Array of today's appointments
   */
  getTodayAppointments: async (): Promise<Appointment[]> => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await ehrApi.get(
        `${API_ENDPOINTS.APPOINTMENT.LIST}?date=${today}`
      );
      
      const appointments = Array.isArray(response) 
        ? response 
        : (response.data?.appointments || response.appointments || []);
      
      // Sort by appointment time
      return appointments.sort((a: Appointment, b: Appointment) => {
        const timeA = new Date(a.appointmentDate).getTime();
        const timeB = new Date(b.appointmentDate).getTime();
        return timeA - timeB;
      });
    } catch (error: any) {
      console.error('Error getting today appointments:', error);
      return [];
    }
  },

  /**
   * Get appointments for a specific date
   * @param date - Date string in YYYY-MM-DD format
   * @returns Array of appointments
   */
  getAppointmentsByDate: async (date: string): Promise<Appointment[]> => {
    try {
      const response = await ehrApi.get(
        `${API_ENDPOINTS.APPOINTMENT.LIST}?date=${date}`
      );
      
      const appointments = Array.isArray(response) 
        ? response 
        : (response.data?.appointments || response.appointments || []);
      
      return appointments.sort((a: Appointment, b: Appointment) => {
        const timeA = new Date(a.appointmentDate).getTime();
        const timeB = new Date(b.appointmentDate).getTime();
        return timeA - timeB;
      });
    } catch (error: any) {
      console.error('Error getting appointments by date:', error);
      return [];
    }
  },

  /**
   * Get appointment by ID
   * @param appointmentId - Appointment ID
   * @returns Appointment details
   */
  getAppointmentById: async (appointmentId: string): Promise<Appointment> => {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.APPOINTMENT.BY_ID(appointmentId));
      return response.data || response;
    } catch (error: any) {
      console.error('Error getting appointment:', error);
      throw error;
    }
  },

  /**
   * Update appointment status
   * @param appointmentId - Appointment ID
   * @param status - New status
   * @returns Updated appointment
   */
  updateAppointmentStatus: async (appointmentId: string, status: Appointment['status']): Promise<Appointment> => {
    try {
      const response = await ehrApi.patch(
        API_ENDPOINTS.APPOINTMENT.BY_ID(appointmentId),
        { status }
      );
      return response.data || response;
    } catch (error: any) {
      console.error('Error updating appointment status:', error);
      throw error;
    }
  },

  /**
   * Check in a patient
   * @param appointmentId - Appointment ID
   * @returns Updated appointment
   */
  checkInPatient: async (appointmentId: string): Promise<Appointment> => {
    try {
      const response = await ehrApi.put(
        API_ENDPOINTS.APPOINTMENT.CHECK_IN(appointmentId)
      );
      return response.data || response;
    } catch (error: any) {
      console.error('Error checking in patient:', error);
      // Re-throw with more context for better error handling upstream
      if (error.response?.status === 500) {
        const errorMessage = error.response?.data?.message || 'Server error occurred during check-in';
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      throw error;
    }
  },

  /**
   * Start appointment
   * @param appointmentId - Appointment ID
   * @returns Updated appointment
   */
  startAppointment: async (appointmentId: string): Promise<Appointment> => {
    return appointmentService.updateAppointmentStatus(appointmentId, 'in_progress');
  },

  /**
   * Complete appointment
   * @param appointmentId - Appointment ID
   * @returns Updated appointment
   */
  completeAppointment: async (appointmentId: string): Promise<Appointment> => {
    return appointmentService.updateAppointmentStatus(appointmentId, 'completed');
  },

  /**
   * Create new appointment
   * @param appointmentData - Appointment data
   * @returns Created appointment
   */
  createAppointment: async (appointmentData: {
    patientId: string;
    doctorId: string;
    appointmentDate: string;
    durationMinutes?: number;
    appointmentType?: string;
    reason?: string;
    notes?: string;
    feeAmount?: number;
    recurringPattern?: string;
    parentAppointmentId?: string;
  }): Promise<Appointment> => {
    try {
      const response = await ehrApi.post(API_ENDPOINTS.APPOINTMENT.CREATE, appointmentData);
      return response.data || response;
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  },

  /**
   * Update appointment (for rescheduling)
   * @param appointmentId - Appointment ID
   * @param updateData - Update data
   * @returns Updated appointment
   */
  updateAppointment: async (appointmentId: string, updateData: {
    appointmentDate?: string;
    durationMinutes?: number;
    status?: Appointment['status'];
    reason?: string;
    notes?: string;
  }): Promise<Appointment> => {
    try {
      const response = await ehrApi.patch(API_ENDPOINTS.APPOINTMENT.BY_ID(appointmentId), updateData);
      return response.data || response;
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  },

  /**
   * Reschedule appointment (update date/time)
   * @param appointmentId - Appointment ID
   * @param newDate - New appointment date
   * @returns Updated appointment
   */
  rescheduleAppointment: async (appointmentId: string, newDate: string): Promise<Appointment> => {
    return appointmentService.updateAppointment(appointmentId, { appointmentDate: newDate });
  },
};

// Export for use in components
export const { getTodayAppointments, getAppointmentsByDate, getAppointmentById, updateAppointmentStatus, checkInPatient, startAppointment, completeAppointment } = appointmentService;

export default appointmentService;

