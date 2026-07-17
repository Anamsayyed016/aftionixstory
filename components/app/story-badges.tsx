import { Badge } from "@/components/ui/badge";

export function StoryStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "DRAFT") return <Badge variant="warning">Draft</Badge>;
  return <Badge variant="outline">Archived</Badge>;
}

export function StoryVisibilityBadge({ visibility }: { visibility: string }) {
  if (visibility === "PUBLIC") return <Badge variant="violet">Public</Badge>;
  if (visibility === "UNLISTED") return <Badge variant="rose">Unlisted</Badge>;
  return <Badge variant="outline">Private</Badge>;
}
