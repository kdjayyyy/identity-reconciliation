import { Request, Response, NextFunction } from 'express';
import identifyService from '../services/identifyService';

// --- Types -------------------------------------------------------------
type IdentifyRequestBody = {
  email?: string | null;
  phoneNumber?: string | null;
};

type IdentifyResult = {
  primaryContactId: number;             // intentional spelling to match prompt
  emails: string[];                      // primary email first (if present)
  phoneNumbers: string[];                // primary phone first (if present)
  secondaryContactIds: number[];
};

// --- Normalization helpers (kept simple; move to utils/normalize.ts if you want) ---
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Normalize phone to digits-only.
 * Assumption: we do not apply advanced country-code logic here — store digits only.
 */
function normalizePhone(raw: string | number): string {
  const s = String(raw);
  // remove everything except digits and leading +
  const digits = s.replace(/[^\d+]/g, '');
  // Optionally strip leading zeros or other normalization rules here.
  return digits;
}

// --- Controller --------------------------------------------------------
/**
 * POST /identify
 * Expects JSON: { "email"?: string, "phoneNumber"?: string }
 */
export default async function identifyController(
  req: Request<{}, {}, IdentifyRequestBody>,
  res: Response,
  next: NextFunction
) {
  try {
    // Ensure JSON
    if (!req.is('application/json')) {
      return res
        .status(415)
        .json({ error: 'Content-Type must be application/json' });
    }

    const { email, phoneNumber } = req.body ?? {};

    // Validate input: at least one of email or phoneNumber must be present (non-null, non-empty)
    const hasEmail = typeof email === 'string' && email.trim().length > 0;
    const hasPhone =
      (typeof phoneNumber === 'string' && phoneNumber.trim().length > 0) ||
      typeof phoneNumber === 'number';

    if (!hasEmail && !hasPhone) {
      return res
        .status(400)
        .json({ error: 'Request must include at least email or phoneNumber' });
    }

    // Normalize inputs
    const normalizedEmail = hasEmail ? normalizeEmail(email as string) : null;
    const normalizedPhone = hasPhone ? normalizePhone(phoneNumber as any) : null;

    // Call service layer
    // The identify service should:
    // - Run DB transaction
    // - Find/expand cluster
    // - Create/merge contacts if needed
    // - Return an object matching IdentifyResult
    const result: IdentifyResult = await identifyService.identify({
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
    });

    // Return response in required shape
    return res.status(200).json({ contact: result });
  } catch (err) {
    // Keep errors simple here; let error middleware / logger handle details
    // If you don't have an error middleware, this will return a 500 with message.
    return next(err);
  }
}