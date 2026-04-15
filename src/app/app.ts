import {ChangeDetectionStrategy, Component, HostListener, inject, signal, PLATFORM_ID} from '@angular/core';
import {RouterOutlet, RouterLink, RouterLinkActive} from '@angular/router';
import {isPlatformBrowser} from '@angular/common';
import {DOCUMENT} from '@angular/common';
import {ThemeService, ThemeMode} from './core/services/theme.service';
import {UpdateNotificationService} from './core/services/update-notification.service';
import {UpdateBannerComponent} from './core/components/update-banner.component';
import {APP_VERSION} from '../environments/version';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UpdateBannerComponent],
  template: `
    <!-- Skip to main content (accessibility) -->
    <a href="#main-content"
       class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-indigo-700 focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
      Skip to main content
    </a>

    @if (updateService.updateAvailable()) {
      <app-update-banner />
    }
    <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-sans transition-colors duration-200"
         [class.pt-10]="updateService.updateAvailable()">
      <header class="bg-indigo-700 dark:bg-slate-800 text-white shadow-md dark:shadow-slate-900/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <!-- Brand -->
          <div class="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-200 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M5 6l7-3 7 3M3 10l2 6a4 4 0 004 0l2-6M13 10l2 6a4 4 0 004 0l2-6" />
            </svg>
            <a routerLink="/" class="text-2xl font-bold tracking-tight hover:text-indigo-100 transition-colors">Equipose</a>
          </div>

          <!-- Desktop nav (hidden on mobile) -->
          <nav class="hidden sm:flex items-center gap-6 text-indigo-100 dark:text-slate-300 text-sm font-medium" aria-label="Main navigation">
            <a routerLink="/" routerLinkActive #rlaHome="routerLinkActive" [routerLinkActiveOptions]="{exact: true}"
               [class]="rlaHome.isActive ? 'text-white dark:text-white' : 'hover:text-white transition-colors'"
               [attr.aria-current]="rlaHome.isActive ? 'page' : null">Home</a>
            <a routerLink="/generator" routerLinkActive #rlaGen="routerLinkActive"
               [class]="rlaGen.isActive ? 'text-white dark:text-white' : 'hover:text-white transition-colors'"
               [attr.aria-current]="rlaGen.isActive ? 'page' : null">Generator</a>
            <a routerLink="/verify" routerLinkActive #rlaVerify="routerLinkActive"
               [class]="rlaVerify.isActive ? 'text-white dark:text-white' : 'hover:text-white transition-colors'"
               [attr.aria-current]="rlaVerify.isActive ? 'page' : null">Verify Schema</a>
            <a routerLink="/about" routerLinkActive #rlaAbout="routerLinkActive"
               [class]="rlaAbout.isActive ? 'text-white dark:text-white' : 'hover:text-white transition-colors'"
               [attr.aria-current]="rlaAbout.isActive ? 'page' : null">About</a>

            <!-- Theme Toggle -->
            <div class="relative ml-2">
              <button
                type="button"
                (click)="toggleThemeMenu($event)"
                class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-indigo-100 dark:text-slate-300 hover:bg-indigo-600 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
                aria-label="Toggle colour theme"
                [attr.aria-expanded]="themeMenuOpen()"
                aria-haspopup="true"
              >
                @if (theme.mode() === 'Light') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                }
                @if (theme.mode() === 'Dark') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                }
                @if (theme.mode() === 'System') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              @if (themeMenuOpen()) {
                <div role="menu" aria-label="Choose colour theme"
                     class="absolute right-0 top-full mt-1 w-36 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-lg ring-1 ring-black/5 dark:ring-white/10 z-50 overflow-hidden">
                  <button type="button" role="menuitem" (click)="setTheme('Light')" class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors" [class.font-semibold]="theme.mode() === 'Light'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                    Light
                  </button>
                  <button type="button" role="menuitem" (click)="setTheme('Dark')" class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors" [class.font-semibold]="theme.mode() === 'Dark'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Dark
                  </button>
                  <button type="button" role="menuitem" (click)="setTheme('System')" class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors" [class.font-semibold]="theme.mode() === 'System'">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    System
                  </button>
                </div>
              }
            </div>
          </nav>

          <!-- Mobile controls (visible only on mobile) -->
          <div class="flex items-center gap-2 sm:hidden">
            <!-- Mobile theme toggle (icon only) -->
            <button
              type="button"
              (click)="toggleThemeMenu($event)"
              class="flex items-center rounded-lg p-2 text-indigo-100 hover:bg-indigo-600 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-label="Toggle colour theme"
              [attr.aria-expanded]="themeMenuOpen()"
            >
              @if (theme.mode() === 'Light') {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              }
              @if (theme.mode() === 'Dark') {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              }
              @if (theme.mode() === 'System') {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            </button>

            <!-- Hamburger button -->
            <button
              type="button"
              (click)="mobileMenuOpen.set(!mobileMenuOpen())"
              class="flex items-center rounded-lg p-2 text-indigo-100 hover:bg-indigo-600 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
              [attr.aria-expanded]="mobileMenuOpen()"
              aria-controls="mobile-menu"
              aria-label="Toggle navigation menu"
            >
              @if (!mobileMenuOpen()) {
                <!-- Hamburger icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              } @else {
                <!-- Close icon -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
            </button>
          </div>
        </div>

        <!-- Mobile menu dropdown -->
        @if (mobileMenuOpen()) {
          <nav id="mobile-menu" class="sm:hidden border-t border-indigo-600 dark:border-slate-700 bg-indigo-700 dark:bg-slate-800" aria-label="Mobile navigation">
            <div class="px-4 py-3 space-y-1">
              <a routerLink="/" routerLinkActive #mRlaHome="routerLinkActive" [routerLinkActiveOptions]="{exact: true}"
                 (click)="mobileMenuOpen.set(false)"
                 class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                 [class]="mRlaHome.isActive ? 'bg-indigo-600 dark:bg-slate-700 text-white' : 'text-indigo-100 hover:bg-indigo-600 dark:hover:bg-slate-700'"
                 [attr.aria-current]="mRlaHome.isActive ? 'page' : null">Home</a>
              <a routerLink="/generator" routerLinkActive #mRlaGen="routerLinkActive"
                 (click)="mobileMenuOpen.set(false)"
                 class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                 [class]="mRlaGen.isActive ? 'bg-indigo-600 dark:bg-slate-700 text-white' : 'text-indigo-100 hover:bg-indigo-600 dark:hover:bg-slate-700'"
                 [attr.aria-current]="mRlaGen.isActive ? 'page' : null">Generator</a>
              <a routerLink="/verify" routerLinkActive #mRlaVerify="routerLinkActive"
                 (click)="mobileMenuOpen.set(false)"
                 class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                 [class]="mRlaVerify.isActive ? 'bg-indigo-600 dark:bg-slate-700 text-white' : 'text-indigo-100 hover:bg-indigo-600 dark:hover:bg-slate-700'"
                 [attr.aria-current]="mRlaVerify.isActive ? 'page' : null">Verify Schema</a>
              <a routerLink="/about" routerLinkActive #mRlaAbout="routerLinkActive"
                 (click)="mobileMenuOpen.set(false)"
                 class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                 [class]="mRlaAbout.isActive ? 'bg-indigo-600 dark:bg-slate-700 text-white' : 'text-indigo-100 hover:bg-indigo-600 dark:hover:bg-slate-700'"
                 [attr.aria-current]="mRlaAbout.isActive ? 'page' : null">About</a>

              <!-- Mobile theme options -->
              <div class="pt-2 border-t border-indigo-600/50 dark:border-slate-600">
                <p class="px-3 pb-1.5 text-xs font-semibold text-indigo-300 dark:text-slate-400 uppercase tracking-wider">Colour Theme</p>
                <div class="flex gap-2 px-3">
                  <button type="button" (click)="setTheme('Light'); mobileMenuOpen.set(false)"
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors"
                    [class]="theme.mode() === 'Light' ? 'bg-white/20 text-white' : 'text-indigo-200 hover:bg-indigo-600'"
                    aria-label="Light theme">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                    Light
                  </button>
                  <button type="button" (click)="setTheme('Dark'); mobileMenuOpen.set(false)"
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors"
                    [class]="theme.mode() === 'Dark' ? 'bg-white/20 text-white' : 'text-indigo-200 hover:bg-indigo-600'"
                    aria-label="Dark theme">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Dark
                  </button>
                  <button type="button" (click)="setTheme('System'); mobileMenuOpen.set(false)"
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors"
                    [class]="theme.mode() === 'System' ? 'bg-white/20 text-white' : 'text-indigo-200 hover:bg-indigo-600'"
                    aria-label="System theme">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    System
                  </button>
                </div>
              </div>
            </div>
          </nav>
        }

      </header>

      <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <router-outlet></router-outlet>
      </main>

      <footer class="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">

            <!-- Col 1: Brand -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M5 6l7-3 7 3M3 10l2 6a4 4 0 004 0l2-6M13 10l2 6a4 4 0 004 0l2-6" />
                </svg>
                <a href="https://equipose.org" class="font-semibold text-gray-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Equipose</a>
              </div>
              <p class="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                Free, browser-based stratified block randomization for clinical trials. No server. No sign-up. No data shared.
              </p>
              <p class="text-xs text-gray-400 dark:text-slate-500">© {{ currentYear }} Frederick de Ruiter</p>
            </div>

            <!-- Col 2: Links -->
            <div class="flex flex-col gap-1.5 text-sm">
              <p class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Navigation</p>
              <a routerLink="/about" class="text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">About</a>
              <a routerLink="/generator" class="text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Generator</a>
              <a routerLink="/verify" class="text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Verify Schema</a>
              <a href="https://github.com/fderuiter/Clinical-Randomization-Generator" target="_blank" rel="noopener noreferrer" class="text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">GitHub</a>
            </div>

            <!-- Col 3: Technical info -->
            <div class="flex flex-col gap-2 text-sm">
              <p class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Details</p>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-xs font-mono font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700">
                  {{ appVersion }}
                </span>
                <a href="https://github.com/fderuiter/Clinical-Randomization-Generator/blob/main/LICENSE"
                   target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-1 rounded-md bg-gray-50 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300 ring-1 ring-gray-200 dark:ring-slate-600 hover:ring-indigo-400 transition-colors">
                  MIT License
                </a>
              </div>
              <p class="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Zero data transmitted — 100% client-side
              </p>
              <a href="https://github.com/fderuiter/Clinical-Randomization-Generator"
                 target="_blank" rel="noopener noreferrer"
                 class="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `
})
export class App {
  readonly theme = inject(ThemeService);
  readonly updateService = inject(UpdateNotificationService);
  readonly currentYear = new Date().getFullYear();
  readonly appVersion = APP_VERSION;

  readonly themeMenuOpen = signal(false);
  readonly mobileMenuOpen = signal(false);

  constructor() {
    // Patch the JSON-LD softwareVersion dynamically so it stays in sync with APP_VERSION
    const doc = inject(DOCUMENT);
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId)) {
      const scriptEl = doc.getElementById('app-jsonld') as HTMLScriptElement | null;
      if (scriptEl) {
        try {
          const data = JSON.parse(scriptEl.textContent ?? '{}');
          data['softwareVersion'] = APP_VERSION.replace(/^v/, '');
          scriptEl.textContent = JSON.stringify(data);
        } catch {
          // non-critical — leave JSON-LD as-is
        }
      }
    }
  }

  setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
    this.themeMenuOpen.set(false);
  }

  toggleThemeMenu(event: Event): void {
    event.stopPropagation();
    this.themeMenuOpen.set(!this.themeMenuOpen());
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.themeMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.themeMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }
}
