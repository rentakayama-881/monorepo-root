import { render } from "@testing-library/react";

jest.mock("next/link", () => {
  return function MockLink({ children, ...props }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ id: "123" })),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  })),
}));

jest.mock("@/components/ui/TagPill", () => ({
  TagList: (props) => <div data-testid="tag-list" />,
}));

jest.mock("@/lib/featureApi", () => ({
  FEATURE_ENDPOINTS: {},
  fetchFeature: jest.fn(),
  fetchFeatureAuth: jest.fn(),
}));

jest.mock("@/lib/format", () => ({
  formatDateTime: jest.fn(() => "01 Jan 2024 12:00"),
}));

jest.mock("@/lib/validationCaseWorkflow", () => ({
  isWorkspaceValidationCase: jest.fn(() => false),
}));

jest.mock("../ValidationCaseRecordSkeleton", () => ({
  __esModule: true,
  default: () => <div data-testid="record-skeleton" />,
}));

jest.mock("../WorkspaceModeView", () => ({
  __esModule: true,
  default: () => <div data-testid="workspace-mode-view" />,
}));

jest.mock("../components/validationCaseDetailUtils", () => ({
  normalizeStatus: jest.fn(() => "open"),
  sensitivityMeta: jest.fn(() => ({ level: "S1", label: "Terbatas" })),
  looksLikeMarkdownText: jest.fn(() => false),
  markdownToSafeHtml: jest.fn(() => ""),
  normalizeCompletionChecklist: jest.fn(() => []),
  normalizeVcData: jest.fn((d) => d || {}),
  normalizeCaseLog: jest.fn(() => []),
  normalizeFieldChangeEvents: jest.fn(() => []),
  normalizeConsultation: jest.fn(() => null),
}));

jest.mock("../components/CaseSharedComponents", () => ({
  StatusBadge: (props) => <span data-testid="status-badge" />,
  CaseSection: ({ children, ...props }) => <div data-testid="case-section">{children}</div>,
}));

jest.mock("../components/CaseLogPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="case-log-panel" />,
}));

jest.mock("../components/CaseMetadataSidebar", () => ({
  __esModule: true,
  default: () => <div data-testid="case-metadata-sidebar" />,
}));

jest.mock("../components/ContentTable", () => {
  const ContentTable = () => <div data-testid="content-table" />;
  ContentTable.extractCaseRecordText = jest.fn(() => "");
  ContentTable.hasOverviewContent = jest.fn(() => false);
  return {
    __esModule: true,
    default: ContentTable,
    extractCaseRecordText: jest.fn(() => ""),
    hasOverviewContent: jest.fn(() => false),
  };
});

jest.mock("../components/ConsultationPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="consultation-panel" />,
}));

jest.mock("../components/FinalOffersPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="final-offers-panel" />,
}));

jest.mock("../components/EscrowPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="escrow-panel" />,
}));

jest.mock("../components/ValidatorResultPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="validator-result-panel" />,
}));

jest.mock("../components/DisputeAndReleasePanel", () => ({
  __esModule: true,
  default: () => <div data-testid="dispute-release-panel" />,
}));

jest.mock("../components/useValidationCaseWorkflow", () => ({
  useValidationCaseWorkflow: jest.fn(() => ({
    vc: null,
    me: null,
    loading: true,
    error: null,
    status: "open",
    sensitivity: { level: "S1", label: "Terbatas" },
    owner: null,
    ownerHandle: "",
    filedAtLabel: "",
    caseReadmeMarkdown: "",
    consultation: null,
    finalOffers: [],
    escrow: null,
    validatorResult: null,
    disputeRelease: null,
    caseLog: [],
  })),
}));

import ValidationCaseRecordPage from "../ValidationCaseDetailClient";

describe("ValidationCaseDetailClient", () => {
  it("renders without crashing", () => {
    const { container } = render(<ValidationCaseRecordPage />);
    expect(container).toBeTruthy();
  });

  it("renders with initialCaseData", () => {
    const { container } = render(
      <ValidationCaseRecordPage initialCaseData={{ id: 123, title: "Test", status: "open" }} />
    );
    expect(container).toBeTruthy();
  });
});
