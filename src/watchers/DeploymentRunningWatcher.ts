import { ContainerService, ContainerServiceState } from '@aws-sdk/client-lightsail';
import { eventBus, EventName } from '../event-bus';
import { queryInstance } from '../lightsail';
import { logger } from '../logger';
import AbstractWatcher from './AbstractWatcher';

export class DeploymentRunningWatcher extends AbstractWatcher {
    readonly CHECK_INTERVAL = 1000 * 30;

    public constructor() {
        super();

        eventBus.on(EventName.DeploymentStarted, (service: ContainerService) => {
            this.watch(<string>service.containerServiceName);
        });
    }

    public watch(serviceName: string) {
        logger.info(`Adding service ${serviceName} to be monitored for deployment completion`);

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
        logger.debug(`Checking deployment(s) is/are running.  Count ${this.watchList.length}`);
        if (this.watchList.length === 0) return;

        const list: string[] = [];

        for (const { serviceName } of this.watchList) {
            try {
                const response = await queryInstance(serviceName);

                const service = <ContainerService>response?.containerServices![0];
                logger.debug(
                    `Monitoring deployment readiness for ${serviceName}. Current state: ${service.state}`
                );

                // TODO: Track deployment failures after a reasonable amount of time has elapsed
                if (service?.state === ContainerServiceState.RUNNING) {
                    logger.info(`Service running: ${serviceName}`);
                    list.push(serviceName);
                    eventBus.emit(EventName.DeploymentRunning, serviceName, service.url);
                }
            } catch (err: any) {
                logger.error(err.message);
            }
        }

        this.watchList = this.watchList.filter(({ serviceName }) => !list.includes(serviceName));

        this.unwatch();
    }
}
