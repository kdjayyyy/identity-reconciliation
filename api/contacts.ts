import { VercelRequest, VercelResponse } from '@vercel/node'
import prisma from '../src/prismaClient'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const contacts = await prisma.contact.findMany()
    return res.status(200).json({ contacts })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}