const auth = window.DropsonicAuth;

const elements = {
    alertBox: document.getElementById('alert-box'),
    bootstrapCard: document.getElementById('bootstrap-card'),
    loginCard: document.getElementById('login-card'),
    accountLink: document.getElementById('account-link'),
    adminLink: document.getElementById('admin-link'),
    libraryLink: document.getElementById('library-link'),
    logoutButton: document.getElementById('logout-button'),
    bootstrapForm: document.getElementById('bootstrap-form'),
    loginForm: document.getElementById('login-form'),
};

const state = {
    status: null,
    currentUser: null,
};

function showAlert(message, variant = 'success') {
    elements.alertBox.textContent = message;
    elements.alertBox.className = `alert alert-${variant}`;
}

function clearAlert() {
    elements.alertBox.className = 'alert hidden';
    elements.alertBox.textContent = '';
}

function toggleVisibility(element, visible) {
    element.classList.toggle('hidden', !visible);
}

function render() {
    const hasUsers = state.status?.hasUsers === true;
    const loggedIn = Boolean(state.currentUser);
    const isAdmin = state.currentUser?.isAdmin === true;

    toggleVisibility(elements.bootstrapCard, !hasUsers);
    toggleVisibility(elements.loginCard, hasUsers && !loggedIn);
    toggleVisibility(elements.accountLink, loggedIn);
    toggleVisibility(elements.adminLink, loggedIn && isAdmin);
    toggleVisibility(elements.libraryLink, loggedIn);
    toggleVisibility(elements.logoutButton, loggedIn);
}

function redirectToLibrary() {
    window.location.replace('/library/');
}

async function hydrate() {
    state.status = await auth.getStatus();
    state.currentUser = null;

    if (auth.getToken()) {
        try {
            state.currentUser = await auth.getCurrentUser();
        } catch {
            auth.clearToken();
        }
    }

    render();
}

elements.bootstrapForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    try {
        const data = await auth.api('/api/auth/bootstrap', {
            method: 'POST',
            body: {
                user: document.getElementById('bootstrap-user').value,
                password: document.getElementById('bootstrap-password').value,
            },
        });

        auth.setToken(data.token);
        redirectToLibrary();
        elements.bootstrapForm.reset();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    try {
        const data = await auth.api('/api/auth/login', {
            method: 'POST',
            body: {
                user: document.getElementById('login-user').value,
                password: document.getElementById('login-password').value,
            },
        });

        auth.setToken(data.token);
        redirectToLibrary();
        elements.loginForm.reset();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

elements.logoutButton.addEventListener('click', async () => {
    auth.clearToken();
    clearAlert();
    await hydrate();
});

hydrate().catch((error) => {
    showAlert(error.message, 'danger');
});
