import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  health() {
    return {
      status: "ok",
      service: "ticketly-api",
      time: new Date().toISOString(),
    };
  }
}
