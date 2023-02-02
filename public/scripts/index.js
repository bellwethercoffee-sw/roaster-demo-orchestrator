import fetch from './fetch.js'

let clientId
let serviceName


const EVENT_SERVICE_CREATED = 'ServiceCreated'
const EVENT_SERVICE_READY = 'ServiceIsReady'
const EVENT_SERVICE_DELETED = 'ServiceDeleted'
const EVENT_DEPLOYMENT_RUNNING = 'DeploymentRunning'
const EVENT_DEPLOYMENT_STARTED = 'DeploymentStarted'

const clientSpecificEvents = [
    EVENT_DEPLOYMENT_RUNNING,
    EVENT_DEPLOYMENT_STARTED,
    EVENT_SERVICE_CREATED,
    EVENT_SERVICE_READY,
    EVENT_SERVICE_DELETED,
]

const SUCCESS_ICON = 'assets/images/correct-success-tick-svgrepo-com.svg'
const FAIL_ICON = 'assets/images/wrong-cancel-close-svgrepo-com.svg'
const SPINNER_ICON = 'assets/images/spinner-solid-svgrepo-com.svg'

class ClientIdHelper {
    static KEY = 'clientId'

    write(clientId) {
        sessionStorage.setItem(ClientIdHelper.KEY, clientId)
    }

    read() {
        return sessionStorage.getItem(ClientIdHelper.KEY)
    }

    clear() {
        sessionStorage.removeItem(ClientIdHelper.KEY)
        clientId = null
    }

    static generateClientId() {
        const uint32 = window.crypto.getRandomValues(
            new Uint32Array(1)
        )[0];

        return uint32.toString(16);
    }
}

class ProgressReport {
    IMAGE = 0
    SPAN = 1

    constructor() {
        this.progressReportElem = document.querySelector('#progress-report')

        console.debug(this.progressReportElem)
        this.serviceElem = document.querySelector('#progress-report-service')
        this.deploymentElem = document.querySelector('#progress-report-deployment')
    }

    init() {
        this.#hideElement(this.serviceElem)
        this.#hideElement(this.deploymentElem)
    }

    show() {
        this.progressReportElem.classList.remove('hide')
    }

    hide() {
        setTimeout(() => {
            this.progressReportElem.classList.add('hide')

            this.#hideElement(this.serviceElem)
            this.#hideElement(this.deploymentElem)

        }, 1000)
    }

    #hideElement(elem) {
        elem.classList.add('hide')
    }

    #showElement(elem) {
        elem.classList.remove('hide')
    }

    startServiceCreation() {
        this.show()
        this.#showElement(this.serviceElem)
        this.serviceElem.children[this.IMAGE].src = SPINNER_ICON
    }

    serviceCreated(successful = true) {
        this.show()
        this.#showElement(this.serviceElem)
        this.serviceElem.children[this.IMAGE].src = successful ? SUCCESS_ICON : FAIL_ICON
    }

    deploymentStarted() {
        this.show()
        this.#showElement(this.deploymentElem)
        this.deploymentElem.children[this.IMAGE].src = SPINNER_ICON
    }

    deploymentComplete(successful = true) {
        this.show()
        this.#showElement(this.deploymentElem)

        this.deploymentElem.children[this.IMAGE].src = successful ? SUCCESS_ICON : FAIL_ICON
    }

}

class ServiceCheckReport {
    IMAGE = 0
    SPAN = 1

    constructor() {
        this.elem = document.querySelector('#service-check')
    }

    show() {
        this.#showElement(this.elem)
    }

    hide() {
        setTimeout(() => {
            this.#hideElement(this.elem)
        }, 1000 * 60)
    }

    #hideElement(elem) {
        elem.classList.add('hide')
    }

    #showElement(elem) {
        elem.classList.remove('hide')
    }

    start() {
        this.show()
        this.elem.children[this.IMAGE].src = SPINNER_ICON
        this.elem.children[this.SPAN].textContent = 'Checking if you have an active instance we can immediately serve...'
    }

    end(serviceFound) {
        if (serviceFound) {
            this.elem.children[this.IMAGE].src = SUCCESS_ICON
            this.elem.children[this.SPAN].textContent = 'Instance found. Use this URLs below to experience the app'
        } else {
            this.elem.children[this.IMAGE].src = FAIL_ICON

            let message = 'Sorry, no active instance found for you. '
            message += appConfig.autoCreateInstance ?
                'Creating an instance for you. Kindly wait up to 7 minutes' :
                'Kindly click on the Create button.'

            this.elem.children[this.SPAN].textContent = message
        }

        this.hide()
    }
}

class URLReport {
    constructor() {
        this.elem = document.querySelector('#url-report')
    }

    show(url) {
        this.elem.classList.remove('hide')
        const userActionsUrl = `${url}actions.html`

        document.querySelector('#url-report-app').innerHTML = `<a href="${url}" target="_blank">${url}</a>`
        document.querySelector('#url-report-user-actions').innerHTML = `<a href="${userActionsUrl}" target="_blank">${userActionsUrl}</a>`

        window.open(userActionsUrl, '_blank')
        window.open(url, '_blank')
    }

    hide() {
        this.elem.classList.add('hide')
    }
}

const store = new ClientIdHelper()
const progressReport = new ProgressReport()
const urlReport = new URLReport()
const serviceCheckReport = new ServiceCheckReport()
const appConfig = {
    autoCreateInstance: true,
    showActionButtons: false,
}


const configureApp = () => {
    const debugHosts = ['localhost', '127.0.0.1']
    const inDebugMode = debugHosts.includes(document.location.hostname)

    appConfig.autoCreateInstance = !inDebugMode
    appConfig.showActionButtons = inDebugMode

    if (appConfig.showActionButtons) document.querySelector('#user-actions').classList.remove('hide')
}

const init = async () => {
    configureApp()
    clientId = store.read();

    if (!clientId) {
        clientId = ClientIdHelper.generateClientId();
        store.write(clientId)
    }

    serviceCheckReport.start()
    const service = await findService()

    serviceCheckReport.end(!!service)
    if (service) {
        const CLIENT_ID_POS = 2
        serviceName = service.containerServiceName;

        clientId = serviceName.split('-')[CLIENT_ID_POS] || clientId
        store.write(clientId)

        urlReport.show(service.url)
    } else {
        if (appConfig.autoCreateInstance) createHandler()
    }


    const evtSource = new EventSource(`/events?clientId=${clientId}`);

    evtSource.addEventListener('id', (event) => {
        const id = JSON.parse(event.data).id;
        console.log(`Id event received: ${id}`);

        if (clientId === id) {
            console.debug(`Client confirmed: ${clientId} -> ${id}`);
        }
    });

    evtSource.onmessage = (event) => {
        console.info('Message received')
        const data = JSON.parse(event.data)

        if (clientSpecificEvents.includes(data.event) && !data.serviceName.endsWith(clientId)) return

        switch (data.event) {
            // case EVENT_SERVICE_CREATED:
            case EVENT_SERVICE_READY:
                console.debug(`Service created & ready with name ${data.serviceName}`)
                serviceName = data.serviceName;
                progressReport.serviceCreated()
                break;

            case EVENT_SERVICE_DELETED:
                console.debug(`Service deleted with name ${data.serviceName}`)
                cleanup()

                clientId = ClientIdHelper.generateClientId();
                store.write(clientId)
                break;

            case EVENT_DEPLOYMENT_RUNNING:
                console.info(`Deployment completed for ${data.serviceName}`)
                progressReport.deploymentComplete()
                progressReport.hide()
                urlReport.show(data.url)

                break;

            case EVENT_DEPLOYMENT_STARTED:
                console.info(`Deployment started for ${data.serviceName}`)
                progressReport.deploymentStarted()
                break;
        }

        console.log(data);
    };

    evtSource.onerror = (err) => {
        console.error("EventSource failed:", err);
    };

    document.querySelector('#btn-create').addEventListener('click', createHandler)
    document.querySelector('#btn-delete').addEventListener('click', deleteHandler)
}

window.addEventListener('load', () => {
    init()
});


const findService = async () => {
    console.debug(`Finding available service`)

    try {
        const response = await fetch(`/api/instance`)

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
        console.info(`Sorry, you cannot create a new instance once there is no client ID generated for you`)
        return
    }

    try {
        const response = await fetch('/api/instance', {
            method: 'POST',
            body: JSON.stringify({ clientId })
        })

        const data = await response.json()

        if (response.ok)
            progressReport.startServiceCreation()
        else {
            console.error('Failed')
        }
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
        const response = await fetch('/api/instance', {
            method: 'DELETE',
            body: JSON.stringify({ serviceName }),
        })

        const data = await response.json()
        console.debug(data)

        alert(`Destroyed the created instance ${serviceName}`)
    } catch (err) {
        alert(`Destroing the service ${serviceName} failed. Reason: ${err.message}`)
    }
}

const cleanup = () => {
    serviceName = null
    store.clear()
    urlReport.hide()
}
