import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TreatmentArm {
  id: string;
  name: string;
  ratio: number;
}

export interface StratificationFactor {
  id: string;
  name: string;
  levels: string[];
}

export interface RandomizationConfig {
  protocolId: string;
  studyName: string;
  phase: string;
  arms: TreatmentArm[];
  sites: string[];
  strata: StratificationFactor[];
  blockSizes: number[];
  subjectsPerSite: number;
  seed: string;
  subjectIdMask: string;
}

export interface GeneratedSchema {
  subjectId: string;
  site: string;
  stratum: Record<string, string>;
  stratumCode: string;
  blockNumber: number;
  blockSize: number;
  treatmentArm: string;
  treatmentArmId: string;
}

export interface RandomizationResult {
  metadata: {
    protocolId: string;
    studyName: string;
    phase: string;
    seed: string;
    generatedAt: string;
    strata: StratificationFactor[];
    config: RandomizationConfig;
  };
  schema: GeneratedSchema[];
}

export interface AuditLogEntry {
  userId: string;
  timestamp: string;
  protocolId: string;
  parameters: RandomizationConfig;
  seed: string;
  randomizationCode: string;
}

@Injectable({
  providedIn: 'root'
})
export class RandomizationService {
  private http = inject(HttpClient);

  generateSchema(config: RandomizationConfig): Observable<RandomizationResult> {
    return this.http.post<RandomizationResult>('/api/randomize', config);
  }

  getAuditLogs(): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogEntry[]>('/api/audit-logs');
  }
}
