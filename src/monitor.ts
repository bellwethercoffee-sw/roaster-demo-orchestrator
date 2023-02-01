import { ContainerService, ContainerServiceState } from '@aws-sdk/client-lightsail';

import { eventBus, EventName } from './event-bus';
import { deploy } from './lightsail';
import { logger } from './logger';
import {
    AutoDestroyerWatcher,
    DeploymentRunningWatcher,
    HotInstanceClaimedWatcher,
    ServiceReadyWatcher,
} from './watchers';

export class Monitor {
    public constructor() {
        eventBus.on(EventName.ServiceIsReady, (service) => this.serviceReadyHandler(service));

        new AutoDestroyerWatcher();
        new ServiceReadyWatcher();
        new DeploymentRunningWatcher();
        new HotInstanceClaimedWatcher();
    }

    private async serviceReadyHandler(service: ContainerService) {
        logger.debug(`Running a deployment for the service ${service.containerServiceName}`);

        try {
            await deploy(service);
            eventBus.emit(EventName.DeploymentStarted, service);
        } catch (err: any) {
            logger.error(err.message);
        }
    }
}
