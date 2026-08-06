"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./admin.module.css";

export function AdminLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      className={styles.logout}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/admin/v1/auth/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
      type="button"
    >
      {pending ? "正在退出…" : "退出"}
    </button>
  );
}
