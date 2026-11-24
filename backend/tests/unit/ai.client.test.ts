import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiClient } from '../../src/services/ai.client';
import { ApiError } from '../../src/utils/errors';

const VALID_AI_RESPONSE = {
  success: true,
  demo: true,
  model: {
    name: 'demo-engine',
    version: '1.0.0-demo',
    engine: 'demo',
    device: 'cpu',
    demo: true,
    classes: ['pothole', 'crack'],
    confidence_threshold: 0.35,
    iou_threshold: 0.45,
  },
  image: { width: 100, height: 80, format: 'png' },
  detections: [
    {
      class_id: 0,
      class_name: 'pothole',
      confidence: 0.91,
      bbox: { x1: 1, y1: 2, x2: 30, y2: 40 },
      severity: 'high',
      severity_score: 0.7,
      area_ratio: 0.2,
    },
  ],
  summary: {
    detection_count: 1,
    counts_by_class: { pothole: 1 },
    counts_by_severity: { low: 0, moderate: 0, high: 1 },
    max_severity: 'high',
  },
  processing_time_ms: 12.5,
  annotated_image_base64: 'ZmFrZQ==',
  warnings: ['DEMO MODE'],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AiClient', () => {
  it('maps a valid prediction payload to domain records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, VALID_AI_RESPONSE)));

    const client = new AiClient('http://ai.test');
    const prediction = await client.predict(Buffer.from('img'), 'a.png', 'image/png');

    expect(prediction.demo).toBe(true);
    expect(prediction.model.engine).toBe('demo');
    expect(prediction.detections).toHaveLength(1);
    expect(prediction.detections[0]).toMatchObject({
      className: 'pothole',
      confidence: 0.91,
      severity: 'high',
    });
    expect(prediction.summary.maxSeverity).toBe('high');
    expect(prediction.annotatedImageBase64).toBe('ZmFrZQ==');
  });

  it('maps AI unavailability (network failure) to AI_SERVICE_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const client = new AiClient('http://ai.test');
    await expect(client.predict(Buffer.from('img'), 'a.png', 'image/png')).rejects.toMatchObject({
      code: 'AI_SERVICE_UNAVAILABLE',
    });
  });

  it('maps model-missing 503 to a clear error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(503, { success: false, error: { code: 'MODEL_UNAVAILABLE' } })),
    );

    const client = new AiClient('http://ai.test');
    await expect(client.predict(Buffer.from('img'), 'a.png', 'image/png')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('rejects unexpected schemas instead of fabricating results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { success: true })));

    const client = new AiClient('http://ai.test');
    await expect(client.predict(Buffer.from('img'), 'a.png', 'image/png')).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
    });
  });

  it('reports health without throwing when the service is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const client = new AiClient('http://ai.test');
    await expect(client.health()).resolves.toBeNull();
  });
});
