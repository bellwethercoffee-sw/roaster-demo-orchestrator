import EventEmitter from 'events';

export enum EventName {
    ServiceCreationStarted = 'ServiceCreationStarted',
    ServiceCreated = 'ServiceCreated',
    ServiceIsReady = 'ServiceIsReady',
    ServiceDeleted = 'ServiceDeleted',

    DeploymentStarted = 'DeploymentStarted',
    DeploymentRunning = 'DeploymentRunning',

    HotInstanceClaimed = 'HotInstanceClaimed',
}

class EventBus extends EventEmitter {}

export const eventBus = new EventBus();
