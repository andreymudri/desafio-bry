import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { MulterError } from 'multer';

// Multer configuration used for the signature endpoint file uploads
const signatureMulterOptions: MulterOptions = {
  limits: {
    // 10 MB for main file; total files limited to 2; reasonable caps for fields/parts
    fileSize: 10 * 1024 * 1024,
    files: 2,
    fields: 10,
    parts: 12,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'pfx') {
      // Allow .pfx and .p12 for PKCS#12
      const ok = /\.(pfx|p12)$/i.test(file.originalname);
      return ok
        ? cb(null, true)
        : cb(
            new MulterError('LIMIT_UNEXPECTED_FILE', 'pfx') as unknown as Error,
            false,
          );
    }
    // Allow common document types for the main file
    const ok = /\.(txt|pdf|docx?|odt|rtf|bin|dat|p7s)$/i.test(
      file.originalname,
    );
    return ok
      ? cb(null, true)
      : cb(
          new MulterError('LIMIT_UNEXPECTED_FILE', 'file') as unknown as Error,
          false,
        );
  },
};

// Factory to provide the interceptor type expected by @UseInterceptors
export const signatureFilesInterceptor = () =>
  FileFieldsInterceptor(
    [
      { name: 'file', maxCount: 1 },
      { name: 'pfx', maxCount: 1 },
    ],
    signatureMulterOptions,
  );
