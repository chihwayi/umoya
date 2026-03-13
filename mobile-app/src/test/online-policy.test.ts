import * as Network from 'expo-network';
import {
  ensureOnlineForPolicy,
  getOnlinePolicyMessage,
  isOnlinePolicyError,
  OnlinePolicyError
} from '../lib/network/online-policy';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn()
}));

const mockedGetNetworkStateAsync = Network.getNetworkStateAsync as jest.MockedFunction<typeof Network.getNetworkStateAsync>;

describe('online policy', () => {
  beforeEach(() => {
    mockedGetNetworkStateAsync.mockReset();
  });

  it('does not check network for non-mutation requests', async () => {
    await ensureOnlineForPolicy('GET', '/patient-portal/payments');
    expect(mockedGetNetworkStateAsync).not.toHaveBeenCalled();
  });

  it('does not check network for non-online-only mutations', async () => {
    await ensureOnlineForPolicy('POST', '/patient-portal/vitals/submit');
    expect(mockedGetNetworkStateAsync).not.toHaveBeenCalled();
  });

  it('blocks payment mutation when offline', async () => {
    mockedGetNetworkStateAsync.mockResolvedValue({
      type: 'none' as Network.NetworkStateType,
      isConnected: false,
      isInternetReachable: false
    });

    await expect(ensureOnlineForPolicy('POST', '/patient-portal/payments')).rejects.toBeInstanceOf(OnlinePolicyError);
  });

  it('blocks telemedicine mutation when internet is unreachable', async () => {
    mockedGetNetworkStateAsync.mockResolvedValue({
      type: 'unknown' as Network.NetworkStateType,
      isConnected: true,
      isInternetReachable: false
    });

    await expect(
      ensureOnlineForPolicy('POST', '/telemedicine/consultations/abc-123/join')
    ).rejects.toBeInstanceOf(OnlinePolicyError);
  });

  it('allows online-only mutation when connected', async () => {
    mockedGetNetworkStateAsync.mockResolvedValue({
      type: 'wifi' as Network.NetworkStateType,
      isConnected: true,
      isInternetReachable: true
    });

    await expect(ensureOnlineForPolicy('POST', '/patient-portal/payments')).resolves.toBeUndefined();
    expect(mockedGetNetworkStateAsync).toHaveBeenCalledTimes(1);
  });

  it('maps policy errors to a user-safe message', () => {
    const error = new OnlinePolicyError('/patient-portal/payments');
    expect(isOnlinePolicyError(error)).toBe(true);
    expect(getOnlinePolicyMessage(error)).toContain('online-only');
  });
});
