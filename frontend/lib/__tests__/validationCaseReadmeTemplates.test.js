import {
  VALIDATION_CASE_README_TEMPLATES,
  getValidationCaseReadmeTemplateById,
} from '../validationCaseReadmeTemplates';

describe('validationCaseReadmeTemplates', () => {
  it('provides 8 predefined templates', () => {
    expect(Array.isArray(VALIDATION_CASE_README_TEMPLATES)).toBe(true);
    expect(VALIDATION_CASE_README_TEMPLATES).toHaveLength(8);
  });

  it('ensures each template has required metadata and markdown snippet', () => {
    for (const template of VALIDATION_CASE_README_TEMPLATES) {
      expect(typeof template.id).toBe('string');
      expect(template.id.length).toBeGreaterThan(0);
      expect(typeof template.name).toBe('string');
      expect(template.name.length).toBeGreaterThan(0);
      expect(typeof template.description).toBe('string');
      expect(typeof template.category).toBe('string');
      expect(typeof template.snippet).toBe('string');
      expect(template.snippet).toContain('# ');
      expect(template.snippet).toContain('img.shields.io');
      expect(Array.isArray(template.previewBadges)).toBe(true);
      expect(template.previewBadges.length).toBeGreaterThan(0);
    }
  });

  it('finds template by id case-insensitively', () => {
    const found = getValidationCaseReadmeTemplateById('ACADEMIC-THESIS-REVIEW');
    expect(found).not.toBeNull();
    expect(found.id).toBe('academic-thesis-review');
  });

  it('returns null for unknown template id', () => {
    expect(getValidationCaseReadmeTemplateById('not-exists')).toBeNull();
  });
});
