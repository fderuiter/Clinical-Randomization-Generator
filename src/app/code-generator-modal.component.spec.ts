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
      expect(code).toContain('subjects_per_site <- 10');
      expect(code).toContain('arms <- c("Arm A", "Arm B")');
      expect(code).toContain('ratios <- c(1, 2)');
      expect(code).toContain('strata1_levels <- c("Low", "High")');
      expect(code).toContain('strata2_levels <- c("Yes", "No")');
    });

    it('should generate valid Python code', () => {
      const code = component.pythonCode;
      expect(code).toContain('Protocol: TEST-123');
      expect(code).toContain('Study: Test Study');
      expect(code).toContain('import numpy as np');
      expect(code).toContain('rng = np.random.default_rng(' + component.hashCode("test_seed") + ')');
      expect(code).toContain('sites = ["Site1", "Site2"]');
      expect(code).toContain('block_sizes = [3, 6]');
      expect(code).toContain('max_subjects_per_stratum = 10');
      expect(code).toContain('arms = [{"name": "Arm A", "ratio": 1}, {"name": "Arm B", "ratio": 2}]');
      expect(code).toContain('strata_levels = [\n    ["Low", "High"],\n    ["Yes", "No"]\n]');
      expect(code).toContain('strata_names = ["strata1", "strata2"]');
    });

    it('should generate valid SAS code', () => {
      const code = component.sasCode;
      expect(code).toContain('Protocol: TEST-123');
      expect(code).toContain('Study: Test Study');
      expect(code).toContain('%let arms = "Arm A" "Arm B";');
      expect(code).toContain('%let ratios = 1 2;');
      expect(code).toContain('%let sites = "Site1" "Site2";');
      expect(code).toContain('%let block_sizes = 3 6;');
      expect(code).toContain('%let subjects_per_site = 10;');
      expect(code).toContain('%let total_ratio = 3;');
      expect(code).toContain('%let strata1_levels = "Low" "High";');
      expect(code).toContain('%let strata2_levels = "Yes" "No";');
      expect(code).toContain('call streaminit(&seed.);');
      expect(code).toContain('rand(\'uniform\');');
      expect(code).toContain('proc sort data=_blocks;');
      expect(code).toContain('by Site strata1 strata2 block_num _rand_sort;');
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
      expect(code).toContain('%let arms = ;');
      expect(code).toContain('%let sites = ;');
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
