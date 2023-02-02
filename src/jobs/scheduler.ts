import { CronJob } from 'cron';

import { logger } from '../logger';
import { HotInstanceDeploymentJob } from './HotInstanceDeploymentJob';

const hotInstanceDeploymentJob = new HotInstanceDeploymentJob();

export default () => {
    logger.info('Scheduling jobs');

    // Runs every midnight from Monday - Friday
    const job = new CronJob('00 00 00 * * 1-5', function () {
        hotInstanceDeploymentJob.run();
    });

    job.start();
};
