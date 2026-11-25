import { Request, Response } from 'express';

import { config } from '../config';
import { civicReportService } from '../services/civicReport.service';
import { CreatePublicReportInput } from '../validators/civic.validators';
import { asyncHandler } from '../utils/asyncHandler';
import { created, ok } from '../utils/envelope';
import { errors } from '../utils/errors';

export const publicReportController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw errors.validation('A freshly captured road photo is required (multipart field "image").');
    }
    const body = req.body as CreatePublicReportInput;
    const result = await civicReportService.create({
      imageBuffer: file.buffer,
      originalName: file.originalname || 'camera-capture.jpg',
      claimedMime: file.mimetype,
      location: body.location,
      ip: req.ip,
    });
    res.setHeader('Cache-Control', 'no-store');
    created(res, { report: result.publicReport });
  }),

  status: asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const report = await civicReportService.publicStatus(req.params.publicId);
    ok(res, { report });
  }),

  config: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, {
      camera: 'required',
      location: 'required',
      maxImageBytes: config.uploads.maxBytes,
      acceptedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
      secureContextRequired: !config.isTest,
      modelConfidenceThreshold: config.modelConfidenceThreshold,
      privacyNotice:
        'Your camera image and location are collected to analyse and manage this road-damage report. Please avoid capturing unnecessary personal or sensitive information.',
    });
  }),
};
