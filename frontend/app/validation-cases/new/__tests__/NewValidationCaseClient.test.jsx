import { render } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("next/dynamic", () => {
  return function mockDynamic(loader, options) {
    const MockComp = (props) => <div data-testid="dynamic-component" />;
    if (options?.loading) {
      MockComp.loading = options.loading;
    }
    return MockComp;
  };
});

jest.mock("@/components/ui/NativeSelect", () => ({
  __esModule: true,
  default: (props) => <select data-testid="native-select" />,
}));

jest.mock("@/components/ui/Button", () => ({
  __esModule: true,
  default: ({ children, ...props }) => <button data-testid="button">{children}</button>,
}));

jest.mock("@/lib/format", () => ({
  formatIDR: jest.fn((v) => `Rp ${v}`),
}));

jest.mock("../NewValidationCaseSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="new-case-skeleton" />,
}));

jest.mock("../components/newCaseUtils", () => ({
  createNavigationSections: jest.fn(() => []),
  sanitizeNumericInput: jest.fn((v) => v),
}));

jest.mock("../components/useNewValidationCase", () => ({
  useNewValidationCase: jest.fn(() => ({
    loadingCaseType: true,
    loading: true,
    error: null,
    form: {},
    setForm: jest.fn(),
    workspaceUploadDraft: null,
    setWorkspaceUploadDraft: jest.fn(),
    workspaceBootstrapFiles: [],
    workspaceFileInputKey: 0,
    availableTags: [],
    tagsAvailable: false,
    tagsLoading: false,
    selectedTags: [],
    setSelectedTags: jest.fn(),
    submitting: false,
    ok: false,
    activeReadmeTemplateId: null,
    insertSnippetSignal: null,
    telegramChecking: false,
    telegramReady: false,
    locked: false,
    formDisabled: false,
    processStatusText: "",
    readinessDoneCount: 0,
    requiredReadinessItems: [],
    readinessPercent: 0,
    setChecklist: jest.fn(),
    insertReadmeTemplate: jest.fn(),
    handleSnippetInserted: jest.fn(),
    onWorkspaceFilePicked: jest.fn(),
    addWorkspaceBootstrapFile: jest.fn(),
    removeWorkspaceBootstrapFile: jest.fn(),
    submit: jest.fn(),
  })),
}));

jest.mock("../components/ReadmeTemplateGrid", () => ({
  __esModule: true,
  default: () => <div data-testid="readme-template-grid" />,
}));

jest.mock("../components/WorkspaceUploadSection", () => ({
  __esModule: true,
  default: () => <div data-testid="workspace-upload-section" />,
}));

jest.mock("../components/QualityGateSection", () => ({
  __esModule: true,
  default: () => <div data-testid="quality-gate-section" />,
}));

import NewValidationCaseClient from "../NewValidationCaseClient";

describe("NewValidationCaseClient", () => {
  it("renders without crashing", () => {
    const { container } = render(<NewValidationCaseClient />);
    expect(container).toBeTruthy();
  });
});
