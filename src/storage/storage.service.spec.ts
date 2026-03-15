/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { StorageService } from './storage.service';

describe('StorageService', () => {
  it('uploads files through the configured object storage client and stores metadata', async () => {
    const uploadObject = jest.fn().mockResolvedValue(undefined);
    const fileObjectCreate = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'file-1',
        ...data,
      }),
    );

    const service = new StorageService(
      {
        fileObject: {
          create: fileObjectCreate,
        },
      } as any,
      {
        bucket: 'reziphay-files',
        driver: 'local',
        publicUrl: '',
        endpoint: '',
        region: '',
        forcePathStyle: false,
      } as any,
      {
        appBaseUrl: 'http://localhost:3000',
      } as any,
      {
        uploadObject,
      },
    );

    const result = await service.uploadFile(
      {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 128,
        buffer: Buffer.from('binary-photo'),
      } as Express.Multer.File,
      'user-1',
      'service-photos',
    );

    expect(uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({
        body: Buffer.from('binary-photo'),
        contentType: 'image/jpeg',
      }),
    );
    const [uploadInvocation] = uploadObject.mock.calls as [
      [{ objectKey: string }],
    ];
    expect(uploadInvocation[0].objectKey).toMatch(/^service-photos\/.+\.jpg$/);
    expect(fileObjectCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bucket: 'reziphay-files',
        originalFilename: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 128,
        uploadedByUserId: 'user-1',
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'file-1',
        bucket: 'reziphay-files',
      }),
    );
  });
});
