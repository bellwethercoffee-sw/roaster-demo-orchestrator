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
};
