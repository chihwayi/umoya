import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const SUPPORTED = ['en', 'sn', 'nd'];

@Injectable()
export class LanguageMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const lang = (req.headers['x-language'] as string)
      ?? (req.query['lang'] as string)
      ?? 'en';
    (req as any).lang = SUPPORTED.includes(lang) ? lang : 'en';
    next();
  }
}
