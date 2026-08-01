import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { syncPullRequestSchema, syncPushRequestSchema, type SyncPullResponse } from "@reckon/shared";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("push")
  async push(@Body() body: unknown) {
    const parsed = syncPushRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.syncService.push(parsed.data.changes);
    return { applied: parsed.data.changes.length };
  }

  @Post("pull")
  async pull(@Body() body: unknown): Promise<SyncPullResponse> {
    const parsed = syncPullRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const changes = await this.syncService.pull(parsed.data.deviceId, parsed.data.since);
    return { changes, serverTime: new Date().toISOString() };
  }
}
