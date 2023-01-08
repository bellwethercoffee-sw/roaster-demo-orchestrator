import fetch from 'cross-fetch';
import { AUTO_DESTROY_INACTIVITY_THRESHOLD_MIN } from '../config';
import { eventBus, EventName } from '../event-bus';
import { deleteInstance } from '../lightsail';
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

    public watch({ serviceName, url }: { serviceName: string; url: string }) {
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
            } catch (err: any) {
                logger.error(err.message);
            }
        }

        this.watchList = this.watchList.filter(({ serviceName }) => !list.includes(serviceName));

        this.unwatch();
    }
}
