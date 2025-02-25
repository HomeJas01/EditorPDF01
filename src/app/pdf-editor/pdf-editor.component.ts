import { Component } from '@angular/core';
import {PDFDocument, rgb, StandardFonts} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/build/pdf.worker';
import {PdfReaderService} from '../pdf-reader.service';
import {DomSanitizer,SafeResourceUrl} from '@angular/platform-browser';
import { retry } from 'rxjs';

@Component({
  selector: 'app-pdf-editor',
  standalone: false,
  templateUrl: './pdf-editor.component.html',
  styleUrl: './pdf-editor.component.css'
})
export class PdfEditorComponent {

  pdfData: any[] = [];
  editedText: { [key: string]: string } = {};
  originalPdfUrl: SafeResourceUrl = '';
  modifiedPdfUrl: SafeResourceUrl = '';
  pdfBytes!: Uint8Array;

  constructor(private pdfReaderService: PdfReaderService, private sanitizer: DomSanitizer) {}

  detectChange(position: number){
    const whitePositions = [4, 35, 39, 43, 44, 48];  // Blanco
    const yellowBoldPositions = [101, 102, 103, 104, 105, 110, 116]; // Amarillo con negritas
    const blueBoldPositions = [113]; // Azul con negritas

    if(whitePositions.includes(position)){
      return {color: 'white',bold:false};
    }
    if (yellowBoldPositions.includes(position)) {
      return { color: 'yellow', bold: true };
    }
    if (blueBoldPositions.includes(position)) {
      return { color: 'blue', bold: true };
    }
    return { color: 'blue', bold: false }; // Azul para cualquier otro campo



  }

  onFileChange(event: any): void {
    const file = event.target.files[0];

    if (!file) {
      console.error("No se seleccionó ningún archivo.");
      return;
    }

    //Verificar que el archivo es un PDF
    if(file.type !== 'application/pdf'){
      console.error("El archivo seleccionado no es un PDF");
      return;
    }

    const reader = new FileReader();

    reader.onload = async() =>{
      try{
        const arrayBuffer = reader.result as ArrayBuffer;

          if (!arrayBuffer) {
            throw new Error("El archivo no se cargó correctamente.");
          }

          // Verificar si el archivo contiene la cabecera "%PDF"
          const uint8Array = new Uint8Array(arrayBuffer);
          const header = new TextDecoder().decode(uint8Array.slice(0, 4));
          if (!header.includes("%PDF")) {
            throw new Error("El archivo seleccionado no es un PDF válido.");
          }

          // Clonar el ArrayBuffer antes de pasarlo a PDF.js
          const clonedBuffer = arrayBuffer.slice(0);
          this.pdfBytes = new Uint8Array(clonedBuffer);

          // Crear una URL segura para la vista previa
          const url = URL.createObjectURL(new Blob([this.pdfBytes], { type: 'application/pdf' }));
          this.originalPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

          // Extraer textos con posiciones
          this.pdfData = await this.pdfReaderService.extractText(new Uint8Array(clonedBuffer));

          // Inicializar los textos editables
          this.editedText = {};
          this.pdfData.forEach((item, index) => {
            this.editedText[index] = item.text;
          });

      }catch (error){
        console.error("Error al procesar el PDF:", error);
      }
    };

    reader.onerror = () => {
      console.error("Error al leer el archivo.");
    };

    reader.readAsArrayBuffer(file);
  }

  async modifyPdf(): Promise<void> {
    const pdfDoc = await PDFDocument.load(this.pdfBytes);
    const page = pdfDoc.getPages()[0]; // Primera página
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);


    //Definir posiciones con condiciones especiales
    const wideLongPositions = [8, 9, 10, 14, 15, 16, 17]; // Mayor ancho
    const wideSmallPositions =  [101, 102, 103, 104, 105, 110, 116]; // Reducir ancho y mover a la izquierda

    for (let i = 0; i < this.pdfData.length; i++) {
      const item = this.pdfData[i];
      const newText = this.editedText[i];
      const position = i; // Guardamos la posición del elemento en una variable

      // Determinar color y estilo según la posición
      const { color, bold } = this.detectChange(position);
      let backgroundColor;

      if (color === 'white') {
        backgroundColor = rgb(1, 1, 1); // Blanco
      } else if (color === 'yellow') {
        backgroundColor = rgb(252 / 255, 254 / 255, 230/ 255); // Amarillo
      } else {
        backgroundColor = rgb(230 / 255, 239 / 255, 254 / 255); // Azul
      }

       // Ajustar ancho según la posición
       let rectWidth = item.width; // Valor por defecto
       if (wideLongPositions.includes(position)) {
         rectWidth = newText.length * 4; // Aumentar ancho
       } else if (wideSmallPositions.includes(position)) {
         rectWidth = newText.length * 2; // Reducir ancho
       }


      if (newText !== item.text) {
        const page = pdfDoc.getPages()[item.page - 1];

        // Obtener coordenadas
        const [x, y] = item.transform.slice(4, 6);
        const fontSize = 7;

      // Ajustar posición si está dentro de wideSmallPositions
        // let adjustedX = item.x;
        // if (wideSmallPositions.includes(position)) {
        //   adjustedX -= 5; // Mover 5 unidades a la izquierda
        // }


        // Dibujar un rectángulo blanco para "borrar" el texto original
        page.drawRectangle({
          x: x-1, ///adjustedX,   //x - 1,
          y: y - fontSize / 3,
          width: rectWidth, //newText.length * 6,
          height: fontSize + 3,
          color: backgroundColor,
          //color: rgb(230 / 255, 239 / 255, 254 / 255), //RGB(230, 239, 254)  //Azul
          //color: rgb(252 / 255, 254 / 255, 230 / 255),  //RGB(252, 254, 230)  //Amarillo
          //color: rgb(1, 1, 1),  //Blanco

        });

        // Escribir el nuevo texto
        page.drawText(newText, {
          x,
          y,
          size: fontSize,
          font: bold ? fontBold : fontRegular, // Negritas si es necesario
          color: rgb(0, 0, 0)
        });
        console.log(`Texto modificado en posición: ${position}, Nuevo texto: "${newText}", Ancho: ${rectWidth}`);
      }
    }

    // Guardar el PDF modificado
    const modifiedBytes = await pdfDoc.save();
    const blob = new Blob([modifiedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    this.modifiedPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  downloadPdf(): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([this.pdfBytes], { type: 'application/pdf' }));
    link.download = 'recibo_modificado.pdf';
    link.click();
  }

  // pdfSrc: any;
  // file: File | null = null;
  // modifiedPdfBytes: Uint8Array | null = null;
  // extractedText: { original: string, modified: string, x: number, y: number, size: number, width: number, height: number }[] = [];
  // zoomLevel: number = 100;
  // zoomFactor: number = 1;



  // async onFileSelected(event: any) {
  //   this.file = event.target.files[0];
  //   if (this.file) {
  //     const reader = new FileReader();
  //     reader.onload = async (e: any) => {
  //       const arrayBuffer = e.target.result;
  //       this.pdfSrc = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/pdf' }));

  //       await this.extractText(arrayBuffer);
  //     };
  //     reader.readAsArrayBuffer(this.file);
  //   }
  // }

  // async extractText(arrayBuffer: ArrayBuffer) {
  //   const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  //   const page = await pdf.getPage(1);
  //   const textContent = await page.getTextContent();

  //   this.extractedText = textContent.items.map((item: any) => ({
  //     label: item.str,
  //     original: item.str,
  //     modified: item.str,
  //     x: item.transform[4], // Posición X
  //     y: item.transform[5], // Posición Y
  //     size: 10,
  //     width: item.width || 50, // Ancho del texto (para alineación)
  //     height: item.height || 20
  //   }));
  // }

  // updateZoom() {
  //   this.zoomFactor = this.zoomLevel / 100;
  // }

  // async editPdf() {
  //   if (!this.file) return;

  //   const reader = new FileReader();
  //   reader.onload = async (e: any) => {
  //     const arrayBuffer = e.target.result;
  //     const pdfDoc = await PDFDocument.load(arrayBuffer);
  //     const pages = pdfDoc.getPages();
  //     const firstPage = pages[0];

  //     const font = await pdfDoc.embedFont('Helvetica');

  //     this.extractedText.forEach((item) => {
  //       if (item.original !== item.modified) {

  //           //  Paso 1: Ocultar el texto original con un fondo blanco
  //           firstPage.drawRectangle({
  //           x: item.x,
  //           y: item.y - item.size,
  //           width: item.width,
  //           height: item.height,
  //           color: rgb(1, 1, 1) // Blanco
  //         });

  //         // Paso 2: Escribir el texto modificado en la misma posición
  //         firstPage.drawText(item.modified, {
  //           x: item.x,
  //           y: item.y,
  //           size: item.size,
  //           font,
  //           color: rgb(0, 0, 0) // Texto en negro
  //         });
  //       }
  //     });

  //     this.modifiedPdfBytes = await pdfDoc.save();
  //     this.pdfSrc = URL.createObjectURL(new Blob([this.modifiedPdfBytes], { type: 'application/pdf' }));
  //   };
  //   reader.readAsArrayBuffer(this.file);
  // }

  // savePdf() {
  //   if (!this.modifiedPdfBytes) return;
  //   const blob = new Blob([this.modifiedPdfBytes], { type: 'application/pdf' });
  //   const link = document.createElement('a');
  //   link.href = URL.createObjectURL(blob);
  //   link.download = 'edited-receipt.pdf';
  //   link.click();
  // }




///*************************//

  // async savePdf(): Promise<void> {
  //   const pdfDoc = await PDFDocument.create();
  //   const page = pdfDoc.addPage([600, 800]); // Tamaño de página arbitrario

  //   // Escribir el texto editado en el nuevo PDF manteniendo las posiciones originales
  //   this.pdfData.forEach((item, index) => {
  //     const editedText = this.editedText[index];
  //     const [x, y] = item.transform.slice(4, 6); // Obtener las coordenadas x y y

  //     page.drawText(editedText, {
  //       x,
  //       y,
  //       size: 12, // Puedes cambiar el tamaño de la fuente según sea necesario
  //       //const font = await pdfDoc.embedFont('Helvetica');
  //       //font: pdfDoc.embedFont(StandardFonts.Helvetica), // Se puede cambiar la fuente
  //     });
  //   });

  //   // Guardar el PDF modificado y descargarlo
  //   const pdfBytes = await pdfDoc.save();
  //   const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  //   const link = document.createElement('a');
  //   link.href = URL.createObjectURL(blob);
  //   link.download = 'pdf_modificado.pdf';
  //   link.click();
  // }








  // pdfSrc: any; // Fuente del PDF
  // file: File | null = null;
  // modifiedPdfBytes: Uint8Array | null = null;
  // extractedText: { original: string, modified: string, x: number, y: number, width: number }[] = [];

  // async onFileSelected(event: any) {
  //   this.file = event.target.files[0];
  //   if (this.file) {
  //     const reader = new FileReader();
  //     reader.onload = async (e: any) => {
  //       const arrayBuffer = e.target.result;
  //       this.pdfSrc = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/pdf' }));

  //       await this.extractText(arrayBuffer);
  //     };
  //     reader.readAsArrayBuffer(this.file);
  //   }
  // }


  // async extractText(arrayBuffer: ArrayBuffer) {
  //   const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  //   const page = await pdf.getPage(1);
  //   const textContent = await page.getTextContent();

  //   this.extractedText = textContent.items.map((item: any) => ({
  //     original: item.str,
  //     modified: item.str,
  //     x: item.transform[4], // Posición X
  //     y: item.transform[5], // Posición Y
  //     width: item.width || 50 // Ancho del texto (para alineación)
  //   }));
  // }

  // updateText(index: number, event: any) {
  //   this.extractedText[index].modified = event.target.innerText;
  // }

  // async editPdf() {
  //   if (!this.file) return;

  //   const reader = new FileReader();
  //   reader.onload = async (e: any) => {
  //     const arrayBuffer = e.target.result;
  //     const pdfDoc = await PDFDocument.load(arrayBuffer);
  //     const pages = pdfDoc.getPages();
  //     const firstPage = pages[0];

  //     const font = await pdfDoc.embedFont('Helvetica');

  //     this.extractedText.forEach((item) => {
  //       if (item.original !== item.modified) {
  //         firstPage.drawText(item.modified, {
  //           x: item.x,
  //           y: item.y,
  //           size: 10,
  //           font,
  //           color: rgb(0, 0, 0),
  //           maxWidth: item.width // Para asegurarse de que el texto no se salga del margen
  //         });
  //       }
  //     });

  //     this.modifiedPdfBytes = await pdfDoc.save();
  //     this.pdfSrc = URL.createObjectURL(new Blob([this.modifiedPdfBytes], { type: 'application/pdf' }));
  //   };
  //   reader.readAsArrayBuffer(this.file);
  // }

  // savePdf() {
  //   if (!this.modifiedPdfBytes) return;
  //   const blob = new Blob([this.modifiedPdfBytes], { type: 'application/pdf' });
  //   const link = document.createElement('a');
  //   link.href = URL.createObjectURL(blob);
  //   link.download = 'edited-receipt.pdf';
  //   link.click();
  // }



}
