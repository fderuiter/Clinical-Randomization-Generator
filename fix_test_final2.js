const fs = require('fs');

let cg = fs.readFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', 'utf8');
cg = cg.replace(/\(mockFacade\)\./g, '(mockFacade as any).');
cg = cg.replace(/\(mockCodeGeneratorService\)\./g, '(mockCodeGeneratorService as any).');
fs.writeFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', cg);

let rg = fs.readFileSync('src/app/domain/schema-management/components/results-grid.component.spec.ts', 'utf8');
rg = rg.replace(/\(mockFacade\)\./g, '(mockFacade as any).');
rg = rg.replace(/\(summary\)\./g, '(summary as any).');
rg = rg.replace(/\(headers\[0\]\)\./g, '(headers[0] as any).');
rg = rg.replace(/\(headers\[1\]\)\./g, '(headers[1] as any).');
fs.writeFileSync('src/app/domain/schema-management/components/results-grid.component.spec.ts', rg);

let cf = fs.readFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', 'utf8');
cf = cf.replace(/\(mockFacade\)\./g, '(mockFacade as any).');
fs.writeFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', cf);
