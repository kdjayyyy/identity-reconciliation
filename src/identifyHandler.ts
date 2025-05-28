import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const identifyHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Email or phoneNumber must be provided' });
    }

    const conditions = [];
    if (email) conditions.push({ email });
    if (phoneNumber) conditions.push({ phoneNumber });

    const directMatches = await prisma.contact.findMany({
      where: {
        OR: conditions,
      },
    });

    if (directMatches.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: 'primary',
        },
      });

      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: [newContact.email].filter(Boolean),
          phoneNumbers: [newContact.phoneNumber].filter(Boolean),
          secondaryContactIds: [],
        },
      });
    }

    const involvedPrimaryIds = Array.from(new Set(
      directMatches.map(c =>
        c.linkPrecedence === 'primary' ? c.id : c.linkedId!
      )
    ));

    const candidatePool = await prisma.contact.findMany({
      where: {
        OR: [
          { id: { in: involvedPrimaryIds } },
          { linkedId: { in: involvedPrimaryIds } },
        ],
      },
    });

    const primaryContacts = candidatePool.filter(c => c.linkPrecedence === 'primary');
    const ultimatePrimary = primaryContacts.reduce((oldest, curr) =>
      new Date(curr.createdAt) < new Date(oldest.createdAt) ? curr : oldest
    );

    const E_group = new Set(candidatePool.map(c => c.email).filter(Boolean));
    const P_group = new Set(candidatePool.map(c => c.phoneNumber).filter(Boolean));

    let newSecondary: any = null;

    if ((email && !E_group.has(email)) || (phoneNumber && !P_group.has(phoneNumber))) {
      newSecondary = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: ultimatePrimary.id,
          linkPrecedence: 'secondary',
        },
      });
    }

    const updateOps = candidatePool.map(c => {
      if (c.id !== ultimatePrimary.id &&
          (c.linkPrecedence !== 'secondary' || c.linkedId !== ultimatePrimary.id)) {
        return prisma.contact.update({
          where: { id: c.id },
          data: {
            linkPrecedence: 'secondary',
            linkedId: ultimatePrimary.id,
          },
        });
      }
      return null;
    }).filter((op): op is ReturnType<typeof prisma.contact.update> => op !== null);

    if (updateOps.length > 0) {
      await prisma.$transaction(updateOps);
    }

    const updatedSecondaries = await prisma.contact.findMany({
      where: { linkedId: ultimatePrimary.id },
    });

    const emailList = [
      ultimatePrimary.email,
      ...updatedSecondaries.map(c => c.email),
    ].filter(Boolean);

    const phoneList = [
      ultimatePrimary.phoneNumber,
      ...updatedSecondaries.map(c => c.phoneNumber),
    ].filter(Boolean);

    const secondaryIds = updatedSecondaries.map(c => c.id);

    return res.status(200).json({
      contact: {
        primaryContactId: ultimatePrimary.id,
        emails: Array.from(new Set(emailList)),
        phoneNumbers: Array.from(new Set(phoneList)),
        secondaryContactIds: secondaryIds,
      },
    });
  };
}

export default identifyHandler;
