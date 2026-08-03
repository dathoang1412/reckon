import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { syncPullRequestSchema, syncPushRequestSchema, type SyncPullResponse } from "@reckon/shared";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { SyncService } from "./sync.service";

@Controller("sync")
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("push")
  async push(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const parsed = syncPushRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.syncService.push(parsed.data.changes, req.userId, parsed.data.deviceId);
    return { applied: parsed.data.changes.length };
  }

  @Post("pull")
  async pull(@Body() body: unknown, @Req() req: AuthenticatedRequest): Promise<SyncPullResponse> {
    const parsed = syncPullRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const changes = await this.syncService.pull(parsed.data.deviceId, parsed.data.since, req.userId);
    return { changes, serverTime: new Date().toISOString() };
  }
}
