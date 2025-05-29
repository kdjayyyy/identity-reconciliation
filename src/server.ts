import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { PrismaClient } from '@prisma/client';
import identifyHandler from './identifyHandler';

const app = express();
const prisma = new PrismaClient();

app.use(bodyParser.json());

app.post('/identify', async (req: Request, res: Response) => {
  try {
    await identifyHandler(prisma)(req, res);
  } catch (error) {
    console.error('Error in identify handler:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/contacts', async (req: Request, res: Response) => {
  const all = await prisma.contact.findMany();
  res.json({ contacts: all });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
