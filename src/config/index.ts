const { env } = process;
const PORT = env.PORT || 3000;

const AWS_REGION = env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
const AWS_ASSUME_ROLE_ARN = env.AWS_ASSUME_ROLE_ARN;

const AUTO_DESTROY_INACTIVITY_THRESHOLD_MIN = env.AUTO_DESTROY_INACTIVITY_THRESHOLD_MIN || 30;

const OAUTH_URL = env.OAUTH_URL || 'https://auth.eng.bellwether.link';
const OAUTH_CLIENT_ID = env.OAUTH_CLIENT_ID || 'vkpruk2fpkbg15a750qlb5ve5';
const OAUTH_CLIENT_SECRET = env.OAUTH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI =
    env.OAUTH_REDIRECT_URI || 'https://roaster-app-web-orchestrator.eng.bellwether.link/';

const TAG_HOT_INSTANCE_KEY = 'hot-instance';
const TAG_ORCHESTRATOR_KEY = 'orchestrator';
const TAG_EMAIL_KEY = 'email';

const ACCOUNT_ID = env.ACCOUNT_ID;
const SERVICE_DOCKER_IMAGE =
    env.DOCKER_IMAGE || `${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/roaster-app:web-demo`;
const SERVICE_PORT = env.SERVICE_PORT || '8000';
const SERVICE_NAME_PREFIX = 'roaster-app';

export {
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_ASSUME_ROLE_ARN,
    AUTO_DESTROY_INACTIVITY_THRESHOLD_MIN,
    PORT,
    OAUTH_URL,
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI,
    SERVICE_DOCKER_IMAGE,
    SERVICE_NAME_PREFIX,
    SERVICE_PORT,
    TAG_EMAIL_KEY,
    TAG_HOT_INSTANCE_KEY,
    TAG_ORCHESTRATOR_KEY,
};
