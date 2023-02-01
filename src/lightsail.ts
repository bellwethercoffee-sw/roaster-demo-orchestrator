import {
    ContainerService,
    ContainerServiceState,
    CreateContainerServiceCommand,
    CreateContainerServiceDeploymentCommand,
    DeleteContainerServiceCommand,
    GetContainerServicesCommand,
    GetContainerServicesCommandOutput,
    Tag,
    TagResourceCommand,
    UntagResourceCommand,
} from '@aws-sdk/client-lightsail';
import {
    GetRepositoryPolicyCommand,
    GetRepositoryPolicyCommandOutput,
    SetRepositoryPolicyCommand,
} from '@aws-sdk/client-ecr';
import { createECRClient, createLightsailClient } from './config/aws';
import { eventBus, EventName } from './event-bus';
import { logger } from './logger';
import { TAG_EMAIL_KEY, TAG_HOT_INSTANCE_KEY, TAG_ORCHESTRATOR_KEY } from './config';

const serviceNamePrefix = 'roaster-app';
const image = '025870537499.dkr.ecr.us-east-1.amazonaws.com/roaster-app:web-demo';
const servicePort = '8000';

export const createServiceName = (clientId: string): string => {
    return `${serviceNamePrefix}-${clientId}`;
};

export const createInstance = async (identifier: string, additionalTags?: Map<string, string>) => {
    const lightsail = await createLightsailClient();
    const serviceName = createServiceName(identifier);

    const tags: Tag[] = [{ key: TAG_ORCHESTRATOR_KEY }];
    additionalTags?.forEach((value, key) => {
        tags.push({ key, value });
    });

    try {
        const data = await lightsail.send(
            new CreateContainerServiceCommand({
                serviceName,
                scale: 1,
                power: 'micro',
                tags: tags,
                privateRegistryAccess: {
                    ecrImagePullerRole: {
                        isActive: true,
                    },
                },
            })
        );

        eventBus.emit(EventName.ServiceCreated, serviceName);
        return data;
    } catch (error) {
        logger.error(error);
        return null;
    }
};

export const deploy = async (service: ContainerService) => {
    const lightsail = await createLightsailClient();

    try {
        const serviceName = <string>service.containerServiceName;
        const principalArn = <string>(
            service.privateRegistryAccess?.ecrImagePullerRole?.principalArn
        );
        await attachRepositoryPolicy(serviceName, principalArn);

        const data = await lightsail.send(
            new CreateContainerServiceDeploymentCommand({
                serviceName,
                containers: {
                    [serviceName]: {
                        image: image,
                        ports: {
                            [servicePort]: 'HTTP',
                        },
                    },
                },
                publicEndpoint: {
                    containerName: serviceName,
                    containerPort: Number(servicePort),
                    healthCheck: {
                        healthyThreshold: 2,
                        intervalSeconds: 5,
                        path: '/',
                        successCodes: '200-499',
                        timeoutSeconds: 2,
                        unhealthyThreshold: 2,
                    },
                },
            })
        );

        return data;
    } catch (error) {
        logger.error(error);
        return null;
    }
};

// TODO: Simply return a ContainerService
export const queryInstance = async (
    serviceName: string
): Promise<GetContainerServicesCommandOutput> => {
    try {
        const lightsail = await createLightsailClient();
        const data = await lightsail.send(
            new GetContainerServicesCommand({
                serviceName,
            })
        );

        // console.log(data);
        return data;
    } catch (error: any) {
        // console.error(error.$metadata);
        throw error;
    }
};

const findHotInstance = (list: ContainerService[]) => {
    return list?.find((containerService) => {
        return !!containerService.tags?.find((t: Tag) => {
            return t.key === TAG_HOT_INSTANCE_KEY;
        });
    });
};

const findUserInstance = (list: ContainerService[], email: string) => {
    return list?.find((containerService) => {
        return !!containerService.tags?.find((t: Tag) => {
            return t.key === TAG_EMAIL_KEY && t.value === email;
        });
    });
};

export const queryInstanceV2 = async (email: string): Promise<ContainerService | null> => {
    try {
        const lightsail = await createLightsailClient();
        const data = await lightsail.send(new GetContainerServicesCommand({}));

        const containerServices = <ContainerService[]>data.containerServices;
        return (
            findUserInstance(containerServices, email) || findHotInstance(containerServices) || null
        );
    } catch (error: any) {
        // console.error(error.$metadata);
        throw error;
    }
};

export const getUserInstance = async (email: string): Promise<ContainerService | null> => {
    try {
        const lightsail = await createLightsailClient();
        const data = await lightsail.send(new GetContainerServicesCommand({}));

        const containerServices = <ContainerService[]>data.containerServices;

        const containerService =
            findUserInstance(containerServices, email) ||
            findHotInstance(containerServices) ||
            null;

        const hotInstanceTag = containerService?.tags?.find((t: Tag) => {
            return t.key === TAG_HOT_INSTANCE_KEY;
        });

        if (hotInstanceTag && containerService?.state === ContainerServiceState.RUNNING) {
            claimHotInstance(containerService, email);
            eventBus.emit(
                EventName.DeploymentRunning,
                containerService.containerServiceName,
                containerService.url
            );
        }

        return containerService;
    } catch (error: any) {
        // console.error(error.$metadata);
        throw error;
    }
};

const claimHotInstance = async (containerService: ContainerService, email: string) => {
    try {
        const lightsail = await createLightsailClient();
        await lightsail.send(
            new UntagResourceCommand({
                resourceArn: containerService.arn,
                resourceName: containerService.containerServiceName,
                tagKeys: [TAG_HOT_INSTANCE_KEY],
            })
        );

        await lightsail.send(
            new TagResourceCommand({
                resourceArn: containerService.arn,
                resourceName: containerService.containerServiceName,
                tags: [{ key: TAG_EMAIL_KEY, value: email }],
            })
        );

        eventBus.emit(EventName.HotInstanceClaimed);
    } catch (error: any) {
        throw error;
    }
};

export const queryHotInstance = async (): Promise<ContainerService | null> => {
    try {
        const lightsail = await createLightsailClient();
        const data = await lightsail.send(new GetContainerServicesCommand({}));

        const containerServices = <ContainerService[]>data.containerServices;
        return findHotInstance(containerServices) || null;
    } catch (error: any) {
        throw error;
    }
};

export const findManagedInstances = async (): Promise<ContainerService[]> => {
    try {
        const lightsail = await createLightsailClient();
        const data = await lightsail.send(new GetContainerServicesCommand({}));

        const containerServices = <ContainerService[]>data.containerServices;

        return containerServices?.filter((containerService) => {
            return !!containerService.tags?.find((t: Tag) => {
                return t.key === TAG_ORCHESTRATOR_KEY;
            });
        });
    } catch (error: any) {
        // console.error(error.$metadata);
        throw error;
    }
};

export const deleteInstance = async (serviceName: string) => {
    // const serviceName = `${serviceNamePrefix}-${identifier}`;

    try {
        removeRepositoryPolicy(serviceName);

        const lightsail = await createLightsailClient();
        const data = await lightsail.send(
            new DeleteContainerServiceCommand({
                serviceName,
            })
        );

        eventBus.emit(EventName.ServiceDeleted, serviceName);
        // console.log(data);
        return true;
    } catch (error) {
        logger.error(error);
        return false;
    }
};

const getRepositoryPolicy = async (): Promise<GetRepositoryPolicyCommandOutput> => {
    try {
        const client = await createECRClient();
        const response = await client.send(
            new GetRepositoryPolicyCommand({
                repositoryName: 'roaster-app',
            })
        );

        // console.log(response);
        const policy = JSON.parse(response?.policyText || '');
        // logger.log(policy);
        // logger.log(JSON.stringify(policy));
        return response;
    } catch (error) {
        logger.error(error);
        throw error;
    }
};

export const attachRepositoryPolicy = async (serviceName: string, principalArn: string) => {
    logger.debug('Attaching policy...');
    try {
        const o = await getRepositoryPolicy();

        const policy = sanitizePolicy(<string>o.policyText);

        policy.Statement.push({
            Sid: `AllowLightsailPull-${serviceName}`,
            Effect: 'Allow',
            Principal: {
                AWS: principalArn,
            },
            Action: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
        });
        const client = await createECRClient();
        const response = await client.send(
            new SetRepositoryPolicyCommand({
                registryId: o.registryId,
                repositoryName: 'roaster-app',
                policyText: JSON.stringify(policy),
            })
        );

        return response;
    } catch (error) {
        logger.error(error);
        throw error;
    }
};

const sanitizePolicy = (policyText: string): any => {
    const policy = JSON.parse(policyText);
    const ignoreInvalidIAMPredicate = (permission: any) =>
        (<string>permission?.Principal?.AWS).startsWith('arn:aws:iam');

    policy.Statement = policy.Statement.filter(ignoreInvalidIAMPredicate);

    return policy;
};

export const removeRepositoryPolicy = async (serviceName: string) => {
    try {
        const o = await getRepositoryPolicy();

        const policy = sanitizePolicy(<string>o.policyText);
        policy.Statement = policy.Statement.filter(
            (permission: any) => !(<string>permission.Sid).endsWith(serviceName)
        );

        const client = await createECRClient();
        const response = await client.send(
            new SetRepositoryPolicyCommand({
                registryId: o.registryId,
                repositoryName: 'roaster-app',
                policyText: JSON.stringify(policy),
            })
        );

        // console.log(response);
        // const policy = JSON.parse(response?.policyText || '');
        // logger.log(policy);
        // logger.log(JSON.stringify(policy));
        return response;
    } catch (error) {
        logger.error(error);
        throw error;
    }
};
