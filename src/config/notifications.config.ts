import { registerAs } from '@nestjs/config';

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n');
}

export const notificationsConfig = registerAs('notifications', () => {
  const projectId = process.env['FCM_PROJECT_ID'] ?? '';
  const clientEmail = process.env['FCM_CLIENT_EMAIL'] ?? '';
  const privateKey = process.env['FCM_PRIVATE_KEY'] ?? '';

  return {
    fcm: {
      enabled: Boolean(projectId && clientEmail && privateKey),
      projectId,
      clientEmail,
      privateKey: privateKey ? normalizePrivateKey(privateKey) : '',
    },
  };
});
