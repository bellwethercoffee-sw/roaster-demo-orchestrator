import { getCookieValue } from './utils.js'

const EXPIRED_TOKEN = 'expired-token'

const getHeaders = () => {
    const accessToken = getCookieValue('accessToken')
    const refreshToken = getCookieValue('refreshToken')
    const idToken = getCookieValue('idToken')

    // console.debug(accessToken, refreshToken, idToken)
    // console.debug(document.cookie)

    return new Headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        // 'x-refresh-token': refreshToken,
        'x-id-token': idToken
    })
}

export const refreshToken = async () => {
    try {
        const token = getCookieValue('refreshToken')
        console.debug(`Refreshing token`, token)
        const response = await fetch('/refresh-token', {
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify({ refreshToken: token })
        })

        let data = await response.json()
        if (!response.ok) {
            console.error('Refreshing token failed', data)
            data = null
        }
        console.debug('Token refreshed', data)
        return data
    } catch (err) {
        console.error(`Refreshing access token failed. Reason: ${err?.message}`)
        return null
    }
}

export default async function (url, options = {}) {

    if (!options.headers) {
        options.headers = getHeaders();
    }

    try {
        let response = await fetch(url, options)

        if (response.status === 401) {
            let authenticateUser = true
            const result = await response.json()
            if (result.code === EXPIRED_TOKEN) {
                if (await refreshToken()) {
                    authenticateUser = false
                    response = await fetch(url, options)
                }
            }

            if (authenticateUser) document.location.href = '/'
        }

        return response
    } catch (error) {
        console.error(error)
    }

}

