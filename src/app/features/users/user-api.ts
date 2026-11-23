import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { unwrap } from '../../core/api/api-types';
import type { Role, User } from '../../core/auth/auth-models';
import { ConfigService } from '../../core/config/config-service';

export interface CreateUserInput {
  name: string;
  username: string;
  password: string;
  role: Role;
  businessId?: string;
}

export interface UpdateUserInput {
  name?: string;
  username?: string;
  password?: string;
  role?: Role;
  businessId?: string;
  active?: boolean;
}

export interface UserListParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  active?: boolean;
  businessId?: string;
}

@Service()
export class UserApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  readonly url = this.config.api('/users');

  listParams(params: UserListParams): Record<string, string | number> {
    const out: Record<string, string | number> = { page: params.page, limit: params.limit };
    if (params.search) out['search'] = params.search;
    if (params.role) out['role'] = params.role;
    if (params.active !== undefined) out['active'] = String(params.active);
    if (params.businessId) out['businessId'] = params.businessId;
    return out;
  }

  async create(input: CreateUserInput): Promise<User> {
    return unwrap<User>(await firstValueFrom(this.http.post(this.url, input)));
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    return unwrap<User>(await firstValueFrom(this.http.patch(`${this.url}/${id}`, input)));
  }
}
