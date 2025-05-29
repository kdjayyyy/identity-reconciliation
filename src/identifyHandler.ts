import { PrismaClient, Contact } from "@prisma/client";
import { Request, Response } from "express";

const identifyHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;

    // Validate input: at least one of email or phoneNumber is required
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json({ error: "Email or phoneNumber must be provided" });
    }

    // Prepare conditions for direct lookup of matching contacts
    const conditions = [];
    if (email) conditions.push({ email });
    if (phoneNumber) conditions.push({ phoneNumber });

    // Query for any existing contacts matching provided identifiers
    const directMatches = await prisma.contact.findMany({
      where: {
        OR: conditions,
      },
    });

    // If no matches found, create a new primary contact
    if (directMatches.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary",
        },
      });

      // Respond with the newly created contact information
      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: [newContact.email].filter(Boolean),
          phoneNumbers: [newContact.phoneNumber].filter(Boolean),
          secondaryContactIds: [],
        },
      });
    } // Determine unique set of primary contact IDs from directMatches
    const involvedPrimaryIds = Array.from(
      new Set(
        directMatches.map((c: Contact) =>
          c.linkPrecedence === "primary" ? c.id : c.linkedId!
        )
      )
    );

    // Load all related contacts (primary and secondary) for consolidation
    const candidatePool = await prisma.contact.findMany({
      where: {
        OR: [
          { id: { in: involvedPrimaryIds } },
          { linkedId: { in: involvedPrimaryIds } },
        ],
      },
    }); // Find the oldest primary contact to serve as the ultimate primary
    const primaryContacts = candidatePool.filter(
      (c: Contact) => c.linkPrecedence === "primary"
    );
    const ultimatePrimary = primaryContacts.reduce(
      (oldest: Contact, curr: Contact) =>
        new Date(curr.createdAt) < new Date(oldest.createdAt) ? curr : oldest
    ); // Collect existing emails and phoneNumbers in the pool for deduplication
    const existingEmails = new Set(
      candidatePool.map((c: Contact) => c.email).filter(Boolean)
    );
    const existingPhones = new Set(
      candidatePool.map((c: Contact) => c.phoneNumber).filter(Boolean)
    );

    // If provided identifier is new, create a secondary record linked to ultimate primary
    if (
      (email && !existingEmails.has(email)) ||
      (phoneNumber && !existingPhones.has(phoneNumber))
    ) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: ultimatePrimary.id,
          linkPrecedence: "secondary",
        },
      });
    } // Ensure all contacts other than ultimate primary are marked as secondary correctly
    const updateOps = candidatePool
      .map((c: Contact) => {
        if (
          c.id !== ultimatePrimary.id &&
          (c.linkPrecedence !== "secondary" ||
            c.linkedId !== ultimatePrimary.id)
        ) {
          return prisma.contact.update({
            where: { id: c.id },
            data: {
              linkPrecedence: "secondary",
              linkedId: ultimatePrimary.id,
            },
          });
        }
        return null;
      })
      .filter(
        (op): op is ReturnType<typeof prisma.contact.update> => op !== null
      );

    // Execute any necessary updates as a single transaction
    if (updateOps.length > 0) {
      await prisma.$transaction(updateOps);
    }

    // Fetch updated secondary contacts for response
    const updatedSecondaries = await prisma.contact.findMany({
      where: { linkedId: ultimatePrimary.id },
    }); // Build unique lists of emails and phoneNumbers for the response
    const emailList = [
      ultimatePrimary.email,
      ...updatedSecondaries.map((c: Contact) => c.email),
    ].filter(Boolean);

    const phoneList = [
      ultimatePrimary.phoneNumber,
      ...updatedSecondaries.map((c: Contact) => c.phoneNumber),
    ].filter(Boolean);

    const secondaryIds = updatedSecondaries.map((c: Contact) => c.id);

    // Return consolidated contact information
    return res.status(200).json({
      contact: {
        primaryContactId: ultimatePrimary.id,
        emails: Array.from(new Set(emailList)),
        phoneNumbers: Array.from(new Set(phoneList)),
        secondaryContactIds: secondaryIds,
      },
    });
  };
};

export default identifyHandler;
