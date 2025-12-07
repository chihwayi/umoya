import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from '@reduxjs/toolkit';

import authReducer from './slices/auth.slice';
import tenantReducer from './slices/tenant.slice';
import patientReducer from './slices/patient.slice';
import appointmentReducer from './slices/appointment.slice';
import prescriptionReducer from './slices/prescription.slice';

const rootReducer = combineReducers({
  auth: authReducer,
  tenant: tenantReducer,
  patient: patientReducer,
  appointment: appointmentReducer,
  prescription: prescriptionReducer,
});

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
