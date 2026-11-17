"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanController = void 0;
const common_1 = require("@nestjs/common");
const scan_service_1 = require("./scan.service");
class ScanDto {
    url;
}
let ScanController = class ScanController {
    scanService;
    constructor(scanService) {
        this.scanService = scanService;
    }
    health() {
        return { ok: true, ts: Date.now() };
    }
    async scan(body) {
        const url = (body?.url || '').trim();
        if (!url)
            throw new common_1.BadRequestException('url is required');
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            throw new common_1.BadRequestException('invalid URL');
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new common_1.BadRequestException('only http(s) URLs can be scanned');
        }
        return this.scanService.scan(parsed.toString());
    }
    echo(body) {
        return {
            receivedAt: new Date().toISOString(),
            fields: body ?? {},
        };
    }
};
exports.ScanController = ScanController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ScanController.prototype, "health", null);
__decorate([
    (0, common_1.Post)('scan'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ScanDto]),
    __metadata("design:returntype", Promise)
], ScanController.prototype, "scan", null);
__decorate([
    (0, common_1.Post)('echo'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScanController.prototype, "echo", null);
exports.ScanController = ScanController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [scan_service_1.ScanService])
], ScanController);
