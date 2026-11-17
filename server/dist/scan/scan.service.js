"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ScanService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanService = void 0;
const common_1 = require("@nestjs/common");
const playwright_1 = require("playwright");
const detect_page_1 = require("./detect.page");
let ScanService = ScanService_1 = class ScanService {
    logger = new common_1.Logger(ScanService_1.name);
    browser = null;
    launching = null;
    async getBrowser() {
        if (this.browser && this.browser.isConnected())
            return this.browser;
        if (!this.launching) {
            this.launching = playwright_1.chromium
                .launch({
                headless: true,
                args: ['--no-sandbox', '--disable-dev-shm-usage'],
            })
                .then((b) => (this.browser = b))
                .finally(() => (this.launching = null));
        }
        return this.launching;
    }
    async scan(url) {
        const started = Date.now();
        const report = {
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
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            ignoreHTTPSErrors: true,
        });
        try {
            const page = await context.newPage();
            page.setDefaultTimeout(20000);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1200);
            report.finalUrl = page.url();
            const shot = await page.screenshot({ type: 'png', fullPage: false });
            report.screenshot = 'data:image/png;base64,' + shot.toString('base64');
            report.page = await page.evaluate(detect_page_1.runInPageDetection);
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
        }
        catch (err) {
            this.logger.warn(`scan failed for ${url}: ${err?.message}`);
            report.error = String(err?.message || err);
        }
        finally {
            await context.close().catch(() => undefined);
            report.durationMs = Date.now() - started;
        }
        return report;
    }
    scoreRisk(page) {
        const reasons = [];
        let score = 0;
        const hiddenSensitive = page.fields.filter((f) => f.hidden && f.sensitive);
        const hiddenOther = page.fields.filter((f) => f.hidden && !f.sensitive);
        if (hiddenSensitive.length) {
            score += hiddenSensitive.length * 30;
            const tokens = [...new Set(hiddenSensitive.map((f) => f.token))].join(', ');
            reasons.push(`${hiddenSensitive.length} hidden field(s) requesting sensitive autofill data (${tokens})`);
        }
        if (hiddenOther.length) {
            score += hiddenOther.length * 10;
            reasons.push(`${hiddenOther.length} other hidden autofill field(s)`);
        }
        const capturedHidden = page.fields.filter((f) => f.hidden && f.capturedValue);
        if (capturedHidden.length) {
            score += 15;
            reasons.push(`simulated autofill filled ${capturedHidden.length} hidden field(s) — data would leave with the form`);
        }
        const techniques = new Set();
        for (const f of page.fields)
            for (const s of f.hidingSignals)
                techniques.add(s.split(' ')[0]);
        if (techniques.size > 1) {
            score += 10;
            reasons.push(`multiple hiding techniques used (${techniques.size} distinct)`);
        }
        score = Math.min(100, score);
        const level = score === 0 ? 'none' : score < 25 ? 'low' : score < 60 ? 'medium' : 'high';
        if (!reasons.length)
            reasons.push('no hidden autofill traps detected');
        return { score, level, reasons };
    }
    async onModuleDestroy() {
        if (this.browser)
            await this.browser.close().catch(() => undefined);
    }
};
exports.ScanService = ScanService;
exports.ScanService = ScanService = ScanService_1 = __decorate([
    (0, common_1.Injectable)()
], ScanService);
