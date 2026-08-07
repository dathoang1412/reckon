import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

// Express's default body-parser limit is 100kb — comfortably big enough
// for auth/profile requests, but sync/push (see sync.controller.ts) sends
// every locally-changed vocab entry (aiExamples, definitions, notes, …) in
// one JSON body, which a library with even a few hundred entries blows
// past easily, failing every push with a 413 PayloadTooLargeError.
const BODY_LIMIT = "20mb";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
  app.enableCors();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`reckon server listening on :${port}`);
}
bootstrap();
