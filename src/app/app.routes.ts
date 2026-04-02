import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { AboutComponent } from './features/about/about.component';
import { GeneratorComponent } from './features/generator/components/generator.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'about', component: AboutComponent },
  { path: 'generator', component: GeneratorComponent },
  { path: '**', redirectTo: '' }
];
