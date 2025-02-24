import { Injectable } from '@angular/core';
import { getDocument,GlobalWorkerOptions } from 'pdfjs-dist';

@Injectable({
  providedIn: 'root'
})
export class PdfReaderService {

  constructor() {
      // Corregir la ruta del worker de PDF.js
      GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;
   }

   async extractText(pdfBytes: Uint8Array): Promise<any[]> {
    if (!pdfBytes || pdfBytes.length < 4) {
      throw new Error("El archivo PDF está vacío o es inválido.");
    }

    const header = new TextDecoder().decode(pdfBytes.slice(0, 4));
    if (!header.includes("%PDF")) {
      throw new Error("No es un archivo PDF válido.");
    }

    try {
         // Clonar antes de pasarlo a getDocument
        const clonedBuffer = pdfBytes.slice(0);

        const loadingTask = getDocument({ data: clonedBuffer });
        const pdfDocument = await loadingTask.promise;
        let textItems: any[] = [];

        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();

          textContent.items.forEach((item: any) => {
            textItems.push({
              text: item.str,
              transform: item.transform,
              page: pageNum
            });
          });
      }

      return textItems;
    } catch (error) {
      console.error("Error al analizar el PDF:", error);
      throw new Error("No se pudo procesar el PDF.");
    }
  }
}
