// Cifrado de extremo a extremo con Web Crypto (lo trae el navegador, no hay librerías de por medio).
//
// - Cada persona tiene un llavero: una llave AES-256 para sus datos, una llave HMAC para nombrar los
//   registros sin revelar la fecha y un par ECDH P-256 para recibir lo que la pareja le comparta.
// - En la nube, el llavero se guarda cifrado con una llave que sale de su clave del ciclo (PBKDF2,
//   600.000 vueltas) y, aparte, con un código de recuperación. El servidor nunca ve la clave.
// - Lo que se comparte va cifrado para la llave pública de la pareja con una llave efímera (ECIES):
//   solo su celular lo puede abrir.
// - En el celular las llaves quedan como CryptoKey no exportables: ni un script puede sacarlas en claro.

export type Sobre = { iv: string; ct: string };
export type SobreLlavero = Sobre & { sal: string; vueltas: number };
export type SobreCompartido = Sobre & { v: 1; epk: JsonWebKey; sal: string };

export type Llaves = { datos: CryptoKey; hmac: CryptoKey; privada: CryptoKey; publica: JsonWebKey };
type LlaveroClaro = { datos: string; hmac: string; privada: JsonWebKey; publica: JsonWebKey };

const sutil = () => globalThis.crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();

export const aB64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const azar = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export const VUELTAS_CLAVE = 600_000;
const VUELTAS_CODIGO = 100_000; // el código ya es largo y al azar

async function llaveDeClave(clave: string, sal: Uint8Array, vueltas: number) {
  const base = await sutil().importKey('raw', te.encode(clave.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return sutil().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: vueltas }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function cifrarCon(llave: CryptoKey, claro: Uint8Array, aad?: string): Promise<Sobre> {
  const iv = azar(12);
  const ct = await sutil().encrypt({ name: 'AES-GCM', iv: iv as BufferSource, ...(aad ? { additionalData: te.encode(aad) } : {}) }, llave, claro as BufferSource);
  return { iv: aB64(iv), ct: aB64(ct) };
}

async function descifrarCon(llave: CryptoKey, s: Sobre, aad?: string) {
  return new Uint8Array(await sutil().decrypt({ name: 'AES-GCM', iv: deB64(s.iv) as BufferSource, ...(aad ? { additionalData: te.encode(aad) } : {}) }, llave, deB64(s.ct) as BufferSource));
}

// Llaves nuevas. Devuelve las usables y la versión en claro para envolverla (se descarta enseguida)
export async function crearLlaves(): Promise<{ llaves: Llaves; claro: LlaveroClaro }> {
  const datos = azar(32);
  const hmac = azar(32);
  const par = await sutil().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const privada = await sutil().exportKey('jwk', par.privateKey);
  const publica = await sutil().exportKey('jwk', par.publicKey);
  const claro = { datos: aB64(datos), hmac: aB64(hmac), privada, publica };
  return { llaves: await importarLlavero(claro), claro };
}

async function importarLlavero(c: LlaveroClaro): Promise<Llaves> {
  const [datos, hmac, privada] = await Promise.all([
    sutil().importKey('raw', deB64(c.datos) as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
    sutil().importKey('raw', deB64(c.hmac) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    sutil().importKey('jwk', c.privada, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
  ]);
  return { datos, hmac, privada, publica: publicaLimpia(c.publica) };
}

const publicaLimpia = (j: JsonWebKey): JsonWebKey => ({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });

export async function envolverLlavero(claro: LlaveroClaro, clave: string, vueltas = VUELTAS_CLAVE): Promise<SobreLlavero> {
  const sal = azar(16);
  const llave = await llaveDeClave(clave, sal, vueltas);
  return { ...(await cifrarCon(llave, te.encode(JSON.stringify(claro)), 'llavero')), sal: aB64(sal), vueltas };
}

async function abrirClaro(s: SobreLlavero, clave: string): Promise<LlaveroClaro> {
  const llave = await llaveDeClave(clave, deB64(s.sal), s.vueltas);
  return JSON.parse(td.decode(await descifrarCon(llave, s, 'llavero')));
}

// Con la clave equivocada, Web Crypto falla al verificar: se devuelve null
export async function abrirLlavero(s: SobreLlavero, clave: string): Promise<Llaves | null> {
  try { return await importarLlavero(await abrirClaro(s, clave)); } catch { return null; }
}

// Para cambiar la clave o crear un código nuevo hace falta el llavero en claro un momento
export async function reenvolver(s: SobreLlavero, clave: string, nueva: string, vueltas = VUELTAS_CLAVE): Promise<SobreLlavero | null> {
  try { return await envolverLlavero(await abrirClaro(s, clave), nueva, vueltas); } catch { return null; }
}

// Código de recuperación: 20 letras y números sin los que se confunden (≈100 bits), en grupos de 4
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoRecuperacion() {
  const b = azar(20);
  const s = Array.from(b, (x) => ALFABETO[x % 32]).join('');
  return s.match(/.{4}/g)!.join('-');
}
export const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const envolverConCodigo = (claro: LlaveroClaro, codigo: string) => envolverLlavero(claro, normalizarCodigo(codigo), VUELTAS_CODIGO);
export const abrirConCodigo = (s: SobreLlavero, codigo: string) => abrirLlavero(s, normalizarCodigo(codigo));
export const reenvolverConCodigo = (s: SobreLlavero, codigo: string, clave: string) => (async () => {
  try { return await envolverLlavero(await abrirClaro(s, normalizarCodigo(codigo)), clave); } catch { return null; }
})();

// Registros propios. El AAD ata cada sobre a su dueño y a su nombre: no se puede mover a otra fila
export const cifrar = (l: Llaves, valor: unknown, aad: string) => cifrarCon(l.datos, te.encode(JSON.stringify(valor)), aad);
export async function descifrar<T>(l: Llaves, s: Sobre, aad: string): Promise<T> {
  return JSON.parse(td.decode(await descifrarCon(l.datos, s, aad)));
}

// Nombre opaco de un registro: el mismo en todos sus celulares, sin dejar ver la fecha
export async function nombreOpaco(l: Llaves, texto: string) {
  const firma = new Uint8Array(await sutil().sign('HMAC', l.hmac, te.encode(texto)));
  return Array.from(firma.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function llaveCompartida(privada: CryptoKey, publica: JsonWebKey, sal: Uint8Array, contexto: string) {
  const pub = await sutil().importKey('jwk', publicaLimpia(publica), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await sutil().deriveBits({ name: 'ECDH', public: pub }, privada, 256);
  const base = await sutil().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return sutil().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: sal as BufferSource, info: te.encode(`you-and-me/ciclo/v1/${contexto}`) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Cifra para la pareja: solo quien tenga la privada de `publicaPareja` lo abre
export async function cifrarPara(publicaPareja: JsonWebKey, valor: unknown, contexto: string): Promise<SobreCompartido> {
  const efimera = await sutil().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sal = azar(16);
  const llave = await llaveCompartida(efimera.privateKey, publicaPareja, sal, contexto);
  const s = await cifrarCon(llave, te.encode(JSON.stringify(valor)), contexto);
  return { v: 1, epk: publicaLimpia(await sutil().exportKey('jwk', efimera.publicKey)), sal: aB64(sal), ...s };
}

export async function abrirDePareja<T>(l: Llaves, s: SobreCompartido, contexto: string): Promise<T | null> {
  try {
    const llave = await llaveCompartida(l.privada, s.epk, deB64(s.sal), contexto);
    return JSON.parse(td.decode(await descifrarCon(llave, s, contexto)));
  } catch { return null; }
}

// Huella de una llave pública para compararla en los dos celulares: 8 grupos de 4
export async function huella(publica: JsonWebKey) {
  const h = new Uint8Array(await sutil().digest('SHA-256', te.encode(`${publica.crv}.${publica.x}.${publica.y}`)));
  return Array.from(h.subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{4}/g)!.join(' ');
}

// Copia descargable cifrada con una clave aparte (para el modo solo en este celular)
export async function cifrarCopia(valor: unknown, clave: string) {
  const sal = azar(16);
  const llave = await llaveDeClave(clave, sal, VUELTAS_CLAVE);
  return { app: 'you-and-me/ciclo', v: 1, sal: aB64(sal), vueltas: VUELTAS_CLAVE, ...(await cifrarCon(llave, te.encode(JSON.stringify(valor)), 'copia')) };
}
export async function abrirCopia<T>(copia: { sal: string; vueltas: number; iv: string; ct: string }, clave: string): Promise<T | null> {
  try {
    const llave = await llaveDeClave(clave, deB64(copia.sal), copia.vueltas);
    return JSON.parse(td.decode(await descifrarCon(llave, copia, 'copia')));
  } catch { return null; }
}

// Qué tan difícil de adivinar es una clave (aproximado): la base la guarda el servidor, así que importa
export function fuerzaClave(c: string): { puntos: 0 | 1 | 2 | 3; texto: string } {
  const largo = [...c].length;
  const variedad = [/[a-záéíóúñ]/, /[A-ZÁÉÍÓÚÑ]/, /\d/, /[^\wáéíóúñÁÉÍÓÚÑ]/].filter((r) => r.test(c)).length;
  const palabras = c.trim().split(/\s+/).length;
  if (largo < 10) return { puntos: 0, texto: 'Muy corta: usa al menos 10 caracteres' };
  if (/^(.)\1+$/.test(c) || /^(0123|1234|abcd|qwer)/i.test(c)) return { puntos: 0, texto: 'Muy fácil de adivinar' };
  if (palabras >= 4 || largo >= 16 && variedad >= 2) return { puntos: 3, texto: 'Muy buena' };
  if (largo >= 12 && variedad >= 2) return { puntos: 2, texto: 'Buena' };
  return { puntos: 1, texto: 'Aceptable: una frase de 4 palabras es más segura' };
}
