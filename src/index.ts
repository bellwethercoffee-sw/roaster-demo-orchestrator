import fetch from 'cross-fetch';
import dotenv from 'dotenv';
dotenv.config();
import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import {
    OAUTH_URL,
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    PORT,
    OAUTH_REDIRECT_URI,
} from './config';
import { eventsHandler } from './handlers/sse';
import { createInstance, createServiceName, deleteInstance, queryInstance } from './lightsail';
import { logger } from './logger';
import { Monitor } from './monitor';
import authentication from './middlewares/authentication';

const app: Express = express();
let redirectUri: string;
app.use(express.json());
app.use(cookieParser());

const getRedirectUri = (req: Request): string => {
    if (!redirectUri) {
        // NOTE: Ideally the dynamic URI should be enough, but it appears the load balancer isn't correct forwarding the protocol as it reports http instead of https leading to a mismatch in the uri error
        redirectUri =
            req.hostname === 'localhost'
                ? `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`
                : OAUTH_REDIRECT_URI;
    }

    return redirectUri;
};

const login = async (req: Request, res: Response) => {
    const authCode = <string>req.query.code;
    const redirectUri = getRedirectUri(req);
    logger.info(`OAuth redirect URI: ${redirectUri}`);
    const loginUrl = `${OAUTH_URL}/login?redirect_uri=${redirectUri}&client_id=${OAUTH_CLIENT_ID}&scope=openid+profile+email&response_type=code`;

    if (!authCode) {
        res.redirect(loginUrl);
    } else {
        try {
            const payload = {
                grant_type: 'authorization_code',
                client_id: OAUTH_CLIENT_ID,
                code: authCode,
                redirect_uri: redirectUri,
            };
            const headers: any = {
                'Content-type': 'application/x-www-form-urlencoded',
            };
            const authenticateClientApp = !!OAUTH_CLIENT_ID && !!OAUTH_CLIENT_SECRET;
            if (authenticateClientApp) {
                const clientAuth = `${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`;
                headers.Authorization = `Basic ${Buffer.from(clientAuth).toString('base64')}`;
            }
            const response = await fetch(`${OAUTH_URL}/oauth2/token`, {
                headers,
                method: 'POST',
                body: new URLSearchParams(payload).toString(),
            });
            // id_token, refresh_token
            const tokens = await response.json();
            if (tokens.error) {
                res.redirect(loginUrl);
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
            res.redirect(loginUrl);
            return;
        }
        res.sendFile(path.resolve(__dirname, '../public', 'index.html'));
    }
};
const logout = async (req: Request, res: Response) => {
    const redirectUri = getRedirectUri(req);
    logger.info(`OAuth redirect URI: ${redirectUri}`);
    const logoutUrl = `${OAUTH_URL}/logout?redirect_uri=${redirectUri}&client_id=${OAUTH_CLIENT_ID}&scope=openid+profile+email+aws.cognito.signin.user.admin&response_type=code`;

    res.redirect(logoutUrl);
};

app.get('/', async (req: Request, res: Response) => {
    if (req.query['action'] === 'logout') logout(req, res);
    else login(req, res);
});
app.use(express.static('public'));
app.get('/events', eventsHandler);
app.post('/refresh-token', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    logger.info(`Refreshing access token. Token: ${refreshToken}`);

    try {
        const payload = {
            grant_type: 'refresh_token',
            client_id: OAUTH_CLIENT_ID,
            refresh_token: refreshToken,
        };
        const headers: any = {
            'Content-type': 'application/x-www-form-urlencoded',
        };

        const authenticateClientApp = !!OAUTH_CLIENT_ID && !!OAUTH_CLIENT_SECRET;

        if (authenticateClientApp) {
            const clientAuth = `${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`;
            headers.Authorization = `Basic ${Buffer.from(clientAuth).toString('base64')}`;
        }

        const response = await fetch(`${OAUTH_URL}/oauth2/token`, {
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

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'UP' });
});

new Monitor();

app.listen(PORT, () => {
    logger.info(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
