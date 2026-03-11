const auth = window.DropsonicAuth;

const elements = {
    alertBox: document.getElementById('alert-box'),
    accountSummary: document.getElementById('account-summary'),
    userTable: document.getElementById('user-table'),
    createUserForm: document.getElementById('create-user-form'),
    logoutButton: document.getElementById('logout-button'),
};

const state = {
    currentUser: null,
    users: [],
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

function renderUserTable() {
    elements.userTable.innerHTML = '';

    state.users.forEach((user) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                <div class="fw-semibold">${user.user}</div>
                <div class="small text-muted">${user.mustChangePassword ? 'Must change password' : 'Password active'}</div>
            </td>
            <td>
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input admin-toggle" type="checkbox" ${user.isAdmin ? 'checked' : ''} />
                    <label class="form-check-label">Admin</label>
                </div>
            </td>
            <td>
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input enabled-toggle" type="checkbox" ${user.enabled ? 'checked' : ''} />
                    <label class="form-check-label">Enabled</label>
                </div>
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <input class="form-control reset-password" type="password" placeholder="New temp password" />
                    <button class="btn btn-outline-secondary reset-button" type="button">Reset</button>
                </div>
            </td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary save-button" type="button">Save</button>
                    <button class="btn btn-outline-danger delete-button" type="button" ${user.user === state.currentUser?.user ? 'disabled' : ''}>Delete</button>
                </div>
            </td>
        `;

        row.querySelector('.save-button').addEventListener('click', async () => {
            try {
                await auth.api(`../api/admin/users/${encodeURIComponent(user.user)}`, {
                    method: 'PATCH',
                    body: {
                        isAdmin: row.querySelector('.admin-toggle').checked,
                        enabled: row.querySelector('.enabled-toggle').checked,
                    },
                });

                showAlert(`Updated ${user.user}.`);
                await hydrate();
            } catch (error) {
                showAlert(error.message, 'danger');
            }
        });

        row.querySelector('.reset-button').addEventListener('click', async () => {
            const password = row.querySelector('.reset-password').value;

            try {
                await auth.api(`../api/admin/users/${encodeURIComponent(user.user)}/reset`, {
                    method: 'POST',
                    body: { password },
                });

                showAlert(`Password reset for ${user.user}. They must change it on next login.`);
                await hydrate();
            } catch (error) {
                showAlert(error.message, 'danger');
            }
        });

        row.querySelector('.delete-button').addEventListener('click', async () => {
            if (!window.confirm(`Delete ${user.user}?`)) {
                return;
            }

            try {
                await auth.api(`../api/admin/users/${encodeURIComponent(user.user)}`, { method: 'DELETE' });
                showAlert(`Deleted ${user.user}.`);
                await hydrate();
            } catch (error) {
                showAlert(error.message, 'danger');
            }
        });

        elements.userTable.append(row);
    });
}

function render() {
    elements.accountSummary.textContent = `${state.currentUser.user} · administrator${state.currentUser.mustChangePassword ? ' · password change required' : ''}`;
    renderUserTable();
}

async function hydrate() {
    const status = await auth.getStatus();

    if (!status.hasUsers) {
        redirectToLogin();
        return;
    }

    try {
        state.currentUser = await auth.getCurrentUser();
    } catch {
        redirectToLogin();
        return;
    }

    if (!state.currentUser?.isAdmin) {
        redirectToLogin();
        return;
    }

    const adminData = await auth.api('../api/admin/users');
    state.users = adminData.users;
    render();
}

elements.createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    try {
        await auth.api('../api/admin/users', {
            method: 'POST',
            body: {
                user: document.getElementById('create-user').value,
                password: document.getElementById('create-password').value,
                isAdmin: document.getElementById('create-admin').checked,
            },
        });

        showAlert('User created.');
        elements.createUserForm.reset();
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
