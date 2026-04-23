const fs = require('fs');

let cg = fs.readFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', 'utf8');
cg = cg.replace(/mockFacade as any/g, 'mockFacade');
cg = cg.replace(/mockCodeGeneratorService as any/g, 'mockCodeGeneratorService');
cg = cg.replace(/mockFacade: any/g, 'mockFacade: { config: { set: ReturnType<typeof vi.fn> }; results: { set: ReturnType<typeof vi.fn> }; openCodeGenerator: ReturnType<typeof vi.fn>; closeCodeGenerator: ReturnType<typeof vi.fn> } | any');
cg = cg.replace(/mockCodeGeneratorService: any/g, 'mockCodeGeneratorService: { generate: ReturnType<typeof vi.fn> } | any');
fs.writeFileSync('src/app/domain/schema-management/components/code-generator-modal.component.spec.ts', cg);

let rg = fs.readFileSync('src/app/domain/schema-management/components/results-grid.component.spec.ts', 'utf8');
rg = rg.replace(/mockFacade as any/g, 'mockFacade');
rg = rg.replace(/summary as any/g, 'summary');
rg = rg.replace(/headers\[0\] as any/g, 'headers[0]');
rg = rg.replace(/headers\[1\] as any/g, 'headers[1]');
fs.writeFileSync('src/app/domain/schema-management/components/results-grid.component.spec.ts', rg);

let ee = fs.readFileSync('src/app/domain/schema-management/services/excel-export.service.spec.ts', 'utf8');
ee = ee.replace(/this as any\)/g, 'this as unknown as { creator: string } | any)');
fs.writeFileSync('src/app/domain/schema-management/services/excel-export.service.spec.ts', ee);

let cf = fs.readFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', 'utf8');
cf = cf.replace(/mockFacade as any/g, 'mockFacade');
fs.writeFileSync('src/app/domain/study-builder/components/config-form.component.spec.ts', cf);
