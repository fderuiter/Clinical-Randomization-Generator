import { Component, signal, inject, OnInit } from '@angular/core';
import { RandomizationEngineFacade } from '../../randomization-engine/randomization-engine.facade';
import { CodeGeneratorService } from '../services/code-generator.service';

@Component({
  selector: 'app-code-generator-modal',
  standalone: true,
  templateUrl: './code-generator-modal.component.html'
})
export class CodeGeneratorModalComponent implements OnInit {
  public state = inject(RandomizationEngineFacade);
  private codeGenService = inject(CodeGeneratorService);

  activeTab = signal<'R' | 'SAS' | 'Python'>('R');
  copied = signal(false);

  ngOnInit() {
    this.activeTab.set(this.state.codeLanguage());
  }

  get currentCode(): string {
    const config = this.state.config();
    if (!config) return '';

    try {
      switch (this.activeTab()) {
        case 'R': return this.codeGenService.generateR(config);
        case 'SAS': return this.codeGenService.generateSas(config);
        case 'Python': return this.codeGenService.generatePython(config);
        default: return '';
      }
    } catch (e) {
      console.error('Error generating code:', e);
      return 'Error generating code. Please check your configuration.';
    }
  }

  copyCode() {
    navigator.clipboard.writeText(this.currentCode);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  downloadCode() {
    const code = this.currentCode;
    const extension = this.activeTab() === 'R' ? 'R' : this.activeTab() === 'SAS' ? 'sas' : 'py';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `randomization_code.${extension}`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
