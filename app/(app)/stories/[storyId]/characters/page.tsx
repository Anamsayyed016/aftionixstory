import { redirect } from "next/navigation";

/** Story Studio UI offline → hub (characters manager included). */
export default async function CharactersPage() {
  redirect("/home");
}
