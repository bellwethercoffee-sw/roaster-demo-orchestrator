import { ContainerService, ContainerServiceState } from '@aws-sdk/client-lightsail';

import { eventBus, EventName } from './event-bus';
import { queryInstance, deploy } from './lightsail';
import { logger } from './logger';

class Monitor {
    private newServiceList: string[];

    public constructor() {
        this.newServiceList = [];

        eventBus.on(EventName.ServiceCreated, (serviceName) =>
            this.serviceCreatedHandler(serviceName)
        );
        eventBus.on(EventName.ServiceIsReady, (serviceName, service) =>
            this.deploymentHandler(serviceName, service)
        );
    }

    public start() {
        setInterval(() => {
            this.checkNewServiceReadiness();
        }, 1000 * 60);
    }

    // TODO: Might need to add other fields
    private serviceCreatedHandler(serviceName: string) {
        this.newServiceList.push(serviceName);
    }

    private async deploymentHandler(serviceName: string, service: any) {
        logger.debug(`Running a deployment for the service ${serviceName}`);

        try {
            await deploy(serviceName, service);
        } catch (err: any) {
            logger.error(err.message);
        }
    }

    private async checkNewServiceReadiness() {
        logger.debug(`Checking service(s) readiness: ${this.newServiceList.length}`);
        if (this.newServiceList.length === 0) return;
        const readyList: string[] = [];

        for (const serviceName of this.newServiceList) {
            try {
                const response = await queryInstance(serviceName);
                logger.debug(`Monitoring service readiness for ${serviceName}`);
                logger.debug(response);
                const service = response?.containerServices![0] as ContainerService;

                if (service?.state === ContainerServiceState.READY) {
                    logger.debug(
                        'ARN',
                        service.privateRegistryAccess?.ecrImagePullerRole?.principalArn
                    );
                    eventBus.emit(EventName.ServiceIsReady, serviceName, service);
                    readyList.push(serviceName);
                }
            } catch (err: any) {
                logger.error(err.message);
            }
        }
        // this.newServiceList.forEach(async (serviceName) => {
        //     try {
        //         const response = await queryInstance(serviceName);
        //         logger.debug(`Monitoring service readiness for ${serviceName}`);
        //         logger.debug(response);
        //         const service = response?.containerServices![0] as ContainerService;

        //         if (service?.state === ContainerServiceState.READY) {
        //             logger.debug(
        //                 'ARN',
        //                 service.privateRegistryAccess?.ecrImagePullerRole?.principalArn
        //             );
        //             eventBus.emit(EventName.ServiceIsReady, serviceName);
        //             readyList.push(serviceName);
        //         }
        //     } catch (err: any) {
        //         logger.error(err.message);
        //     }
        // });

        this.newServiceList = this.newServiceList.filter(
            (serviceName) => !readyList.includes(serviceName)
        );
    }
}

export const monitor = new Monitor();
