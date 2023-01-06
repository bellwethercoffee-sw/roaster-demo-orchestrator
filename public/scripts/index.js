let clientId
let serviceName

const EVENT_SERVICE_CREATED = 'ServiceCreated'
const EVENT_DEPLOYMENT_RUNNING = 'DeploymentIsReady'

class ClientIdStore {
    static KEY = 'clientId'

    write(clientId) {
        sessionStorage.setItem(ClientIdStore.KEY, clientId)
    }

    read() {
        return sessionStorage.getItem(ClientIdStore.KEY)
    }

    clear() {
        sessionStorage.removeItem(ClientIdStore.KEY)
        clientId = null
    }
}

const store = new ClientIdStore()

window.addEventListener('load', async () => {
    clientId = store.read();

    if (clientId) {
        const service = await findService(clientId)

        if (service) {
            serviceName = service.containerServiceName;
            showUrl(service.url)
        }
    } else {
        clientId = generateClientId();
        store.write(clientId)
    }

    const evtSource = new EventSource(`/events?clientId=${clientId}`);

    evtSource.addEventListener('id', (event) => {
        console.log('Id event');
        const id = JSON.parse(event.data).id;

        if (clientId === id) {
            // identifier = id
            console.debug(`Client confirmed: ${clientId} -> ${id}`);
        }
    });

    evtSource.onmessage = (event) => {
        console.info('Message received')
        const data = JSON.parse(event.data)

        if (data.event === EVENT_SERVICE_CREATED && data.serviceName.endsWith(clientId)) {
            console.debug(`Service created with name ${data.serviceName}`)
            serviceName = data.serviceName;
        }
        if (data.event === EVENT_DEPLOYMENT_RUNNING && data.serviceName.endsWith(clientId)) {
            showUrl(data.url)
        }
        console.log(event);
    };

    document.querySelector('#btn-create').addEventListener('click', createHandler)
    document.querySelector('#btn-delete').addEventListener('click', deleteHandler)
});

const showUrl = (url) => {
    console.debug(`Here is your url: ${url}`)
    document.querySelector('#url').innerHTML = `<a href="${url}" target="_blank">${url}</a>`
}
const removeUrl = () => {
    document.querySelector('#url').innerHTML = ''
}

const findService = async (clientId) => {
    console.debug(`Find service with identifier ${clientId}`)

    try {
        const response = await fetch(`/instance?clientId=${clientId}`, {
            headers: { 'Content-Type': 'application/json' }
        })

        const data = await response.json()

        if (response.ok) {
            console.debug(data)
            return data
        }

        return null
    } catch (err) {
        console.error(`Error when finding an instance failed. Reason: ${err.message}`)
        return null
    }
}

const createHandler = async () => {
    console.log('Creating... for', clientId)
    if (!clientId) {
        console.info(`Sorry, you cannot destroy what you have not created: ${clientId}`)
        return
    }

    try {
        const response = await fetch('/instance', {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify({ clientId })
        })

        const data = await response.json()
        console.debug(data)
    } catch (err) {
        alert(`Creating an instance failed. Reason: ${err.message}`)
    }
}

const deleteHandler = async () => {
    if (!serviceName) {
        alert("Sorry, this operation is only possible after you've sucessfully created one.")
        return
    }

    console.info(`Destroying service ${serviceName}`)

    try {
        const response = await fetch('/instance', {
            headers: { 'Content-Type': 'application/json' },
            method: 'DELETE',
            body: JSON.stringify({ serviceName }),
        })

        const data = await response.json()
        console.debug(data)
        serviceName = null
        store.clear()
        removeUrl()

        alert('Destroying the created instance')
    } catch (err) {
        alert(`Destroing the service ${serviceName} failed. Reason: ${err.message}`)
    }
}

function generateClientId() {
    const uint32 = window.crypto.getRandomValues(
        new Uint32Array(1)
    )[0];

    return uint32.toString(16);
}
