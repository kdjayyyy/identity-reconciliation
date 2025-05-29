// api/identify.ts
import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../src/prismaClient'
import identifyHandler from '../src/identifyHandler'

// instantiate the Express‐style handler once
const expressStyleHandler = identifyHandler(prisma)

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // cast VercelRequest/Response to any so our Express‐style
  // handler doesn't complain. It will still work at runtime.
  return expressStyleHandler(req as any, res as any)
}