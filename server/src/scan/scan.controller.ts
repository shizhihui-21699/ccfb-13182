import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ScanService, ScanReport } from './scan.service';

class ScanDto {
  url: string;
}

@Controller()
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Get('health')
  health() {
    return { ok: true, ts: Date.now() };
  }

  @Post('scan')
  @HttpCode(200)
  async scan(@Body() body: ScanDto): Promise<ScanReport> {
    const url = (body?.url || '').trim();
    if (!url) throw new BadRequestException('url is required');

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('invalid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('only http(s) URLs can be scanned');
    }
    // NOTE: this is a local demo tool. Before exposing it publicly, add SSRF
    // protections (IP allow/deny lists, DNS pinning, redirect checks).
    return this.scanService.scan(parsed.toString());
  }

  /**
   * Echo endpoint used by the demo phishing pages: it simply returns whatever
   * the form posted, so the demo can show "this is what the server received".
   */
  @Post('echo')
  @HttpCode(200)
  echo(@Body() body: any) {
    return {
      receivedAt: new Date().toISOString(),
      fields: body ?? {},
    };
  }
}
