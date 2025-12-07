import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PatientState {
  currentPatient: any | null;
  patients: any[];
  loading: boolean;
  error: string | null;
}

const initialState: PatientState = {
  currentPatient: null,
  patients: [],
  loading: false,
  error: null,
};

const patientSlice = createSlice({
  name: 'patient',
  initialState,
  reducers: {
    setCurrentPatient: (state, action: PayloadAction<any>) => {
      state.currentPatient = action.payload;
    },
    setPatients: (state, action: PayloadAction<any[]>) => {
      state.patients = action.payload;
    },
    addPatient: (state, action: PayloadAction<any>) => {
      state.patients.push(action.payload);
    },
    updatePatient: (state, action: PayloadAction<any>) => {
      const index = state.patients.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.patients[index] = action.payload;
      }
      if (state.currentPatient?.id === action.payload.id) {
        state.currentPatient = action.payload;
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

export const { setCurrentPatient, setPatients, addPatient, updatePatient, setLoading, setError } = patientSlice.actions;
export default patientSlice.reducer;
