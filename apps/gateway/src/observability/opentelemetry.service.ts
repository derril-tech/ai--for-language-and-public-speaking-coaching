import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { trace, metrics, context, SpanStatusCode } from '@opentelemetry/api';

export interface TracingConfig {
  enabled: boolean;
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  environment: string;
}

export interface MetricsConfig {
  enabled: boolean;
  endpoint: string;
  exportInterval: number;
}

@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenTelemetryService.name);
  private sdk: NodeSDK | null = null;
  private tracer = trace.getTracer('ai-coaching-gateway');
  private meter = metrics.getMeter('ai-coaching-gateway');

  // Counters
  private requestCounter: any;
  private errorCounter: any;
  private processingTimeHistogram: any;
  private activeConnectionsGauge: any;

  // Spans
  private createSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, { attributes });
  }

  async onModuleInit() {
    if (process.env.OTEL_ENABLED === 'true') {
      await this.initializeOpenTelemetry();
    } else {
      this.logger.log('OpenTelemetry disabled');
    }
  }

  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }

  private async initializeOpenTelemetry() {
    try {
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'ai-coaching-gateway',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      });

      const traceExporter = new OTLPTraceExporter({
        url: process.env.OTEL_TRACE_ENDPOINT || 'http://localhost:4318/v1/traces',
      });

      const metricExporter = new OTLPMetricExporter({
        url: process.env.OTEL_METRIC_ENDPOINT || 'http://localhost:4318/v1/metrics',
      });

      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader: new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: parseInt(process.env.OTEL_EXPORT_INTERVAL || '10000'),
        }),
        spanProcessor: new BatchSpanProcessor(traceExporter),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {
              ignoreIncomingPaths: ['/health', '/metrics'],
            },
            '@opentelemetry/instrumentation-express': {
              ignoreLayers: ['middleware - express'],
            },
          }),
        ],
      });

      await this.sdk.start();
      this.initializeMetrics();
      this.logger.log('OpenTelemetry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry:', error);
    }
  }

  private initializeMetrics() {
    // Request counter
    this.requestCounter = this.meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    });

    // Error counter
    this.errorCounter = this.meter.createCounter('http_errors_total', {
      description: 'Total number of HTTP errors',
    });

    // Processing time histogram
    this.processingTimeHistogram = this.meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP request duration in seconds',
      unit: 's',
    });

    // Active connections gauge
    this.activeConnectionsGauge = this.meter.createUpDownCounter('websocket_connections_active', {
      description: 'Number of active WebSocket connections',
    });

    // Worker processing metrics
    this.meter.createHistogram('worker_processing_duration_seconds', {
      description: 'Worker processing duration in seconds',
      unit: 's',
    });

    this.meter.createCounter('worker_processing_total', {
      description: 'Total number of worker processing events',
    });

    this.meter.createCounter('worker_processing_errors_total', {
      description: 'Total number of worker processing errors',
    });
  }

  // Tracing methods
  traceAsync<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, any>): Promise<T> {
    const span = this.createSpan(name, attributes);
    const ctx = trace.setSpan(context.active(), span);

    return context.with(ctx, async () => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  traceSync<T>(name: string, fn: () => T, attributes?: Record<string, any>): T {
    const span = this.createSpan(name, attributes);
    const ctx = trace.setSpan(context.active(), span);

    return context.with(ctx, () => {
      try {
        const result = fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  addSpanEvent(name: string, attributes?: Record<string, any>) {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  setSpanAttribute(key: string, value: any) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  // Metrics methods
  recordRequest(method: string, path: string, statusCode: number, duration: number) {
    if (this.requestCounter) {
      this.requestCounter.add(1, {
        method,
        path,
        status_code: statusCode.toString(),
      });
    }

    if (this.processingTimeHistogram) {
      this.processingTimeHistogram.record(duration / 1000, {
        method,
        path,
        status_code: statusCode.toString(),
      });
    }
  }

  recordError(method: string, path: string, errorType: string) {
    if (this.errorCounter) {
      this.errorCounter.add(1, {
        method,
        path,
        error_type: errorType,
      });
    }
  }

  recordWorkerProcessing(workerType: string, duration: number, success: boolean) {
    const histogram = this.meter.createHistogram('worker_processing_duration_seconds', {
      description: 'Worker processing duration in seconds',
      unit: 's',
    });

    const counter = this.meter.createCounter('worker_processing_total', {
      description: 'Total number of worker processing events',
    });

    const errorCounter = this.meter.createCounter('worker_processing_errors_total', {
      description: 'Total number of worker processing errors',
    });

    histogram.record(duration / 1000, { worker_type: workerType });
    counter.add(1, { worker_type: workerType });

    if (!success) {
      errorCounter.add(1, { worker_type: workerType });
    }
  }

  updateWebSocketConnections(count: number) {
    if (this.activeConnectionsGauge) {
      this.activeConnectionsGauge.add(count);
    }
  }

  // Session-specific metrics
  recordSessionEvent(eventType: string, sessionId: string, metadata?: Record<string, any>) {
    const counter = this.meter.createCounter('session_events_total', {
      description: 'Total number of session events',
    });

    counter.add(1, {
      event_type: eventType,
      session_id: sessionId,
      ...metadata,
    });
  }

  recordSessionDuration(sessionId: string, duration: number) {
    const histogram = this.meter.createHistogram('session_duration_seconds', {
      description: 'Session duration in seconds',
      unit: 's',
    });

    histogram.record(duration / 1000, { session_id: sessionId });
  }

  // Cache metrics
  recordCacheHit(cacheType: string) {
    const counter = this.meter.createCounter('cache_hits_total', {
      description: 'Total number of cache hits',
    });

    counter.add(1, { cache_type: cacheType });
  }

  recordCacheMiss(cacheType: string) {
    const counter = this.meter.createCounter('cache_misses_total', {
      description: 'Total number of cache misses',
    });

    counter.add(1, { cache_type: cacheType });
  }

  recordCacheOperation(operation: string, cacheType: string, duration: number) {
    const histogram = this.meter.createHistogram('cache_operation_duration_seconds', {
      description: 'Cache operation duration in seconds',
      unit: 's',
    });

    histogram.record(duration / 1000, {
      operation,
      cache_type: cacheType,
    });
  }

  // Database metrics
  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean) {
    const histogram = this.meter.createHistogram('database_query_duration_seconds', {
      description: 'Database query duration in seconds',
      unit: 's',
    });

    const counter = this.meter.createCounter('database_queries_total', {
      description: 'Total number of database queries',
    });

    const errorCounter = this.meter.createCounter('database_errors_total', {
      description: 'Total number of database errors',
    });

    histogram.record(duration / 1000, {
      operation,
      table,
    });

    counter.add(1, {
      operation,
      table,
    });

    if (!success) {
      errorCounter.add(1, {
        operation,
        table,
      });
    }
  }

  // External API metrics
  recordExternalApiCall(service: string, endpoint: string, duration: number, statusCode: number) {
    const histogram = this.meter.createHistogram('external_api_duration_seconds', {
      description: 'External API call duration in seconds',
      unit: 's',
    });

    const counter = this.meter.createCounter('external_api_calls_total', {
      description: 'Total number of external API calls',
    });

    const errorCounter = this.meter.createCounter('external_api_errors_total', {
      description: 'Total number of external API errors',
    });

    histogram.record(duration / 1000, {
      service,
      endpoint,
      status_code: statusCode.toString(),
    });

    counter.add(1, {
      service,
      endpoint,
      status_code: statusCode.toString(),
    });

    if (statusCode >= 400) {
      errorCounter.add(1, {
        service,
        endpoint,
        status_code: statusCode.toString(),
      });
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.sdk) {
        return true; // OpenTelemetry not enabled
      }
      
      // Check if SDK is running
      return this.sdk.isStarted();
    } catch (error) {
      this.logger.error('OpenTelemetry health check failed:', error);
      return false;
    }
  }

  // Get current trace ID
  getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId;
  }

  // Get current span ID
  getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().spanId;
  }
}
