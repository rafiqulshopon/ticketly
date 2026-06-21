import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All app routes live under /api; health stays at the root.
  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? "http://localhost:5173").split(","),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("Ticketly API")
    .setDescription("AI-powered ticket management system")
    .setVersion("0.1.0")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Ticketly API on http://localhost:${port}  (docs: http://localhost:${port}/api/docs)`);
}

bootstrap();
