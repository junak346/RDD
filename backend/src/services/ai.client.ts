/**
 * HTTP client for the Python/FastAPI inference service.
 *
 * Contract: POST {AI_SERVICE_URL}/predict (multipart, field "file")
 * → typed PredictionPayload. Failures map to explicit API errors — the
 * backend never fabricates detections when the AI service is unavailable.
 */
import { config } from '../config';
import { errors } from '../utils/errors';
import { logger } from '../utils/logger';
import { DetectionRecord, ModelInfoRecord, Severity } from '../types/domain';

export interface AiPrediction {
  demo: boolean;
  model: ModelInfoRecord;
  image: { width: number; height: number; format: string };
  detections: DetectionRecord[];
  summary: {
    detectionCount: number;
    countsByClass: Record<string, number>;
    countsBySeverity: Record<string, number>;
    maxSeverity: Severity | null;
  };
  processingTimeMs: number;
  annotatedImageBase64: string;
  warnings: string[];
}

interface RawDetection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  severity: string;
  severity_score: number;
  area_ratio: number;
}

/** Untyped wire format from the Python service (mapped below). */
interface RawPrediction {
  success: boolean;
  demo: boolean;
  model: {
    name: string;
    version: string;
    engine: string;
    device: string;
    demo: boolean;
    confidence_threshold: number;
    iou_threshold: number;
  };
  image: { width: number; height: number; format: string };
  detections: RawDetection[];
  summary: {
    detection_count: number;
    counts_by_class: Record<string, number>;
    counts_by_severity: Record<string, number>;
    max_severity: string | null;
  };
  processing_time_ms: number;
  annotated_image_base64: string;
  warnings: string[];
}

function mapDetection(raw: RawDetection): DetectionRecord {
  return {
    classId: raw.class_id,
    className: raw.class_name,
    confidence: raw.confidence,
    severity: raw.severity as Severity,
    severityScore: raw.severity_score,
    areaRatio: raw.area_ratio,
    bbox: raw.bbox,
  };
}

export interface AiHealth {
  status: string;
  mode: string;
  engine: string | null;
  modelLoaded: boolean;
  demo: boolean;
}

export class AiClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl: string = config.aiServiceUrl, timeoutMs: number = config.aiTimeoutMs) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  /** Re-point the client (used by tests to target a stub server). */
  configure(baseUrl: string, timeoutMs?: number): void {
    this.baseUrl = baseUrl;
    if (timeoutMs !== undefined) this.timeoutMs = timeoutMs;
  }

  async predict(image: Buffer, filename: string, mimeType: string): Promise<AiPrediction> {
    const form = new FormData();
    form.append('file', new Blob([image], { type: mimeType }), filename);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      logger.error({ reason }, 'AI service request failed');
      throw errors.aiUnavailable(
        'The AI analysis service is currently unavailable — please try again later.',
      );
    }

    if (response.status === 503) {
      throw errors.aiUnavailable(
        'The AI model is not installed on the inference service. See docs/AI_MODEL.md.',
      );
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error({ status: response.status, body: body.slice(0, 500) }, 'AI service error');
      if (response.status === 400 || response.status === 413 || response.status === 422) {
        throw errors.invalidImage('The AI service rejected the image as invalid.');
      }
      throw errors.aiInvalidResponse();
    }

    const payload = (await response.json()) as RawPrediction;
    if (!payload || payload.success !== true || !Array.isArray(payload.detections)) {
      logger.error('AI service returned unexpected schema');
      throw errors.aiInvalidResponse();
    }

    return {
      demo: Boolean(payload.demo),
      model: {
        name: payload.model.name,
        version: payload.model.version,
        engine: payload.model.engine,
        device: payload.model.device,
        demo: Boolean(payload.model.demo),
        confidenceThreshold: payload.model.confidence_threshold,
        iouThreshold: payload.model.iou_threshold,
      },
      image: payload.image,
      detections: payload.detections.map(mapDetection),
      summary: {
        detectionCount: payload.summary.detection_count,
        countsByClass: payload.summary.counts_by_class,
        countsBySeverity: payload.summary.counts_by_severity,
        maxSeverity: (payload.summary.max_severity ?? null) as Severity | null,
      },
      processingTimeMs: payload.processing_time_ms,
      annotatedImageBase64: payload.annotated_image_base64 ?? '',
      warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    };
  }

  async health(): Promise<AiHealth | null> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        status: string;
        mode: string;
        engine: string | null;
        model_loaded: boolean;
        demo: boolean;
      };
      return {
        status: payload.status,
        mode: payload.mode,
        engine: payload.engine ?? null,
        modelLoaded: Boolean(payload.model_loaded),
        demo: Boolean(payload.demo),
      };
    } catch {
      return null;
    }
  }
}

export const aiClient = new AiClient();

/** Test hook — point the process-wide AI client at a stub/other endpoint. */
export function setAiClientTarget(baseUrl: string, timeoutMs?: number): void {
  aiClient.configure(baseUrl, timeoutMs);
}
