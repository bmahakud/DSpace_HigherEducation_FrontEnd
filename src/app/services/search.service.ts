import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private baseUrl = 'http://localhost:8080/server/api/discover/search/objects';

  constructor(private http: HttpClient) { }

  searchFiles(filters: any, pageSize: number): Observable<any> {
  let params = new HttpParams().set('size', pageSize.toString());

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params = params.append(`f.${key}`, `${value},equals`);
    }
  });

  return this.http.get(this.baseUrl, { params });
}
getAllFiles(): Observable<any> {
  const url = `${this.baseUrl}`;
  return this.http.get(url);
}



  searchCases(caseNumber: string, caseType: string, caseYear: string, sortBy: string, sortOrder: string, size: number) {
    let params = new HttpParams()
      .set('sort', `dc.title,${sortOrder}`)
      .set('size', size.toString());

    if (caseNumber) {
      params = params.append('f.dc_case.number', `${caseNumber},equals`);
    }

    if (caseType) {
      params = params.append('f.dc_casetype', `${caseType},equals`);
    }

    if (caseYear) {
      params = params.append('f.dc_caseyear', `${caseYear},equals`);
    }


    return this.http.get(this.baseUrl, { params });
  }
}
