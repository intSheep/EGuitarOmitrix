export {};
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    eguitarPauseForBackground?: () => Promise<void>;
    eguitarPrepareForUpdate?: () => Promise<boolean>;
    eguitarPrepareForClose?: () => Promise<void>;
    eguitarClientBack?: () => boolean;
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
        AppUpdate: { check: () => Promise<unknown> };
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
