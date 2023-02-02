import { Tag } from '@aws-sdk/client-lightsail';

import { TAG_HOT_INSTANCE_KEY } from '../config';
import { deploy, findManagedInstances } from '../lightsail';
import { logger } from '../logger';

export class HotInstanceDeploymentJob {
    // public constructor() {}

    public async run() {
        logger.info(`HotInstanceDeploymentJob running`);
        try {
            let list = await findManagedInstances();
            list = list?.filter((containerService) => {
                return !!containerService.tags?.find((t: Tag) => {
                    return t.key === TAG_HOT_INSTANCE_KEY;
                });
            });

            list.forEach((containerService) => {
                deploy(containerService);
            });
        } catch (error: any) {
            logger.error(`Running HotInstanceDeploymentJob failed. Reason: ${error.message}`);
        }
    }
}
