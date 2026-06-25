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

declare module 'lucide-react-native' {
  import { FC } from 'react';
  import { SvgProps } from 'react-native-svg';
  interface IconProps extends SvgProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
  }
  type Icon = FC<IconProps>;
  export const Activity: Icon;
  export const AlertTriangle: Icon;
  export const AlertCircle: Icon;
  export const Baby: Icon;
  export const Bell: Icon;
  export const Brain: Icon;
  export const CheckCircle: Icon;
  export const ChevronDown: Icon;
  export const ChevronRight: Icon;
  export const Clock: Icon;
  export const Droplet: Icon;
  export const Ear: Icon;
  export const FileText: Icon;
  export const FlaskConical: Icon;
  export const Heart: Icon;
  export const HeartPulse: Icon;
  export const Info: Icon;
  export const Microscope: Icon;
  export const Package: Icon;
  export const Plus: Icon;
  export const RefreshCw: Icon;
  export const Search: Icon;
  export const Shield: Icon;
  export const Stethoscope: Icon;
  export const Thermometer: Icon;
  export const TrendingDown: Icon;
  export const TrendingUp: Icon;
  export const Truck: Icon;
  export const User: Icon;
  export const Users: Icon;
  export const XCircle: Icon;
  export const Zap: Icon;
  export const Sparkles: Icon;
  export const Calendar: Icon;
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
