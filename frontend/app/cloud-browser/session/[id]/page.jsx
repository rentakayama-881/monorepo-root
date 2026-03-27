import SessionViewerClient from "./SessionViewerClient";

export const metadata = {
  title: "Sesi Browser — Smart Browser — AIValid",
  description: "Viewer sesi browser cloud anti-detect.",
  robots: { index: false, follow: false },
};

export default function SessionPage() {
  return <SessionViewerClient />;
}
