import { requireUser } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { CreateHub } from "@/components/app/create/create-hub";

export default async function CreatePage() {
  const user = await requireUser();
  let recentStories: Array<{ id: string; title: string; genre: string }> = [];

  try {
    const stats = await getDashboardStats(user.id);
    recentStories = stats.recentStories.slice(0, 3).map((story) => ({
      id: story.id,
      title: story.title,
      genre: story.genre,
    }));
  } catch {
    recentStories = [];
  }

  return <CreateHub recentStories={recentStories} />;
}
