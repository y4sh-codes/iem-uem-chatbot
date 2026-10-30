"use client";

import dynamic from "next/dynamic";

// The admin portal reads sessionStorage during render, so render it only in
// the browser. This also keeps the page safe to prerender on Vercel.
const AdminApp = dynamic(() => import("@/admin/AdminApp"), {
  ssr: false,
  loading: () => null,
});

export default function AdminPage() {
  return <AdminApp />;
}
