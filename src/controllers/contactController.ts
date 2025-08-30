import { Request, Response, NextFunction } from 'express';
import { getAllContacts, ContactFilter } from '../services/contactService';

export async function getContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, email, phoneNumber } = req.query;

    // Parse ID if present
    const parsedId = typeof id === 'string' && id.trim() !== '' ? Number(id) : undefined;
    if (parsedId !== undefined && Number.isNaN(parsedId)) {
      return res.status(400).jsonp({ error: 'Invalid id query parameter '});
    }

    const filter: ContactFilter = {};
    if (parsedId !== undefined) 
      filter.id = parsedId;
    if (typeof email === 'string' && email.trim() !== '') 
      filter.email = email.trim().toLowerCase();
    if (typeof phoneNumber === 'string' && phoneNumber.trim() !== '') 
      filter.phoneNumber = phoneNumber.trim();

    const contacts = await getAllContacts(filter);

    return res.status(200).json({ contacts });

  } catch(err) {
    console.error('Error in getContacts controller:', err);
    if (next) return next(err);
    return res.status(500).json({ error: 'Failed to fetch contacts' });
  }
}
