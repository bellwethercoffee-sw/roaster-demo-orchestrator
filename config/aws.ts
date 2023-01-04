import { STSClient, AssumeRoleCommand, Credentials } from '@aws-sdk/client-sts';
import { LightsailClient } from '@aws-sdk/client-lightsail';

import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ASSUME_ROLE_ARN, AWS_REGION } from '.';
import { ECRClient } from '@aws-sdk/client-ecr';

const REQUEST_DELAY = 5;
const endpoint = null; // LOCALSTACK_ENDPOINT_URL
const region = AWS_REGION;

let credentials: any = null;
const logger = console;

const getConfig = () => {
    const config: any = {
        region,
    };

    if (AWS_ACCESS_KEY_ID) config.accessKeyId = AWS_ACCESS_KEY_ID;
    if (AWS_SECRET_ACCESS_KEY) config.secretAccessKey = AWS_SECRET_ACCESS_KEY;
    if (endpoint) config.endpoint = endpoint;

    return config;
};

export const requestTemporaryCredentials = async () => {
    const config = getConfig();

    const client = new STSClient({ ...config });
    const command = new AssumeRoleCommand({
        RoleArn: AWS_ASSUME_ROLE_ARN,
        RoleSessionName: 'orchestrator-app',
        DurationSeconds: 60 * 15,
    });

    // logger.debug('Accessing temporary permission');
    // logger.debug(config);
    try {
        const data = await client.send(command);
        logger.debug('New credentials');
        logger.debug(data);
        return data;
    } catch (error) {
        console.error(error);

        return null;
    }
};

// @TODO: rename to credentialsHasExpired or expiredCredentials
const credentialsHasNotExpired = (credentials: any): boolean => {
    logger.debug('Checking if there is a valid credentail to use');
    if (!credentials.Expiration) return false;

    const now = new Date().getTime();
    const expiration = credentials.Expiration.getTime();

    return expiration - now > REQUEST_DELAY;
};

const validCredentialsAvailable = (credentials: Credentials): boolean => {
    return !credentials ? false : credentialsHasNotExpired(credentials);
};

const extractConfigForServiceCall = (credentials: any) => {
    const {
        AccessKeyId: accessKeyId,
        SecretAccessKey: secretAccessKey,
        SessionToken: sessionToken,
    } = credentials;

    const config: any = {
        region: AWS_REGION,
        accessKeyId,
        secretAccessKey,
        sessionToken,
    };

    if (endpoint) config.endpoint = endpoint;

    return config;
};

const getOrRequestCredentials = async () => {
    if (!validCredentialsAvailable(credentials)) {
        logger.debug('Requesting temporary credentials from AWS Security Token Service (STS)');

        try {
            credentials = (await requestTemporaryCredentials())?.Credentials;
        } catch (err: any) {
            logger.error(err, err.stack);
        }
    }

    return credentials;
};

const getConfigForService = async () => {
    let config;

    if (AWS_ASSUME_ROLE_ARN) {
        credentials = await getOrRequestCredentials();
        config = extractConfigForServiceCall(credentials);
    } else {
        config = getConfig();
    }

    return config;
};

export const createLightsailClient = async (): Promise<LightsailClient> => {
    let config;

    if (AWS_ASSUME_ROLE_ARN) {
        credentials = await getOrRequestCredentials();
        config = extractConfigForServiceCall(credentials);
    } else {
        config = getConfig();
    }

    return new LightsailClient({
        apiVersion: '2016-11-28',
        credentials: config,
    });
};

export const createECRClient = async (): Promise<ECRClient> => {
    return new ECRClient({
        // apiVersion: '2016-11-28',
        credentials: await getConfigForService(),
    });
};

// export { createLightsailClient };
