const fs = require('fs');

let cg = fs.readFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', 'utf8');
cg = cg.replace(/expect\(mockCodeGeneratorService\.generate\)/g, 'expect((mockCodeGeneratorService as any).generate)');
fs.writeFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', cg);

let cf = fs.readFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', 'utf8');
cf = cf.replace(/expect\(mockFacade\.clearResults\)/g, 'expect((mockFacade as any).clearResults)');
cf = cf.replace(/expect\(mockFacade\.generateSchema\)/g, 'expect((mockFacade as any).generateSchema)');
cf = cf.replace(/expect\(mockFacade\.openCodeGenerator\)/g, 'expect((mockFacade as any).openCodeGenerator)');
cf = cf.replace(/const arg = mockFacade\.generateSchema/g, 'const arg = (mockFacade as any).generateSchema');
cf = cf.replace(/const \[, lang\] = mockFacade\.openCodeGenerator/g, 'const [, lang] = (mockFacade as any).openCodeGenerator');
fs.writeFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', cf);
