import { redirect } from "next/navigation";

/** Chat UI offline during Story Studio rebuild → hub. */
export default function DashboardPage() {
  redirect("/home");
}
