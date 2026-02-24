import WorkspaceWorkflowClient from "../repo/RepoWorkflowClient";

export const metadata = {
  title: "Evidence Validation Workspace",
  robots: { index: false, follow: false },
};

export default function ValidationCaseWorkspacePage() {
  return <WorkspaceWorkflowClient />;
}
