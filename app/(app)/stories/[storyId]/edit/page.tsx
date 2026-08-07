import { redirect } from "next/navigation";

/** Story Studio UI offline → hub. */
export default async function EditStoryPage() {
  redirect("/home");
}
