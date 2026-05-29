export interface IdentityProfile {
  timestamp?: string;
  // Other potential deterministic overrides could go here
}

export class DeterminismProvider {
  private static _virtualDate: Date | null = null;
  private static _profiles = new Map<string, IdentityProfile>([
    ['DET-100', { timestamp: '2026-05-28T12:00:00.000Z' }]
  ]);

  /**
   * Set a fixed virtual time for all future calls to getNow()
   */
  static setVirtualTime(date: Date | null): void {
    this._virtualDate = date;
  }

  /**
   * Register a deterministic profile for a specific protocol ID
   */
  static registerProfile(protocolId: string, profile: IdentityProfile): void {
    this._profiles.set(protocolId, profile);
  }

  /**
   * Clear all registered profiles and virtual time overrides
   */
  static clear(): void {
    this._virtualDate = null;
    this._profiles.clear();
  }

  /**
   * Get the current time, applying deterministic overrides if available
   */
  static getNow(protocolId?: string): Date {
    if (protocolId && this._profiles.has(protocolId)) {
      const profile = this._profiles.get(protocolId)!;
      if (profile.timestamp) {
        return new Date(profile.timestamp);
      }
    }
    
    if (this._virtualDate) {
      return this._virtualDate;
    }
    
    return new Date();
  }
}
