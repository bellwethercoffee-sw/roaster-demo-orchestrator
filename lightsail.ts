import {
    ContainerService,
    CreateContainerServiceCommand,
    CreateContainerServiceDeploymentCommand,
    DeleteContainerServiceCommand,
    GetContainerServicesCommand,
    GetContainerServicesCommandOutput,
} from '@aws-sdk/client-lightsail';
import {
    GetRepositoryPolicyCommand,
    GetRepositoryPolicyCommandOutput,
    SetRepositoryPolicyCommand,
} from '@aws-sdk/client-ecr';
import { createECRClient, createLightsailClient } from './config/aws';
import { eventBus, EventName } from './event-bus';
import { logger } from './logger';

const serviceNamePrefix = 'roaster-app-demo';
const image = '025870537499.dkr.ecr.us-east-1.amazonaws.com/roaster-app:web-demo';
const servicePort = '8000';

export const createServiceName = (clientId: string): string => {
    return `${serviceNamePrefix}-${clientId}`;
};

export const createInstance = async (identifier: string) => {
    const lightsail = await createLightsailClient();

    const serviceName = createServiceName(identifier);
    try {
        const data = await lightsail.send(
            new CreateContainerServiceCommand({
                serviceName,
                scale: 1,
                power: 'micro',
                tags: [{ key: 'creator', value: 'orchestrator' }],
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
        console.error(error.$metadata);
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

        const policy = JSON.parse(o.policyText || '');
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

export const removeRepositoryPolicy = async (serviceName: string) => {
    try {
        const o = await getRepositoryPolicy();

        const policy = JSON.parse(o.policyText || '');
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
