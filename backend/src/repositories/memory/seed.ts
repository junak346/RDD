/**
 * ⚠️ DEMO SEED DATA — clearly-labelled synthetic inspections.
 *
 * Only ever loaded when DATA_MODE=demo and DEMO_SEED=true. These records are
 * NOT real analyses; every record carries model.demo=true and the UI shows a
 * DEMO MODE banner whenever the demo store is active. Never mixed with the
 * MongoDB production store.
 *
 * Purpose: give the dashboard/map/analytics screens meaningful shapes to
 * render in demonstrations where no real inspections exist yet.
 */
import { Repositories } from '../types';
import { DetectionRecord, Severity } from '../../types/domain';

const DEMO_USER = {
  name: 'Demo Inspector',
  email: 'demo@rdd.local',
  passwordHash: '$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBlOZ9pXKLnDX9d/B3cZJxTB5vQKle', // "demo1234"
  role: 'user' as const,
};

// Coordinates around Guwahati, Assam (demo geography).
const LOCATIONS: Array<{ latitude: number; longitude: number; address: string }> = [
  { latitude: 26.1445, longitude: 91.7362, address: 'GS Road, Guwahati, Assam' },
  { latitude: 26.152, longitude: 91.751, address: 'Zoo Road, Guwahati, Assam' },
  { latitude: 26.132, longitude: 91.711, address: 'Beltola, Guwahati, Assam' },
  { latitude: 26.177, longitude: 91.771, address: 'Chandmari, Guwahati, Assam' },
  { latitude: 26.11, longitude: 91.684, address: 'Jalukbari, Guwahati, Assam' },
  { latitude: 26.196, longitude: 91.79, address: 'Noonmati, Guwahati, Assam' },
];

function detection(
  className: string,
  confidence: number,
  severity: Severity,
  bbox: { x1: number; y1: number; x2: number; y2: number },
): DetectionRecord {
  const boxArea = (bbox.x2 - bbox.x1) * (bbox.y2 - bbox.y1);
  return {
    classId: ['pothole', 'crack', 'surface_damage', 'other'].indexOf(className),
    className,
    confidence,
    severity,
    severityScore: severity === 'high' ? 0.72 : severity === 'moderate' ? 0.48 : 0.25,
    areaRatio: Math.min(1, boxArea / (1280 * 720)),
    bbox,
  };
}

export async function createDemoSeed(repos: Repositories): Promise<void> {
  const existing = await repos.users.findByEmail(DEMO_USER.email);
  const user =
    existing ??
    (await repos.users.create({
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      passwordHash: DEMO_USER.passwordHash,
      role: DEMO_USER.role,
    }));

  const current = await repos.inspections.list({ page: 1, limit: 1, userId: user.id });
  if (current.total > 0) return; // already seeded

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  for (let index = 0; index < 18; index += 1) {
    const ageDays = Math.floor((index * 29) / 18) + (index % 3); // spread over ~30 days
    const createdAt = new Date(now - ageDays * DAY - index * 3600 * 1000);
    const location = LOCATIONS[index % LOCATIONS.length];

    const potholeCount = index % 3;
    const crackCount = (index + 1) % 3;
    const detections: DetectionRecord[] = [];
    for (let p = 0; p < potholeCount; p += 1) {
      detections.push(
        detection(
          'pothole',
          0.62 + ((index + p) % 5) * 0.06,
          p === 0 && index % 4 === 0 ? 'high' : 'moderate',
          { x1: 120 + p * 260, y1: 260, x2: 300 + p * 260, y2: 470 },
        ),
      );
    }
    for (let c = 0; c < crackCount; c += 1) {
      detections.push(
        detection('crack', 0.51 + ((index + c) % 4) * 0.08, 'low', {
          x1: 80 + c * 410,
          y1: 120,
          x2: 320 + c * 410,
          y2: 190,
        }),
      );
    }
    if (index % 5 === 0) {
      detections.push(
        detection('surface_damage', 0.44 + (index % 3) * 0.07, 'moderate', {
          x1: 640,
          y1: 420,
          x2: 980,
          y2: 640,
        }),
      );
    }

    const countsByClass: Record<string, number> = {};
    const countsBySeverity: Record<string, number> = { low: 0, moderate: 0, high: 0 };
    for (const item of detections) {
      countsByClass[item.className] = (countsByClass[item.className] ?? 0) + 1;
      countsBySeverity[item.severity] += 1;
    }
    const maxSeverity: Severity | null =
      countsBySeverity.high > 0 ? 'high' : countsBySeverity.moderate > 0 ? 'moderate' : detections.length ? 'low' : null;

    await repos.inspections.create({
      userId: user.id,
      image: {
        filename: `demo-${index}.jpg`,
        originalName: `demo-road-${index + 1}.jpg`,
        mimeType: 'image/jpeg',
        size: 240_000 + index * 1000,
        width: 1280,
        height: 720,
      },
      timestamp: createdAt,
      location,
      status: 'completed',
      model: {
        name: 'demo-engine',
        version: '1.0.0-demo',
        engine: 'demo',
        device: 'cpu',
        demo: true,
      },
      processingTimeMs: 120 + (index % 7) * 15,
      aiWarnings: ['DEMO MODE: synthetic seed data — not real detections.'],
      detections,
      summary: {
        detectionCount: detections.length,
        countsByClass,
        countsBySeverity,
        maxSeverity,
      },
    });
  }
}
