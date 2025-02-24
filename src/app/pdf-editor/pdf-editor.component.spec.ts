import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfEditorComponent } from './pdf-editor.component';

describe('PdfEditorComponent', () => {
  let component: PdfEditorComponent;
  let fixture: ComponentFixture<PdfEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PdfEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PdfEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
