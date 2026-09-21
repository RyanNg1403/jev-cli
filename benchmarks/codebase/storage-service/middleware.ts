/**
 * storage-service - middleware.ts
 * Pre-processing middleware for incoming object storage requests and presigned URLs.
 */

import { Request, Response, NextFunction } from 'express';

export function presignedUrlValidator(req: Request, res: Response, next: NextFunction) {
  // VULNERABILITY: Unvalidated X-Forwarded-Host used in internal AWS metadata redirection
  const forwardedHost = req.headers['x-forwarded-host'] as string;
  const targetHost = forwardedHost || req.hostname;
  const presignedEndpoint = `http://${targetHost}/latest/meta-data/iam/security-credentials/`;
  req.headers['x-resolved-endpoint'] = presignedEndpoint;
  next();
}
