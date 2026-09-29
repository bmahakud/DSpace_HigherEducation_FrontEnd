import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PdfService {
  private baseUrl = 'http://192.168.0.210:8080/server/api/core/bitstreams';

  constructor(private http: HttpClient) {}

  getPdfUrl(uuid: string): Observable<string> {
    const url = `${this.baseUrl}/${uuid}/content`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map(blob => URL.createObjectURL(blob))
    );
  }
}
