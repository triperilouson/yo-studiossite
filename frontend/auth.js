"use strict";

const authStatus = document.getElementById("auth-status");
const query = new URLSearchParams(window.location.search);
const destination = YOApi.safeReturnUrl(query.get("return"));
let mfaChallengeToken = null;
let resetToken = query.get("reset");

function setAuthStatus(message, isError = false) {
    authStatus.textContent = message ? message.toUpperCase() : "";
    authStatus.classList.toggle("error", isError);
}

document.querySelectorAll(".account-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".account-tab").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".account-panel").forEach((item) => item.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.panel).classList.add("active");
        setAuthStatus("");
    });
});

async function submitAuth(form, action) {
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    setAuthStatus("PLEASE WAIT");
    try {
        const values = Object.fromEntries(new FormData(form).entries());
        await action(values);
        window.location.href = destination;
    } catch (error) {
        setAuthStatus(error.message, true);
    } finally {
        button.disabled = false;
    }
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
        const result = await YOApi.login(Object.fromEntries(new FormData(form).entries()));
        if (result?.mfaRequired) {
            mfaChallengeToken = result.challengeToken;
            document.querySelectorAll(".account-panel").forEach((panel) => panel.classList.remove("active"));
            document.getElementById("mfa-panel").classList.add("active");
            setAuthStatus("ENTER THE CODE FROM YOUR AUTHENTICATOR APP");
        } else window.location.href = destination;
    } catch (error) { setAuthStatus(error.message, true); }
    finally { button.disabled = false; }
});
document.getElementById("mfa-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAuth(event.currentTarget, (values) => YOApi.completeAdminMfa({ challengeToken: mfaChallengeToken, code: values.code }));
});
document.getElementById("register-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    setAuthStatus("PLEASE WAIT");
    YOApi.register(Object.fromEntries(new FormData(form).entries()))
        .then(() => setAuthStatus("ACCOUNT CREATED. CHECK YOUR EMAIL TO VERIFY IT"))
        .catch((error) => setAuthStatus(error.message, true))
        .finally(() => { button.disabled = false; });
});
document.getElementById("reset-request-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    setAuthStatus("PLEASE WAIT");
    YOApi.requestPasswordReset(new FormData(form).get("email"))
        .then(() => setAuthStatus("IF THE ACCOUNT EXISTS, RESET EMAIL WAS SENT"))
        .catch((error) => setAuthStatus(error.message, true))
        .finally(() => { button.disabled = false; });
});
document.getElementById("reset-confirm-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    setAuthStatus("PLEASE WAIT");
    YOApi.resetPassword({ token: resetToken, password: new FormData(form).get("password") })
        .then(() => {
            resetToken = null;
            window.history.replaceState({}, "", "auth.html");
            document.querySelector('[data-panel="login-panel"]').click();
            setAuthStatus("PASSWORD RESET. YOU CAN LOGIN NOW");
        })
        .catch((error) => setAuthStatus(error.message, true))
        .finally(() => { button.disabled = false; });
});

async function handleEmailActions() {
    const verifyToken = query.get("verify");
    if (verifyToken) {
        await YOApi.verifyEmail(verifyToken);
        setAuthStatus("EMAIL VERIFIED. YOU CAN CONTINUE");
        window.history.replaceState({}, "", "auth.html");
        return;
    }
    if (resetToken) {
        document.querySelectorAll(".account-tab").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".account-panel").forEach((item) => item.classList.remove("active"));
        document.getElementById("reset-confirm-panel").classList.add("active");
        setAuthStatus("ENTER A NEW PASSWORD");
        return;
    }
    const user = await YOApi.getCurrentUser();
    if (user) window.location.href = destination;
}

handleEmailActions().catch((error) => setAuthStatus(error.message, true));
