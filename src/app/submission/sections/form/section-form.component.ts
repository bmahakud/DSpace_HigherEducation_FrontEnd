import {
  ChangeDetectorRef,
  Component,
  Inject,
  ViewChild,
} from '@angular/core';
import {
  DynamicFormControlEvent,
  DynamicFormControlModel,
} from '@ng-dynamic-forms/core';
import { TranslateService } from '@ngx-translate/core';
import findIndex from 'lodash/findIndex';
import isEqual from 'lodash/isEqual';
import {
  combineLatest as observableCombineLatest,
  Observable,
  Subscription,
} from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  find,
  map,
  mergeMap,
  take,
  tap,
} from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { ObjectCacheService } from '../../../core/cache/object-cache.service';
import { ConfigObject } from '../../../core/config/models/config.model';
import { FormRowModel } from '../../../core/config/models/config-submission-form.model';
import { SubmissionFormsModel } from '../../../core/config/models/config-submission-forms.model';
import { SubmissionFormsConfigDataService } from '../../../core/config/submission-forms-config-data.service';
import { RemoteData } from '../../../core/data/remote-data';
import { RequestService } from '../../../core/data/request.service';
import { JsonPatchOperationPathCombiner } from '../../../core/json-patch/builder/json-patch-operation-path-combiner';
import {
  getFirstSucceededRemoteData,
  getRemoteDataPayload,
} from '../../../core/shared/operators';
import { SubmissionObject } from '../../../core/submission/models/submission-object.model';
import { WorkflowItem } from '../../../core/submission/models/workflowitem.model';
import { WorkspaceItem } from '../../../core/submission/models/workspaceitem.model';
import { WorkspaceitemSectionFormObject } from '../../../core/submission/models/workspaceitem-section-form.model';
import { SubmissionObjectDataService } from '../../../core/submission/submission-object-data.service';
import { SubmissionScopeType } from '../../../core/submission/submission-scope-type';
import {
  hasValue,
  isEmpty,
  isNotEmpty,
  isUndefined,
} from '../../../shared/empty.util';
import { FormBuilderService } from '../../../shared/form/builder/form-builder.service';
import { FormFieldPreviousValueObject } from '../../../shared/form/builder/models/form-field-previous-value-object';
import { FormComponent } from '../../../shared/form/form.component';
import { FormService } from '../../../shared/form/form.service';
import { ThemedLoadingComponent } from '../../../shared/loading/themed-loading.component';
import { NotificationsService } from '../../../shared/notifications/notifications.service';
import { difference } from '../../../shared/object.util';
import { followLink } from '../../../shared/utils/follow-link-config.model';
import { SubmissionSectionError } from '../../objects/submission-section-error.model';
import { SubmissionSectionObject } from '../../objects/submission-section-object.model';
import { SubmissionService } from '../../submission.service';
import { SectionModelComponent } from '../models/section.model';
import { SectionDataObject } from '../models/section-data.model';
import { SectionsService } from '../sections.service';
import { SectionFormOperationsService } from './section-form-operations.service';
import { JsonPatchOperationsBuilder } from '../../../core/json-patch/builder/json-patch-operations-builder';
// ── NEW IMPORTS ────────────────────────────────────────────────────────────────
import {
  SectionInstitutionComponent,
  SectionInstitutionValue,
} from '../../../shared/section-institution/section-institution.component';

/**
 * This component represents a section that contains a Form.
 */
@Component({
  selector: 'ds-submission-section-form',
  styleUrls: ['./section-form.component.scss'],
  templateUrl: './section-form.component.html',
  imports: [
    FormComponent,
    ThemedLoadingComponent,
    SectionInstitutionComponent,
  ],
  standalone: true,
})
export class SubmissionSectionFormComponent extends SectionModelComponent {

  public formId: string;
  public formModel: DynamicFormControlModel[];
  public isUpdating = false;
  public isLoading = true;

  // ── tracks the selected institution value ──────────────────────────────────
  public sectionInstitutionValue: SectionInstitutionValue | null = null;

  protected fieldsOnTheirWayToBeRemoved: Map<string, number[]> = new Map();
  protected formConfig: SubmissionFormsModel;
  protected formData: any = Object.create({});
  protected sectionMetadata: string[];
  protected pathCombiner: JsonPatchOperationPathCombiner;
  protected previousValue: FormFieldPreviousValueObject = new FormFieldPreviousValueObject();
  protected subs: Subscription[] = [];
  protected submissionObject: SubmissionObject;
  protected isSectionReadonly = false;

  /**
   * Fields that are ALWAYS hidden — populated by the institution selector,
   * never shown directly in the form UI.
   */
  private readonly ALWAYS_HIDDEN_FIELDS = [
    'dc_branch',
    'dc_district',
    'dc_institution',
  ];

  /**
   * Fields shown only when Case Status = "yes", hidden otherwise.
   */
  private readonly CASE_STATUS_CONTROLLED_FIELDS = [
    'dc_petitioner',
    'dc_respondent',
    'dc_case_nature',
    'dc_case_number',
    'dc_case_type',
    'dc_case_district',
    'dc_case_institution'
    ];

  @ViewChild('formRef') private formRef: FormComponent;

  constructor(
    protected cdr: ChangeDetectorRef,
    protected formBuilderService: FormBuilderService,
    protected formOperationsService: SectionFormOperationsService,
    protected formService: FormService,
    protected formConfigService: SubmissionFormsConfigDataService,
    protected notificationsService: NotificationsService,
    protected sectionService: SectionsService,
    protected submissionService: SubmissionService,
    protected translate: TranslateService,
    protected submissionObjectService: SubmissionObjectDataService,
    protected objectCache: ObjectCacheService,
    protected requestService: RequestService,
    protected operationsBuilder: JsonPatchOperationsBuilder,
    @Inject('collectionIdProvider') public injectedCollectionId: string,
    @Inject('sectionDataProvider') public injectedSectionData: SectionDataObject,
    @Inject('submissionIdProvider') public injectedSubmissionId: string,
  ) {
    super(injectedCollectionId, injectedSectionData, injectedSubmissionId);
  }

  onSectionInit() {
    this.pathCombiner = new JsonPatchOperationPathCombiner('sections', this.sectionData.id);
    this.formId = this.formService.getUniqueId(this.sectionData.id);
    this.sectionService.dispatchSetSectionFormId(this.submissionId, this.sectionData.id, this.formId);
    this.formConfigService.findByHref(this.sectionData.config).pipe(
      map((configData: RemoteData<ConfigObject>) => configData.payload),
      tap((config: SubmissionFormsModel) => this.formConfig = config),
      mergeMap(() =>
        observableCombineLatest([
          this.sectionService.getSectionData(this.submissionId, this.sectionData.id, this.sectionData.sectionType),
          this.submissionObjectService.findById(this.submissionId, true, false, followLink('item')).pipe(
            getFirstSucceededRemoteData(),
            getRemoteDataPayload()),
          this.sectionService.isSectionReadOnly(this.submissionId, this.sectionData.id, this.submissionService.getSubmissionScope()),
        ])),
      take(1))
      .subscribe(([sectionData, submissionObject, isSectionReadOnly]: [WorkspaceitemSectionFormObject, SubmissionObject, boolean]) => {
        if (isUndefined(this.formModel)) {
          this.submissionObject = submissionObject;
          this.isSectionReadonly = isSectionReadOnly;
          this.initForm(sectionData, this.sectionData.errorsToShow, this.sectionData.serverValidationErrors);
          this.sectionData.data = sectionData;
          this.subscriptions();
          this.isLoading = false;
          this.cdr.detectChanges();

          // Apply visibility rules after the form model is ready.
          // Always-hidden fields: never visible in the form UI.
          this.setFieldsVisibility(this.ALWAYS_HIDDEN_FIELDS, false);
          // Petitioner & Respondent: derive initial state from stored section data.
          this.reApplyCaseStatusVisibility(sectionData);
        }
      });
  }

  onSectionDestroy() {
    this.subs
      .filter((subscription) => hasValue(subscription))
      .forEach((subscription) => subscription.unsubscribe());
  }

  protected getSectionStatus(): Observable<boolean> {
    const formStatus$ = this.formService.isValid(this.formId);
    const serverValidationStatus$ = this.sectionService.getSectionServerErrors(this.submissionId, this.sectionData.id).pipe(
      map((validationErrors) => isEmpty(validationErrors)),
    );
    return observableCombineLatest([formStatus$, serverValidationStatus$]).pipe(
      map(([formValidation, serverSideValidation]: [boolean, boolean]) => formValidation && serverSideValidation),
    );
  }

  hasMetadataEnrichment(sectionData: WorkspaceitemSectionFormObject): boolean {
    const sectionDataToCheck = {};
    Object.keys(sectionData).forEach((key) => {
      if (this.inCurrentSubmissionScope(key)) {
        sectionDataToCheck[key] = sectionData[key];
      }
    });
    const diffResult = [];
    const diffObj = difference(sectionDataToCheck, this.formData);
    Object.keys(diffObj).forEach((key) => {
      diffObj[key].forEach((value) => {
        if (value.hasOwnProperty('value') && findIndex(this.formData[key], { value: value.value }) < 0) {
          diffResult.push(value);
        }
      });
    });
    return isNotEmpty(diffResult);
  }

  private inCurrentSubmissionScope(field: string): boolean {
    const scope = this.formConfig?.rows.find((row: FormRowModel) => {
      if (row.fields?.[0]?.selectableMetadata) {
        return row.fields?.[0]?.selectableMetadata?.[0]?.metadata === field;
      } else if (row.fields?.[0]?.selectableRelationship) {
        return row.fields?.[0]?.selectableRelationship.relationshipType === field.replace(/^relationship\./g, '');
      } else {
        return false;
      }
    })?.fields?.[0]?.scope;

    switch (scope) {
      case SubmissionScopeType.WorkspaceItem.valueOf():
        return (this.submissionObject as any).type === WorkspaceItem.type.value;
      case SubmissionScopeType.WorkflowItem.valueOf():
        return (this.submissionObject as any).type === WorkflowItem.type.value;
      default:
        return true;
    }
  }

  initForm(sectionData: WorkspaceitemSectionFormObject, errorsToShow: SubmissionSectionError[], serverValidationErrors: SubmissionSectionError[]): void {
    try {
      this.formModel = this.formBuilderService.modelFromConfiguration(
        this.submissionId,
        this.formConfig,
        this.collectionId,
        sectionData,
        this.submissionService.getSubmissionScope(),
        this.isSectionReadonly,
      );
      const sectionMetadata = this.sectionService.computeSectionConfiguredMetadata(this.formConfig);
      this.sectionService.updateSectionData(this.submissionId, this.sectionData.id, sectionData, errorsToShow, serverValidationErrors, sectionMetadata);
    } catch (e: unknown) {
      const msg: string = this.translate.instant('error.submission.sections.init-form-error') + (e as Error).toString();
      const sectionError: SubmissionSectionError = {
        message: msg,
        path: '/sections/' + this.sectionData.id,
      };
      if (e instanceof Error) {
        console.error(e.stack);
      }
      this.sectionService.setSectionError(this.submissionId, this.sectionData.id, sectionError);
    }
  }

  updateForm(sectionState: SubmissionSectionObject): void {
    const sectionData = sectionState.data as WorkspaceitemSectionFormObject;
    const errors = sectionState.errorsToShow;

    if (isNotEmpty(sectionData) && !isEqual(sectionData, this.sectionData.data)) {
      this.sectionData.data = sectionData;
      if (this.hasMetadataEnrichment(sectionData)) {
        this.isUpdating = true;
        this.formModel = null;
        this.cdr.detectChanges();
        this.initForm(sectionData, errors, sectionState.serverValidationErrors);
        this.checksForErrors(errors);
        this.isUpdating = false;
        this.cdr.detectChanges();
        // Re-apply visibility after every form rebuild
        this.setFieldsVisibility(this.ALWAYS_HIDDEN_FIELDS, false);
        this.reApplyCaseStatusVisibility(sectionData);
      } else if (isNotEmpty(errors) || isNotEmpty(this.sectionData.errorsToShow)) {
        this.checksForErrors(errors);
      }
    } else if (isNotEmpty(errors) || isNotEmpty(this.sectionData.errorsToShow)) {
      this.checksForErrors(errors);
    }
  }

  checksForErrors(errors: SubmissionSectionError[]): void {
    this.formService.isFormInitialized(this.formId).pipe(
      find((status: boolean) => status === true && !this.isUpdating))
      .subscribe(() => {
        this.sectionService.checkSectionErrors(this.submissionId, this.sectionData.id, this.formId, errors, this.sectionData.errorsToShow);
        this.sectionData.errorsToShow = errors;
        this.cdr.detectChanges();
      });
  }

  subscriptions(): void {
    this.subs.push(
      this.formService.getFormData(this.formId).pipe(
        distinctUntilChanged())
        .subscribe((formData) => {
          this.formData = formData;
        }),

      this.sectionService.getSectionState(this.submissionId, this.sectionData.id, this.sectionData.sectionType).pipe(
        filter((sectionState: SubmissionSectionObject) => {
          return isNotEmpty(sectionState) && (isNotEmpty(sectionState.data) || isNotEmpty(sectionState.errorsToShow));
        }),
        distinctUntilChanged())
        .subscribe((sectionState: SubmissionSectionObject) => {
          this.fieldsOnTheirWayToBeRemoved = new Map();
          this.sectionMetadata = sectionState.metadata;
          this.updateForm(sectionState);
        }),
    );
  }

  onSectionInstitutionChange(value: SectionInstitutionValue): void {
    this.sectionInstitutionValue = value;
    if (!value) return;

    const mapping: { field: string; val: string | undefined }[] = [
      { field: 'dc.branch', val: value.branchLabel },
      { field: 'dc.district', val: value.district },
      { field: 'dc.institution', val: value.institutionLabel },
    ];

    mapping
      .filter(m => m.val !== undefined && m.val !== null && m.val !== '')
      .forEach(m => {
        const path = this.pathCombiner.getPath(m.field);
        this.operationsBuilder.add(
          path,
          [
            {
              value: m.val,
              language: null,
              authority: null,
              confidence: -1,
              place: 0,
            }
          ],
          true
        );
      });

    this.submissionService.dispatchSave(this.submissionId);
  }

  onChange(event: DynamicFormControlEvent): void {
    const metadata = this.formOperationsService.getFieldPathSegmentedFromChangeEvent(event);
    const value = this.formOperationsService.getFieldValueFromChangeEvent(event);

    console.log(metadata, value);

    if (metadata === 'dc.case.status') {
      this.handleCaseStateToggle(value);
    }

    this.formOperationsService.dispatchOperationsFromEvent(
      this.pathCombiner,
      event,
      this.previousValue,
      this.hasStoredValue(
        this.formBuilderService.getId(event.model),
        this.formOperationsService.getArrayIndexFromEvent(event)
      )
    );

    this.submissionService.dispatchSave(this.submissionId);
  }

  handleCaseStateToggle(value: any): void {
    const actualValue = value?.value || value;
    const show = (typeof actualValue === 'string')
      ? actualValue.trim().toLowerCase() === 'yes'
      : false;

    console.log('Case status toggle → show petitioner/respondent:', show);
    this.setFieldsVisibility(this.CASE_STATUS_CONTROLLED_FIELDS, show);
  }

  /**
   * Re-derive the Case Status from already-stored section data and apply
   * petitioner/respondent visibility accordingly.
   * Called on initial load and after every form rebuild.
   */
  private reApplyCaseStatusVisibility(sectionData: WorkspaceitemSectionFormObject): void {
    const statusValues: any[] = (sectionData as any)['dc.case.status'];
    const currentStatus = Array.isArray(statusValues) && statusValues.length > 0
      ? statusValues[0]?.value
      : null;
    const show = typeof currentStatus === 'string'
      && currentStatus.trim().toLowerCase() === 'yes';
    this.setFieldsVisibility(this.CASE_STATUS_CONTROLLED_FIELDS, show);
  }

  /**
   * Core visibility engine — TWO-PRONGED approach.
   *
   * ① field.hidden = !visible
   *    Keeps ng-dynamic-forms semantics correct: hidden fields are excluded
   *    from validation and JSON-patch submission payloads.
   *
   * ② field.layout.element.host — Bootstrap `d-none`
   *    DSpace's form template reads this string to compose the host element's
   *    CSS classes on every render. Replacing the formModel array reference
   *    (`[...this.formModel]`) forces OnPush re-render on FormComponent so it
   *    picks up the updated class string and hides/shows the field via CSS.
   *
   * Both prongs together are needed because OnPush only re-checks @Input
   * bindings; mutating a plain boolean property on a nested object reference
   * alone is not enough to trigger a re-render.
   */
  private setFieldsVisibility(fieldIds: string[], visible: boolean): void {
    if (!this.formModel) return;

    const applyToField = (field: any) => {
      // ── ① Semantic hidden flag ────────────────────────────────────────────
      field.hidden = !visible;

      // ── ② CSS class on the host element ──────────────────────────────────
      if (!field.layout) {
        field.layout = { element: {}, grid: {} };
      }
      if (!field.layout.element) {
        field.layout.element = {};
      }

      // Remove any prior d-none we set, then re-add if we are hiding.
      const existing: string = field.layout.element.host || '';
      const cleaned = existing.replace(/\bd-none\b/g, '').replace(/\s{2,}/g, ' ').trim();
      field.layout.element.host = visible
        ? cleaned
        : (cleaned ? `${cleaned} d-none` : 'd-none');

      // Clear the value when hiding so stale data is not submitted.
      if (!visible) {
        field.value = null;
      }
    };

    const traverse = (fields: any[]) => {
      if (!Array.isArray(fields)) return;

      fields.forEach(field => {

        // ✅ HANDLE ARRAY (THIS IS YOUR MISSING PIECE)
        if (field.type === 'ARRAY') {

          const hasTargetField = field.groups?.some((group: any) =>
            group.group?.some((child: any) => {
              const key = child.metadata || child.id || child.name;
              return fieldIds.includes(key);
            })
          );

          if (hasTargetField) {
            console.log('🔥 HIDING ARRAY:', field.id);

            applyToField(field); // 👈 THIS hides label + add more
          }
        }

        // ✅ HANDLE GROUP
        if (field.type === 'GROUP' && Array.isArray(field.group)) {

          const hasTargetField = field.group.some((child: any) => {
            const key = child.metadata || child.id || child.name;
            return fieldIds.includes(key);
          });

          if (hasTargetField) {
            applyToField(field);
          }
        }

        // recursion
        if (Array.isArray(field.group)) {
          traverse(field.group);
        }

        if (Array.isArray(field.groups)) {
          field.groups.forEach((g: any) => {
            if (Array.isArray(g.group)) {
              traverse(g.group);
            }
          });
        }

      });
    };

    traverse(this.formModel);

    // ── Replace the array reference to trigger OnPush re-render ──────────────
    this.formModel = [...this.formModel];
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  private hasRelatedCustomError(medatata): boolean {
    const index = findIndex(this.sectionData.errorsToShow, { path: this.pathCombiner.getPath(medatata).path });
    if (index !== -1) {
      const error = this.sectionData.errorsToShow[index];
      const validator = error.message.replace('error.validation.', '');
      return !environment.form.validatorMap.hasOwnProperty(validator);
    } else {
      return false;
    }
  }

  onFocus(event: DynamicFormControlEvent): void {
    const value = this.formOperationsService.getFieldValueFromChangeEvent(event);
    const path = this.formBuilderService.getPath(event.model);
    if (this.formBuilderService.hasMappedGroupValue(event.model)) {
      this.previousValue.path = path;
      this.previousValue.value = this.formOperationsService.getQualdropValueMap(event);
    } else if (isNotEmpty(value) && ((typeof value === 'object' && isNotEmpty(value.value)) || (typeof value === 'string'))) {
      this.previousValue.path = path;
      this.previousValue.value = value;
    }
  }

  onRemove(event: DynamicFormControlEvent): void {
    const fieldId = this.formBuilderService.getId(event.model);
    const fieldIndex = this.formOperationsService.getArrayIndexFromEvent(event);

    if (this.fieldsOnTheirWayToBeRemoved.has(fieldId)) {
      const indexes = this.fieldsOnTheirWayToBeRemoved.get(fieldId);
      indexes.push(fieldIndex);
      this.fieldsOnTheirWayToBeRemoved.set(fieldId, indexes);
    } else {
      this.fieldsOnTheirWayToBeRemoved.set(fieldId, [fieldIndex]);
    }

    this.formOperationsService.dispatchOperationsFromEvent(
      this.pathCombiner,
      event,
      this.previousValue,
      this.hasStoredValue(fieldId, fieldIndex));
  }

  hasStoredValue(fieldId, index): boolean {
    if (isNotEmpty(this.sectionData.data)) {
      return this.sectionData.data.hasOwnProperty(fieldId) &&
        isNotEmpty(this.sectionData.data[fieldId][index]) &&
        !this.isFieldToRemove(fieldId, index);
    } else {
      return false;
    }
  }

  isFieldToRemove(fieldId, index) {
    return this.fieldsOnTheirWayToBeRemoved.has(fieldId) && this.fieldsOnTheirWayToBeRemoved.get(fieldId).includes(index);
  }

  onCustomEvent(event: DynamicFormControlEvent) {
    this.formOperationsService.dispatchOperationsFromEvent(
      this.pathCombiner,
      event,
      this.previousValue,
      null);
  }
}