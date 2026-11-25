/**
 * Layered anonymous-submission abuse guard, complementary to express-rate-limit.
 * Only hashed IPs, image hashes and coarse grid hashes are retained in memory.
 * This is a single-instance guard; production should also use a shared store
 * (Redis) at the edge. No personal data is kept.
 */
import { config } from '../config';
import { errors } from '../utils/errors';

interface AbuseCheckResult {
  suspicious: boolean;
  identicalRecent: number;
  ipRecent: number;
}

function timestampsInWindow(values: number[], windowMs: number, now: number): number[] {
  return values.filter((timestamp) => now - timestamp <= windowMs);
}

export class AbuseGuard {
  private byIp = new Map<string, number[]>();
  private byImage = new Map<string, number[]>();
  private byGrid = new Map<string, number[]>();

  check(
    ipHash: string | null,
    imageHash: string,
    latitude: number,
    longitude: number,
    now = Date.now(),
  ): AbuseCheckResult {
    // Coarse (~1 km) grid — enough to detect bursts without storing exact GPS.
    const gridKey = `${Math.round(latitude * 100)}:${Math.round(longitude * 100)}:${imageHash}`;
    const ipKey = ipHash ?? 'unknown';
    const ipRecent = timestampsInWindow(this.byIp.get(ipKey) ?? [], 24 * 60 * 60 * 1000, now);
    const identicalRecent = timestampsInWindow(
      this.byImage.get(imageHash) ?? [],
      config.publicReports.abuseWindowMs,
      now,
    );
    const gridRecent = timestampsInWindow(
      this.byGrid.get(gridKey) ?? [],
      config.publicReports.abuseWindowMs,
      now,
    );

    if (ipRecent.length >= config.publicReports.dailyIpLimit) {
      throw errors.rateLimited('Daily report limit reached for this network. Please try again tomorrow.');
    }
    if (
      identicalRecent.length >= config.publicReports.identicalLimit ||
      gridRecent.length >= config.publicReports.identicalLimit
    ) {
      throw errors.conflict(
        'A very similar report was submitted recently. Please check its status instead of submitting again.',
      );
    }

    this.byIp.set(ipKey, ipRecent);
    this.byImage.set(imageHash, identicalRecent);
    this.byGrid.set(gridKey, gridRecent);

    const suspicious =
      ipRecent.length >= Math.max(2, Math.floor(config.publicReports.dailyIpLimit / 2)) ||
      identicalRecent.length >= 1 ||
      gridRecent.length >= 1;

    return { suspicious, identicalRecent: identicalRecent.length, ipRecent: ipRecent.length };
  }

  record(
    ipHash: string | null,
    imageHash: string,
    latitude: number,
    longitude: number,
    now = Date.now(),
  ): void {
    const ipKey = ipHash ?? 'unknown';
    const gridKey = `${Math.round(latitude * 100)}:${Math.round(longitude * 100)}:${imageHash}`;
    this.byIp.set(ipKey, [...(this.byIp.get(ipKey) ?? []), now]);
    this.byImage.set(imageHash, [...(this.byImage.get(imageHash) ?? []), now]);
    this.byGrid.set(gridKey, [...(this.byGrid.get(gridKey) ?? []), now]);
  }

  reset(): void {
    this.byIp.clear();
    this.byImage.clear();
    this.byGrid.clear();
  }
}

export const abuseGuard = new AbuseGuard();
