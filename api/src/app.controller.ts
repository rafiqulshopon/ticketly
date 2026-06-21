import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller("health")
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get()
  health() {
    return this.app.health();
  }
}
