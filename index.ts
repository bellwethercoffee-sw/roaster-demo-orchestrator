import dotenv from 'dotenv';
dotenv.config();
import express, { Express, Request, Response } from 'express';

import { eventsHandler } from './handlers/sse';
import { createInstance, deleteInstance } from './lightsail';
import { logger } from './logger';
import { monitor } from './monitor';

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/events', eventsHandler);

app.post('/instance', async (req: Request, res: Response) => {
    const { identifier } = req.body; // FIXME: Add validation

    res.json({ data: await createInstance(identifier) });
});

app.delete('/instance', async (req: Request, res: Response) => {
    res.json({ data: await deleteInstance(req.body.serviceName) });
});

monitor.start();
app.listen(port, () => {
    logger.info(`⚡️[server]: Server is running at http://localhost:${port}`);
});
