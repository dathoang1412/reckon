import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RequestLoggerMiddleware } from "./common/request-logger.middleware";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SyncModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
