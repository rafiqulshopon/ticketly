import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { AppService } from "./app.service";

@Controller("health")
export class AppController {
  constructor(private readonly app: AppService) {}

  @AllowAnonymous()
  @Get()
  health() {
    return this.app.health();
  }
}
