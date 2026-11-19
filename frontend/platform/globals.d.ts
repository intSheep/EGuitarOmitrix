export {};
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    eguitarPauseForBackground?: () => Promise<void>;
    eguitarPrepareForUpdate?: () => Promise<boolean>;
    eguitarPrepareForClose?: () => Promise<void>;
    eguitarClientBack?: () => boolean;
    eguitarMinPracticeMs?: number;
    eguitarDesktop?: {
      checkUpdates: () => Promise<void>;
      openGuitarPro?: (bytes: Uint8Array) => Promise<void>;
      openCourse?: (url: string) => Promise<void>;
      platform?: string;
      updatesSupported?: boolean;
    };
    Capacitor?: {
      getPlatform: () => string;
      Plugins: {
        AppUpdate: { check: (options: { automatic: boolean }) => Promise<unknown> };
        ExportFile: {
          save: (args: {
            name: string;
            mime: string;
            data: string;
          }) => Promise<unknown>;
        };
      };
    };
  }
}
