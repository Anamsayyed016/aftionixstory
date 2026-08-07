import { redirect } from "next/navigation";

/** Story Studio UI offline → hub. */
export default function NewStoryPage() {
  redirect("/home");
}
