import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  private baseUrl = 'http://192.168.0.210:8080/server/api/core/bitstreams';

  constructor(private http: HttpClient) { }

  getPdfUrl(uuid: string): string {
    return `${this.baseUrl}/${uuid}/content`;
  }

  getPdfContent(uuid: string): Observable<Blob> {
    const url = this.getPdfUrl(uuid);
    return this.http.get(url, { responseType: 'blob' });
  }

  getPdfAsDataUrl(uuid: string): Observable<string> {
    return this.getPdfContent(uuid).pipe(
      map(blob => {
        return URL.createObjectURL(blob);
      }),
      catchError(error => {
        console.error('Error loading PDF:', error);
        return of('');
      })
    );
  }

  checkPdfExists(uuid: string): Observable<boolean> {
    const url = this.getPdfUrl(uuid);
    
    // Use a simple GET request instead of HEAD to avoid CORS issues
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map(() => true), // If GET request succeeds, PDF exists
      catchError((error) => {
        console.error('Error checking PDF existence:', error);
        return of(false); // Return false if PDF doesn't exist
      })
    );
  }
}
