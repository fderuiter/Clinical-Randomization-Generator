import { Component, signal, inject, OnInit } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { CodeGeneratorService } from '../services/code-generator.service';
import { CodeGenerationError } from '../errors/code-generation-errors';

@Component({
  selector: 'app-code-generator-modal',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './code-generator-modal.component.html'
})
export class CodeGeneratorModalComponent implements OnInit {
  public state = inject(RandomizationEngineFacade);
  private codeGenService = inject(CodeGeneratorService);

  activeTab = signal<'R' | 'SAS' | 'Python' | 'STATA'>('R');
  copied = signal(false);
  errorState = signal<CodeGenerationError | null>(null);
  generatedCode = signal<string>('');

  ngOnInit() {
    this.activeTab.set(this.state.codeLanguage());
    this.refreshCode();
  }

  get currentCode(): string {
    return this.generatedCode();
  }

  setActiveTab(tab: 'R' | 'SAS' | 'Python' | 'STATA') {
    this.activeTab.set(tab);
    this.refreshCode();
  }

  private refreshCode() {
    const config = this.state.config();
    this.errorState.set(null);
    if (!config) {
      this.generatedCode.set('');
      return;
    }
    try {
      const code = this.codeGenService.generate(this.activeTab(), config);
      this.generatedCode.set(code);
    } catch (e) {
      console.error('Error generating code:', e);
      if (e instanceof CodeGenerationError) {
        this.errorState.set(e);
      } else {
        // Wrap unexpected errors in a generic CodeGenerationError so the UI can display them.
        const causeMessage = e instanceof Error
          ? `${e.name}: ${e.message}`
          : String(e);
        const wrapped = new CodeGenerationError(
          `An unexpected error occurred during code generation. ${causeMessage}`,
          config
        );
        this.errorState.set(wrapped);
      }
      this.generatedCode.set('');
    }
  }

  copyCode() {
    navigator.clipboard.writeText(this.currentCode);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  copyErrorLog() {
    const err = this.errorState();
    if (!err) return;
    const payload = {
      errorName: err.name,
      message: err.message,
      context: err.context
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  downloadCode() {
    const code = this.currentCode;
    const tab = this.activeTab();
    const extension = tab === 'R' ? 'R' : tab === 'SAS' ? 'sas' : tab === 'STATA' ? 'do' : 'py';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `randomization_schema.${extension}`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
