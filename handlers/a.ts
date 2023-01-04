import { Request, Response } from 'express';

export let clients: any[] = [];
export const eventsHandler = (request: Request, response: Response) => {
    const headers = {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
    };
    response.writeHead(200, headers);

    // const facts: any = [];
    const clientId = Date.now();

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
