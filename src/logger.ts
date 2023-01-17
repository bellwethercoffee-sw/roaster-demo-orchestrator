import pino from 'pino';

const instance = pino();
instance.level = process.env.LOG_LEVEL || 'info';

export const logger = instance;
