const auth = window.DropsonicAuth;

const elements = {
    alertBox: document.getElementById('alert-box'),
    accountSummary: document.getElementById('account-summary'),
    accountBadge: document.getElementById('account-badge'),
    adminLink: document.getElementById('admin-link'),
    passwordForm: document.getElementById('password-form'),
    logoutButton: document.getElementById('logout-button'),
};

const state = {
    currentUser: null,
};

function redirectToLogin() {
    window.location.replace('../login/');
}

function showAlert(message, variant = 'success') {
    elements.alertBox.textContent = message;
    elements.alertBox.className = `alert alert-${variant}`;
}

function clearAlert() {
    elements.alertBox.className = 'alert hidden';
    elements.alertBox.textContent = '';
}

function render() {
    const isAdmin = state.currentUser?.isAdmin === true;

    elements.accountSummary.textContent = `${state.currentUser.user} · ${state.currentUser.enabled ? 'enabled' : 'disabled'}${state.currentUser.mustChangePassword ? ' · password change required' : ''}`;
    elements.accountBadge.textContent = isAdmin ? 'Administrator' : 'User';
    elements.accountBadge.className = `badge ${isAdmin ? 'bg-danger' : 'bg-secondary'}`;
    elements.adminLink.classList.toggle('hidden', !isAdmin);
}

async function hydrate() {
    try {
        state.currentUser = await auth.getCurrentUser();
    } catch {
        redirectToLogin();
        return;
    }

    render();
}

elements.passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    try {
        await auth.api('../api/auth/password', {
            method: 'POST',
            body: {
                currentPassword: document.getElementById('current-password').value,
                newPassword: document.getElementById('new-password').value,
            },
        });

        showAlert('Password updated.');
        elements.passwordForm.reset();
        await hydrate();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
});

elements.logoutButton.addEventListener('click', () => {
    auth.clearToken();
    redirectToLogin();
});

hydrate().catch((error) => {
    showAlert(error.message, 'danger');
});
