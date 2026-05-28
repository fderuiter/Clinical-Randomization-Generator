import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { AboutComponent } from './features/about/about.component';
import { GeneratorComponent } from './domain/study-builder/components/generator.component';
import { SchemaVerificationComponent } from './domain/schema-management/components/schema-verification.component';
import { VersionDashboardComponent } from './domain/version-history/components/version-dashboard.component';

export const routes: Routes = [
  { path: '', component: LandingComponent, title: 'Equipose - Clinical Trial Randomization Tool' },
  { path: 'about', component: AboutComponent, title: 'About | Equipose' },
  { path: 'generator', component: GeneratorComponent, title: 'Randomization Generator | Equipose' },
  { path: 'dashboard', component: VersionDashboardComponent, title: 'Compliance Dashboard | Equipose' },
  { path: 'verify', component: SchemaVerificationComponent, title: 'Verify Schema | Equipose' },
  { path: '**', redirectTo: '' }
];
