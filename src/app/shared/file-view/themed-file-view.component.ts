import { Component, Input } from '@angular/core';
import { Bitstream } from '../../core/shared/bitstream.model';
import { Item } from '../../core/shared/item.model';
import { ThemedComponent } from '../theme-support/themed.component';
import { FileViewComponent } from './file-view.component';

@Component({
  selector: 'ds-file-view-themed',
  styleUrls: [],
  templateUrl: '../theme-support/themed.component.html',
  standalone: true,
  imports: [FileViewComponent],
})
export class ThemedFileViewComponent extends ThemedComponent<FileViewComponent> {
  @Input() bitstream: Bitstream;
  @Input() item: Item;

  protected inAndOutputNames: (keyof FileViewComponent & keyof this)[] = [
    'bitstream',
    'item'
  ];

  protected getComponentName(): string {
    return 'FileViewComponent';
  }

  protected importThemedComponent(themeName: string): Promise<any> {
    return import(`../../../themes/${themeName}/app/shared/file-view/file-view.component`);
  }

  protected importUnthemedComponent(): Promise<any> {
    return import('./file-view.component');
  }
}
