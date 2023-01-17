import fetch from 'cross-fetch';
import dotenv from 'dotenv';
dotenv.config();
import express, { Express, Request, Response } from 'express';
import path from 'path';

import { AUTH_APP_CLIENT_ID, AUTH_APP_CLIENT_SECRET, AUTH_URL, PORT } from './config';
import { eventsHandler } from './handlers/sse';
import { createInstance, createServiceName, deleteInstance, queryInstance } from './lightsail';
import { logger } from './logger';
import { Monitor } from './monitor';
import authentication from './src/middlewares/authentication';

const app: Express = express();

app.use(express.json());

app.get('/', async (req: Request, res: Response) => {
    const authCode = <string>req.query.code;
    const redirectUri = 'http://localhost:7001/';
    if (!authCode) {
        res.redirect(
            `${AUTH_URL}/login?redirect_uri=${redirectUri}&client_id=${AUTH_APP_CLIENT_ID}&scope=openid+profile+email&response_type=code`
        );
    } else {
        try {
            const payload = {
                grant_type: 'authorization_code',
                client_id: AUTH_APP_CLIENT_ID,
                code: authCode,
                redirect_uri: redirectUri,
            };
            const headers: any = {
                'Content-type': 'application/x-www-form-urlencoded',
            };

            const authenticateClientApp = !!AUTH_APP_CLIENT_ID && !!AUTH_APP_CLIENT_SECRET;

            if (authenticateClientApp) {
                const clientAuth = `${AUTH_APP_CLIENT_ID}:${AUTH_APP_CLIENT_SECRET}`;
                headers.Authorization = `Basic ${Buffer.from(clientAuth).toString('base64')}`;
            }

            const response = await fetch(`${AUTH_URL}/oauth2/token`, {
                headers,
                method: 'POST',
                body: new URLSearchParams(payload).toString(),
            });

            // id_token, refresh_token
            const tokens = await response.json();

            if (tokens.error) {
                res.redirect(
                    `${AUTH_URL}/login?redirect_uri=${redirectUri}&client_id=${AUTH_APP_CLIENT_ID}&scope=openid+profile+email&response_type=code`
                );
                return;
            } else {
                res.cookie('accessToken', tokens?.access_token);
                res.cookie('idToken', tokens?.id_token);
                res.cookie('refreshToken', tokens?.refresh_token);

                logger.debug(tokens);
            }
        } catch (error: any) {
            logger.error(error?.message);
            logger.error(error);
            logger.error('Redirect...');
            res.redirect(
                `${AUTH_URL}/login?redirect_uri=${redirectUri}&client_id=${AUTH_APP_CLIENT_ID}&scope=openid+profile+email&response_type=code`
            );
            return;
        }

        res.sendFile(path.resolve(__dirname, '../public', 'index.html'));
    }
});
app.use(express.static('public'));
app.get('/events', eventsHandler);
app.post('/refresh-token', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    logger.info(`Refreshing access token. Token: ${refreshToken}`);

    try {
        const payload = {
            grant_type: 'refresh_token',
            client_id: AUTH_APP_CLIENT_ID,
            refresh_token: refreshToken,
        };
        const headers: any = {
            'Content-type': 'application/x-www-form-urlencoded',
        };

        const authenticateClientApp = !!AUTH_APP_CLIENT_ID && !!AUTH_APP_CLIENT_SECRET;

        if (authenticateClientApp) {
            const clientAuth = `${AUTH_APP_CLIENT_ID}:${AUTH_APP_CLIENT_SECRET}`;
            headers.Authorization = `Basic ${Buffer.from(clientAuth).toString('base64')}`;
        }

        const response = await fetch(`${AUTH_URL}/oauth2/token`, {
            headers,
            method: 'POST',
            body: new URLSearchParams(payload).toString(),
        });

        // access_token, id_token
        const tokens = await response.json();

        if (tokens.error) {
            res.status(400).json({ error: tokens.error });
            return;
        }
        res.cookie('accessToken', tokens?.access_token);
        res.cookie('idToken', tokens?.id_token);
        // res.cookie('refreshToken', tokens?.refresh_token);

        // logger.debug(tokens);

        res.json(tokens);
    } catch (error: any) {
        logger.error(error?.message);
    }
});

app.use('/api', authentication);
app.get('/api/instance', async (req: Request, res: Response) => {
    const clientId = <string>req.query.clientId; // FIXME: Add validation
    const serviceName = createServiceName(clientId);

    try {
        const data = await queryInstance(serviceName);
        res.json({ ...data.containerServices![0] });
    } catch (error: any) {
        const status = error?.$metadata?.httpStatusCode;
        res.status(status).json({ message: error.message, details: { serviceName } });
    }
});

app.post('/api/instance', async (req: Request, res: Response) => {
    const { clientId } = req.body; // FIXME: Add validation
    const user = req.user;
    const tags: Map<string, string> = new Map([['user', user?.name || user?.email]]);

    res.json({ data: await createInstance(clientId, tags) });
});

app.delete('/api/instance', async (req: Request, res: Response) => {
    res.json({ data: await deleteInstance(req.body.serviceName) });
});

new Monitor();

app.listen(PORT, () => {
    logger.info(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
