import {
  AsyncPipe,
  KeyValuePipe,
  Location,
} from '@angular/common';

import { Bitstream } from 'src/app/core/shared/bitstream.model';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import {
  ActivatedRoute,
  Data,
  Router,
  RouterLink,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  BehaviorSubject,
  Observable,
} from 'rxjs';
import {
  filter,
  map,
} from 'rxjs/operators';

import { NotifyInfoService } from '../../core/coar-notify/notify-info/notify-info.service';
import { AuthorizationDataService } from '../../core/data/feature-authorization/authorization-data.service';
import { ItemDataService } from '../../core/data/item-data.service';
import { RemoteData } from '../../core/data/remote-data';
import { SignpostingDataService } from '../../core/data/signposting-data.service';
import { LinkHeadService } from '../../core/services/link-head.service';
import { ServerResponseService } from '../../core/services/server-response.service';
import { Item } from '../../core/shared/item.model';
import { MetadataMap } from '../../core/shared/metadata.models';
import { fadeInOut } from '../../shared/animations/fade';
import { DsoEditMenuComponent } from '../../shared/dso-page/dso-edit-menu/dso-edit-menu.component';
import { hasValue } from '../../shared/empty.util';
import { ErrorComponent } from '../../shared/error/error.component';
import { ThemedLoadingComponent } from '../../shared/loading/themed-loading.component';
import { VarDirective } from '../../shared/utils/var.directive';
import { ThemedItemAlertsComponent } from '../alerts/themed-item-alerts.component';
import { CollectionsComponent } from '../field-components/collections/collections.component';
import { ThemedItemPageTitleFieldComponent } from '../simple/field-components/specific-field/title/themed-item-page-field.component';
import { ItemPageComponent } from '../simple/item-page.component';
import { ItemVersionsComponent } from '../versions/item-versions.component';
import { ItemVersionsNoticeComponent } from '../versions/notice/item-versions-notice.component';
import { ThemedFullFileSectionComponent } from './field-components/file-section/themed-full-file-section.component';
import { MetadataService } from 'src/app/services/metadata.service';

/**
 * This component renders a full item page.
 * The route parameter 'id' is used to request the item it represents.
 * 
 */

@Component({
  selector: 'ds-base-full-item-page',
  styleUrls: ['./full-item-page.component.scss'],
  templateUrl: './full-item-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeInOut],
  imports: [
    AsyncPipe,
    CollectionsComponent,
    DsoEditMenuComponent,
    ErrorComponent,
    ItemVersionsComponent,
    ItemVersionsNoticeComponent,
    KeyValuePipe,
    RouterLink,
    ThemedFullFileSectionComponent,
    ThemedItemAlertsComponent,
    ThemedItemPageTitleFieldComponent,
    ThemedLoadingComponent,
    TranslateModule,
    VarDirective,
  ],
  standalone: true,
})
export class FullItemPageComponent extends ItemPageComponent implements OnInit, OnDestroy {

  itemRD$: BehaviorSubject<RemoteData<Item>>;
  metadata$: Observable<{ label: string, key: string, value: any[] }[]>;

  fromSubmissionObject = false;
  subs = [];

 private keyToLabel: Record<string, string> = {
  
     'dc.barcode': 'Barcode',
   'dc.file.name': 'File Name',
   'dc.filenumber': 'File Number',
   'dc.case.status': 'Case Status',
   'dc.case.type': 'Case Type',
  'dc.file.year': 'File Year',
  'dc.case.number': 'Case Number',
  'dc.case.nature': 'Case Nature',
  'dc.subject.matter': 'Subject/Case Matter',
  'dc.petitioner': 'Petitioner',
  'dc.respondent': 'Respondent',
  'dc.case.district': 'Case District',
  'dc.case.institution': 'Case Institution',
  'dc.comment': 'Description',
  'dc.branch': 'Branch',
  'dc.institution': 'Institution',
};

  private sortOrder = [
    'dc.institution',
    'dc.branch',
    'dc.barcode',
    'dc.file.name',
  'dc.filenumber',
  'dc.file.year',
 'dc.case.status',
 'dc.case.nature',
  'dc.case.number',
   'dc.case.type',
  'dc.subject.matter',
  'dc.comment',
  'dc.petitioner',
  'dc.respondent',
  'dc.case.district',
  'dc.case.institution'
];

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    protected items: ItemDataService,
    protected authorizationService: AuthorizationDataService,
    protected _location: Location,
    protected responseService: ServerResponseService,
    protected signpostingDataService: SignpostingDataService,
    protected linkHeadService: LinkHeadService,
    protected notifyInfoService: NotifyInfoService,
    @Inject(PLATFORM_ID) protected platformId: string,
    private metadataService: MetadataService,
  ) {
    super(route, router, items, authorizationService, responseService, signpostingDataService, linkHeadService, notifyInfoService, platformId);
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.metadata$ = this.itemRD$.pipe(
      map((rd: RemoteData<Item>) => rd.payload),
      filter((item: Item) => hasValue(item)),
      map((item: Item) => {
        const metadataObj: MetadataMap = item.metadata;
        return this.sortOrder
          .filter(key => metadataObj[key])
          .map(key => ({
            key,
            label: this.keyToLabel[key],
            value: metadataObj[key]
          }));
      })
    );

    // ✅ Push into service whenever metadata changes
    this.metadata$.subscribe(meta => {
      console.log("Metadata emitted to template:", meta);
      this.metadataService.setMetadata(meta); // Store globally
    });

    this.subs.push(this.route.data.subscribe((data: Data) => {
      this.fromSubmissionObject = hasValue(data.wfi) || hasValue(data.wsi);
    }));
  }


  back() {
    this._location.back();
  }

  ngOnDestroy() {
    this.subs.filter((sub) => hasValue(sub)).forEach((sub) => sub.unsubscribe());
  }
  getMetadata() {
    return this.metadata$;
  }
}