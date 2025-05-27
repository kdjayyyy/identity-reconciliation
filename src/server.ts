import express from 'express';
import bodyParser from 'body-parser';
import { PrismaClient } from '@prisma/client';
import identifyHandler from './identifyHandler';

const app = express();
const prisma = new PrismaClient();

app.use(bodyParser.json());
app.post('/identify', identifyHandler(prisma));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
