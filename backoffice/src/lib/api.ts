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
            localStorage.removeItem("isAdminLoggedIn");
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
    return `${API_BASE_URL}/api/scrape/download/${filename}`;
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
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("role");
};
