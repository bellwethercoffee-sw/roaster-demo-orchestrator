import EventEmitter from 'events';

export enum EventName {
    ServiceCreated = 'ServiceCreated',
    ServiceIsReady = 'ServiceIsReady',
}

class EventBus extends EventEmitter {}

export const eventBus = new EventBus();
