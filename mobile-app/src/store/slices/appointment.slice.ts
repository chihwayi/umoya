import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppointmentState {
  appointments: any[];
  currentAppointment: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: AppointmentState = {
  appointments: [],
  currentAppointment: null,
  loading: false,
  error: null,
};

const appointmentSlice = createSlice({
  name: 'appointment',
  initialState,
  reducers: {
    setAppointments: (state, action: PayloadAction<any[]>) => {
      state.appointments = action.payload;
    },
    setCurrentAppointment: (state, action: PayloadAction<any | null>) => {
      state.currentAppointment = action.payload;
    },
    addAppointment: (state, action: PayloadAction<any>) => {
      state.appointments.push(action.payload);
    },
    updateAppointment: (state, action: PayloadAction<any>) => {
      const index = state.appointments.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.appointments[index] = action.payload;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setAppointments, setCurrentAppointment, addAppointment, updateAppointment, setLoading, setError } = appointmentSlice.actions;
export default appointmentSlice.reducer;
