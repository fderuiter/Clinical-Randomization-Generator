const fs = require('fs');

function replace(path, regex, replacement) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
}

replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(mockFacade as unknown as \{ results: \{ set: ReturnType<typeof vi\.fn> \} \}\)\.results\.set/g, '(mockFacade as any).results.set');
replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(summary as unknown as \{ type: string, tallies: Record<string, number>, totalSubjects: number, isIncomplete: boolean, blockSize: number \}\)\.type/g, '(summary as any).type');
replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(summary as unknown as \{ type: string, tallies: Record<string, number>, totalSubjects: number, isIncomplete: boolean, blockSize: number \}\)\.tallies/g, '(summary as any).tallies');
replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(summary as unknown as \{ type: string, tallies: Record<string, number>, totalSubjects: number, isIncomplete: boolean, blockSize: number \}\)\.isIncomplete/g, '(summary as any).isIncomplete');
replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(summary as unknown as \{ type: string, tallies: Record<string, number>, totalSubjects: number, isIncomplete: boolean, blockSize: number \}\)\.totalSubjects/g, '(summary as any).totalSubjects');
replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(summary as unknown as \{ type: string, tallies: Record<string, number>, totalSubjects: number, isIncomplete: boolean, blockSize: number \}\)\.blockSize/g, '(summary as any).blockSize');

replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(headers\[0\] as unknown as \{ site: string \}\)\.site/g, '(headers[0] as any).site');
replace('src/app/domain/schema-management/components/results-grid.component.spec.ts', /\(headers\[1\] as unknown as \{ site: string \}\)\.site/g, '(headers[1] as any).site');

replace('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', /\(mockFacade as unknown as \{ config: \{ set: ReturnType<typeof vi\.fn> \}, results: \{ set: ReturnType<typeof vi\.fn> \} \}\)\.config\.set/g, '(mockFacade as any).config.set');
replace('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', /\(mockCodeGeneratorService as unknown as \{ generate: ReturnType<typeof vi\.fn> \}\)\.generate\.mockReturnValue/g, '(mockCodeGeneratorService as any).generate.mockReturnValue');
replace('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', /\(mockCodeGeneratorService as unknown as \{ generate: ReturnType<typeof vi\.fn> \}\)\.generate\.mockImplementation/g, '(mockCodeGeneratorService as any).generate.mockImplementation');
replace('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', /\(mockCodeGeneratorService as unknown as \{ generate: ReturnType<typeof vi\.fn> \}\)\.generate/g, '(mockCodeGeneratorService as any).generate');

replace('src/app/domain/schema-management/services/excel-export.service.spec.ts', /\(this as unknown as \{ creator: string \}\)/g, '(this as any)');

replace('src/app/domain/study-builder/components/config-form.component.spec.ts', /\(mockFacade as unknown as \{ clearResults: ReturnType<typeof vi\.fn>, generateSchema: ReturnType<typeof vi\.fn>, openCodeGenerator: ReturnType<typeof vi\.fn> \}\)\.clearResults/g, '(mockFacade as any).clearResults');
replace('src/app/domain/study-builder/components/config-form.component.spec.ts', /\(mockFacade as unknown as \{ clearResults: ReturnType<typeof vi\.fn>, generateSchema: ReturnType<typeof vi\.fn>, openCodeGenerator: ReturnType<typeof vi\.fn> \}\)\.generateSchema/g, '(mockFacade as any).generateSchema');
replace('src/app/domain/study-builder/components/config-form.component.spec.ts', /\(mockFacade as unknown as \{ clearResults: ReturnType<typeof vi\.fn>, generateSchema: ReturnType<typeof vi\.fn>, openCodeGenerator: ReturnType<typeof vi\.fn> \}\)\.openCodeGenerator/g, '(mockFacade as any).openCodeGenerator');

function addEslintDisable(path) {
  let content = fs.readFileSync(path, 'utf8');
  if (!content.includes('eslint-disable @typescript-eslint/no-explicit-any')) {
    content = '/* eslint-disable @typescript-eslint/no-explicit-any */\n' + content;
    fs.writeFileSync(path, content);
  }
}
addEslintDisable('src/app/domain/schema-management/components/results-grid.component.spec.ts');
addEslintDisable('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts');
addEslintDisable('src/app/domain/schema-management/services/excel-export.service.spec.ts');
addEslintDisable('src/app/domain/study-builder/components/config-form.component.spec.ts');
