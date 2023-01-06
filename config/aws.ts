import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { LightsailClient, LightsailClientConfig } from '@aws-sdk/client-lightsail';
import { ECRClient, ECRClientConfig } from '@aws-sdk/client-ecr';

import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ASSUME_ROLE_ARN, AWS_REGION } from '.';
import { logger } from '../logger';

const REQUEST_DELAY = 5;
const endpoint = null; // LOCALSTACK_ENDPOINT_URL
const region = AWS_REGION;

let credentials: any = null;

const getConfig = () => {
    const config: any = {};

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
        DurationSeconds: 60 * 60,
    });

    try {
        const data = await client.send(command);
        logger.debug('New credentials');

        return data;
    } catch (error) {
        logger.error(error);

        return null;
    }
};

const validCredentialsAvailable = (credentials: any): boolean => {
    logger.debug('Checking if there is a valid credentail to use');
    if (!credentials || !credentials.Expiration) return false;

    const now = new Date().getTime();
    const expiration = credentials.Expiration.getTime();

    return expiration - now > REQUEST_DELAY;
};

const formatCredentials = (credentials: any) => {
    const {
        AccessKeyId: accessKeyId,
        SecretAccessKey: secretAccessKey,
        SessionToken: sessionToken,
    } = credentials;

    const config: any = {
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

const getCredentialsForServiceCall = async () => {
    const useAccessKey = !!AWS_ACCESS_KEY_ID && !!AWS_SECRET_ACCESS_KEY;
    const useAssumeRole = !!AWS_ASSUME_ROLE_ARN;

    let formattedCredentials: any = null;
    if (useAssumeRole) {
        credentials = await getOrRequestCredentials();
        formattedCredentials = formatCredentials(credentials);
    } else if (useAccessKey) {
        formattedCredentials = getConfig();
    }

    return formattedCredentials;
};

export const createLightsailClient = async (): Promise<LightsailClient> => {
    let config: LightsailClientConfig = {
        apiVersion: '2016-11-28',
        region,
    };

    const credentails = await getCredentialsForServiceCall();
    if (credentails) config.credentials = credentails;

    return new LightsailClient(config);
};

export const createECRClient = async (): Promise<ECRClient> => {
    const config: ECRClientConfig = {
        apiVersion: '2015-09-21',
        region,
    };

    const credentails = await getCredentialsForServiceCall();
    if (credentails) config.credentials = credentails;

    return new ECRClient(config);
};
