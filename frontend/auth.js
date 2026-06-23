"use strict";

const authStatus = document.getElementById("auth-status");
const destination = YOApi.safeReturnUrl(new URLSearchParams(window.location.search).get("return"));
let mfaChallengeToken = null;

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
    void submitAuth(event.currentTarget, YOApi.register);
});

YOApi.getCurrentUser().then((user) => {
    if (user) window.location.href = destination;
}).catch(() => undefined);
