import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ds-bitstream-viewer',
  templateUrl: './bitstream-viewer.component.html',
  styleUrls: ['./bitstream-viewer.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class BitstreamViewerComponent implements OnInit {
  fileUrl: string;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    this.fileUrl = `/api/bitstreams/${uuid}/content`; // API endpoint for bitstream content
  }

  download() {
    window.open(this.fileUrl, '_blank');
  }
}
