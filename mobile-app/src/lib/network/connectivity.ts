import * as Network from 'expo-network';

export type ConnectivitySnapshot = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOnline: boolean;
  type: Network.NetworkStateType | null;
};

function mapNetworkState(state: Network.NetworkState): ConnectivitySnapshot {
  const isConnected = Boolean(state.isConnected);
  const isInternetReachable = state.isInternetReachable ?? null;
  const isOnline = isConnected && isInternetReachable !== false;

  return {
    isConnected,
    isInternetReachable,
    isOnline,
    type: state.type ?? null
  };
}

export async function getConnectivitySnapshot(): Promise<ConnectivitySnapshot> {
  const state = await Network.getNetworkStateAsync();
  return mapNetworkState(state);
}

export function subscribeConnectivity(listener: (snapshot: ConnectivitySnapshot) => void): () => void {
  let active = true;

  const emit = (snapshot: ConnectivitySnapshot) => {
    if (!active) return;
    listener(snapshot);
  };

  const subscription = Network.addNetworkStateListener((state) => {
    emit(mapNetworkState(state));
  });

  void getConnectivitySnapshot()
    .then(emit)
    .catch(() => {
      emit({
        isConnected: true,
        isInternetReachable: true,
        isOnline: true,
        type: null
      });
    });

  return () => {
    active = false;
    subscription.remove();
  };
}
