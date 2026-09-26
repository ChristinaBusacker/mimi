export interface AccountSecurity {
  email: string | null;
  hasPassword: boolean;
  discordConnected: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string | null;
  password: string;
}
