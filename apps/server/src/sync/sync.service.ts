import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/client";
import type { SyncChange } from "@reckon/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async push(changes: SyncChange[]): Promise<void> {
    for (const change of changes) {
      const existing = await this.prisma.syncRecord.findUnique({
        where: { kind_recordId: { kind: change.kind, recordId: change.id } },
      });

      // Last-write-wins: only apply the incoming change if it is newer
      // than what the server already has (tie-break on deviceId so
      // every replica converges on the same winner).
      const incomingWins =
        !existing ||
        change.updatedAt > existing.updatedAt.toISOString() ||
        (change.updatedAt === existing.updatedAt.toISOString() && change.deviceId >= existing.deviceId);

      if (!incomingWins) continue;

      await this.prisma.syncRecord.upsert({
        where: { kind_recordId: { kind: change.kind, recordId: change.id } },
        create: {
          kind: change.kind,
          recordId: change.id,
          deviceId: change.deviceId,
          updatedAt: new Date(change.updatedAt),
          deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
          data: change.data as Prisma.InputJsonValue,
        },
        update: {
          deviceId: change.deviceId,
          updatedAt: new Date(change.updatedAt),
          deletedAt: change.deletedAt ? new Date(change.deletedAt) : null,
          data: change.data as Prisma.InputJsonValue,
        },
      });
    }
  }

  async pull(deviceId: string, since: string | null): Promise<SyncChange[]> {
    const records = await this.prisma.syncRecord.findMany({
      where: {
        deviceId: { not: deviceId },
        ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { updatedAt: "asc" },
    });

    return records.map((r) => ({
      kind: r.kind as SyncChange["kind"],
      id: r.recordId,
      updatedAt: r.updatedAt.toISOString(),
      deviceId: r.deviceId,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      data: r.data as Record<string, unknown>,
    }));
  }
}
