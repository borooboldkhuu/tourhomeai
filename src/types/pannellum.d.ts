export interface PannellumViewer {
  loadScene(sceneId: string, pitch?: number, yaw?: number, hfov?: number): void;
  getScene(): string;
  destroy(): void;
  toggleFullscreen(): void;
  resize?(): void;
  setYaw(yaw: number): void;
  setPitch(pitch: number): void;
  getYaw(): number;
  getPitch(): number;
  setHfov(hfov: number): void;
  getHfov(): number;
  startAutoRotate(speed?: number): void;
  stopAutoRotate(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

export interface PannellumHotSpot {
  pitch: number;
  yaw: number;
  type: "scene" | "info";
  text?: string;
  sceneId?: string;
  cssClass?: string;
}

export interface PannellumScene {
  type: "equirectangular";
  panorama: string;
  title?: string;
  hfov?: number;
  minHfov?: number;
  maxHfov?: number;
  pitch?: number;
  yaw?: number;
  autoLoad?: boolean;
  hotSpots?: PannellumHotSpot[];
}

export interface PannellumConfig {
  default: {
    firstScene: string;
    sceneFadeDuration?: number;
    autoLoad?: boolean;
    showControls?: boolean;
    autoRotate?: number;
    compass?: boolean;
    minHfov?: number;
    maxHfov?: number;
    mouseZoom?: boolean;
    keyboardZoom?: boolean;
    draggable?: boolean;
  };
  scenes: Record<string, PannellumScene>;
}

declare global {
  interface Window {
    pannellum?: {
      viewer(container: string | HTMLElement, config: PannellumConfig): PannellumViewer;
    };
  }
}

export {};
