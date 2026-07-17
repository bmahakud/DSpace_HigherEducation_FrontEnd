import { AsyncPipe, NgIf } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Bitstream } from '../../core/shared/bitstream.model';
import { Item } from '../../core/shared/item.model';
import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { FileDownloadLinkComponent } from '../file-download-link/file-download-link.component';
import { RemoteData } from '../../core/data/remote-data';
import { BitstreamFormat } from '../../core/shared/bitstream-format.model';
import { take } from 'rxjs/operators';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'ds-file-view',
  templateUrl: './file-view.component.html',
  styleUrls: ['./file-view.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    NgIf,
    TranslateModule,
    FileDownloadLinkComponent,
    CommonModule, NgxExtendedPdfViewerModule
  ],
})
export class FileViewComponent implements OnInit {
  @Input() bitstream: Bitstream;
  @Input() item: Item;

  fileUrl: string;
  isPdf = false;
  isImage = false;
  isAudio = false;
  isVideo = false;

  constructor(public dsoNameService: DSONameService) {}

  ngOnInit() {
    if (this.bitstream?._links?.content?.href) {
      this.fileUrl = this.bitstream._links.content.href;

      // ✅ unwrap the observable
      this.bitstream.format?.pipe(take(1)).subscribe((rd: RemoteData<BitstreamFormat>) => {
        if (rd?.payload) {
          const mimeType = rd.payload.mimetype || '';

          this.isPdf = mimeType.includes('pdf');
          this.isImage = mimeType.startsWith('image');
          this.isAudio = mimeType.startsWith('audio');
          this.isVideo = mimeType.startsWith('video');
        }
      });
    }
  }
}
