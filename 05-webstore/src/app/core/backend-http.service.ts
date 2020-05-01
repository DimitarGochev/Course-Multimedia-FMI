import { Injectable } from '@angular/core';
import { BackendService } from './backend.service';
import { Identifiable, ResourceType, IdType } from '../shared/shared-types';
import { Observable, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { map, tap, catchError, retry } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { retryAfter } from '../shared/rx-operators';

export const BASE_API_URL = 'http://localhost:4200/api';

const ENTITY_TO_URL_MAP = {
  Product: 'products',
  User: 'users',
};

interface DataResposnse<T> {
  data: T;
}

@Injectable()
export class BackendHttpService implements BackendService {

  constructor(private http: HttpClient, private logger: LoggerService) {
    this.handleError = this.handleError.bind(this);
  }

  findAll<T extends Identifiable>(kind: ResourceType<T>): Observable<T[]> {
    return this.http.get<DataResposnse<T[]>>(this.getUrl(kind)).pipe(
      map(dataResp => dataResp.data),
      tap( () => {}, err => this.logger.error(err)),
      retryAfter(3, 1000),
      catchError(this.handleError)
    );
  }

  findById<T extends Identifiable>(kind: ResourceType<T>, id: string): Observable<T> {
    return this.http.get<T>(`${this.getUrl(kind)}/${id}`).pipe(
      retryAfter(3, 1000),
      catchError(this.handleError)
    );
  }

  create<T extends Identifiable>(kind: ResourceType<T>, entity: T): Observable<T> {
    return this.http.post<T>(this.getUrl(kind), entity).pipe(
      tap( created => this.logger.log(`${kind.typeId} created: ${created}`),
           err => this.logger.error(err)
      ),
      catchError(this.handleError)
    );
  }

  update<T extends Identifiable>(kind: ResourceType<T>, entity: T): Observable<T> {
    return this.http.put<T>(`${this.getUrl(kind)}/${entity.id}`, entity).pipe(
      tap( updated => this.logger.log(`${kind.typeId} updated: ${updated}`),
           err => this.logger.error(err)
      ),
      retryAfter(3, 1000),
      catchError(this.handleError)
    );

  }
  deleteById<T extends Identifiable>(kind: ResourceType<T>, id: string): Observable<T> {
    return this.http.get<T>(`${this.getUrl(kind)}/${id}`).pipe(
      tap( deleted => this.logger.log(`${kind.typeId} deleted: ${deleted}`),
        err => this.logger.error(err)
      ),
      retryAfter(3, 1000),
      catchError(this.handleError)
    );
  }

  protected getUrl<T extends Identifiable>(kind: ResourceType<T>) {
    return `${BASE_API_URL}/${ENTITY_TO_URL_MAP[kind.typeId]}`;
  }

  protected handleError(error: HttpErrorResponse) {
    this.logger.error(error);
    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      this.logger.error('Client-side error:' + error.error.message);
    } else {
      // Backend unsuccessful status code.
      this.logger.error(
        `Backend returned code ${error.status}, ` +
        `body was: ${JSON.stringify(error.error || error)},
        message was: ${JSON.stringify(error.message)}`);
    }
    // return ErrorObservable with a user-facing error message
    return throwError(`Error performing the operation: ${error.message ? error.message : ''}. Correct data and try again.`);
  }
}
