(function () {
    "use strict";

    const configuredBase = window.YO_API_BASE || document.querySelector('meta[name="yo-api-base"]')?.content;
    const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const localApi = `http://${window.location.hostname}:3000/api/v1`;
    const API_BASE = (configuredBase || (localHost ? localApi : "https://api.yo-studios.com/api/v1")).replace(/\/$/, "");

    let accessToken = null;
    let currentUser = null;
    let refreshPromise = null;

    class ApiError extends Error {
        constructor(status, message, details) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.details = details;
        }
    }

    async function parseResponse(response) {
        if (response.status === 204) return null;
        const type = response.headers.get("content-type") || "";
        return type.includes("application/json") ? response.json() : response.text();
    }

    function errorMessage(payload, fallback) {
        if (typeof payload === "string" && payload) return payload;
        if (Array.isArray(payload?.message)) return payload.message.join(". ");
        return payload?.message || fallback;
    }

    async function refreshSession() {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: "POST",
                credentials: "include",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) {
                accessToken = null;
                currentUser = null;
                return false;
            }
            const payload = await parseResponse(response);
            accessToken = payload.accessToken;
            return true;
        })().finally(() => { refreshPromise = null; });
        return refreshPromise;
    }

    async function request(path, options = {}) {
        const { auth = false, retry = true, body, headers = {}, ...fetchOptions } = options;
        if (auth && !accessToken && !(await refreshSession())) {
            throw new ApiError(401, "Please sign in to continue");
        }
        const response = await fetch(`${API_BASE}${path}`, {
            ...fetchOptions,
            credentials: "include",
            headers: {
                Accept: "application/json",
                ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
                ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                ...headers
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });
        if (response.status === 401 && auth && retry && await refreshSession()) {
            return request(path, { ...options, retry: false });
        }
        const payload = await parseResponse(response);
        if (!response.ok) throw new ApiError(response.status, errorMessage(payload, `Request failed (${response.status})`), payload);
        return payload;
    }

    async function authenticate(path, body) {
        const result = await request(path, { method: "POST", body });
        if (result.mfaRequired) return result;
        accessToken = result.accessToken;
        currentUser = result.user;
        return result.user;
    }

    async function getCurrentUser() {
        if (currentUser) return currentUser;
        try {
            currentUser = await request("/users/me", { auth: true });
            return currentUser;
        } catch (error) {
            if (error.status === 401) return null;
            throw error;
        }
    }

    async function logout() {
        try { await request("/auth/logout", { method: "POST" }); } finally {
            accessToken = null;
            currentUser = null;
        }
    }

    function formatMoney(amountMinor, currency = "ILS") {
        try {
            return new Intl.NumberFormat("en", { style: "currency", currency }).format(amountMinor / 100);
        } catch {
            return `${(amountMinor / 100).toFixed(2)} ${currency}`;
        }
    }

    function imageUrl(url) {
        if (!url) return "";
        if (/^(?:https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
        return url.startsWith("/") ? `.${url}` : url;
    }

    function safeReturnUrl(value, fallback = "account.html") {
        if (!value || !/^[a-zA-Z0-9._?=&%#-]+$/.test(value) || value.includes("..")) return fallback;
        return value;
    }

    window.YOApi = {
        ApiError,
        request,
        login: (body) => authenticate("/auth/login", body),
        register: (body) => authenticate("/auth/register", body),
        verifyEmail: (token) => request("/auth/email/verify", { method: "POST", body: { token } }),
        requestPasswordReset: (email) => request("/auth/password-reset/request", { method: "POST", body: { email } }),
        resetPassword: (body) => request("/auth/password-reset/confirm", { method: "POST", body }),
        completeAdminMfa: async (body) => {
            const result = await request("/auth/admin-mfa/complete", { method: "POST", body });
            accessToken = result.accessToken;
            currentUser = result.user;
            return result.user;
        },
        logout,
        getCurrentUser,
        getProducts: (category) => request(`/products${category ? `?category=${encodeURIComponent(category)}` : ""}`),
        getProduct: (slug) => request(`/products/${encodeURIComponent(slug)}`),
        getSeasons: (archive = false) => request(`/seasons${archive ? "?archive=true" : ""}`),
        getSeason: (slug) => request(`/seasons/${encodeURIComponent(slug)}`),
        getSeasonPreview: (slug, token) => request(`/seasons/preview/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`),
        getFeaturedSeason: () => request("/seasons/featured/current"),
        getGameAssets: () => request("/admin/game-editor/assets", { auth: true }),
        uploadGameAsset: (body) => request("/admin/game-editor/assets", { method: "POST", auth: true, body }),
        saveGameAssetConfig: (id, config, productId) => request(`/admin/game-editor/assets/${encodeURIComponent(id)}/config`, { method: "PATCH", auth: true, body: { config, productId } }),
        deleteGameAsset: (id) => request(`/admin/game-editor/assets/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
        getGameLevels: () => request("/admin/game-editor/levels", { auth: true }),
        saveGameLevel: (body) => request("/admin/game-editor/levels", { method: "POST", auth: true, body }),
        getActiveGameLevel: () => request("/game-assets/levels/active"),
        getGameAssetProductLinks: () => request("/game-assets/runtime/product-links"),
        getCart: () => request("/cart", { auth: true }),
        addCartItem: (body) => request("/cart/items", { method: "POST", auth: true, body }),
        updateCartItem: (id, quantity) => request(`/cart/items/${encodeURIComponent(id)}`, { method: "PATCH", auth: true, body: { quantity } }),
        removeCartItem: (id) => request(`/cart/items/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),
        formatMoney,
        imageUrl,
        safeReturnUrl
    };
})();
