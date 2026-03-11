const DropsonicAuth = (() => {
    const TOKEN_KEY = 'dropsonic.authToken';
    let token = window.localStorage.getItem(TOKEN_KEY);

    function setToken(nextToken) {
        token = nextToken || null;

        if (token) {
            window.localStorage.setItem(TOKEN_KEY, token);
        } else {
            window.localStorage.removeItem(TOKEN_KEY);
        }
    }

    async function api(path, options = {}) {
        const requestOptions = { ...options };
        const headers = new Headers(requestOptions.headers || {});

        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
            requestOptions.body = JSON.stringify(requestOptions.body);
        }

        requestOptions.headers = headers;

        const response = await fetch(path, requestOptions);
        let data = null;

        if (response.status !== 204) {
            const contentType = response.headers.get('content-type') || '';
            data = contentType.includes('application/json') ? await response.json() : await response.text();
        }

        if (!response.ok) {
            const message = typeof data === 'string' ? data : data?.error || 'Request failed.';

            if (response.status === 401) {
                setToken(null);
            }

            throw new Error(message);
        }

        return data;
    }

    async function getStatus() {
        return api('../api/auth/status');
    }

    async function getCurrentUser() {
        const data = await api('../api/auth/me');
        return data.user;
    }

    return {
        TOKEN_KEY,
        api,
        getStatus,
        getCurrentUser,
        getToken: () => token,
        setToken,
        clearToken: () => setToken(null),
    };
})();

window.DropsonicAuth = DropsonicAuth;
