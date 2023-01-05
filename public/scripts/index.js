let identifier;
let serviceName;

const EVENT_SERVICE_CREATED = 'ServiceCreated'
const EVENT_DEPLOYMENT_RUNNING = 'DeploymentIsReady'

window.addEventListener('load', () => {
    const clientId = randomId();
    const evtSource = new EventSource(`/events?clientId=${clientId}`);

    evtSource.addEventListener('id', (event) => {
        console.log('Id event');
        const id = JSON.parse(event.data).id;

        if (clientId === id) {
            identifier = id
            console.debug(`Client confirmed: ${clientId} -> ${identifier}`);
        }
    });

    evtSource.onmessage = (event) => {
        console.info('Message received')
        const data = JSON.parse(event.data)

        if (data.event === EVENT_SERVICE_CREATED && data.serviceName.endsWith(identifier)) {
            console.debug(`Service created with name ${data.serviceName}`)
            serviceName = data.serviceName;
        }
        if (data.event === EVENT_DEPLOYMENT_RUNNING && data.serviceName.endsWith(identifier)) {
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

const createHandler = async () => {
    console.log('Creating... for', identifier)
    if (!identifier) {
        console.info(`Sorry, an instance cannot be create if there is no identifier: ${identifier}`)
        return
    }

    try {
        const response = await fetch('/instance', {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify({ identifier })
        })

        const data = await response.json()
        console.debug(data)
    } catch (err) {
        alert(`Creating an instance failed. Reason: ${err.message}`)
    }
}

const deleteHandler = async () => {
    if (!serviceName) {
        console.info(`Sorry, an instance cannot be create if there is no identifier: ${identifier}`);
        alert("Sorry, this operation is only possible after you've sucessfully created one.")
        return
    }

    console.info(`Deleting ${serviceName}`)

    try {
        const response = await fetch('/instance', {
            headers: { 'Content-Type': 'application/json' },
            method: 'DELETE',
            body: JSON.stringify({ serviceName }),
        })

        const data = await response.json()
        console.debug(data)
        serviceName = null
        removeUrl();
    } catch (err) {
        alert(`Deleting an instance failed. Reason: ${err.message}`)
    }
}

function randomId() {
    const uint32 = window.crypto.getRandomValues(
        new Uint32Array(1)
    )[0];

    return uint32.toString(16);
}
