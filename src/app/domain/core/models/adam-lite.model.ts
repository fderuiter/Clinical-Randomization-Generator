export interface AdamLiteVariable {
  id: string;
  label: string;
  type: 'continuous' | 'categorical' | 'identifier';
  metadataTags: string[];
}

export interface AdamLiteDataset {
  name: string;
  variables: AdamLiteVariable[];
  records: Record<string, any>[];
}
