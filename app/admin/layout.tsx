import type { ReactNode } from "react";
import AdminNav from "./AdminNav";
import styles from "./admin.module.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AdminNav />
      {children}
    </div>
  );
}
