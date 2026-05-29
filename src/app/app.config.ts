import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  importProvidersFrom
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withFetch} from '@angular/common/http';
import {provideServiceWorker} from '@angular/service-worker';
import { DialogModule } from '@angular/cdk/dialog';

import {routes} from './app.routes';
import { CODE_GENERATION_STRATEGIES } from './domain/schema-management/services/code-generator.service';
import { RStrategy } from './domain/schema-management/services/generation/r.strategy';
import { PythonStrategy } from './domain/schema-management/services/generation/python.strategy';
import { SasStrategy } from './domain/schema-management/services/generation/sas.strategy';
import { StataStrategy } from './domain/schema-management/services/generation/stata.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    importProvidersFrom(DialogModule),
    { provide: CODE_GENERATION_STRATEGIES, useClass: RStrategy, multi: true },
    { provide: CODE_GENERATION_STRATEGIES, useClass: PythonStrategy, multi: true },
    { provide: CODE_GENERATION_STRATEGIES, useClass: SasStrategy, multi: true },
    { provide: CODE_GENERATION_STRATEGIES, useClass: StataStrategy, multi: true },
  ],
};
