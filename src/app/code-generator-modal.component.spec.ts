import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeGeneratorModalComponent } from './code-generator-modal.component';

describe('CodeGeneratorModalComponent', () => {
  let component: CodeGeneratorModalComponent;
  let fixture: ComponentFixture<CodeGeneratorModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeGeneratorModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CodeGeneratorModalComponent);
    component = fixture.componentInstance;
  });

  describe('when config is fully populated', () => {
    beforeEach(() => {
      component.config = {
        protocolId: 'TEST-123',
        studyName: 'Test Study',
        phase: 'Phase 1',
        arms: [
          { id: '1', name: 'Arm A', ratio: 1 },
          { id: '2', name: 'Arm B', ratio: 2 }
        ],
        sites: ['Site1', 'Site2'],
        strata: [
          { id: 'strata1', name: 'Strata 1', levels: ['Low', 'High'] },
          { id: 'strata2', name: 'Strata 2', levels: ['Yes', 'No'] }
        ],
        blockSizes: [3, 6],
        subjectsPerSite: 10,
        seed: 'test_seed',
        subjectIdMask: '[SiteID]-[StratumCode]-[001]'
      };
      fixture.detectChanges();
    });

    it('should generate valid R code', () => {
      const code = component.rCode;
      expect(code).toContain('Protocol: TEST-123');
      expect(code).toContain('Study: Test Study');
      expect(code).toContain('sites <- c("Site1", "Site2")');
      expect(code).toContain('block_sizes <- c(3, 6)');
      expect(code).toContain('subjects_per_stratum <- 10');
      expect(code).toContain('arms <- c("Arm A", "Arm B")');
      expect(code).toContain('ratios <- c(1, 2)');
      expect(code).toContain('strata1_levels <- c("Low", "High")');
      expect(code).toContain('strata2_levels <- c("Yes", "No")');
    });

    it('should generate valid Python code', () => {
      const code = component.pythonCode;
      expect(code).toContain('Protocol: TEST-123');
      expect(code).toContain('Study: Test Study');
      expect(code).toContain('sites = ["Site1", "Site2"]');
      expect(code).toContain('block_sizes = [3, 6]');
      expect(code).toContain('subjects_per_site = 10');
      expect(code).toContain('arms = [{"name": "Arm A", "ratio": 1}, {"name": "Arm B", "ratio": 2}]');
      expect(code).toContain('strata_levels = [\n    ["Low", "High"],\n    ["Yes", "No"]\n]');
      expect(code).toContain('strata_names = ["strata1", "strata2"]');
    });

    it('should generate valid SAS code', () => {
      const code = component.sasCode;
      expect(code).toContain('Protocol: TEST-123');
      expect(code).toContain('Study: Test Study');
      expect(code).toContain('name="Arm A"; ratio=1; output;');
      expect(code).toContain('name="Arm B"; ratio=2; output;');
      expect(code).toContain('site="Site1"; output;');
      expect(code).toContain('site="Site2"; output;');
      expect(code).toContain('size=3; output;');
      expect(code).toContain('size=6; output;');
      expect(code).toContain('%let subjects_per_site = 10;');
    });
  });

  describe('when config has empty arrays/values', () => {
    beforeEach(() => {
      component.config = {
        protocolId: '',
        studyName: '',
        phase: '',
        arms: [],
        sites: [],
        strata: [],
        blockSizes: [],
        subjectsPerSite: 0,
        seed: '',
        subjectIdMask: ''
      };
      fixture.detectChanges();
    });

    it('should handle empty config in R code', () => {
      const code = component.rCode;
      expect(code).toContain('Protocol: Unknown');
      expect(code).toContain('sites <- c()');
      expect(code).toContain('block_sizes <- c()');
      expect(code).toContain('arms <- c()');
    });

    it('should handle empty config in Python code', () => {
      const code = component.pythonCode;
      expect(code).toContain('Protocol: Unknown');
      expect(code).toContain('sites = []');
      expect(code).toContain('block_sizes = []');
      expect(code).toContain('arms = []');
    });

    it('should handle empty config in SAS code', () => {
      const code = component.sasCode;
      expect(code).toContain('Protocol: Unknown');
      // Updated the test to correctly check that `site="..."` isn't present
      expect(code).not.toContain('site="');
      expect(code).not.toContain('size=;');
    });
  });

  describe('when config properties are undefined', () => {
    beforeEach(() => {
      component.config = {} as any;
      fixture.detectChanges();
    });

    it('should not throw on R code generation', () => {
      expect(() => component.rCode).not.toThrow();
    });

    it('should not throw on Python code generation', () => {
      expect(() => component.pythonCode).not.toThrow();
    });

    it('should not throw on SAS code generation', () => {
      expect(() => component.sasCode).not.toThrow();
    });
  });
});
