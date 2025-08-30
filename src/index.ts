import express, { Request, Response, NextFunction } from 'express';
import identifyRouter from './controllers/identifyController';
import { getContacts } from './controllers/contactController';
import identifyController from './controllers/identifyController';

const app = express();
app.use(express.json());

const router = express.Router();

router.post('/identify', identifyController);
router.get('/contacts', getContacts);

app.use('/', router);

// health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'Ok' });
}) ;

// 404 fallback for any other route
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// basic error handler 
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
