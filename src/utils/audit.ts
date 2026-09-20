import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";

export const writeAuditLog = async (
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue
) => {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId: entityId ?? null,
      ...(metadata !== undefined ? { metadata } : {})
    }
  });
};