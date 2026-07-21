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
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('viewer_metadata', JSON.stringify(metadata));
      }
    } catch (e) {
      console.warn('Could not save metadata to sessionStorage', e);
    }
  }

  // Method to retrieve current metadata snapshot
  getMetadata(): any[] {
    let meta = this.metadataSubject.getValue();
    if ((!meta || meta.length === 0) && typeof sessionStorage !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('viewer_metadata');
        if (stored) {
          meta = JSON.parse(stored);
          this.metadataSubject.next(meta);
        }
      } catch (e) {
        console.warn('Could not retrieve metadata from sessionStorage', e);
      }
    }
    return meta;
  }
}
