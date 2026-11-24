/**
 * Test helper: a tiny HTTP stub that speaks the AI service contract
 * (POST /predict, GET /health) so API tests exercise the real HTTP client.
 */
import http from 'http';
import { AddressInfo } from 'net';

import { setAiClientTarget } from '../../src/services/ai.client';

export const AI_STUB_RESPONSE = {
  success: true,
  demo: true,
  model: {
    name: 'demo-engine',
    version: '1.0.0-demo',
    engine: 'demo',
    device: 'cpu',
    demo: true,
    classes: ['pothole', 'crack', 'surface_damage', 'other'],
    confidence_threshold: 0.35,
    iou_threshold: 0.45,
  },
  image: { width: 640, height: 480, format: 'jpeg' },
  detections: [
    {
      class_id: 0,
      class_name: 'pothole',
      confidence: 0.94,
      bbox: { x1: 100, y1: 120, x2: 300, y2: 320 },
      severity: 'high',
      severity_score: 0.71,
      area_ratio: 0.13,
    },
    {
      class_id: 1,
      class_name: 'crack',
      confidence: 0.62,
      bbox: { x1: 10, y1: 10, x2: 200, y2: 40 },
      severity: 'low',
      severity_score: 0.28,
      area_ratio: 0.04,
    },
  ],
  summary: {
    detection_count: 2,
    counts_by_class: { pothole: 1, crack: 1 },
    counts_by_severity: { low: 1, moderate: 0, high: 1 },
    max_severity: 'high',
  },
  processing_time_ms: 42.5,
  // 1x1 red pixel JPEG — decodes fine as an annotated preview.
  annotated_image_base64:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  warnings: ['DEMO MODE: test stub response.'],
};

export interface AiStub {
  url: string;
  close: () => Promise<void>;
}

export async function startAiStub(): Promise<AiStub> {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          mode: 'demo',
          engine: 'demo',
          model_loaded: true,
          demo: true,
          version: '1.0.0',
        }),
      );
      return;
    }
    if (req.url === '/predict' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(AI_STUB_RESPONSE));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  // Route the application's AI client at the stub.
  setAiClientTarget(url, 5000);

  return {
    url,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
