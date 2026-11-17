import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ScanModule } from './scan/scan.module';

@Module({
  imports: [
    // Phishing demo pages under /demo/*
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'demo-pages'),
      serveRoot: '/demo',
    }),
    // Built React app at /
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
    }),
    ScanModule,
  ],
})
export class AppModule {}
