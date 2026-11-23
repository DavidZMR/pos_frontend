import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { toApiError, toPage } from './api-types';
import { serverFieldErrors } from './server-errors';

describe('toApiError', () => {
  it('error de red (status 0) da un mensaje claro', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0 }));
    expect(error.isNetwork).toBe(true);
    expect(error.message).toContain('conexión');
  });

  it('lee código, mensaje y errores de campo del sobre del backend', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: { fieldErrors: { username: ['Muy corto'] } },
          },
        },
      }),
    );
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Datos inválidos',
    });
    expect(error.fieldErrors).toEqual({ username: ['Muy corto'] });
  });
});

describe('toPage', () => {
  it('convierte la respuesta paginada', () => {
    const page = toPage({
      ok: true,
      data: [1, 2],
      meta: { total: 12, page: 2, limit: 2, pages: 6 },
    });
    expect(page).toEqual({ items: [1, 2], meta: { total: 12, page: 2, limit: 2, pages: 6 } });
  });
});

describe('serverFieldErrors', () => {
  it('asigna errores a los campos y usa el campo de respaldo para 409', () => {
    TestBed.runInInjectionContext(() => {
      const f = form(signal({ username: '', name: '' }));
      const validation = serverFieldErrors(
        toApiError(
          new HttpErrorResponse({
            status: 400,
            error: {
              ok: false,
              error: { code: 'X', message: 'm', details: { fieldErrors: { name: ['Requerido'] } } },
            },
          }),
        ),
        { username: f.username, name: f.name },
      );
      expect(validation).toEqual([{ kind: 'server', message: 'Requerido', fieldTree: f.name }]);

      const conflict = serverFieldErrors(
        toApiError(
          new HttpErrorResponse({
            status: 409,
            error: { ok: false, error: { code: 'CONFLICT', message: 'Ya existe' } },
          }),
        ),
        { username: f.username },
        'username',
      );
      expect(conflict).toEqual([{ kind: 'server', message: 'Ya existe', fieldTree: f.username }]);
    });
  });
});
