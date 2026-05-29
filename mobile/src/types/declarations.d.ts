// Type stubs for native/optional packages not installed in CI
// Replace with actual @types/* packages once the native build environment is set up

declare module 'react-native-qrcode-svg' {
  import { ViewStyle } from 'react-native';
  interface QRCodeProps {
    value: string;
    size?: number;
    backgroundColor?: string;
    color?: string;
    style?: ViewStyle;
  }
  const QRCode: React.FC<QRCodeProps>;
  export default QRCode;
}

declare module 'expo-av' {
  namespace Audio {
    interface PermissionResponse { granted: boolean; status: string; }
    const RecordingOptionsPresets: { HIGH_QUALITY: unknown };
    function requestPermissionsAsync(): Promise<PermissionResponse>;
    function setAudioModeAsync(mode: Record<string, unknown>): Promise<void>;
    class Recording {
      static createAsync(options: unknown): Promise<{ recording: Recording }>;
      stopAndUnloadAsync(): Promise<void>;
      getURI(): string | null;
    }
  }
  export { Audio };
}

declare module 'socket.io-client' {
  export interface Socket {
    on(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
    disconnect(): void;
    connect(): void;
    id: string;
  }
  export interface ManagerOptions {
    auth?: Record<string, any>;
    transports?: string[];
    reconnection?: boolean;
    timeout?: number;
  }
  export function io(uri: string, opts?: Partial<ManagerOptions>): Socket;
}
