import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser } from 'playwright';
import { runInPageDetection, PageScanResult } from './detect.page';

export interface ScanReport {
  url: string;
  finalUrl: string;
  scannedAt: string;
  durationMs: number;
  page: PageScanResult | null;
  screenshot: string | null; // data URL
  annotatedScreenshot: string | null; // data URL with suspicious fields outlined
  risk: {
    score: number; // 0-100
    level: 'none' | 'low' | 'medium' | 'high';
    reasons: string[];
  };
  error?: string;
}

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) return this.browser;
    if (!this.launching) {
      this.launching = chromium
        .launch({
          headless: true,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        })
        .then((b) => (this.browser = b))
        .finally(() => (this.launching = null));
    }
    return this.launching;
  }

  async scan(url: string): Promise<ScanReport> {
    const started = Date.now();
    const report: ScanReport = {
      url,
      finalUrl: url,
      scannedAt: new Date().toISOString(),
      durationMs: 0,
      page: null,
      screenshot: null,
      annotatedScreenshot: null,
      risk: { score: 0, level: 'none', reasons: [] },
    };

    const browser = await this.getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    try {
      const page = await context.newPage();
      page.setDefaultTimeout(20000);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // give client-side scripts a moment to inject hidden fields
      await page.waitForTimeout(1200);
      report.finalUrl = page.url();

      // 1) screenshot of the page as a user sees it
      const shot = await page.screenshot({ type: 'png', fullPage: false });
      report.screenshot = 'data:image/png;base64,' + shot.toString('base64');

      // 2) run detection + simulated autofill in the page
      report.page = await page.evaluate(runInPageDetection);

      // 3) annotated screenshot: outline every autofill-relevant field
      await page.evaluate((fields) => {
        const overlay = document.createElement('div');
        overlay.id = '__ag_overlay';
        document.body.appendChild(overlay);
        for (const f of fields) {
          const box = document.createElement('div');
          box.style.cssText = `position:absolute;z-index:2147483647;pointer-events:none;` +
            `left:${f.rect.x + window.scrollX - 3}px;top:${f.rect.y + window.scrollY - 3}px;` +
            `width:${Math.max(f.rect.width, 10) + 6}px;height:${Math.max(f.rect.height, 10) + 6}px;` +
            `border:3px solid ${f.hidden ? '#e11d48' : '#16a34a'};border-radius:3px;` +
            `background:${f.hidden ? 'rgba(225,29,72,.12)' : 'rgba(22,163,74,.08)'};`;
          const tag = document.createElement('div');
          tag.textContent = `${f.hidden ? 'HIDDEN' : 'visible'} · ${f.token || f.name || f.type}`;
          tag.style.cssText =
            'position:absolute;top:-22px;left:-3px;background:' +
            (f.hidden ? '#e11d48' : '#16a34a') +
            ';color:#fff;font:11px monospace;padding:2px 6px;border-radius:3px;white-space:nowrap;';
          box.appendChild(tag);
          overlay.appendChild(box);
        }
      }, report.page.fields.map((f) => ({ rect: f.rect, hidden: f.hidden, token: f.token, name: f.name, type: f.type })));
      const annotated = await page.screenshot({ type: 'png', fullPage: false });
      report.annotatedScreenshot = 'data:image/png;base64,' + annotated.toString('base64');

      report.risk = this.scoreRisk(report.page);
    } catch (err: any) {
      this.logger.warn(`scan failed for ${url}: ${err?.message}`);
      report.error = String(err?.message || err);
    } finally {
      await context.close().catch(() => undefined);
      report.durationMs = Date.now() - started;
    }
    return report;
  }

  private scoreRisk(page: PageScanResult): ScanReport['risk'] {
    const reasons: string[] = [];
    let score = 0;

    const hiddenSensitive = page.fields.filter((f) => f.hidden && f.sensitive);
    const hiddenOther = page.fields.filter((f) => f.hidden && !f.sensitive);

    if (hiddenSensitive.length) {
      score += hiddenSensitive.length * 30;
      const tokens = [...new Set(hiddenSensitive.map((f) => f.token))].join(', ');
      reasons.push(
        `${hiddenSensitive.length} hidden field(s) requesting sensitive autofill data (${tokens})`,
      );
    }
    if (hiddenOther.length) {
      score += hiddenOther.length * 10;
      reasons.push(`${hiddenOther.length} other hidden autofill field(s)`);
    }

    const capturedHidden = page.fields.filter((f) => f.hidden && f.capturedValue);
    if (capturedHidden.length) {
      score += 15;
      reasons.push(
        `simulated autofill filled ${capturedHidden.length} hidden field(s) — data would leave with the form`,
      );
    }

    const techniques = new Set<string>();
    for (const f of page.fields) for (const s of f.hidingSignals) techniques.add(s.split(' ')[0]);
    if (techniques.size > 1) {
      score += 10;
      reasons.push(`multiple hiding techniques used (${techniques.size} distinct)`);
    }

    score = Math.min(100, score);
    const level: ScanReport['risk']['level'] =
      score === 0 ? 'none' : score < 25 ? 'low' : score < 60 ? 'medium' : 'high';
    if (!reasons.length) reasons.push('no hidden autofill traps detected');
    return { score, level, reasons };
  }

  async onModuleDestroy() {
    if (this.browser) await this.browser.close().catch(() => undefined);
  }
}
