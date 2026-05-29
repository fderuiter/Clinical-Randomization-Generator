export function EscapedString(language: 'R' | 'Python' | 'SAS' | 'STATA') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (s: string) {
      if (language === 'R') {
        return FormattingUtil.escapeRString(s);
      } else if (language === 'Python') {
        return FormattingUtil.escapePythonString(s);
      } else if (language === 'SAS') {
        return FormattingUtil.escapeSasString(s);
      } else if (language === 'STATA') {
        return FormattingUtil.stataLabelQuote(s);
      }
      return originalMethod.apply(this, [s]);
    };
    return descriptor;
  };
}

export class FormattingUtil {
  static escapeRString(s: string): string {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  static escapePythonString(s: string): string {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  static escapeSasString(s: string): string {
    return s
      .replace(/"/g, '""')
      .replace(/\r?\n/g, ' ');
  }

  static stataLabelQuote(s: string): string {
    return '`"' + s.replace(/\r?\n/g, ' ') + '"\'';
  }

  static sanitizeStataVarName(id: string): string {
    const s = id.replace(/[^a-zA-Z0-9_]/g, '_');
    const fixed = /^[^a-zA-Z_]/.test(s) ? `_${s}` : s;
    return fixed.substring(0, 32);
  }
}
