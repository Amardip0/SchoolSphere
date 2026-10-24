import axios from "axios";
export const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use(config => {
  const token = localStorage.getItem("ss_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export const socketUrl = window.location.origin;
