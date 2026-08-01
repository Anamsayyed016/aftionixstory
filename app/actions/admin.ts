"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/admin/access";
import { prisma } from "@/lib/db";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/users");
  revalidatePath("/admin/generations");
}

export async function adminVerifyBusinessAction(businessId: string) {
  await requireAdminAction();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) throw new Error("Business not found");

  await prisma.business.update({
    where: { id: businessId },
    data: { verifiedAt: new Date() },
  });
  revalidateAdmin();
  if (business.slug) revalidatePath(`/b/${business.slug}`);
}

export async function adminUnverifyBusinessAction(businessId: string) {
  await requireAdminAction();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) throw new Error("Business not found");

  await prisma.business.update({
    where: { id: businessId },
    data: { verifiedAt: null },
  });
  revalidateAdmin();
  if (business.slug) revalidatePath(`/b/${business.slug}`);
}

export async function adminRemoveBusinessAction(businessId: string) {
  await requireAdminAction();
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) throw new Error("Business not found");

  await prisma.business.delete({ where: { id: businessId } });
  revalidateAdmin();
  if (business.slug) revalidatePath(`/b/${business.slug}`);
}
