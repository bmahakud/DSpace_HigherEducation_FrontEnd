import { Component, OnInit } from '@angular/core';
import { SearchService } from '../services/search.service';

@Component({
  selector: 'app-search-page',
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.scss']
})
export class SearchPageComponent implements OnInit {
  department = '';
  section = '';
  fileNumber = '';
  fileName = '';

  allResults: any[] = [];
  filteredResults: any[] = [];

  constructor(private searchService: SearchService) { }

  ngOnInit() {
    const result = this.searchService.getAllFiles().subscribe({
      next: (res: any) => {
        const rawResults = res._embedded?.searchResult?._embedded?.objects || [];

        // Keep only results with a department name
        this.allResults = rawResults.filter(item => {
          const metadata = item._embedded?.indexableObject?.metadata || {};
          const deptValue = metadata['dc.contributor.author']?.[0]?.value?.trim();
          return !!deptValue;
        });

        // Initially, filteredResults is the same as allResults
        this.filteredResults = [...this.allResults];

        console.log(`Loaded ${this.allResults.length} records with department`);
      },
      error: err => {
        console.error('Failed to fetch data', err);
      }
    });
    console.log(result)
  }


  onDepartmentChange(value: string) {
    this.department = value;
    this.applyFilters();
  }

  onSectionChange(value: string) {
    this.section = value;
    this.applyFilters();
  }

  onFilenumberChange(value: string) {
    this.fileNumber = value;
    this.applyFilters();
  }

  onFilenameChange(value: string) {
    this.fileName = value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredResults = this.allResults.filter(item => {
      const metadata = item._embedded?.indexableObject?.metadata || {};

      const dept = (metadata['dc.contributor.author']?.[0]?.value || '').toLowerCase();
      const sect = (metadata['dc.title']?.[0]?.value || '').toLowerCase();
      const fileNo = (metadata['dc.title.alternative']?.[0]?.value || '').toLowerCase();
      const fileNm = (metadata['dc.publisher']?.[0]?.value || '').toLowerCase();
      console.log(metadata)
      return (
        (!this.department || dept.includes(this.department.toLowerCase())) &&
        (!this.section || sect.includes(this.section.toLowerCase())) &&
        (!this.fileNumber || fileNo.includes(this.fileNumber.toLowerCase())) &&
        (!this.fileName || fileNm.includes(this.fileName.toLowerCase()))
      );
    });
  }
}
