import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, Observable } from 'rxjs';
import { SearchService } from '../../../core/shared/search/search.service';
import { PaginatedSearchOptions } from '../../../shared/search/models/paginated-search-options.model';
import { Item } from '../../../core/shared/item.model';
import { Bitstream } from '../../../core/shared/bitstream.model';
import { SearchResult } from '../../../shared/search/models/search-result.model';
import { DSpaceObject } from '../../../core/shared/dspace-object.model';
import { DSpaceObjectType } from '../../../core/shared/dspace-object-type.model';
import { getFirstSucceededRemoteDataPayload, getFirstCompletedRemoteData } from '../../../core/shared/operators';
import { BitstreamDataService } from '../../../core/data/bitstream-data.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

interface ReportPdf {
  pdfName: string;
  sizeBytes: number;
  sizeReadable: string;
}

interface ReportItem {
  uploadDate: string;
  fileName: string;
  fileNumber: string;
  pdfs: ReportPdf[];
}

@Component({
  selector: 'ds-pdf-uploads-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './pdf-uploads-report.component.html',
  styleUrls: ['./pdf-uploads-report.component.scss']
})
export class PdfUploadsReportComponent implements OnInit {
  filterForm: FormGroup;
  reportData$ = new BehaviorSubject<ReportItem[]>([]);
  loading$ = new BehaviorSubject<boolean>(false);
  
  totalPdfs = 0;
  totalSizeBytes = 0;
  totalSizeReadable = '0 KB';
  hasSearched = false;
  validationMessage = '';

  constructor(
    private fb: FormBuilder,
    private searchService: SearchService,
    private bitstreamService: BitstreamDataService
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.filterForm = this.fb.group({
      reportType: ['single', Validators.required],
      singleDate: [today, Validators.required],
      fromDate: [today],
      toDate: [today]
    });
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  isDateSelectionValid(): boolean {
    const reportType = this.filterForm?.get('reportType')?.value || 'single';

    if (reportType === 'single') {
      return !!this.filterForm?.get('singleDate')?.value;
    }

    const fromDate = this.filterForm?.get('fromDate')?.value;
    const toDate = this.filterForm?.get('toDate')?.value;

    return !!fromDate && !!toDate && fromDate <= toDate;
  }

  async generateReport() {
    this.validationMessage = '';
    const reportType = this.filterForm.get('reportType')?.value || 'single';

    if (reportType === 'single') {
      const singleDate = this.filterForm.get('singleDate')?.value;
      if (!singleDate) {
        this.validationMessage = 'Please select a date to generate the report.';
        this.loading$.next(false);
        return;
      }
    } else {
      const fromDate = this.filterForm.get('fromDate')?.value;
      const toDate = this.filterForm.get('toDate')?.value;
      if (!fromDate || !toDate) {
        this.validationMessage = 'Please choose both From Date and To Date.';
        this.loading$.next(false);
        return;
      }

      if (fromDate > toDate) {
        this.validationMessage = 'From Date cannot be later than To Date.';
        this.loading$.next(false);
        return;
      }
    }

    this.hasSearched = true;
    this.loading$.next(true);
    this.reportData$.next([]);
    this.totalPdfs = 0;
    this.totalSizeBytes = 0;

    const { singleDate, fromDate, toDate } = this.filterForm.value;

    const fromTime = reportType === 'single'
      ? new Date(`${singleDate}T00:00:00`).getTime()
      : new Date(`${fromDate}T00:00:00`).getTime();
    const toTime = reportType === 'single'
      ? new Date(`${singleDate}T23:59:59`).getTime()
      : new Date(`${toDate}T23:59:59`).getTime();

    // Fetch all items and filter in JS to avoid SOLR syntax & index lag issues
    const options = new PaginatedSearchOptions({
      query: '*:*',
      dsoTypes: [DSpaceObjectType.ITEM],
      pagination: {
        id: 'report-search',
        currentPage: 1,
        pageSize: 1000
      } as any
    });

    this.searchService.search(options).pipe(
      getFirstSucceededRemoteDataPayload()
    ).subscribe(async (searchResult: any) => {
      const rows: ReportItem[] = [];
      const items = searchResult.page.map((res: SearchResult<DSpaceObject>) => res.indexableObject as Item);

      for (const item of items) {
        const uploadDateStr = item.firstMetadataValue('dc.date.accessioned') || item.lastModified || 'Unknown';
        const uploadTime = new Date(uploadDateStr).getTime();
        
        // Filter by JS date (Item upload date)
        if (uploadTime >= fromTime && uploadTime <= toTime) {
          
          // Find ORIGINAL bundle bitstreams
          const bitstreamsRD = await this.bitstreamService.findAllByItemAndBundleName(item, 'ORIGINAL').pipe(
            getFirstCompletedRemoteData()
          ).toPromise();

          if (bitstreamsRD.hasSucceeded && bitstreamsRD.payload) {
            const bitstreams = bitstreamsRD.payload.page;
            const pdfsForThisItem: ReportPdf[] = [];
            
            for (const bit of bitstreams) {
              if (bit.name && bit.name.toLowerCase().endsWith('.pdf')) {
                pdfsForThisItem.push({
                  pdfName: bit.name,
                  sizeBytes: bit.sizeBytes,
                  sizeReadable: this.formatBytes(bit.sizeBytes)
                });
                this.totalPdfs++;
                this.totalSizeBytes += bit.sizeBytes;
              }
            }
            
            if (pdfsForThisItem.length > 0) {
              // Extract metadata
              const fileName = item.firstMetadataValue('dc.file.name') || 'N/A';
              const fileNumber = item.firstMetadataValue('dc.filenumber') || item.firstMetadataValue('dc.case.number') || 'N/A';
              
              rows.push({
                uploadDate: uploadDateStr,
                fileName: fileName,
                fileNumber: fileNumber,
                pdfs: pdfsForThisItem
              });
            }
          }
        }
      }

      this.totalSizeReadable = this.formatBytes(this.totalSizeBytes);
      this.reportData$.next(rows);
      this.loading$.next(false);
    });
  }

  exportCsv() {
    const rows = this.reportData$.getValue();
    if (!rows.length) return;

    const headers = ['Upload Date', 'File Name', 'File Number', 'PDF File Name', 'File Size'];
    const csvLines = [headers.join(',')];
    
    rows.forEach(item => {
      item.pdfs.forEach((pdf, index) => {
        if (index === 0) {
          csvLines.push(`"${item.uploadDate}","${item.fileName}","${item.fileNumber}","${pdf.pdfName}","${pdf.sizeReadable}"`);
        } else {
          csvLines.push(`"","","","${pdf.pdfName}","${pdf.sizeReadable}"`);
        }
      });
    });
    
    csvLines.push(`\nTotal PDFs: ${this.totalPdfs},Total Size: ${this.totalSizeReadable}`);
    const csvContent = csvLines.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pdf_upload_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async exportPdf() {
    const printContent = document.getElementById('report-table-container');
    if (!printContent) return;
    
    // Create a temporary wrapper to hold the styled content for PDF generation
    const wrapper = document.createElement('div');
    wrapper.style.padding = '20px';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.innerHTML = `
      <h2 style="text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #444; margin-bottom: 20px;">PDF Uploads Report</h2>
      <div style="text-align: center; margin-bottom: 30px; font-style: italic; color: #666; font-family: sans-serif;">Generated on: ${new Date().toLocaleString()}</div>
      ${printContent.outerHTML}
      <div style="display: flex; justify-content: space-around; margin-top: 30px; padding: 20px; border: 1px solid #ddd; background-color: #f8f9fa; font-family: sans-serif; border-radius: 5px;">
        <div style="text-align: center;">
          <div style="font-size: 14px; color: #666; text-transform: uppercase;">Total PDFs Uploaded</div>
          <div style="font-size: 24px; font-weight: bold; color: #0056b3;">${this.totalPdfs}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 14px; color: #666; text-transform: uppercase;">Total Storage Used</div>
          <div style="font-size: 24px; font-weight: bold; color: #0056b3;">${this.totalSizeReadable}</div>
        </div>
      </div>
    `;

    // Apply inline styles to the cloned table so html2canvas renders it perfectly
    const tables = wrapper.getElementsByTagName('table');
    for (let i = 0; i < tables.length; i++) {
      tables[i].style.width = '100%';
      tables[i].style.borderCollapse = 'collapse';
      tables[i].style.fontFamily = 'sans-serif';
      tables[i].style.fontSize = '12px';
    }
    
    const ths = wrapper.getElementsByTagName('th');
    for (let i = 0; i < ths.length; i++) {
      ths[i].style.border = '1px solid #dee2e6';
      ths[i].style.padding = '10px';
      ths[i].style.backgroundColor = '#f8f9fa';
      ths[i].style.color = '#212529';
      ths[i].style.textAlign = 'left';
    }
    
    const tds = wrapper.getElementsByTagName('td');
    for (let i = 0; i < tds.length; i++) {
      tds[i].style.border = '1px solid #dee2e6';
      tds[i].style.padding = '10px';
      
      // Fix badge styling for PDF
      const badges = tds[i].getElementsByClassName('badge');
      for (let j = 0; j < badges.length; j++) {
         const badge = badges[j] as HTMLElement;
         badge.style.backgroundColor = '#17a2b8';
         badge.style.color = '#ffffff';
         badge.style.padding = '4px 8px';
         badge.style.borderRadius = '4px';
      }
    }

    try {
      // @ts-ignore - Ignore TS error for missing types
      const html2pdfModule: any = await import('html2pdf.js');
      const html2pdf: any = html2pdfModule.default ? html2pdfModule.default : html2pdfModule;
      
      const opt = {
        margin:       10,
        filename:     `pdf_upload_report_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      html2pdf().set(opt).from(wrapper).save();
    } catch (e) {
      console.error('Failed to load html2pdf.js', e);
      // Fallback to print if library fails to load
      window.print();
    }
  }
}
