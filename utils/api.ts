import axios, { AxiosInstance } from "axios";

// 1. Create the instance
const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_GAS_URL,
});

// 2. Merge the instance with the isAxiosError method and export it
// We cast it to include the 'isApiError' property for TypeScript
const api = Object.assign(instance, {
  isApiError: axios.isAxiosError
}) as AxiosInstance & { isApiError: typeof axios.isAxiosError };

api.interceptors.response.use(
  (response) => {
    if (response.data?.error === "Invalid or expired token") {
      handleGlobalLogout();
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 || error.response?.data?.error === "Invalid or expired token") {
      handleGlobalLogout();
    }
    return Promise.reject(error);
  }
);

const handleGlobalLogout = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("userToken");
    localStorage.removeItem("userInfo");
    window.location.href = "/login";
  }
};

export default api;