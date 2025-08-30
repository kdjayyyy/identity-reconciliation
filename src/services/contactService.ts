import type { Contact} from '@prisma/client';
import prisma from '../db/prismaClient';

export type ContactFilter = {
  id?: number;
  email?: string;
  phoneNumber?: string;
};

export async function getAllContacts(filter?: ContactFilter): Promise<Contact[]> {
  // Build a `where` object only with defined filters to avoid passing `undefined`
  const where: Record<string, unknown> = {};

  if (filter) {
    if (typeof filter.id === 'number')
      where.id = filter.id;
    if (typeof filter.email === 'string' && filter.email.trim() !== '')
      where.email = filter.email.trim().toLowerCase();
    if (typeof filter.phoneNumber === 'string' && filter.phoneNumber.trim() !== '')
      where.phoneNumber = filter.phoneNumber.trim();
  }

  // if where is empty, pass undefined so Prisma returns all rows
  const prismaWhere = Object.keys(where).length > 0 ? where : undefined;

  const contacts = await prisma.contact.findMany({
    where: prismaWhere as any,
    orderBy: { id: 'asc' }
  })

  return contacts;
}