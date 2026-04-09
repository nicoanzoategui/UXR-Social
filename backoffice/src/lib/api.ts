import axios from "axios";

const ACCESS_TOKEN_KEY = "access_token";

/** Misma familia de sitio que el front (127.0.0.1 vs localhost) para cookies SameSite=Lax + CORS. */
export function resolveApiBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
        return "http://127.0.0.1:8000";
    }
    return "http://localhost:8000";
}

export const api = axios.create({
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    config.baseURL = resolveApiBaseUrl();
    const method = String(config.method || "get").toLowerCase();
    const path = String(config.url || "").replace(/\/$/, "") || "/";
    const isLoginPost = method === "post" && path === "/token";
    if (typeof window !== "undefined" && !isLoginPost) {
        const t = sessionStorage.getItem(ACCESS_TOKEN_KEY);
        if (t) {
            config.headers.set("Authorization", `Bearer ${t}`);
        }
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== "undefined") {
            sessionStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem("isAdminLoggedIn");
            localStorage.removeItem("role");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export const login = async (username: string, password: string) => {
    if (typeof window !== "undefined") {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);
    const response = await api.post("/token", formData);
    const data = response.data;
    if (typeof window !== "undefined" && data?.access_token) {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    }
    return data;
};

export const getSummary = async () => {
    const response = await api.get("/analytics/summary");
    return response.data;
};

export const getUsers = async () => {
    const response = await api.get("/users");
    return response.data;
};

export const createUser = async (userData: any) => {
    const response = await api.post("/users", userData);
    return response.data;
};

export const getComments = async (params = {}) => {
    const response = await api.get("/comments", { params });
    return response.data;
};

export async function getDatasets() {
    const { data } = await api.get("/datasets");
    return data;
}

export async function deleteDataset(id: number) {
    const { data } = await api.delete(`/datasets/${id}`);
    return data;
}

export const uploadCSV = async (formData: FormData) => {
    const response = await api.post("/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
};
export const scrapeGoogle = async (url: string, maxReviews: number = 50) => {
    const response = await api.post("/scrape-google", { url, max_reviews: maxReviews });
    return response.data;
};

export const scrapeGoogleMapsV2 = async (url: string, maxReviews: number = 50) => {
    const response = await api.post("/api/scrape/google-maps", { url, max_reviews: maxReviews });
    return response.data;
};

export const getDownloadUrl = (filename: string) => {
    return `${resolveApiBaseUrl()}/api/scrape/download/${filename}`;
};

export const uploadChatbotCSV = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/upload-chatbot", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
};

export const getMe = async () => {
    const response = await api.get("/api/auth/me");
    return response.data;
};

export const logout = async () => {
    await api.post("/api/auth/logout");
    if (typeof window !== "undefined") {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("role");
};
