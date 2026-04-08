import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  RandomizationConfig,
  RandomizationResult
} from '../core/models/randomization.model';
import { generateRandomizationSchema } from './core/randomization-algorithm';

@Injectable({
  providedIn: 'root'
})
export class RandomizationService {
  generateSchema(config: RandomizationConfig): Observable<RandomizationResult> {
    try {
      return of(generateRandomizationSchema(config));
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Internal error during randomization';
      return throwError(() => ({ error: { error: msg } }));
    }
  }
}
