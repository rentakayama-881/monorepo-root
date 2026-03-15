import * as Module from "../validationCaseDetailUtils";

describe("validationCaseDetailUtils smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has formatHoldWindow export", () => {
    expect(typeof Module.formatHoldWindow).toBe("function");
  });

  it("has isSyntheticArtifactMarker export", () => {
    expect(typeof Module.isSyntheticArtifactMarker).toBe("function");
  });

  it("has normalizeStatus export", () => {
    expect(typeof Module.normalizeStatus).toBe("function");
  });

  it("has statusBadgeClass export", () => {
    expect(typeof Module.statusBadgeClass).toBe("function");
  });

  it("has statusLabel export", () => {
    expect(typeof Module.statusLabel).toBe("function");
  });

  it("has workflowSummaryLabel export", () => {
    expect(typeof Module.workflowSummaryLabel).toBe("function");
  });

  it("has consultationStatusLabel export", () => {
    expect(typeof Module.consultationStatusLabel).toBe("function");
  });

  it("has sensitivityMeta export", () => {
    expect(typeof Module.sensitivityMeta).toBe("function");
  });

  it("has contentAsText export", () => {
    expect(typeof Module.contentAsText).toBe("function");
  });

  it("has stripLeadingRecordLabel export", () => {
    expect(typeof Module.stripLeadingRecordLabel).toBe("function");
  });

  it("has looksLikeMarkdownText export", () => {
    expect(typeof Module.looksLikeMarkdownText).toBe("function");
  });

  it("has formatCaseLogLoadError export", () => {
    expect(typeof Module.formatCaseLogLoadError).toBe("function");
  });

  it("has resolveTelegramContactHref export", () => {
    expect(typeof Module.resolveTelegramContactHref).toBe("function");
  });

  it("has formatTelegramContactLabel export", () => {
    expect(typeof Module.formatTelegramContactLabel).toBe("function");
  });

  it("has caseLogEventLabel export", () => {
    expect(typeof Module.caseLogEventLabel).toBe("function");
  });

  it("has sensitivityStakeRequirement export", () => {
    expect(typeof Module.sensitivityStakeRequirement).toBe("function");
  });
});
