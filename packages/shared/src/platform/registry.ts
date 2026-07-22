import type { PlatformAdapter } from './types';

export class AdapterRegistry {
  private adapters = new Map<string, PlatformAdapter>();

  register(platform: string, adapter: PlatformAdapter): void {
    this.adapters.set(platform, adapter);
  }

  get(platform: string): PlatformAdapter | null {
    return this.adapters.get(platform) ?? null;
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }
}
