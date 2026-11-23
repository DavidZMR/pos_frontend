/**
 * Puente que expone el preload de Electron en `window.pos` (contextBridge).
 * En el navegador (ng serve) no existe y la app usa valores por defecto: sin báscula
 * (el peso se escribe) y sin impresión.
 */
export interface PosBridgeConfig {
  /** URL base del API, p. ej. http://127.0.0.1:53124/api */
  apiUrl: string;
  appVersion?: string;
}

export type ScaleParity = 'none' | 'even' | 'odd';
export type ScaleMode = 'continuous' | 'request';

/** Báscula de esta PC (se guarda en config.json, en los datos de la app de esa PC). */
export interface ScaleConfig {
  enabled: boolean;
  path: string;
  baudRate: number;
  dataBits: 7 | 8;
  parity: ScaleParity;
  stopBits: 1 | 2;
  mode: ScaleMode;
  /** Comando para pedir el peso en modo `request`; admite escapes: "P", "\\x05", "SI\\r\\n". */
  command: string;
  intervalMs: number;
  match: { serialNumber: string; vendorId: string; productId: string };
}

export interface PrinterConfig {
  name: string;
  widthMm: 58 | 80;
  autoPrint: boolean;
  copies: number;
}

export interface HardwareConfig {
  scale: ScaleConfig;
  printer: PrinterConfig;
}

export type ScaleState = 'disabled' | 'connecting' | 'waiting' | 'connected' | 'error';

export interface ScaleStatus {
  state: ScaleState;
  message: string;
  path: string;
}

/** Peso en gramos enteros (unidad base de kg). */
export interface ScaleReading {
  grams: number;
  stable: boolean;
  at: number;
}

export interface SerialPortOption {
  path: string;
  label: string;
  serialNumber: string;
  vendorId: string;
  productId: string;
}

export type DetectedScale = ScaleConfig & { sampleGrams: number };

/** Resultado de "Buscar báscula": la configuración encontrada (o null) y el mensaje final. */
export interface DetectResult {
  scale: DetectedScale | null;
  message: string;
}

type Unsubscribe = () => void;

export interface PosScaleBridge {
  getState(): Promise<{ status: ScaleStatus; reading: ScaleReading | null }>;
  saveConfig(config: ScaleConfig): Promise<ScaleConfig>;
  listPorts(): Promise<SerialPortOption[]>;
  detect(): Promise<DetectResult>;
  onStatus(callback: (status: ScaleStatus) => void): Unsubscribe;
  onReading(callback: (reading: ScaleReading | null) => void): Unsubscribe;
  onDetectProgress(callback: (message: string) => void): Unsubscribe;
}

/** Impresora instalada en Windows. */
export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export type PrintResult = { ok: true } | { ok: false; error: string };

export interface PosPrinterBridge {
  list(): Promise<PrinterInfo[]>;
  saveConfig(config: PrinterConfig): Promise<PrinterConfig>;
  /** Imprime un documento HTML completo en la impresora configurada en esta PC. */
  print(job: { html: string }): Promise<PrintResult>;
}

export interface PosBridge {
  config?: PosBridgeConfig;
  hardware?: { getConfig(): Promise<HardwareConfig> };
  scale?: PosScaleBridge;
  printer?: PosPrinterBridge;
}

declare global {
  interface Window {
    pos?: PosBridge;
  }
}
