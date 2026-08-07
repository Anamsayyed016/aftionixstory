import { redirect } from "next/navigation";

/** Story Studio UI offline → hub. */
export default async function EpisodePage() {
  redirect("/home");
}
