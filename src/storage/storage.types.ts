export type UploadObjectInput = {
  body: Buffer;
  contentType: string;
  objectKey: string;
};

export interface ObjectStorageClient {
  uploadObject(input: UploadObjectInput): Promise<void>;
}
