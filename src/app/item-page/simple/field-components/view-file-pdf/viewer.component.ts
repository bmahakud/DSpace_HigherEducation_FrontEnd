import { Component, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';

import { MetadataService } from 'src/app/services/metadata.service';

@Component({
  standalone: true,
  selector: 'app-pdf-viewer',
  imports: [CommonModule],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss'],
})
export class ViewerComponent {
  fileUrl: SafeResourceUrl | null = null;
  // loading = true;
  error = false;
  zoomLevel = 1.0;

  metadataObj: any[] = []; // <-- store array directly


  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private metadataService: MetadataService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(APP_CONFIG) private appConfig: AppConfig
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      // this.loading = false;
      return;
    }

    // Directly assign metadataObj
    this.metadataObj = this.metadataService.getMetadata() || [];

    this.route.paramMap.subscribe((pm) => {
      const uuid = pm.get('UUID');
      if (!uuid) {
        this.error = true;
        // this.loading = false;
        return;
      }
      this.fetchPdf(uuid);
    });
  }

  private fetchPdf(uuid: string) {
    // this.loading = true;
    this.error = false;

    const url = `${this.appConfig.rest.baseUrl}/api/core/bitstreams/${uuid}/content`;

    this.http
      .get(url, {
        responseType: 'blob',
        withCredentials: true,
      })
      .subscribe({
        next: (blob) => {
          const objUrl = URL.createObjectURL(blob);
          this.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objUrl);
          this.cdr.detectChanges();
          // this.loading = false;
        },
        error: (err) => {
          this.error = true;
          this.cdr.detectChanges();
          // this.loading = false;
        },
      });
  }

  downloadPdf() {
    let filename = 'document.pdf';

    const nameEntry = this.metadataObj?.find(
      md => md.key.toLowerCase().includes('dc.publisher')
    );
    console.log(nameEntry);

    if (nameEntry && nameEntry.value?.length > 0) {
      filename = nameEntry.value[0].value;
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
      }
      console.log(filename)
    }

    // Create download link
    const a = document.createElement('a');
    a.href = (this.fileUrl as any).changingThisBreaksApplicationSecurity;
    a.download = filename;
    a.click();
  }
  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.25, 5);
  }
  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.25, 0.25);
  }
  resetZoom() {
    this.zoomLevel = 1.0;
  }
}
