import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { AboutComponent } from './features/about/about.component';
import { GeneratorComponent } from './domain/study-builder/components/generator.component';
import { SchemaVerificationComponent } from './domain/schema-management/components/schema-verification.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'about', component: AboutComponent },
  { path: 'generator', component: GeneratorComponent },
  { path: 'verify', component: SchemaVerificationComponent },
  { path: '**', redirectTo: '' }
];
