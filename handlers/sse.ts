import { ContainerService } from '@aws-sdk/client-lightsail';
import { Request, Response } from 'express';
import { eventBus, EventName } from '../event-bus';
import { logger } from '../logger';

export let clients: any[] = [];
export const eventsHandler = (request: Request, response: Response) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
    };

    const clientId = request.query.clientId;
    logger.debug(`Client ID: ${clientId}`);
    response.writeHead(200, headers);
    eventBus.on(EventName.ServiceCreated, (serviceName: string) => {
        const data = `data: ${JSON.stringify({
            event: EventName.ServiceCreated,
            serviceName,
        })}\n\n`;

        response.write(data);
    });
    eventBus.on(EventName.ServiceDeleted, (serviceName: string) => {
        const data = `data: ${JSON.stringify({
            event: EventName.ServiceDeleted,
            serviceName,
        })}\n\n`;

        response.write(data);
    });
    eventBus.on(EventName.DeploymentRunning, (serviceName: string, url: string) => {
        const data = `data: ${JSON.stringify({
            event: EventName.DeploymentRunning,
            serviceName,
            url,
        })}\n\n`;

        response.write(data);
    });
    eventBus.on(EventName.DeploymentStarted, (service: ContainerService) => {
        const data = `data: ${JSON.stringify({
            event: EventName.DeploymentStarted,
            serviceName: service.containerServiceName,
        })}\n\n`;

        response.write(data);
    });

    const data = `event: id\ndata: ${JSON.stringify({ id: clientId })}\n\n`;

    response.write(data);

    const newClient = {
        id: clientId,
        response,
    };

    clients.push(newClient);

    request.on('close', () => {
        console.log(`${clientId} Connection closed`);
        clients = clients.filter((client) => client.id !== clientId);
    });
};
