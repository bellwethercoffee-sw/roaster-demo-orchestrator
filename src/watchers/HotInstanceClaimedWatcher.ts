import { eventBus, EventName } from '../event-bus';
import { createHotInstance } from '../init';
import { logger } from '../logger';
import AbstractWatcher from './AbstractWatcher';

export class HotInstanceClaimedWatcher extends AbstractWatcher {
    public constructor() {
        super();

        eventBus.on(EventName.HotInstanceClaimed, () => {
            // logger.info(`New service created ${serviceName}`);
            this.watch('');
        });
    }

    public watch(_: string) {
        logger.info(`Creating a new hot instance`);

        createHotInstance();
    }
}
