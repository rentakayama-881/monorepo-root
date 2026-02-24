import RepoWorkflowClient from "./RepoWorkflowClient";

export const metadata = {
  title: "Evidence Validation Workspace",
  robots: { index: false, follow: false },
};

export default function ValidationCaseRepoPage() {
  return <RepoWorkflowClient />;
}
