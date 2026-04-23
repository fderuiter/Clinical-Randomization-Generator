const fs = require('fs');

let cg = fs.readFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', 'utf8');
cg = cg.replace(/expect\(\(mockCodeGeneratorService as any\)\.generate\)/g, 'expect(mockCodeGeneratorService.generate)');
fs.writeFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', cg);

let cf = fs.readFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', 'utf8');
cf = cf.replace(/expect\(\(mockFacade as any\)\.clearResults\)/g, 'expect(mockFacade.clearResults)');
cf = cf.replace(/expect\(\(mockFacade as any\)\.generateSchema\)/g, 'expect(mockFacade.generateSchema)');
cf = cf.replace(/expect\(\(mockFacade as any\)\.openCodeGenerator\)/g, 'expect(mockFacade.openCodeGenerator)');
cf = cf.replace(/const arg = \(mockFacade as any\)\.generateSchema/g, 'const arg = mockFacade.generateSchema');
cf = cf.replace(/const \[, lang\] = \(mockFacade as any\)\.openCodeGenerator/g, 'const [, lang] = mockFacade.openCodeGenerator');
fs.writeFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', cf);
