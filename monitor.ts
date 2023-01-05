import { ContainerService, ContainerServiceState } from '@aws-sdk/client-lightsail';

import { eventBus, EventName } from './event-bus';
import { queryInstance, deploy } from './lightsail';
import { logger } from './logger';

class Monitor {
    private newServiceList: string[];
    private deploymentList: string[];

    private deploymentTimer: any;
    private serviceTimer: any;

    public constructor() {
        this.newServiceList = [];
        this.deploymentList = [];

        eventBus.on(EventName.ServiceCreated, (serviceName) => {
            logger.debug(`Service created ${serviceName}`);
            this.serviceCreatedHandler(serviceName);
        });
        eventBus.on(EventName.ServiceIsReady, (serviceName, service) =>
            this.deploymentHandler(serviceName, service)
        );
    }

    public start() {}

    private watchService() {
        if (this.serviceTimer) return;

        logger.debug('Watching service creation completion');
        this.serviceTimer = setInterval(() => {
            this.checkNewServiceReadiness();
        }, 1000 * 60 * 1);
    }

    private unwatchService() {
        if (this.newServiceList.length > 0) return;

        clearInterval(this.serviceTimer);
    }

    private watchDeployment() {
        if (this.deploymentTimer) return;

        this.deploymentTimer = setInterval(() => {
            this.checkDeploymentReadiness();
        }, 1000 * 60 * 1);
    }

    private unwatchDeployment() {
        if (this.deploymentList.length > 0) return;

        clearInterval(this.deploymentTimer);
    }

    // TODO: Might need to add other fields
    private serviceCreatedHandler(serviceName: string) {
        this.newServiceList.push(serviceName);
        this.watchService();
    }

    private async deploymentHandler(serviceName: string, service: ContainerService) {
        logger.debug(`Running a deployment for the service ${serviceName}`);

        try {
            await deploy(service);
            this.deploymentList.push(serviceName);
            this.watchDeployment();
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
                const service = response?.containerServices![0] as ContainerService;
                logger.debug(
                    `Monitoring service readiness for ${serviceName}. State: ${service.state}`
                );

                if (service?.state === ContainerServiceState.READY) {
                    eventBus.emit(EventName.ServiceIsReady, serviceName, service);
                    readyList.push(serviceName);
                }
            } catch (err: any) {
                logger.error(err.message);
            }
        }

        this.newServiceList = this.newServiceList.filter(
            (serviceName) => !readyList.includes(serviceName)
        );

        this.unwatchService();
    }

    private async checkDeploymentReadiness() {
        logger.debug(`Checking deployment(s) readiness: ${this.deploymentList.length}`);
        if (this.deploymentList.length === 0) return;
        const readyList: string[] = [];

        for (const serviceName of this.deploymentList) {
            try {
                const response = await queryInstance(serviceName);

                const service = response?.containerServices![0] as ContainerService;
                logger.debug(
                    `Monitoring deployment readiness for ${serviceName}. State: ${service.state}`
                );

                // TODO: Track deployment failures after a reasonable amount of time has elapsed
                if (service?.state === ContainerServiceState.RUNNING) {
                    logger.info(`Service ${serviceName} is running`);
                    eventBus.emit(EventName.DeploymentIsReady, serviceName, service.url);
                    readyList.push(serviceName);
                }
            } catch (err: any) {
                logger.error(err.message);
            }
        }

        this.deploymentList = this.deploymentList.filter(
            (serviceName) => !readyList.includes(serviceName)
        );

        this.unwatchDeployment();
    }
}

export const monitor = new Monitor();
