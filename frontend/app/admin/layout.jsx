import AdminLayoutClient from "./AdminLayoutClient";

export const metadata = {
  title: "Admin Panel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
