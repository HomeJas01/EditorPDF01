import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule, NgModel } from '@angular/forms';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { PdfEditorComponent } from './pdf-editor/pdf-editor.component';
import { PdfReaderService } from './pdf-reader.service';

@NgModule({
  declarations: [
    AppComponent,
    PdfEditorComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    PdfViewerModule
  ],
  providers: [PdfReaderService],
  bootstrap: [AppComponent]
})
export class AppModule { }
