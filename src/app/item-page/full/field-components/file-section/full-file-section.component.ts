import { AsyncPipe } from '@angular/common';
import {
  Component,
  Inject,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';

import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { Observable } from 'rxjs';
import {
  switchMap,
  tap,
} from 'rxjs/operators';
import {
  APP_CONFIG,
  AppConfig,
} from 'src/config/app-config.interface';

import { DSONameService } from '../../../../core/breadcrumbs/dso-name.service';
import { BitstreamDataService } from '../../../../core/data/bitstream-data.service';
import { PaginatedList } from '../../../../core/data/paginated-list.model';
import { RemoteData } from '../../../../core/data/remote-data';
import { PaginationService } from '../../../../core/pagination/pagination.service';
import { Bitstream } from '../../../../core/shared/bitstream.model';
import { Item } from '../../../../core/shared/item.model';
import {
  hasValue,
  isEmpty,
} from '../../../../shared/empty.util';
import { ThemedFileDownloadLinkComponent } from '../../../../shared/file-download-link/themed-file-download-link.component';
import { MetadataFieldWrapperComponent } from '../../../../shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { NotificationsService } from '../../../../shared/notifications/notifications.service';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginationComponentOptions } from '../../../../shared/pagination/pagination-component-options.model';
import { FileSizePipe } from '../../../../shared/utils/file-size-pipe';
import { followLink } from '../../../../shared/utils/follow-link-config.model';
import { VarDirective } from '../../../../shared/utils/var.directive';
import { ThemedThumbnailComponent } from '../../../../thumbnail/themed-thumbnail.component';
import { FileSectionComponent } from '../../../simple/field-components/file-section/file-section.component';
import { FileViewComponent } from 'src/app/shared/file-view/file-view.component';

/**
 * This component renders the file section of the item
 * inside a 'ds-metadata-field-wrapper' component.
 */

@Component({
  selector: 'ds-base-item-page-full-file-section',
  styleUrls: ['./full-file-section.component.scss'],
  templateUrl: './full-file-section.component.html',
  imports: [
    AsyncPipe,
    FileSizePipe,
    MetadataFieldWrapperComponent,
    PaginationComponent,
    ThemedFileDownloadLinkComponent,
    ThemedThumbnailComponent,
    TranslateModule,
    VarDirective,
    FileViewComponent
  ],
  standalone: true,
})
export class FullFileSectionComponent extends FileSectionComponent implements OnDestroy, OnInit {

  @Input() item: Item;

  label: string;

  originals$: Observable<RemoteData<PaginatedList<Bitstream>>>;
  licenses$: Observable<RemoteData<PaginatedList<Bitstream>>>;

  originalOptions = Object.assign(new PaginationComponentOptions(), {
    id: 'obo',
    currentPage: 1,
    pageSize: this.appConfig.item.bitstream.pageSize,
  });

  licenseOptions = Object.assign(new PaginationComponentOptions(), {
    id: 'lbo',
    currentPage: 1,
    pageSize: this.appConfig.item.bitstream.pageSize,
  });

  constructor(
    bitstreamDataService: BitstreamDataService,
    protected notificationsService: NotificationsService,
    protected translateService: TranslateService,
    protected paginationService: PaginationService,
    public dsoNameService: DSONameService,
    public router: Router,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) {
    super(bitstreamDataService, notificationsService, translateService, dsoNameService, appConfig);
  }

  ngOnInit(): void {
    this.initialize();
  }

  initialize(): void {
    this.originals$ = this.paginationService.getCurrentPagination(this.originalOptions.id, this.originalOptions).pipe(
      switchMap((options: PaginationComponentOptions) => this.bitstreamDataService.findAllByItemAndBundleName(
        this.item,
        'ORIGINAL',
        { elementsPerPage: options.pageSize, currentPage: options.currentPage },
        true,
        true,
        followLink('format'),
        followLink('thumbnail'),
        followLink('accessStatus'),
      )),
      tap((rd: RemoteData<PaginatedList<Bitstream>>) => {
        if (hasValue(rd.errorMessage)) {
          this.notificationsService.error(this.translateService.get('file-section.error.header'), `${rd.statusCode} ${rd.errorMessage}`);
        }
      },
      ),
    );

    this.licenses$ = this.paginationService.getCurrentPagination(this.licenseOptions.id, this.licenseOptions).pipe(
      switchMap((options: PaginationComponentOptions) => this.bitstreamDataService.findAllByItemAndBundleName(
        this.item,
        'LICENSE',
        { elementsPerPage: options.pageSize, currentPage: options.currentPage },
        true,
        true,
        followLink('format'),
        followLink('thumbnail'),
        followLink('accessStatus'),
      )),
      tap((rd: RemoteData<PaginatedList<Bitstream>>) => {
        if (hasValue(rd.errorMessage)) {
          this.notificationsService.error(this.translateService.get('file-section.error.header'), `${rd.statusCode} ${rd.errorMessage}`);
        }
      },
      ),
    );

  }

  hasValuesInBundle(bundle: PaginatedList<Bitstream>) {
    return hasValue(bundle) && !isEmpty(bundle.page);
  }

  ngOnDestroy(): void {
    this.paginationService.clearPagination(this.originalOptions.id);
    this.paginationService.clearPagination(this.licenseOptions.id);
  }
  
  onViewFile(file: any) {
    // You can open your custom PDF viewer component / modal here
    console.log("Viewing file:", file);
    // Example: navigate to a viewer page
    this.router.navigate(['/viewer', file.uuid]);
  //   this.router.navigate(
  //   ['/viewer', file.uuid],
  //   { state: { metadata } }   // pass metadata via state
  // );
  }

}
