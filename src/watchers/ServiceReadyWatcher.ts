import { ContainerService, ContainerServiceState } from '@aws-sdk/client-lightsail';
import { eventBus, EventName } from '../event-bus';
import { queryInstance } from '../lightsail';
import { logger } from '../logger';
import AbstractWatcher from './AbstractWatcher';

export class ServiceReadyWatcher extends AbstractWatcher {
    readonly CHECK_INTERVAL = 1000 * 20;

    public constructor() {
        super();

        eventBus.on(EventName.ServiceCreated, (serviceName: string) => {
            logger.info(`New service created ${serviceName}`);
            this.watch(serviceName);
        });
    }

    public watch(serviceName: string) {
        logger.info(`Adding service ${serviceName} to be monitored for readiness`);

        this.watchList.push({
            serviceName,
            startedWatchAt: new Date(),
        });
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this.monitor();
        }, this.CHECK_INTERVAL);
    }

    private async monitor() {
        logger.debug(`Checking service(s) readiness. Count ${this.watchList.length}`);
        if (this.watchList.length === 0) return;

        const list: string[] = [];

        for (const { serviceName } of this.watchList) {
            try {
                const service = await queryInstance(serviceName);

                if (!service) continue;

                logger.debug(
                    `Monitoring service readiness for ${serviceName}. Current state: ${service.state}`
                );

                // TODO: Track deployment failures after a reasonable amount of time has elapsed
                if (service?.state === ContainerServiceState.READY) {
                    logger.info(`Service ready: ${serviceName}`);
                    list.push(serviceName);
                    eventBus.emit(EventName.ServiceIsReady, service);
                }
            } catch (err: any) {
                logger.error(err.message);
            }
        }

        this.watchList = this.watchList.filter(({ serviceName }) => !list.includes(serviceName));

        this.unwatch();
    }
}
