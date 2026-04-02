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
        stratumCaps: [
          { levels: ['Low', 'Yes'], cap: 10 },
          { levels: ['Low', 'No'], cap: 15 },
          { levels: ['High', 'Yes'], cap: 5 },
          { levels: ['High', 'No'], cap: 20 }
        ],
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
      expect(code).toContain('"Low_Yes" = 10');
      expect(code).toContain('"Low_No" = 15');
      expect(code).toContain('"High_Yes" = 5');
      expect(code).toContain('"High_No" = 20');
      expect(code).toContain('arms <- c("Arm A", "Arm B")');
      expect(code).toContain('ratios <- c(1, 2)');
      expect(code).toContain('strata1_levels <- c("Low", "High")');
      expect(code).toContain('strata2_levels <- c("Yes", "No")');

      // Verify block math failsafe
      expect(code).toContain('if (any(block_sizes %% total_ratio != 0)) {');
      expect(code).toContain('stop("Block sizes must be exact multiples of the total allocation ratio.")');

      // Verify list accumulation
      expect(code).toContain('schema_list <- list()');
      expect(code).toContain('schema_list[[row_idx]] <- row');
      expect(code).toContain('schema <- do.call(rbind, schema_list)');

      // Verify QC integration
      expect(code).toContain('print(table(schema$Treatment))');
      expect(code).toContain('print(table(schema$Site, schema$Treatment))');
      expect(code).toContain('print(table(schema$BlockSize))');

      // Verify continuous ID tracking
      expect(code).toContain('site_subject_count <- 0');
      expect(code).toContain('stratum_subject_count <- 0');
      expect(code).toContain('sprintf("%s-%03d", site, site_subject_count)');
      expect(code).toContain('while (stratum_subject_count < max_subjects_per_stratum)');
    });

    it('should generate valid Python code', () => {
      const code = component.pythonCode;
      expect(code).toContain('Protocol: TEST-123');
      expect(code).toContain('Study: Test Study');
      expect(code).toContain('import numpy as np');
      expect(code).toContain('rng = np.random.default_rng(' + component.hashCode("test_seed") + ')');
      expect(code).toContain('sites = ["Site1", "Site2"]');
      expect(code).toContain('block_sizes = [3, 6]');
      expect(code).toContain('("Low", "Yes"): 10');
      expect(code).toContain('("Low", "No"): 15');
      expect(code).toContain('("High", "Yes"): 5');
      expect(code).toContain('("High", "No"): 20');
      expect(code).toContain('arms = [{"name": "Arm A", "ratio": 1}, {"name": "Arm B", "ratio": 2}]');
      expect(code).toContain('strata_levels = [\n    ["Low", "High"],\n    ["Yes", "No"]\n]');
      expect(code).toContain('strata_names = ["strata1", "strata2"]');

      // Verify block math failsafe
      expect(code).toContain('if any(bs % total_ratio != 0 for bs in block_sizes):');
      expect(code).toContain('raise ValueError("Block sizes must be exact multiples of the total allocation ratio.")');

      // Verify dictionary unpacking
      expect(code).toContain('**stratum');

      // Verify QC integration
      expect(code).toContain('print(df[\'Treatment\'].value_counts())');
      expect(code).toContain('print(pd.crosstab(df[\'Site\'], df[\'Treatment\']))');
      expect(code).toContain('print(df[\'BlockSize\'].value_counts())');

      // Verify continuous ID tracking
      expect(code).toContain('site_subject_count = 0');
      expect(code).toContain('stratum_subject_count = 0');
      expect(code).toContain('subject_id = f"{site}-{site_subject_count:03d}"');
      expect(code).toContain('while stratum_subject_count < max_subjects_per_stratum:');
    });

    it('should generate valid SAS code', () => {
      const code = component.sasCode;
      expect(code).toContain('Protocol: TEST-123');
      expect(code).toContain('Study: Test Study');
      expect(code).toContain('%let arms = "Arm A" "Arm B";');
      expect(code).toContain('%let ratios = 1 2;');
      expect(code).toContain('%let sites = "Site1" "Site2";');
      expect(code).toContain('%let block_sizes = 3 6;');
      expect(code).toContain('%let total_ratio = 3;');
      expect(code).toContain('%let strata1_levels = "Low" "High";');
      expect(code).toContain('%let strata2_levels = "Yes" "No";');

      // Verify dynamic caps logic
      expect(code).toContain('data _caps;');
      expect(code).toContain('strata1 = "Low";  strata2 = "Yes";  max_subjects_per_stratum = 10;\n  output;');
      expect(code).toContain('strata1 = "Low";  strata2 = "No";  max_subjects_per_stratum = 15;\n  output;');
      expect(code).toContain('strata1 = "High";  strata2 = "Yes";  max_subjects_per_stratum = 5;\n  output;');
      expect(code).toContain('strata1 = "High";  strata2 = "No";  max_subjects_per_stratum = 20;\n  output;');
      expect(code).toContain('left join _caps caps on 1=1 and b.strata1 = caps.strata1 and c.strata2 = caps.strata2;');

      expect(code).toContain('call streaminit(&seed.);');
      expect(code).toContain('rand(\'uniform\');');
      expect(code).toContain('proc sort data=_blocks;');
      expect(code).toContain('by Site strata1 strata2 block_num _rand_sort;');

      // Verify block math failsafe
      expect(code).toContain('if mod(_block_size, &total_ratio.) ^= 0 then do;');
      expect(code).toContain('%abort cancel;');

      // Verify continuous ID tracking
      expect(code).toContain('retain _site_subj_count 0;');
      expect(code).toContain('if first.Site then _site_subj_count = 0;');
      expect(code).toContain('retain _stratum_subj_count;');
      expect(code).toContain('if _stratum_subj_count <= max_subjects_per_stratum then do;');
      expect(code).toContain('SubjectID = cats(Site, "-", put(_site_subj_count, z3.));');

      // Verify QC integration
      expect(code).toContain('proc freq data=final_schema;');
      expect(code).toContain('tables Treatment / nocum;');
      expect(code).toContain('tables Site * Treatment / nocol nopercent;');
      expect(code).toContain('tables block_size / nocum;');
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
        stratumCaps: [],
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
