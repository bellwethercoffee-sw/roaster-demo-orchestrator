import EventEmitter from 'events';

export enum EventName {
    ServiceCreated = 'ServiceCreated',
    ServiceIsReady = 'ServiceIsReady',
    DeploymentStarted = 'DeploymentStarted',
    DeploymentIsReady = 'DeploymentIsReady',
}

class EventBus extends EventEmitter {}

export const eventBus = new EventBus();
