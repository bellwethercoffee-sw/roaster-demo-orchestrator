export {};

declare global {
    namespace Express {
        export interface Request {
            // language?: Language;
            user?: any;
        }
    }
}
