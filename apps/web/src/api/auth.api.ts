import apiClient from "./client";
import type { UserDto } from "@moments/shared";

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  user: UserDto;
}

interface RegisterRequest {
  username: string;
  displayName: string;
  password: string;
}

export function loginApi(data: LoginRequest): Promise<LoginResponse> {
  return apiClient.post("/auth/login", data);
}

export function registerApi(data: RegisterRequest): Promise<UserDto> {
  return apiClient.post("/auth/register", data);
}

export function getMeApi(): Promise<UserDto> {
  return apiClient.get("/auth/me");
}
