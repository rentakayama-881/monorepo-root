import RepoWorkflowClient from "./RepoWorkflowClient";

export const metadata = {
  title: "Validation Case Repo Workflow",
  robots: { index: false, follow: false },
};

export default function ValidationCaseRepoPage() {
  return <RepoWorkflowClient />;
}

