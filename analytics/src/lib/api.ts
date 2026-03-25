import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL && typeof window !== "undefined") {
    console.error("NEXT_PUBLIC_API_URL is not set. API calls will fail.");
}

export const api = axios.create({
    baseURL: API_BASE_URL || "http://localhost:8000",
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== "undefined") {
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("role");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export const login = async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);
    const response = await api.post("/token", formData);
    return response.data;
};

export const getSummary = async (params = {}) => {
    const response = await api.get("/analytics/summary", { params });
    return response.data;
};

export const getTrends = async (params = {}) => {
    const response = await api.get("/analytics/trends", { params });
    return response.data;
};

export const getDistribution = async (params = {}) => {
    const response = await api.get("/analytics/distribution", { params });
    return response.data;
};

export const getTopics = async (params = {}) => {
    const response = await api.get("/analytics/topics", { params });
    return response.data;
};

export const getThemeReport = async (params = {}) => {
    const response = await api.get("/analytics/theme-report", { params });
    return response.data;
};

export const getFullReport = async (params = {}) => {
    const response = await api.get("/analytics/full-report", { params });
    return response.data;
};

export const sendReport = async (data: any) => {
    const response = await api.post("/analytics/send-report", data);
    return response.data;
};

export const getComments = async (params = {}) => {
    const response = await api.get("/comments", { params });
    return response.data;
};

export const updateCommentTags = async (commentId: number, tags: string) => {
    const response = await api.patch(`/comments/${commentId}/tags`, { tags });
    return response.data;
};

export const getDatasets = async () => {
    const response = await api.get("/datasets");
    return response.data;
};

export const uploadCSV = async (formData: FormData) => {
    const response = await api.post("/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
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

export const getConsolidatedReport = async (params = {}) => {
    const response = await api.get("/analytics/consolidated-report", { params });
    return response.data;
};

export const getMe = async () => {
    const response = await api.get("/api/auth/me");
    return response.data;
};

export const logout = async () => {
    await api.post("/api/auth/logout");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
};
