export class LoadAuthSession {
  static readonly type = '[Auth] Load Session';
}

export class Login {
  static readonly type = '[Auth] Login';

  constructor(
    readonly email: string,
    readonly password: string,
  ) {}
}

export class Logout {
  static readonly type = '[Auth] Logout';
}
