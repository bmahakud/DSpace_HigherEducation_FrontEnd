import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { DsFindPipe } from './ds-find.pipe';
import { CURRENT_API_URL } from 'src/app/api-urls';
import { ChangeDetectorRef } from '@angular/core';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Branch {
  code: string;
  label: string;
}

export interface SubType {
  code: string;
  label: string;
  group_name: string;
  has_children: boolean;
}

export interface Institution {
  id: number;
  code: string;
  name: string;
  district_code: string;
  annexure: string;
}

export interface District {
  code: string;
  name: string;
}

export interface SectionInstitutionValue {
  branch: string;
  branchLabel: string;
  subType: string;
  subTypeLabel: string;
  institution?: string;
  institutionLabel?: string;
  district?: string;
  /** Formatted string stored in DSpace metadata */
  displayValue: string;
  storedValue: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'ds-section-institution',
  standalone: true,
  imports: [CommonModule, FormsModule, DsFindPipe],
  templateUrl: './section-institution.component.html',
  styleUrls: ['./section-institution.component.scss'],
})
export class SectionInstitutionComponent implements OnInit, OnDestroy {

  /** Emits the final composed value whenever the selection changes */
  @Output() valueChange = new EventEmitter<SectionInstitutionValue>();

  // ── State ──────────────────────────────────────────────────────────────────

  branches: Branch[] = [];
  subTypes: SubType[] = [];
  districts: District[] = [];
  institutions: Institution[] = [];
  filteredInstitutions: Institution[] = [];

  selectedBranch: string = '';
  selectedSubType: string = '';
  selectedDistrict: string = '';
  selectedInstitution: string = '';
  searchQuery: string = '';

  isLoadingBranches = false;
  isLoadingSubTypes = false;
  isLoadingInstitutions = false;
  showInstitutionDropdown = false;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  selectedChildSubType: string = '';
  childSubTypes: SubType[] = [];
  selectedSubChildSubType: string = '';
  subChildSubTypes: SubType[] = [];

  // ── Base API URL — update this to match your DSpace REST base URL ──────────
  private readonly API = `${CURRENT_API_URL}/api/hed`;

  readonly RDE_DISTRICT_MAP: { [key: string]: string[] } = {
    'RDE_BBS': ['ANGUL', 'CUTTACK', 'DHENKANAL', 'JAJPUR', 'KHURDA', 'NAYAGARH', 'PURI', 'JAGATSINGHPUR', 'KENDRAPARA'],
    'RDE_BAL': ['BALASORE', 'KEONJHAR', 'MAYURBHANJ', 'BHADRAK'],
    'RDE_BER': ['BOUDH', 'GAJAPATI', 'GANJAM', 'KANDHAMAL'],
    'RDE_SBP': ['BARGARH', 'BALANGIR', 'DEOGARH', 'KALAHANDI', 'NUAPADA', 'SAMBALPUR', 'SUBARNAPUR', 'SUNDARGARH', 'JHARSUGUDA'],
    'RDE_JEY': ['KORAPUT', 'MALKANGIRI', 'NABARANGPUR', 'RAYAGADA']
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) { }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadBranches();
    this.loadDistricts();
    this.setupSearch();
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadBranches(): void {
    this.isLoadingBranches = true;
    this.http.get<Branch[]>(`${this.API}/branches`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.branches = data;
          this.isLoadingBranches = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Fallback static data if API not yet ready
          this.branches = [
            { code: 'admin', label: 'Administrative Establishment' },
            { code: 'field', label: 'Field Establishment' },
            { code: 'college', label: 'College' },
            { code: 'univ', label: 'University' },
          ];
          this.isLoadingBranches = false;
        },
      });
  }

  loadDistricts(): void {
    this.http.get<District[]>(`${this.API}/districts`, {
      headers: {
        // remove Authorization to test
      }
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.districts = data; },
        error: () => { this.districts = []; },
      });
  }

  get availableDistricts(): District[] {
    const type = this.selectedSubChildSubType || this.selectedChildSubType || this.selectedSubType;
    if (type && type.startsWith('RDE_')) {
      const rdeCode = Object.keys(this.RDE_DISTRICT_MAP).find(k => type.startsWith(k));
      if (rdeCode) {
        const allowed = this.RDE_DISTRICT_MAP[rdeCode];
        return this.districts.filter(d => allowed.includes(d.code));
      }
    }
    return this.districts;
  }

  loadSubTypes(branchCode: string): void {
    this.isLoadingSubTypes = true;
    this.http.get<SubType[]>(`${this.API}/subtypes`, { params: { branch: branchCode } })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.subTypes = data;
          this.isLoadingSubTypes = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isLoadingSubTypes = false; },
      });
  }

  loadInstitutions(): void {
    if (!this.selectedSubType) { return; }
    this.isLoadingInstitutions = true;
    const subTypeToUse = this.selectedSubChildSubType || this.selectedChildSubType || this.selectedSubType;

    const params: any = { sub_type: subTypeToUse };
    if (this.selectedDistrict) { params.district = this.selectedDistrict; }
    if (this.searchQuery) { params.q = this.searchQuery; }

    this.http.get<Institution[]>(`${this.API}/institutions`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.institutions = data;
          this.filteredInstitutions = data;
          this.isLoadingInstitutions = false;
          this.cdr.detectChanges();
        },
        error: () => { this.isLoadingInstitutions = false; },
      });
  }

  onChildSubTypeChange(): void {
    this.selectedDistrict = '';
    this.selectedInstitution = '';
    this.selectedSubChildSubType = '';
    this.searchQuery = '';
    this.institutions = [];
    this.subChildSubTypes = [];

    const subType = this.childSubTypes.find(s => s.code === this.selectedChildSubType);

    if (subType?.has_children) {
      this.loadSubChildSubTypes();
      this.showInstitutionDropdown = false;
      return;
    }

    this.showInstitutionDropdown = this.needsInstitutionDropdown();
    if (this.showInstitutionDropdown) {
      this.loadInstitutions(); 
    }

    this.emitValue();
  }

  onSubChildSubTypeChange(): void {
    this.selectedDistrict = '';
    this.selectedInstitution = '';
    this.searchQuery = '';
    this.institutions = [];

    this.showInstitutionDropdown = this.needsInstitutionDropdown();
    if (this.showInstitutionDropdown) {
      this.loadInstitutions(); 
    }

    this.emitValue();
  }

  setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        const subTypeToUse = this.selectedSubChildSubType || this.selectedChildSubType || this.selectedSubType;
        const params: any = { sub_type: subTypeToUse, q: query }; if (this.selectedDistrict) { params.district = this.selectedDistrict; }
        return this.http.get<Institution[]>(`${this.API}/institutions`, { params });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (data) => { this.filteredInstitutions = data; },
      error: () => { },
    });
  }

  get groupedChildSubTypes(): { group: string; items: SubType[] }[] {
    const groups: { [key: string]: SubType[] } = {};
    this.childSubTypes.forEach(st => {
      const g = st.group_name || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(st);
    });
    return Object.keys(groups).map(g => ({ group: g, items: groups[g] }));
  }

  get groupedSubChildSubTypes(): { group: string; items: SubType[] }[] {
    const groups: { [key: string]: SubType[] } = {};
    this.subChildSubTypes.forEach(st => {
      const g = st.group_name || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(st);
    });
    return Object.keys(groups).map(g => ({ group: g, items: groups[g] }));
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  onBranchChange(): void {
    // Reset downstream
    this.selectedSubType = '';
    this.selectedChildSubType = '';
    this.selectedSubChildSubType = '';
    this.selectedDistrict = '';
    this.selectedInstitution = '';
    this.searchQuery = '';
    this.subTypes = [];
    this.childSubTypes = [];
    this.subChildSubTypes = [];
    this.institutions = [];
    this.filteredInstitutions = [];
    this.showInstitutionDropdown = false;

    if (this.selectedBranch) {
      this.loadSubTypes(this.selectedBranch);
    }
    this.emitValue();
  }

  onSubTypeChange(): void {
    this.selectedDistrict = '';
    this.selectedInstitution = '';
    this.selectedChildSubType = '';
    this.selectedSubChildSubType = '';
    this.searchQuery = '';
    this.childSubTypes = [];
    this.subChildSubTypes = [];
    this.institutions = [];
    this.filteredInstitutions = [];

    const subType = this.subTypes.find(s => s.code === this.selectedSubType);

    // 🔥 KEY CHANGE
    if (subType?.has_children) {
      // Load college types as child
      this.loadChildSubTypes();
      this.showInstitutionDropdown = false;
      return;
    }

    // evaluate if we should show institutions for direct selections
    this.showInstitutionDropdown = this.needsInstitutionDropdown();
    if (this.showInstitutionDropdown) {
      this.loadInstitutions();
    }


    this.emitValue();
  }
  loadChildSubTypes(): void {
    this.http.get<SubType[]>(`${this.API}/subtypes`, {
      params: { parent: this.selectedSubType }
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.childSubTypes = data;
          this.cdr.detectChanges();
        },
        error: () => { }
      });
  }

  loadSubChildSubTypes(): void {
    this.http.get<SubType[]>(`${this.API}/subtypes`, {
      params: { parent: this.selectedChildSubType }
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.subChildSubTypes = data;
          this.cdr.detectChanges();
        },
        error: () => { }
      });
  }

  onDistrictChange(): void {
    this.selectedInstitution = '';
    this.searchQuery = '';
    this.loadInstitutions();
    this.emitValue();
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchQuery);
  }

  onInstitutionSelect(institution: Institution): void {
    this.selectedInstitution = institution.code;
    this.searchQuery = institution.name;
    this.filteredInstitutions = [];
    this.emitValue();
  }

  clearInstitution(): void {
    this.selectedInstitution = '';
    this.searchQuery = '';
    this.filteredInstitutions = this.institutions;
  }

  // ── Value composition ──────────────────────────────────────────────────────

  emitValue(): void {
    const branch = this.branches.find(b => b.code === this.selectedBranch);
    const subType = this.subTypes.find(s => s.code === this.selectedSubType);
    const childSubType = this.childSubTypes.find(s => s.code === this.selectedChildSubType);
    const subChildSubType = this.subChildSubTypes.find(s => s.code === this.selectedSubChildSubType);
    const institution = this.institutions.find(i => i.code === this.selectedInstitution);

    if (!branch || !subType) { return; }

    const deepestSubType = subChildSubType || childSubType || subType;

    // storedValue format: "branch::subtype::institutionCode"
    // displayValue: human readable for the form label
    const parts = [branch.label, subType.label];
    if (childSubType) parts.push(childSubType.label);
    if (subChildSubType) parts.push(subChildSubType.label);
    
    const stored = [branch.code, deepestSubType.code];

    if (institution) {
      parts.push(institution.name);
      stored.push(institution.code);
    }

    const value: SectionInstitutionValue = {
      branch: branch.code,
      branchLabel: branch.label,
      subType: deepestSubType.code,
      subTypeLabel: deepestSubType.label,
      institution: institution?.code,
      institutionLabel: institution?.name,
      district: this.selectedDistrict || undefined,
      displayValue: parts.join(' › '),
      storedValue: stored.join('::'),
    };

    this.valueChange.emit(value);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get groupedSubTypes(): { group: string; items: SubType[] }[] {
    const groups: { [key: string]: SubType[] } = {};
    this.subTypes.forEach(st => {
      const g = st.group_name || 'General';
      if (!groups[g]) { groups[g] = []; }
      groups[g].push(st);
    });
    return Object.keys(groups).map(g => ({ group: g, items: groups[g] }));
  }

  needsDistrict(): boolean {
    const type = this.selectedSubChildSubType || this.selectedChildSubType || this.selectedSubType;
    if (!type) return false;
    return type.endsWith('GC') || type.endsWith('NGC') || type.endsWith('NGC_488') || type.endsWith('NGC_662') || type.endsWith('SC') || type.endsWith('PVT');
  }

  needsInstitutionDropdown(): boolean {
    const type = this.selectedSubChildSubType || this.selectedChildSubType || this.selectedSubType;
    if (!type) return false;
    
    // According to the flowchart and business rules, only these specific items have institution lists
    const hasInstitutions = ['GC', 'NGC', 'NGC_488', 'NGC_662', 'SC', 'PVT', 'SPU', 'PU'];
    
    // Check exact matches or dynamically generated RDE suffix matches
    return hasInstitutions.some(code => type === code || type.endsWith('_' + code));
  }
}