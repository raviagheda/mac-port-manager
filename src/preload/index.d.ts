import type { PortPilotBridge } from '@shared/types';

declare global {
  interface Window {
    portpilot: PortPilotBridge;
  }
}

export {};
