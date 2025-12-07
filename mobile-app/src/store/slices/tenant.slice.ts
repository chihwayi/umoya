import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TenantState {
  currentTenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  availableTenants: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  loading: boolean;
  error: string | null;
}

const initialState: TenantState = {
  currentTenant: null,
  availableTenants: [],
  loading: false,
  error: null,
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setCurrentTenant: (state, action: PayloadAction<TenantState['currentTenant']>) => {
      state.currentTenant = action.payload;
    },
    setAvailableTenants: (state, action: PayloadAction<TenantState['availableTenants']>) => {
      state.availableTenants = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setCurrentTenant, setAvailableTenants, setLoading, setError } = tenantSlice.actions;
export default tenantSlice.reducer;
