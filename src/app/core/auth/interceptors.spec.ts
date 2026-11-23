import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BusinessContext } from '../business/business-context';
import { ConfigService } from '../config/config-service';
import { AuthStore } from './auth-store';
import { authInterceptor, sessionExpiredInterceptor } from './interceptors';

const SESSION = {
  token: 'jwt-123',
  user: { id: 'u1', name: 'Root', username: 'root', role: 'superadmin', businessId: null },
  business: null,
};

describe('interceptores', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let config: ConfigService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pos.session', JSON.stringify(SESSION));
    localStorage.setItem('pos.selectedBusinessId', JSON.stringify('b1'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor, sessionExpiredInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    config = TestBed.inject(ConfigService);
  });

  afterEach(() => localStorage.clear());

  it('agrega token y x-business-id del superadmin solo a peticiones del API', () => {
    TestBed.inject(BusinessContext); // inicializa la selección guardada
    void firstValueFrom(http.get(config.api('/users')));
    void firstValueFrom(http.get('https://otro.example/recurso'));

    const api = backend.expectOne(config.api('/users'));
    expect(api.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    expect(api.request.headers.get('x-business-id')).toBe('b1');

    const external = backend.expectOne('https://otro.example/recurso');
    expect(external.request.headers.has('Authorization')).toBe(false);

    // El contexto pide la lista de negocios del superadmin; no es parte de esta prueba.
    backend.match(() => true).forEach((req) => req.flush({ ok: true, data: [] }));
  });

  it('un 401 del API cierra la sesión', async () => {
    const auth = TestBed.inject(AuthStore);
    const request = firstValueFrom(http.get(config.api('/users'))).catch(() => 'error');

    backend
      .expectOne(config.api('/users'))
      .flush(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'x' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(await request).toBe('error');
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('pos.session')).toBeNull();
  });
});
