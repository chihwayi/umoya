declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.less';

declare module 'html5-qrcode' {
  export interface Html5QrcodeScannerConfig {
    fps?: number;
    qrbox?: number | { width: number; height: number };
    aspectRatio?: number;
    disableFlip?: boolean;
    rememberLastUsedCamera?: boolean;
    supportedScanTypes?: number[];
  }
  export type QrcodeSuccessCallback = (decodedText: string, result: any) => void;
  export type QrcodeErrorCallback = (errorMessage: string, error: any) => void;
  export class Html5QrcodeScanner {
    constructor(elementId: string, config: Html5QrcodeScannerConfig, verbose: boolean);
    render(onSuccess: QrcodeSuccessCallback, onError: QrcodeErrorCallback): void;
    clear(): Promise<void>;
    getState(): number;
  }
  export class Html5Qrcode {
    constructor(elementId: string);
    start(
      cameraIdOrConfig: string | { facingMode: string },
      config: Html5QrcodeScannerConfig,
      onSuccess: QrcodeSuccessCallback,
      onError?: QrcodeErrorCallback,
    ): Promise<void>;
    stop(): Promise<void>;
    clear(): Promise<void>;
  }
}

