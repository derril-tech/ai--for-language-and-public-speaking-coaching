import { Injectable, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as rateLimit from 'express-rate-limit';
import * as helmet from 'helmet';
import * as cors from 'cors';
import * as csrf from 'csurf';
import { v4 as uuidv4 } from 'uuid';

export interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  csrf: {
    cookie: boolean;
    ignoreMethods: string[];
  };
  csp: {
    directives: Record<string, any>;
  };
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly securityConfig: SecurityConfig;

  constructor() {
    this.securityConfig = {
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
      },
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
          'X-API-Key',
          'Idempotency-Key',
          'Request-ID',
        ],
      },
      csrf: {
        cookie: true,
        ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
      },
      csp: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    };
  }

  // Rate limiting middleware
  createRateLimiter(options?: Partial<SecurityConfig['rateLimit']>) {
    const config = { ...this.securityConfig.rateLimit, ...options };
    
    return rateLimit(config);
  }

  // CORS middleware
  createCorsMiddleware(options?: Partial<SecurityConfig['cors']>) {
    const config = { ...this.securityConfig.cors, ...options };
    
    return cors(config);
  }

  // CSRF protection middleware
  createCsrfMiddleware(options?: Partial<SecurityConfig['csrf']>) {
    const config = { ...this.securityConfig.csrf, ...options };
    
    return csrf(config);
  }

  // Helmet middleware for security headers
  createHelmetMiddleware() {
    return helmet({
      contentSecurityPolicy: {
        directives: this.securityConfig.csp.directives,
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
  }

  // Request ID middleware
  createRequestIdMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || uuidv4();
      req.headers['x-request-id'] = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    };
  }

  // Security headers middleware
  createSecurityHeadersMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // HSTS
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      
      // X-Content-Type-Options
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // X-Frame-Options
      res.setHeader('X-Frame-Options', 'DENY');
      
      // X-XSS-Protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Referrer Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Permissions Policy
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=()'
      );
      
      next();
    };
  }

  // API key validation middleware
  createApiKeyMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Please provide a valid API key in the X-API-Key header',
        });
      }

      // Validate API key format (basic validation)
      if (!this.isValidApiKey(apiKey)) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'The provided API key is invalid',
        });
      }

      // TODO: Add actual API key validation against database
      // For now, just check format
      next();
    };
  }

  // Input validation middleware
  createInputValidationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeInput(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeInput(req.query);
      }

      // Sanitize URL parameters
      if (req.params) {
        req.params = this.sanitizeInput(req.params);
      }

      next();
    };
  }

  // SQL injection prevention middleware
  createSqlInjectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
        /(\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
        /(--|\/\*|\*\/|xp_|sp_)/i,
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return sqlPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(checkValue);
        }
        return false;
      };

      const hasSqlInjection = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

      if (hasSqlInjection) {
        this.logger.warn(`Potential SQL injection attempt from IP: ${req.ip}`);
        return res.status(400).json({
          error: 'Invalid input',
          message: 'The request contains potentially malicious content',
        });
      }

      next();
    };
  }

  // XSS prevention middleware
  createXssPreventionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
        /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return xssPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(checkValue);
        }
        return false;
      };

      const hasXss = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

      if (hasXss) {
        this.logger.warn(`Potential XSS attempt from IP: ${req.ip}`);
        return res.status(400).json({
          error: 'Invalid input',
          message: 'The request contains potentially malicious content',
        });
      }

      next();
    };
  }

  // File upload security middleware
  createFileUploadSecurityMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const allowedMimeTypes = [
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/webm',
        'audio/ogg',
        'video/mp4',
        'video/webm',
        'video/ogg',
      ];

      const maxFileSize = 100 * 1024 * 1024; // 100MB

      if (req.file) {
        // Check file size
        if (req.file.size > maxFileSize) {
          return res.status(400).json({
            error: 'File too large',
            message: `File size must be less than ${maxFileSize / (1024 * 1024)}MB`,
          });
        }

        // Check MIME type
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Only audio and video files are allowed',
          });
        }

        // Check file extension
        const allowedExtensions = ['.wav', '.mp3', '.webm', '.ogg', '.mp4'];
        const fileExtension = req.file.originalname.toLowerCase().substring(
          req.file.originalname.lastIndexOf('.')
        );

        if (!allowedExtensions.includes(fileExtension)) {
          return res.status(400).json({
            error: 'Invalid file extension',
            message: 'File extension not allowed',
          });
        }
      }

      next();
    };
  }

  // Audit logging middleware
  createAuditLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: req.headers['x-request-id'],
          userId: (req as any).user?.id,
          organizationId: (req as any).user?.organizationId,
        };

        if (res.statusCode >= 400) {
          this.logger.warn('Request failed', logData);
        } else {
          this.logger.debug('Request completed', logData);
        }
      });

      next();
    };
  }

  // Private helper methods
  private isValidApiKey(apiKey: string): boolean {
    // Basic validation - should be 32+ characters, alphanumeric
    return /^[a-zA-Z0-9]{32,}$/.test(apiKey);
  }

  private sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    return input;
  }

  private sanitizeString(str: string): string {
    return str
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  // Get security configuration
  getSecurityConfig(): SecurityConfig {
    return this.securityConfig;
  }

  // Update security configuration
  updateSecurityConfig(updates: Partial<SecurityConfig>): void {
    Object.assign(this.securityConfig, updates);
    this.logger.log('Security configuration updated');
  }

  // Health check
  healthCheck(): boolean {
    return true; // Security service is always healthy
  }
}
