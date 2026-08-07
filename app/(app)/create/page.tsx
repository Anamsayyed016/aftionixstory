import { redirect } from "next/navigation";

/** Legacy /create bookmarks → authenticated hub during Story Studio rebuild. */
export default function CreatePage() {
  redirect("/home");
}
