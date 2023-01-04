let identifier;

window.addEventListener('load', () => {
    // alert('Hello');
    const evtSource = new EventSource('/events');

    evtSource.addEventListener('id', (event) => {
        console.log('Id event');
        identifier = JSON.parse(event.data).id;
        console.debug(`Client assigned unique ID: ${identifier}`);
    });
    evtSource.onmessage = (event) => {
        console.log(event);
    };

    document.querySelector('#btn-create').addEventListener('click', createHandler)
});

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
// alert(randomId());
// alert(randomId());
function randomId() {
    const uint32 = window.crypto.getRandomValues(
        new Uint32Array(1)
    )[0];
    return uint32.toString(16);
}
