const crypto = require('node:crypto');
function keyBytes() {
  const raw = process.env.RTMP_SECRET_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new Error('Configure RTMP_SECRET_ENCRYPTION_KEY com 64 caracteres hexadecimais (32 bytes) para persistir chaves e recuperar transmissões.');
  return Buffer.from(raw, 'hex');
}
function encrypt(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`;
}
function decrypt(value) {
  if (!value) return null;
  const [ivHex, tagHex, dataHex] = value.split('.');
  if (!ivHex || !tagHex || dataHex === undefined) throw new Error('Segredo criptografado está em formato inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
module.exports = { encrypt, decrypt };
