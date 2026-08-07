import { redirect } from "next/navigation";

/** Story Studio UI offline → hub. */
export default function StoriesPage() {
  redirect("/home");
}
