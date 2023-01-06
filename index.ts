import dotenv from 'dotenv';
dotenv.config();
import express, { Express, Request, Response } from 'express';

import { eventsHandler } from './handlers/sse';
import { createInstance, createServiceName, deleteInstance, queryInstance } from './lightsail';
import { logger } from './logger';
import { monitor } from './monitor';

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/events', eventsHandler);

app.get('/instance', async (req: Request, res: Response) => {
    const clientId = <string>req.query.clientId; // FIXME: Add validation
    const serviceName = createServiceName(clientId);

    try {
        const data = await queryInstance(serviceName);
        res.json({ ...data.containerServices![0] });
    } catch (error: any) {
        const status = error.$metadata.httpStatusCode;
        res.status(status).json({ message: error.message, details: { serviceName } });
    }
});

app.post('/instance', async (req: Request, res: Response) => {
    const { clientId } = req.body; // FIXME: Add validation

    res.json({ data: await createInstance(clientId) });
});

app.delete('/instance', async (req: Request, res: Response) => {
    res.json({ data: await deleteInstance(req.body.serviceName) });
});

monitor.start();
app.listen(port, () => {
    logger.info(`⚡️[server]: Server is running at http://localhost:${port}`);
});
