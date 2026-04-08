import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {RouterOutlet, RouterLink, RouterLinkActive} from '@angular/router';
import {ThemeService, ThemeMode} from './core/services/theme.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-sans transition-colors duration-200">
      <header class="bg-indigo-700 dark:bg-slate-800 text-white shadow-md dark:shadow-slate-900/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-200 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <a routerLink="/" class="text-2xl font-bold tracking-tight hover:text-indigo-100 transition-colors">Clinical Randomization Generator</a>
          </div>
          <nav class="flex items-center gap-6 text-indigo-100 dark:text-slate-300 text-sm font-medium">
            <a routerLink="/" routerLinkActive="text-white dark:text-white" [routerLinkActiveOptions]="{exact: true}" class="hover:text-white transition-colors">Home</a>
            <a routerLink="/generator" routerLinkActive="text-white dark:text-white" class="hover:text-white transition-colors">Generator</a>
            <a routerLink="/about" routerLinkActive="text-white dark:text-white" class="hover:text-white transition-colors">About</a>

            <!-- Theme Toggle -->
            <div class="relative ml-2" #themeMenu>
              <button
                type="button"
                (click)="themeMenuOpen = !themeMenuOpen"
                class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-indigo-100 dark:text-slate-300 hover:bg-indigo-600 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-label="Toggle theme"
                [attr.aria-expanded]="themeMenuOpen"
              >
                <!-- Sun icon (Light) -->
                @if (theme.mode() === 'Light') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                }
                <!-- Moon icon (Dark) -->
                @if (theme.mode() === 'Dark') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                }
                <!-- Monitor icon (System) -->
                @if (theme.mode() === 'System') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              @if (themeMenuOpen) {
                <div class="absolute right-0 top-full mt-1 w-36 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-lg ring-1 ring-black/5 dark:ring-white/10 z-50 overflow-hidden"
                     (click)="themeMenuOpen = false">
                  <button type="button" (click)="setTheme('Light')" class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors" [class.font-semibold]="theme.mode() === 'Light'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                    Light
                  </button>
                  <button type="button" (click)="setTheme('Dark')" class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors" [class.font-semibold]="theme.mode() === 'Dark'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Dark
                  </button>
                  <button type="button" (click)="setTheme('System')" class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors" [class.font-semibold]="theme.mode() === 'System'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    System
                  </button>
                </div>
              }
            </div>
          </nav>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class App {
  readonly theme = inject(ThemeService);
  themeMenuOpen = false;

  setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }
}
