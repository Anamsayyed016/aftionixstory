import { redirect } from "next/navigation";

/**
 * Legacy /create bookmarks → Story Studio hub (placeholder during rebuild).
 */
export default function CreatePage() {
  redirect("/stories");
}
