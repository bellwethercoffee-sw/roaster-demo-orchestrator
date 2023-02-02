import crypto from 'crypto';

import { TAG_HOT_INSTANCE_KEY } from './config';
import { eventBus, EventName } from './event-bus';
import { createInstance, findManagedInstances, queryHotInstance } from './lightsail';
import { logger } from './logger';

const generateUnquieId = () => {
    return String(crypto.randomInt(100, 100000));
};

export const createHotInstance = async () => {
    const tags: Map<string, string> = new Map([[TAG_HOT_INSTANCE_KEY, '']]);

    try {
        const id = `hot${generateUnquieId()}`;

        logger.info(`Creating a hot instance with id: ${id}`);
        createInstance(id, tags);
    } catch (error: any) {
        logger.error(error?.message || error);
    }
};

export const ensureHotInstanceIsAvailable = async () => {
    const tags: Map<string, string> = new Map([[TAG_HOT_INSTANCE_KEY, '']]);

    try {
        const instance = await queryHotInstance();

        logger.info(`Hot instance available: ${!!instance}`);
        if (!instance) createHotInstance();
    } catch (error: any) {
        logger.error(error?.message || error);
    }
};

export const init = async () => {
    ensureHotInstanceIsAvailable();
    cleanup();
};

export const cleanup = async () => {
    try {
        const instances = await findManagedInstances();

        logger.info(
            `Instances found: ${instances.length}. Adding them to be monitored for auto deletion`
        );
        if (instances.length === 0) return;

        instances.forEach((instance) => {
            logger.info(`Candidate instance for clean up: ${instance.containerServiceName}`);
            eventBus.emit(EventName.DeploymentRunning, instance.containerServiceName, instance.url);
        });
    } catch (error: any) {
        logger.error(error?.message || error);
    }
};
