import { ContainerService, Tag } from '@aws-sdk/client-lightsail';
import fetch from 'cross-fetch';
import { AUTO_DESTROY_INACTIVITY_THRESHOLD_MIN, TAG_HOT_INSTANCE_KEY } from '../config';
import { eventBus, EventName } from '../event-bus';
import { deleteInstance, queryInstance } from '../lightsail';
import { logger } from '../logger';
import AbstractWatcher from './AbstractWatcher';

interface LastUserActivityResponse {
    timestamp: string;
    route: string;
    method: string;
    uptime: number;
}

export class AutoDestroyerWatcher extends AbstractWatcher {
    readonly CHECK_INTERVAL = 1000 * 60;

    public constructor() {
        super();

        eventBus.on(EventName.DeploymentRunning, (serviceName: string, url: string) => {
            this.watch({ serviceName, url });
        });
    }

    private async isClaimed(serviceName: string): Promise<boolean> {
        try {
            const list = await queryInstance(serviceName);
            const service = <ContainerService>list?.containerServices![0];

            return (
                service.tags?.filter((t: Tag) => {
                    return t.key === TAG_HOT_INSTANCE_KEY;
                }).length === 0
            );
        } catch (error) {
            return true;
        }
    }

    public async watch({ serviceName, url }: { serviceName: string; url: string }) {
        const isHotInstance = serviceName.includes('hot');
        if (isHotInstance && !(await this.isClaimed(serviceName))) {
            logger.info(`Ignoring hot instance ${serviceName} for auto deletion monitoring`);
            return;
        }

        logger.info(`Adding service ${serviceName} to be monitored for auto deletion`);

        this.watchList.push({
            serviceName,
            url,
            startedWatchAt: new Date(),
        });
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this.monitor();
        }, this.CHECK_INTERVAL);
    }

    private shouldDestroy(inactivityDurationMins: number): boolean {
        return inactivityDurationMins >= AUTO_DESTROY_INACTIVITY_THRESHOLD_MIN;
    }

    private async monitor() {
        const list: string[] = [];
        logger.info(`Checking services that can be auto deleted. Count ${this.watchList.length}`);

        for (const { url, serviceName, startedWatchAt } of this.watchList) {
            try {
                logger.info(`Querying service ${serviceName} @ ${url}api/last-user-activity`);
                const response = await fetch(`${url}api/last-user-activity`);

                // if (!response.ok) continue;

                const data = <LastUserActivityResponse>await response.json();
                const noUserActivityDetected = !data.timestamp;
                const now = new Date();
                let lastTimestamp = noUserActivityDetected
                    ? startedWatchAt
                    : new Date(data.timestamp);

                const elapsedTime = this.getElapsedTimeMins(now, lastTimestamp);

                logger.debug(data);
                logger.info(
                    `Auto deletion check for ${serviceName}. Last user activity: ${lastTimestamp.toISOString()} Inactive period ${elapsedTime}mins`
                );

                if (!this.shouldDestroy(elapsedTime)) continue;

                logger.info(
                    `Auto deleting ${serviceName}. Last user activity: ${lastTimestamp.toISOString()} Inactive period ${elapsedTime}mins`
                );
                deleteInstance(serviceName);
                list.push(serviceName);
                eventBus.emit(EventName.ServiceDeleted, serviceName);
            } catch (err: any) {
                logger.error(err.message);
            }
        }

        this.watchList = this.watchList.filter(({ serviceName }) => !list.includes(serviceName));

        this.unwatch();
    }
}
