// src/app/services/metadata.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MetadataService {
  private metadataSubject = new BehaviorSubject<any[]>([]);

  // Observable to subscribe in other components
  metadata$: Observable<any[]> = this.metadataSubject.asObservable();

  // Method to set/update metadata
  setMetadata(metadata: any[]) {
    this.metadataSubject.next(metadata);
  }

  // Method to retrieve current metadata snapshot
  getMetadata(): any[] {
    return this.metadataSubject.getValue();
  }
}
