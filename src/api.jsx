import axios from "axios";

export const API = axios.create({
  baseURL: "https://watchparty-springboot.onrender.com",
});