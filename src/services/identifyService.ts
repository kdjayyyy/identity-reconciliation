// src/services/identifyService.ts
import { Prisma, Contact } from '@prisma/client';
import prisma from '../db/prismaClient';

type IdentifyInput = {
  email?: string | null;
  phoneNumber?: string | null;
};

type IdentifyResult = {
  primaryContactId: number; // intentional spelling to match prompt
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
};

/**
 * Expand cluster of related contacts starting from given seeds.
 * Uses iterative expansion by querying for any contacts that share email / phone / linkedId / id.
 */
async function expandCluster(
  tx: Prisma.TransactionClient,
  initialEmails: Set<string>,
  initialPhones: Set<string>,
  initialIds: Set<number>
): Promise<Contact[]> {
  const foundById = new Map<number, Contact>();

  const buildWhereClause = () => {
    const or: any[] = [];
    if (initialEmails.size > 0) {
      or.push({ email: { in: Array.from(initialEmails) } });
    }
    if (initialPhones.size > 0) {
      or.push({ phoneNumber: { in: Array.from(initialPhones) } });
    }
    if (initialIds.size > 0) {
      or.push({ id: { in: Array.from(initialIds) } });
      or.push({ linkedId: { in: Array.from(initialIds) } });
    }
    return or.length > 0 ? { OR: or } : undefined;
  };

  let changed = true;
  while (changed) {
    changed = false;
    const where = buildWhereClause();
    if (!where) break;

    const batch = await tx.contact.findMany({ where });

    for (const c of batch) {
      if (!foundById.has(c.id)) {
        foundById.set(c.id, c);

        if (c.email && !initialEmails.has(c.email)) {
          initialEmails.add(c.email);
          changed = true;
        }
        if (c.phoneNumber && !initialPhones.has(c.phoneNumber)) {
          initialPhones.add(c.phoneNumber);
          changed = true;
        }
        if (c.linkedId !== null && c.linkedId !== undefined && !initialIds.has(c.linkedId)) {
          initialIds.add(c.linkedId);
          changed = true;
        }
        if (!initialIds.has(c.id)) {
          initialIds.add(c.id);
          changed = true;
        }
      }
    }
  }

  return Array.from(foundById.values());
}

/**
 * Main identify function
 */
async function identify(input: IdentifyInput): Promise<IdentifyResult> {
  // Defensive normalization in service (controller may already normalize)
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const phone = input.phoneNumber ? String(input.phoneNumber).replace(/[^\d+]/g, '') : null;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1) Find direct matches (if any)
    const directWhereOr: any[] = [];
    if (email) directWhereOr.push({ email }); 
    if (phone) directWhereOr.push({ phoneNumber: phone });

    const directMatches = directWhereOr.length > 0 ? await tx.contact.findMany({ where: { OR: directWhereOr } }) : [];

    // No matches: create a new primary
    if (directMatches.length === 0) {
      const created = await tx.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phone ?? null,
          linkPrecedence: 'primary',
          linkedId: null,
        },
      });

      return {
        primaryContactId: created.id,
        emails: created.email ? [created.email] : [],
        phoneNumbers: created.phoneNumber ? [created.phoneNumber] : [],
        secondaryContactIds: [],
      };
    }

    // 2) Expand cluster
    const initialEmails = new Set<string>();
    const initialPhones = new Set<string>();
    const initialIds = new Set<number>();

    for (const d of directMatches) {
      if (d.email) initialEmails.add(d.email);
      if (d.phoneNumber) initialPhones.add(d.phoneNumber);
      initialIds.add(d.id);
      if (d.linkedId !== null && d.linkedId !== undefined) initialIds.add(d.linkedId);
    }

    let clusterContacts = await expandCluster(tx, initialEmails, initialPhones, initialIds);

    // 3) Determine primary candidate (oldest createdAt, tie-breaker id)
    if (clusterContacts.length === 0) {
      // Defensive fallback (shouldn't happen)
      const created = await tx.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phone ?? null,
          linkPrecedence: 'primary',
        },
      });
      return {
        primaryContactId: created.id,
        emails: created.email ? [created.email] : [],
        phoneNumbers: created.phoneNumber ? [created.phoneNumber] : [],
        secondaryContactIds: [],
      };
    }

    let primary = clusterContacts[0];
    for (const c of clusterContacts) {
      const ta = new Date(c.createdAt).getTime();
      const tb = new Date(primary.createdAt).getTime();
      if (ta < tb || (ta === tb && c.id < primary.id)) {
        primary = c;
      }
    }

    // 4) If multiple primaries exist in the cluster (other rows with linkPrecedence='primary'), demote them
    const primariesToDemote = clusterContacts.filter((c) => c.linkPrecedence === 'primary' && c.id !== primary.id);
    if (primariesToDemote.length > 0) {
      for (const p of primariesToDemote) {
        await tx.contact.update({
          where: { id: p.id },
          data: { linkPrecedence: 'secondary', linkedId: primary.id },
        });
      }

      // Refresh cluster after demotions
      const reEmails = new Set<string>();
      const rePhones = new Set<string>();
      const reIds = new Set<number>();
      for (const c of clusterContacts) {
        if (c.email) reEmails.add(c.email);
        if (c.phoneNumber) rePhones.add(c.phoneNumber);
        reIds.add(c.id);
      }
      reIds.add(primary.id);

      clusterContacts = await expandCluster(tx, reEmails, rePhones, reIds);

      // refresh primary reference to the up-to-date record
      const refreshedPrimary = clusterContacts.find((c) => c.id === primary.id);
      if (refreshedPrimary) primary = refreshedPrimary;
    }

    // 5) Create a secondary if incoming info adds any new email/phone to the cluster
    const clusterEmails = new Set<string>();
    const clusterPhones = new Set<string>();
    for (const c of clusterContacts) {
      if (c.email) clusterEmails.add(c.email);
      if (c.phoneNumber) clusterPhones.add(c.phoneNumber);
    }

    const incomingEmailNew = email ? !clusterEmails.has(email) : false;
    const incomingPhoneNew = phone ? !clusterPhones.has(phone) : false;

    if (incomingEmailNew || incomingPhoneNew) {
      const createdSecondary = await tx.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phone ?? null,
          linkPrecedence: 'secondary',
          linkedId: primary.id,
        },
      });
      clusterContacts.push(createdSecondary);
      if (createdSecondary.email) clusterEmails.add(createdSecondary.email);
      if (createdSecondary.phoneNumber) clusterPhones.add(createdSecondary.phoneNumber);
    }

    // 6) Build output: ensure primary's values are first in arrays
    const clusterSorted = clusterContacts.slice().sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      return a.id - b.id;
    });

    const emailsOut: string[] = [];
    const phonesOut: string[] = [];

    if (primary.email) emailsOut.push(primary.email);
    for (const c of clusterSorted) {
      if (c.id === primary.id) continue;
      if (c.email && !emailsOut.includes(c.email)) emailsOut.push(c.email);
    }

    if (primary.phoneNumber) phonesOut.push(primary.phoneNumber);
    for (const c of clusterSorted) {
      if (c.id === primary.id) continue;
      if (c.phoneNumber && !phonesOut.includes(c.phoneNumber)) phonesOut.push(c.phoneNumber);
    }

    const secondaryIds = clusterContacts
      .filter((c) => c.linkPrecedence === 'secondary' && c.id !== primary.id)
      .map((c) => c.id);

    return {
      primaryContactId: primary.id,
      emails: emailsOut,
      phoneNumbers: phonesOut,
      secondaryContactIds: secondaryIds,
    };
  });
}

export default {
  identify,
};
