import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileViewComponent } from './file-view.component';
import { Bitstream } from '../../core/shared/bitstream.model';
import { Item } from '../../core/shared/item.model';
import { TranslateModule } from '@ngx-translate/core';

describe('FileViewComponent', () => {
  let component: FileViewComponent;
  let fixture: ComponentFixture<FileViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileViewComponent, TranslateModule.forRoot()]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FileViewComponent);
    component = fixture.componentInstance;
    component.bitstream = {
        uuid: '123',
        _links: {
            self: { href: '/bitstreams/123' },
            content: { href: '/bitstreams/123/content' }
        },
        format: { mimetype: 'application/pdf' }
    } as unknown as Bitstream;
    component.item = { uuid: 'item-1' } as Item;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should detect PDF files', () => {
    expect(component.isPdf).toBeTrue();
  });
});
