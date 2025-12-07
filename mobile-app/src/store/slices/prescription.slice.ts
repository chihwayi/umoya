import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PrescriptionState {
  prescriptions: any[];
  currentPrescription: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: PrescriptionState = {
  prescriptions: [],
  currentPrescription: null,
  loading: false,
  error: null,
};

const prescriptionSlice = createSlice({
  name: 'prescription',
  initialState,
  reducers: {
    setPrescriptions: (state, action: PayloadAction<any[]>) => {
      state.prescriptions = action.payload;
    },
    setCurrentPrescription: (state, action: PayloadAction<any | null>) => {
      state.currentPrescription = action.payload;
    },
    addPrescription: (state, action: PayloadAction<any>) => {
      state.prescriptions.push(action.payload);
    },
    updatePrescription: (state, action: PayloadAction<any>) => {
      const index = state.prescriptions.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.prescriptions[index] = action.payload;
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

export const { setPrescriptions, setCurrentPrescription, addPrescription, updatePrescription, setLoading, setError } = prescriptionSlice.actions;
export default prescriptionSlice.reducer;
