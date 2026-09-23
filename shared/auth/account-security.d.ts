export interface AccountSecurity {
  email: string;
  hasPassword: boolean;
  discordConnected: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string | null;
  password: string;
}
