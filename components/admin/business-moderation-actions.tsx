"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  adminRemoveBusinessAction,
  adminUnverifyBusinessAction,
  adminVerifyBusinessAction,
} from "@/app/actions/admin";

export function BusinessModerationActions({
  businessId,
  verified,
  name,
}: {
  businessId: string;
  verified: boolean;
  name: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {verified ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await adminUnverifyBusinessAction(businessId);
            })
          }
        >
          Unverify
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await adminVerifyBusinessAction(businessId);
            })
          }
        >
          Verify
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Remove listing “${name}”? This deletes the business and its gigs.`
            )
          ) {
            return;
          }
          start(async () => {
            await adminRemoveBusinessAction(businessId);
          });
        }}
      >
        Remove
      </Button>
    </div>
  );
}
