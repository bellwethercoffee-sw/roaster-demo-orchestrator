import { Request, Response, NextFunction } from 'express';
import { logger } from '../../logger';
import { decodeToken } from '../utils';

export default (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Authenticate middleware');
    const authorization = req.headers.authorization;

    if (!authorization) {
        logger.debug('Missing authorization header');
        return res.status(401).json({
            code: 'missing-authorization-header',
            message: 'Missing authorization header',
        });
    }

    let accessToken = authorization.split(' ')[1];
    const decodedToken = decodeToken(accessToken);

    if (decodedToken && new Date().getTime() >= decodedToken.exp * 1000) {
        logger.debug('Expired access token');

        return res.status(401).json({
            code: 'expired-token',
            message: 'Expired access token',
        });
    }
    const user = decodeToken(<string>req.headers['x-id-token']);
    if (user) {
        req.user = {
            id: user.sub,
            email: user.email,
            name: user.name,
        };
    }
    // logger.debug(req.headers.authorization);

    next();
};
