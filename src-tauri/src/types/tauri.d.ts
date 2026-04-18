declare module '@tauri-apps/api/tauri' {
  export function invoke<T = any>(cmd: string, args?: any): Promise<T>;
}

declare module '@tauri-apps/api' {
  export * from '@tauri-apps/api/tauri';
}