import { HttpClient } from '@angular/common/http';
import { Injectable, REQUEST, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CrossTabRequestService } from '../communication/cross-tab-request.service';
import { API_BASE_URL } from './api-base-url.token';

export interface GetRequestOptions {
  deduplicateAcrossTabs?: boolean;
  transferCache?: boolean;
}

interface HttpRequestOptions {
  headers?: Record<string, string>;
  transferCache?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class RequestService {
  private readonly http = inject(HttpClient);
  private readonly crossTabRequests = inject(CrossTabRequestService);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly ssrRequest = inject(REQUEST, {
    optional: true,
  });

  get<T>(
    path: string,
    options: GetRequestOptions = {},
  ): Observable<T> {
    const url = this.buildUrl(path);
    const requestOptions = this.createRequestOptions(
      options.transferCache,
    );

    if (options.deduplicateAcrossTabs === false) {
      return this.http.get<T>(url, requestOptions);
    }

    return this.crossTabRequests.execute(`GET:${url}`, () =>
      this.http.get<T>(url, requestOptions),
    );
  }

  post<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Observable<TResponse> {
    return this.http.post<TResponse>(
      this.buildUrl(path),
      body,
      this.createRequestOptions(),
    );
  }

  patch<TResponse, TBody>(
    path: string,
    body: TBody,
  ): Observable<TResponse> {
    return this.http.patch<TResponse>(
      this.buildUrl(path),
      body,
      this.createRequestOptions(),
    );
  }

  delete<TResponse = void>(path: string): Observable<TResponse> {
    return this.http.delete<TResponse>(
      this.buildUrl(path),
      this.createRequestOptions(),
    );
  }

  private createRequestOptions(
    transferCache?: boolean,
  ): HttpRequestOptions {
    const cookie = this.ssrRequest?.headers.get('cookie');

    return {
      ...(cookie
        ? {
            headers: {
              cookie,
            },
          }
        : {}),
      ...(transferCache === undefined
        ? {}
        : {
            transferCache,
          }),
    };
  }

  private buildUrl(path: string): string {
    const normalizedBaseUrl = this.apiBaseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const apiUrl = `${normalizedBaseUrl}${normalizedPath}`;

    if (!this.ssrRequest) {
      return apiUrl;
    }

    return new URL(apiUrl, this.ssrRequest.url).toString();
  }
}
